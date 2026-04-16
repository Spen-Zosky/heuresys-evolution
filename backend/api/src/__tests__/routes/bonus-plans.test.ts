/**
 * Bonus Plans Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for bonus plans CRUD,
 * stats, activation, completion, and allocation endpoints.
 * All external dependencies (database, redis) are mocked.
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
const { default: bonusPlanRoutes } = await import('../../routes/bonus-plans.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/bonus-plans', authMiddleware);
  app.use('/api/v1/bonus-plans', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/bonus-plans', bonusPlanRoutes);
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

describe('Bonus Plans Routes', () => {
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
    it('should return 401 when no token is provided', async () => {
      const res = await supertest(app).get('/api/v1/bonus-plans');
      expect(res.status).toBe(401);
    });

    it('should return 401 with an invalid token', async () => {
      const res = await supertest(app)
        .get('/api/v1/bonus-plans')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /bonus-plans/stats
  // =========================================================================

  describe('GET /bonus-plans/stats', () => {
    it('should return stats with all counts and budget sums', async () => {
      const statsRow = {
        total: '5',
        active: '2',
        draft: '1',
        completed: '2',
        total_budget: '50000',
        total_allocated: '30000',
      };
      mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(statsRow);
      expect(res.body.data.total).toBe('5');
      expect(res.body.data.active).toBe('2');
    });

    it('should return zero stats when no bonus plans exist', async () => {
      const emptyStats = {
        total: '0',
        active: '0',
        draft: '0',
        completed: '0',
        total_budget: null,
        total_allocated: null,
      };
      mockQuery.mockResolvedValueOnce({ rows: [emptyStats], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe('0');
    });
  });

  // =========================================================================
  // GET /bonus-plans/active
  // =========================================================================

  describe('GET /bonus-plans/active', () => {
    it('should return only active bonus plans with allocation counts', async () => {
      const plans = [
        { id: 'plan-1', name: 'Q1 Bonus', status: 'active', allocation_count: '3' },
        { id: 'plan-2', name: 'Q2 Bonus', status: 'active', allocation_count: '5' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: plans, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Q1 Bonus');
      expect(res.body.data[1].allocation_count).toBe('5');
    });

    it('should return empty array when no active plans', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  // =========================================================================
  // GET /bonus-plans
  // =========================================================================

  describe('GET /bonus-plans', () => {
    it('should return paginated list of bonus plans', async () => {
      const plans = [
        {
          id: 'plan-1',
          name: 'Q1 Bonus',
          bonus_type: 'performance',
          allocation_count: '3',
          total_allocations: '10000',
        },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: plans, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Q1 Bonus');
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.limit).toBe(100);
      expect(res.body.meta.offset).toBe(0);
    });

    it('should filter by status query param', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Check that the query was called with the status param
      const firstCall = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(firstCall[1]).toContain('active');
    });

    it('should filter by bonus_type query param', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans?bonus_type=performance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const firstCall = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(firstCall[1]).toContain('performance');
    });

    it('should respect limit and offset query params', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(20);
    });
  });

  // =========================================================================
  // GET /bonus-plans/:id
  // =========================================================================

  describe('GET /bonus-plans/:id', () => {
    it('should return a single bonus plan with allocation details', async () => {
      const plan = {
        id: 'plan-1',
        name: 'Annual Bonus',
        bonus_type: 'performance',
        status: 'active',
        total_budget: 100000,
        allocation_count: '10',
        total_allocations: '75000',
      };
      mockQuery.mockResolvedValueOnce({ rows: [plan], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/plan-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Annual Bonus');
      expect(res.body.data.bonus_type).toBe('performance');
      expect(res.body.data.allocation_count).toBe('10');
    });

    it('should return 404 when bonus plan does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // GET /bonus-plans/:id/allocations
  // =========================================================================

  describe('GET /bonus-plans/:id/allocations', () => {
    it('should return allocations for a plan with employee info', async () => {
      const allocations = [
        {
          id: 'alloc-1',
          plan_id: 'plan-1',
          employee_id: 'emp-1',
          actual_amount: 5000,
          employee_name: 'Mario Rossi',
          employee_email: 'mario.rossi@rtl-bank.com',
        },
        {
          id: 'alloc-2',
          plan_id: 'plan-1',
          employee_id: 'emp-2',
          actual_amount: 3000,
          employee_name: 'Lucia Bianchi',
          employee_email: 'lucia.bianchi@rtl-bank.com',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: allocations, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/plan-1/allocations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].employee_name).toBe('Mario Rossi');
      expect(res.body.data[1].actual_amount).toBe(3000);
    });

    it('should return empty array when no allocations exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/plan-1/allocations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  // =========================================================================
  // POST /bonus-plans
  // =========================================================================

  describe('POST /bonus-plans', () => {
    const validPayload = {
      name: 'Q1 2026 Performance Bonus',
      bonus_type: 'performance',
      period_start: '2026-01-01',
      period_end: '2026-03-31',
      total_budget: 50000,
    };

    it('should create a bonus plan and return 201', async () => {
      const created = { id: 'new-plan-1', ...validPayload, status: 'draft', allocated_amount: 0 };
      mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Q1 2026 Performance Bonus');
      expect(res.body.message).toBe('Bonus plan created');
    });

    it('should return 400 when name is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({ bonus_type: 'performance' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when bonus_type is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Plan' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when name is empty string', async () => {
      const res = await supertest(app)
        .post('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', bonus_type: 'performance' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept optional fields', async () => {
      const fullPayload = {
        ...validPayload,
        description: 'Annual performance bonus for Q1',
        payout_date: '2026-04-15',
        calculation_method: 'prorated',
        eligibility_rules: { min_tenure_months: 6 },
        performance_multipliers: { exceeds: 1.5, meets: 1.0, below: 0.5 },
      };
      const created = { id: 'new-plan-2', ...fullPayload, status: 'draft' };
      mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`)
        .send(fullPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Annual performance bonus for Q1');
    });
  });

  // =========================================================================
  // PATCH /bonus-plans/:id
  // =========================================================================

  describe('PATCH /bonus-plans/:id', () => {
    it('should update a bonus plan', async () => {
      const existing = { id: 'plan-1', status: 'draft' };
      const updated = { id: 'plan-1', name: 'Updated Bonus', status: 'draft' };
      mockQuery
        .mockResolvedValueOnce({ rows: [existing], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const res = await supertest(app)
        .patch('/api/v1/bonus-plans/plan-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Bonus' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Bonus');
      expect(res.body.message).toBe('Bonus plan updated');
    });

    it('should return 404 when plan does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch('/api/v1/bonus-plans/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when no fields to update (empty body)', async () => {
      const existing = { id: 'plan-1', status: 'draft' };
      mockQuery.mockResolvedValueOnce({ rows: [existing], rowCount: 1 });

      const res = await supertest(app)
        .patch('/api/v1/bonus-plans/plan-1')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No fields to update');
    });

    it('should update status field', async () => {
      const existing = { id: 'plan-1', status: 'draft' };
      const updated = { id: 'plan-1', status: 'active' };
      mockQuery
        .mockResolvedValueOnce({ rows: [existing], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const res = await supertest(app)
        .patch('/api/v1/bonus-plans/plan-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });

    it('should reject invalid status values', async () => {
      const res = await supertest(app)
        .patch('/api/v1/bonus-plans/plan-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /bonus-plans/:id/activate
  // =========================================================================

  describe('POST /bonus-plans/:id/activate', () => {
    it('should activate a draft bonus plan', async () => {
      const activated = { id: 'plan-1', name: 'Q1 Bonus', status: 'active' };
      mockQuery.mockResolvedValueOnce({ rows: [activated], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/bonus-plans/plan-1/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('active');
      expect(res.body.message).toBe('Bonus plan activated');
    });

    it('should return 404 when plan does not exist or is not draft', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/bonus-plans/nonexistent/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /bonus-plans/:id/complete
  // =========================================================================

  describe('POST /bonus-plans/:id/complete', () => {
    it('should complete an active bonus plan', async () => {
      const completed = { id: 'plan-1', name: 'Q1 Bonus', status: 'completed' };
      mockQuery.mockResolvedValueOnce({ rows: [completed], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/bonus-plans/plan-1/complete')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.message).toBe('Bonus plan completed');
    });

    it('should return 404 when plan does not exist or is not active', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/bonus-plans/nonexistent/complete')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // DELETE /bonus-plans/:id
  // =========================================================================

  describe('DELETE /bonus-plans/:id', () => {
    it('should soft-delete (cancel) a bonus plan', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'plan-1' }], rowCount: 1 });

      const res = await supertest(app)
        .delete('/api/v1/bonus-plans/plan-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Bonus plan cancelled');
    });

    it('should return 404 when plan does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete('/api/v1/bonus-plans/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // DB error handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should return 500 when database query fails on GET /stats', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await supertest(app)
        .get('/api/v1/bonus-plans/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 when database query fails on POST', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await supertest(app)
        .post('/api/v1/bonus-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test', bonus_type: 'performance' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
