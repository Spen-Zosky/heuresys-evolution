/**
 * Marketplace Runtime Routes - Unit Tests
 * Tests HTTP behavior for plugin runtime hooks, UI slots, and executions.
 *
 * Endpoints tested:
 *  GET    /hooks                          - List hooks
 *  GET    /hooks/:hookName                - Get hooks by name
 *  POST   /hooks/:hookName/execute        - Execute hook (Zod)
 *  GET    /ui-slots/:slotName             - Get UI slots
 *  GET    /executions                     - Recent executions
 *  POST   /plugins/:pluginId/hooks        - Register hook (Zod)
 *  POST   /plugins/:pluginId/ui-slots     - Register UI slot (Zod)
 *  DELETE /plugins/:pluginId/hooks/:hookId       - Remove hook
 *  DELETE /plugins/:pluginId/ui-slots/:slotId    - Remove UI slot
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

const mockExecuteHook = jest.fn();
const mockGetUISlots = jest.fn();

jest.unstable_mockModule(resolve('../../services/plugin-runtime.js'), () => ({
  executeHook: mockExecuteHook,
  getUISlots: mockGetUISlots,
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/marketplace-runtime.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const PLUGIN_ID = '11111111-1111-4111-a111-111111111111';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/marketplace/runtime', authMiddleware);
  app.use('/api/v1/marketplace/runtime', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/marketplace/runtime', routes);
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

describe('marketplace-runtime Routes', () => {
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
    const res = await supertest(app).get('/api/v1/marketplace/runtime/hooks');
    expect(res.status).toBe(401);
  });

  // ── GET /hooks ────────────────────────────────────────────────────────

  it('GET /hooks returns 200 with hooks list', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'h-1', hook_name: 'before.save' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/marketplace/runtime/hooks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /hooks returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await supertest(app)
      .get('/api/v1/marketplace/runtime/hooks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  // ── GET /hooks/:hookName ──────────────────────────────────────────────

  it('GET /hooks/:hookName returns 200', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'h-1', hook_name: 'before.save' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .get('/api/v1/marketplace/runtime/hooks/before.save')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── POST /hooks/:hookName/execute ─────────────────────────────────────

  it('POST /hooks/:hookName/execute returns 200 with results', async () => {
    mockExecuteHook.mockResolvedValueOnce([{ plugin: 'test', result: 'ok' }]);
    const res = await supertest(app)
      .post('/api/v1/marketplace/runtime/hooks/before.save/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: 'payload' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /hooks/:hookName/execute returns 500 on service error', async () => {
    mockExecuteHook.mockRejectedValueOnce(new Error('Hook failed'));
    const res = await supertest(app)
      .post('/api/v1/marketplace/runtime/hooks/before.save/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(500);
  });

  // ── GET /ui-slots/:slotName ───────────────────────────────────────────

  it('GET /ui-slots/:slotName returns 200', async () => {
    mockGetUISlots.mockResolvedValueOnce([{ id: 's-1', slot_name: 'header' }]);
    const res = await supertest(app)
      .get('/api/v1/marketplace/runtime/ui-slots/header')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /executions ───────────────────────────────────────────────────

  it('GET /executions returns 200 with execution list', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ex-1', status: 'success' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
    const res = await supertest(app)
      .get('/api/v1/marketplace/runtime/executions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toHaveProperty('total');
  });

  // ── POST /plugins/:pluginId/hooks ─────────────────────────────────────

  it('POST /plugins/:pluginId/hooks returns 400 on Zod validation (missing hook_name)', async () => {
    const res = await supertest(app)
      .post(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/hooks`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /plugins/:pluginId/hooks returns 404 when plugin not installed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/hooks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hook_name: 'before.save', handler_path: '/hooks/before-save.js' });
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|PLUGIN_NOT_INSTALLED/);
  });

  it('POST /plugins/:pluginId/hooks returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'h-1', hook_name: 'before.save' }],
      rowCount: 1,
    });
    const res = await supertest(app)
      .post(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/hooks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hook_name: 'before.save', handler_path: '/hooks/before-save.js' });
    expect(res.status).toBe(201);
    expect(res.body.data.hook_name).toBe('before.save');
  });

  // ── POST /plugins/:pluginId/ui-slots ──────────────────────────────────

  it('POST /plugins/:pluginId/ui-slots returns 400 on Zod validation (missing slot_name)', async () => {
    const res = await supertest(app)
      .post(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/ui-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /plugins/:pluginId/ui-slots returns 404 when plugin not installed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .post(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/ui-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slot_name: 'header', component_path: '/components/Header.tsx' });
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|PLUGIN_NOT_INSTALLED/);
  });

  it('POST /plugins/:pluginId/ui-slots returns 201 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1', slot_name: 'header' }], rowCount: 1 });
    const res = await supertest(app)
      .post(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/ui-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slot_name: 'header', component_path: '/components/Header.tsx' });
    expect(res.status).toBe(201);
    expect(res.body.data.slot_name).toBe('header');
  });

  // ── DELETE /plugins/:pluginId/hooks/:hookId ───────────────────────────

  it('DELETE /plugins/:pluginId/hooks/:hookId returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h-1' }], rowCount: 1 });
    const res = await supertest(app)
      .delete(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/hooks/h-1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Hook removed');
  });

  it('DELETE /plugins/:pluginId/hooks/:hookId returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .delete(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/hooks/nonexistent`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|HOOK_NOT_FOUND/);
  });

  // ── DELETE /plugins/:pluginId/ui-slots/:slotId ────────────────────────

  it('DELETE /plugins/:pluginId/ui-slots/:slotId returns 200 on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1' }], rowCount: 1 });
    const res = await supertest(app)
      .delete(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/ui-slots/s-1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('UI slot removed');
  });

  it('DELETE /plugins/:pluginId/ui-slots/:slotId returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app)
      .delete(`/api/v1/marketplace/runtime/plugins/${PLUGIN_ID}/ui-slots/nonexistent`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toMatch(/ERR-API-1005|SLOT_NOT_FOUND/);
  });
});
