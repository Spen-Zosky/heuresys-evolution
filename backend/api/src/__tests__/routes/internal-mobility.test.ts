/**
 * Internal Mobility Routes - Behavioral Tests
 * Tests HTTP request/response behavior for internal job postings and applications.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest
  .fn()
  .mockResolvedValue({ query: mockClientQuery, release: mockClientRelease } as never);

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
const { default: routeHandler } = await import('../../routes/internal-mobility.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMP_ID = DEFAULT_IDS.EMPLOYEE_ID;
const JOB_ID = DEFAULT_IDS.GOAL_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/internal-mobility', authMiddleware);
  app.use('/api/v1/internal-mobility', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/internal-mobility', routeHandler);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || err.httpStatus || 500;
    res
      .status(status)
      .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
  });
  return app;
}

function sysadminToken() {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('Internal Mobility Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = sysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ===========================================================================
  // GET /jobs
  // ===========================================================================

  describe('GET /jobs', () => {
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/internal-mobility/jobs');
      expect(res.status).toBe(401);
    });

    it('should return 200 with job postings and meta', async () => {
      const jobs = [{ id: JOB_ID, title: 'Senior Developer', department: 'IT', status: 'open' }];
      mockQuery
        .mockResolvedValueOnce({ rows: jobs, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/jobs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Senior Developer');
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.limit).toBe(50);
      expect(res.body.meta.offset).toBe(0);
    });

    it('should apply filter params (status, department, work_type, job_level)', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const res = await supertest(app)
        .get(
          '/api/v1/internal-mobility/jobs?status=open&department=IT&work_type=remote&job_level=senior&limit=10&offset=5'
        )
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(5);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB fail'));

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/jobs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /jobs/:id
  // ===========================================================================

  describe('GET /jobs/:id', () => {
    it('should return 200 with job details and increment views', async () => {
      const job = { id: JOB_ID, title: 'Developer', department: 'IT' };
      mockQuery
        .mockResolvedValueOnce({ rows: [job], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/internal-mobility/jobs/${JOB_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Developer');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should return 404 when job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/jobs/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // ===========================================================================
  // POST /jobs
  // ===========================================================================

  describe('POST /jobs', () => {
    it('should return 201 when creating a job posting', async () => {
      const created = {
        id: JOB_ID,
        title: 'Data Analyst',
        department: 'Analytics',
        status: 'draft',
      };
      mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/internal-mobility/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Data Analyst', department: 'Analytics', work_type: 'hybrid' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Data Analyst');
    });

    it('should return 400 when title is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal-mobility/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ department: 'IT' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when department is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal-mobility/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Developer' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB fail'));

      const res = await supertest(app)
        .post('/api/v1/internal-mobility/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Dev', department: 'IT' });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // PATCH /jobs/:id
  // ===========================================================================

  describe('PATCH /jobs/:id', () => {
    it('should return 200 when updating a job posting', async () => {
      const updated = { id: JOB_ID, title: 'Updated Title', status: 'open' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: JOB_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/internal-mobility/jobs/${JOB_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title', status: 'open' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Job posting updated');
    });

    it('should return 404 when job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch('/api/v1/internal-mobility/jobs/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 for invalid status enum', async () => {
      const res = await supertest(app)
        .patch(`/api/v1/internal-mobility/jobs/${JOB_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid_status' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /applications
  // ===========================================================================

  describe('GET /applications', () => {
    it('should return 200 with applications list', async () => {
      const apps = [{ id: 'app1', employee_id: EMP_ID, status: 'submitted', job_title: 'Dev' }];
      mockQuery.mockResolvedValueOnce({ rows: apps, rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/applications')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.count).toBe(1);
    });

    it('should filter by job_posting_id, employee_id, status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(
          `/api/v1/internal-mobility/applications?job_posting_id=${JOB_ID}&employee_id=${EMP_ID}&status=submitted`
        )
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // GET /applications/:id
  // ===========================================================================

  describe('GET /applications/:id', () => {
    it('should return 200 with application details', async () => {
      const appData = {
        id: 'app1',
        employee_id: EMP_ID,
        applicant_name: 'Mario Rossi',
        status: 'submitted',
      };
      mockQuery.mockResolvedValueOnce({ rows: [appData], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/applications/app1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applicant_name).toBe('Mario Rossi');
    });

    it('should return 404 when application not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/applications/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // ===========================================================================
  // POST /applications
  // ===========================================================================

  describe('POST /applications', () => {
    it('should return 201 when submitting an application', async () => {
      const appResult = {
        id: 'app1',
        job_posting_id: JOB_ID,
        employee_id: EMP_ID,
        status: 'submitted',
      };
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: JOB_ID, required_skills: ['s1', 's2'] }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ skill_id: 's1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [appResult], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/internal-mobility/applications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          job_posting_id: JOB_ID,
          employee_id: EMP_ID,
          cover_letter: 'Interested',
          motivation: 'Growth',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when job posting is not open', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/internal-mobility/applications')
        .set('Authorization', `Bearer ${token}`)
        .send({ job_posting_id: JOB_ID, employee_id: EMP_ID });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 409 when already applied', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: JOB_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/internal-mobility/applications')
        .set('Authorization', `Bearer ${token}`)
        .send({ job_posting_id: JOB_ID, employee_id: EMP_ID });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Already applied to this position');
    });

    it('should return 400 when job_posting_id is not a valid UUID (Zod)', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal-mobility/applications')
        .set('Authorization', `Bearer ${token}`)
        .send({ job_posting_id: 'not-uuid', employee_id: EMP_ID });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // PATCH /applications/:id/status
  // ===========================================================================

  describe('PATCH /applications/:id/status', () => {
    it('should return 200 when updating application status', async () => {
      const updated = { id: 'app1', status: 'reviewing' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'app1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const res = await supertest(app)
        .patch('/api/v1/internal-mobility/applications/app1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'reviewing', hr_notes: 'Good candidate' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Application updated');
    });

    it('should return 404 when application not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch('/api/v1/internal-mobility/applications/nonexistent/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'reviewing' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 for invalid status enum', async () => {
      const res = await supertest(app)
        .patch('/api/v1/internal-mobility/applications/app1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid_status' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /my-applications
  // ===========================================================================

  describe('GET /my-applications', () => {
    it('should return 200 with user applications', async () => {
      const apps = [{ id: 'app1', job_title: 'Developer', status: 'submitted' }];
      mockQuery.mockResolvedValueOnce({ rows: apps, rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/internal-mobility/my-applications?employee_id=${EMP_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.count).toBe(1);
    });

    it('should return 400 when employee_id is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/internal-mobility/my-applications')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('employee_id is required');
    });
  });

  // ===========================================================================
  // GET /stats
  // ===========================================================================

  describe('GET /stats', () => {
    it('should return 200 with statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              total_postings: '10',
              open_positions: '5',
              filled_positions: '3',
              total_applications: '25',
              avg_applications_per_job: '2.5',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ total_applications: '25', accepted: '5', rejected: '3', in_progress: '17' }],
        })
        .mockResolvedValueOnce({
          rows: [{ department: 'IT', positions: '4', applications: '12' }],
        });

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobs.total_postings).toBe('10');
      expect(res.body.data.applications.accepted).toBe('5');
      expect(res.body.data.by_org_unit).toHaveLength(1);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB fail'));

      const res = await supertest(app)
        .get('/api/v1/internal-mobility/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
