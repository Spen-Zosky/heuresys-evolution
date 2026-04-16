/**
 * Marketplace Reviews Routes - Unit Tests
 * Tests HTTP behavior for plugin review/rating endpoints.
 *
 * Endpoints tested:
 *  GET    /plugin/:pluginId  - Reviews for a plugin
 *  GET    /:id               - Single review
 *  POST   /                  - Create review (Zod validated)
 *  PUT    /:id               - Update review (Zod validated)
 *  DELETE /:id               - Soft-delete review
 *  POST   /:id/helpful       - Mark review helpful
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
const { default: routes } = await import('../../routes/marketplace-reviews.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const PLUGIN_ID = '11111111-1111-4111-a111-111111111111';
const USER_ID = '22222222-2222-4222-a222-222222222222';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/marketplace/reviews', authMiddleware);
  app.use('/api/v1/marketplace/reviews', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/marketplace/reviews', routes);
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

describe('marketplace-reviews Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/marketplace/reviews/plugin/abc');
    expect(res.status).toBe(401);
  });

  // ── GET /plugin/:pluginId ──────────────────────────────────────────────

  it('GET /plugin/:pluginId returns 200 with reviews and summary', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'r-1', rating: 5, title: 'Great' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            total_reviews: '1',
            avg_rating: '5.00',
            five_star: '1',
            four_star: '0',
            three_star: '0',
            two_star: '0',
            one_star: '0',
          },
        ],
        rowCount: 1,
      });
    const res = await supertest(app)
      .get(`/api/v1/marketplace/reviews/plugin/${PLUGIN_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.summary).toHaveProperty('avg_rating');
  });

  it('GET /plugin/:pluginId returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB fail'));
    const res = await supertest(app)
      .get(`/api/v1/marketplace/reviews/plugin/${PLUGIN_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  // ── GET /:id ──────────────────────────────────────────────────────────

  it('GET /:id returns 200 with review', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'r-1', rating: 4, plugin_name: 'Test' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/marketplace/reviews/r-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('r-1');
  });

  it('GET /:id returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .get('/api/v1/marketplace/reviews/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|REVIEW_NOT_FOUND/);
  });

  // ── POST / ────────────────────────────────────────────────────────────

  it('POST / returns 400 on Zod validation (missing required fields)', async () => {
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST / returns 400 on Zod validation (invalid rating)', async () => {
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/')
      .set('Authorization', `Bearer ${token}`)
      .send({ plugin_id: PLUGIN_ID, user_id: USER_ID, rating: 10 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST / returns 400 when plugin not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/')
      .set('Authorization', `Bearer ${token}`)
      .send({ plugin_id: PLUGIN_ID, user_id: USER_ID, rating: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toMatch(/ERR-API-1001|INVALID_PLUGIN/);
  });

  it('POST / returns 409 when duplicate review', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/')
      .set('Authorization', `Bearer ${token}`)
      .send({ plugin_id: PLUGIN_ID, user_id: USER_ID, rating: 4 });
    expect(res.status).toBe(409);
    expect(res.body.code).toMatch(/ERR-API-1009|DUPLICATE_REVIEW/);
  });

  it('POST / returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'r-1', rating: 5, is_verified_install: true }],
      rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/')
      .set('Authorization', `Bearer ${token}`)
      .send({ plugin_id: PLUGIN_ID, user_id: USER_ID, rating: 5, title: 'Great plugin' });
    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
  });

  // ── PUT /:id ──────────────────────────────────────────────────────────

  it('PUT /:id returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .put('/api/v1/marketplace/reviews/r-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3 });
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|REVIEW_NOT_FOUND/);
  });

  it('PUT /:id returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r-1', plugin_id: PLUGIN_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r-1', rating: 3 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await supertest(app)
      .put('/api/v1/marketplace/reviews/r-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(3);
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────

  it('DELETE /:id returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .delete('/api/v1/marketplace/reviews/r-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|REVIEW_NOT_FOUND/);
  });

  it('DELETE /:id returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r-1', plugin_id: PLUGIN_ID }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await supertest(app)
      .delete('/api/v1/marketplace/reviews/r-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Review deleted');
  });

  // ── POST /:id/helpful ────────────────────────────────────────────────

  it('POST /:id/helpful returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r-1', helpful_count: 1 }], rowCount: 1 });
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/r-1/helpful')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.helpful_count).toBe(1);
  });

  it('POST /:id/helpful returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post('/api/v1/marketplace/reviews/nonexistent/helpful')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|REVIEW_NOT_FOUND/);
  });
});
