/**
 * Requisitions Routes - Unit Tests
 * Tests recruiting requisition CRUD and candidate listing endpoints.
 *
 * Endpoints tested:
 *  GET    /requisitions/stats              - Requisition statistics
 *  GET    /requisitions                    - List requisitions
 *  GET    /requisitions/:id               - Get requisition
 *  POST   /requisitions                    - Create requisition
 *  PATCH  /requisitions/:id               - Update requisition
 *  DELETE /requisitions/:id               - Cancel requisition
 *  GET    /requisitions/:id/candidates    - List candidates for requisition
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
const { default: routes } = await import('../../routes/requisitions.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const REQ_ID = '99999999-aaaa-4bbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/requisitions', authMiddleware);
    app.use('/api/v1/requisitions', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery };
        next();
    });
    app.use('/api/v1/requisitions', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('Requisitions Routes', () => {
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
        const res = await supertest(app).get('/api/v1/requisitions');
        expect(res.status).toBe(401);
    });
    // ==================== GET /stats ====================
    describe('GET /stats', () => {
        it('should return 200 with requisition stats', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total: '30',
                        open_count: '10',
                        in_progress: '8',
                        filled: '10',
                        cancelled: '2',
                        urgent: '3',
                        total_headcount: '45',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/requisitions/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total).toBe('30');
            expect(res.body.data.urgent).toBe('3');
        });
        it('should return 500 on database error', async () => {
            mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/requisitions/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    // ==================== GET / ====================
    describe('GET / (list)', () => {
        it('should return 200 with paginated list', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REQ_ID,
                        title: 'Senior Developer',
                        department: 'IT',
                        status: 'open',
                        priority: 'high',
                        candidate_count: '5',
                        hiring_manager_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/requisitions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.meta.total).toBe(15);
        });
        it('should return 200 with empty list', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/requisitions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
            expect(res.body.meta.total).toBe(0);
        });
        it('should support status filter', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/requisitions?status=open')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    // ==================== GET /:id ====================
    describe('GET /:id', () => {
        it('should return 404 when not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with requisition data', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REQ_ID,
                        title: 'Senior Developer',
                        department: 'IT',
                        status: 'open',
                        candidate_count: '5',
                        offer_count: '1',
                        hiring_manager_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(REQ_ID);
            expect(res.body.data.title).toBe('Senior Developer');
        });
    });
    // ==================== POST / ====================
    describe('POST /', () => {
        it('should return 400 when title missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/requisitions')
                .set('Authorization', `Bearer ${token}`)
                .send({ department: 'IT' });
            expect(res.status).toBe(400);
        });
        it('should return 201 on successful creation', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REQ_ID,
                        title: 'Backend Developer',
                        department: 'IT',
                        status: 'open',
                        priority: 'normal',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/requisitions')
                .set('Authorization', `Bearer ${token}`)
                .send({
                title: 'Backend Developer',
                department: 'IT',
                employment_type: 'full_time',
                priority: 'normal',
            });
            expect(res.status).toBe(201);
            expect(res.body.data.title).toBe('Backend Developer');
        });
        it('should return 201 with optional salary fields', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REQ_ID,
                        title: 'Frontend Developer',
                        salary_min: 40000,
                        salary_max: 60000,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/requisitions')
                .set('Authorization', `Bearer ${token}`)
                .send({
                title: 'Frontend Developer',
                department: 'Engineering',
                salary_min: 40000,
                salary_max: 60000,
                currency: 'EUR',
                headcount: 2,
            });
            expect(res.status).toBe(201);
        });
    });
    // ==================== PATCH /:id ====================
    describe('PATCH /:id', () => {
        it('should return 404 when not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated Title' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when no fields to update', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: REQ_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
        it('should return 200 on successful update', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: REQ_ID }], rowCount: 1 });
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: REQ_ID, title: 'Updated Title', status: 'in_progress' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated Title' });
            expect(res.status).toBe(200);
            expect(res.body.data.title).toBe('Updated Title');
        });
    });
    // ==================== DELETE /:id ====================
    describe('DELETE /:id', () => {
        it('should return 404 when not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful cancel', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: REQ_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/requisitions/${REQ_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/cancelled/i);
        });
    });
    // ==================== GET /:id/candidates ====================
    describe('GET /:id/candidates', () => {
        it('should return 200 with candidates list', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'c1',
                        requisition_id: REQ_ID,
                        first_name: 'Giulia',
                        last_name: 'Colombo',
                        stage: 'screening',
                        rating: 4,
                    },
                    {
                        id: 'c2',
                        requisition_id: REQ_ID,
                        first_name: 'Marco',
                        last_name: 'Verdi',
                        stage: 'interview',
                        rating: 3,
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get(`/api/v1/requisitions/${REQ_ID}/candidates`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(2);
        });
        it('should return 200 with empty candidates', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/requisitions/${REQ_ID}/candidates`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
});
//# sourceMappingURL=requisitions.test.js.map