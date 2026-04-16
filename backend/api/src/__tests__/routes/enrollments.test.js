/**
 * Enrollments Routes - Unit Tests
 *
 * Tests:
 *   GET    /enrollments/stats      - Enrollment statistics
 *   GET    /enrollments            - List enrollments
 *   GET    /enrollments/:id        - Get enrollment by ID
 *   POST   /enrollments            - Create enrollment
 *   PATCH  /enrollments/:id        - Update enrollment
 *   POST   /enrollments/:id/complete - Complete enrollment
 *   DELETE /enrollments/:id        - Cancel enrollment
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
// Mock transaction utility
const mockWithTransaction = jest.fn();
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockQuery },
    appPool: { connect: mockConnect },
    testConnection: jest.fn().mockResolvedValue(true),
    testAppConnection: jest.fn().mockResolvedValue(true),
    closePool: jest.fn().mockResolvedValue(undefined),
    getAppClient: jest.fn(),
    withTenantClient: jest.fn(),
}));
jest.unstable_mockModule(resolve('../../utils/transaction.js'), () => ({
    withTransaction: mockWithTransaction,
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
const { default: routes } = await import('../../routes/enrollments.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const COURSE_ID = '77777777-8888-4999-aaaa-bbbbbbbbbbbb';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/enrollments', authMiddleware);
    app.use('/api/v1/enrollments', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery, release: mockClientRelease };
        next();
    });
    app.use('/api/v1/enrollments', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Enrollments Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/enrollments');
        expect(res.status).toBe(401);
    });
    // GET /stats
    it('GET /stats should return enrollment statistics', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [
                {
                    total: '100',
                    enrolled: '30',
                    in_progress: '40',
                    completed: '30',
                    avg_progress: '55.5',
                    avg_score: '78.2',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/enrollments/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe('100');
    });
    it('GET /stats should return 500 on DB error', async () => {
        mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app)
            .get('/api/v1/enrollments/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // GET /
    it('GET / should return enrollments list', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'en1',
                    employee_name: 'Mario Rossi',
                    course_title: 'Java Basics',
                    status: 'enrolled',
                },
            ],
            rowCount: 1,
        });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/enrollments')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    it('GET / should support filter params', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/enrollments?status=completed&employee_id=e1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    // GET /:id
    it('GET /:id should return enrollment by ID', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'en1', employee_name: 'Mario Rossi', course_title: 'Java Basics' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/enrollments/en1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('en1');
    });
    it('GET /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/enrollments/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // POST / (Zod)
    it('POST / should return 400 when missing required fields', async () => {
        const res = await supertest(app)
            .post('/api/v1/enrollments')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST / should return 400 when employee not in tenant', async () => {
        // employee check returns empty
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/enrollments')
            .set('Authorization', `Bearer ${token}`)
            .send({ employee_id: EMPLOYEE_ID, course_id: COURSE_ID });
        expect(res.status).toBe(400);
    });
    it('POST / should return 409 when already enrolled', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 }); // employee exists
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 }); // existing enrollment
        const res = await supertest(app)
            .post('/api/v1/enrollments')
            .set('Authorization', `Bearer ${token}`)
            .send({ employee_id: EMPLOYEE_ID, course_id: COURSE_ID });
        expect(res.status).toBe(409);
    });
    it('POST / should create enrollment successfully', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 }); // employee exists
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no existing
        mockWithTransaction.mockResolvedValueOnce({ id: 'en-new', status: 'enrolled' });
        const res = await supertest(app)
            .post('/api/v1/enrollments')
            .set('Authorization', `Bearer ${token}`)
            .send({ employee_id: EMPLOYEE_ID, course_id: COURSE_ID });
        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe('en-new');
    });
    // PATCH /:id
    it('PATCH /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .patch('/api/v1/enrollments/nonexistent')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'in_progress' });
        expect(res.status).toBe(404);
    });
    it('PATCH /:id should update enrollment', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'en1' }], rowCount: 1 }); // exists
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'en1', status: 'in_progress', progress_percent: 50 }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .patch('/api/v1/enrollments/en1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'in_progress', progress_percent: 50 });
        expect(res.status).toBe(200);
    });
    // POST /:id/complete
    it('POST /:id/complete should complete enrollment', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'en1', status: 'completed', progress_percent: 100, score: 90, passed: true }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/enrollments/en1/complete')
            .set('Authorization', `Bearer ${token}`)
            .send({ score: 90, passed: true });
        expect(res.status).toBe(200);
    });
    it('POST /:id/complete should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/enrollments/nonexistent/complete')
            .set('Authorization', `Bearer ${token}`)
            .send({ score: 80 });
        expect(res.status).toBe(404);
    });
    // DELETE /:id
    it('DELETE /:id should cancel enrollment', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'en1', course_id: COURSE_ID }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .delete('/api/v1/enrollments/en1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    it('DELETE /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/enrollments/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});
//# sourceMappingURL=enrollments.test.js.map