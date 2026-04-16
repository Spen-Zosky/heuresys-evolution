/**
 * payroll Routes - Unit Tests
 * Comprehensive behavioral tests for payroll integration endpoints.
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

const mockListIntegrations = jest.fn();
const mockCreateIntegration = jest.fn();
const mockGetIntegration = jest.fn();
const mockUpdateIntegration = jest.fn();
const mockTestConnection = jest.fn();
const mockListExportJobs = jest.fn();
const mockCreateExportJob = jest.fn();
const mockGetExportJob = jest.fn();
const mockGenerateExport = jest.fn();
const mockValidateExport = jest.fn();
const mockGetValidationRules = jest.fn();
const mockGetFieldMappings = jest.fn();
const mockTransmitExport = jest.fn();
const mockRecordAcknowledgment = jest.fn();
const mockCompleteExport = jest.fn();
const mockGetExportHistory = jest.fn();
const mockGetExportFiles = jest.fn();
const mockGetTransmissionLog = jest.fn();
const mockCompareWithPreviousPeriod = jest.fn();
const mockGetAnnualSummary = jest.fn();
const mockGetStatistics = jest.fn();

jest.unstable_mockModule(resolve('../../services/payroll-integration.js'), () => ({
  PayrollIntegrationService: jest.fn().mockImplementation(() => ({
    listIntegrations: mockListIntegrations,
    createIntegration: mockCreateIntegration,
    getIntegration: mockGetIntegration,
    updateIntegration: mockUpdateIntegration,
    testConnection: mockTestConnection,
    listExportJobs: mockListExportJobs,
    createExportJob: mockCreateExportJob,
    getExportJob: mockGetExportJob,
    generateExport: mockGenerateExport,
    validateExport: mockValidateExport,
    getValidationRules: mockGetValidationRules,
    getFieldMappings: mockGetFieldMappings,
    transmitExport: mockTransmitExport,
    recordAcknowledgment: mockRecordAcknowledgment,
    completeExport: mockCompleteExport,
    getExportHistory: mockGetExportHistory,
    getExportFiles: mockGetExportFiles,
    getTransmissionLog: mockGetTransmissionLog,
    compareWithPreviousPeriod: mockCompareWithPreviousPeriod,
    getAnnualSummary: mockGetAnnualSummary,
    getStatistics: mockGetStatistics,
  })),
}));

const { default: express } = await import('express');
const { default: routeHandler } = await import('../../routes/payroll.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/payroll', authMiddleware);
  app.use('/api/v1/payroll', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/payroll', routeHandler);
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

describe('payroll Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('GET /providers (public)', () => {
    it('should return supported providers', async () => {
      const res = await supertest(app)
        .get('/api/v1/payroll/providers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providers).toBeInstanceOf(Array);
      expect(res.body.data.providers.length).toBeGreaterThan(0);
      expect(res.body.data.providers[0].code).toBe('zucchetti');
    });
  });

  describe('GET /export-sections (public)', () => {
    it('should return available export sections', async () => {
      const res = await supertest(app)
        .get('/api/v1/payroll/export-sections')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sections).toBeInstanceOf(Array);
      expect(res.body.data.sections[0].code).toBe('anagrafica');
    });
  });

  describe('GET /integrations', () => {
    it('should list integrations', async () => {
      mockListIntegrations.mockResolvedValueOnce([{ id: '1', providerCode: 'zucchetti' }]);

      const res = await supertest(app)
        .get('/api/v1/payroll/integrations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.integrations).toHaveLength(1);
    });
  });

  describe('POST /integrations', () => {
    it('should create integration and return 201', async () => {
      mockCreateIntegration.mockResolvedValueOnce(VALID_UUID);

      const res = await supertest(app)
        .post('/api/v1/payroll/integrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ providerName: 'zucchetti', providerCode: 'zucchetti', integrationType: 'api' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(VALID_UUID);
    });

    it('should reject when required fields missing (Zod)', async () => {
      const res = await supertest(app)
        .post('/api/v1/payroll/integrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ providerName: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /integrations/:id', () => {
    it('should return integration details', async () => {
      mockGetIntegration.mockResolvedValueOnce({ id: VALID_UUID, providerCode: 'zucchetti' });

      const res = await supertest(app)
        .get(`/api/v1/payroll/integrations/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.providerCode).toBe('zucchetti');
    });

    it('should return 404 when not found', async () => {
      mockGetIntegration.mockResolvedValueOnce(null);

      const res = await supertest(app)
        .get(`/api/v1/payroll/integrations/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /integrations/:id', () => {
    it('should update integration', async () => {
      mockUpdateIntegration.mockResolvedValueOnce(undefined);

      const res = await supertest(app)
        .patch(`/api/v1/payroll/integrations/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ providerCode: 'zucchetti-v2' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /integrations/:id/test', () => {
    it('should test connection successfully', async () => {
      mockTestConnection.mockResolvedValueOnce({ success: true, message: 'Connected' });

      const res = await supertest(app)
        .post(`/api/v1/payroll/integrations/${VALID_UUID}/test`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /jobs', () => {
    it('should list export jobs', async () => {
      mockListExportJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      const res = await supertest(app)
        .get('/api/v1/payroll/jobs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /jobs', () => {
    it('should create export job and return 201', async () => {
      mockCreateExportJob.mockResolvedValueOnce(VALID_UUID);

      const res = await supertest(app)
        .post('/api/v1/payroll/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ payPeriodYear: 2025, payPeriodMonth: 6, exportType: 'full' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(VALID_UUID);
    });

    it('should reject when required fields missing (Zod)', async () => {
      const res = await supertest(app)
        .post('/api/v1/payroll/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ payPeriodYear: 2025 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /jobs/:id', () => {
    it('should return job details', async () => {
      mockGetExportJob.mockResolvedValueOnce({ id: VALID_UUID, status: 'pending' });

      const res = await supertest(app)
        .get(`/api/v1/payroll/jobs/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('pending');
    });

    it('should return 404 when job not found', async () => {
      mockGetExportJob.mockResolvedValueOnce(null);

      const res = await supertest(app)
        .get(`/api/v1/payroll/jobs/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /jobs/:id/generate', () => {
    it('should generate export', async () => {
      mockGenerateExport.mockResolvedValueOnce({ recordCount: 200, fileSize: 15000 });

      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/generate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recordCount).toBe(200);
    });
  });

  describe('POST /jobs/:id/validate', () => {
    it('should validate export successfully', async () => {
      mockValidateExport.mockResolvedValueOnce({ isValid: true, blockedCount: 0, warningCount: 2 });

      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/validate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.message).toMatch(/successo/);
    });

    it('should report validation errors', async () => {
      mockValidateExport.mockResolvedValueOnce({ isValid: false, blockedCount: 3 });

      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/validate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(false);
      expect(res.body.message).toMatch(/3 errori bloccanti/);
    });
  });

  describe('GET /validation-rules', () => {
    it('should return validation rules', async () => {
      mockGetValidationRules.mockResolvedValueOnce([{ code: 'R001' }]);

      const res = await supertest(app)
        .get('/api/v1/payroll/validation-rules')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rules).toHaveLength(1);
    });
  });

  describe('GET /field-mappings', () => {
    it('should return field mappings', async () => {
      mockGetFieldMappings.mockResolvedValueOnce([{ source: 'first_name', target: 'NOME' }]);

      const res = await supertest(app)
        .get('/api/v1/payroll/field-mappings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.mappings).toHaveLength(1);
    });
  });

  describe('POST /jobs/:id/transmit', () => {
    it('should transmit export', async () => {
      mockTransmitExport.mockResolvedValueOnce({ success: true, reference: 'TX-001' });

      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/transmit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmTransmission: true, method: 'sftp' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject without confirmation', async () => {
      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/transmit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmTransmission: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /jobs/:id/acknowledge', () => {
    it('should record acknowledgment', async () => {
      mockRecordAcknowledgment.mockResolvedValueOnce(undefined);

      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/acknowledge`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'ACK-001', recordsAccepted: 200, recordsRejected: 0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject without reference', async () => {
      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/acknowledge`)
        .set('Authorization', `Bearer ${token}`)
        .send({ recordsAccepted: 200 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /jobs/:id/complete', () => {
    it('should complete export', async () => {
      mockCompleteExport.mockResolvedValueOnce(undefined);

      const res = await supertest(app)
        .post(`/api/v1/payroll/jobs/${VALID_UUID}/complete`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /history', () => {
    it('should return export history', async () => {
      mockGetExportHistory.mockResolvedValueOnce({ jobs: [], total: 0 });

      const res = await supertest(app)
        .get('/api/v1/payroll/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /jobs/:id/files', () => {
    it('should return export files', async () => {
      mockGetExportFiles.mockResolvedValueOnce([{ name: 'export.csv', size: 5000 }]);

      const res = await supertest(app)
        .get(`/api/v1/payroll/jobs/${VALID_UUID}/files`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.files).toHaveLength(1);
    });
  });

  describe('GET /jobs/:id/transmission-log', () => {
    it('should return transmission log', async () => {
      mockGetTransmissionLog.mockResolvedValueOnce([
        { timestamp: '2025-06-15', status: 'success' },
      ]);

      const res = await supertest(app)
        .get(`/api/v1/payroll/jobs/${VALID_UUID}/transmission-log`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transmissions).toHaveLength(1);
    });
  });

  describe('GET /jobs/:id/compare', () => {
    it('should return period comparison', async () => {
      mockCompareWithPreviousPeriod.mockResolvedValueOnce({ differences: 5 });

      const res = await supertest(app)
        .get(`/api/v1/payroll/jobs/${VALID_UUID}/compare`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.differences).toBe(5);
    });
  });

  describe('GET /annual-summary/:year', () => {
    it('should return annual summary', async () => {
      mockGetAnnualSummary.mockResolvedValueOnce({ year: 2025, totalExports: 12 });

      const res = await supertest(app)
        .get('/api/v1/payroll/annual-summary/2025')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.year).toBe(2025);
    });

    it('should reject invalid year', async () => {
      const res = await supertest(app)
        .get('/api/v1/payroll/annual-summary/1900')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /stats', () => {
    it('should return payroll statistics', async () => {
      mockGetStatistics.mockResolvedValueOnce({ totalJobs: 50, completedJobs: 48 });

      const res = await supertest(app)
        .get('/api/v1/payroll/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalJobs).toBe(50);
    });
  });
});
