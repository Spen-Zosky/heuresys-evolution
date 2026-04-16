/**
 * news Routes - Comprehensive Behavioral Tests
 * Tests for: GET /categories, GET /articles, GET /articles/:id, POST /articles,
 *   PUT /articles/:id, DELETE /articles/:id, POST /articles/:id/reactions,
 *   GET /articles/:id/comments, POST /articles/:id/comments,
 *   POST /articles/:id/bookmark, POST /articles/:id/acknowledge,
 *   GET /bookmarks, GET /unread-count, GET /analytics
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
const { default: routes } = await import('../../routes/news.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const { createErrorMiddleware } = await import('../../errors/middleware.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const USER_ID = DEFAULT_IDS.USER_ID;
const ARTICLE_ID = '11111111-2222-3333-4444-555555555555';

/**
 * The route's getUserId helper does: (req as any).user?.id
 * The auth middleware sets req.user = JWTPayload which has `userId` not `id`.
 * So getUserId returns null unless we explicitly set req.user.id.
 * We inject it in the tenant middleware to simulate realistic behavior.
 */
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/news', authMiddleware);
  app.use('/api/v1/news', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    // The route uses (req as any).user?.id — set it so getUserId returns a value
    if ((req as any).user) {
      (req as any).user.id = (req as any).user.userId || USER_ID;
    }
    next();
  });
  app.use('/api/v1/news', routes);
  app.use(createErrorMiddleware({ enableConsoleLogging: false }));
  return app;
}

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('news Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
  });

  // =========================================================================
  // AUTH ENFORCEMENT
  // =========================================================================

  describe('Auth enforcement', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await supertest(app).get('/api/v1/news/categories');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await supertest(app)
        .get('/api/v1/news/categories')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /categories
  // =========================================================================

  describe('GET /categories', () => {
    it('should return list of categories', async () => {
      const categories = [
        {
          id: 'cat-1',
          name: 'Company Updates',
          slug: 'company-updates',
          description: null,
          icon: null,
          color: '#3B82F6',
          parent_id: null,
          sort_order: 1,
        },
        {
          id: 'cat-2',
          name: 'HR News',
          slug: 'hr-news',
          description: 'HR related news',
          icon: 'users',
          color: '#10B981',
          parent_id: null,
          sort_order: 2,
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: categories, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/news/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Company Updates');
      expect(res.body.data[1].slug).toBe('hr-news');
    });

    it('should return empty array when no categories exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/news/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await supertest(app)
        .get('/api/v1/news/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /articles
  // =========================================================================

  describe('GET /articles', () => {
    it('should return paginated articles', async () => {
      // First query: count
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 });
      // Second query: articles
      const articles = [
        {
          id: 'a1',
          title: 'First Article',
          slug: 'first-article',
          excerpt: 'Excerpt 1',
          is_featured: false,
          is_pinned: true,
          published_at: '2025-01-15',
          views_count: 42,
          reactions_count: '5',
          comments_count: '3',
          is_read: false,
          is_bookmarked: false,
        },
        {
          id: 'a2',
          title: 'Second Article',
          slug: 'second-article',
          excerpt: 'Excerpt 2',
          is_featured: true,
          is_pinned: false,
          published_at: '2025-01-14',
          views_count: 28,
          reactions_count: '2',
          comments_count: '1',
          is_read: true,
          is_bookmarked: true,
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: articles, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.articles).toHaveLength(2);
      expect(res.body.data.meta.offset).toBe(0);
      expect(res.body.data.meta.limit).toBe(10);
      expect(res.body.data.meta.total).toBe(2);
    });

    it('should accept page and limit query params', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '25' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'a1', title: 'Page 2 Article' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .get('/api/v1/news/articles?page=2&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.offset).toBe(5);
      expect(res.body.data.meta.limit).toBe(5);
      expect(res.body.data.meta.total).toBe(25);
    });

    it('should cap limit at 50', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '100' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/news/articles?limit=999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(50);
    });

    it('should filter by category slug', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a1', title: 'HR Article' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/news/articles?category=hr-news')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should filter by featured=true', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a1', is_featured: true }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/news/articles?featured=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return empty articles with zero pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.articles).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /articles/:id
  // =========================================================================

  describe('GET /articles/:id', () => {
    it('should return article by UUID', async () => {
      const article = {
        id: ARTICLE_ID,
        title: 'Test Article',
        slug: 'test-article',
        content: 'Full content here',
        status: 'published',
        category: { id: 'cat-1', name: 'News', slug: 'news', color: '#3B82F6' },
        author: { id: USER_ID, name: 'Mario Rossi', job_title: 'HR Manager' },
        reactions: {},
        my_reaction: null,
        is_bookmarked: false,
      };
      // Main query (uses a.id = $2 for UUID)
      mockQuery.mockResolvedValueOnce({ rows: [article], rowCount: 1 });
      // Tags query
      mockQuery.mockResolvedValueOnce({ rows: [{ name: 'hr', slug: 'hr' }], rowCount: 1 });
      // Mark as read (INSERT)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Article');
      expect(res.body.data.tags).toHaveLength(1);
      expect(res.body.data.tags[0].name).toBe('hr');
    });

    it('should return article by slug', async () => {
      const article = { id: ARTICLE_ID, title: 'Test Article', slug: 'test-article-slug' };
      // Main query (uses a.slug = $2)
      mockQuery.mockResolvedValueOnce({ rows: [article], rowCount: 1 });
      // Tags query
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Mark as read (userId is set in middleware)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/news/articles/test-article-slug')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('test-article-slug');
    });

    it('should return 404 when article not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const res = await supertest(app)
        .get(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /articles
  // =========================================================================

  describe('POST /articles', () => {
    it('should create article with valid data', async () => {
      const newArticle = {
        id: ARTICLE_ID,
        title: 'New Announcement',
        slug: 'new-announcement-abc123',
        content: 'This is the announcement content',
        status: 'draft',
      };
      mockQuery.mockResolvedValueOnce({ rows: [newArticle], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Announcement', content: 'This is the announcement content' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Announcement');
    });

    it('should create article with tags', async () => {
      const newArticle = { id: ARTICLE_ID, title: 'Tagged Article', status: 'draft' };
      // INSERT article
      mockQuery.mockResolvedValueOnce({ rows: [newArticle], rowCount: 1 });
      // Upsert first tag
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tag-1' }], rowCount: 1 });
      // Link first tag
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // Upsert second tag
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tag-2' }], rowCount: 1 });
      // Link second tag
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Tagged Article', content: 'Content with tags', tags: ['hr', 'policy'] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // article INSERT + (tag upsert + link) x 2 = 5
      expect(mockQuery).toHaveBeenCalledTimes(5);
    });

    it('should create published article with published_at set', async () => {
      const newArticle = { id: ARTICLE_ID, title: 'Published Now', status: 'published' };
      mockQuery.mockResolvedValueOnce({ rows: [newArticle], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Published Now', content: 'Content', status: 'published' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when title is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Content without title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when content is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Title without content' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 500 on database error during creation', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await supertest(app)
        .post('/api/v1/news/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Error Article', content: 'Content' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // PUT /articles/:id
  // =========================================================================

  describe('PUT /articles/:id', () => {
    it('should update article fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .put(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should set published_at when publishing for first time', async () => {
      // SELECT existing published_at (null = first publish)
      mockQuery.mockResolvedValueOnce({ rows: [{ published_at: null }], rowCount: 1 });
      // UPDATE
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .put(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should not reset published_at on re-publish', async () => {
      // SELECT existing published_at (already set)
      mockQuery.mockResolvedValueOnce({
        rows: [{ published_at: '2025-01-01T00:00:00Z' }],
        rowCount: 1,
      });
      // UPDATE (publishedAt remains null in update)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .put(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      const res = await supertest(app)
        .put(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Fail' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // DELETE /articles/:id
  // =========================================================================

  describe('DELETE /articles/:id', () => {
    it('should delete article permanently', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const callArgs = mockQuery.mock.calls[0] as string[];
      expect(callArgs[0]).toContain('DELETE FROM news_articles');
    });

    it('should archive article when archive=true', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/news/articles/${ARTICLE_ID}?archive=true`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const callArgs = mockQuery.mock.calls[0] as string[];
      expect(callArgs[0]).toContain('archived');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await supertest(app)
        .delete(`/api/v1/news/articles/${ARTICLE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /articles/:id/reactions
  // =========================================================================

  describe('POST /articles/:id/reactions', () => {
    it('should add a reaction', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/reactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const callArgs = mockQuery.mock.calls[0] as string[];
      expect(callArgs[0]).toContain('INSERT INTO news_reactions');
    });

    it('should remove reaction when type is null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/reactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: null });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const callArgs = mockQuery.mock.calls[0] as string[];
      expect(callArgs[0]).toContain('DELETE FROM news_reactions');
    });

    it('should accept empty body (remove reaction via empty type)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/reactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // GET /articles/:id/comments
  // =========================================================================

  describe('GET /articles/:id/comments', () => {
    it('should return comments for an article', async () => {
      const comments = [
        {
          id: 'c1',
          content: 'Great article!',
          parent_id: null,
          created_at: '2025-01-15T10:00:00Z',
          author: { id: USER_ID, name: 'Mario Rossi', job_title: 'HR Manager' },
        },
        {
          id: 'c2',
          content: 'I agree',
          parent_id: 'c1',
          created_at: '2025-01-15T10:05:00Z',
          author: { id: 'u2', name: 'Lucia Bianchi', job_title: 'Analyst' },
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: comments, rowCount: 2 });

      const res = await supertest(app)
        .get(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].content).toBe('Great article!');
      expect(res.body.data[1].parent_id).toBe('c1');
    });

    it('should return empty array when no comments', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /articles/:id/comments
  // =========================================================================

  describe('POST /articles/:id/comments', () => {
    it('should create a comment', async () => {
      const newComment = {
        id: 'c1',
        content: 'New comment',
        parent_id: null,
        created_at: '2025-01-15T10:00:00Z',
      };
      mockQuery.mockResolvedValueOnce({ rows: [newComment], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'New comment' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('New comment');
    });

    it('should create a reply to existing comment', async () => {
      const parentId = '11111111-2222-3333-4444-666666666666';
      const reply = {
        id: 'c2',
        content: 'Reply comment',
        parent_id: parentId,
        created_at: '2025-01-15T10:05:00Z',
      };
      mockQuery.mockResolvedValueOnce({ rows: [reply], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Reply comment', parent_id: parentId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.parent_id).toBe(parentId);
    });

    it('should return 400 when content is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'This will fail' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /articles/:id/bookmark
  // =========================================================================

  describe('POST /articles/:id/bookmark', () => {
    it('should add bookmark when not already bookmarked', async () => {
      // Check existing: none found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // INSERT bookmark
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/bookmark`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bookmarked).toBe(true);
    });

    it('should remove bookmark when already bookmarked (toggle)', async () => {
      // Check existing: found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'bm-1' }], rowCount: 1 });
      // DELETE bookmark
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/bookmark`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bookmarked).toBe(false);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/bookmark`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /articles/:id/acknowledge
  // =========================================================================

  describe('POST /articles/:id/acknowledge', () => {
    it('should acknowledge article', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .post(`/api/v1/news/articles/${ARTICLE_ID}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /bookmarks
  // =========================================================================

  describe('GET /bookmarks', () => {
    it('should return bookmarked articles', async () => {
      const bookmarks = [
        {
          id: 'a1',
          title: 'Bookmarked Article',
          slug: 'bookmarked-article',
          excerpt: 'Excerpt',
          published_at: '2025-01-15',
          category: { id: 'cat-1', name: 'News', slug: 'news' },
          bookmarked_at: '2025-01-16',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: bookmarks, rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/news/bookmarks')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Bookmarked Article');
    });

    it('should return empty array when no bookmarks', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/news/bookmarks')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  // =========================================================================
  // GET /unread-count
  // =========================================================================

  describe('GET /unread-count', () => {
    it('should return unread article count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/news/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(7);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      const res = await supertest(app)
        .get('/api/v1/news/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /analytics
  // =========================================================================

  describe('GET /analytics', () => {
    it('should return analytics data', async () => {
      // Stats query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total_articles: '15',
            total_views: '1200',
            total_reactions: '89',
            total_comments: '42',
          },
        ],
        rowCount: 1,
      });
      // Top articles query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'a1', title: 'Popular Article', views_count: 500, published_at: '2025-01-10' },
          { id: 'a2', title: 'Another Popular', views_count: 350, published_at: '2025-01-08' },
        ],
        rowCount: 2,
      });
      // Views by category query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { category: 'Company Updates', views: '600' },
          { category: 'HR News', views: '400' },
        ],
        rowCount: 2,
      });

      const res = await supertest(app)
        .get('/api/v1/news/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_articles).toBe('15');
      expect(res.body.data.total_views).toBe('1200');
      expect(res.body.data.top_articles).toHaveLength(2);
      expect(res.body.data.views_by_category).toHaveLength(2);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Analytics query failed'));

      const res = await supertest(app)
        .get('/api/v1/news/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
