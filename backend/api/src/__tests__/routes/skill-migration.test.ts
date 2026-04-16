/**
 * skill-migration Routes - Comprehensive Behavioral Tests
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

// Mock the LegacySkillMigrationService
const mockGetMigrationSummary = jest.fn();
const mockCreateMigrationJob = jest.fn();
const mockListJobs = jest.fn();
const mockGetJobStatus = jest.fn();
const mockExecuteMigrationJob = jest.fn();
const mockCountUnmappedRecords = jest.fn();
const mockApproveUnknownSkillMapping = jest.fn();
const mockRejectUnknownSkillMapping = jest.fn();

jest.unstable_mockModule(resolve('../../services/legacy-skill-migration.js'), () => ({
  LegacySkillMigrationService: jest.fn().mockImplementation(() => ({
    getMigrationSummary: mockGetMigrationSummary,
    createMigrationJob: mockCreateMigrationJob,
    listJobs: mockListJobs,
    getJobStatus: mockGetJobStatus,
    executeMigrationJob: mockExecuteMigrationJob,
    countUnmappedRecords: mockCountUnmappedRecords,
    approveUnknownSkillMapping: mockApproveUnknownSkillMapping,
    rejectUnknownSkillMapping: mockRejectUnknownSkillMapping,
  })),
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/skill-migration.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const JOB_ID = '55555555-6666-7777-a888-999999999999';
const SKILL_ID = '66666666-7777-8888-a999-aaaaaaaaaaaa';
const USER_UUID = DEFAULT_IDS.USER_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/skill-migration', authMiddleware);
  app.use('/api/v1/skill-migration', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/skill-migration', routes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || err.httpStatus || 500;
    res
      .status(status)
      .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
  });
  return app;
}

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('skill-migration Routes', () => {
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
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/skill-migration/summary');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await supertest(app)
        .get('/api/v1/skill-migration/summary')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /summary
  // =========================================================================
  describe('GET /summary', () => {
    it('should return 400 when tenant_id is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/skill-migration/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/tenant_id/i);
    });

    it('should return migration summary for valid tenant_id', async () => {
      const summaryData = {
        total_skills: 100,
        mapped_skills: 75,
        unmapped_skills: 25,
        mapping_percentage: 75.0,
      };
      mockGetMigrationSummary.mockResolvedValueOnce(summaryData);

      const res = await supertest(app)
        .get('/api/v1/skill-migration/summary')
        .query({ tenant_id: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(summaryData);
      expect(mockGetMigrationSummary).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should return 500 when service throws', async () => {
      mockGetMigrationSummary.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/skill-migration/summary')
        .query({ tenant_id: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /stats/:tenantId
  // =========================================================================
  describe('GET /stats/:tenantId', () => {
    it('should return stats from database function', async () => {
      const statsData = { total: 200, mapped: 150, unmapped: 50 };
      mockQuery.mockResolvedValueOnce({ rows: [statsData], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/stats/${TENANT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(statsData);
    });

    it('should return null data when no stats found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/stats/${TENANT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('should return 500 when query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('function not found'));

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/stats/${TENANT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /jobs
  // =========================================================================
  describe('POST /jobs', () => {
    it('should return 400 when Zod validation fails (missing tenant_id)', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-migration/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ job_type: 'employee_skills' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when Zod validation fails (invalid job_type)', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-migration/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenant_id: TENANT_ID, job_type: 'invalid_type' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should create a migration job with valid data', async () => {
      const jobData = {
        id: JOB_ID,
        tenant_id: TENANT_ID,
        job_type: 'employee_skills',
        status: 'pending',
        total_records: 50,
      };
      mockCreateMigrationJob.mockResolvedValueOnce(jobData);

      const res = await supertest(app)
        .post('/api/v1/skill-migration/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenant_id: TENANT_ID, job_type: 'employee_skills' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(jobData);
    });

    it('should return 500 when service throws', async () => {
      mockCreateMigrationJob.mockRejectedValueOnce(new Error('DB failure'));

      const res = await supertest(app)
        .post('/api/v1/skill-migration/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenant_id: TENANT_ID, job_type: 'employee_skills' });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /jobs
  // =========================================================================
  describe('GET /jobs', () => {
    it('should return 400 when tenant_id is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/skill-migration/jobs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/tenant_id/i);
    });

    it('should return paginated job list', async () => {
      const jobs = [
        { id: JOB_ID, tenant_id: TENANT_ID, job_type: 'employee_skills', status: 'completed' },
      ];
      mockListJobs.mockResolvedValueOnce({ jobs, total: 1 });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/jobs')
        .query({ tenant_id: TENANT_ID, limit: '10', offset: '0' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(jobs);
      expect(res.body.meta).toEqual({ limit: 10, offset: 0, total: 1, hasMore: false });
    });

    it('should cap limit at 100', async () => {
      mockListJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/jobs')
        .query({ tenant_id: TENANT_ID, limit: '500' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(100);
    });

    it('should default limit to 20 and offset to 0', async () => {
      mockListJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/jobs')
        .query({ tenant_id: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(20);
      expect(res.body.meta.offset).toBe(0);
    });
  });

  // =========================================================================
  // GET /jobs/:jobId
  // =========================================================================
  describe('GET /jobs/:jobId', () => {
    it('should return 404 when job not found', async () => {
      mockGetJobStatus.mockResolvedValueOnce(null);

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return job details when found', async () => {
      const job = { id: JOB_ID, status: 'completed', total_records: 100, processed_records: 100 };
      mockGetJobStatus.mockResolvedValueOnce(job);

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(job);
    });

    it('should return 500 when service throws', async () => {
      mockGetJobStatus.mockRejectedValueOnce(new Error('query error'));

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /jobs/:jobId/start
  // =========================================================================
  describe('POST /jobs/:jobId/start', () => {
    it('should return 404 when job not found', async () => {
      mockGetJobStatus.mockResolvedValueOnce(null);

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/jobs/${JOB_ID}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when job is not pending', async () => {
      mockGetJobStatus.mockResolvedValueOnce({ id: JOB_ID, status: 'completed' });

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/jobs/${JOB_ID}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already completed/i);
    });

    it('should start migration job successfully', async () => {
      mockGetJobStatus.mockResolvedValueOnce({ id: JOB_ID, status: 'pending' });
      const stats = { total: 50, processed: 50, matched: 45, failed: 5 };
      mockExecuteMigrationJob.mockResolvedValueOnce(stats);

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/jobs/${JOB_ID}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidence_threshold: 0.8, batch_size: 25 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job_id).toBe(JOB_ID);
      expect(res.body.data.stats).toEqual(stats);
    });

    it('should use default options when none provided', async () => {
      mockGetJobStatus.mockResolvedValueOnce({ id: JOB_ID, status: 'pending' });
      mockExecuteMigrationJob.mockResolvedValueOnce({ total: 10 });

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/jobs/${JOB_ID}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);
      expect(mockExecuteMigrationJob).toHaveBeenCalledWith(JOB_ID, {
        confidenceThreshold: 0.75,
        batchSize: 50,
        createCustomSkills: true,
      });
    });

    it('should return 500 when execution fails', async () => {
      mockGetJobStatus.mockResolvedValueOnce({ id: JOB_ID, status: 'pending' });
      mockExecuteMigrationJob.mockRejectedValueOnce(new Error('Processing error'));

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/jobs/${JOB_ID}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /unmapped
  // =========================================================================
  describe('GET /unmapped', () => {
    it('should return 400 when tenant_id is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/skill-migration/unmapped')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/tenant_id/i);
    });

    it('should return unmapped counts', async () => {
      const counts = { employee_skills: 10, extracted_skills: 5 };
      mockCountUnmappedRecords.mockResolvedValueOnce(counts);

      const res = await supertest(app)
        .get('/api/v1/skill-migration/unmapped')
        .query({ tenant_id: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.counts).toEqual(counts);
      expect(res.body.data.total).toBe(15);
    });

    it('should pass job_type filter to service', async () => {
      mockCountUnmappedRecords.mockResolvedValueOnce({ employee_skills: 3 });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/unmapped')
        .query({ tenant_id: TENANT_ID, job_type: 'employee_skills' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockCountUnmappedRecords).toHaveBeenCalledWith(TENANT_ID, 'employee_skills');
    });
  });

  // =========================================================================
  // GET /unknown-skills
  // =========================================================================
  describe('GET /unknown-skills', () => {
    it('should return paginated unknown skills', async () => {
      // First call: count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 });
      // Second call: data query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: SKILL_ID,
            raw_text: 'Python Programming',
            occurrence_count: 5,
            review_status: 'pending',
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/unknown-skills')
        .query({ tenant_id: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].raw_text).toBe('Python Programming');
      expect(res.body.meta.total).toBe(3);
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: SKILL_ID, review_status: 'approved' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/unknown-skills')
        .query({ tenant_id: TENANT_ID, status: 'approved' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return empty list with correct pagination when no data', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/skill-migration/unknown-skills')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return 500 on query failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('table not found'));

      const res = await supertest(app)
        .get('/api/v1/skill-migration/unknown-skills')
        .query({ tenant_id: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /unknown-skills/:skillId/approve
  // =========================================================================
  describe('POST /unknown-skills/:skillId/approve', () => {
    it('should return 400 when Zod validation fails (missing user_id)', async () => {
      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when user_id is not a valid UUID', async () => {
      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: 'not-a-uuid' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should approve an unknown skill mapping', async () => {
      mockApproveUnknownSkillMapping.mockResolvedValueOnce(undefined);

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: USER_UUID, use_suggested: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/approved/i);
      expect(mockApproveUnknownSkillMapping).toHaveBeenCalledWith(
        SKILL_ID,
        USER_UUID,
        true,
        undefined
      );
    });

    it('should approve with custom esco_skill_id', async () => {
      const escoId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
      mockApproveUnknownSkillMapping.mockResolvedValueOnce(undefined);

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: USER_UUID, esco_skill_id: escoId, use_suggested: false });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockApproveUnknownSkillMapping).toHaveBeenCalledWith(
        SKILL_ID,
        USER_UUID,
        false,
        escoId
      );
    });

    it('should return 500 when service throws', async () => {
      mockApproveUnknownSkillMapping.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: USER_UUID });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /unknown-skills/:skillId/reject
  // =========================================================================
  describe('POST /unknown-skills/:skillId/reject', () => {
    it('should return 400 when user_id is missing', async () => {
      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject an unknown skill mapping', async () => {
      mockRejectUnknownSkillMapping.mockResolvedValueOnce(undefined);

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: USER_UUID });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/rejected/i);
      expect(mockRejectUnknownSkillMapping).toHaveBeenCalledWith(SKILL_ID, USER_UUID);
    });

    it('should return 500 when service throws', async () => {
      mockRejectUnknownSkillMapping.mockRejectedValueOnce(new Error('fail'));

      const res = await supertest(app)
        .post(`/api/v1/skill-migration/unknown-skills/${SKILL_ID}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: USER_UUID });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /jobs/:jobId/log
  // =========================================================================
  describe('GET /jobs/:jobId/log', () => {
    it('should return paginated migration log', async () => {
      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 });
      // Data query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: '1', job_id: JOB_ID, action: 'match', matched_esco_id: SKILL_ID },
          { id: '2', job_id: JOB_ID, action: 'skip', matched_esco_id: null },
        ],
        rowCount: 2,
      });

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}/log`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter log by action', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '1', action: 'match' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}/log`)
        .query({ action: 'match' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should cap limit at 200 for log', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}/log`)
        .query({ limit: '500' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(200);
    });

    it('should return 500 on query failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('table not found'));

      const res = await supertest(app)
        .get(`/api/v1/skill-migration/jobs/${JOB_ID}/log`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /match
  // =========================================================================
  describe('POST /match', () => {
    it('should return 400 when skill_text is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-migration/match')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return matched ESCO skills', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: SKILL_ID,
            preferred_label_en: 'Python',
            skill_type: 'skill',
            reuse_level: 'sector-specific',
            text_similarity: '0.95',
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .post('/api/v1/skill-migration/match')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_text: 'Python programming' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.query).toBe('Python programming');
      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].preferred_label).toBe('Python');
      expect(res.body.data.matches[0].confidence).toBe(0.95);
    });

    it('should return empty matches when no similar skills found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/skill-migration/match')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_text: 'xyznonexistent' });
      expect(res.status).toBe(200);
      expect(res.body.data.matches).toEqual([]);
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/skill-migration/match')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_text: 'Java', limit: 3 });
      expect(res.status).toBe(200);
      // Verify the query was called with limit 3
      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs?.[1]).toContain(3);
    });

    it('should return 500 on query failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('pg_trgm not available'));

      const res = await supertest(app)
        .post('/api/v1/skill-migration/match')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_text: 'test skill' });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
