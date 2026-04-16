/**
 * Performance Reviews Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for performance review CRUD endpoints.
 * All external dependencies (database, redis, performance-management service) are mocked.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

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

// Mock the performance management service
const mockGet9BoxGrid = jest.fn();
const mockGetCompetencyFrameworks = jest.fn();
const mockGetRatingScales = jest.fn();
const mockSubmit360Feedback = jest.fn();

jest.unstable_mockModule(resolve('../../services/performance-management.js'), () => ({
  performanceManagementService: {
    get9BoxGrid: mockGet9BoxGrid,
    getCompetencyFrameworks: mockGetCompetencyFrameworks,
    getRatingScales: mockGetRatingScales,
    submit360Feedback: mockSubmit360Feedback,
    getCalibrationSessionDetails: jest.fn(),
    createCalibrationSession: jest.fn(),
    addCalibrationParticipants: jest.fn(),
    completeCalibrationSession: jest.fn(),
    recordCalibrationAdjustment: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: performanceReviewsRoutes } = await import('../../routes/performance-reviews.js');
const { generateToken } = await import('../../middleware/auth.js');
const { authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const EMPLOYEE_UUID = 'e1e2e3e4-f5f6-4a7b-8c9d-111111111111';
const REVIEWER_UUID = 'a1a2a3a4-f5f6-4a7b-8c9d-222222222222';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/performance-reviews', authMiddleware);
  app.use('/api/v1/performance-reviews', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/performance-reviews', performanceReviewsRoutes);
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

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Performance Reviews Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    } as never);
  });

  // =========================================================================
  // Auth enforcement
  // =========================================================================
  describe('Authentication Enforcement', () => {
    it('should return 401 for GET /performance-reviews without auth token', async () => {
      const res = await supertest(app)
        .get('/api/v1/performance-reviews')
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /performance-reviews without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/performance-reviews')
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_UUID, reviewer_id: REVIEWER_UUID });

      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /performance-reviews/:id without auth token', async () => {
      const res = await supertest(app)
        .delete(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/stats
  // =========================================================================
  describe('GET /api/v1/performance-reviews/stats', () => {
    it('should return extended stats including ratings and top performers', async () => {
      const token = createSysadminToken();

      // Basic stats query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total: '10',
            draft: '2',
            pending: '3',
            completed: '5',
            avg_overall_rating: '3.80',
            avg_goal_rating: '4.00',
          },
        ],
        rowCount: 1,
      } as never);

      // Rating distribution
      mockQuery.mockResolvedValueOnce({
        rows: [
          { rating: 'Buono', count: '5' },
          { rating: 'Eccellente', count: '3' },
          { rating: 'Adeguato', count: '2' },
        ],
        rowCount: 3,
      } as never);

      // Top performers
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'emp-1', name: 'Mario Rossi', department: 'IT', score: 92 },
          { id: 'emp-2', name: 'Lucia Bianchi', department: 'HR', score: 88 },
        ],
        rowCount: 2,
      } as never);

      // OrgUnit performance
      mockQuery.mockResolvedValueOnce({
        rows: [
          { department: 'IT', avg_score: '85', goals_completed: '10', reviews_completed: '5' },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/performance-reviews/stats')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total', '10');
      expect(res.body.data).toHaveProperty('ratings');
      expect(res.body.data.ratings).toHaveLength(3);
      expect(res.body.data).toHaveProperty('topPerformers');
      expect(res.body.data.topPerformers).toHaveLength(2);
      expect(res.body.data).toHaveProperty('departmentPerformance');
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews - List reviews
  // =========================================================================
  describe('GET /api/v1/performance-reviews', () => {
    it('should return paginated review list', async () => {
      const token = createSysadminToken();

      const reviews = [
        {
          id: 'rev-1',
          employee_id: EMPLOYEE_UUID,
          reviewer_id: REVIEWER_UUID,
          status: 'draft',
          employee_name: 'Mario Rossi',
          reviewer_name: 'Lucia Bianchi',
        },
        {
          id: 'rev-2',
          employee_id: 'emp-2',
          reviewer_id: REVIEWER_UUID,
          status: 'completed',
          employee_name: 'Marco Verdi',
          reviewer_name: 'Lucia Bianchi',
        },
      ];

      // List query
      mockQuery.mockResolvedValueOnce({ rows: reviews, rowCount: 2 } as never);
      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/performance-reviews?limit=20&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toHaveProperty('total', 2);
      expect(res.body.meta).toHaveProperty('limit', 20);
      expect(res.body.meta).toHaveProperty('offset', 0);
    });

    it('should return empty list when no reviews found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/performance-reviews')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should filter by status when query param provided', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'rev-1', status: 'completed' }],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/performance-reviews?status=completed')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/my
  // =========================================================================
  describe('GET /api/v1/performance-reviews/my', () => {
    it('should return 400 when employee_id is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .get('/api/v1/performance-reviews/my')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('employee_id');
    });

    it('should return employee reviews', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'rev-1',
            employee_id: EMPLOYEE_UUID,
            status: 'draft',
            review_period_end: '2025-12-31',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/my?employee_id=${EMPLOYEE_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toHaveProperty('total', 1);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/team
  // =========================================================================
  describe('GET /api/v1/performance-reviews/team', () => {
    it('should return 400 when manager_id is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .get('/api/v1/performance-reviews/team')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return team reviews with summary', async () => {
      const token = createSysadminToken();
      const managerId = REVIEWER_UUID;

      // Team reviews query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'rev-1', employee_name: 'Mario Rossi', status: 'completed' },
          { id: 'rev-2', employee_name: 'Marco Verdi', status: 'draft' },
        ],
        rowCount: 2,
      } as never);
      // Comparison summary query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_reports: '2',
            self_assessments_submitted: '1',
            manager_reviews_submitted: '1',
            avg_team_rating: '3.75',
            avg_self_rating: '4.00',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/team?manager_id=${managerId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reviews).toHaveLength(2);
      expect(res.body.data.summary).toHaveProperty('total_reports', '2');
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/:id
  // =========================================================================
  describe('GET /api/v1/performance-reviews/:id', () => {
    it('should return review details for valid ID', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: VALID_UUID,
            employee_id: EMPLOYEE_UUID,
            reviewer_id: REVIEWER_UUID,
            status: 'draft',
            overall_rating: 4.0,
            employee_name: 'Mario Rossi',
            reviewer_name: 'Lucia Bianchi',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', VALID_UUID);
      expect(res.body.data).toHaveProperty('employee_name', 'Mario Rossi');
    });

    it('should return 404 when review not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /api/v1/performance-reviews
  // =========================================================================
  describe('POST /api/v1/performance-reviews', () => {
    it('should create a review successfully with valid data', async () => {
      const token = createSysadminToken();

      const newReview = {
        id: 'new-review-id',
        employee_id: EMPLOYEE_UUID,
        reviewer_id: REVIEWER_UUID,
        review_type: 'annual',
        status: 'draft',
        created_at: '2025-01-01T00:00:00Z',
      };

      // INSERT query
      mockQuery.mockResolvedValueOnce({ rows: [newReview], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/performance-reviews')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({
          employee_id: EMPLOYEE_UUID,
          reviewer_id: REVIEWER_UUID,
          review_type: 'annual',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('employee_id', EMPLOYEE_UUID);
      expect(res.body.message).toContain('created');
    });

    it('should return 400 when Zod validation fails (missing employee_id)', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/performance-reviews')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ reviewer_id: REVIEWER_UUID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when Zod validation fails (invalid UUID format)', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/performance-reviews')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: 'not-a-uuid', reviewer_id: REVIEWER_UUID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // PATCH /api/v1/performance-reviews/:id
  // =========================================================================
  describe('PATCH /api/v1/performance-reviews/:id', () => {
    it('should update review successfully', async () => {
      const token = createSysadminToken();

      // Existence check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 } as never);
      // UPDATE query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: VALID_UUID,
            overall_rating: 4.5,
            status: 'completed',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ overall_rating: 4.5, status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('overall_rating', 4.5);
      expect(res.body.message).toContain('updated');
    });

    it('should return 404 when review not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ overall_rating: 4.5 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when no valid fields provided', async () => {
      const token = createSysadminToken();

      // Existence check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ nonexistent_field: 'value' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // DELETE /api/v1/performance-reviews/:id
  // =========================================================================
  describe('DELETE /api/v1/performance-reviews/:id', () => {
    it('should delete review successfully', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 when review not found for deletion', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/performance-reviews/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/:id/goals
  // =========================================================================
  describe('GET /api/v1/performance-reviews/:id/goals', () => {
    it('should return goals for a review', async () => {
      const token = createSysadminToken();

      // Review check
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            employee_id: EMPLOYEE_UUID,
            review_period_start: '2025-01-01',
            review_period_end: '2025-12-31',
            goals_auto_populated: true,
          },
        ],
        rowCount: 1,
      } as never);
      // Goal ratings
      mockQuery.mockResolvedValueOnce({
        rows: [
          { goal_id: 'g1', title: 'Q1 Targets', self_rating: 4, goal_status: 'completed' },
          { goal_id: 'g2', title: 'Certification', self_rating: null, goal_status: 'in_progress' },
        ],
        rowCount: 2,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/${VALID_UUID}/goals`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('goal_ratings');
      expect(res.body.data.goal_ratings).toHaveLength(2);
      expect(res.body.data).toHaveProperty('goals_auto_populated', true);
    });

    it('should return 404 when review not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/${VALID_UUID}/goals`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/feedback-360/pending
  // =========================================================================
  describe('GET /api/v1/performance-reviews/feedback-360/pending', () => {
    it('should return 400 when rater_id is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .get('/api/v1/performance-reviews/feedback-360/pending')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return pending feedback requests', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'fb-1', subject_name: 'Mario Rossi', status: 'pending' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/performance-reviews/feedback-360/pending?rater_id=${REVIEWER_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/competency-frameworks
  // =========================================================================
  describe('GET /api/v1/performance-reviews/competency-frameworks', () => {
    it('should return available frameworks', async () => {
      const token = createSysadminToken();

      mockGetCompetencyFrameworks.mockResolvedValueOnce([
        { id: 'fw-1', name: 'Leadership Framework', competency_count: 5 },
      ] as never);

      const res = await supertest(app)
        .get('/api/v1/performance-reviews/competency-frameworks')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // =========================================================================
  // GET /api/v1/performance-reviews/rating-scales
  // =========================================================================
  describe('GET /api/v1/performance-reviews/rating-scales', () => {
    it('should return available rating scales', async () => {
      const token = createSysadminToken();

      mockGetRatingScales.mockResolvedValueOnce([
        { id: 'rs-1', name: '5-Point Scale', min: 1, max: 5 },
      ] as never);

      const res = await supertest(app)
        .get('/api/v1/performance-reviews/rating-scales')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });
});
