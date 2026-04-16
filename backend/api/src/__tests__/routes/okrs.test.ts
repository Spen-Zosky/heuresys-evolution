/**
 * OKRs Routes - Unit Tests
 * Tests HTTP behavior for OKR (Objectives and Key Results) endpoints.
 *
 * Endpoints tested:
 *  GET    /stats              - OKR statistics
 *  GET    /                   - List OKRs
 *  GET    /current            - Current OKRs
 *  GET    /by-period          - OKRs by period
 *  GET    /:id                - Get OKR
 *  POST   /                   - Create OKR (Zod)
 *  PATCH  /:id                - Update OKR (Zod)
 *  PATCH  /:id/progress       - Update progress (Zod)
 *  DELETE /:id                - Delete OKR
 *  GET    /:id/key-results    - List key results
 *  POST   /:id/key-results    - Create key result (Zod)
 *  GET    /:id/checkins       - List check-ins
 *  GET    /:id/progress-history - Progress history
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

const mockGetOKRWithKeyResults = jest.fn();
const mockCreateKeyResult = jest.fn();
const mockUpdateKeyResultProgress = jest.fn();
const mockCreateOKRCheckin = jest.fn();

jest.unstable_mockModule(resolve('../../services/performance-management.js'), () => ({
  performanceManagementService: {
    getOKRWithKeyResults: mockGetOKRWithKeyResults,
    createKeyResult: mockCreateKeyResult,
    updateKeyResultProgress: mockUpdateKeyResultProgress,
    createOKRCheckin: mockCreateOKRCheckin,
  },
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/okrs.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const UUID_1 = '11111111-1111-4111-a111-111111111111';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/okrs', authMiddleware);
  app.use('/api/v1/okrs', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/okrs', routes);
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

describe('okrs Routes', () => {
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
    const res = await supertest(app).get('/api/v1/okrs/');
    expect(res.status).toBe(401);
  });

  // ── GET /stats ────────────────────────────────────────────────────────

  it('GET /stats returns 200 with OKR statistics', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          total: '10',
          draft: '2',
          active: '5',
          completed: '3',
          avg_progress: '65.50',
          avg_confidence: '70.00',
        },
      ],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/okrs/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('avg_progress');
  });

  // ── GET / ─────────────────────────────────────────────────────────────

  it('GET / returns 200 with OKR list', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'okr-1', objective: 'Increase revenue' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
    const res = await supertest(app).get('/api/v1/okrs/').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toHaveProperty('total');
  });

  // ── GET /current ──────────────────────────────────────────────────────

  it('GET /current returns 200 with active OKRs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'okr-1', status: 'active' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/okrs/current')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /by-period ────────────────────────────────────────────────────

  it('GET /by-period returns 200', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ period_type: 'quarterly', year: '2026', quarter: '1', total_okrs: '5' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/okrs/by-period')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /:id ──────────────────────────────────────────────────────────

  it('GET /:id returns 200', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'okr-1', objective: 'Increase revenue' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/okrs/okr-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.objective).toBe('Increase revenue');
  });

  it('GET /:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .get('/api/v1/okrs/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // ── POST / ────────────────────────────────────────────────────────────

  it('POST / returns 400 on Zod validation (missing objective)', async () => {
    const res = await supertest(app)
      .post('/api/v1/okrs/')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST / returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'okr-1', objective: 'Increase revenue', status: 'draft' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .post('/api/v1/okrs/')
      .set('Authorization', `Bearer ${token}`)
      .send({ objective: 'Increase revenue' });
    expect(res.status).toBe(201);
    expect(res.body.data.objective).toBe('Increase revenue');
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────

  it('PATCH /:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .patch('/api/v1/okrs/okr-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ objective: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'okr-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'okr-1', objective: 'Updated' }], rowCount: 1 });
    const res = await supertest(app)
      .patch('/api/v1/okrs/okr-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ objective: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('OKR updated');
  });

  // ── PATCH /:id/progress ───────────────────────────────────────────────

  it('PATCH /:id/progress returns 200', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'okr-1', overall_progress: 75, confidence_level: 80 }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .patch('/api/v1/okrs/okr-1/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ overall_progress: 75, confidence_level: 80 });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Progress updated');
  });

  it('PATCH /:id/progress returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .patch('/api/v1/okrs/nonexistent/progress')
      .set('Authorization', `Bearer ${token}`)
      .send({ overall_progress: 50 });
    expect(res.status).toBe(404);
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────

  it('DELETE /:id returns 200', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'okr-1' }], rowCount: 1 });
    const res = await supertest(app)
      .delete('/api/v1/okrs/okr-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('OKR deleted');
  });

  it('DELETE /:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .delete('/api/v1/okrs/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // ── GET /:id/key-results ──────────────────────────────────────────────

  it('GET /:id/key-results returns 200', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kr-1', title: 'Reach 1M ARR' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/okrs/okr-1/key-results')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── POST /:id/key-results ─────────────────────────────────────────────

  it('POST /:id/key-results returns 400 on Zod validation (missing title)', async () => {
    const res = await supertest(app)
      .post('/api/v1/okrs/okr-1/key-results')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /:id/key-results returns 404 when OKR not found', async () => {
    // OKR check
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post('/api/v1/okrs/nonexistent/key-results')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Reach 1M', target_value: 1000000 });
    expect(res.status).toBe(404);
  });

  it('POST /:id/key-results returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'okr-1' }], rowCount: 1 });
    mockCreateKeyResult.mockResolvedValueOnce({
      id: 'kr-1',
      title: 'Reach 1M',
      target_value: 1000000,
    });
    const res = await supertest(app)
      .post('/api/v1/okrs/okr-1/key-results')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Reach 1M', target_value: 1000000 });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Reach 1M');
  });

  // ── GET /:id/checkins ─────────────────────────────────────────────────

  it('GET /:id/checkins returns 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ci-1', progress_snapshot: 50 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/okrs/okr-1/checkins')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toHaveProperty('total');
  });

  // ── GET /:id/progress-history ─────────────────────────────────────────

  it('GET /:id/progress-history returns 200', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ date: '2026-01-15', avg_progress: '50.00' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/okrs/okr-1/progress-history')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /stats returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await supertest(app)
      .get('/api/v1/okrs/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });
});
