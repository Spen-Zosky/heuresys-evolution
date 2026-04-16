/**
 * Marketplace Hooks Routes - Behavioral Tests
 * Tests plugin hook registration, UI slots, and hook executions.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSuperuserTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest
    .fn()
    .mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockQuery },
    appPool: { connect: mockConnect },
    testConnection: jest.fn().mockResolvedValue(true),
    testAppConnection: jest.fn().mockResolvedValue(true),
    closePool: jest.fn().mockResolvedValue(undefined),
    getAppClient: jest.fn(),
    withTenantClient: jest.fn(),
}));
jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
    getRedis: jest.fn(),
    isRedisReady: jest.fn().mockReturnValue(false),
    blacklistToken: jest.fn().mockResolvedValue(true),
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    closeRedis: jest.fn().mockResolvedValue(undefined),
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
const { default: routeHandler } = await import('../../routes/marketplace-hooks.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const PLUGIN_ID = DEFAULT_IDS.EMPLOYEE_ID;
const HOOK_ID = DEFAULT_IDS.GOAL_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/marketplace/hooks', authMiddleware);
    app.use('/api/v1/marketplace/hooks', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/marketplace/hooks', routeHandler);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
function sysadminToken() {
    return generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_ID }));
}
describe('Marketplace Hooks Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = sysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // ===========================================================================
    // HOOKS CRUD
    // ===========================================================================
    describe('GET / (list hooks)', () => {
        it('should return 200 with hooks list', async () => {
            const hooks = [
                {
                    id: HOOK_ID,
                    plugin_id: PLUGIN_ID,
                    hook_name: 'onEmployeeCreate',
                    plugin_name: 'HR Plugin',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: hooks, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/hooks')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].hook_name).toBe('onEmployeeCreate');
        });
        it('should filter by plugin_id, hook_name, enabled', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/marketplace/hooks?plugin_id=${PLUGIN_ID}&hook_name=onSave&enabled=true`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET /:id', () => {
        it('should return 200 with hook details', async () => {
            const hook = { id: HOOK_ID, hook_name: 'onEmployeeCreate', handler_path: '/hooks/create' };
            mockQuery.mockResolvedValueOnce({ rows: [hook], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/marketplace/hooks/${HOOK_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.hook_name).toBe('onEmployeeCreate');
        });
        it('should return 404 when hook not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/hooks/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.code).toMatch(/ERR-API-1005|HOOK_NOT_FOUND/);
        });
    });
    describe('POST / (create hook)', () => {
        it('should return 201 when creating a hook', async () => {
            const created = {
                id: HOOK_ID,
                plugin_id: PLUGIN_ID,
                hook_name: 'onSave',
                handler_path: '/hooks/save',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 }) // plugin check
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // insert
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_id: PLUGIN_ID, hook_name: 'onSave', handler_path: '/hooks/save' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.hook_name).toBe('onSave');
        });
        it('should return 400 when plugin not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_id: PLUGIN_ID, hook_name: 'onSave', handler_path: '/hooks/save' });
            expect(res.status).toBe(400);
            expect(res.body.code).toMatch(/ERR-API-1001|INVALID_PLUGIN/);
        });
        it('should return 409 on duplicate hook', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
                .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_id: PLUGIN_ID, hook_name: 'onSave', handler_path: '/hooks/save' });
            expect(res.status).toBe(409);
            expect(res.body.code).toMatch(/ERR-API-1009|DUPLICATE_HOOK/);
        });
        it('should return 400 when required fields are missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_id: PLUGIN_ID });
            expect(res.status).toBe(400);
        });
    });
    describe('PUT /:id', () => {
        it('should return 200 when updating hook', async () => {
            const updated = { id: HOOK_ID, priority: 50, enabled: false };
            mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .put(`/api/v1/marketplace/hooks/${HOOK_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ priority: 50, enabled: false });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return 404 when hook not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .put('/api/v1/marketplace/hooks/nonexistent')
                .set('Authorization', `Bearer ${token}`)
                .send({ priority: 50 });
            expect(res.status).toBe(404);
            expect(res.body.code).toMatch(/ERR-API-1005|HOOK_NOT_FOUND/);
        });
    });
    describe('DELETE /:id', () => {
        it('should return 200 when deleting hook', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: HOOK_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/marketplace/hooks/${HOOK_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Hook deleted');
        });
        it('should return 404 when hook not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/marketplace/hooks/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    // ===========================================================================
    // UI SLOTS
    // ===========================================================================
    describe('GET /ui-slots/list', () => {
        it('should return 200 with UI slots', async () => {
            const slots = [
                { id: 's1', slot_name: 'dashboard_widget', component_path: '/widgets/dashboard' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: slots, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/hooks/ui-slots/list')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('POST /ui-slots', () => {
        it('should return 201 when creating UI slot', async () => {
            const created = { id: 's1', slot_name: 'sidebar_widget', component_path: '/widgets/sidebar' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks/ui-slots')
                .set('Authorization', `Bearer ${token}`)
                .send({
                plugin_id: PLUGIN_ID,
                slot_name: 'sidebar_widget',
                component_path: '/widgets/sidebar',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should return 400 when plugin not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks/ui-slots')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_id: PLUGIN_ID, slot_name: 'test', component_path: '/test' });
            expect(res.status).toBe(400);
            expect(res.body.code).toMatch(/ERR-API-1001|INVALID_PLUGIN/);
        });
        it('should return 409 on duplicate UI slot', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 })
                .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
            const res = await supertest(app)
                .post('/api/v1/marketplace/hooks/ui-slots')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_id: PLUGIN_ID, slot_name: 'test', component_path: '/test' });
            expect(res.status).toBe(409);
            expect(res.body.code).toMatch(/ERR-API-1009|DUPLICATE_UI_SLOT/);
        });
    });
    describe('PUT /ui-slots/:id', () => {
        it('should return 200 when updating UI slot', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', priority: 50 }], rowCount: 1 });
            const res = await supertest(app)
                .put('/api/v1/marketplace/hooks/ui-slots/s1')
                .set('Authorization', `Bearer ${token}`)
                .send({ priority: 50 });
            expect(res.status).toBe(200);
        });
        it('should return 404 when UI slot not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .put('/api/v1/marketplace/hooks/ui-slots/nonexistent')
                .set('Authorization', `Bearer ${token}`)
                .send({ priority: 50 });
            expect(res.status).toBe(404);
            expect(res.body.code).toMatch(/ERR-API-1005|UI_SLOT_NOT_FOUND/);
        });
    });
    describe('DELETE /ui-slots/:id', () => {
        it('should return 200 when deleting UI slot', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/marketplace/hooks/ui-slots/s1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('UI slot deleted');
        });
        it('should return 404 when UI slot not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/marketplace/hooks/ui-slots/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    // ===========================================================================
    // HOOK EXECUTIONS
    // ===========================================================================
    describe('GET /executions/list', () => {
        it('should return 200 with execution list', async () => {
            const execs = [{ id: 'e1', hook_name: 'onSave', status: 'success', duration_ms: 120 }];
            mockQuery.mockResolvedValueOnce({ rows: execs, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/hooks/executions/list')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by hook_id and status', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/marketplace/hooks/executions/list?hook_id=${HOOK_ID}&status=success`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET /executions/:id', () => {
        it('should return 200 with execution details', async () => {
            const exec = {
                id: 'e1',
                hook_name: 'onSave',
                status: 'success',
                input_data: '{}',
                output_data: '{}',
            };
            mockQuery.mockResolvedValueOnce({ rows: [exec], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/hooks/executions/e1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.hook_name).toBe('onSave');
        });
        it('should return 404 when execution not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/hooks/executions/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.code).toMatch(/ERR-API-1005|EXECUTION_NOT_FOUND/);
        });
    });
});
//# sourceMappingURL=marketplace-hooks.test.js.map