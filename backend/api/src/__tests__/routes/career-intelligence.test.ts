/**
 * Career Intelligence Routes - Unit Tests
 *
 * Tests:
 *   GET /recommendations/:employeeId       - Career recommendations
 *   GET /gap-analysis/:employeeId/:uri      - Skill gap analysis
 *   GET /transition/:sourceUri/:targetUri   - Career transition bridge
 *   GET /similar-skills/:skillUri           - Find similar skills
 *   GET /matching-occupations?q=text        - Occupation search
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockClientRelease,
} as never);

jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
  pool: { query: mockQuery },
  appPool: { connect: mockConnect },
  testConnection: jest.fn().mockResolvedValue(true as never),
  testAppConnection: jest.fn().mockResolvedValue(true as never),
  closePool: jest.fn().mockResolvedValue(undefined as never),
  getAppClient: jest.fn(),
  withTenantClient: jest.fn(),
}));

jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
  getRedis: jest.fn(),
  isRedisReady: jest.fn().mockReturnValue(false),
  blacklistToken: jest.fn().mockResolvedValue(true as never),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false as never),
  closeRedis: jest.fn().mockResolvedValue(undefined as never),
}));

jest.unstable_mockModule(resolve('../../errors/sentry.js'), () => ({
  initSentry: jest.fn(),
  sentryErrorLogger: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  flush: jest.fn(),
  close: jest.fn(),
  isActive: jest.fn().mockReturnValue(false),
}));

jest.unstable_mockModule(resolve('../../services/cache.js'), () => ({
  cached: jest.fn().mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn()),
  cachedForTenant: jest
    .fn()
    .mockImplementation(async (_tenantId: string, _key: string, fn: () => Promise<unknown>) =>
      fn()
    ),
  CACHE_TTL: { SHORT: 60, MODERATE: 300, REFERENCE: 900, STATIC: 3600 },
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/career-intelligence.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const { cached, cachedForTenant } = await import('../../services/cache.js');

const TENANT_ID = DEFAULT_IDS.TENANT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/career', authMiddleware);
  app.use('/api/v1/career', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    (req as any).dbClient = { query: mockQuery, release: jest.fn() };
    next();
  });
  app.use('/api/v1/career', routes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res
        .status(status)
        .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    }
  );
  return app;
}

const EMPLOYEE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const OCCUPATION_URI = 'http://data.europa.eu/esco/occupation/f2b15a0e-e65a-4b7e-ad2d-d4f2e1b3c5a7';
const OCCUPATION_URI_2 =
  'http://data.europa.eu/esco/occupation/c8d9e0f1-a2b3-4c5d-6e7f-8a9b0c1d2e3f';
const SKILL_URI = 'http://data.europa.eu/esco/skill/d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a';

describe('Career Intelligence Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.resetAllMocks();
    resetFactories();
    (cached as jest.Mock).mockImplementation(async (_key: string, fn: () => Promise<unknown>) =>
      fn()
    );
    (cachedForTenant as jest.Mock).mockImplementation(
      async (_tenantId: string, _key: string, fn: () => Promise<unknown>) => fn()
    );
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get(`/api/v1/career/recommendations/${EMPLOYEE_ID}`);
    expect(res.status).toBe(401);
  });

  // =========================================================================
  // GET /recommendations/:employeeId
  // =========================================================================

  describe('GET /recommendations/:employeeId', () => {
    it('should return recommendations for employee with skills', async () => {
      // skill count check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
      // fn_employee_career_recommendations result
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            occupation_id: 'occ-001',
            occupation_label: 'Software Developer',
            isco_code: '2512',
            skill_coverage: '0.75',
            total_essential: 12,
            skills_held: 9,
            skills_missing: 3,
            embedding_match: '0.82',
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get(`/api/v1/career/recommendations/${EMPLOYEE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toHaveLength(1);
      expect(res.body.data.skillCount).toBe(5);
      expect(res.body.data.recommendations[0].occupationLabel).toBe('Software Developer');
      expect(typeof res.body.data.recommendations[0].skillCoverage).toBe('number');
      expect(typeof res.body.data.recommendations[0].embeddingMatch).toBe('number');
    });

    it('should return empty recommendations for employee with <2 skills', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/career/recommendations/${EMPLOYEE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recommendations).toEqual([]);
      expect(res.body.data.skillCount).toBe(1);
      expect(res.body.data.message).toContain('at least 2 ESCO-linked skills');
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await supertest(app)
        .get('/api/v1/career/recommendations/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /gap-analysis/:employeeId/:occupationUri
  // =========================================================================

  describe('GET /gap-analysis/:employeeId/:occupationUri', () => {
    const encodedUri = encodeURIComponent(OCCUPATION_URI);

    it('should return gap analysis for valid request', async () => {
      // occupation check
      mockQuery.mockResolvedValueOnce({
        rows: [{ preferred_label_en: 'Software Developer' }],
        rowCount: 1,
      });
      // fn_skill_gap_analysis result
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            missing_skill_id: 'sk-001',
            missing_skill_label: 'Python programming',
            skill_type: 'skill',
            relation_type: 'essential',
            closest_existing_skill: 'Java programming',
            transferability: '0.72',
            gap_difficulty: 'moderate',
          },
          {
            missing_skill_id: 'sk-002',
            missing_skill_label: 'Data analysis',
            skill_type: 'skill',
            relation_type: 'optional',
            closest_existing_skill: null,
            transferability: null,
            gap_difficulty: 'hard',
          },
        ],
        rowCount: 2,
      });

      const res = await supertest(app)
        .get(`/api/v1/career/gap-analysis/${EMPLOYEE_ID}/${encodedUri}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetOccupation).toBe('Software Developer');
      expect(res.body.data.summary.total).toBe(2);
      expect(res.body.data.skills).toHaveLength(2);
      expect(typeof res.body.data.summary.readinessPercent).toBe('number');
    });

    it('should return 404 when occupation not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/career/gap-analysis/${EMPLOYEE_ID}/${encodedUri}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .get(`/api/v1/career/gap-analysis/bad-id/${encodedUri}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /transition/:sourceUri/:targetUri
  // =========================================================================

  describe('GET /transition/:sourceUri/:targetUri', () => {
    const encodedSource = encodeURIComponent(OCCUPATION_URI);
    const encodedTarget = encodeURIComponent(OCCUPATION_URI_2);

    it('should return transition bridge for valid pair', async () => {
      // source occupation check
      mockQuery.mockResolvedValueOnce({
        rows: [{ preferred_label_en: 'Software Developer' }],
        rowCount: 1,
      });
      // target occupation check
      mockQuery.mockResolvedValueOnce({
        rows: [{ preferred_label_en: 'Data Analyst' }],
        rowCount: 1,
      });
      // fn_career_transition_bridge result
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            skill_label: 'Problem solving',
            skill_type: 'skill',
            status: 'HAVE',
            closest_source_skill: null,
            transferability: null,
            is_essential: true,
          },
          {
            skill_label: 'SQL knowledge',
            skill_type: 'knowledge',
            status: 'TRANSFERABLE',
            closest_source_skill: 'Database management',
            transferability: '0.80',
            is_essential: true,
          },
          {
            skill_label: 'Statistical analysis',
            skill_type: 'skill',
            status: 'LEARN',
            closest_source_skill: null,
            transferability: null,
            is_essential: true,
          },
        ],
        rowCount: 3,
      });

      const res = await supertest(app)
        .get(`/api/v1/career/transition/${encodedSource}/${encodedTarget}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceOccupation).toBe('Software Developer');
      expect(res.body.data.targetOccupation).toBe('Data Analyst');
      expect(res.body.data.have).toHaveLength(1);
      expect(res.body.data.transferable).toHaveLength(1);
      expect(res.body.data.learn).toHaveLength(1);
      expect(typeof res.body.data.readinessPercent).toBe('number');
      expect(['easy', 'moderate', 'hard']).toContain(res.body.data.difficulty);
    });

    it('should return 404 when source occupation not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/career/transition/${encodedSource}/${encodedTarget}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 when target occupation not found', async () => {
      // source found
      mockQuery.mockResolvedValueOnce({
        rows: [{ preferred_label_en: 'Software Developer' }],
        rowCount: 1,
      });
      // target not found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/career/transition/${encodedSource}/${encodedTarget}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /similar-skills/:skillUri
  // =========================================================================

  describe('GET /similar-skills/:skillUri', () => {
    const encodedSkill = encodeURIComponent(SKILL_URI);

    it('should return similar skills for valid URI', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            skill_id: 'sk-101',
            uri: 'http://data.europa.eu/esco/skill/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e',
            preferred_label: 'JavaScript',
            skill_type: 'skill',
            reuse_level: 'cross-sector',
            similarity: '0.87',
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get(`/api/v1/career/similar-skills/${encodedSkill}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].preferredLabel).toBe('JavaScript');
      expect(typeof res.body.data[0].similarity).toBe('number');
    });

    it('should return 404 when skill not found', async () => {
      // fn_find_similar_skills returns empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // existence check also empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/career/similar-skills/${encodedSkill}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /matching-occupations?q=text
  // =========================================================================

  describe('GET /matching-occupations', () => {
    it('should return matching occupations for valid query', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            occupation_id: 'occ-201',
            uri: OCCUPATION_URI,
            preferred_label: 'Software Developer',
            isco_code: '2512',
            similarity: '0.91',
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/career/matching-occupations?q=software developer')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].preferredLabel).toBe('Software Developer');
      expect(typeof res.body.data[0].similarity).toBe('number');
    });

    it('should return 400 when q param is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/career/matching-occupations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 when q param is too short', async () => {
      const res = await supertest(app)
        .get('/api/v1/career/matching-occupations?q=a')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});
