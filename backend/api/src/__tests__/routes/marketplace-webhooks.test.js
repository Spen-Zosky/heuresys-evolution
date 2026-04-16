/**
 * Marketplace Webhooks Routes - Unit Tests
 * Tests HTTP behavior for webhook registration and delivery tracking.
 *
 * Endpoints tested:
 *  GET    /                      - List webhooks
 *  GET    /:id                   - Get webhook
 *  POST   /                      - Create webhook (Zod validated)
 *  PUT    /:id                   - Update webhook (Zod validated)
 *  DELETE /:id                   - Delete webhook
 *  GET    /:id/deliveries        - List deliveries
 *  GET    /:id/deliveries/:did   - Get delivery
 *  POST   /:id/test              - Test webhook
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
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/marketplace-webhooks.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const INSTALL_ID = '11111111-1111-4111-a111-111111111111';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/marketplace/webhooks', authMiddleware);
    app.use('/api/v1/marketplace/webhooks', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/marketplace/webhooks', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('marketplace-webhooks Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/marketplace/webhooks/');
        expect(res.status).toBe(401);
    });
    // ── GET / ─────────────────────────────────────────────────────────────
    it('GET / returns 200 with webhooks', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'w-1', url: 'https://example.com/hook' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // ── GET /:id ──────────────────────────────────────────────────────────
    it('GET /:id returns 200', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'w-1', url: 'https://example.com/hook' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/w-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('w-1');
    });
    it('GET /:id returns 404', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|WEBHOOK_NOT_FOUND/);
    });
    // ── POST / ────────────────────────────────────────────────────────────
    it('POST / returns 400 on Zod validation (missing fields)', async () => {
        const res = await supertest(app)
            .post('/api/v1/marketplace/webhooks/')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
    it('POST / returns 400 on Zod validation (invalid url)', async () => {
        const res = await supertest(app)
            .post('/api/v1/marketplace/webhooks/')
            .set('Authorization', `Bearer ${token}`)
            .send({ plugin_installation_id: INSTALL_ID, url: 'not-a-url' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
    it('POST / returns 400 when installation not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/marketplace/webhooks/')
            .set('Authorization', `Bearer ${token}`)
            .send({ plugin_installation_id: INSTALL_ID, url: 'https://example.com/hook' });
        expect(res.status).toBe(400);
        expect(res.body.code).toMatch(/ERR-API-1001|INVALID_INSTALLATION/);
    });
    it('POST / returns 201 on success', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: INSTALL_ID }], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'w-1', url: 'https://example.com/hook', events: '{}', is_active: true }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/marketplace/webhooks/')
            .set('Authorization', `Bearer ${token}`)
            .send({ plugin_installation_id: INSTALL_ID, url: 'https://example.com/hook' });
        expect(res.status).toBe(201);
        expect(res.body.data.url).toBe('https://example.com/hook');
    });
    // ── PUT /:id ──────────────────────────────────────────────────────────
    it('PUT /:id returns 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .put('/api/v1/marketplace/webhooks/w-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'updated' });
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|WEBHOOK_NOT_FOUND/);
    });
    it('PUT /:id returns 200 on success', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'w-1', description: 'updated' }], rowCount: 1 });
        const res = await supertest(app)
            .put('/api/v1/marketplace/webhooks/w-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'updated' });
        expect(res.status).toBe(200);
        expect(res.body.data.description).toBe('updated');
    });
    // ── DELETE /:id ───────────────────────────────────────────────────────
    it('DELETE /:id returns 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/marketplace/webhooks/w-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('DELETE /:id returns 200 on success', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'w-1' }], rowCount: 1 });
        const res = await supertest(app)
            .delete('/api/v1/marketplace/webhooks/w-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Webhook deleted');
    });
    // ── GET /:id/deliveries ───────────────────────────────────────────────
    it('GET /:id/deliveries returns 404 when webhook not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/w-1/deliveries')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('GET /:id/deliveries returns 200 with deliveries', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'w-1' }], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1', status: 'delivered' }], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/w-1/deliveries')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // ── GET /:id/deliveries/:deliveryId ───────────────────────────────────
    it('GET /:id/deliveries/:deliveryId returns 404 when webhook not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/w-1/deliveries/d-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('GET /:id/deliveries/:deliveryId returns 404 when delivery not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'w-1' }], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/marketplace/webhooks/w-1/deliveries/d-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toMatch(/ERR-API-1005|DELIVERY_NOT_FOUND/);
    });
    // ── POST /:id/test ───────────────────────────────────────────────────
    it('POST /:id/test returns 404 when webhook not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/marketplace/webhooks/w-1/test')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('POST /:id/test returns 201 on success', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'w-1', url: 'https://example.com', events: '{}' }],
            rowCount: 1,
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'td-1', status: 'pending' }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/marketplace/webhooks/w-1/test')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Test delivery created');
    });
});
//# sourceMappingURL=marketplace-webhooks.test.js.map