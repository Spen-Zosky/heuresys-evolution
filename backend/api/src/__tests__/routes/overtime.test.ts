/**
 * overtime Routes - Unit Tests
 * Comprehensive behavioral tests for overtime endpoints.
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
const { default: routeHandler } = await import('../../routes/overtime.js');
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
  app.use('/api/v1/overtime', authMiddleware);
  app.use('/api/v1/overtime', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/overtime', routeHandler);
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

describe('overtime Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/overtime/');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /stats
  // =========================================================================
  describe('GET /stats', () => {
    it('should return overtime statistics', async () => {
      const stats = {
        total_records: '25',
        employees_with_overtime: '10',
        total_overtime_hours: '150.5',
        avg_hours_per_record: '6.0',
        total_compensation: '4525.00',
        approved_count: '20',
        pending_count: '3',
        rejected_count: '2',
        overtime_types: '3',
      };
      mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_records).toBe('25');
      expect(res.body.data.total_overtime_hours).toBe('150.5');
      expect(res.body.data.year).toBeDefined();
    });

    it('should filter by year', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total_records: '10' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/stats?year=2025')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.year).toBe(2025);
    });

    it('should filter by year and month', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total_records: '5' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/stats?year=2025&month=6')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.year).toBe(2025);
      expect(res.body.data.month).toBe(6);
    });
  });

  // =========================================================================
  // GET /by-type
  // =========================================================================
  describe('GET /by-type', () => {
    it('should return overtime breakdown by type', async () => {
      const types = [
        {
          overtime_type: 'regular',
          record_count: '15',
          total_hours: '90.0',
          avg_rate_multiplier: '1.50',
          total_compensation: '2700.00',
        },
        {
          overtime_type: 'holiday',
          record_count: '5',
          total_hours: '30.0',
          avg_rate_multiplier: '2.00',
          total_compensation: '1200.00',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: types, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/overtime/by-type')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].overtime_type).toBe('regular');
      expect(res.body.data[1].overtime_type).toBe('holiday');
    });

    it('should filter by year', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/overtime/by-type?year=2024')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /
  // =========================================================================
  describe('GET /', () => {
    it('should list overtime records with pagination', async () => {
      const records = [
        {
          id: VALID_UUID,
          employee_name: 'Mario Rossi',
          overtime_date: '2025-06-15',
          hours: 3.5,
          status: 'approved',
        },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: records, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].employee_name).toBe('Mario Rossi');
      expect(res.body.meta.total).toBe(25);
    });

    it('should return empty list when no records', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should filter by employee_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/overtime/?employee_id=${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/?status=pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by overtime_type', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/?overtime_type=holiday')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by date range', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/?date_from=2025-01-01&date_to=2025-06-30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should respect limit and offset', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/overtime/?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(20);
    });
  });

  // =========================================================================
  // GET /:id
  // =========================================================================
  describe('GET /:id', () => {
    it('should return single overtime record', async () => {
      const record = {
        id: VALID_UUID,
        employee_name: 'Mario Rossi',
        employee_email: 'mario.rossi@rtl-bank.com',
        overtime_date: '2025-06-15',
        hours: 4.0,
        status: 'approved',
        department_name: 'IT',
      };
      mockQuery.mockResolvedValueOnce({ rows: [record], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/overtime/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee_name).toBe('Mario Rossi');
      expect(res.body.data.hours).toBe(4.0);
    });

    it('should return 404 when record not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/overtime/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });
});
