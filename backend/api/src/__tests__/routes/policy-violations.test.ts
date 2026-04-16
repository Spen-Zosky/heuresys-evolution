/**
 * Policy Violations Routes - Unit Tests
 * Tests compliance policy violations listing and statistics.
 *
 * Endpoints tested:
 *  GET /policy-violations        - List violations
 *  GET /policy-violations/stats  - Violation statistics
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

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/policy-violations.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/policy-violations', authMiddleware);
  app.use('/api/v1/policy-violations', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockClientQuery } as never;
    next();
  });
  app.use('/api/v1/policy-violations', routes);
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

describe('Policy Violations Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ==================== AUTH ====================

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/policy-violations');
    expect(res.status).toBe(401);
  });

  // ==================== GET / ====================

  describe('GET /', () => {
    it('should return 200 with violations list', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'v1',
            action: 'policy_violation',
            violation_type: 'security',
            resource_id: 'r1',
            user_id: 'u1',
            description: 'Unauthorized access attempt',
            severity: 'medium',
            status: 'reviewing',
            created_at: '2025-06-01',
            reported_by: 'Mario Rossi',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/policy-violations')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('policy_violation');
    });

    it('should return 200 with empty list', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get('/api/v1/policy-violations')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should accept limit and offset query params', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get('/api/v1/policy-violations?limit=10&offset=5')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockClientQuery).toHaveBeenCalledWith(expect.any(String), [TENANT_ID, 10, 5]);
    });

    it('should return 500 on database error', async () => {
      mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app)
        .get('/api/v1/policy-violations')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });

    it('should include meta with total count', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: 'v1', action: 'delete', violation_type: 'data', reported_by: 'Admin' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/policy-violations')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
    });
  });

  // ==================== GET /stats ====================

  describe('GET /stats', () => {
    it('should return 200 with statistics', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            total_violations: '15',
            policy_violations: '5',
            security_alerts: '8',
            unauthorized_access: '2',
            recent_week: '3',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/policy-violations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_violations).toBe('15');
      expect(res.body.data.security_alerts).toBe('8');
    });

    it('should return 200 with zero stats', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            total_violations: '0',
            policy_violations: '0',
            security_alerts: '0',
            unauthorized_access: '0',
            recent_week: '0',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/policy-violations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total_violations).toBe('0');
    });

    it('should return 500 on database error', async () => {
      mockClientQuery.mockRejectedValueOnce(new Error('Stats query failed'));
      const res = await supertest(app)
        .get('/api/v1/policy-violations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });

    it('should use tenant context from middleware', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            total_violations: '0',
            policy_violations: '0',
            security_alerts: '0',
            unauthorized_access: '0',
            recent_week: '0',
          },
        ],
        rowCount: 1,
      });
      await supertest(app)
        .get('/api/v1/policy-violations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(mockClientQuery).toHaveBeenCalledWith(expect.any(String), [TENANT_ID]);
    });

    it('should return well-structured response', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            total_violations: '10',
            policy_violations: '3',
            security_alerts: '5',
            unauthorized_access: '2',
            recent_week: '4',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/policy-violations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('recent_week');
    });
  });
});
