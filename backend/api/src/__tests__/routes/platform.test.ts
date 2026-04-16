/**
 * Platform Routes - Unit Tests
 * Tests platform-wide metrics, health checks, alerts, and stats summary.
 * All endpoints require SUPERUSER role (god-role, migration 109+).
 *
 * Endpoints tested:
 *  GET /platform/metrics         - Platform-wide metrics
 *  GET /platform/health          - System health status
 *  GET /platform/alerts          - Recent system alerts
 *  GET /platform/stats/summary   - Quick dashboard summary
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildSuperuserTokenPayload,
  buildEmployeeTokenPayload,
  resetFactories,
  DEFAULT_IDS,
} from '../factories/index.js';

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
const { default: routes } = await import('../../routes/platform.js');
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
  app.use('/api/v1/platform', authMiddleware);
  app.use('/api/v1/platform', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'heuresys';
    req.tenant = { id: TENANT_ID, code: 'heuresys', name: 'Heuresys System', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/platform', routes);
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

describe('Platform Routes', () => {
  let app: Express;
  let sysadminToken: string;
  let employeeToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    // Platform routes require SUPERUSER (god-role, migration 109+)
    sysadminToken = generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_ID }));
    employeeToken = generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ==================== AUTH ====================

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/platform/metrics');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-SUPERUSER role', async () => {
    const res = await supertest(app)
      .get('/api/v1/platform/metrics')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  // ==================== GET /metrics ====================

  describe('GET /metrics', () => {
    it('should return 200 with platform metrics', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_tenants: '4', active_tenants: '4' }],
        rowCount: 1,
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_users: '271' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ total_employees: '267' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 't1',
            name: 'RTL Bank',
            code: 'rtl-bank',
            status: 'active',
            employee_count: '200',
            user_count: '200',
          },
        ],
        rowCount: 1,
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ database_size: '256 MB' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ active_connections: '12' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ requests_24h: '1500' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/platform/metrics')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTenants).toBe(4);
      expect(res.body.data.totalUsers).toBe(271);
      expect(res.body.data.totalEmployees).toBe(267);
      expect(res.body.data.storageUsed).toBe('256 MB');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));
      const res = await supertest(app)
        .get('/api/v1/platform/metrics')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(500);
    });
  });

  // ==================== GET /health ====================

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{ connections: '10', max_connections: '100' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/platform/health')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.overall).toBe('healthy');
      expect(res.body.data.services.database.status).toBe('healthy');
      expect(res.body.data.services.api.status).toBe('healthy');
    });

    it('should return 200 with degraded status on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));
      const res = await supertest(app)
        .get('/api/v1/platform/health')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.overall).toBe('down');
      expect(res.body.data.services.database.status).toBe('down');
    });

    it('should include memory and uptime info', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{ connections: '5', max_connections: '100' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/platform/health')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.memoryUsage).toBeDefined();
      expect(res.body.data.uptime).toBeDefined();
    });
  });

  // ==================== GET /alerts ====================

  describe('GET /alerts', () => {
    it('should return 200 with alerts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'a1',
            timestamp: '2025-06-01',
            action: 'login_failed',
            category: 'auth',
            resource_type: 'user',
            description: 'Failed login',
            success: false,
            error_message: 'Invalid credentials',
            tenant_id: TENANT_ID,
            tenant_code: 'rtl-bank',
            alert_type: 'error',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/platform/alerts')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].type).toBe('error');
    });

    it('should return 200 with empty alerts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get('/api/v1/platform/alerts')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should accept limit query param', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get('/api/v1/platform/alerts?limit=5')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [5]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app)
        .get('/api/v1/platform/alerts')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(500);
    });
  });

  // ==================== GET /stats/summary ====================

  describe('GET /stats/summary', () => {
    it('should return 200 with summary data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_tenants: '4',
            active_tenants: '4',
            total_users: '271',
            total_employees: '267',
            api_requests_24h: '500',
            failed_requests_24h: '3',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/platform/stats/summary')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalTenants).toBe(4);
      expect(res.body.data.failedRequests24h).toBe(3);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('query error'));
      const res = await supertest(app)
        .get('/api/v1/platform/stats/summary')
        .set('Authorization', `Bearer ${sysadminToken}`);
      expect(res.status).toBe(500);
    });
  });
});
