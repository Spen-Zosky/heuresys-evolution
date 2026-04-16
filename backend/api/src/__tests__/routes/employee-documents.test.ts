/**
 * Employee Documents Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for employee document management endpoints.
 * All external dependencies (database, redis) are mocked.
 *
 * NOTE: This route uses (req as any).user?.id to get the user ID, which maps to the
 * JWT payload's userId field. The test middleware sets both user.id and user.userId
 * to enable testing the route's business logic.
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
const { default: employeeDocumentsRoutes } = await import('../../routes/employee-documents.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants & Test app factory
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const USER_ID = 'user-uuid-1';
const DOC_UUID = '99999999-aaaa-bbbb-cccc-dddddddddddd';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/employee-documents', authMiddleware);
  app.use('/api/v1/employee-documents', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    // Route accesses (req as any).user?.id - set it explicitly
    if ((req as any).user) {
      (req as any).user.id = (req as any).user.userId;
    }
    next();
  });
  app.use('/api/v1/employee-documents', employeeDocumentsRoutes);
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

function mockGetEmployeeIdSuccess(): void {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
}

function mockGetEmployeeIdNotFound(): void {
  mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Employee Documents Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.resetAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
  });

  // =========================================================================
  // Auth enforcement
  // =========================================================================

  describe('Auth enforcement', () => {
    it('should return 401 for GET / without token', async () => {
      const res = await supertest(app).get('/api/v1/employee-documents/');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST / without token', async () => {
      const res = await supertest(app).post('/api/v1/employee-documents/').send({ title: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /employee-documents
  // =========================================================================

  describe('GET /', () => {
    it('should return 200 with documents and stats', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: DOC_UUID,
            title: 'Contract 2025',
            category: 'employment',
            document_type: 'contract',
          },
        ],
        rowCount: 1,
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ category: 'employment', count: '3' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0].title).toBe('Contract 2025');
      expect(res.body.data.stats).toHaveLength(1);
      expect(res.body.data.meta.limit).toBe(50);
      expect(res.body.data.meta.offset).toBe(0);
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeIdNotFound();

      const res = await supertest(app)
        .get('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should filter by category and document_type', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/?category=payroll&document_type=pay_stub&status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const secondCall = mockQuery.mock.calls[1];
      expect(secondCall![1]).toContain('active');
      expect(secondCall![1]).toContain('payroll');
      expect(secondCall![1]).toContain('pay_stub');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('DB error');
    });
  });

  // =========================================================================
  // GET /employee-documents/categories
  // =========================================================================

  describe('GET /categories', () => {
    it('should return 200 with 5 predefined categories enriched with DB counts', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [
          { category: 'employment', count: '5', latest_upload: '2025-02-01T00:00:00Z' },
          { category: 'payroll', count: '12', latest_upload: '2025-02-15T00:00:00Z' },
        ],
        rowCount: 2,
      });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      const employment = res.body.data.find((c: any) => c.id === 'employment');
      expect(employment.count).toBe(5);
      expect(employment.latest_upload).toBe('2025-02-01T00:00:00Z');
      const personal = res.body.data.find((c: any) => c.id === 'personal');
      expect(personal.count).toBe(0);
      expect(personal.latest_upload).toBeNull();
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeIdNotFound();

      const res = await supertest(app)
        .get('/api/v1/employee-documents/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/employee-documents/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  // =========================================================================
  // GET /employee-documents/:id
  // =========================================================================

  describe('GET /:id', () => {
    it('should return 200 with document details and version history', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: DOC_UUID,
            title: 'Employment Contract',
            document_type: 'contract',
            parent_document_id: null,
            uploaded_by_name: 'Mario Rossi',
            verified_by_name: null,
          },
        ],
        rowCount: 1,
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: DOC_UUID,
            version: 2,
            filename: 'contract_v2.pdf',
            file_size: 1024,
            created_at: '2025-02-01',
          },
          {
            id: 'v1-id',
            version: 1,
            filename: 'contract_v1.pdf',
            file_size: 950,
            created_at: '2025-01-01',
          },
        ],
        rowCount: 2,
      });

      const res = await supertest(app)
        .get(`/api/v1/employee-documents/${DOC_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Employment Contract');
      expect(res.body.data.versions).toHaveLength(2);
      expect(res.body.data.versions[0].version).toBe(2);
    });

    it('should return 404 when document not found', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/employee-documents/${DOC_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeIdNotFound();

      const res = await supertest(app)
        .get(`/api/v1/employee-documents/${DOC_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // GET /employee-documents/expiring/list
  // =========================================================================

  describe('GET /expiring/list', () => {
    it('should return 200 with expiring documents', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'doc1', title: 'Safety Cert', expiry_date: '2025-03-01', days_until_expiry: 10 },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/expiring/list')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].days_until_expiry).toBe(10);
    });

    it('should accept custom days parameter', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/expiring/list?days=60')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const queryCall = mockQuery.mock.calls[1];
      expect(queryCall![1]).toContain(60);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/employee-documents/expiring/list')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /employee-documents
  // =========================================================================

  describe('POST /', () => {
    const validDocument = {
      title: 'Employment Contract 2025',
      document_type: 'contract',
      category: 'employment',
      filename: 'contract_2025.pdf',
      original_name: 'Employment Contract.pdf',
      mime_type: 'application/pdf',
      file_size: 2048,
      file_path: 'documents/contract_2025.pdf',
    };

    it('should return 201 when creating document', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: DOC_UUID, ...validDocument }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .post('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`)
        .send(validDocument);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(DOC_UUID);
      expect(res.body.data.title).toBe('Employment Contract 2025');
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeIdNotFound();

      const res = await supertest(app)
        .post('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`)
        .send(validDocument);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when required fields are missing', async () => {
      // NOTE: No mockGetEmployeeIdSuccess() here — Zod validation rejects
      // BEFORE the handler runs, so getEmployeeId is never called.

      const res = await supertest(app)
        .post('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 on database insert error', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await supertest(app)
        .post('/api/v1/employee-documents/')
        .set('Authorization', `Bearer ${token}`)
        .send(validDocument);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Insert failed');
    });
  });

  // =========================================================================
  // DELETE /employee-documents/:id
  // =========================================================================

  describe('DELETE /:id', () => {
    it('should return 200 when archiving document', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/employee-documents/${DOC_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeIdNotFound();

      const res = await supertest(app)
        .delete(`/api/v1/employee-documents/${DOC_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await supertest(app)
        .delete(`/api/v1/employee-documents/${DOC_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Delete failed');
    });
  });

  // =========================================================================
  // GET /employee-documents/requests/list
  // =========================================================================

  describe('GET /requests/list', () => {
    it('should return 200 with document requests', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'req1',
            document_type: 'employment_certificate',
            status: 'pending',
            assigned_to_name: 'HR Manager',
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/requests/list')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].document_type).toBe('employment_certificate');
    });

    it('should filter by status query param', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/employee-documents/requests/list?status=pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const queryCall = mockQuery.mock.calls[1];
      expect(queryCall![1]).toContain('pending');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/employee-documents/requests/list')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /employee-documents/requests
  // =========================================================================

  describe('POST /requests', () => {
    it('should return 201 when creating document request', async () => {
      mockGetEmployeeIdSuccess();
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-new', document_type: 'employment_certificate', status: 'pending' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .post('/api/v1/employee-documents/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ document_type: 'employment_certificate', purpose: 'Bank loan' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document_type).toBe('employment_certificate');
    });

    it('should return 400 when document_type is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/employee-documents/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ purpose: 'Bank loan' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeIdNotFound();

      const res = await supertest(app)
        .post('/api/v1/employee-documents/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ document_type: 'employment_certificate' });

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /employee-documents/request-types/list
  // =========================================================================

  describe('GET /request-types/list', () => {
    it('should return 200 with static list of 6 request types', async () => {
      const res = await supertest(app)
        .get('/api/v1/employee-documents/request-types/list')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(6);
      expect(res.body.data[0].id).toBe('employment_certificate');
      expect(res.body.data[0].processing_days).toBe(3);
      expect(res.body.data[5].id).toBe('service_letter');
    });
  });
});
