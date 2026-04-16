/**
 * Tenant Onboarding Routes - Unit Tests
 *
 * Tests:
 *   POST /generate-prototype   - Generate org prototype from NACE + company size
 *   GET  /status               - Onboarding status for current tenant
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
jest.unstable_mockModule(resolve('../../services/cache.js'), () => ({
    cached: jest.fn().mockImplementation(async (_key, fn) => fn()),
    cachedForTenant: jest
        .fn()
        .mockImplementation(async (_tenantId, _key, fn) => fn()),
    CACHE_TTL: { SHORT: 60, MODERATE: 300, REFERENCE: 900, STATIC: 3600 },
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/tenant-onboarding.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const { cachedForTenant } = await import('../../services/cache.js');
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/tenant-onboarding', authMiddleware);
    app.use('/api/v1/tenant-onboarding', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/tenant-onboarding', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Tenant Onboarding Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        cachedForTenant.mockImplementation(async (_tenantId, _key, fn) => fn());
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).post('/api/v1/tenant-onboarding/generate-prototype');
        expect(res.status).toBe(401);
    });
    // =========================================================================
    // POST /generate-prototype
    // =========================================================================
    describe('POST /generate-prototype', () => {
        it('should generate prototype successfully', async () => {
            // No nacePrimary/companySize in body, so no UPDATE/INSERT query
            // Check existing profile — none
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // Check tenant NACE in tenant_industry_classifications
            mockQuery.mockResolvedValueOnce({
                rows: [{ classification_code: '64.19' }],
                rowCount: 1,
            });
            // fn_generate_org_prototype result
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        result: {
                            summary: {
                                departments_generated: 8,
                                positions_generated: 24,
                                skill_requirements_generated: 120,
                            },
                        },
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-onboarding/generate-prototype')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.departments_generated).toBe(8);
            expect(res.body.data.summary.positions_generated).toBe(24);
            expect(res.body.message).toContain('8 departments');
        });
        it('should update tenant and generate prototype when body has nacePrimary', async () => {
            // INSERT INTO tenant_industry_classifications (nacePrimary provided)
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // UPDATE tenants SET company_size (companySize provided)
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // Check existing profile — none
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // Check tenant NACE in tenant_industry_classifications
            mockQuery.mockResolvedValueOnce({
                rows: [{ classification_code: '64.19' }],
                rowCount: 1,
            });
            // fn_generate_org_prototype result
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        result: {
                            summary: {
                                departments_generated: 5,
                                positions_generated: 15,
                                skill_requirements_generated: 60,
                            },
                        },
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-onboarding/generate-prototype')
                .set('Authorization', `Bearer ${token}`)
                .send({ nacePrimary: '64.19', companySize: 'MEDIUM' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should return 409 when prototype already exists', async () => {
            // Check existing profile — found
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'profile-001',
                        generated_at: '2026-03-20T10:00:00Z',
                        departments_generated: 8,
                        positions_generated: 24,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-onboarding/generate-prototype')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(409);
        });
        it('should return 400 when tenant has no NACE configured', async () => {
            // Check existing profile — none
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // Check tenant NACE in tenant_industry_classifications — no rows
            mockQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });
            const res = await supertest(app)
                .post('/api/v1/tenant-onboarding/generate-prototype')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('NACE');
        });
        it('should return 400 for invalid companySize', async () => {
            const res = await supertest(app)
                .post('/api/v1/tenant-onboarding/generate-prototype')
                .set('Authorization', `Bearer ${token}`)
                .send({ companySize: 'INVALID' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // GET /status
    // =========================================================================
    describe('GET /status', () => {
        it('should return completed status with profile', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'profile-001',
                        nace_primary: '64.19',
                        company_size: 'LARGE',
                        onboarding_completed_at: '2026-03-20T12:00:00Z',
                        departments_generated: 8,
                        positions_generated: 24,
                        skill_requirements_generated: 120,
                        generated_at: '2026-03-20T10:00:00Z',
                        generator_version: '1.0',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/tenant-onboarding/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.completed).toBe(true);
            expect(res.body.data.nacePrimary).toBe('64.19');
            expect(res.body.data.companySize).toBe('LARGE');
            expect(res.body.data.profile).not.toBeNull();
            expect(res.body.data.profile.departmentsGenerated).toBe(8);
            expect(res.body.data.profile.positionsGenerated).toBe(24);
        });
        it('should return not-completed status without profile', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: null,
                        nace_primary: '64.19',
                        company_size: 'SMALL',
                        onboarding_completed_at: null,
                        departments_generated: null,
                        positions_generated: null,
                        skill_requirements_generated: null,
                        generated_at: null,
                        generator_version: null,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/tenant-onboarding/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.completed).toBe(false);
            expect(res.body.data.profile).toBeNull();
        });
    });
});
//# sourceMappingURL=tenant-onboarding.test.js.map