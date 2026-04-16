/**
 * Marketplace Installations Routes - Unit Tests
 * Tests HTTP behavior for plugin installation management endpoints.
 *
 * Endpoints tested:
 *  GET    /stats              - Installation statistics
 *  GET    /                   - List installations
 *  GET    /:id                - Get installation detail + config
 *  POST   /                   - Install a plugin (Zod validated)
 *  PUT    /:id/configuration  - Update config (Zod validated)
 *  PATCH  /:id/disable        - Disable installation (Zod validated)
 *  PATCH  /:id/enable         - Re-enable installation
 *  DELETE /:id                - Uninstall plugin
 *  PATCH  /:id/update         - Update to latest version
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
});
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
jest.unstable_mockModule(resolve('../../services/webhook-dispatcher.js'), () => ({
    dispatchWebhooks: jest.fn(),
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/marketplace-installations.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/marketplace/installations', authMiddleware);
    app.use('/api/v1/marketplace/installations', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/marketplace/installations', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('marketplace-installations Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // ── Auth ─────────────────────────────────────────────────────────────────
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/marketplace/installations/');
        expect(res.status).toBe(401);
    });
    // ── GET /stats ───────────────────────────────────────────────────────────
    it('GET /stats returns 200 with aggregated counts', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ total: '5', active: '3', disabled: '2' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/marketplace/installations/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('total');
    });
    it('GET /stats returns 500 on DB error', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB down'));
        const res = await supertest(app)
            .get('/api/v1/marketplace/installations/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // ── GET / ────────────────────────────────────────────────────────────────
    it('GET / returns 200 with installation list', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'inst-1', plugin_name: 'Plugin A' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/installations/')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta).toHaveProperty('total');
    });
    it('GET / returns empty data when no installations', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/installations/')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });
    // ── GET /:id ─────────────────────────────────────────────────────────────
    it('GET /:id returns 200 with installation + config', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'inst-1', plugin_name: 'Plugin A' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [{ config_data: { key: 'val' }, config_version: 1 }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/marketplace/installations/inst-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.configuration).toBeDefined();
    });
    it('GET /:id returns 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/installations/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|INSTALLATION_NOT_FOUND/);
    });
    // ── POST / (install) ────────────────────────────────────────────────────
    it('POST / returns 400 on Zod validation failure (missing plugin_id)', async () => {
        const res = await supertest(app)
            .post('/api/v1/marketplace/installations/')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
    it('POST / returns 400 when plugin not published', async () => {
        const pluginId = '11111111-1111-4111-a111-111111111111';
        // plugin check returns empty
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/marketplace/installations/')
            .set('Authorization', `Bearer ${token}`)
            .send({ plugin_id: pluginId });
        expect(res.status).toBe(400);
        expect(res.body.code).toMatch(/ERR-API-1001|INVALID_PLUGIN/);
    });
    it('POST / returns 409 when plugin already installed', async () => {
        const pluginId = '11111111-1111-4111-a111-111111111111';
        // plugin check passes
        mockQuery.mockResolvedValueOnce({ rows: [{ id: pluginId }], rowCount: 1 });
        // no required deps
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // version check passes
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ver-1' }], rowCount: 1 });
        // existing install found
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/marketplace/installations/')
            .set('Authorization', `Bearer ${token}`)
            .send({ plugin_id: pluginId });
        expect(res.status).toBe(409);
        expect(res.body.code).toMatch(/ERR-API-1009|ALREADY_INSTALLED/);
    });
    it('POST / returns 201 on successful install', async () => {
        const pluginId = '11111111-1111-4111-a111-111111111111';
        // plugin check
        mockQuery.mockResolvedValueOnce({ rows: [{ id: pluginId }], rowCount: 1 });
        // no required deps
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // version check
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ver-1' }], rowCount: 1 });
        // no existing install
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // insert
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'new-inst', plugin_id: pluginId, status: 'active' }],
            rowCount: 1,
        });
        // update install count
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/marketplace/installations/')
            .set('Authorization', `Bearer ${token}`)
            .send({ plugin_id: pluginId });
        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe('active');
    });
    // ── PUT /:id/configuration ──────────────────────────────────────────────
    it('PUT /:id/configuration returns 400 on Zod validation (missing config_data)', async () => {
        const res = await supertest(app)
            .put('/api/v1/marketplace/installations/inst-1/configuration')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
    it('PUT /:id/configuration returns 404 when installation not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .put('/api/v1/marketplace/installations/inst-1/configuration')
            .set('Authorization', `Bearer ${token}`)
            .send({ config_data: { theme: 'dark' } });
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|INSTALLATION_NOT_FOUND/);
    });
    it('PUT /:id/configuration returns 200 on success', async () => {
        // install check
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1' }], rowCount: 1 });
        // upsert config
        mockQuery.mockResolvedValueOnce({
            rows: [{ config_data: { theme: 'dark' }, config_version: 1 }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .put('/api/v1/marketplace/installations/inst-1/configuration')
            .set('Authorization', `Bearer ${token}`)
            .send({ config_data: { theme: 'dark' } });
        expect(res.status).toBe(200);
        expect(res.body.data.config_version).toBe(1);
    });
    // ── PATCH /:id/disable ──────────────────────────────────────────────────
    it('PATCH /:id/disable returns 200 on success', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 'inst-1', status: 'disabled', disabled_at: '2026-01-01', disabled_reason: 'test' },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/disable')
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'test' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('disabled');
    });
    it('PATCH /:id/disable returns 404 when not active', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/disable')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|INSTALLATION_NOT_FOUND/);
    });
    // ── PATCH /:id/enable ───────────────────────────────────────────────────
    it('PATCH /:id/enable returns 200 on success', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1', status: 'active' }], rowCount: 1 });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/enable')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('active');
    });
    it('PATCH /:id/enable returns 404 when not disabled', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/enable')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // ── DELETE /:id ──────────────────────────────────────────────────────────
    it('DELETE /:id returns 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/marketplace/installations/inst-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|INSTALLATION_NOT_FOUND/);
    });
    it('DELETE /:id returns 400 when has dependents', async () => {
        // install exists
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1', plugin_id: 'p-1' }], rowCount: 1 });
        // dependent check returns results
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'dep-inst', name: 'Dependent Plugin' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .delete('/api/v1/marketplace/installations/inst-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toMatch(/ERR-API-1001|HAS_DEPENDENTS/);
    });
    it('DELETE /:id returns 200 on success', async () => {
        // install exists
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inst-1', plugin_id: 'p-1' }], rowCount: 1 });
        // no dependents
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // delete configs
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // delete install
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        // decrement count
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        const res = await supertest(app)
            .delete('/api/v1/marketplace/installations/inst-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Plugin uninstalled');
    });
    // ── PATCH /:id/update ───────────────────────────────────────────────────
    it('PATCH /:id/update returns 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/update')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('PATCH /:id/update returns 200 already at latest', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'inst-1',
                    plugin_id: 'p-1',
                    plugin_version_id: 'v-1',
                    installed_version: '1.0.0',
                    latest_version_id: 'v-1',
                    latest_version: '1.0.0',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/update')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('already at the latest');
    });
    it('PATCH /:id/update returns 200 when updated to new version', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'inst-1',
                    plugin_id: 'p-1',
                    plugin_version_id: 'v-1',
                    installed_version: '1.0.0',
                    latest_version_id: 'v-2',
                    latest_version: '2.0.0',
                },
            ],
            rowCount: 1,
        });
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'inst-1', plugin_version_id: 'v-2' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .patch('/api/v1/marketplace/installations/inst-1/update')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('updated from');
    });
});
//# sourceMappingURL=marketplace-installations.test.js.map