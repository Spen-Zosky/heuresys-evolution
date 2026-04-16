/**
 * Marketplace Plugins Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for marketplace plugin endpoints.
 * All external dependencies (database, redis) are mocked.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSuperuserTokenPayload, resetFactories } from '../factories/index.js';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------

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
const { default: marketplacePluginsRoutes } = await import('../../routes/marketplace-plugins.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const { createErrorMiddleware } = await import('../../errors/middleware.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
function createSuperuserToken() {
  return generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_ID }));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PLUGIN_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const DEP_PLUGIN_UUID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    req.dbClient = { query: mockQuery } as never;
    req.tenantId = TENANT_ID;
    req.tenantCode = 'test';
    next();
  });
  app.use('/api/v1/marketplace/plugins', marketplacePluginsRoutes);
  app.use(createErrorMiddleware({ enableConsoleLogging: false }));
  return app;
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Marketplace Plugins Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins/stats
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins/stats', () => {
    it('should return marketplace statistics', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_plugins: '42',
            published: '30',
            draft: '8',
            pending_review: '4',
            featured: '6',
            free_plugins: '20',
            paid_plugins: '10',
            overall_avg_rating: '4.25',
            total_downloads: '15000',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total_plugins', '42');
      expect(res.body.data).toHaveProperty('published', '30');
      expect(res.body.data).toHaveProperty('featured', '6');
      expect(res.body.data).toHaveProperty('total_downloads', '15000');
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed') as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/stats');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins/categories
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins/categories', () => {
    it('should return plugin categories with counts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'cat-1',
            name: 'HR Tools',
            slug: 'hr-tools',
            description: 'HR extensions',
            icon: 'users',
            sort_order: 1,
            plugin_count: '5',
          },
          {
            id: 'cat-2',
            name: 'Analytics',
            slug: 'analytics',
            description: 'Analytics plugins',
            icon: 'chart',
            sort_order: 2,
            plugin_count: '3',
          },
        ],
        rowCount: 2,
      } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('name', 'HR Tools');
      expect(res.body.data[0]).toHaveProperty('plugin_count', '5');
    });
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins/featured
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins/featured', () => {
    it('should return featured plugins with default limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'Top Plugin',
            slug: 'top-plugin',
            short_description: 'The best plugin',
            publisher_name: 'Heuresys',
            icon_url: null,
            pricing_model: 'free',
            price_cents: 0,
            currency: 'EUR',
            featured: true,
            total_installations: 500,
            avg_rating: 4.8,
            total_ratings: 50,
            tags: ['hr', 'analytics'],
            created_at: '2025-01-01',
            category_name: 'Analytics',
            category_slug: 'analytics',
            category_icon: 'chart',
            latest_version: '2.0.0',
            latest_version_date: '2025-06-01',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/featured');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('featured', true);
      expect(res.body.data[0]).toHaveProperty('name', 'Top Plugin');
    });

    it('should respect custom limit parameter', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/featured?limit=3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Verify the limit parameter was passed to query
      const queryArgs = mockQuery.mock.calls[0];
      expect(queryArgs[1]).toEqual([3]);
    });
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins - List plugins
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins', () => {
    it('should return paginated plugin list', async () => {
      const pluginRow = {
        id: PLUGIN_UUID,
        name: 'Test Plugin',
        slug: 'test-plugin',
        short_description: 'A test plugin',
        publisher_name: 'Publisher Inc',
        icon_url: null,
        pricing_model: 'free',
        price_cents: 0,
        currency: 'EUR',
        status: 'published',
        featured: false,
        total_installations: 100,
        avg_rating: 4.5,
        total_ratings: 20,
        tags: ['hr'],
        created_at: '2025-01-01',
        updated_at: '2025-06-01',
        category_name: 'HR Tools',
        category_slug: 'hr-tools',
        category_icon: 'users',
        latest_version: '1.0.0',
      };

      // List query
      mockQuery.mockResolvedValueOnce({
        rows: [pluginRow],
        rowCount: 1,
      } as never);
      // Count query
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '1' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins?limit=20&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('name', 'Test Plugin');
      expect(res.body.meta).toHaveProperty('total', 1);
      expect(res.body.meta).toHaveProperty('limit', 20);
      expect(res.body.meta).toHaveProperty('offset', 0);
    });

    it('should support filtering by category', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins?category=hr-tools');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      // Verify category filter was included in query params
      const queryArgs = mockQuery.mock.calls[0];
      expect(queryArgs[1]).toContain('hr-tools');
    });

    it('should support filtering by pricing_model', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins?pricing_model=free');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const queryArgs = mockQuery.mock.calls[0];
      expect(queryArgs[1]).toContain('free');
    });

    it('should support search parameter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins?search=analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const queryArgs = mockQuery.mock.calls[0];
      expect(queryArgs[1]).toContain('%analytics%');
    });

    it('should default to sorting by total_installations desc', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins');

      expect(res.status).toBe(200);
      const queryStr = mockQuery.mock.calls[0][0] as string;
      expect(queryStr).toContain('p.total_installations');
      expect(queryStr).toContain('DESC');
    });

    it('should handle sort=name&order=asc', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins?sort=name&order=asc');

      expect(res.status).toBe(200);
      const queryStr = mockQuery.mock.calls[0][0] as string;
      expect(queryStr).toContain('p.name');
      expect(queryStr).toContain('ASC');
    });
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins/:idOrSlug - Plugin details
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins/:idOrSlug', () => {
    it('should return plugin details by UUID', async () => {
      // Plugin query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'Test Plugin',
            slug: 'test-plugin',
            description: 'Full description',
            short_description: 'Short desc',
            publisher_name: 'Publisher',
            status: 'published',
            category_name: 'HR Tools',
            category_slug: 'hr-tools',
            category_icon: 'users',
            latest_version: '1.0.0',
            release_notes: 'Initial release',
            latest_version_date: '2025-01-01',
            config_schema: '{}',
            permissions_required: '{}',
          },
        ],
        rowCount: 1,
      } as never);
      // Dependencies query
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as never);

      const res = await supertest(app).get(`/api/v1/marketplace/plugins/${PLUGIN_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', PLUGIN_UUID);
      expect(res.body.data).toHaveProperty('name', 'Test Plugin');
      expect(res.body.data).toHaveProperty('dependencies');
      expect(res.body.data.dependencies).toHaveLength(0);
    });

    it('should return plugin details by slug', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'Test Plugin',
            slug: 'test-plugin',
            publisher_name: 'Publisher',
            status: 'published',
            category_name: null,
            category_slug: null,
            category_icon: null,
            latest_version: null,
            release_notes: null,
            latest_version_date: null,
            config_schema: null,
            permissions_required: null,
          },
        ],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/test-plugin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('slug', 'test-plugin');
    });

    it('should return 404 when plugin not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/nonexistent-slug');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });

    it('should include dependencies when plugin has them', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'Plugin With Deps',
            slug: 'plugin-deps',
            publisher_name: 'Publisher',
            status: 'published',
            category_name: null,
            category_slug: null,
            category_icon: null,
            latest_version: '1.0.0',
            release_notes: null,
            latest_version_date: null,
            config_schema: null,
            permissions_required: null,
          },
        ],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'dep-1',
            depends_on_plugin_id: DEP_PLUGIN_UUID,
            min_version: '1.0.0',
            max_version: null,
            is_optional: false,
            dependency_name: 'Base Plugin',
            dependency_slug: 'base-plugin',
            dependency_icon_url: null,
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app).get(`/api/v1/marketplace/plugins/${PLUGIN_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.dependencies).toHaveLength(1);
      expect(res.body.data.dependencies[0]).toHaveProperty('dependency_name', 'Base Plugin');
    });
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins/:idOrSlug/versions
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins/:idOrSlug/versions', () => {
    it('should return version history', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'v-2',
            plugin_id: PLUGIN_UUID,
            version: '2.0.0',
            status: 'published',
            is_latest: true,
            created_at: '2025-06-01',
          },
          {
            id: 'v-1',
            plugin_id: PLUGIN_UUID,
            version: '1.0.0',
            status: 'published',
            is_latest: false,
            created_at: '2025-01-01',
          },
        ],
        rowCount: 2,
      } as never);

      const res = await supertest(app).get(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/versions`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('version', '2.0.0');
    });

    it('should return empty array when no versions exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app).get('/api/v1/marketplace/plugins/new-plugin/versions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // =========================================================================
  // POST /api/v1/marketplace/plugins - Create plugin
  // =========================================================================
  describe('POST /api/v1/marketplace/plugins', () => {
    it('should create a plugin with valid data', async () => {
      // Slug uniqueness check
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // INSERT
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'New Plugin',
            slug: 'new-plugin',
            publisher_name: 'Publisher Inc',
            status: 'draft',
            pricing_model: 'free',
            created_at: '2025-01-01',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/marketplace/plugins')
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          name: 'New Plugin',
          publisher_name: 'Publisher Inc',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', PLUGIN_UUID);
      expect(res.body.data).toHaveProperty('status', 'draft');
    });

    it('should auto-generate slug from name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'My Great Plugin',
            slug: 'my-great-plugin',
            publisher_name: 'Pub',
            status: 'draft',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/marketplace/plugins')
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          name: 'My Great Plugin',
          publisher_name: 'Pub',
        });

      expect(res.status).toBe(201);
      // Verify slug was generated from name in the INSERT query params
      const insertParams = mockQuery.mock.calls[0][1] as string[];
      expect(insertParams).toContain('my-great-plugin');
    });

    it('should return 409 when slug already exists', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/marketplace/plugins')
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          name: 'Duplicate Plugin',
          publisher_name: 'Publisher',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/slug already exists/i);
    });

    it('should return 400 when name is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/marketplace/plugins')
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          publisher_name: 'Publisher',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when publisher_name is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/marketplace/plugins')
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          name: 'Some Plugin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // PUT /api/v1/marketplace/plugins/:id - Update plugin
  // =========================================================================
  describe('PUT /api/v1/marketplace/plugins/:id', () => {
    it('should update plugin successfully', async () => {
      // Existing check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PLUGIN_UUID, status: 'draft' }],
        rowCount: 1,
      } as never);
      // UPDATE
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PLUGIN_UUID,
            name: 'Updated Plugin',
            slug: 'updated-plugin',
            publisher_name: 'Publisher',
            status: 'draft',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .put(`/api/v1/marketplace/plugins/${PLUGIN_UUID}`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({ name: 'Updated Plugin' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'Updated Plugin');
    });

    it('should return 404 when plugin not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .put(`/api/v1/marketplace/plugins/${VALID_UUID}`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // DELETE /api/v1/marketplace/plugins/:id
  // =========================================================================
  describe('DELETE /api/v1/marketplace/plugins/:id', () => {
    it('should delete plugin with no active installations', async () => {
      // Installation check
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as never);
      // DELETE
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PLUGIN_UUID }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/plugins/${PLUGIN_UUID}`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 400 when plugin has active installations', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '3' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/plugins/${PLUGIN_UUID}`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/active installations/i);
    });

    it('should return 404 when plugin not found for deletion', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
      } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as never);

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/plugins/${VALID_UUID}`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // PATCH /api/v1/marketplace/plugins/:id/publish
  // =========================================================================
  describe('PATCH /api/v1/marketplace/plugins/:id/publish', () => {
    it('should publish a draft plugin', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PLUGIN_UUID, name: 'My Plugin', status: 'published' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/publish`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('published');
    });

    it('should return 404 when plugin not in publishable state', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/marketplace/plugins/${VALID_UUID}/publish`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /api/v1/marketplace/plugins/:id/versions - Create version
  // =========================================================================
  describe('POST /api/v1/marketplace/plugins/:id/versions', () => {
    it('should create a new version for a plugin', async () => {
      // Plugin exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PLUGIN_UUID }], rowCount: 1 } as never);
      // Unmark current latest
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // INSERT version
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'version-uuid',
            plugin_id: PLUGIN_UUID,
            version: '2.0.0',
            status: 'published',
            is_latest: true,
            release_notes: 'Major update',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/versions`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          version: '2.0.0',
          release_notes: 'Major update',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('version', '2.0.0');
      expect(res.body.data).toHaveProperty('is_latest', true);
    });

    it('should return 400 when version string is missing', async () => {
      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/versions`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          release_notes: 'Missing version field',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when plugin does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${VALID_UUID}/versions`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({ version: '1.0.0' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /api/v1/marketplace/plugins/:id/dependencies - Add dependency
  // =========================================================================
  describe('POST /api/v1/marketplace/plugins/:id/dependencies', () => {
    it('should add a dependency to a plugin', async () => {
      // Plugin exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PLUGIN_UUID }], rowCount: 1 } as never);
      // Dependency plugin exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: DEP_PLUGIN_UUID }], rowCount: 1 } as never);
      // INSERT dependency
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'dep-uuid',
            plugin_id: PLUGIN_UUID,
            depends_on_plugin_id: DEP_PLUGIN_UUID,
            min_version: '1.0.0',
            max_version: null,
            is_optional: false,
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependencies`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({
          depends_on_plugin_id: DEP_PLUGIN_UUID,
          min_version: '1.0.0',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('depends_on_plugin_id', DEP_PLUGIN_UUID);
    });

    it('should return 400 when depends_on_plugin_id is missing', async () => {
      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependencies`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when source plugin does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${VALID_UUID}/dependencies`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({ depends_on_plugin_id: DEP_PLUGIN_UUID });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when dependency plugin does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PLUGIN_UUID }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependencies`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`)
        .send({ depends_on_plugin_id: VALID_UUID });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/dependency plugin not found|non trovato/i);
    });
  });

  // =========================================================================
  // DELETE /api/v1/marketplace/plugins/:id/dependencies/:depId
  // =========================================================================
  describe('DELETE /api/v1/marketplace/plugins/:id/dependencies/:depId', () => {
    it('should remove a dependency', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'dep-uuid' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependencies/dep-uuid`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('removed');
    });

    it('should return 404 when dependency not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependencies/nonexistent`)
        .set('Authorization', `Bearer ${createSuperuserToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // GET /api/v1/marketplace/plugins/:id/dependents
  // =========================================================================
  describe('GET /api/v1/marketplace/plugins/:id/dependents', () => {
    it('should return plugins that depend on this plugin', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            dependency_id: 'dep-1',
            min_version: '1.0.0',
            max_version: null,
            is_optional: false,
            plugin_id: 'other-plugin',
            name: 'Consumer Plugin',
            slug: 'consumer-plugin',
            icon_url: null,
            status: 'published',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app).get(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependents`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('name', 'Consumer Plugin');
    });

    it('should return empty array when no dependents', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app).get(`/api/v1/marketplace/plugins/${PLUGIN_UUID}/dependents`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
