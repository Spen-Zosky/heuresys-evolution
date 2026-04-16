/**
 * RAG Sessions Routes - Unit Tests
 * Tests AI chat session management endpoints.
 *
 * Endpoints tested:
 *  GET    /rag-sessions/stats       - Session statistics
 *  GET    /rag-sessions             - List sessions
 *  GET    /rag-sessions/:id         - Get session
 *  GET    /rag-sessions/:id/messages - Get messages
 *  POST   /rag-sessions             - Create session
 *  PATCH  /rag-sessions/:id         - Update session
 *  POST   /rag-sessions/:id/archive - Archive session
 *  DELETE /rag-sessions/:id         - Delete session
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
const { default: routes } = await import('../../routes/rag-sessions.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const SESSION_ID = '55555555-6666-4777-a888-999999999999';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/rag-sessions', authMiddleware);
    app.use('/api/v1/rag-sessions', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery };
        next();
    });
    app.use('/api/v1/rag-sessions', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('RAG Sessions Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/rag-sessions');
        expect(res.status).toBe(401);
    });
    // ==================== GET /stats ====================
    describe('GET /stats', () => {
        it('should return 200 with session stats', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ total: '50', active: '40', archived: '10', unique_users: '15' }],
                rowCount: 1,
            });
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    { provider: 'gemini', count: '30' },
                    { provider: 'openai', count: '20' },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/rag-sessions/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total).toBe('50');
            expect(res.body.data.providers.length).toBe(2);
        });
    });
    // ==================== GET / ====================
    describe('GET /', () => {
        it('should return 200 with session list', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: SESSION_ID, provider: 'gemini', title: 'Test Chat', message_count: '5' }],
                rowCount: 1,
            });
            mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/rag-sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.meta.total).toBe(1);
        });
        it('should return 200 with empty list', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/rag-sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
    // ==================== GET /:id ====================
    describe('GET /:id', () => {
        it('should return 404 when session not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with session data', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    { id: SESSION_ID, provider: 'gemini', title: 'HR Analysis', user_name: 'Mario Rossi' },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(SESSION_ID);
        });
    });
    // ==================== GET /:id/messages ====================
    describe('GET /:id/messages', () => {
        it('should return 404 when session not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/rag-sessions/${SESSION_ID}/messages`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with messages', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID }], rowCount: 1 });
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: 'm1', role: 'user', content: 'Hello', created_at: '2025-06-01' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/rag-sessions/${SESSION_ID}/messages`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
    // ==================== POST / ====================
    describe('POST /', () => {
        it('should return 400 when provider missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/rag-sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Test' });
            expect(res.status).toBe(400);
        });
        it('should return 201 on successful creation', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: SESSION_ID, provider: 'gemini', title: 'New Chat' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/rag-sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ provider: 'gemini', title: 'New Chat', model: 'gemini-pro' });
            expect(res.status).toBe(201);
            expect(res.body.data.provider).toBe('gemini');
        });
    });
    // ==================== PATCH /:id ====================
    describe('PATCH /:id', () => {
        it('should return 404 when session not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when no fields to update', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
        it('should return 200 on successful update', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID }], rowCount: 1 });
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: SESSION_ID, title: 'Updated Title' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated Title' });
            expect(res.status).toBe(200);
            expect(res.body.data.title).toBe('Updated Title');
        });
    });
    // ==================== POST /:id/archive ====================
    describe('POST /:id/archive', () => {
        it('should return 404 when session not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/rag-sessions/${SESSION_ID}/archive`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful archive', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: SESSION_ID, is_archived: true }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/rag-sessions/${SESSION_ID}/archive`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/archived/i);
        });
    });
    // ==================== DELETE /:id ====================
    describe('DELETE /:id', () => {
        it('should return 404 when session not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful delete', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: SESSION_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
        it('should return 500 on database error', async () => {
            mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .delete(`/api/v1/rag-sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
});
//# sourceMappingURL=rag-sessions.test.js.map