/**
 * Talent Skill Profiles Routes - Behavioral Tests
 * Note: This route uses req.dbClient for queries.
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
const { default: talentRoutes } = await import('../../routes/talent-skill-profiles.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/talent/skill-profiles', authMiddleware);
    app.use('/api/v1/talent/skill-profiles', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/talent/skill-profiles', talentRoutes);
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
function buildProfile() {
    return {
        employee_id: EMPLOYEE_ID,
        first_name: 'Mario',
        last_name: 'Rossi',
        job_title: 'Developer',
        email: 'mario.rossi@rtl-bank.com',
        department_name: 'IT',
        org_unit_id: DEFAULT_IDS.DEPARTMENT_ID,
        total_skills: '5',
        verified_skills: '3',
        pending_skills: '2',
        avg_knowledge: '3.50',
        avg_skill: '4.00',
        avg_ability: '3.80',
        avg_behavior: '3.60',
        avg_attitude: '4.20',
        avg_composite_score: '3.82',
        last_updated: '2026-02-01T00:00:00Z',
    };
}
describe('Talent Skill Profiles Routes', () => {
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
            expect((await supertest(app).get('/api/v1/talent/skill-profiles')).status).toBe(401);
        });
    });
    describe('GET /talent/skill-profiles', () => {
        it('should return profiles list with pagination', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [buildProfile()], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [
                    {
                        total_employees: '50',
                        employees_with_skills: '30',
                        total_skill_records: '150',
                        org_avg_score: '3.80',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/talent/skill-profiles')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });
        it('should support org_unit_id filter', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [
                    {
                        total_employees: '0',
                        employees_with_skills: '0',
                        total_skill_records: '0',
                        org_avg_score: null,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/talent/skill-profiles?org_unit_id=${DEFAULT_IDS.DEPARTMENT_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
        it('should support search filter', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [buildProfile()], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [
                    {
                        total_employees: '1',
                        employees_with_skills: '1',
                        total_skill_records: '5',
                        org_avg_score: '3.80',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/talent/skill-profiles?search=Mario')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
        it('should skip stats when include_stats=false', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [buildProfile()], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/talent/skill-profiles?include_stats=false')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.stats).toBeUndefined();
        });
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/talent/skill-profiles')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    describe('GET /talent/skill-profiles/:id', () => {
        it('should return detailed skill profile', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: EMPLOYEE_ID,
                        first_name: 'Mario',
                        last_name: 'Rossi',
                        job_title: 'Dev',
                        email: 'x@y.com',
                        org_unit_id: 'd1',
                        department_name: 'IT',
                        hire_date: '2020-01-01',
                        is_active: true,
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [
                    {
                        profile_id: 's1',
                        skill_id: 'sk1',
                        skill_name: 'TypeScript',
                        skill_name_it: null,
                        skill_description: null,
                        skill_type: 'skill',
                        skill_group: null,
                        knowledge_level: '4',
                        skill_level: '4',
                        ability_level: '3',
                        behavior_level: '3',
                        attitude_level: '4',
                        composite_score: '3.6',
                        source: 'assessment',
                        source_description: null,
                        acquired_date: null,
                        last_demonstrated: null,
                        verification_status: 'verified',
                        verified_by: null,
                        verified_at: null,
                        confidence_score: '0.8',
                        is_primary: true,
                        is_target: false,
                        target_level: null,
                        evidence_type: null,
                        evidence_url: null,
                        created_at: '2026-01-01',
                        updated_at: '2026-01-01',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/talent/skill-profiles/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.employee.id).toBe(EMPLOYEE_ID);
            expect(res.body.data.skills).toHaveLength(1);
            expect(res.body.data.summary.total_skills).toBe(1);
        });
        it('should return 404 when employee not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/talent/skill-profiles/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return empty skills array for employee with no skills', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: EMPLOYEE_ID,
                        first_name: 'Mario',
                        last_name: 'Rossi',
                        job_title: 'Dev',
                        email: 'x@y.com',
                        org_unit_id: null,
                        department_name: null,
                        hire_date: '2020-01-01',
                        is_active: true,
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/talent/skill-profiles/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.skills).toHaveLength(0);
            expect(res.body.data.summary.avg_composite_score).toBe(0);
        });
        it('should return 400 when no tenant context', async () => {
            // Create a separate app without tenant injection
            const noTenantApp = express();
            noTenantApp.use(express.json());
            noTenantApp.use((req, _res, next) => {
                req.requestId = 'test';
                next();
            });
            noTenantApp.use('/api/v1/talent/skill-profiles', authMiddleware);
            noTenantApp.use('/api/v1/talent/skill-profiles', (req, _res, next) => {
                req.dbClient = { query: mockQuery, release: jest.fn() };
                next();
            });
            noTenantApp.use('/api/v1/talent/skill-profiles', talentRoutes);
            noTenantApp.use((err, _req, res, _next) => {
                res
                    .status(err.statusCode || err.httpStatus || 500)
                    .json({ success: false, error: err.message });
            });
            const res = await supertest(noTenantApp)
                .get(`/api/v1/talent/skill-profiles/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
        });
    });
});
//# sourceMappingURL=talent-skill-profiles.test.js.map