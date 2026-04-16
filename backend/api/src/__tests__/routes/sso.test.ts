/**
 * SSO Routes - Behavioral Tests
 * Tests HTTP request/response for SSO authentication endpoints.
 * SSO uses req.dbClient for queries, and some routes use fetch() for external OAuth.
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
const { default: ssoRoutes } = await import('../../routes/sso.js');
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
  // SSO routes do NOT use requireTenant - they use req.dbClient for queries
  app.use('/api/v1/auth/sso', (req, _res, next) => {
    (req as any).dbClient = { query: mockQuery, release: jest.fn() };
    next();
  });
  app.use('/api/v1/auth/sso', ssoRoutes);
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

describe('SSO Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
  });

  describe('GET /auth/sso/providers', () => {
    it('should return SSO providers for tenant', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            sso_config: {
              azureAd: { enabled: true },
              google: { enabled: true },
            },
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app).get('/api/v1/auth/sso/providers?tenant=rtl-bank');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providers).toHaveLength(2);
    });

    it('should return empty providers when SSO not configured', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ sso_config: {} }], rowCount: 1 });
      const res = await supertest(app).get('/api/v1/auth/sso/providers?tenant=rtl-bank');
      expect(res.status).toBe(200);
      expect(res.body.data.providers).toHaveLength(0);
    });

    it('should return 400 when tenant code missing', async () => {
      const res = await supertest(app).get('/api/v1/auth/sso/providers');
      expect(res.status).toBe(400);
    });

    it('should return 404 when tenant not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app).get('/api/v1/auth/sso/providers?tenant=nonexistent');
      expect(res.status).toBe(404);
    });

    it('should return 500 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app).get('/api/v1/auth/sso/providers?tenant=rtl-bank');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /auth/sso/azure/login', () => {
    it('should redirect to Azure AD auth URL', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: TENANT_ID,
            azure_config: { enabled: true, clientId: 'test-client', tenantId: 'test-tenant' },
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app).get('/api/v1/auth/sso/azure/login?tenant=rtl-bank');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('login.microsoftonline.com');
    });

    it('should return 400 when tenant code missing', async () => {
      const res = await supertest(app).get('/api/v1/auth/sso/azure/login');
      expect(res.status).toBe(400);
    });

    it('should return 404 when tenant not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app).get('/api/v1/auth/sso/azure/login?tenant=nonexistent');
      expect(res.status).toBe(404);
    });

    it('should return 400 when Azure AD not enabled', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_ID, azure_config: { enabled: false } }],
        rowCount: 1,
      });
      const res = await supertest(app).get('/api/v1/auth/sso/azure/login?tenant=rtl-bank');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/sso/azure/callback', () => {
    it('should return 400 when error query param present', async () => {
      const res = await supertest(app).get(
        '/api/v1/auth/sso/azure/callback?error=access_denied&error_description=User+denied'
      );
      expect(res.status).toBe(400);
    });

    it('should return 400 when code or state missing', async () => {
      const res = await supertest(app).get('/api/v1/auth/sso/azure/callback?code=abc');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid state parameter', async () => {
      const res = await supertest(app).get(
        '/api/v1/auth/sso/azure/callback?code=abc&state=invalid-not-base64!'
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/sso/google/login', () => {
    it('should redirect to Google auth URL', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: TENANT_ID,
            google_config: { enabled: true, clientId: 'test-client.apps.googleusercontent.com' },
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app).get('/api/v1/auth/sso/google/login?tenant=rtl-bank');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('accounts.google.com');
    });

    it('should return 400 when tenant code missing', async () => {
      const res = await supertest(app).get('/api/v1/auth/sso/google/login');
      expect(res.status).toBe(400);
    });

    it('should return 400 when Google SSO not enabled', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TENANT_ID, google_config: { enabled: false } }],
        rowCount: 1,
      });
      const res = await supertest(app).get('/api/v1/auth/sso/google/login?tenant=rtl-bank');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/sso/google/callback', () => {
    it('should return 400 when error query param present', async () => {
      const res = await supertest(app).get('/api/v1/auth/sso/google/callback?error=access_denied');
      expect(res.status).toBe(400);
    });

    it('should return 400 when code missing', async () => {
      const res = await supertest(app).get('/api/v1/auth/sso/google/callback');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /auth/sso/azure/config', () => {
    it('should save Azure config', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ settings: {} }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
      const res = await supertest(app).put('/api/v1/auth/sso/azure/config').send({
        tenantId: TENANT_ID,
        clientId: 'cid',
        clientSecret: 'cs',
        azureTenantId: 'at',
        enabled: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
    });

    it('should return 400 when tenantId missing', async () => {
      const res = await supertest(app).put('/api/v1/auth/sso/azure/config').send({ clientId: 'x' });
      expect(res.status).toBe(400);
    });

    it('should return 404 when tenant not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .put('/api/v1/auth/sso/azure/config')
        .send({ tenantId: TENANT_ID, enabled: true });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /auth/sso/google/config', () => {
    it('should save Google config', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ settings: {} }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
      const res = await supertest(app)
        .put('/api/v1/auth/sso/google/config')
        .send({ tenantId: TENANT_ID, clientId: 'cid', clientSecret: 'cs', enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
    });

    it('should return 400 when tenantId missing', async () => {
      const res = await supertest(app).put('/api/v1/auth/sso/google/config').send({});
      expect(res.status).toBe(400);
    });
  });
});
