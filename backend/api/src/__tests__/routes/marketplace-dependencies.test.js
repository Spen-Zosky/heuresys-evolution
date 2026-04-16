/**
 * Marketplace Dependencies Routes - Behavioral Tests
 * Tests plugin dependency CRUD, reverse deps, and dependency check endpoints.
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
const { default: routeHandler } = await import('../../routes/marketplace-dependencies.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
function createSuperuserToken() {
    return generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_ID }));
}
const PLUGIN_ID = DEFAULT_IDS.EMPLOYEE_ID;
const DEP_PLUGIN_ID = DEFAULT_IDS.DEPARTMENT_ID;
const DEP_ID = DEFAULT_IDS.GOAL_ID;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        req.dbClient = { query: mockQuery };
        req.tenantId = TENANT_ID;
        req.tenantCode = 'test';
        next();
    });
    app.use('/api/v1/marketplace/dependencies', routeHandler);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Marketplace Dependencies Routes', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('GET /plugin/:pluginId', () => {
        it('should return 200 with plugin dependencies', async () => {
            const deps = [
                {
                    id: DEP_ID,
                    plugin_id: PLUGIN_ID,
                    depends_on_plugin_id: DEP_PLUGIN_ID,
                    depends_on_name: 'Auth Plugin',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: deps, rowCount: 1 });
            const res = await supertest(app).get(`/api/v1/marketplace/dependencies/plugin/${PLUGIN_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].depends_on_name).toBe('Auth Plugin');
        });
        it('should return 200 with empty array when no dependencies', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app).get(`/api/v1/marketplace/dependencies/plugin/${PLUGIN_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
    describe('GET /dependents/:pluginId', () => {
        it('should return 200 with reverse dependencies', async () => {
            const deps = [
                {
                    id: DEP_ID,
                    plugin_id: 'p2',
                    depends_on_plugin_id: PLUGIN_ID,
                    plugin_name: 'Dashboard Plugin',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: deps, rowCount: 1 });
            const res = await supertest(app).get(`/api/v1/marketplace/dependencies/dependents/${PLUGIN_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data[0].plugin_name).toBe('Dashboard Plugin');
        });
    });
    describe('POST /', () => {
        it('should return 201 when creating a dependency', async () => {
            const created = { id: DEP_ID, plugin_id: PLUGIN_ID, depends_on_plugin_id: DEP_PLUGIN_ID };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }, { id: DEP_PLUGIN_ID }], rowCount: 2 }) // plugin check
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // insert
            const res = await supertest(app)
                .post('/api/v1/marketplace/dependencies')
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ plugin_id: PLUGIN_ID, depends_on_plugin_id: DEP_PLUGIN_ID, min_version: '1.0.0' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.plugin_id).toBe(PLUGIN_ID);
        });
        it('should return 400 when plugin depends on itself', async () => {
            const res = await supertest(app)
                .post('/api/v1/marketplace/dependencies')
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ plugin_id: PLUGIN_ID, depends_on_plugin_id: PLUGIN_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/cannot depend on itself|non valida/i);
        });
        it('should return 400 when one or both plugins not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }], rowCount: 1 }); // only 1 found
            const res = await supertest(app)
                .post('/api/v1/marketplace/dependencies')
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ plugin_id: PLUGIN_ID, depends_on_plugin_id: DEP_PLUGIN_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 409 on duplicate dependency', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PLUGIN_ID }, { id: DEP_PLUGIN_ID }], rowCount: 2 })
                .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
            const res = await supertest(app)
                .post('/api/v1/marketplace/dependencies')
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ plugin_id: PLUGIN_ID, depends_on_plugin_id: DEP_PLUGIN_ID });
            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/already exists|già esiste/i);
        });
        it('should return 400 when plugin_id is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/marketplace/dependencies')
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ depends_on_plugin_id: DEP_PLUGIN_ID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('PUT /:id', () => {
        it('should return 200 when updating dependency', async () => {
            const updated = { id: DEP_ID, min_version: '2.0.0', is_optional: true };
            mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .put(`/api/v1/marketplace/dependencies/${DEP_ID}`)
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ min_version: '2.0.0', is_optional: true });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return 404 when dependency not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .put('/api/v1/marketplace/dependencies/nonexistent')
                .set('Authorization', `Bearer ${createSuperuserToken()}`)
                .send({ min_version: '1.0.0' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('DELETE /:id', () => {
        it('should return 200 when removing dependency', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DEP_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/marketplace/dependencies/${DEP_ID}`)
                .set('Authorization', `Bearer ${createSuperuserToken()}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Dependency removed');
        });
        it('should return 404 when dependency not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/marketplace/dependencies/nonexistent')
                .set('Authorization', `Bearer ${createSuperuserToken()}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('GET /check/:pluginId', () => {
        it('should return 200 with dependency check result (all satisfied)', async () => {
            const deps = [
                {
                    id: DEP_ID,
                    depends_on_plugin_id: DEP_PLUGIN_ID,
                    is_optional: false,
                    installation_id: 'inst1',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: deps, rowCount: 1 });
            const res = await supertest(app).get(`/api/v1/marketplace/dependencies/check/${PLUGIN_ID}?tenant_id=${TENANT_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.all_required_satisfied).toBe(true);
            expect(res.body.data.dependencies).toHaveLength(1);
            expect(res.body.data.dependencies[0].satisfied).toBe(true);
        });
        it('should return unsatisfied when required dep not installed', async () => {
            const deps = [
                {
                    id: DEP_ID,
                    depends_on_plugin_id: DEP_PLUGIN_ID,
                    is_optional: false,
                    installation_id: null,
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: deps, rowCount: 1 });
            const res = await supertest(app).get(`/api/v1/marketplace/dependencies/check/${PLUGIN_ID}?tenant_id=${TENANT_ID}`);
            expect(res.status).toBe(200);
            expect(res.body.data.all_required_satisfied).toBe(false);
        });
        it('should return 400 when tenant_id is missing', async () => {
            const res = await supertest(app).get(`/api/v1/marketplace/dependencies/check/${PLUGIN_ID}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/tenant_id/i);
        });
    });
});
//# sourceMappingURL=marketplace-dependencies.test.js.map