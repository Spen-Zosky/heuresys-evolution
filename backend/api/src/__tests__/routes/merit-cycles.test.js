/**
 * Merit Cycles Routes - Unit Tests
 * Tests HTTP behavior for merit cycle CRUD endpoints.
 *
 * Endpoints tested:
 *  GET    /stats                 - Merit cycle statistics
 *  GET    /current               - Current active cycle
 *  GET    /                      - List cycles
 *  GET    /:id                   - Get cycle detail
 *  GET    /:id/recommendations   - Cycle recommendations
 *  POST   /                      - Create cycle (Zod)
 *  PATCH  /:id                   - Update cycle (Zod)
 *  POST   /:id/activate          - Activate cycle
 *  POST   /:id/complete          - Complete cycle
 *  DELETE /:id                   - Cancel cycle
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
const { default: routes } = await import('../../routes/merit-cycles.js');
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
    app.use('/api/v1/merit-cycles', authMiddleware);
    app.use('/api/v1/merit-cycles', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/merit-cycles', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('merit-cycles Routes', () => {
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
        const res = await supertest(app).get('/api/v1/merit-cycles/');
        expect(res.status).toBe(401);
    });
    // ── GET /stats ────────────────────────────────────────────────────────
    it('GET /stats returns 200 with aggregated stats', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    total: '3',
                    active: '1',
                    planning: '1',
                    completed: '1',
                    total_budget: '100000',
                    total_spent: '50000',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('total');
    });
    // ── GET /current ──────────────────────────────────────────────────────
    it('GET /current returns 200 with null when no active cycle', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/current')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeNull();
    });
    it('GET /current returns 200 with cycle data', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'mc-1', name: 'Q1 2026', status: 'active' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/current')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('active');
    });
    // ── GET / ─────────────────────────────────────────────────────────────
    it('GET / returns 200 with list', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'mc-1', name: 'Q1 2026' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta.total).toBe(1);
    });
    // ── GET /:id ──────────────────────────────────────────────────────────
    it('GET /:id returns 200', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mc-1', name: 'Q1 2026' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/mc-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('mc-1');
    });
    it('GET /:id returns 404', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // ── GET /:id/recommendations ──────────────────────────────────────────
    it('GET /:id/recommendations returns 200', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'mr-1', employee_name: 'Mario Rossi' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/merit-cycles/mc-1/recommendations')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // ── POST / ────────────────────────────────────────────────────────────
    it('POST / returns 400 on Zod validation (missing name)', async () => {
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/')
            .set('Authorization', `Bearer ${token}`)
            .send({ effective_date: '2026-04-01' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
    it('POST / returns 400 on Zod validation (missing effective_date)', async () => {
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Q1 2026' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
    it('POST / returns 201 on success', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'mc-1', name: 'Q1 2026', status: 'planning' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Q1 2026', effective_date: '2026-04-01' });
        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe('planning');
    });
    // ── PATCH /:id ────────────────────────────────────────────────────────
    it('PATCH /:id returns 404', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .patch('/api/v1/merit-cycles/mc-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated' });
        expect(res.status).toBe(404);
    });
    it('PATCH /:id returns 200 on success', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mc-1' }], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mc-1', name: 'Updated' }], rowCount: 1 });
        const res = await supertest(app)
            .patch('/api/v1/merit-cycles/mc-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Merit cycle updated');
    });
    // ── POST /:id/activate ────────────────────────────────────────────────
    it('POST /:id/activate returns 404 when not in planning', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/mc-1/activate')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('POST /:id/activate returns 200', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mc-1', status: 'active' }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/mc-1/activate')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Merit cycle activated');
    });
    // ── POST /:id/complete ────────────────────────────────────────────────
    it('POST /:id/complete returns 404 when not active', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/mc-1/complete')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('POST /:id/complete returns 200', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mc-1', status: 'completed' }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/merit-cycles/mc-1/complete')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Merit cycle completed');
    });
    // ── DELETE /:id ───────────────────────────────────────────────────────
    it('DELETE /:id returns 404', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/merit-cycles/mc-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('DELETE /:id returns 200 on cancel', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mc-1' }], rowCount: 1 });
        const res = await supertest(app)
            .delete('/api/v1/merit-cycles/mc-1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Merit cycle cancelled');
    });
});
//# sourceMappingURL=merit-cycles.test.js.map