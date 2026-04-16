/**
 * Tenant Setup Routes - Behavioral Tests
 * Note: Uses authMiddleware + requirePermission('PLATFORM', 'VIEW').
 * Imports from @heuresys/shared (CCNL_TYPES, CCNL_LEAVE_DEFAULTS).
 *
 * The route file mounts its own authMiddleware and requirePermission.
 * In the test environment USE_RBP_FRAMEWORK=false (set in setup.ts),
 * so requirePermission('PLATFORM', 'VIEW') falls back to
 * legacyRequireRole('SUPERUSER'). We therefore use a SUPERUSER token.
 *
 * pool.query (poolQuery) and req.dbClient.query (routeQuery) are
 * separate mocks so the legacy requireRole DB verification (skipped
 * in NODE_ENV=test) doesn't interfere with route-handler mocks.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSuperuserTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
/** Mock for pool.query — used by auth/rbp middleware (not consumed in test env) */
const poolQuery = jest.fn();
/** Mock for req.dbClient.query — used by route handlers */
const routeQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest
    .fn()
    .mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: poolQuery },
    appPool: { connect: mockConnect },
    testConnection: jest.fn().mockResolvedValue(true),
    testAppConnection: jest.fn().mockResolvedValue(true),
    closePool: jest.fn().mockResolvedValue(undefined),
    getAppClient: jest.fn(),
    withTenantClient: jest.fn(),
}));
jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
    getRedis: jest.fn().mockReturnValue(null),
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
const { default: tenantSetupRoutes } = await import('../../routes/tenant-setup.js');
const { generateToken } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/tenant-setup', (req, _res, next) => {
        req.dbClient = { query: routeQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/tenant-setup', tenantSetupRoutes);
    app.use((err, _req, res, _next) => {
        res
            .status(err.statusCode || err.httpStatus || 500)
            .json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
function tok() {
    return generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_ID }));
}
describe('Tenant Setup Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = tok();
    });
    describe('Auth', () => {
        it('should return 401 without token', async () => {
            expect((await supertest(app).get('/api/v1/tenant-setup/status')).status).toBe(401);
        });
    });
    describe('GET /tenant-setup/status', () => {
        it('should return setup wizard status', async () => {
            routeQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: TENANT_ID,
                        code: 'rtl-bank',
                        name: 'RTL Bank',
                        setup_completed: false,
                        setup_step: 1,
                        settings: {},
                        tax_id: null,
                        contact_email: null,
                        contact_phone: null,
                        address_street: null,
                        address_city: null,
                        address_postal_code: null,
                        address_country: null,
                        description: null,
                        industry_type: null,
                        nace_code: null,
                        region: null,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/tenant-setup/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.totalSteps).toBe(3);
            expect(res.body.data.steps).toHaveLength(3);
            expect(res.body.data.currentStep).toBe(1);
        });
        it('should return 404 when tenant not found', async () => {
            routeQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/tenant-setup/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 500 on DB error', async () => {
            routeQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/tenant-setup/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    describe('GET /tenant-setup/ccnl-types', () => {
        it('should return CCNL types list', async () => {
            const res = await supertest(app)
                .get('/api/v1/tenant-setup/ccnl-types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0]).toHaveProperty('value');
            expect(res.body.data[0]).toHaveProperty('defaults');
        });
    });
    describe('POST /tenant-setup/step/1', () => {
        it('should save company information', async () => {
            routeQuery.mockResolvedValueOnce({
                rows: [{ id: TENANT_ID, name: 'RTL Bank', setup_step: 1 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'RTL Bank', code: 'rtl-bank', contactEmail: 'info@rtl-bank.com' });
            expect(res.status).toBe(200);
            expect(res.body.data.nextStep).toBe(2);
        });
        it('should return 404 when tenant not found', async () => {
            routeQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'RTL Bank', code: 'rtl-bank' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when required fields missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'RTL Bank' });
            expect(res.status).toBe(400);
        });
        it('should return 400 with invalid tax ID format', async () => {
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'RTL Bank', code: 'rtl-bank', taxId: 'INVALID' });
            expect(res.status).toBe(400);
        });
        it('should accept request with optional address and contact objects', async () => {
            routeQuery.mockResolvedValueOnce({
                rows: [{ id: TENANT_ID, name: 'RTL Bank', setup_step: 1 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/1')
                .set('Authorization', `Bearer ${token}`)
                .send({
                name: 'RTL Bank',
                code: 'rtl-bank',
                address: { street: 'Via Roma 1', city: 'Milano' },
                contact: { email: 'info@rtl.com' },
            });
            expect(res.status).toBe(200);
        });
    });
    describe('POST /tenant-setup/step/2', () => {
        it('should save CCNL configuration with defaults', async () => {
            routeQuery
                .mockResolvedValueOnce({ rows: [{ settings: {} }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ setup_step: 2, settings: {} }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/2')
                .set('Authorization', `Bearer ${token}`)
                .send({ ccnlType: 'commercio' });
            expect(res.status).toBe(200);
            expect(res.body.data.nextStep).toBe(3);
            expect(res.body.data.leaveRules).toBeDefined();
        });
        it('should save CCNL configuration with custom rules', async () => {
            routeQuery
                .mockResolvedValueOnce({ rows: [{ settings: {} }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ setup_step: 2, settings: {} }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/2')
                .set('Authorization', `Bearer ${token}`)
                .send({
                ccnlType: 'commercio',
                customRules: { enabled: true },
                leaveRules: { ferie: 30, rol: 60, exFestivita: 35 },
            });
            expect(res.status).toBe(200);
        });
        it('should return 400 with invalid CCNL type', async () => {
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/2')
                .set('Authorization', `Bearer ${token}`)
                .send({ ccnlType: 'invalid_type' });
            expect(res.status).toBe(400);
        });
    });
    describe('POST /tenant-setup/step/3', () => {
        it('should complete setup wizard', async () => {
            routeQuery
                .mockResolvedValueOnce({ rows: [{ settings: {} }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/3')
                .set('Authorization', `Bearer ${token}`)
                .send({ startMonth: 1, payPeriod: 'monthly', holidayCalendar: 'italian_default' });
            expect(res.status).toBe(200);
            expect(res.body.data.setupCompleted).toBe(true);
        });
        it('should return 404 when tenant not found in step 3', async () => {
            routeQuery
                .mockResolvedValueOnce({ rows: [{ settings: {} }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/tenant-setup/step/3')
                .set('Authorization', `Bearer ${token}`)
                .send({ startMonth: 1, payPeriod: 'monthly', holidayCalendar: 'italian_default' });
            expect(res.status).toBe(404);
        });
    });
    describe('GET /tenant-setup/settings', () => {
        it('should return tenant settings', async () => {
            routeQuery.mockResolvedValueOnce({
                rows: [{ settings: { ccnl: { type: 'commercio' } } }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/tenant-setup/settings')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.ccnl.type).toBe('commercio');
        });
        it('should return 404 when tenant not found', async () => {
            routeQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/tenant-setup/settings')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('PUT /tenant-setup/settings', () => {
        it('should update tenant settings', async () => {
            routeQuery
                .mockResolvedValueOnce({
                rows: [{ settings: { ccnl: { type: 'commercio' } } }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ settings: { ccnl: { type: 'commercio' }, auditLog: { retentionYears: 5 } } }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .put('/api/v1/tenant-setup/settings')
                .set('Authorization', `Bearer ${token}`)
                .send({ settings: { auditLog: { retentionYears: 5, exportSchedule: 'monthly' } } });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return 400 without settings key', async () => {
            const res = await supertest(app)
                .put('/api/v1/tenant-setup/settings')
                .set('Authorization', `Bearer ${token}`)
                .send({ auditLog: { retentionYears: 5 } });
            expect(res.status).toBe(400);
        });
    });
});
//# sourceMappingURL=tenant-setup.test.js.map