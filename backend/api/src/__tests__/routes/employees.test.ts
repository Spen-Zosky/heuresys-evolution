/**
 * Employees Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for employee CRUD endpoints.
 * All external dependencies (database, redis) are mocked.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildEmployee,
  buildSysadminTokenPayload,
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
const { default: employeesRoutes } = await import('../../routes/employees.js');
const { generateToken } = await import('../../middleware/auth.js');
const { authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants (sourced from factories for consistency)
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.EMPLOYEE_ID;

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
  // Auth middleware
  app.use('/api/v1/employees', authMiddleware);
  // Lightweight tenant context stub (avoids DB queries in unit tests)
  app.use('/api/v1/employees', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  // Employee routes
  app.use('/api/v1/employees', employeesRoutes);
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
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

function createEmployeeToken(): string {
  return generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
}

// Tenant context is handled by the lightweight stub in createTestApp()
// No DB mocking needed for tenant resolution in unit tests.

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Employees Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    // Reset mockConnect to return fresh client
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    } as never);
  });

  // =========================================================================
  // Auth enforcement
  // =========================================================================
  describe('Authentication Enforcement', () => {
    it('should return 401 for GET /employees without auth token', async () => {
      const res = await supertest(app).get('/api/v1/employees').set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /employees without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/employees')
        .set('X-Tenant-ID', TENANT_ID)
        .send({ first_name: 'Mario', last_name: 'Rossi', email: 'mario@test.com' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /employees/:id without auth token', async () => {
      const res = await supertest(app)
        .delete(`/api/v1/employees/${VALID_UUID}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /api/v1/employees - List employees
  // =========================================================================
  describe('GET /api/v1/employees', () => {
    it('should return paginated employee list', async () => {
      const token = createSysadminToken();

      const emp1 = buildEmployee({ id: 'emp-1' });
      const emp2 = buildEmployee({
        id: 'emp-2',
        department: 'HR',
        department_name: 'HR',
        job_title: 'HR Manager',
      });

      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 } as never);
      // Employee list query
      mockQuery.mockResolvedValueOnce({
        rows: [emp1, emp2],
        rowCount: 2,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/employees?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employees).toHaveLength(2);
      expect(res.body.data.meta).toHaveProperty('offset', 0);
      expect(res.body.data.meta).toHaveProperty('total', 2);
      expect(res.body.data.meta).toHaveProperty('limit', 20);
    });

    it('should return empty list when no employees found', async () => {
      const token = createSysadminToken();

      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 } as never);
      // Employee list query
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.employees).toHaveLength(0);
      expect(res.body.data.meta.total).toBe(0);
    });
  });

  // =========================================================================
  // GET /api/v1/employees/:id - Get single employee
  // =========================================================================
  describe('GET /api/v1/employees/:id', () => {
    it('should return employee details for valid UUID', async () => {
      const token = createSysadminToken();

      const employee = buildEmployee({ id: VALID_UUID });

      // Employee query
      mockQuery.mockResolvedValueOnce({
        rows: [employee],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', VALID_UUID);
      expect(res.body.data).toHaveProperty('first_name', 'Mario');
    });

    it('should return 400 for invalid UUID format', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .get('/api/v1/employees/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
    });

    it('should return 404 when employee not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // POST /api/v1/employees - Create employee
  // =========================================================================
  describe('POST /api/v1/employees', () => {
    it('should return 400 when required fields are missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ first_name: 'Mario' }); // missing last_name and email

      expect(res.status).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
      const token = createSysadminToken();

      // Email check returns existing employee
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-emp-id' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ first_name: 'Mario', last_name: 'Rossi', email: 'existing@rtl.com' });

      expect(res.status).toBe(409);
    });

    it('should create employee successfully with valid data', async () => {
      const token = createSysadminToken();

      const newEmployee = buildEmployee({
        id: 'new-emp-uuid',
        first_name: 'Marco',
        last_name: 'Verdi',
        email: 'marco.verdi@rtl.com',
        job_title: 'Data Analyst',
        hire_date: '2025-01-15',
        tenant_id: TENANT_ID,
      });

      const newEmployeePayload = {
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        email: newEmployee.email,
        job_title: newEmployee.job_title,
        hire_date: newEmployee.hire_date,
      };

      // Email uniqueness check - not found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // INSERT employee
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: newEmployee.id,
            tenant_id: newEmployee.tenant_id,
            ...newEmployeePayload,
            is_active: true,
            created_at: '2025-01-15T00:00:00Z',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send(newEmployeePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', newEmployee.id);
      expect(res.body.data).toHaveProperty('first_name', newEmployee.first_name);
      expect(res.body.message).toContain('created');
    });
  });

  // =========================================================================
  // PATCH /api/v1/employees/:id - Update employee
  // =========================================================================
  describe('PATCH /api/v1/employees/:id', () => {
    it('should return 400 for invalid UUID format', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .patch('/api/v1/employees/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ first_name: 'Updated' });

      expect(res.status).toBe(400);
    });

    it('should return 404 when employee not found', async () => {
      const token = createSysadminToken();

      // Employee existence check
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ first_name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when no valid fields provided', async () => {
      const token = createSysadminToken();

      // Employee exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ nonexistent_field: 'value' });

      expect(res.status).toBe(400);
    });

    it('should update employee successfully', async () => {
      const token = createSysadminToken();

      // Employee exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 } as never);
      // UPDATE query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: VALID_UUID,
            first_name: 'Updated',
            last_name: 'Rossi',
            email: 'mario@rtl.com',
            job_title: 'Senior Developer',
            is_active: true,
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ first_name: 'Updated', job_title: 'Senior Developer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('first_name', 'Updated');
      expect(res.body.message).toContain('updated');
    });
  });

  // =========================================================================
  // DELETE /api/v1/employees/:id - Delete employee
  // =========================================================================
  describe('DELETE /api/v1/employees/:id', () => {
    it('should return 400 for invalid UUID format', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .delete('/api/v1/employees/bad-id')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
    });

    it('should soft-delete employee (set is_active=false)', async () => {
      const token = createSysadminToken();

      // Soft delete UPDATE query
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: VALID_UUID }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .delete(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deactivated');
    });

    it('should return 404 when employee not found for deletion', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/employees/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /api/v1/employees/:id/direct-reports
  // =========================================================================
  describe('GET /api/v1/employees/:id/direct-reports', () => {
    it('should return direct reports for valid manager', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'sub-1',
            first_name: 'Sub',
            last_name: 'One',
            email: 's1@rtl.com',
            job_title: 'Analyst',
            department: 'IT',
            is_active: true,
            hire_date: '2021-01-01',
          },
          {
            id: 'sub-2',
            first_name: 'Sub',
            last_name: 'Two',
            email: 's2@rtl.com',
            job_title: 'Designer',
            department: 'IT',
            is_active: true,
            hire_date: '2021-06-01',
          },
        ],
        rowCount: 2,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/employees/${VALID_UUID}/direct-reports`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });
  });

  // =========================================================================
  // GET /api/v1/employees/meta/termination-reasons
  // =========================================================================
  describe('GET /api/v1/employees/meta/termination-reasons', () => {
    it('should return list of termination reasons', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .get('/api/v1/employees/meta/termination-reasons')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('value');
      expect(res.body.data[0]).toHaveProperty('label');
    });
  });
});
