/**
 * Reports Routes - Unit Tests
 * Tests report builder engine including CRUD, execution, preview, and system reports.
 *
 * Endpoints tested:
 *  GET    /reports/stats                    - Report statistics
 *  GET    /reports/data-sources             - Available data sources
 *  GET    /reports/data-sources/:src/fields - Fields for a data source
 *  GET    /reports/categories               - Report categories
 *  GET    /reports                          - List reports
 *  GET    /reports/:id                      - Get report
 *  POST   /reports                          - Create report
 *  PATCH  /reports/:id                      - Update report
 *  DELETE /reports/:id                      - Delete report
 *  POST   /reports/:id/clone               - Clone report
 *  POST   /reports/:id/execute             - Execute report
 *  POST   /reports/preview                  - Preview report
 *  GET    /reports/:id/executions           - Execution history
 *  POST   /reports/system/seed             - Seed system reports
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

// Mock report builder service
const mockListReports = jest.fn();
const mockGetReport = jest.fn();
const mockCreateReport = jest.fn();
const mockUpdateReport = jest.fn();
const mockDeleteReport = jest.fn();
const mockCloneReport = jest.fn();
const mockExecuteReport = jest.fn();
const mockPreviewReport = jest.fn();
const mockGetExecutionHistory = jest.fn();
const mockGetAvailableDataSources = jest.fn();
const mockGetDataSourceFields = jest.fn();

jest.unstable_mockModule(resolve('../../services/report-builder.js'), () => ({
  reportBuilderService: {
    listReports: mockListReports,
    getReport: mockGetReport,
    createReport: mockCreateReport,
    updateReport: mockUpdateReport,
    deleteReport: mockDeleteReport,
    cloneReport: mockCloneReport,
    executeReport: mockExecuteReport,
    previewReport: mockPreviewReport,
    getExecutionHistory: mockGetExecutionHistory,
    getAvailableDataSources: mockGetAvailableDataSources,
    getDataSourceFields: mockGetDataSourceFields,
  },
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/reports.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const REPORT_ID = '88888888-9999-4aaa-bbbb-cccccccccccc';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/reports', authMiddleware);
  app.use('/api/v1/reports', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockClientQuery } as never;
    next();
  });
  app.use('/api/v1/reports', routes);
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

describe('Reports Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/reports');
    expect(res.status).toBe(401);
  });

  // ==================== GET /stats ====================

  describe('GET /stats', () => {
    it('should return 200 with report stats', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ total: '20', template_reports: '5', public_reports: '15', data_sources: '4' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ total_executions: '150', last_7d: '30', last_30d: '80', avg_execution_ms: '250' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/reports/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe('20');
      expect(res.body.data.executions.total_executions).toBe('150');
    });
  });

  // ==================== GET /data-sources ====================

  describe('GET /data-sources', () => {
    it('should return 200 with data sources', async () => {
      mockGetAvailableDataSources.mockReturnValueOnce([
        { name: 'employees', label: 'Employees', table: 'employees' },
      ]);
      const res = await supertest(app)
        .get('/api/v1/reports/data-sources')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ==================== GET /categories ====================

  describe('GET /categories', () => {
    it('should return 200 with categories', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          { category: 'hr', count: '10' },
          { category: 'performance', count: '5' },
        ],
        rowCount: 2,
      });
      const res = await supertest(app)
        .get('/api/v1/reports/categories')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  // ==================== GET / ====================

  describe('GET / (list)', () => {
    it('should return 200 with paginated reports', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: REPORT_ID, name: 'Headcount by Dept' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/reports')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  // ==================== GET /:id ====================

  describe('GET /:id', () => {
    it('should return 404 when not found', async () => {
      mockGetReport.mockResolvedValueOnce(null);
      const res = await supertest(app)
        .get(`/api/v1/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 with report', async () => {
      mockGetReport.mockResolvedValueOnce({ id: REPORT_ID, name: 'Headcount Report' });
      const res = await supertest(app)
        .get(`/api/v1/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Headcount Report');
    });
  });

  // ==================== POST / ====================

  describe('POST /', () => {
    it('should return 400 when required fields missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test' });
      expect(res.status).toBe(400);
    });

    it('should return 201 on successful creation', async () => {
      mockCreateReport.mockResolvedValueOnce({ id: REPORT_ID, name: 'New Report' });
      const res = await supertest(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Report',
          data_source: 'employees',
          fields: [{ name: 'id', source_field: 't0.id' }],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Report');
    });
  });

  // ==================== PATCH /:id ====================

  describe('PATCH /:id', () => {
    it('should return 404 when not found', async () => {
      mockUpdateReport.mockResolvedValueOnce(null);
      const res = await supertest(app)
        .patch(`/api/v1/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should return 200 on successful update', async () => {
      mockUpdateReport.mockResolvedValueOnce({ id: REPORT_ID, name: 'Updated' });
      const res = await supertest(app)
        .patch(`/api/v1/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /:id', () => {
    it('should return 404 when not found', async () => {
      mockDeleteReport.mockResolvedValueOnce(false);
      const res = await supertest(app)
        .delete(`/api/v1/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 on successful delete', async () => {
      mockDeleteReport.mockResolvedValueOnce(true);
      const res = await supertest(app)
        .delete(`/api/v1/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // ==================== POST /:id/clone ====================

  describe('POST /:id/clone', () => {
    it('should return 400 when name missing', async () => {
      const res = await supertest(app)
        .post(`/api/v1/reports/${REPORT_ID}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 201 on successful clone', async () => {
      mockCloneReport.mockResolvedValueOnce({ id: 'cloned-id', name: 'Copy of Report' });
      const res = await supertest(app)
        .post(`/api/v1/reports/${REPORT_ID}/clone`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Copy of Report' });
      expect(res.status).toBe(201);
    });
  });

  // ==================== POST /:id/execute ====================

  describe('POST /:id/execute', () => {
    it('should return 200 with execution results', async () => {
      mockGetReport.mockResolvedValueOnce({ id: REPORT_ID, name: 'Headcount Report' });
      mockExecuteReport.mockResolvedValueOnce({
        data: [{ department: 'IT', count: 50 }],
        totals: null,
        metadata: { total: 1, page: 1, page_size: 100 },
      });
      const res = await supertest(app)
        .post(`/api/v1/reports/${REPORT_ID}/execute`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ==================== POST /preview ====================

  describe('POST /preview', () => {
    it('should return 400 when data_source missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/reports/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ fields: ['id'] });
      expect(res.status).toBe(400);
    });

    it('should return 200 with preview data', async () => {
      mockPreviewReport.mockResolvedValueOnce([{ id: '1', name: 'Mario' }]);
      const res = await supertest(app)
        .post('/api/v1/reports/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ data_source: 'employees', fields: [{ name: 'id' }] });
      expect(res.status).toBe(200);
      expect(res.body.meta.preview).toBe(true);
    });
  });

  // ==================== POST /system/seed ====================

  describe('POST /system/seed', () => {
    it('should return 200 if already seeded', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
      const res = await supertest(app)
        .post('/api/v1/reports/system/seed')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/already seeded/i);
    });

    it('should return 201 on successful seed', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      mockCreateReport.mockResolvedValue({ id: 'new-report' });
      const res = await supertest(app)
        .post('/api/v1/reports/system/seed')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);
      expect(res.body.count).toBeGreaterThan(0);
    });
  });
});
