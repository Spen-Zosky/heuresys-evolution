/**
 * Tenants Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for tenant management endpoints.
 * All external dependencies (database, redis) are mocked.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildTenant,
  buildSysadminTokenPayload,
  buildSuperuserTokenPayload,
  buildAdminTokenPayload,
  buildEmployeeTokenPayload,
  resetFactories,
  DEFAULT_IDS,
} from '../factories/index.js';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------

// Helper: resolve module path relative to this file (absolute .ts path for ESM mocks)
const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

const mockQuery = jest.fn();

jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
  pool: { query: mockQuery },
  appPool: { connect: jest.fn() },
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
const { default: tenantsRoutes } = await import('../../routes/tenants.js');
const { generateToken } = await import('../../middleware/auth.js');
const { authMiddleware } = await import('../../middleware/auth.js');
const { default: supertest } = await import('supertest');

// ---------------------------------------------------------------------------
// Constants (sourced from factories for consistency)
// ---------------------------------------------------------------------------

const TENANT_UUID = 'd5855519-1111-2222-3333-444444444444';
const OTHER_UUID = DEFAULT_IDS.TENANT_ID;

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  // requestId stub
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  // Tenants routes: GET / and GET /:identifier are public.
  // POST, PATCH, DELETE have their own authMiddleware internally.
  app.use('/api/v1/tenants', tenantsRoutes);
  // Error handler
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

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_UUID }));
}

function createSuperuserToken(): string {
  return generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_UUID }));
}

function createAdminToken(): string {
  return generateToken(buildAdminTokenPayload({ tenantId: TENANT_UUID }));
}

function createEmployeeToken(): string {
  return generateToken(buildEmployeeTokenPayload({ tenantId: OTHER_UUID, permissions: [] }));
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Tenants Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
  });

  // =========================================================================
  // GET /api/v1/tenants - List tenants (public)
  // =========================================================================
  describe('GET /api/v1/tenants', () => {
    it('should return a list of tenants', async () => {
      const tenant1 = buildTenant({
        id: TENANT_UUID,
        code: 'heuresys',
        name: 'Heuresys System',
        industry_type: 'IT',
        subscription_plan: 'enterprise',
        employee_count: 10,
      });
      const tenant2 = buildTenant({
        id: OTHER_UUID,
        code: 'rtl-bank',
        name: 'RTL Bank',
        industry_type: 'Banking',
        subscription_plan: 'professional',
        employee_count: 200,
        description: 'Banking Corp',
      });

      // List query
      mockQuery.mockResolvedValueOnce({
        rows: [tenant1, tenant2],
        rowCount: 2,
      } as never);
      // Count query
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '2' }],
        rowCount: 1,
      } as never);

      const token = createSuperuserToken();
      const res = await supertest(app)
        .get('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toHaveProperty('totalCount', 2);
      expect(res.body.meta).toHaveProperty('timestamp');
    });

    it('should support filtering by status', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: TENANT_UUID,
            code: 'heuresys',
            name: 'Heuresys',
            status: 'active',
            subscription_plan: 'enterprise',
            industry_type: 'IT',
            region: 'EU',
            employee_count: 10,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            description: null,
          },
        ],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '1' }],
        rowCount: 1,
      } as never);

      const token = createSuperuserToken();
      const res = await supertest(app)
        .get('/api/v1/tenants?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return empty data when no tenants match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const token = createSuperuserToken();
      const res = await supertest(app)
        .get('/api/v1/tenants?status=suspended')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.totalCount).toBe(0);
    });
  });

  // =========================================================================
  // GET /api/v1/tenants/:identifier - Get tenant by ID or code (public)
  // =========================================================================
  describe('GET /api/v1/tenants/:identifier', () => {
    it('should return tenant by code', async () => {
      const rtlTenant = buildTenant({
        id: TENANT_UUID,
        code: 'rtl-bank',
        name: 'RTL Bank',
        description: 'Banking',
        nace_code: '6419',
        employee_count: 200,
        subscription_plan: 'professional',
        industry_type: 'Banking',
        annual_revenue_eur: 5000000,
        sap_company_code: 'RTL1',
      });

      mockQuery.mockResolvedValueOnce({
        rows: [rtlTenant],
        rowCount: 1,
      } as never);

      const token = createSuperuserToken();
      const res = await supertest(app)
        .get('/api/v1/tenants/rtl-bank')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('code', 'rtl-bank');
      expect(res.body.data).toHaveProperty('name', 'RTL Bank');
      expect(res.body.meta).toHaveProperty('requestId');
    });

    it('should return tenant by UUID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: TENANT_UUID,
            code: 'heuresys',
            name: 'Heuresys System',
            description: null,
            nace_code: null,
            region: 'EU',
            status: 'active',
            employee_count: 10,
            subscription_plan: 'enterprise',
            industry_type: 'IT',
            annual_revenue_eur: null,
            sap_company_code: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
        ],
        rowCount: 1,
      } as never);

      const token = createSuperuserToken();
      const res = await supertest(app)
        .get(`/api/v1/tenants/${TENANT_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', TENANT_UUID);
    });

    it('should return 404 when tenant not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const token = createSuperuserToken();
      const res = await supertest(app)
        .get('/api/v1/tenants/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /api/v1/tenants/meta/statuses
  // =========================================================================
  describe('GET /api/v1/tenants/meta/statuses', () => {
    it('should return list of valid statuses', async () => {
      const res = await supertest(app).get('/api/v1/tenants/meta/statuses');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      const values = res.body.data.map((s: { value: string }) => s.value);
      expect(values).toContain('active');
      expect(values).toContain('inactive');
      expect(values).toContain('suspended');
      expect(values).toContain('pending');
    });
  });

  // =========================================================================
  // GET /api/v1/tenants/meta/plans
  // =========================================================================
  describe('GET /api/v1/tenants/meta/plans', () => {
    it('should return list of subscription plans', async () => {
      const res = await supertest(app).get('/api/v1/tenants/meta/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      const values = res.body.data.map((p: { value: string }) => p.value);
      expect(values).toContain('free');
      expect(values).toContain('enterprise');
    });
  });

  // =========================================================================
  // POST /api/v1/tenants - Create tenant (SYSADMIN only)
  // =========================================================================
  describe('POST /api/v1/tenants', () => {
    it('should return 401 when no auth token provided', async () => {
      const res = await supertest(app)
        .post('/api/v1/tenants')
        .send({ code: 'new-tenant', name: 'New Tenant' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when non-SYSADMIN user attempts to create', async () => {
      const token = createEmployeeToken();

      const res = await supertest(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'new-tenant', name: 'New Tenant' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when code is missing', async () => {
      const token = createSuperuserToken();

      const res = await supertest(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Tenant' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name is missing', async () => {
      const token = createSuperuserToken();

      const res = await supertest(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'new-tenant' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when code format is invalid (uppercase)', async () => {
      const token = createSuperuserToken();

      const res = await supertest(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'Invalid_Code', name: 'New Tenant' });

      expect(res.status).toBe(400);
    });

    it('should return 409 when tenant code already exists', async () => {
      const token = createSuperuserToken();

      // Check for duplicate returns existing tenant
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'existing-code', name: 'Duplicate Tenant' });

      expect(res.status).toBe(409);
    });

    it('should create tenant successfully with valid data', async () => {
      const token = createSuperuserToken();

      const newTenant = buildTenant({
        id: 'new-tenant-uuid',
        code: 'acme-corp',
        name: 'ACME Corporation',
        description: 'New tenant',
        status: 'pending',
        subscription_plan: 'free',
        industry_type: 'Manufacturing',
        employee_count: 0,
      });

      // Check for duplicates - none found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // INSERT tenant
      mockQuery.mockResolvedValueOnce({
        rows: [newTenant],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'acme-corp',
          name: 'ACME Corporation',
          description: 'New tenant',
          region: 'EU',
          industry_type: 'Manufacturing',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', 'new-tenant-uuid');
      expect(res.body.data).toHaveProperty('code', 'acme-corp');
      expect(res.body.data).toHaveProperty('status', 'pending');
      expect(res.body.message).toContain('created');
    });
  });

  // =========================================================================
  // PATCH /api/v1/tenants/:identifier - Update tenant
  // =========================================================================
  describe('PATCH /api/v1/tenants/:identifier', () => {
    it('should return 401 when no auth token provided', async () => {
      const res = await supertest(app)
        .patch('/api/v1/tenants/rtl-bank')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(401);
    });

    it('should return 404 when tenant not found', async () => {
      const token = createSuperuserToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch('/api/v1/tenants/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when no valid fields provided', async () => {
      const token = createSuperuserToken();

      // Tenant found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_UUID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch('/api/v1/tenants/rtl-bank')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should update tenant successfully as SYSADMIN', async () => {
      const token = createSuperuserToken();

      // Tenant found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_UUID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' }],
        rowCount: 1,
      } as never);
      // UPDATE query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: TENANT_UUID,
            code: 'rtl-bank',
            name: 'RTL Bank Updated',
            description: 'Updated description',
            nace_code: null,
            region: 'EU',
            status: 'active',
            subscription_plan: 'professional',
            industry_type: 'Banking',
            sap_company_code: null,
            annual_revenue_eur: null,
            employee_count: 200,
            created_at: '2025-01-01',
            updated_at: '2025-06-15',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch('/api/v1/tenants/rtl-bank')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'RTL Bank Updated', description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'RTL Bank Updated');
      expect(res.body.message).toContain('updated');
    });

    it('should return 403 when non-SYSADMIN tries to change status', async () => {
      const token = createAdminToken();

      // Tenant found - same tenant as user
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_UUID, code: 'heuresys', name: 'Heuresys', status: 'active' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch('/api/v1/tenants/heuresys')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(403);
    });

    it('should return 403 when admin tries to update different tenant', async () => {
      const token = createAdminToken(); // tenantId = TENANT_UUID

      // Tenant found - DIFFERENT tenant
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: OTHER_UUID, code: 'other-tenant', name: 'Other', status: 'active' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch('/api/v1/tenants/other-tenant')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // DELETE /api/v1/tenants/:identifier - Delete/deactivate tenant
  // =========================================================================
  describe('DELETE /api/v1/tenants/:identifier', () => {
    it('should return 401 when no auth token provided', async () => {
      const res = await supertest(app).delete('/api/v1/tenants/rtl-bank');

      expect(res.status).toBe(401);
    });

    it('should return 403 when non-SYSADMIN user attempts to delete', async () => {
      const token = createEmployeeToken();

      const res = await supertest(app)
        .delete('/api/v1/tenants/rtl-bank')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 when tenant not found', async () => {
      const token = createSuperuserToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete('/api/v1/tenants/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should prevent deactivation of system tenant (heuresys)', async () => {
      const token = createSuperuserToken();

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_UUID, code: 'heuresys', name: 'Heuresys', status: 'active' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .delete('/api/v1/tenants/heuresys')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('should soft-delete tenant (set status=inactive)', async () => {
      const token = createSuperuserToken();

      // Tenant found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: OTHER_UUID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' }],
        rowCount: 1,
      } as never);
      // UPDATE status
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete('/api/v1/tenants/rtl-bank')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deactivated');
    });
  });

  // =========================================================================
  // POST /api/v1/tenants/:identifier/activate
  // =========================================================================
  describe('POST /api/v1/tenants/:identifier/activate', () => {
    it('should return 401 when no auth token provided', async () => {
      const res = await supertest(app).post('/api/v1/tenants/rtl-bank/activate');

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-SYSADMIN', async () => {
      const token = createEmployeeToken();

      const res = await supertest(app)
        .post('/api/v1/tenants/rtl-bank/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should activate inactive tenant', async () => {
      const token = createSuperuserToken();

      // Tenant found - inactive
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: OTHER_UUID, code: 'rtl-bank', name: 'RTL Bank', status: 'inactive' }],
        rowCount: 1,
      } as never);
      // UPDATE status
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/tenants/rtl-bank/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('activated');
    });

    it('should return 400 when tenant is already active', async () => {
      const token = createSuperuserToken();

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: OTHER_UUID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/tenants/rtl-bank/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/v1/tenants/:id/stats
  // =========================================================================
  describe('GET /api/v1/tenants/:identifier/stats', () => {
    it('should return tenant statistics', async () => {
      // Tenant lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_UUID, code: 'rtl-bank', name: 'RTL Bank' }],
        rowCount: 1,
      } as never);
      // Stats queries (5 parallel queries)
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '200' }], rowCount: 1 } as never); // employees
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 } as never); // departments
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 } as never); // locations
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 } as never); // goals
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 } as never); // reviews

      const res = await supertest(app)
        .get('/api/v1/tenants/rtl-bank/stats')
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant).toHaveProperty('code', 'rtl-bank');
      expect(res.body.data.stats).toHaveProperty('employees', 200);
      expect(res.body.data.stats).toHaveProperty('departments', 10);
      expect(res.body.data.stats).toHaveProperty('locations', 5);
    });

    it('should return 404 when tenant not found for stats', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/tenants/nonexistent/stats')
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(404);
    });
  });
});
