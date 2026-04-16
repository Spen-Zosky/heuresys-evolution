/**
 * Report Subscriptions Routes - Unit Tests
 * Tests subscription CRUD, actions (pause/resume/trigger), and delivery history.
 *
 * Endpoints tested:
 *  GET    /report-subscriptions              - List subscriptions
 *  GET    /report-subscriptions/:id          - Get subscription
 *  POST   /report-subscriptions              - Create subscription
 *  PATCH  /report-subscriptions/:id          - Update subscription
 *  DELETE /report-subscriptions/:id          - Delete subscription
 *  POST   /report-subscriptions/:id/pause    - Pause
 *  POST   /report-subscriptions/:id/resume   - Resume
 *  POST   /report-subscriptions/:id/trigger  - Trigger
 *  GET    /report-subscriptions/:id/history  - Delivery history
 *  GET    /report-subscriptions/:id/stats    - Delivery stats
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
// Mock report subscriptions service
const mockListSubscriptions = jest.fn();
const mockGetSubscription = jest.fn();
const mockCreateSubscription = jest.fn();
const mockUpdateSubscription = jest.fn();
const mockDeleteSubscription = jest.fn();
const mockPauseSubscription = jest.fn();
const mockResumeSubscription = jest.fn();
const mockTriggerNow = jest.fn();
const mockGetDeliveryHistory = jest.fn();
const mockGetDeliveryStats = jest.fn();
jest.unstable_mockModule(resolve('../../services/report-subscriptions.js'), () => ({
    reportSubscriptionsService: {
        listSubscriptions: mockListSubscriptions,
        getSubscription: mockGetSubscription,
        createSubscription: mockCreateSubscription,
        updateSubscription: mockUpdateSubscription,
        deleteSubscription: mockDeleteSubscription,
        pauseSubscription: mockPauseSubscription,
        resumeSubscription: mockResumeSubscription,
        triggerNow: mockTriggerNow,
        getDeliveryHistory: mockGetDeliveryHistory,
        getDeliveryStats: mockGetDeliveryStats,
    },
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/report-subscriptions.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const SUB_ID = '77777777-8888-4999-aaaa-bbbbbbbbbbbb';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/report-subscriptions', authMiddleware);
    app.use('/api/v1/report-subscriptions', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery };
        next();
    });
    app.use('/api/v1/report-subscriptions', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('Report Subscriptions Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/report-subscriptions');
        expect(res.status).toBe(401);
    });
    // ==================== GET / ====================
    describe('GET /', () => {
        it('should return 200 with subscriptions', async () => {
            mockListSubscriptions.mockResolvedValueOnce({
                subscriptions: [{ id: SUB_ID, name: 'Weekly Report' }],
                total: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/report-subscriptions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.meta.total).toBe(1);
        });
        it('should return 500 on service error', async () => {
            mockListSubscriptions.mockRejectedValueOnce(new Error('Service error'));
            const res = await supertest(app)
                .get('/api/v1/report-subscriptions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    // ==================== GET /:id ====================
    describe('GET /:id', () => {
        it('should return 404 when not found', async () => {
            mockGetSubscription.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/report-subscriptions/${SUB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with subscription', async () => {
            mockGetSubscription.mockResolvedValueOnce({ id: SUB_ID, name: 'Weekly Report' });
            const res = await supertest(app)
                .get(`/api/v1/report-subscriptions/${SUB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Weekly Report');
        });
    });
    // ==================== POST / ====================
    describe('POST /', () => {
        const validBody = {
            report_id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
            name: 'Daily Report',
            schedule: { frequency: 'daily', time: '08:00' },
            delivery: { methods: ['email'], recipients: ['admin@test.com'] },
        };
        it('should return 400 when required fields missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/report-subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Incomplete' });
            expect(res.status).toBe(400);
        });
        it('should return 400 when schedule missing frequency', async () => {
            const res = await supertest(app)
                .post('/api/v1/report-subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...validBody, schedule: { time: '08:00' } });
            expect(res.status).toBe(400);
        });
        it('should return 400 when delivery methods empty', async () => {
            const res = await supertest(app)
                .post('/api/v1/report-subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...validBody, delivery: { methods: [] } });
            expect(res.status).toBe(400);
        });
        it('should return 201 on successful creation', async () => {
            mockCreateSubscription.mockResolvedValueOnce({ id: SUB_ID, ...validBody });
            const res = await supertest(app)
                .post('/api/v1/report-subscriptions')
                .set('Authorization', `Bearer ${token}`)
                .send(validBody);
            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Daily Report');
        });
    });
    // ==================== PATCH /:id ====================
    describe('PATCH /:id', () => {
        it('should return 404 when not found', async () => {
            mockUpdateSubscription.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .patch(`/api/v1/report-subscriptions/${SUB_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful update', async () => {
            mockUpdateSubscription.mockResolvedValueOnce({ id: SUB_ID, name: 'Updated' });
            const res = await supertest(app)
                .patch(`/api/v1/report-subscriptions/${SUB_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(200);
        });
    });
    // ==================== DELETE /:id ====================
    describe('DELETE /:id', () => {
        it('should return 404 when not found', async () => {
            mockDeleteSubscription.mockResolvedValueOnce(false);
            const res = await supertest(app)
                .delete(`/api/v1/report-subscriptions/${SUB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful delete', async () => {
            mockDeleteSubscription.mockResolvedValueOnce(true);
            const res = await supertest(app)
                .delete(`/api/v1/report-subscriptions/${SUB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
    });
    // ==================== POST /:id/pause ====================
    describe('POST /:id/pause', () => {
        it('should return 404 when not found', async () => {
            mockPauseSubscription.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .post(`/api/v1/report-subscriptions/${SUB_ID}/pause`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful pause', async () => {
            mockPauseSubscription.mockResolvedValueOnce({ id: SUB_ID, is_active: false });
            const res = await supertest(app)
                .post(`/api/v1/report-subscriptions/${SUB_ID}/pause`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/paused/i);
        });
    });
    // ==================== POST /:id/resume ====================
    describe('POST /:id/resume', () => {
        it('should return 404 when not found', async () => {
            mockResumeSubscription.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .post(`/api/v1/report-subscriptions/${SUB_ID}/resume`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful resume', async () => {
            mockResumeSubscription.mockResolvedValueOnce({ id: SUB_ID, is_active: true });
            const res = await supertest(app)
                .post(`/api/v1/report-subscriptions/${SUB_ID}/resume`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/resumed/i);
        });
    });
    // ==================== POST /:id/trigger ====================
    describe('POST /:id/trigger', () => {
        it('should return 200 on successful trigger', async () => {
            mockTriggerNow.mockResolvedValueOnce({ execution_id: 'exec-1', status: 'completed' });
            const res = await supertest(app)
                .post(`/api/v1/report-subscriptions/${SUB_ID}/trigger`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/triggered/i);
        });
    });
    // ==================== GET /:id/history ====================
    describe('GET /:id/history', () => {
        it('should return 200 with delivery history', async () => {
            mockGetDeliveryHistory.mockResolvedValueOnce([
                { id: 'h1', status: 'sent', delivered_at: '2025-06-01' },
            ]);
            const res = await supertest(app)
                .get(`/api/v1/report-subscriptions/${SUB_ID}/history`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
    // ==================== GET /:id/stats ====================
    describe('GET /:id/stats', () => {
        it('should return 200 with delivery stats', async () => {
            mockGetDeliveryStats.mockResolvedValueOnce({ total_deliveries: 50, success_rate: 0.98 });
            const res = await supertest(app)
                .get(`/api/v1/report-subscriptions/${SUB_ID}/stats`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total_deliveries).toBe(50);
        });
    });
});
//# sourceMappingURL=report-subscriptions.test.js.map