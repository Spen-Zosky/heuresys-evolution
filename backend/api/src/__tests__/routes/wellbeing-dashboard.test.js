/**
 * Wellbeing Dashboard Routes - Behavioral Tests
 * Uses requireTenant, dbClient.
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
const { default: wellbeingDashboardRoutes } = await import('../../routes/wellbeing-dashboard.js');
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
    app.use('/api/v1/wellbeing-extended', authMiddleware);
    app.use('/api/v1/wellbeing-extended', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/wellbeing-extended', wellbeingDashboardRoutes);
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
describe('Wellbeing Dashboard Routes', () => {
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
            expect((await supertest(app).get('/api/v1/wellbeing-extended/dashboard')).status).toBe(401);
        });
    });
    describe('GET /wellbeing-extended/dashboard', () => {
        it('should return dashboard with all metrics', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        employees_tracking: '40',
                        avg_mood: '3.80',
                        avg_energy: '3.50',
                        avg_stress: '4.20',
                        avg_work_life_balance: '3.60',
                        avg_sleep_quality: '3.40',
                        total_checkins: '200',
                        checkins_this_week: '30',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [
                    { overall_risk: 'low', count: '25' },
                    { overall_risk: 'moderate', count: '10' },
                ],
                rowCount: 2,
            })
                .mockResolvedValueOnce({
                rows: [
                    {
                        week: '2026-02-09',
                        avg_mood: '3.90',
                        avg_energy: '3.60',
                        avg_stress: '4.10',
                        checkins: '30',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ department: 'IT', avg_mood: '4.00', avg_stress: '3.80', employees: '15' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/wellbeing-extended/dashboard')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.company_average).toBeDefined();
            expect(res.body.data.burnout_distribution).toHaveLength(2);
            expect(res.body.data.trends).toHaveLength(1);
            expect(res.body.data.team_metrics).toHaveLength(1);
        });
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/wellbeing-extended/dashboard')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    describe('GET /wellbeing-extended/checkins', () => {
        it('should return checkins list', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'c1',
                        employee_name: 'Mario Rossi',
                        mood_score: 4,
                        energy_level: 3,
                        department: 'IT',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/wellbeing-extended/checkins')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should support employee_id filter', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/wellbeing-extended/checkins?employee_id=${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('POST /wellbeing-extended/checkins', () => {
        it('should create a wellbeing check-in (201)', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'c1', employee_id: EMPLOYEE_ID, mood_score: 4 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/checkins')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: EMPLOYEE_ID,
                mood_score: 4,
                energy_level: 3,
                stress_level: 5,
                work_life_balance: 3,
                sleep_quality: 4,
            });
            expect(res.status).toBe(201);
        });
        it('should return 400 when employee_id missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/checkins')
                .set('Authorization', `Bearer ${token}`)
                .send({ mood_score: 4, energy_level: 3 });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /wellbeing-extended/burnout-risk', () => {
        it('should return burnout assessments', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 'ba1', employee_name: 'Mario Rossi', overall_risk: 'moderate', department: 'IT' },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/wellbeing-extended/burnout-risk')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should support risk_level filter', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/wellbeing-extended/burnout-risk?risk_level=high')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('POST /wellbeing-extended/burnout-risk/assess', () => {
        it('should create burnout assessment (201)', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'ba1', employee_id: EMPLOYEE_ID, overall_risk: 'moderate' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/burnout-risk/assess')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: EMPLOYEE_ID,
                exhaustion_score: 5,
                cynicism_score: 4,
                inefficacy_score: 3,
                workload_factor: 3,
                autonomy_factor: 3,
                recognition_factor: 4,
            });
            expect(res.status).toBe(201);
            expect(res.body.risk_level).toBeDefined();
        });
        it('should return 400 when employee_id missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/burnout-risk/assess')
                .set('Authorization', `Bearer ${token}`)
                .send({ exhaustion_score: 5, cynicism_score: 4, inefficacy_score: 3 });
            expect(res.status).toBe(400);
        });
        it('should calculate critical risk for high scores', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'ba1', employee_id: EMPLOYEE_ID, overall_risk: 'critical' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/burnout-risk/assess')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: EMPLOYEE_ID,
                exhaustion_score: 9,
                cynicism_score: 8,
                inefficacy_score: 9,
                workload_factor: 5,
                autonomy_factor: 1,
                recognition_factor: 1,
            });
            expect(res.status).toBe(201);
            expect(res.body.risk_level).toBe('critical');
            expect(res.body.recommendations.length).toBeGreaterThan(0);
        });
    });
    describe('GET /wellbeing-extended/goals', () => {
        it('should return wellbeing goals', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'g1', title: 'Exercise 3x/week', goal_type: 'fitness', status: 'active' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/wellbeing-extended/goals')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('POST /wellbeing-extended/goals', () => {
        it('should create a wellbeing goal (201)', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'g1', title: 'Exercise 3x/week' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/goals')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: EMPLOYEE_ID,
                title: 'Exercise 3x/week',
                goal_type: 'fitness',
                target_value: 12,
                unit: 'sessions',
                target_date: '2026-06-30',
            });
            expect(res.status).toBe(201);
        });
        it('should return 400 when title missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/wellbeing-extended/goals')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /wellbeing-extended/trends/:employeeId', () => {
        it('should return personal wellbeing trends', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        checkin_date: '2026-02-20',
                        mood_score: 4,
                        energy_level: 3,
                        stress_level: 5,
                        work_life_balance: 3,
                        sleep_quality: 4,
                    },
                    {
                        checkin_date: '2026-02-21',
                        mood_score: 3,
                        energy_level: 4,
                        stress_level: 4,
                        work_life_balance: 4,
                        sleep_quality: 3,
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get(`/api/v1/wellbeing-extended/trends/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.daily).toHaveLength(2);
            expect(res.body.data.summary).toBeDefined();
            expect(res.body.data.summary.checkins_count).toBe(2);
        });
    });
});
//# sourceMappingURL=wellbeing-dashboard.test.js.map