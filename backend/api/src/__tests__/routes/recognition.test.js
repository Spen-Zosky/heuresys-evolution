/**
 * Recognition Routes - Unit Tests
 * Tests employee recognition and kudos management endpoints.
 *
 * Endpoints tested:
 *  GET    /recognition/stats                        - Stats
 *  GET    /recognition/categories                   - Categories
 *  GET    /recognition/badges                       - Badges
 *  GET    /recognition/leaderboard                  - Leaderboard
 *  GET    /recognition/recent                       - Recent public
 *  GET    /recognition                              - List all
 *  GET    /recognition/:id                          - Get by ID
 *  GET    /recognition/employee/:id/given           - Given by employee
 *  GET    /recognition/employee/:id/received        - Received by employee
 *  POST   /recognition                              - Create
 *  PATCH  /recognition/:id                          - Update
 *  DELETE /recognition/:id                          - Delete
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
const { default: routes } = await import('../../routes/recognition.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const REC_ID = '66666666-7777-4888-a999-aaaaaaaaaaaa';
const EMP_ID = DEFAULT_IDS.EMPLOYEE_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/recognition', authMiddleware);
    app.use('/api/v1/recognition', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery };
        next();
    });
    app.use('/api/v1/recognition', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('Recognition Routes', () => {
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
        const res = await supertest(app).get('/api/v1/recognition');
        expect(res.status).toBe(401);
    });
    // ==================== GET /stats ====================
    describe('GET /stats', () => {
        it('should return 200 with stats', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total: '100',
                        public_count: '80',
                        private_count: '20',
                        unique_givers: '30',
                        unique_receivers: '50',
                        total_points: '2500',
                    },
                ],
                rowCount: 1,
            });
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ last_7d: '15', last_30d: '40', last_90d: '80' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/recognition/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total).toBe('100');
            expect(res.body.data.last_7d).toBe('15');
        });
    });
    // ==================== GET /categories ====================
    describe('GET /categories', () => {
        it('should return 200 with categories', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ category: 'innovation', count: '25', total_points: '500' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/recognition/categories')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].category).toBe('innovation');
        });
    });
    // ==================== GET /badges ====================
    describe('GET /badges', () => {
        it('should return 200 with badges', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ badge_type: 'star', count: '40' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/recognition/badges')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].badge_type).toBe('star');
        });
    });
    // ==================== GET /leaderboard ====================
    describe('GET /leaderboard', () => {
        it('should return 200 with leaderboard', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        to_employee_id: EMP_ID,
                        employee_name: 'Mario Rossi',
                        recognition_count: '10',
                        total_points: '200',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/recognition/leaderboard')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].employee_name).toBe('Mario Rossi');
        });
    });
    // ==================== GET /recent ====================
    describe('GET /recent', () => {
        it('should return 200 with recent recognitions', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REC_ID,
                        message: 'Great work!',
                        giver_name: 'Lucia Bianchi',
                        receiver_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/recognition/recent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].giver_name).toBe('Lucia Bianchi');
        });
    });
    // ==================== GET / ====================
    describe('GET / (list)', () => {
        it('should return 200 with paginated list', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '50' }], rowCount: 1 });
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REC_ID,
                        message: 'Thank you',
                        giver_name: 'Marco Verdi',
                        receiver_name: 'Giulia Colombo',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/recognition')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.meta.total).toBe(50);
        });
    });
    // ==================== GET /:id ====================
    describe('GET /:id', () => {
        it('should return 404 when not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with recognition data', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REC_ID,
                        message: 'Excellent leadership',
                        giver_name: 'Admin',
                        receiver_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(REC_ID);
        });
    });
    // ==================== POST / ====================
    describe('POST /', () => {
        it('should return 400 when to_employee_id missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/recognition')
                .set('Authorization', `Bearer ${token}`)
                .send({ message: 'Good job' });
            expect(res.status).toBe(400);
        });
        it('should return 400 when receiver not found in tenant', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/recognition')
                .set('Authorization', `Bearer ${token}`)
                .send({ from_employee_id: EMP_ID, to_employee_id: EMP_ID, message: 'Great work' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Invalid receiver/i);
        });
        it('should return 201 on successful creation', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: EMP_ID }], rowCount: 1 });
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: REC_ID, to_employee_id: EMP_ID, message: 'Great work', category: 'teamwork' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/recognition')
                .set('Authorization', `Bearer ${token}`)
                .send({
                from_employee_id: EMP_ID,
                to_employee_id: EMP_ID,
                message: 'Great work',
                category: 'teamwork',
            });
            expect(res.status).toBe(201);
            expect(res.body.data.message).toBe('Great work');
        });
    });
    // ==================== PATCH /:id ====================
    describe('PATCH /:id', () => {
        it('should return 404 when not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ message: 'Updated' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when no fields to update', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: REC_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
        it('should return 200 on successful update', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: REC_ID }], rowCount: 1 });
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: REC_ID, message: 'Updated message' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ message: 'Updated message' });
            expect(res.status).toBe(200);
        });
    });
    // ==================== DELETE /:id ====================
    describe('DELETE /:id', () => {
        it('should return 404 when not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful delete', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [{ id: REC_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/recognition/${REC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
    });
    // ==================== GET /employee/:employeeId/given ====================
    describe('GET /employee/:employeeId/given', () => {
        it('should return 200 with recognitions given', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: REC_ID, receiver_name: 'Giulia Colombo', message: 'Good work' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/recognition/employee/${EMP_ID}/given`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
    // ==================== GET /employee/:employeeId/received ====================
    describe('GET /employee/:employeeId/received', () => {
        it('should return 200 with recognitions received', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: REC_ID, giver_name: 'Lucia Bianchi', message: 'Great collaboration' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/recognition/employee/${EMP_ID}/received`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
});
//# sourceMappingURL=recognition.test.js.map