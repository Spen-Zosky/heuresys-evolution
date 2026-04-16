/**
 * Skill Analytics Routes - Comprehensive Behavioral Tests
 * Tests actual HTTP request/response behavior for all skill-analytics endpoints.
 * Covers: summary stats, heatmap, trends, shortages, KSABA distribution,
 * emerging skills, department comparison, department detail.
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

// Mock skill analytics service
const mockGetSummaryStats = jest.fn();
const mockGetSkillCoverageHeatmap = jest.fn();
const mockGetSkillTrends = jest.fn();
const mockGetCriticalShortages = jest.fn();
const mockGetKSABADistribution = jest.fn();
const mockGetEmergingSkills = jest.fn();
const mockGetDepartmentComparison = jest.fn();

jest.unstable_mockModule(resolve('../../services/skill-analytics/index.js'), () => ({
  SkillAnalyticsService: jest.fn().mockImplementation(() => ({
    getSummaryStats: mockGetSummaryStats,
    getSkillCoverageHeatmap: mockGetSkillCoverageHeatmap,
    getSkillTrends: mockGetSkillTrends,
    getCriticalShortages: mockGetCriticalShortages,
    getKSABADistribution: mockGetKSABADistribution,
    getEmergingSkills: mockGetEmergingSkills,
    getDepartmentComparison: mockGetDepartmentComparison,
  })),
}));

const { default: express } = await import('express');
const { default: skillAnalyticsRoutes } = await import('../../routes/skill-analytics.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const DEPT_ID = DEFAULT_IDS.DEPARTMENT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/skill-analytics', authMiddleware);
  app.use('/api/v1/skill-analytics', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/skill-analytics', skillAnalyticsRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || err.httpStatus || 500;
    res
      .status(status)
      .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
  });
  return app;
}

function createSysadminToken() {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('Skill Analytics Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  describe('GET /skill-analytics/summary', () => {
    it('should return summary statistics', async () => {
      const summary = {
        totalSkills: 150,
        totalEmployees: 200,
        avgProficiency: 3.2,
        coverageRate: 72,
      };
      mockGetSummaryStats.mockResolvedValue(summary);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(summary);
    });
  });

  // ===========================================================================
  // HEATMAP
  // ===========================================================================

  describe('GET /skill-analytics/heatmap', () => {
    it('should return skill coverage heatmap data', async () => {
      const heatmap = [
        { department: 'IT', skill: 'Python', avgProficiency: 4.2, employeeCount: 15 },
        { department: 'HR', skill: 'Python', avgProficiency: 1.5, employeeCount: 3 },
      ];
      mockGetSkillCoverageHeatmap.mockResolvedValue(heatmap);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/heatmap')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should pass department and skill filters', async () => {
      mockGetSkillCoverageHeatmap.mockResolvedValue([]);

      const res = await supertest(app)
        .get(
          `/api/v1/skill-analytics/heatmap?org_unit_ids=${DEPT_ID}&skill_ids=s1,s2&min_proficiency=3`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockGetSkillCoverageHeatmap).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          org_unit_ids: [DEPT_ID],
          skill_ids: ['s1', 's2'],
          min_proficiency: 3,
        })
      );
    });
  });

  // ===========================================================================
  // TRENDS
  // ===========================================================================

  describe('GET /skill-analytics/trends', () => {
    it('should return skill trends over time', async () => {
      const trends = [
        { period: '2025-01', skillName: 'React', avgLevel: 3.5, employeeCount: 20 },
        { period: '2025-02', skillName: 'React', avgLevel: 3.8, employeeCount: 22 },
      ];
      mockGetSkillTrends.mockResolvedValue(trends);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/trends')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should pass period and lookback params', async () => {
      mockGetSkillTrends.mockResolvedValue([]);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/trends?period=quarterly&lookback_periods=4&skill_ids=s1,s2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockGetSkillTrends).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          period: 'quarterly',
          lookback_periods: 4,
          skill_ids: ['s1', 's2'],
        })
      );
    });

    it('should use default period and lookback if not provided', async () => {
      mockGetSkillTrends.mockResolvedValue([]);

      await supertest(app)
        .get('/api/v1/skill-analytics/trends')
        .set('Authorization', `Bearer ${token}`);

      expect(mockGetSkillTrends).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          period: 'monthly',
          lookback_periods: 6,
        })
      );
    });
  });

  // ===========================================================================
  // SHORTAGES
  // ===========================================================================

  describe('GET /skill-analytics/shortages', () => {
    it('should return critical skill shortages with severity summary', async () => {
      const shortages = [
        { skillName: 'Cybersecurity', severity: 'critical', gap: 5 },
        { skillName: 'AI/ML', severity: 'high', gap: 3 },
        { skillName: 'DevOps', severity: 'medium', gap: 2 },
        { skillName: 'UX Design', severity: 'low', gap: 1 },
      ];
      mockGetCriticalShortages.mockResolvedValue(shortages);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/shortages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.count).toBe(4);
      expect(res.body.summary.critical).toBe(1);
      expect(res.body.summary.high).toBe(1);
      expect(res.body.summary.medium).toBe(1);
      expect(res.body.summary.low).toBe(1);
    });

    it('should pass department and min_shortage filters', async () => {
      mockGetCriticalShortages.mockResolvedValue([]);

      await supertest(app)
        .get(`/api/v1/skill-analytics/shortages?org_unit_id=${DEPT_ID}&min_shortage=3`)
        .set('Authorization', `Bearer ${token}`);

      expect(mockGetCriticalShortages).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          org_unit_id: DEPT_ID,
          min_shortage: 3,
        })
      );
    });
  });

  // ===========================================================================
  // KSABA
  // ===========================================================================

  describe('GET /skill-analytics/ksaba', () => {
    it('should return KSABA dimension distribution', async () => {
      const distribution = {
        knowledge: { count: 30, avgLevel: 3.5 },
        skills: { count: 50, avgLevel: 3.2 },
        abilities: { count: 25, avgLevel: 3.8 },
        behaviors: { count: 15, avgLevel: 3.0 },
        attitudes: { count: 10, avgLevel: 4.0 },
      };
      mockGetKSABADistribution.mockResolvedValue(distribution);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/ksaba')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(distribution);
    });

    it('should pass org_unit_id and employee_id filters', async () => {
      mockGetKSABADistribution.mockResolvedValue({});

      await supertest(app)
        .get(
          `/api/v1/skill-analytics/ksaba?org_unit_id=${DEPT_ID}&employee_id=${DEFAULT_IDS.EMPLOYEE_ID}`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(mockGetKSABADistribution).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          org_unit_id: DEPT_ID,
          employee_id: DEFAULT_IDS.EMPLOYEE_ID,
        })
      );
    });
  });

  // ===========================================================================
  // EMERGING SKILLS
  // ===========================================================================

  describe('GET /skill-analytics/emerging', () => {
    it('should return emerging skills', async () => {
      const emerging = [
        { skillName: 'GenAI', occurrences: 15, growthRate: 2.5 },
        { skillName: 'Prompt Engineering', occurrences: 10, growthRate: 3.0 },
      ];
      mockGetEmergingSkills.mockResolvedValue(emerging);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/emerging')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should pass lookback, occurrences, and limit params', async () => {
      mockGetEmergingSkills.mockResolvedValue([]);

      await supertest(app)
        .get('/api/v1/skill-analytics/emerging?lookback_days=30&min_occurrences=5&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(mockGetEmergingSkills).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          lookback_days: 30,
          min_occurrences: 5,
          limit: 10,
        })
      );
    });

    it('should use defaults when no params provided', async () => {
      mockGetEmergingSkills.mockResolvedValue([]);

      await supertest(app)
        .get('/api/v1/skill-analytics/emerging')
        .set('Authorization', `Bearer ${token}`);

      expect(mockGetEmergingSkills).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          lookback_days: 90,
          min_occurrences: 3,
          limit: 20,
        })
      );
    });
  });

  // ===========================================================================
  // DEPARTMENTS
  // ===========================================================================

  describe('GET /skill-analytics/org-units', () => {
    it('should return department comparison metrics', async () => {
      const comparison = [
        { orgUnitId: DEPT_ID, name: 'IT', totalSkills: 80, avgProficiency: 3.5 },
        { orgUnitId: '2', name: 'HR', totalSkills: 40, avgProficiency: 3.0 },
      ];
      mockGetDepartmentComparison.mockResolvedValue(comparison);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/org-units')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should pass org_unit_ids filter', async () => {
      mockGetDepartmentComparison.mockResolvedValue([]);

      await supertest(app)
        .get(`/api/v1/skill-analytics/org-units?org_unit_ids=${DEPT_ID},d2`)
        .set('Authorization', `Bearer ${token}`);

      expect(mockGetDepartmentComparison).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          org_unit_ids: [DEPT_ID, 'd2'],
        })
      );
    });
  });

  describe('GET /skill-analytics/org-units/:orgUnitId', () => {
    it('should return detailed analytics for a specific department', async () => {
      const deptOverview = { orgUnitId: DEPT_ID, name: 'IT', totalSkills: 80 };
      const ksaba = { knowledge: { count: 10 } };
      const heatmap = [{ skill: 'Python', avgProficiency: 4.0 }];
      const shortages = [{ skillName: 'Cybersecurity', severity: 'critical' }];

      mockGetDepartmentComparison.mockResolvedValue([deptOverview]);
      mockGetKSABADistribution.mockResolvedValue(ksaba);
      mockGetSkillCoverageHeatmap.mockResolvedValue(heatmap);
      mockGetCriticalShortages.mockResolvedValue(shortages);

      const res = await supertest(app)
        .get(`/api/v1/skill-analytics/org-units/${DEPT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview).toEqual(deptOverview);
      expect(res.body.data.ksaba_distribution).toEqual(ksaba);
      expect(res.body.data.skill_coverage).toEqual(heatmap);
      expect(res.body.data.shortages).toEqual(shortages);
    });

    it('should return 404 when department not found', async () => {
      mockGetDepartmentComparison.mockResolvedValue([]);
      mockGetKSABADistribution.mockResolvedValue({});
      mockGetSkillCoverageHeatmap.mockResolvedValue([]);
      mockGetCriticalShortages.mockResolvedValue([]);

      const res = await supertest(app)
        .get('/api/v1/skill-analytics/org-units/00000000-0000-4000-a000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/OrgUnit (not found|non trovato)/i);
    });
  });

  // ===========================================================================
  // AUTH
  // ===========================================================================

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/skill-analytics/summary');
      expect(res.status).toBe(401);
    });
  });
});
