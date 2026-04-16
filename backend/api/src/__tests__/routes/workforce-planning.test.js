/**
 * Workforce Planning Routes - Behavioral Tests
 * Uses requireTenant, dbClient, and WorkforcePlanningService (with pool).
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
const mockGetInventory = jest.fn();
const mockComputeGapRisk = jest.fn();
const mockGenerateHiring = jest.fn();
const mockGenerateTraining = jest.fn();
const mockGetPlans = jest.fn();
const mockGetPlanById = jest.fn();
const mockCreatePlan = jest.fn();
const mockUpdatePlanStatus = jest.fn();
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
jest.unstable_mockModule(resolve('../../services/workforce-planning/index.js'), () => ({
    WorkforcePlanningService: jest.fn().mockImplementation(() => ({
        getSkillInventory: mockGetInventory,
        computeGapRisk: mockComputeGapRisk,
        generateHiringRecommendations: mockGenerateHiring,
        generateTrainingInvestments: mockGenerateTraining,
        getWorkforcePlans: mockGetPlans,
        getWorkforcePlanById: mockGetPlanById,
        createWorkforcePlan: mockCreatePlan,
        updatePlanStatus: mockUpdatePlanStatus,
    })),
}));
const { default: express } = await import('express');
const { default: workforcePlanningRoutes } = await import('../../routes/workforce-planning.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const PLAN_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
const SKILL_ID = '88888888-aaaa-bbbb-cccc-dddddddddddd';
const DEPT_ID = DEFAULT_IDS.DEPARTMENT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/workforce-planning', authMiddleware);
    app.use('/api/v1/workforce-planning', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/workforce-planning', workforcePlanningRoutes);
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
describe('Workforce Planning Routes', () => {
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
            expect((await supertest(app).get('/api/v1/workforce-planning/inventory')).status).toBe(401);
        });
    });
    describe('GET /workforce-planning/inventory', () => {
        it('should return skill inventory', async () => {
            mockGetInventory.mockResolvedValueOnce([
                { skill_id: 's1', skill_name: 'TypeScript', employee_count: 20, avg_proficiency: 3.5 },
            ]);
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/inventory')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should return 500 on service error', async () => {
            mockGetInventory.mockRejectedValueOnce(new Error('Service error'));
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/inventory')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    describe('POST /workforce-planning/gap-risk', () => {
        it('should compute gap and risk', async () => {
            mockComputeGapRisk.mockResolvedValueOnce([
                { skill_name: 'TypeScript', gap_count: 5, proficiency_gap: 2, risk_level: 'high' },
                { skill_name: 'Python', gap_count: 2, proficiency_gap: 1, risk_level: 'low' },
            ]);
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/gap-risk')
                .set('Authorization', `Bearer ${token}`)
                .send({ requirements: [{ skill_id: SKILL_ID, required_level: 4, headcount_needed: 10 }] });
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.summary.high).toBe(1);
            expect(res.body.summary.low).toBe(1);
        });
        it('should return 400 when requirements empty', async () => {
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/gap-risk')
                .set('Authorization', `Bearer ${token}`)
                .send({ requirements: [] });
            expect(res.status).toBe(400);
        });
    });
    describe('POST /workforce-planning/hiring-recommendations', () => {
        it('should generate hiring recommendations', async () => {
            mockGenerateHiring.mockResolvedValueOnce([
                { skill_name: 'TypeScript', positions_needed: 3, total_estimated_cost: 150000 },
            ]);
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/hiring-recommendations')
                .set('Authorization', `Bearer ${token}`)
                .send({ gap_assessments: [{ skill_name: 'TypeScript', gap_count: 5 }] });
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.summary.total_positions).toBe(3);
        });
        it('should return 400 when gap_assessments missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/hiring-recommendations')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
    });
    describe('POST /workforce-planning/training-investments', () => {
        it('should generate training investment suggestions', async () => {
            mockGenerateTraining.mockResolvedValueOnce([
                {
                    skill_name: 'TypeScript',
                    employees_to_train: 10,
                    estimated_cost: 5000,
                    estimated_training_hours: 40,
                    roi_estimate: 2.5,
                },
            ]);
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/training-investments')
                .set('Authorization', `Bearer ${token}`)
                .send({ gap_assessments: [{ skill_name: 'TypeScript', gap_count: 5 }] });
            expect(res.status).toBe(200);
            expect(res.body.summary.total_employees).toBe(10);
            expect(res.body.summary.total_training_hours).toBe(40);
        });
        it('should return 400 when gap_assessments missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/training-investments')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
    });
    describe('GET /workforce-planning/plans', () => {
        it('should return workforce plans', async () => {
            mockGetPlans.mockResolvedValueOnce([{ id: PLAN_ID, name: 'Q1 2026 Plan', status: 'active' }]);
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/plans')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('GET /workforce-planning/plans/:planId', () => {
        it('should return plan by ID', async () => {
            mockGetPlanById.mockResolvedValueOnce({
                id: PLAN_ID,
                name: 'Q1 2026 Plan',
                status: 'active',
            });
            const res = await supertest(app)
                .get(`/api/v1/workforce-planning/plans/${PLAN_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(PLAN_ID);
        });
        it('should return 404 when not found', async () => {
            mockGetPlanById.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/workforce-planning/plans/${PLAN_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('POST /workforce-planning/plans', () => {
        it('should create a workforce plan (201)', async () => {
            mockCreatePlan.mockResolvedValueOnce({ id: PLAN_ID, name: 'Q2 Plan', status: 'draft' });
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/plans')
                .set('Authorization', `Bearer ${token}`)
                .send({
                name: 'Q2 Plan',
                target_date: '2026-06-30',
                requirements: [{ skill_id: SKILL_ID, headcount_needed: 5 }],
            });
            expect(res.status).toBe(201);
        });
        it('should return 400 when name missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/plans')
                .set('Authorization', `Bearer ${token}`)
                .send({ target_date: '2026-06-30' });
            expect(res.status).toBe(400);
        });
    });
    describe('PATCH /workforce-planning/plans/:planId/status', () => {
        it('should update plan status', async () => {
            mockUpdatePlanStatus.mockResolvedValueOnce(true);
            const res = await supertest(app)
                .patch(`/api/v1/workforce-planning/plans/${PLAN_ID}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'active' });
            expect(res.status).toBe(200);
        });
        it('should return 404 when plan not found', async () => {
            mockUpdatePlanStatus.mockResolvedValueOnce(false);
            const res = await supertest(app)
                .patch(`/api/v1/workforce-planning/plans/${PLAN_ID}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'active' });
            expect(res.status).toBe(404);
        });
        it('should return 400 with invalid status', async () => {
            const res = await supertest(app)
                .patch(`/api/v1/workforce-planning/plans/${PLAN_ID}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'invalid_status' });
            expect(res.status).toBe(400);
        });
    });
    describe('POST /workforce-planning/simulate', () => {
        it('should run full simulation', async () => {
            mockComputeGapRisk.mockResolvedValueOnce([
                { skill_name: 'TypeScript', gap_count: 5, proficiency_gap: 2, risk_level: 'high' },
            ]);
            mockGenerateHiring.mockResolvedValueOnce([
                { skill_name: 'TypeScript', positions_needed: 3, total_estimated_cost: 150000 },
            ]);
            mockGenerateTraining.mockResolvedValueOnce([
                {
                    skill_name: 'TypeScript',
                    employees_to_train: 10,
                    estimated_cost: 5000,
                    estimated_training_hours: 40,
                    roi_estimate: 2.5,
                },
            ]);
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/simulate')
                .set('Authorization', `Bearer ${token}`)
                .send({ requirements: [{ skill_id: SKILL_ID, required_level: 4, headcount_needed: 10 }] });
            expect(res.status).toBe(200);
            expect(res.body.data.gap_analysis).toHaveLength(1);
            expect(res.body.data.hiring_recommendations).toHaveLength(1);
            expect(res.body.data.training_investments).toHaveLength(1);
            expect(res.body.data.summary.total_investment).toBeGreaterThan(0);
        });
        it('should return 400 when requirements empty', async () => {
            const res = await supertest(app)
                .post('/api/v1/workforce-planning/simulate')
                .set('Authorization', `Bearer ${token}`)
                .send({ requirements: [] });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /workforce-planning/analytics/headcount-trend', () => {
        it('should return headcount trend with forecast', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        period: '2026-01',
                        label: 'Jan 2026',
                        headcount: 250,
                        hires: 5,
                        attrition: 2,
                        type: 'historical',
                    },
                    {
                        period: '2026-02',
                        label: 'Feb 2026',
                        headcount: 253,
                        hires: 4,
                        attrition: 1,
                        type: 'historical',
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/analytics/headcount-trend')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.historical).toHaveLength(2);
            expect(res.body.data.forecast.length).toBeGreaterThan(0);
            expect(res.body.data.combined.length).toBeGreaterThan(2);
        });
    });
    describe('GET /workforce-planning/analytics/attrition-forecast', () => {
        it('should return attrition forecast by department', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        org_unit_id: DEPT_ID,
                        department_name: 'IT',
                        current_headcount: 50,
                        terminations_12m: 5,
                        attrition_rate_12m: '10.0',
                        risk_level: 'medium',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ total_headcount: '250', total_terminations: '20' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/analytics/attrition-forecast')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.by_org_unit).toHaveLength(1);
            expect(res.body.data.company_wide.total_headcount).toBe(250);
        });
    });
    describe('GET /workforce-planning/analytics/capacity', () => {
        it('should return capacity utilization', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        org_unit_id: DEPT_ID,
                        department_name: 'IT',
                        current_headcount: '45',
                        target_headcount: '50',
                        open_positions: '3',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/analytics/capacity')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.by_org_unit).toHaveLength(1);
            expect(res.body.data.summary).toBeDefined();
        });
    });
    describe('GET /workforce-planning/analytics/department/:id', () => {
        it('should return department detail', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: DEPT_ID,
                        name: 'IT',
                        code: 'IT',
                        current_headcount: '45',
                        target_headcount: '50',
                        terminations_12m: '3',
                        hires_12m: '8',
                        avg_tenure_years: '4.5',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ role: 'Developer', count: '20' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ tenure_band: '1-3 years', count: '15' }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/workforce-planning/analytics/department/${DEPT_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.department.name).toBe('IT');
            expect(res.body.data.roles).toHaveLength(1);
            expect(res.body.data.tenure_distribution).toHaveLength(1);
        });
        it('should return 404 when department not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/workforce-planning/analytics/department/${DEPT_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /workforce-planning/analytics/org-units', () => {
        it('should return departments list', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: DEPT_ID, name: 'IT', employee_count: '45' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/workforce-planning/analytics/org-units')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=workforce-planning.test.js.map