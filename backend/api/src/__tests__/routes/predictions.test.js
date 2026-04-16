/**
 * Predictions Routes - Unit Tests
 * Tests predictive analytics endpoints including models, turnover risk, performance predictions.
 *
 * Endpoints tested:
 *  GET  /predictions/models                        - List models
 *  POST /predictions/models                        - Register model
 *  PATCH /predictions/models/:id/status            - Update model status
 *  GET  /predictions/turnover/high-risk            - High risk employees
 *  POST /predictions/turnover/batch                - Batch turnover risk
 *  GET  /predictions/turnover/:employeeId          - Employee turnover risk
 *  GET  /predictions/performance/:employeeId       - Performance prediction
 *  GET  /predictions/summary                       - Prediction summary
 *  GET  /predictions/performance                   - All predictions
 *  POST /predictions/performance/generate          - Generate predictions
 *  GET  /predictions/flight-risk/:employeeId       - Flight risk
 *  GET  /predictions/skill-demand                  - Skill demand forecast
 *  GET  /predictions/ai-recommendations            - AI recommendations
 *  GET  /predictions/risk-distribution             - Risk distribution
 *  GET  /predictions/high-potentials               - High potentials
 *  GET  /predictions/accuracy                      - Model accuracy
 *  GET  /predictions/actions                       - Recommended actions
 *  GET  /predictions/factors                       - Prediction factors
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
// Mock predictive analytics service
const mockListModels = jest.fn();
const mockRegisterModel = jest.fn();
const mockUpdateModelStatus = jest.fn();
const mockGetHighRiskEmployees = jest.fn();
const mockBatchCalculateTurnoverRisk = jest.fn();
const mockCalculateTurnoverRisk = jest.fn();
const mockPredictPerformance = jest.fn();
const mockGetPredictionSummary = jest.fn();
jest.unstable_mockModule(resolve('../../services/predictive-analytics.js'), () => ({
    predictiveAnalyticsService: {
        listModels: mockListModels,
        registerModel: mockRegisterModel,
        updateModelStatus: mockUpdateModelStatus,
        getHighRiskEmployees: mockGetHighRiskEmployees,
        batchCalculateTurnoverRisk: mockBatchCalculateTurnoverRisk,
        calculateTurnoverRisk: mockCalculateTurnoverRisk,
        predictPerformance: mockPredictPerformance,
        getPredictionSummary: mockGetPredictionSummary,
    },
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/predictions.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = '11111111-2222-4333-a444-555555555555';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/predictions', authMiddleware);
    app.use('/api/v1/predictions', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery };
        next();
    });
    app.use('/api/v1/predictions', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('Predictions Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/predictions/models');
        expect(res.status).toBe(401);
    });
    // ==================== GET /models ====================
    describe('GET /models', () => {
        it('should return 200 with models list', async () => {
            mockListModels.mockResolvedValueOnce([
                { id: 'm1', name: 'perf-v1', type: 'performance', status: 'active' },
            ]);
            const res = await supertest(app)
                .get('/api/v1/predictions/models')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBe(1);
        });
        it('should return 500 on service error', async () => {
            mockListModels.mockRejectedValueOnce(new Error('Service error'));
            const res = await supertest(app)
                .get('/api/v1/predictions/models')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    // ==================== GET /turnover/high-risk ====================
    describe('GET /turnover/high-risk', () => {
        it('should return 200 with high risk employees', async () => {
            mockGetHighRiskEmployees.mockResolvedValueOnce([{ employee_id: 'e1', risk_score: 85 }]);
            const res = await supertest(app)
                .get('/api/v1/predictions/turnover/high-risk')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
    // ==================== POST /turnover/batch ====================
    describe('POST /turnover/batch', () => {
        it('should return 200 with batch results', async () => {
            mockBatchCalculateTurnoverRisk.mockResolvedValueOnce({ processed: 100, errors: 0 });
            const res = await supertest(app)
                .post('/api/v1/predictions/turnover/batch')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.processed).toBe(100);
        });
    });
    // ==================== GET /turnover/:employeeId ====================
    describe('GET /turnover/:employeeId', () => {
        it('should return 200 with turnover risk', async () => {
            mockCalculateTurnoverRisk.mockResolvedValueOnce({ risk_score: 65, risk_level: 'high' });
            const res = await supertest(app)
                .get(`/api/v1/predictions/turnover/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.risk_score).toBe(65);
        });
    });
    // ==================== GET /performance/:employeeId ====================
    describe('GET /performance/:employeeId', () => {
        it('should return 200 with performance prediction', async () => {
            mockPredictPerformance.mockResolvedValueOnce({ predicted_rating: 3.8, confidence: 0.85 });
            const res = await supertest(app)
                .get(`/api/v1/predictions/performance/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.predicted_rating).toBe(3.8);
        });
    });
    // ==================== GET /summary ====================
    describe('GET /summary', () => {
        it('should return 200 with prediction summary', async () => {
            mockGetPredictionSummary.mockResolvedValueOnce({ total_predictions: 200, high_risk: 15 });
            const res = await supertest(app)
                .get('/api/v1/predictions/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total_predictions).toBe(200);
        });
    });
    // ==================== GET /performance (all) ====================
    describe('GET /performance (list)', () => {
        it('should return 200 with paginated predictions', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ id: 'p1', employee_id: 'e1', employee_name: 'Mario Rossi', risk_score: 45 }],
                rowCount: 1,
            });
            mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '25' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/predictions/performance')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.meta.total).toBe(25);
        });
    });
    // ==================== GET /flight-risk/:employeeId ====================
    describe('GET /flight-risk/:employeeId', () => {
        it('should return 404 when employee not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/predictions/flight-risk/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with flight risk data', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: VALID_UUID,
                        employee_name: 'Mario Rossi',
                        job_title: 'Dev',
                        hire_date: '2020-01-15',
                        department_name: 'IT',
                        salary: 50000,
                        tenure_years: '5',
                        avg_performance: '3.5',
                        goals_completed: 4,
                        courses_completed: 6,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/predictions/flight-risk/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.risk_score).toBeDefined();
            expect(res.body.data.risk_level).toBeDefined();
            expect(res.body.data.factors).toBeDefined();
        });
    });
    // ==================== GET /risk-distribution ====================
    describe('GET /risk-distribution', () => {
        it('should return 200 with distribution data', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        department_name: 'IT',
                        total_employees: '50',
                        low_risk: '30',
                        medium_risk: '12',
                        high_risk: '6',
                        critical_risk: '2',
                        high_potentials: '8',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/predictions/risk-distribution')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.departments.length).toBe(1);
            expect(res.body.data.totals).toBeDefined();
        });
    });
    // ==================== GET /high-potentials ====================
    describe('GET /high-potentials', () => {
        it('should return 200 with high potentials list', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ employee_id: 'e1', employee_name: 'Lucia Bianchi', hipo_score: 4.2 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/predictions/high-potentials')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
    // ==================== GET /accuracy ====================
    describe('GET /accuracy', () => {
        it('should return 200 with accuracy metrics', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/predictions/accuracy')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.history).toEqual([]);
            expect(res.body.data.aggregate).toBeNull();
        });
    });
    // ==================== GET /actions ====================
    describe('GET /actions', () => {
        it('should return 200 with actions list', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    { action_code: 'MENTOR', action_name: 'Assign Mentor', action_category: 'development' },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/predictions/actions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });
    });
    // ==================== GET /factors ====================
    describe('GET /factors', () => {
        it('should return 200 with factors grouped by category', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ factor_code: 'TENURE', factor_name: 'Tenure', factor_category: 'employment' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/predictions/factors')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.all.length).toBe(1);
            expect(res.body.data.by_category.employment).toBeDefined();
        });
    });
    // ==================== GET /skill-demand ====================
    describe('GET /skill-demand', () => {
        it('should return 200 with skill demand data', async () => {
            // current skills
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        skill_name: 'TypeScript',
                        category: 'IT',
                        current_holders: '20',
                        avg_proficiency: '3.5',
                    },
                ],
                rowCount: 1,
            });
            // demand skills
            mockClientQuery.mockResolvedValueOnce({
                rows: [{ skill_name: 'Senior Dev', category: 'IT', open_positions: '5' }],
                rowCount: 1,
            });
            // learning trends
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/predictions/skill-demand')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.current_skills.length).toBe(1);
            expect(res.body.data.forecast.length).toBe(6);
        });
    });
    // ==================== GET /ai-recommendations ====================
    describe('GET /ai-recommendations', () => {
        it('should return 200 with recommendations', async () => {
            mockClientQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_employees: 200,
                        new_hires_1y: 30,
                        terminations_12m: 10,
                        open_positions: 5,
                        avg_performance: 3.5,
                        at_risk_goals: 3,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/predictions/ai-recommendations')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.recommendations).toBeDefined();
            expect(res.body.data.summary).toBeDefined();
        });
    });
});
//# sourceMappingURL=predictions.test.js.map