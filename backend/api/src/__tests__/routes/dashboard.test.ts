/**
 * Dashboard Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for dashboard analytics endpoints.
 * All external dependencies (database, redis) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildSysadminTokenPayload,
  buildEmployeeTokenPayload,
  resetFactories,
  DEFAULT_IDS,
} from '../factories/index.js';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: dashboardRoutes } = await import('../../routes/dashboard.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants & Test app factory
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/dashboard', authMiddleware);
  app.use('/api/v1/dashboard', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        code: err.code,
      });
    }
  );
  return app;
}

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
  });

  // =========================================================================
  // Auth enforcement
  // =========================================================================

  describe('Auth enforcement', () => {
    it('should return 401 for GET /overview without token', async () => {
      const res = await supertest(app).get('/api/v1/dashboard/overview');
      expect(res.status).toBe(401);
    });

    it('should return 401 for GET /hr-metrics without token', async () => {
      const res = await supertest(app).get('/api/v1/dashboard/hr-metrics');
      expect(res.status).toBe(401);
    });

    it('should return 401 for GET /trends without token', async () => {
      const res = await supertest(app).get('/api/v1/dashboard/trends');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /dashboard/overview
  // =========================================================================

  describe('GET /overview', () => {
    it('should return 200 with aggregated overview metrics', async () => {
      // Query 1: employee stats
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_employees: '267', active_employees: '250', departments: '27' }],
        rowCount: 1,
      });
      // Query 2: goals stats
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_goals: '1065',
            completed_goals: '300',
            in_progress_goals: '500',
            avg_progress: '45.3',
          },
        ],
        rowCount: 1,
      });
      // Query 3: reviews stats
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_reviews: '290', completed_reviews: '200', avg_rating: '3.75' }],
        rowCount: 1,
      });
      // Query 4: learning stats
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_courses: '60', total_enrollments: '350' }],
        rowCount: 1,
      });
      // Query 5: recognition stats
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_recognitions: '120', total_points: '5000' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employees.total_employees).toBe('267');
      expect(res.body.data.employees.active_employees).toBe('250');
      expect(res.body.data.goals.total_goals).toBe('1065');
      expect(res.body.data.reviews.avg_rating).toBe('3.75');
      expect(res.body.data.learning.total_courses).toBe('60');
      expect(res.body.data.recognition.total_points).toBe('5000');
    });

    it('should return 200 with zero-value metrics when no data exists', async () => {
      const emptyStats = {
        rows: [{ total_employees: '0', active_employees: '0', departments: '0' }],
        rowCount: 1,
      };
      const emptyGoals = {
        rows: [
          { total_goals: '0', completed_goals: '0', in_progress_goals: '0', avg_progress: null },
        ],
        rowCount: 1,
      };
      const emptyReviews = {
        rows: [{ total_reviews: '0', completed_reviews: '0', avg_rating: null }],
        rowCount: 1,
      };
      const emptyLearning = { rows: [{ total_courses: '0', total_enrollments: '0' }], rowCount: 1 };
      const emptyRecognition = {
        rows: [{ total_recognitions: '0', total_points: '0' }],
        rowCount: 1,
      };

      mockQuery
        .mockResolvedValueOnce(emptyStats)
        .mockResolvedValueOnce(emptyGoals)
        .mockResolvedValueOnce(emptyReviews)
        .mockResolvedValueOnce(emptyLearning)
        .mockResolvedValueOnce(emptyRecognition);

      const res = await supertest(app)
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employees.total_employees).toBe('0');
      expect(res.body.data.goals.avg_progress).toBeNull();
    });

    it('should return 500 when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should pass tenantId to all 5 SQL queries', async () => {
      for (let i = 0; i < 5; i++) {
        mockQuery.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
      }

      await supertest(app)
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(mockQuery).toHaveBeenCalledTimes(5);
      for (let i = 0; i < 5; i++) {
        expect(mockQuery.mock.calls[i]![1]).toEqual([TENANT_ID]);
      }
    });
  });

  // =========================================================================
  // GET /dashboard/hr-metrics
  // =========================================================================

  describe('GET /hr-metrics', () => {
    it('should return 200 with HR metrics data', async () => {
      // Query 1: headcount by department
      mockQuery.mockResolvedValueOnce({
        rows: [
          { department: 'IT', count: '50' },
          { department: 'HR', count: '30' },
        ],
        rowCount: 2,
      });
      // Query 2: recruiting pipeline
      mockQuery.mockResolvedValueOnce({
        rows: [
          { stage: 'new', count: '10' },
          { stage: 'screening', count: '5' },
          { stage: 'interview', count: '3' },
        ],
        rowCount: 3,
      });
      // Query 3: open requisitions
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '12' }],
        rowCount: 1,
      });
      // Query 4: pending time off
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '8' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/hr-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.headcount_by_org_unit).toHaveLength(2);
      expect(res.body.data.headcount_by_org_unit[0].department).toBe('IT');
      expect(res.body.data.recruiting_pipeline).toHaveLength(3);
      expect(res.body.data.open_requisitions).toBe(12);
      expect(res.body.data.pending_time_off).toBe(8);
    });

    it('should return 200 with empty arrays when no data', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/dashboard/hr-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.headcount_by_org_unit).toEqual([]);
      expect(res.body.data.recruiting_pipeline).toEqual([]);
      expect(res.body.data.open_requisitions).toBe(0);
      expect(res.body.data.pending_time_off).toBe(0);
    });

    it('should return 500 when database fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/hr-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /dashboard/performance-metrics
  // =========================================================================

  describe('GET /performance-metrics', () => {
    it('should return 200 with performance metrics', async () => {
      // Query 1: goal completion
      mockQuery.mockResolvedValueOnce({
        rows: [{ completed: '300', total: '1065', completion_rate: '28.2' }],
        rowCount: 1,
      });
      // Query 2: review by type
      mockQuery.mockResolvedValueOnce({
        rows: [
          { review_type: 'annual', total_reviews: '200', completed: '180' },
          { review_type: 'quarterly', total_reviews: '90', completed: '60' },
        ],
        rowCount: 2,
      });
      // Query 3: rating distribution
      mockQuery.mockResolvedValueOnce({
        rows: [
          { rating_category: 'Meets', count: '120' },
          { rating_category: 'Exceeds', count: '80' },
          { rating_category: 'Exceptional', count: '30' },
        ],
        rowCount: 3,
      });
      // Query 4: check-in activity
      mockQuery.mockResolvedValueOnce({
        rows: [{ last_7d: '150', last_30d: '800', total: '2401' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/performance-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.goal_completion.completion_rate).toBe('28.2');
      expect(res.body.data.reviews_by_type).toHaveLength(2);
      expect(res.body.data.rating_distribution).toHaveLength(3);
      expect(res.body.data.check_in_activity.total).toBe('2401');
    });

    it('should return 500 when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/performance-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /dashboard/learning-metrics
  // =========================================================================

  describe('GET /learning-metrics', () => {
    it('should return 200 with learning metrics data', async () => {
      // Query 1: enrollment stats
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_enrollments: '350', completed: '150', in_progress: '100' }],
        rowCount: 1,
      });
      // Query 2: top courses
      mockQuery.mockResolvedValueOnce({
        rows: [
          { title: 'Leadership Basics', enrollment_count: '50' },
          { title: 'Data Security', enrollment_count: '40' },
        ],
        rowCount: 2,
      });
      // Query 3: learning path progress
      mockQuery.mockResolvedValueOnce({
        rows: [{ title: 'Manager Track', total_enrolled: '25', completed: '10' }],
        rowCount: 1,
      });
      // Query 4: certifications
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_certifications: '80', valid: '70', expired: '10' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/learning-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enrollment_stats.total_enrollments).toBe('350');
      expect(res.body.data.top_courses).toHaveLength(2);
      expect(res.body.data.top_courses[0].title).toBe('Leadership Basics');
      expect(res.body.data.learning_path_progress).toHaveLength(1);
      expect(res.body.data.certifications.valid).toBe('70');
    });

    it('should return 500 on database failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/learning-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /dashboard/engagement-metrics
  // =========================================================================

  describe('GET /engagement-metrics', () => {
    it('should return 200 with engagement metrics', async () => {
      // Query 1: survey participation
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            title: 'Q1 Engagement Survey',
            total_invitations: 200,
            responses: '150',
            participation_rate: '75.0',
          },
        ],
        rowCount: 1,
      });
      // Query 2: recognition activity
      mockQuery.mockResolvedValueOnce({
        rows: [
          { week: '2025-02-17', count: '12' },
          { week: '2025-02-10', count: '8' },
        ],
        rowCount: 2,
      });
      // Query 3: wellbeing trends
      mockQuery.mockResolvedValueOnce({
        rows: [{ avg_mood: '3.80', avg_stress: '2.50', avg_energy: '3.60' }],
        rowCount: 1,
      });
      // Query 4: feedback frequency
      mockQuery.mockResolvedValueOnce({
        rows: [{ last_7d: '25', last_30d: '90' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/engagement-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.survey_participation).toHaveLength(1);
      expect(res.body.data.survey_participation[0].title).toBe('Q1 Engagement Survey');
      expect(res.body.data.recognition_activity).toHaveLength(2);
      expect(res.body.data.wellbeing_trends.avg_mood).toBe('3.80');
      expect(res.body.data.feedback_frequency.last_7d).toBe('25');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection lost'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/engagement-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /dashboard/compensation-metrics
  // =========================================================================

  describe('GET /compensation-metrics', () => {
    it('should return 200 with compensation metrics', async () => {
      // Query 1: salary band coverage
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_bands: '15', job_levels: '5' }],
        rowCount: 1,
      });
      // Query 2: bonus plan status
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_plans: '3', active: '2', completed: '1' }],
        rowCount: 1,
      });
      // Query 3: merit cycle progress
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            name: '2025 Merit Cycle',
            status: 'active',
            total_budget: '500000',
            recommendations: '50',
          },
        ],
        rowCount: 1,
      });
      // Query 4: benefits enrollment
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_benefits: '10', total_enrollments: '200', active_enrollments: '180' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/compensation-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salary_band_coverage.total_bands).toBe('15');
      expect(res.body.data.bonus_plan_status.active).toBe('2');
      expect(res.body.data.merit_cycle_progress).toHaveLength(1);
      expect(res.body.data.benefits_enrollment.active_enrollments).toBe('180');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/compensation-metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /dashboard/trends
  // =========================================================================

  describe('GET /trends', () => {
    const buildTrendRows = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        date: `2025-${String(i + 1).padStart(2, '0')}-01`,
        value: String(100 + i * 5),
      }));

    it('should return 200 with trend data using default 30d range', async () => {
      // Query 1: headcount trend
      mockQuery.mockResolvedValueOnce({ rows: buildTrendRows(12), rowCount: 12 });
      // Query 2: turnover trend
      mockQuery.mockResolvedValueOnce({
        rows: [{ date: '2025-01-01', terminations: 2, total_at_month: 200 }],
        rowCount: 1,
      });
      // Query 3: hires trend
      mockQuery.mockResolvedValueOnce({ rows: buildTrendRows(12), rowCount: 12 });
      // Query 4: goals trend
      mockQuery.mockResolvedValueOnce({
        rows: [{ date: '2025-01-01', completed: 30, total: 100 }],
        rowCount: 1,
      });
      // Query 5: engagement trend
      mockQuery.mockResolvedValueOnce({
        rows: [{ date: '2025-01-01', value: '3.5' }],
        rowCount: 1,
      });
      // Query 6: recognition trend
      mockQuery.mockResolvedValueOnce({ rows: [{ date: '2025-01-01', value: '10' }], rowCount: 1 });
      // Query 7: current period stats
      mockQuery.mockResolvedValueOnce({
        rows: [{ current_headcount: '250', new_hires_period: '15', terminations_period: '5' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/trends')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.range).toBe('30d');
      expect(res.body.data.date_from).toBeDefined();
      expect(res.body.data.date_to).toBeDefined();
      expect(res.body.data.trends.headcount).toHaveLength(12);
      expect(res.body.data.trends.turnover_rate).toHaveLength(1);
      expect(res.body.data.trends.turnover_rate[0].value).toBe(12);
      expect(res.body.data.trends.goals_completion).toHaveLength(1);
      expect(res.body.data.trends.goals_completion[0].value).toBe(30);
      expect(res.body.data.summary.current_headcount).toBe('250');
    });

    it('should accept custom range parameter', async () => {
      for (let i = 0; i < 7; i++) {
        mockQuery.mockResolvedValueOnce({
          rows: [
            {
              date: '2025-01-01',
              value: '0',
              terminations: 0,
              total_at_month: 0,
              completed: 0,
              total: 0,
              current_headcount: '0',
              new_hires_period: '0',
              terminations_period: '0',
            },
          ],
          rowCount: 1,
        });
      }

      const res = await supertest(app)
        .get('/api/v1/dashboard/trends?range=90d')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe('90d');
    });

    it('should calculate turnover rate as 0 when total_at_month is 0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({
        rows: [{ date: '2025-01-01', terminations: 0, total_at_month: 0 }],
        rowCount: 1,
      });
      for (let i = 0; i < 5; i++) {
        mockQuery.mockResolvedValueOnce({
          rows: [
            {
              date: '2025-01-01',
              value: '0',
              completed: 0,
              total: 0,
              current_headcount: '0',
              new_hires_period: '0',
              terminations_period: '0',
            },
          ],
          rowCount: 1,
        });
      }

      const res = await supertest(app)
        .get('/api/v1/dashboard/trends')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.trends.turnover_rate[0].value).toBe(0);
    });

    it('should return 500 when database fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/trends')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /dashboard/turnover-by-department
  // =========================================================================

  describe('GET /turnover-by-department', () => {
    it('should return 200 with turnover by department data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { department: 'IT', headcount: '50', terminations: '3', turnover_rate: '6.0' },
          { department: 'HR', headcount: '20', terminations: '1', turnover_rate: '5.0' },
        ],
        rowCount: 2,
      });

      const res = await supertest(app)
        .get('/api/v1/dashboard/turnover-by-department')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.range).toBe('12m');
      expect(res.body.data.departments).toHaveLength(2);
      expect(res.body.data.departments[0].department).toBe('IT');
      expect(res.body.data.departments[0].turnover_rate).toBe('6.0');
    });

    it('should accept custom range parameter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/dashboard/turnover-by-department?range=ytd')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe('ytd');
      expect(res.body.data.departments).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/dashboard/turnover-by-department')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
