/**
 * Benefits Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for benefits CRUD,
 * employee self-service, enrollment, and statistics endpoints.
 * All external dependencies (database, redis) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildSysadminTokenPayload,
  buildEmployeeTokenPayload,
  resetFactories,
  DEFAULT_IDS,
} from '../factories/index.js';

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
const { default: benefitsRoutes } = await import('../../routes/benefits.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const BENEFIT_ID = 'benefit-1111-2222-3333-444444444444';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/benefits', authMiddleware);
  app.use('/api/v1/benefits', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/benefits', benefitsRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res
        .status(status)
        .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    }
  );
  return app;
}

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

function createEmployeeToken(): string {
  return generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
}

describe('Benefits Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
  });

  describe('Authentication Enforcement', () => {
    it('should return 401 for GET /benefits without auth token', async () => {
      const res = await supertest(app).get('/api/v1/benefits');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /benefits/me', () => {
    it('should return employee benefit enrollments', async () => {
      const token = createEmployeeToken();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            enrollment_id: 'enr-1',
            benefit_name: 'Health Insurance',
            benefit_type: 'health',
            is_active: true,
          },
          {
            enrollment_id: 'enr-2',
            benefit_name: 'Dental Plan',
            benefit_type: 'dental',
            is_active: true,
          },
        ],
        rowCount: 2,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/benefits/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.active).toBe(2);
    });
  });

  describe('GET /benefits/me/summary', () => {
    it('should return benefit summary with costs', async () => {
      const token = createEmployeeToken();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            active_benefits: '2',
            total_enrollments: '3',
            total_monthly_cost: 250,
            total_annual_cost: 3000,
          },
        ],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [{ benefit_type: 'health', count: '1', monthly_cost: 150 }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/benefits/me/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.active_benefits).toBe('2');
      expect(res.body.data.byType).toHaveLength(1);
    });
  });

  describe('GET /benefits/stats', () => {
    it('should return benefit statistics', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_benefits: '10',
            active_benefits: '8',
            benefit_types: '4',
            total_monthly_cost: 5000,
          },
        ],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_enrollments: '200', active_enrollments: '180' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/benefits/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_benefits).toBe('10');
      expect(res.body.data.active_enrollments).toBe('180');
    });
  });

  describe('GET /benefits', () => {
    it('should return paginated benefits list', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '10' }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: BENEFIT_ID,
            benefit_name: 'Health Insurance',
            benefit_type: 'health',
            enrollment_count: '50',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/benefits')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(10);
    });

    it('should accept benefit_type filter', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/benefits')
        .query({ benefit_type: 'dental', is_active: 'true' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /benefits/:id', () => {
    it('should return single benefit', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: BENEFIT_ID,
            benefit_name: 'Health Insurance',
            active_enrollments: '50',
            total_enrollments: '60',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(BENEFIT_ID);
    });

    it('should return 404 when benefit not found', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  describe('GET /benefits/:id/enrollments', () => {
    it('should return enrollments for a benefit', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'enr-1', employee_name: 'Mario Rossi', is_active: true }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/benefits/${BENEFIT_ID}/enrollments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].employee_name).toBe('Mario Rossi');
    });
  });

  describe('POST /benefits', () => {
    it('should create a new benefit', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: BENEFIT_ID, benefit_name: 'Vision Plan', benefit_type: 'vision', monthly_cost: 50 },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/benefits')
        .set('Authorization', `Bearer ${token}`)
        .send({ benefit_name: 'Vision Plan', benefit_type: 'vision', monthly_cost: 50 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.benefit_name).toBe('Vision Plan');
      expect(res.body.message).toBe('Benefit created');
    });

    it('should return 400 when benefit_name missing (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/benefits')
        .set('Authorization', `Bearer ${token}`)
        .send({ benefit_type: 'health' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /benefits/:id', () => {
    it('should update a benefit', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ id: BENEFIT_ID }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: BENEFIT_ID, monthly_cost: 75 }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monthly_cost: 75 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Benefit updated');
    });

    it('should return 404 when benefit not found', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monthly_cost: 75 });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when no fields to update', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ id: BENEFIT_ID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No fields to update');
    });
  });

  describe('DELETE /benefits/:id', () => {
    it('should deactivate a benefit', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ id: BENEFIT_ID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Benefit deactivated');
    });

    it('should return 400 when benefit has active enrollments', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('active enrollments');
    });

    it('should return 404 when benefit not found', async () => {
      const token = createSysadminToken();
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/benefits/${BENEFIT_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });
});
