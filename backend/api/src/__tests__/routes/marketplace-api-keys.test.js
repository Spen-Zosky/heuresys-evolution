/**
 * Marketplace API Keys Routes - Behavioral Tests
 * Tests HTTP request/response for plugin API key management endpoints.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
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
const { default: apiKeysRoutes } = await import('../../routes/marketplace-api-keys.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const KEY_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
const INSTALL_ID = '88888888-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/marketplace/api-keys', authMiddleware);
    app.use('/api/v1/marketplace/api-keys', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/marketplace/api-keys', apiKeysRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
const sampleKey = {
    id: KEY_ID,
    plugin_installation_id: INSTALL_ID,
    name: 'Production Key',
    key_prefix: 'hpk_abcdef12',
    scopes: '{}',
    expires_at: null,
    last_used_at: null,
    is_active: true,
    created_by: VALID_UUID,
    created_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    plugin_name: 'Analytics Plugin',
    plugin_slug: 'analytics-plugin',
    created_by_name: 'Mario Rossi',
};
describe('Marketplace API Keys Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('Authentication', () => {
        it('should return 401 when no auth token is provided', async () => {
            const res = await supertest(app).get('/api/v1/marketplace/api-keys');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /marketplace/api-keys', () => {
        it('should return list of API keys', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [sampleKey], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/api-keys')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Production Key');
            expect(res.body.data[0].plugin_name).toBe('Analytics Plugin');
        });
        it('should filter by plugin_installation_id', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [sampleKey], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/marketplace/api-keys?plugin_installation_id=${INSTALL_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by is_active', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/api-keys?is_active=false')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
        it('should return empty array when no keys exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/marketplace/api-keys')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    describe('GET /marketplace/api-keys/:id', () => {
        it('should return a specific API key', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [sampleKey], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/marketplace/api-keys/${KEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(KEY_ID);
        });
        it('should return 404 when key is not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/marketplace/api-keys/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toMatch(/ERR-API-1005|API_KEY_NOT_FOUND/);
        });
    });
    describe('POST /marketplace/api-keys', () => {
        const validPayload = {
            plugin_installation_id: INSTALL_ID,
            name: 'New API Key',
            scopes: ['read', 'write'],
        };
        it('should create a new API key and return the raw key', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: INSTALL_ID }], rowCount: 1 }); // install check
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: KEY_ID,
                        plugin_installation_id: INSTALL_ID,
                        name: 'New API Key',
                        key_prefix: 'hpk_abc',
                        scopes: '{}',
                        expires_at: null,
                        is_active: true,
                        created_by: null,
                        created_at: '2026-01-01',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/marketplace/api-keys')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(KEY_ID);
            expect(res.body.data.key).toBeDefined();
            expect(res.body.data.key).toContain('hpk_');
        });
        it('should return 400 when plugin_installation_id is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/marketplace/api-keys')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Key' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when name is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/marketplace/api-keys')
                .set('Authorization', `Bearer ${token}`)
                .send({ plugin_installation_id: INSTALL_ID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when installation does not exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/marketplace/api-keys')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(400);
            expect(res.body.code).toMatch(/ERR-API-1001|INVALID_INSTALLATION/);
        });
    });
    describe('PATCH /marketplace/api-keys/:id/revoke', () => {
        it('should revoke an active API key', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: KEY_ID,
                        name: 'Key',
                        key_prefix: 'hpk_abc',
                        is_active: false,
                        revoked_at: '2026-01-15',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/marketplace/api-keys/${KEY_ID}/revoke`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('API key revoked');
        });
        it('should return 404 when key is not found or already revoked', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/marketplace/api-keys/${VALID_UUID}/revoke`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.code).toMatch(/ERR-API-1005|API_KEY_NOT_FOUND/);
        });
    });
    describe('DELETE /marketplace/api-keys/:id', () => {
        it('should permanently delete an API key', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: KEY_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/marketplace/api-keys/${KEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('API key deleted');
        });
        it('should return 404 when key to delete is not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/marketplace/api-keys/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.code).toMatch(/ERR-API-1005|API_KEY_NOT_FOUND/);
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .delete(`/api/v1/marketplace/api-keys/${KEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=marketplace-api-keys.test.js.map