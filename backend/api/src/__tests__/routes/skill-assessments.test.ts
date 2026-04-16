/**
 * Skill Assessments Routes - Comprehensive Behavioral Tests
 * Tests actual HTTP request/response behavior for all skill-assessments endpoints.
 * Covers: stats, list, employee assessments, gaps, single assessment, CRUD, skills summary.
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
const { default: skillAssessmentRoutes } = await import('../../routes/skill-assessments.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMP_ID = DEFAULT_IDS.EMPLOYEE_ID;
const ASSESSMENT_ID = '55555555-aaaa-bbbb-cccc-dddddddddddd';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/skill-assessments', authMiddleware);
  app.use('/api/v1/skill-assessments', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/skill-assessments', skillAssessmentRoutes);
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

describe('Skill Assessments Routes', () => {
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
  // STATS
  // ===========================================================================

  describe('GET /skill-assessments/stats', () => {
    it('should return assessment statistics with method and level distribution', async () => {
      const statsRow = {
        total_assessments: '150',
        employees_assessed: '80',
        unique_skills: '45',
        avg_level: '3.20',
        with_gaps: '30',
        avg_gap: '1.50',
      };
      const methodRows = [
        { assessment_method: 'self', count: '60' },
        { assessment_method: 'manager', count: '50' },
      ];
      const levelRows = [
        { assessed_level: 2, count: '30' },
        { assessed_level: 3, count: '50' },
        { assessed_level: 4, count: '40' },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: methodRows, rowCount: 2 })
        .mockResolvedValueOnce({ rows: levelRows, rowCount: 3 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_assessments).toBe('150');
      expect(res.body.data.by_method).toHaveLength(2);
      expect(res.body.data.by_level).toHaveLength(3);
    });
  });

  // ===========================================================================
  // LIST
  // ===========================================================================

  describe('GET /skill-assessments', () => {
    it('should return paginated assessment list', async () => {
      const assessments = [
        {
          id: ASSESSMENT_ID,
          employee_name: 'Mario Rossi',
          skill_name: 'Python',
          assessed_level: 4,
        },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: assessments, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.limit).toBe(50);
      expect(res.body.meta.offset).toBe(0);
    });

    it('should filter by employee_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/skill-assessments?employee_id=${EMP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('esa.employee_id = $'),
        expect.arrayContaining([TENANT_ID, EMP_ID])
      );
    });

    it('should filter by skill_name with ILIKE', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments?skill_name=Python')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('esa.skill_name ILIKE'),
        expect.arrayContaining([TENANT_ID])
      );
    });

    it('should filter by method', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments?method=self')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('assessment_method = $'),
        expect.arrayContaining(['self'])
      );
    });

    it('should filter by has_gap', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments?has_gap=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('esa.gap > 0'),
        expect.any(Array)
      );
    });

    it('should respect pagination params', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(20);
    });
  });

  // ===========================================================================
  // EMPLOYEE ASSESSMENTS
  // ===========================================================================

  describe('GET /skill-assessments/employee/:employeeId', () => {
    it('should return all assessments for an employee with summary', async () => {
      const employee = {
        id: EMP_ID,
        first_name: 'Mario',
        last_name: 'Rossi',
        job_title: 'Developer',
      };
      const assessments = [
        { id: ASSESSMENT_ID, skill_name: 'Python', assessed_level: 4 },
        { id: '2', skill_name: 'JavaScript', assessed_level: 3 },
      ];
      const summary = {
        total_skills: '2',
        avg_level: '3.50',
        skills_with_gaps: '1',
        total_gap: '1',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [employee], rowCount: 1 })
        .mockResolvedValueOnce({ rows: assessments, rowCount: 2 })
        .mockResolvedValueOnce({ rows: [summary], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/skill-assessments/employee/${EMP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.first_name).toBe('Mario');
      expect(res.body.data.assessments).toHaveLength(2);
      expect(res.body.data.summary.total_skills).toBe('2');
    });

    it('should return 404 when employee not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments/employee/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // ===========================================================================
  // GAPS
  // ===========================================================================

  describe('GET /skill-assessments/gaps', () => {
    it('should return assessments with skill gaps and gap distribution', async () => {
      const gapAssessments = [
        { id: '1', employee_name: 'Mario Rossi', skill_name: 'Cybersecurity', gap: 3 },
      ];
      const gapDist = [
        { gap: 1, count: '10' },
        { gap: 2, count: '5' },
        { gap: 3, count: '2' },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: gapAssessments, rowCount: 1 })
        .mockResolvedValueOnce({ rows: gapDist, rowCount: 3 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments/gaps')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.gap_distribution).toHaveLength(3);
    });

    it('should pass min_gap and limit params', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/skill-assessments/gaps?min_gap=2&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // The query should use min_gap=2 and limit=10
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('esa.gap >='),
        expect.arrayContaining([TENANT_ID, 2, 10])
      );
    });
  });

  // ===========================================================================
  // SINGLE ASSESSMENT
  // ===========================================================================

  describe('GET /skill-assessments/:id', () => {
    it('should return assessment detail', async () => {
      const assessment = {
        id: ASSESSMENT_ID,
        employee_name: 'Mario Rossi',
        skill_name: 'Python',
        assessed_level: 4,
        required_level: 5,
        gap: 1,
      };
      mockQuery.mockResolvedValueOnce({ rows: [assessment], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(ASSESSMENT_ID);
      expect(res.body.data.skill_name).toBe('Python');
    });

    it('should return 404 when assessment not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('POST /skill-assessments', () => {
    const validBody = {
      employee_id: EMP_ID,
      skill_name: 'Python',
      assessed_level: 4,
      required_level: 5,
      assessment_method: 'self',
    };

    it('should create assessment and return 201', async () => {
      const created = { id: ASSESSMENT_ID, ...validBody, gap: 1 };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: EMP_ID }], rowCount: 1 }) // emp check
        .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // insert

      const res = await supertest(app)
        .post('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(ASSESSMENT_ID);
      expect(res.body.message).toBe('Assessment created');
    });

    it('should return 404 when employee not found for create', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // emp check fails

      const res = await supertest(app)
        .post('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should reject missing employee_id', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_name: 'Python', assessed_level: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing skill_name', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ employee_id: EMP_ID, assessed_level: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing assessed_level', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ employee_id: EMP_ID, skill_name: 'Python' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid employee_id format', async () => {
      const res = await supertest(app)
        .post('/api/v1/skill-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, employee_id: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  describe('PATCH /skill-assessments/:id', () => {
    it('should update assessment fields', async () => {
      const updated = { id: ASSESSMENT_ID, assessed_level: 5, evidence_notes: 'Improved' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: ASSESSMENT_ID }], rowCount: 1 }) // exists check
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // update

      const res = await supertest(app)
        .patch(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assessed_level: 5, evidence_notes: 'Improved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Assessment updated');
    });

    it('should return 404 when assessment not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assessed_level: 5 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when no updatable fields provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: ASSESSMENT_ID }], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No fields to update');
    });
  });

  // ===========================================================================
  // DELETE
  // ===========================================================================

  describe('DELETE /skill-assessments/:id', () => {
    it('should delete assessment', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: ASSESSMENT_ID }], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Assessment deleted');
    });

    it('should return 404 when assessment not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete(`/api/v1/skill-assessments/${ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // ===========================================================================
  // AUTH
  // ===========================================================================

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/skill-assessments');
      expect(res.status).toBe(401);
    });
  });
});
