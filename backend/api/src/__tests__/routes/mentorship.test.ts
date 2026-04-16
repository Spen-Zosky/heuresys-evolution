/**
 * Mentorship Routes - Unit Tests
 * Tests HTTP behavior for mentorship programs, relationships, and sessions.
 *
 * Endpoints tested:
 *  GET    /programs             - List programs
 *  GET    /programs/:id         - Get program
 *  POST   /programs             - Create program (Zod)
 *  PATCH  /programs/:id         - Update program (Zod)
 *  GET    /mentorships          - List mentorships
 *  GET    /mentorships/:id      - Get mentorship + sessions
 *  POST   /mentorships          - Create mentorship (Zod)
 *  PATCH  /mentorships/:id      - Update mentorship (Zod)
 *  GET    /sessions             - List sessions
 *  POST   /sessions             - Create session (Zod)
 *  PATCH  /sessions/:id         - Update session (Zod)
 *  GET    /mentors/available    - Available mentors
 *  GET    /my                   - My mentorships
 *  GET    /stats                - Statistics
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
const { default: routes } = await import('../../routes/mentorship.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const UUID_1 = '11111111-1111-4111-a111-111111111111';
const UUID_2 = '22222222-2222-4222-a222-222222222222';
const UUID_3 = '33333333-3333-4333-a333-333333333333';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/mentorship', authMiddleware);
  app.use('/api/v1/mentorship', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/mentorship', routes);
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

describe('mentorship Routes', () => {
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
    const res = await supertest(app).get('/api/v1/mentorship/programs');
    expect(res.status).toBe(401);
  });

  // ── GET /programs ─────────────────────────────────────────────────────

  it('GET /programs returns 200 with program list', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'p-1', name: 'Leadership', active_pairs: '3' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/mentorship/programs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toHaveProperty('total');
  });

  // ── GET /programs/:id ─────────────────────────────────────────────────

  it('GET /programs/:id returns 200', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Leadership' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/mentorship/programs/p-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Leadership');
  });

  it('GET /programs/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .get('/api/v1/mentorship/programs/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // ── POST /programs ────────────────────────────────────────────────────

  it('POST /programs returns 400 on Zod validation (missing name)', async () => {
    const res = await supertest(app)
      .post('/api/v1/mentorship/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /programs returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p-1', name: 'Leadership', status: 'draft' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .post('/api/v1/mentorship/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Leadership', program_type: 'traditional' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Leadership');
  });

  // ── PATCH /programs/:id ───────────────────────────────────────────────

  it('PATCH /programs/:id returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .patch('/api/v1/mentorship/programs/p-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('PATCH /programs/:id returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Updated' }], rowCount: 1 });
    const res = await supertest(app)
      .patch('/api/v1/mentorship/programs/p-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Program updated');
  });

  // ── GET /mentorships ──────────────────────────────────────────────────

  it('GET /mentorships returns 200', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .get('/api/v1/mentorship/mentorships')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  // ── GET /mentorships/:id ──────────────────────────────────────────────

  it('GET /mentorships/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .get('/api/v1/mentorship/mentorships/m-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('GET /mentorships/:id returns 200 with sessions', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'm-1', mentor_name: 'Mario', mentee_name: 'Lucia' }],
      rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 's-1', session_date: '2026-01-15' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/mentorship/mentorships/m-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sessions).toHaveLength(1);
  });

  // ── POST /mentorships ─────────────────────────────────────────────────

  it('POST /mentorships returns 400 on Zod validation (missing program_id)', async () => {
    const res = await supertest(app)
      .post('/api/v1/mentorship/mentorships')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /mentorships returns 404 when program not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post('/api/v1/mentorship/mentorships')
      .set('Authorization', `Bearer ${token}`)
      .send({ program_id: UUID_1, mentor_id: UUID_2, mentee_id: UUID_3 });
    expect(res.status).toBe(404);
  });

  it('POST /mentorships returns 409 when duplicate', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID_1 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });
    const res = await supertest(app)
      .post('/api/v1/mentorship/mentorships')
      .set('Authorization', `Bearer ${token}`)
      .send({ program_id: UUID_1, mentor_id: UUID_2, mentee_id: UUID_3 });
    expect(res.status).toBe(409);
  });

  it('POST /mentorships returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID_1 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'm-1', status: 'pending' }], rowCount: 1 });
    const res = await supertest(app)
      .post('/api/v1/mentorship/mentorships')
      .set('Authorization', `Bearer ${token}`)
      .send({ program_id: UUID_1, mentor_id: UUID_2, mentee_id: UUID_3 });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  // ── POST /sessions ────────────────────────────────────────────────────

  it('POST /sessions returns 400 on Zod validation (missing mentorship_id)', async () => {
    const res = await supertest(app)
      .post('/api/v1/mentorship/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /sessions returns 404 when mentorship not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post('/api/v1/mentorship/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ mentorship_id: UUID_1, session_date: '2026-03-01' });
    expect(res.status).toBe(404);
  });

  it('POST /sessions returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID_1 }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1', status: 'scheduled' }], rowCount: 1 });
    const res = await supertest(app)
      .post('/api/v1/mentorship/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ mentorship_id: UUID_1, session_date: '2026-03-01' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('scheduled');
  });

  // ── PATCH /sessions/:id ───────────────────────────────────────────────

  it('PATCH /sessions/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .patch('/api/v1/mentorship/sessions/s-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(404);
  });

  // ── GET /my ───────────────────────────────────────────────────────────

  it('GET /my returns 400 when employee_id missing', async () => {
    const res = await supertest(app)
      .get('/api/v1/mentorship/my')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('GET /my returns 200 with mentorships', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'm-1', role: 'mentor' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .get(`/api/v1/mentorship/my?employee_id=${UUID_1}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('as_mentor');
    expect(res.body.data).toHaveProperty('as_mentee');
  });

  // ── GET /stats ────────────────────────────────────────────────────────

  it('GET /stats returns 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_programs: '2', active_programs: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ total_mentorships: '5', active_mentorships: '3' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ total_sessions: '10', completed_sessions: '8' }],
        rowCount: 1,
      });
    const res = await supertest(app)
      .get('/api/v1/mentorship/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('programs');
    expect(res.body.data).toHaveProperty('mentorships');
    expect(res.body.data).toHaveProperty('sessions');
  });

  // ── GET /mentors/available ────────────────────────────────────────────

  it('GET /mentors/available returns 200', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e-1', name: 'Mario Rossi' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/mentorship/mentors/available')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
