/**
 * Certifications Routes - Behavioral Tests
 * Tests HTTP request/response for certification CRUD, employee self-service,
 * and holders listing.
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
const { default: certRoutes } = await import('../../routes/certifications.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/certifications', authMiddleware);
    app.use('/api/v1/certifications', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/certifications', certRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Certifications Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('Authentication', () => {
        it('should return 401 without token', async () => {
            const res = await supertest(app).get('/api/v1/certifications');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /certifications/me', () => {
        it('should return 401 when no employeeId on user', async () => {
            const noEmpToken = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID, employeeId: undefined }));
            const res = await supertest(app)
                .get('/api/v1/certifications/me')
                .set('Authorization', `Bearer ${noEmpToken}`);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('No employee profile linked to this user');
        });
    });
    describe('GET /certifications', () => {
        it('should return paginated certification list', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: 'c-1', name: 'AWS Solutions Architect', holder_count: '10' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/certifications')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('AWS Solutions Architect');
            expect(res.body.meta.total).toBe(1);
        });
        it('should filter by search', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/certifications?search=AWS')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET /certifications/:id', () => {
        it('should return a single certification', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'c-1', name: 'AWS SA', holder_count: '5', expired_count: '1' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/certifications/c-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('AWS SA');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/certifications/none')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('POST /certifications', () => {
        it('should create a certification', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c-new', name: 'PMP' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/certifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'PMP', issuing_organization: 'PMI' });
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Certification created');
        });
        it('should return 400 when name missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/certifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ issuing_organization: 'PMI' });
            expect(res.status).toBe(400);
        });
    });
    describe('PATCH /certifications/:id', () => {
        it('should update a certification', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'c-1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'c-1', name: 'Updated' }], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/certifications/c-1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Certification updated');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/certifications/none')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'X' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when no fields', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c-1' }], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/certifications/c-1')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No fields to update');
        });
    });
    describe('DELETE /certifications/:id', () => {
        it('should soft-delete (deactivate) a certification', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c-1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/certifications/c-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Certification deactivated');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/certifications/none')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /certifications/:id/holders', () => {
        it('should return certification holders', async () => {
            const holders = [
                { employee_name: 'Mario Rossi', employee_email: 'mario@rtl.com', is_expired: false },
            ];
            mockQuery.mockResolvedValueOnce({ rows: holders, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/certifications/c-1/holders')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].employee_name).toBe('Mario Rossi');
        });
    });
    describe('Error Handling', () => {
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/certifications')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
});
//# sourceMappingURL=certifications.test.js.map