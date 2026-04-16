/**
 * Performance-Skill Integration Routes - Unit Tests
 * Tests actual HTTP request/response behavior for performance-skill-integration endpoints.
 *
 * Endpoints tested:
 *  POST /link/:reviewId                     - Link performance review to skills
 *  POST /gap-analysis/:employeeId           - Trigger gap analysis
 *  GET  /mentor-matches/:employeeId         - Find mentor matches
 *  GET  /learning-recommendations/:employeeId - Learning recs
 *  GET  /summary/:employeeId               - Employee summary
 *  GET  /summary                            - All employees summary
 *  GET  /links/:employeeId                 - Get all links
 *  PUT  /links/:linkId/address             - Mark link addressed
 *  POST /batch-link                         - Batch link reviews
 *  GET  /development-plan/:employeeId      - Full development plan
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

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/performance-skill-integration.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = '11111111-2222-4333-a444-555555555555';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/performance-skill', authMiddleware);
  app.use('/api/v1/performance-skill', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/performance-skill', routes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  );
  return app;
}

describe('performance-skill-integration Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ==================== AUTH ====================

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/performance-skill/summary');
    expect(res.status).toBe(401);
  });

  // ==================== POST /link/:reviewId ====================

  describe('POST /link/:reviewId', () => {
    it('should return 400 for invalid reviewId UUID', async () => {
      const res = await supertest(app)
        .post('/api/v1/performance-skill/link/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Validation failed|Invalid review ID/i);
    });

    it('should return 404 when review not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post(`/api/v1/performance-skill/link/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 200 and link data on success', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            competencies_processed: 5,
            low_ratings_found: 2,
            skills_linked: 3,
            gap_analyses_triggered: 1,
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post(`/api/v1/performance-skill/link/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.competenciesProcessed).toBe(5);
      expect(res.body.data.lowRatingsFound).toBe(2);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));
      const res = await supertest(app)
        .post(`/api/v1/performance-skill/link/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });

  // ==================== POST /gap-analysis/:employeeId ====================

  describe('POST /gap-analysis/:employeeId', () => {
    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .post('/api/v1/performance-skill/gap-analysis/bad-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 200 with null data when no low-rated competencies', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post(`/api/v1/performance-skill/gap-analysis/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('should return 200 with gap analysis data on success', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ gap_analysis_id: 'gap-1', skill_gaps_count: 3, priority_skills: ['skill-a'] }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post(`/api/v1/performance-skill/gap-analysis/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.gapAnalysisId).toBe('gap-1');
    });
  });

  // ==================== GET /mentor-matches/:employeeId ====================

  describe('GET /mentor-matches/:employeeId', () => {
    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .get('/api/v1/performance-skill/mentor-matches/invalid')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid skillId query param', async () => {
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/mentor-matches/${VALID_UUID}?skillId=not-uuid`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 200 with empty matches', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/mentor-matches/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matchesCount).toBe(0);
      expect(res.body.matches).toEqual([]);
    });

    it('should return 200 with mentor match data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            mentor_id: 'm-1',
            mentor_name: 'Mario Rossi',
            mentor_title: 'Senior Dev',
            mentor_department: 'IT',
            skill_name: 'TypeScript',
            mentee_level: '2.0',
            mentor_level: '4.5',
            match_score: '0.85',
            match_factors: { skill_gap: 2.5 },
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/mentor-matches/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.matchesCount).toBe(1);
      expect(res.body.matches[0].mentorName).toBe('Mario Rossi');
    });
  });

  // ==================== GET /learning-recommendations/:employeeId ====================

  describe('GET /learning-recommendations/:employeeId', () => {
    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .get('/api/v1/performance-skill/learning-recommendations/bad')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 200 with empty recommendations', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/learning-recommendations/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recommendations).toEqual([]);
    });

    it('should return 200 with grouped recommendations', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employee_name: 'Lucia Bianchi',
            competency_name: 'Leadership',
            competency_rating: '2.0',
            linked_skill_name: 'Team Management',
            skill_description: 'Manage teams',
            course_id: 'c-1',
            course_title: 'Leadership 101',
            duration_hours: 8,
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/learning-recommendations/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.employeeName).toBe('Lucia Bianchi');
      expect(res.body.recommendations.length).toBe(1);
    });
  });

  // ==================== GET /summary/:employeeId ====================

  describe('GET /summary/:employeeId', () => {
    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .get('/api/v1/performance-skill/summary/invalid')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 200 with null data when no links found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/summary/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('should return 200 with summary data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employee_id: VALID_UUID,
            employee_name: 'Mario Rossi',
            job_title: 'Dev',
            department_name: 'IT',
            total_competencies: '10',
            low_rated: '2',
            medium_rated: '5',
            high_rated: '3',
            skills_linked: '8',
            gap_analyses: '2',
            addressed: '1',
            last_updated: '2025-06-01',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/summary/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalCompetencies).toBe(10);
      expect(res.body.data.lowRated).toBe(2);
    });
  });

  // ==================== GET /summary ====================

  describe('GET /summary (all employees)', () => {
    it('should return 200 with list of summaries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employee_id: VALID_UUID,
            employee_name: 'Marco Verdi',
            job_title: 'Analyst',
            department_name: 'Finance',
            total_competencies: '6',
            low_rated: '1',
            medium_rated: '3',
            high_rated: '2',
            skills_linked: '5',
            gap_analyses: '1',
            addressed: '0',
            last_updated: '2025-05-01',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/performance-skill/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].employeeName).toBe('Marco Verdi');
    });
  });

  // ==================== GET /links/:employeeId ====================

  describe('GET /links/:employeeId', () => {
    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .get('/api/v1/performance-skill/links/bad')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid ratingLevel', async () => {
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/links/${VALID_UUID}?ratingLevel=extreme`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Validation failed|Invalid rating level/i);
    });

    it('should return 200 with links', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'link-1',
            performance_review_id: 'pr-1',
            competency_name: 'Communication',
            competency_rating: '2.5',
            rating_level: 'low',
            linked_skill_id: 's-1',
            skill_name: 'Public Speaking',
            skill_description: 'desc',
            linked_gap_analysis_id: null,
            recommended_actions: null,
            learning_path_id: null,
            mentor_recommendation_id: null,
            is_addressed: false,
            addressed_at: null,
            review_period_start: '2025-01-01',
            review_period_end: '2025-06-30',
            cycle_name: 'H1 2025',
            created_at: '2025-07-01',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/links/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.links[0].competencyName).toBe('Communication');
    });
  });

  // ==================== PUT /links/:linkId/address ====================

  describe('PUT /links/:linkId/address', () => {
    it('should return 400 for invalid linkId', async () => {
      const res = await supertest(app)
        .put('/api/v1/performance-skill/links/bad/address')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 404 when link not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .put(`/api/v1/performance-skill/links/${VALID_UUID}/address`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 when link marked as addressed', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: VALID_UUID, is_addressed: true }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .put(`/api/v1/performance-skill/links/${VALID_UUID}/address`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/addressed/i);
    });
  });

  // ==================== POST /batch-link ====================

  describe('POST /batch-link', () => {
    it('should return 200 with batch results (no pending)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post('/api/v1/performance-skill/batch-link')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.totalProcessed).toBe(0);
    });

    it('should return 200 processing pending reviews', async () => {
      // First call: pending reviews
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rev-1' }], rowCount: 1 });
      // Second call: link result
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            competencies_processed: 3,
            low_ratings_found: 1,
            skills_linked: 2,
            gap_analyses_triggered: 0,
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post('/api/v1/performance-skill/batch-link')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.successful).toBe(1);
    });
  });

  // ==================== GET /development-plan/:employeeId ====================

  describe('GET /development-plan/:employeeId', () => {
    it('should return 400 for invalid employeeId', async () => {
      const res = await supertest(app)
        .get('/api/v1/performance-skill/development-plan/bad')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('should return 404 when employee not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/development-plan/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 with full development plan', async () => {
      // Employee query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: VALID_UUID,
            first_name: 'Mario',
            last_name: 'Rossi',
            job_title: 'Dev',
            department: 'IT',
          },
        ],
        rowCount: 1,
      });
      // Low-rated competencies
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Mentor matches
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Gap analysis
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/performance-skill/development-plan/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.developmentPlan.employee.name).toBe('Mario Rossi');
      expect(res.body.developmentPlan.areasForDevelopment).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));
      const res = await supertest(app)
        .get(`/api/v1/performance-skill/development-plan/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });
});
