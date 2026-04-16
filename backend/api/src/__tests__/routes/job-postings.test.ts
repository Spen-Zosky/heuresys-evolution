/**
 * Job Postings Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for internal job posting CRUD endpoints.
 * All external dependencies (database, redis, sentry) are mocked.
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

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: jobPostingsRoutes } = await import('../../routes/job-postings.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const POSTING_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';

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
  app.use('/api/v1/job-postings', authMiddleware);
  app.use('/api/v1/job-postings', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/job-postings', jobPostingsRoutes);
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
// Sample data
// ---------------------------------------------------------------------------

const samplePosting = {
  id: POSTING_ID,
  tenant_id: TENANT_ID,
  title: 'Senior Software Engineer',
  department: 'IT',
  team: 'Backend',
  location: 'Milano',
  work_type: 'hybrid',
  summary: 'We are looking for a senior engineer',
  responsibilities: 'Design and implement APIs',
  requirements: '5+ years experience',
  nice_to_have: 'Kubernetes knowledge',
  job_level: 'senior',
  job_family: 'Engineering',
  salary_min: 50000,
  salary_max: 80000,
  currency: 'EUR',
  show_salary: false,
  status: 'draft',
  visibility: 'internal',
  min_tenure_months: 6,
  min_rating: 3,
  required_skills: ['TypeScript', 'Node.js'],
  expires_at: '2026-06-30',
  target_start_date: '2026-04-01',
  hiring_manager_id: VALID_UUID,
  hr_contact_id: VALID_UUID,
  views_count: 10,
  applications_count: 3,
  created_by: VALID_UUID,
  posted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  hiring_manager_name: 'Mario Rossi',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Job Postings Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // =========================================================================
  // AUTH
  // =========================================================================

  describe('Authentication', () => {
    it('should return 401 when no auth token is provided', async () => {
      const res = await supertest(app).get('/api/v1/job-postings');
      expect(res.status).toBe(401);
    });

    it('should return 401 with an invalid token', async () => {
      const res = await supertest(app)
        .get('/api/v1/job-postings')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /job-postings/stats
  // =========================================================================

  describe('GET /job-postings/stats', () => {
    it('should return aggregated statistics', async () => {
      const statsRow = {
        total: '15',
        published: '8',
        draft: '4',
        closed: '3',
        total_views: '250',
        total_applications: '42',
      };
      mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe('15');
      expect(res.body.data.published).toBe('8');
      expect(res.body.data.draft).toBe('4');
      expect(res.body.data.closed).toBe('3');
      expect(res.body.data.total_views).toBe('250');
      expect(res.body.data.total_applications).toBe('42');
    });

    it('should return zero stats when no postings exist', async () => {
      const emptyStats = {
        total: '0',
        published: '0',
        draft: '0',
        closed: '0',
        total_views: null,
        total_applications: null,
      };
      mockQuery.mockResolvedValueOnce({ rows: [emptyStats], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe('0');
    });

    it('should return 500 when the database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await supertest(app)
        .get('/api/v1/job-postings/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /job-postings/active
  // =========================================================================

  describe('GET /job-postings/active', () => {
    it('should return only published, non-expired postings', async () => {
      const activePostings = [
        { ...samplePosting, status: 'published', hiring_manager_name: 'Mario Rossi' },
        { ...samplePosting, id: 'other-id', title: 'Junior Dev', status: 'published' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: activePostings, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/job-postings/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].status).toBe('published');
    });

    it('should return empty array when no active postings exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/job-postings/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /job-postings (list with filters)
  // =========================================================================

  describe('GET /job-postings', () => {
    it('should return paginated list of job postings', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 }) // count query
        .mockResolvedValueOnce({ rows: [samplePosting], rowCount: 1 }); // main query

      const res = await supertest(app)
        .get('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Senior Software Engineer');
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.limit).toBe(50);
      expect(res.body.meta.offset).toBe(0);
    });

    it('should filter by status query parameter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...samplePosting, status: 'published' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings?status=published')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by department query parameter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [samplePosting], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings?department=IT')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by location query parameter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [samplePosting], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings?location=Milano')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by job_level query parameter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [samplePosting], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings?job_level=senior')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should support search query with ILIKE', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [samplePosting], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/job-postings?search=engineer')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should respect custom limit and offset', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '50' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/job-postings?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(20);
      expect(res.body.meta.total).toBe(50);
    });

    it('should return empty data array when no postings match', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  // =========================================================================
  // GET /job-postings/:id
  // =========================================================================

  describe('GET /job-postings/:id', () => {
    it('should return a single job posting and increment view count', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [samplePosting], rowCount: 1 }) // SELECT query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE view count

      const res = await supertest(app)
        .get(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(POSTING_ID);
      expect(res.body.data.title).toBe('Senior Software Engineer');
      // Verify view count increment query was called
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should return 404 when job posting is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/job-postings/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 500 when database fails on fetch', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

      const res = await supertest(app)
        .get(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /job-postings
  // =========================================================================

  describe('POST /job-postings', () => {
    const validPayload = {
      title: 'Backend Developer',
      department: 'Engineering',
      location: 'Roma',
      work_type: 'remote',
      summary: 'Looking for a backend developer',
      job_level: 'mid',
    };

    it('should create a new job posting with 201 status', async () => {
      const createdRow = { id: POSTING_ID, ...validPayload, status: 'draft', tenant_id: TENANT_ID };
      mockQuery.mockResolvedValueOnce({ rows: [createdRow], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(POSTING_ID);
      expect(res.body.message).toBe('Job posting created');
    });

    it('should return 400 when title is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send({ department: 'IT' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when title is empty string', async () => {
      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept optional fields with defaults', async () => {
      const created = {
        id: POSTING_ID,
        title: 'Test Role',
        currency: 'EUR',
        show_salary: false,
        visibility: 'internal',
        status: 'draft',
      };
      mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test Role' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 when insert fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Unique constraint violation'));

      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should validate hiring_manager_id as UUID if provided', async () => {
      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test', hiring_manager_id: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should validate hr_contact_id as UUID if provided', async () => {
      const res = await supertest(app)
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test', hr_contact_id: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // PATCH /job-postings/:id
  // =========================================================================

  describe('PATCH /job-postings/:id', () => {
    it('should update an existing job posting', async () => {
      const updated = { ...samplePosting, title: 'Updated Title' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: POSTING_ID }], rowCount: 1 }) // existence check
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // update query

      const res = await supertest(app)
        .patch(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.message).toBe('Job posting updated');
    });

    it('should return 404 when posting to update does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch(`/api/v1/job-postings/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when no recognized fields are sent', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: POSTING_ID }], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unknown_field: 'value' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No fields to update');
    });

    it('should auto-set posted_at when status changes to published', async () => {
      const updated = { ...samplePosting, status: 'published' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: POSTING_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on database error during update', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: POSTING_ID }], rowCount: 1 })
        .mockRejectedValueOnce(new Error('Update failed'));

      const res = await supertest(app)
        .patch(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Fail' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /job-postings/:id/publish
  // =========================================================================

  describe('POST /job-postings/:id/publish', () => {
    it('should publish a job posting', async () => {
      const published = { ...samplePosting, status: 'published' };
      mockQuery.mockResolvedValueOnce({ rows: [published], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/job-postings/${POSTING_ID}/publish`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('published');
      expect(res.body.message).toBe('Job posting published');
    });

    it('should return 404 when posting to publish does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/job-postings/${VALID_UUID}/publish`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /job-postings/:id/close
  // =========================================================================

  describe('POST /job-postings/:id/close', () => {
    it('should close a job posting', async () => {
      const closed = { ...samplePosting, status: 'closed' };
      mockQuery.mockResolvedValueOnce({ rows: [closed], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/job-postings/${POSTING_ID}/close`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('closed');
      expect(res.body.message).toBe('Job posting closed');
    });

    it('should return 404 when posting to close does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/job-postings/${VALID_UUID}/close`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // DELETE /job-postings/:id
  // =========================================================================

  describe('DELETE /job-postings/:id', () => {
    it('should archive (soft-delete) a job posting', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: POSTING_ID }], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Job posting archived');
    });

    it('should return 404 when posting to delete does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete(`/api/v1/job-postings/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 500 on database error during delete', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await supertest(app)
        .delete(`/api/v1/job-postings/${POSTING_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
