/**
 * Engagement Routes - Unit Tests
 *
 * Tests:
 *   GET  /engagement/stats           - Dashboard stats
 *   GET  /engagement/templates       - List templates
 *   GET  /engagement/templates/:id   - Get template
 *   POST /engagement/templates       - Create template
 *   PUT  /engagement/templates/:id   - Update template
 *   DELETE /engagement/templates/:id - Delete template
 *   GET  /engagement/surveys         - List surveys
 *   GET  /engagement/surveys/:id     - Get survey
 *   POST /engagement/surveys         - Create survey
 *   POST /engagement/feedback        - Submit feedback
 *   GET  /engagement/feedback        - List feedback
 *   GET  /engagement/pulse           - List pulse configs
 *   GET  /engagement/analytics       - Get analytics
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
const { default: routes } = await import('../../routes/engagement.js');
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
  app.use('/api/v1/engagement', authMiddleware);
  app.use('/api/v1/engagement', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockClientQuery, release: mockClientRelease } as never;
    next();
  });
  app.use('/api/v1/engagement', routes);
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

describe('Engagement Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/engagement/stats');
    expect(res.status).toBe(401);
  });

  // GET /stats
  it('GET /stats should return dashboard statistics', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [
        {
          total_surveys: '10',
          active_surveys: '3',
          draft_surveys: '2',
          total_invitations: '500',
          total_responses: '300',
        },
      ],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ total_feedback: '20', new_feedback: '5' }],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ response_rate: '60', enps_score: 42 }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/engagement/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.surveys.total).toBe(10);
    expect(res.body.data.feedback.total).toBe(20);
  });

  it('GET /stats should return 500 on DB error', async () => {
    mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await supertest(app)
      .get('/api/v1/engagement/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  // GET /templates
  it('GET /templates should return template list', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 't1', name: 'Employee Satisfaction', questions_count: 10 }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/engagement/templates')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // GET /templates/:id
  it('GET /templates/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/engagement/templates/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('GET /templates/:id should return template', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 't1', name: 'Employee Satisfaction', questions: [] }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/engagement/templates/t1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('t1');
  });

  // POST /templates (Zod)
  it('POST /templates should create template', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 't-new' }], rowCount: 1 });

    const res = await supertest(app)
      .post('/api/v1/engagement/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Template',
        questions: [{ text: 'How satisfied are you?', type: 'scale_5' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('t-new');
  });

  // PUT /templates/:id
  it('PUT /templates/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .put('/api/v1/engagement/templates/nonexistent')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('PUT /templates/:id should return 403 for system template', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [{ is_system: true }], rowCount: 1 });

    const res = await supertest(app)
      .put('/api/v1/engagement/templates/t1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  // GET /surveys
  it('GET /surveys should return paginated surveys', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 's1', title: 'Q1 Survey' }],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '5' }], rowCount: 1 });

    const res = await supertest(app)
      .get('/api/v1/engagement/surveys')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
  });

  // GET /surveys/:id
  it('GET /surveys/:id should return 404 when not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/engagement/surveys/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // POST /feedback
  it('POST /feedback should submit anonymous feedback', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .post('/api/v1/engagement/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Great work environment', category: 'general' });
    expect(res.status).toBe(201);
    expect(res.body.data.received).toBe(true);
  });

  it('POST /feedback should return 400 when message is empty', async () => {
    const res = await supertest(app)
      .post('/api/v1/engagement/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });
    expect(res.status).toBe(400);
  });

  // GET /feedback
  it('GET /feedback should return feedback list', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'f1', category: 'general', message: 'Good job' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/engagement/feedback')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // GET /pulse
  it('GET /pulse should return pulse configs', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', name: 'Weekly Check-in' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/engagement/pulse')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // GET /analytics
  it('GET /analytics should return analytics data', async () => {
    mockClientQuery.mockResolvedValueOnce({
      rows: [{ response_rate: 65, enps_score: 35 }],
      rowCount: 1,
    });
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // trend
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dept

    const res = await supertest(app)
      .get('/api/v1/engagement/analytics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('trend');
  });

  it('GET /analytics should return 500 on DB error', async () => {
    mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await supertest(app)
      .get('/api/v1/engagement/analytics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });
});
