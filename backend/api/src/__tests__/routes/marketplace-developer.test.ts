/**
 * Marketplace Developer Routes - Behavioral Tests
 * Tests developer portal for managing plugins, versions, API keys, and reviews.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildSysadminTokenPayload,
  buildAdminTokenPayload,
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
const { default: routeHandler } = await import('../../routes/marketplace-developer.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const PLUGIN_ID = DEFAULT_IDS.EMPLOYEE_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/marketplace/developer', authMiddleware);
  app.use('/api/v1/marketplace/developer', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/marketplace/developer', routeHandler);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || err.httpStatus || 500;
    res
      .status(status)
      .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
  });
  return app;
}

function adminToken() {
  return generateToken(buildAdminTokenPayload({ tenantId: TENANT_ID }));
}
function sysadminToken() {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('Marketplace Developer Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = adminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('GET /stats', () => {
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/marketplace/developer/stats');
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-ADMIN role', async () => {
      const empToken = generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
      const res = await supertest(app)
        .get('/api/v1/marketplace/developer/stats')
        .set('Authorization', `Bearer ${empToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 200 with developer stats', async () => {
      const stats = {
        total_plugins: '3',
        drafts: '1',
        pending_review: '1',
        published: '1',
        suspended: '0',
        total_installations: '50',
        avg_rating: '4.2',
      };
      mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/marketplace/developer/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_plugins).toBe('3');
    });
  });

  describe('GET /plugins', () => {
    it('should return 200 with owned plugins and meta', async () => {
      const plugins = [
        { id: PLUGIN_ID, name: 'My Plugin', slug: 'my-plugin', status: 'published' },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: plugins, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const res = await supertest(app)
        .get('/api/v1/marketplace/developer/plugins')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(3);
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const res = await supertest(app)
        .get('/api/v1/marketplace/developer/plugins?status=draft&limit=5&offset=10')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(5);
    });
  });

  describe('GET /plugins/:id', () => {
    it('should return 200 with plugin details', async () => {
      const plugin = { id: PLUGIN_ID, name: 'My Plugin', status: 'published' };
      mockQuery.mockResolvedValueOnce({ rows: [plugin], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('My Plugin');
    });

    it('should return 404 when not owned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toMatch(/ERR-API-1005|PLUGIN_NOT_FOUND/);
    });
  });

  describe('POST /plugins', () => {
    it('should return 201 when creating a plugin', async () => {
      const created = { id: PLUGIN_ID, name: 'New Plugin', slug: 'new-plugin', status: 'draft' };
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // slug check
        .mockResolvedValueOnce({ rows: [{ name: 'RTL Bank' }] }) // tenant name
        .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // insert

      const res = await supertest(app)
        .post('/api/v1/marketplace/developer/plugins')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Plugin', short_description: 'A test plugin' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('draft');
    });

    it('should return 409 when slug already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 }); // slug check

      const res = await supertest(app)
        .post('/api/v1/marketplace/developer/plugins')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Existing Plugin' });
      expect(res.status).toBe(409);
      expect(res.body.code).toMatch(/ERR-API-1009|DUPLICATE_SLUG/);
    });

    it('should return 400 when name is missing (Zod)', async () => {
      const res = await supertest(app)
        .post('/api/v1/marketplace/developer/plugins')
        .set('Authorization', `Bearer ${token}`)
        .send({ short_description: 'no name' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /plugins/:id', () => {
    it('should return 200 when updating plugin', async () => {
      const updated = { id: PLUGIN_ID, name: 'Updated Plugin' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 }) // ownership check
        .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // update

      const res = await supertest(app)
        .put(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Plugin', short_description: 'Updated desc' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when not owned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .put(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });
      expect(res.status).toBe(404);
      expect(res.body.code).toMatch(/ERR-API-1005|PLUGIN_NOT_FOUND/);
    });
  });

  describe('DELETE /plugins/:id', () => {
    it('should return 200 when deleting draft plugin with no installations', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: PLUGIN_ID, status: 'draft', total_installations: 0 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // delete

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Plugin deleted');
    });

    it('should return 400 when plugin is not draft', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PLUGIN_ID, status: 'published', total_installations: 0 }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toMatch(/ERR-API-1001|INVALID_STATUS/);
    });

    it('should return 400 when plugin has installations', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PLUGIN_ID, status: 'draft', total_installations: 5 }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toMatch(/ERR-API-1001|HAS_INSTALLATIONS/);
    });

    it('should return 404 when not owned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /plugins/:id/submit', () => {
    it('should return 200 when submitting plugin for review', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PLUGIN_ID, name: 'My Plugin', status: 'pending_review' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/submit`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Plugin submitted for review');
    });

    it('should return 404 when plugin not found or not draft', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/submit`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /plugins/:id/versions', () => {
    it('should return 201 when creating a version', async () => {
      const version = { id: 'v1', plugin_id: PLUGIN_ID, version: '1.0.0', status: 'published' };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 }) // ownership
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // unmark latest
        .mockResolvedValueOnce({ rows: [version], rowCount: 1 }); // insert

      const res = await supertest(app)
        .post(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: '1.0.0', release_notes: 'Initial release' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when plugin not owned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: '1.0.0' });
      expect(res.status).toBe(404);
    });

    it('should return 400 when version is missing (Zod)', async () => {
      const res = await supertest(app)
        .post(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ release_notes: 'No version' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /plugins/:id/versions', () => {
    it('should return 200 with version list', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'v1', version: '1.0.0' }], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 404 when plugin not owned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /plugins/:id/versions/:versionId/yank', () => {
    it('should return 200 when yanking a version', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 }) // ownership
        .mockResolvedValueOnce({ rows: [{ id: 'v1', is_latest: false }], rowCount: 1 }) // version check
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // yank update

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions/v1/yank`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Version yanked');
    });

    it('should promote next version when yanking latest', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'v1', is_latest: true }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // yank
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // promote next

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions/v1/yank`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it('should return 404 when version not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/versions/nonexistent/yank`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toMatch(/ERR-API-1005|VERSION_NOT_FOUND/);
    });
  });

  describe('GET /plugins/:id/reviews', () => {
    it('should return 200 with reviews and summary', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: 'r1', rating: 5, title: 'Great plugin' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_reviews: '10',
              avg_rating: '4.5',
              five_star: '7',
              four_star: '2',
              three_star: '1',
              two_star: '0',
              one_star: '0',
            },
          ],
        });

      const res = await supertest(app)
        .get(`/api/v1/marketplace/developer/plugins/${PLUGIN_ID}/reviews`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toHaveLength(1);
      expect(res.body.data.summary.avg_rating).toBe('4.5');
      expect(res.body.meta.total).toBe(10);
    });
  });

  describe('POST /api-keys', () => {
    it('should return 201 when creating an API key', async () => {
      const created = { id: 'key1', name: 'Test Key', key_prefix: 'hk_' };
      mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/marketplace/developer/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Key' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBeDefined();
    });

    it('should return 400 when name is missing (Zod)', async () => {
      const res = await supertest(app)
        .post('/api/v1/marketplace/developer/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api-keys', () => {
    it('should return 200 with API keys', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'k1', name: 'Key 1', key_prefix: 'hk_' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/marketplace/developer/api-keys')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('DELETE /api-keys/:keyId', () => {
    it('should return 200 when revoking key', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'k1' }], rowCount: 1 });

      const res = await supertest(app)
        .delete('/api/v1/marketplace/developer/api-keys/k1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('API key revoked');
    });

    it('should return 404 when key not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete('/api/v1/marketplace/developer/api-keys/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toMatch(/ERR-API-1005|KEY_NOT_FOUND/);
    });
  });
});
