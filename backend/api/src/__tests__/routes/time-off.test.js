/**
 * Time Off Routes - Behavioral Tests
 * Uses requireTenant, dbClient. Has self-service endpoints with user context.
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
const { default: timeOffRoutes } = await import('../../routes/time-off.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const REQUEST_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
const USER_ID = DEFAULT_IDS.USER_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/time-off', authMiddleware);
    app.use('/api/v1/time-off', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        // Route reads (req as any).user?.id — map from JWT's userId
        if (req.user?.userId) {
            req.user.id = req.user.userId;
        }
        next();
    });
    app.use('/api/v1/time-off', timeOffRoutes);
    app.use((err, _req, res, _next) => {
        res
            .status(err.statusCode || err.httpStatus || 500)
            .json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
function tok() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('Time Off Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
        resetFactories();
        app = createTestApp();
        token = tok();
    });
    describe('Auth', () => {
        it('should return 401 without token', async () => {
            expect((await supertest(app).get('/api/v1/time-off/stats')).status).toBe(401);
        });
    });
    describe('GET /time-off/stats', () => {
        it('should return time off statistics', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        employees_with_balances: '50',
                        leave_types: '3',
                        total_entitled_days: '1300',
                        total_used_days: '400',
                        total_pending_days: '50',
                        avg_remaining_days: '17.0',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [
                    {
                        total_requests: '80',
                        pending_requests: '10',
                        approved_requests: '60',
                        rejected_requests: '10',
                        total_days_requested: '200',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/time-off/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.balances).toBeDefined();
            expect(res.body.data.requests).toBeDefined();
        });
        it('should support year filter', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ employees_with_balances: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ total_requests: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/time-off/stats?year=2025')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.year).toBe(2025);
        });
    });
    describe('GET /time-off/balances', () => {
        it('should return paginated balances', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    { id: 'b1', employee_name: 'Mario Rossi', leave_type: 'vacation', total_days: '26' },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/time-off/balances')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });
    });
    describe('GET /time-off/requests', () => {
        it('should return paginated requests', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: REQUEST_ID,
                        employee_name: 'Mario Rossi',
                        status: 'pending',
                        leave_type: 'vacation',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/time-off/requests')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });
        it('should support status filter', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/time-off/requests?status=approved')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET /time-off/requests/:id', () => {
        it('should return single request', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: REQUEST_ID, employee_name: 'Mario Rossi', status: 'pending' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/time-off/requests/${REQUEST_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(REQUEST_ID);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/time-off/requests/${REQUEST_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /time-off/by-leave-type', () => {
        it('should return breakdown by leave type', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        leave_type: 'vacation',
                        employees: '50',
                        total_entitled: '1300',
                        total_used: '400',
                        total_pending: '50',
                        avg_remaining: '17.0',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/time-off/by-leave-type')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].leave_type).toBe('vacation');
        });
    });
    describe('GET /time-off/my/balances', () => {
        it('should return current user balances', async () => {
            // getEmployeeId query
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            // actual balances query
            mockQuery.mockResolvedValueOnce({
                rows: [{ leave_type: 'vacation', total_days: '26', used_days: '5', available_days: '21' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/time-off/my/balances')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should return 404 when employee not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/time-off/my/balances')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /time-off/my/requests', () => {
        it('should return current user requests', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: REQUEST_ID, status: 'pending' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/time-off/my/requests')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('POST /time-off/my/requests', () => {
        it('should create a time off request (201)', async () => {
            // getEmployeeId
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            // check balance
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_days: '26',
                        carryover_days: '0',
                        accrued_days: '0',
                        adjustment_days: '0',
                        used_days: '5',
                        pending_days: '0',
                    },
                ],
                rowCount: 1,
            });
            // get manager
            mockQuery.mockResolvedValueOnce({ rows: [{ manager_id: 'mgr-1' }], rowCount: 1 });
            // insert request
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: REQUEST_ID, status: 'pending' }],
                rowCount: 1,
            });
            // update balance pending_days
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // create approval step
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/time-off/my/requests')
                .set('Authorization', `Bearer ${token}`)
                .send({
                leave_type: 'vacation',
                start_date: '2026-03-10',
                end_date: '2026-03-14',
                reason: 'Holiday',
            });
            expect(res.status).toBe(201);
        });
        it('should return 400 when balance insufficient', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_days: '26',
                        carryover_days: '0',
                        accrued_days: '0',
                        adjustment_days: '0',
                        used_days: '25',
                        pending_days: '0',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/time-off/my/requests')
                .set('Authorization', `Bearer ${token}`)
                .send({
                leave_type: 'vacation',
                start_date: '2026-03-01',
                end_date: '2026-03-10',
                reason: 'Holiday',
            });
            expect(res.status).toBe(400);
        });
        it('should return 404 when employee not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/time-off/my/requests')
                .set('Authorization', `Bearer ${token}`)
                .send({ leave_type: 'vacation', start_date: '2026-03-10', end_date: '2026-03-14' });
            expect(res.status).toBe(404);
        });
    });
    describe('GET /time-off/leave-types', () => {
        it('should return configured leave types', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ leave_type: 'vacation', name: 'Vacation', description: 'Annual leave' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/time-off/leave-types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].leave_type).toBe('vacation');
        });
        it('should return default types when none configured', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/time-off/leave-types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0].leave_type).toBe('vacation');
        });
    });
    describe('GET /time-off/holidays', () => {
        it('should return Italian public holidays', async () => {
            const res = await supertest(app)
                .get('/api/v1/time-off/holidays')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(10);
            expect(res.body.data[0].name).toBe('Capodanno');
        });
    });
    describe('POST /time-off/requests/:id/approve', () => {
        it('should approve a pending request', async () => {
            // getEmployeeId
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            // verify approver + pending
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: REQUEST_ID,
                        days_requested: '5',
                        employee_id: 'emp-other',
                        leave_type: 'vacation',
                        status: 'pending',
                    },
                ],
                rowCount: 1,
            });
            // update request status
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // update balance
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // update approval step
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/time-off/requests/${REQUEST_ID}/approve`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
        it('should return 404 when request not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/time-off/requests/${REQUEST_ID}/approve`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('POST /time-off/requests/:id/reject', () => {
        it('should reject a pending request', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: REQUEST_ID, days_requested: '5', employee_id: 'emp-other', leave_type: 'vacation' },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/time-off/requests/${REQUEST_ID}/reject`)
                .set('Authorization', `Bearer ${token}`)
                .send({ reason: 'Team needs coverage' });
            expect(res.status).toBe(200);
        });
        it('should return 404 when request not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/time-off/requests/${REQUEST_ID}/reject`)
                .set('Authorization', `Bearer ${token}`)
                .send({ reason: 'Denied' });
            expect(res.status).toBe(404);
        });
    });
});
//# sourceMappingURL=time-off.test.js.map