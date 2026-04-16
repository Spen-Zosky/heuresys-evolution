/**
 * Feedback Routes - Unit Tests
 *
 * Tests:
 *   GET    /feedback                          - All feedback combined
 *   GET    /feedback/continuous               - List continuous feedback
 *   GET    /feedback/continuous/:id           - Get feedback by ID
 *   POST   /feedback/continuous               - Create continuous feedback (Zod)
 *   DELETE /feedback/continuous/:id           - Delete feedback
 *   GET    /feedback/wall                     - Public praise wall
 *   GET    /feedback/received/:employeeId     - Received feedback
 *   GET    /feedback/given/:employeeId        - Given feedback
 *   GET    /feedback/categories               - Feedback categories
 *   POST   /feedback/continuous/acknowledge/:id - Acknowledge feedback
 *   POST   /feedback/continuous/quick         - Quick feedback (Zod)
 *   GET    /feedback/360                      - List 360 feedback
 *   GET    /feedback/360/:id                  - Get 360 feedback
 *   POST   /feedback/360                      - Create 360 feedback (Zod)
 *   PATCH  /feedback/360/:id                  - Update 360 feedback
 *   DELETE /feedback/360/:id                  - Delete 360 feedback
 *   GET    /feedback/360-questionnaires       - List questionnaires
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
const { default: routes } = await import('../../routes/feedback.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const EMPLOYEE_ID_2 = '22222222-3333-4444-a555-666666666666';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/feedback', authMiddleware);
  app.use('/api/v1/feedback', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockClientQuery, release: mockClientRelease } as never;
    next();
  });
  app.use('/api/v1/feedback', routes);
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

describe('Feedback Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.resetAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/feedback');
    expect(res.status).toBe(401);
  });

  // GET / (combined feedback)
  it('GET / should return combined feedback', async () => {
    // continuous query
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf1', type: 'continuous', feedback_type: 'praise' }],
      rowCount: 1,
    });
    // 360 query
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'f360-1', type: '360', relationship_type: 'peer' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.continuous).toHaveLength(1);
    expect(res.body.data.feedback_360).toHaveLength(1);
    expect(res.body.data.total).toBe(2);
  });

  it('GET / should return 500 on DB error', async () => {
    mockClientQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await supertest(app)
      .get('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  // GET /continuous
  it('GET /continuous should return continuous feedback list', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [
        { id: 'cf1', feedback_type: 'praise', from_name: 'Mario Rossi', to_name: 'Luigi Bianchi' },
      ],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });

    const res = await supertest(app)
      .get('/api/v1/feedback/continuous')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(10);
  });

  // GET /continuous/:id
  it('GET /continuous/:id should return feedback detail', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf1', feedback_type: 'praise', message: 'Great work!' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/feedback/continuous/cf1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Great work!');
  });

  it('GET /continuous/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/feedback/continuous/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // POST /continuous (Zod: from_employee_id UUID, to_employee_id UUID, message required)
  it('POST /continuous should return 400 when missing required fields', async () => {
    const res = await supertest(app)
      .post('/api/v1/feedback/continuous')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /continuous should create feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf-new', feedback_type: 'praise', message: 'Well done!' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .post('/api/v1/feedback/continuous')
      .set('Authorization', `Bearer ${token}`)
      .send({
        from_employee_id: EMPLOYEE_ID,
        to_employee_id: EMPLOYEE_ID_2,
        message: 'Well done!',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('cf-new');
  });

  // DELETE /continuous/:id
  it('DELETE /continuous/:id should delete feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'cf1' }], rowCount: 1 });

    const res = await supertest(app)
      .delete('/api/v1/feedback/continuous/cf1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /continuous/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .delete('/api/v1/feedback/continuous/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // GET /wall
  it('GET /wall should return praise wall', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'w1', feedback_type: 'praise', from_name: 'Mario' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/feedback/wall')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // GET /received/:employeeId
  it('GET /received/:employeeId should return received feedback with summary', async () => {
    // feedback query
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf1', from_name: 'Mario', feedback_type: 'praise' }],
      rowCount: 1,
    });
    // summary query
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_received: '15', praise_count: '10' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get(`/api/v1/feedback/received/${EMPLOYEE_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.summary).toBeDefined();
  });

  // GET /given/:employeeId
  it('GET /given/:employeeId should return given feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf1', to_name: 'Luigi', feedback_type: 'suggestion' }],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_given: '8' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get(`/api/v1/feedback/given/${EMPLOYEE_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // GET /categories
  it('GET /categories should return feedback categories', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cat1', name: 'Teamwork', icon: 'users', is_active: true }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/feedback/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // POST /continuous/acknowledge/:id
  it('POST /continuous/acknowledge/:id should acknowledge feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf1', acknowledged: true, acknowledged_at: '2025-01-01' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .post('/api/v1/feedback/continuous/acknowledge/cf1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.acknowledged).toBe(true);
  });

  it('POST /continuous/acknowledge/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .post('/api/v1/feedback/continuous/acknowledge/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // POST /continuous/quick (Zod: from_employee_id UUID, to_employee_id UUID, message required)
  it('POST /continuous/quick should return 400 when missing fields', async () => {
    const res = await supertest(app)
      .post('/api/v1/feedback/continuous/quick')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /continuous/quick should create quick feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'cf-quick', feedback_type: 'praise', visibility: 'public' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .post('/api/v1/feedback/continuous/quick')
      .set('Authorization', `Bearer ${token}`)
      .send({
        from_employee_id: EMPLOYEE_ID,
        to_employee_id: EMPLOYEE_ID_2,
        message: 'Amazing work!',
        visibility: 'public',
      });
    expect(res.status).toBe(201);
  });

  // GET /360
  it('GET /360 should return 360 feedback list', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'f1', target_name: 'Mario', reviewer_name: 'Luigi', overall_rating: 4 }],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });

    const res = await supertest(app)
      .get('/api/v1/feedback/360')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(5);
  });

  // GET /360/:id
  it('GET /360/:id should return 360 feedback detail', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'f1', target_name: 'Mario', overall_rating: 4, strengths: 'Leadership' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/feedback/360/f1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.overall_rating).toBe(4);
  });

  it('GET /360/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/feedback/360/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // POST /360 (Zod: target_employee_id UUID, reviewer_employee_id UUID required)
  it('POST /360 should return 400 when missing required fields', async () => {
    const res = await supertest(app)
      .post('/api/v1/feedback/360')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /360 should create 360 feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'f-new', target_employee_id: EMPLOYEE_ID, status: 'pending' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .post('/api/v1/feedback/360')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_employee_id: EMPLOYEE_ID, reviewer_employee_id: EMPLOYEE_ID_2 });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('f-new');
  });

  // PATCH /360/:id
  it('PATCH /360/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .patch('/api/v1/feedback/360/nonexistent')
      .set('Authorization', `Bearer ${token}`)
      .send({ overall_rating: 5 });
    expect(res.status).toBe(404);
  });

  it('PATCH /360/:id should update 360 feedback', async () => {
    // exists check
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'f1' }], rowCount: 1 });
    // update
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'f1', overall_rating: 5, status: 'completed' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .patch('/api/v1/feedback/360/f1')
      .set('Authorization', `Bearer ${token}`)
      .send({ overall_rating: 5, status: 'completed' });
    expect(res.status).toBe(200);
  });

  // DELETE /360/:id
  it('DELETE /360/:id should delete 360 feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'f1' }], rowCount: 1 });

    const res = await supertest(app)
      .delete('/api/v1/feedback/360/f1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /360/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .delete('/api/v1/feedback/360/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // GET /360-questionnaires
  it('GET /360-questionnaires should return questionnaire list', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'q1', name: 'Default Questionnaire', question_count: '10' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/feedback/360-questionnaires')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
