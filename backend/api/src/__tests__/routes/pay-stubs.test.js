/**
 * pay-stubs Routes - Unit Tests
 * Comprehensive behavioral tests for pay-stubs endpoints.
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
const { default: routeHandler } = await import('../../routes/pay-stubs.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const EMP_UUID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/pay-stubs', authMiddleware);
    app.use('/api/v1/pay-stubs', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/pay-stubs', routeHandler);
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
describe('pay-stubs Routes', () => {
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
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/pay-stubs/');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /me
    // =========================================================================
    describe('GET /me', () => {
        it('should return current employee pay stubs', async () => {
            const stubs = [
                { id: '1', period: '2025-06', gross_pay: 3500, net_pay: 2600, status: 'paid' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: stubs, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/me')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.year).toBeDefined();
            expect(res.body.meta.count).toBe(1);
        });
        it('should filter by year', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/me?year=2024')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.year).toBe(2024);
        });
    });
    // =========================================================================
    // GET /me/latest
    // =========================================================================
    describe('GET /me/latest', () => {
        it('should return latest pay stub', async () => {
            const latest = {
                id: '1',
                employee_name: 'Spen Zosky',
                gross_pay: 3500,
                net_pay: 2600,
                period: '2025-06',
                department: 'IT',
            };
            mockQuery.mockResolvedValueOnce({ rows: [latest], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/me/latest')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.employee_name).toBe('Spen Zosky');
        });
        it('should return null data when no stubs exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/me/latest')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeNull();
        });
    });
    // =========================================================================
    // GET /me/summary
    // =========================================================================
    describe('GET /me/summary', () => {
        it('should return annual summary', async () => {
            const summary = {
                year: 2025,
                pay_periods: 6,
                total_gross: 21000,
                total_net: 15600,
                avg_gross: 3500,
                avg_net: 2600,
            };
            mockQuery.mockResolvedValueOnce({ rows: [summary], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/me/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total_gross).toBe(21000);
        });
        it('should return zeros when no data', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/me/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.pay_periods).toBe(0);
            expect(res.body.data.total_gross).toBe(0);
        });
    });
    // =========================================================================
    // GET /
    // =========================================================================
    describe('GET /', () => {
        it('should list pay stubs with pagination', async () => {
            const stubs = [{ id: '1', employee_name: 'Mario Rossi', period: '2025-06', gross_pay: 3500 }];
            mockQuery
                .mockResolvedValueOnce({ rows: stubs, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(100);
        });
        it('should filter by employee_id', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/?employee_id=${EMP_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should filter by status and year', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/?status=paid&year=2025')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /:id
    // =========================================================================
    describe('GET /:id', () => {
        it('should return pay stub details', async () => {
            const stub = {
                id: VALID_UUID,
                employee_name: 'Mario Rossi',
                gross_pay: 3500,
                net_pay: 2600,
                department: 'IT',
            };
            mockQuery.mockResolvedValueOnce({ rows: [stub], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.gross_pay).toBe(3500);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /employee/:employeeId
    // =========================================================================
    describe('GET /employee/:employeeId', () => {
        it('should return employee pay stubs', async () => {
            const stubs = [{ id: '1', employee_name: 'Mario Rossi', period: '2025-06' }];
            mockQuery.mockResolvedValueOnce({ rows: stubs, rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/employee/${EMP_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should filter by year', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/employee/${EMP_UUID}?year=2024`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /employee/:employeeId/summary
    // =========================================================================
    describe('GET /employee/:employeeId/summary', () => {
        it('should return annual summary for employee', async () => {
            const summary = { year: 2025, pay_periods: 6, total_gross: 21000, total_net: 15600 };
            mockQuery.mockResolvedValueOnce({ rows: [summary], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/employee/${EMP_UUID}/summary`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.pay_periods).toBe(6);
        });
        it('should return zeros when no data', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/pay-stubs/employee/${EMP_UUID}/summary`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.pay_periods).toBe(0);
        });
    });
    // =========================================================================
    // POST /
    // =========================================================================
    describe('POST /', () => {
        it('should create a pay stub', async () => {
            const created = {
                id: VALID_UUID,
                employee_id: EMP_UUID,
                period: '2025-06',
                gross_pay: 3500,
                status: 'draft',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: EMP_UUID }], rowCount: 1 }) // employee check
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // INSERT
            const res = await supertest(app)
                .post('/api/v1/pay-stubs/')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMP_UUID, period: '2025-06', gross_pay: 3500 });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.gross_pay).toBe(3500);
        });
        it('should return 404 when employee not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/pay-stubs/')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMP_UUID, period: '2025-06', gross_pay: 3500 });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should reject when required fields missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/pay-stubs/')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMP_UUID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject invalid employee_id format (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/pay-stubs/')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: 'not-a-uuid', period: '2025-06', gross_pay: 3500 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // PATCH /:id
    // =========================================================================
    describe('PATCH /:id', () => {
        it('should update pay stub', async () => {
            const updated = { id: VALID_UUID, gross_pay: 4000, status: 'paid' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 }) // exists check
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // UPDATE
            const res = await supertest(app)
                .patch(`/api/v1/pay-stubs/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ gross_pay: 4000, status: 'paid' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.gross_pay).toBe(4000);
            expect(res.body.message).toMatch(/updated/i);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/pay-stubs/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'paid' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when no fields to update', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/pay-stubs/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/[Nn]o fields/);
        });
    });
    // =========================================================================
    // GET /stats/overview
    // =========================================================================
    describe('GET /stats/overview', () => {
        it('should return pay stub statistics', async () => {
            const summary = {
                total_stubs: '200',
                employees_paid: '50',
                total_gross: 700000,
                total_net: 520000,
            };
            const monthly = [{ month: 1, count: '50', total_gross: 175000 }];
            mockQuery
                .mockResolvedValueOnce({ rows: [summary], rowCount: 1 })
                .mockResolvedValueOnce({ rows: monthly, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/pay-stubs/stats/overview')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.year).toBeDefined();
            expect(res.body.data.summary.total_stubs).toBe('200');
            expect(res.body.data.monthly).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=pay-stubs.test.js.map