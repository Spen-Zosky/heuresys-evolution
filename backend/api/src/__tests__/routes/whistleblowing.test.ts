/**
 * Whistleblowing Routes - Behavioral Tests
 * Uses requireTenant, dbClient, crypto (Node built-in).
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
const { default: whistleblowingRoutes } = await import('../../routes/whistleblowing.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const REPORT_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/whistleblowing', authMiddleware);
  app.use('/api/v1/whistleblowing', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/whistleblowing', whistleblowingRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res
        .status(err.statusCode || err.httpStatus || 500)
        .json({ success: false, error: err.message || 'Internal Server Error' });
    }
  );
  return app;
}

function tok(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('Whistleblowing Routes', () => {
  let app: Express;
  let token: string;
  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = tok();
  });

  describe('Auth', () => {
    it('should return 401 without token', async () => {
      expect((await supertest(app).get('/api/v1/whistleblowing/reports')).status).toBe(401);
    });
  });

  describe('GET /whistleblowing/categories', () => {
    it('should return hardcoded categories', async () => {
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/categories')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(8);
      expect(res.body.data[0]).toHaveProperty('code');
      expect(res.body.data[0]).toHaveProperty('name');
    });
  });

  describe('GET /whistleblowing/reports', () => {
    it('should return paginated reports list', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: REPORT_ID,
              case_number: 'WB-ABC-1234',
              category: 'fraud',
              status: 'received',
              severity: 'high',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/reports')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should support status filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/reports?status=investigating')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should support category filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/reports?category=fraud')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /whistleblowing/reports/:id', () => {
    it('should return single report', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: REPORT_ID, case_number: 'WB-ABC-1234', category: 'fraud', status: 'received' },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/whistleblowing/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(REPORT_ID);
    });

    it('should return 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/whistleblowing/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /whistleblowing/track/:caseNumber', () => {
    it('should track report by case number', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ case_number: 'WB-ABC-1234', status: 'investigating', category: 'fraud' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/track/WB-ABC-1234')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.case_number).toBe('WB-ABC-1234');
    });

    it('should return 404 when case not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/track/WB-INVALID')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /whistleblowing/reports', () => {
    it('should create anonymous report (201)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: REPORT_ID,
            case_number: 'WB-ABC-1234',
            status: 'received',
            created_at: '2026-02-27',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post('/api/v1/whistleblowing/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'fraud',
          title: 'Financial irregularity',
          description: 'Observed unusual transactions in Q4 reports',
          severity: 'high',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.case_number).toBeDefined();
      expect(res.body.data.tracking_token).toBeDefined();
    });

    it('should create named report without tracking token', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: REPORT_ID,
            case_number: 'WB-DEF-5678',
            status: 'received',
            created_at: '2026-02-27',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post('/api/v1/whistleblowing/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'harassment',
          title: 'Workplace harassment',
          description: 'Repeated inappropriate behavior',
          reporter_type: 'identified',
          reporter_name: 'Mario Rossi',
          reporter_email: 'mario@rtl-bank.com',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.tracking_token).toBeUndefined();
    });

    it('should return 400 when required fields missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/whistleblowing/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'fraud' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /whistleblowing/reports/:id/status', () => {
    it('should update report status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: REPORT_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: REPORT_ID, status: 'investigating' }], rowCount: 1 });
      const res = await supertest(app)
        .patch(`/api/v1/whistleblowing/reports/${REPORT_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'investigating' });
      expect(res.status).toBe(200);
    });

    it('should return 404 when report not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .patch(`/api/v1/whistleblowing/reports/${REPORT_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'investigating' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /whistleblowing/reports/:id/acknowledge', () => {
    it('should send acknowledgement', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: REPORT_ID, case_number: 'WB-ABC-1234', acknowledgement_date: '2026-02-27' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post(`/api/v1/whistleblowing/reports/${REPORT_ID}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Acknowledgement');
    });

    it('should return 404 when report not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post(`/api/v1/whistleblowing/reports/${REPORT_ID}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /whistleblowing/stats', () => {
    it('should return statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              total_reports: '15',
              pending: '3',
              investigating: '5',
              resolved: '4',
              closed: '3',
              critical: '2',
              high_severity: '5',
              last_30_days: '4',
              avg_resolution_days: '12.5',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { category: 'fraud', count: '5' },
            { category: 'harassment', count: '3' },
          ],
          rowCount: 2,
        });
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary.total_reports).toBe('15');
      expect(res.body.data.by_category).toHaveLength(2);
    });

    it('should return 500 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app)
        .get('/api/v1/whistleblowing/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });
});
