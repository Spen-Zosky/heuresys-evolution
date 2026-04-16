/**
 * Gap Analysis Routes - Unit Tests
 *
 * Tests:
 *   POST /gap-analysis                       - Universal gap analysis
 *   POST /gap-analysis/employee-role          - Employee vs role analysis (Zod)
 *   POST /gap-analysis/team-role              - Team vs role analysis (Zod)
 *   GET  /gap-analysis/summary/:employeeId    - Quick gap summary
 *   POST /gap-analysis/compare                - Compare employees (Zod)
 *   POST /gap-analysis/recommendations        - Generate recommendations (Zod)
 *   GET  /gap-analysis/development-plan/:empId - Development plan
 *   POST /gap-analysis/:employeeId/development-actions - Save dev action (Zod)
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
// Mock gap analysis services
const mockAnalyzeEmployeeVsRole = jest.fn();
const mockAnalyzeTeamVsRole = jest.fn();
const mockGenerateRecommendations = jest.fn();
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
jest.unstable_mockModule(resolve('../../services/gap-analysis/index.js'), () => ({
    gapAnalysisService: {
        analyzeEmployeeVsRole: mockAnalyzeEmployeeVsRole,
        analyzeTeamVsRole: mockAnalyzeTeamVsRole,
    },
}));
jest.unstable_mockModule(resolve('../../services/gap-analysis/gap-recommendations.service.js'), () => ({
    gapRecommendationsService: {
        generateRecommendations: mockGenerateRecommendations,
    },
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/gap-analysis.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const EMPLOYEE_ID_2 = '22222222-3333-4444-a555-666666666666';
const ROLE_ID = '99999999-aaaa-4bbb-cccc-dddddddddddd';
// Standard gap analysis result
function buildGapResult(overrides = {}) {
    return {
        analysisId: 'analysis-1',
        targetId: EMPLOYEE_ID,
        targetName: 'Mario Rossi',
        requirementName: 'Senior Developer',
        overallFitScore: 72.5,
        overallGapScore: 27.5,
        gapCount: 3,
        skillsExceeding: 2,
        severityDistribution: { critical: 0, high: 1, medium: 1, low: 1 },
        skillGaps: [],
        ...overrides,
    };
}
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/gap-analysis', authMiddleware);
    app.use('/api/v1/gap-analysis', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/gap-analysis', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Gap Analysis Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).post('/api/v1/gap-analysis').send({});
        expect(res.status).toBe(401);
    });
    // POST / (Zod: analysisType enum required)
    it('POST / should return 400 when missing analysisType', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST / should return 400 for employee_role without employeeId', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis')
            .set('Authorization', `Bearer ${token}`)
            .send({ analysisType: 'employee_role', roleId: ROLE_ID });
        expect(res.status).toBe(400);
    });
    it('POST / should return 200 for employee_role analysis', async () => {
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult());
        const res = await supertest(app)
            .post('/api/v1/gap-analysis')
            .set('Authorization', `Bearer ${token}`)
            .send({ analysisType: 'employee_role', employeeId: EMPLOYEE_ID, roleId: ROLE_ID });
        expect(res.status).toBe(200);
        expect(res.body.data.overallFitScore).toBe(72.5);
    });
    it('POST / should return 501 for team_project (not implemented)', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis')
            .set('Authorization', `Bearer ${token}`)
            .send({ analysisType: 'team_project' });
        expect(res.status).toBe(501);
    });
    // POST /employee-role (Zod: employeeId UUID, roleId UUID required)
    it('POST /employee-role should return 400 when missing fields', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/employee-role')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /employee-role should return 200 with analysis', async () => {
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult());
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/employee-role')
            .set('Authorization', `Bearer ${token}`)
            .send({ employeeId: EMPLOYEE_ID, roleId: ROLE_ID });
        expect(res.status).toBe(200);
        expect(res.body.data.targetName).toBe('Mario Rossi');
        expect(res.body.data.gapCount).toBe(3);
    });
    it('POST /employee-role should return 500 on service error', async () => {
        mockAnalyzeEmployeeVsRole.mockRejectedValueOnce(new Error('Analysis failed'));
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/employee-role')
            .set('Authorization', `Bearer ${token}`)
            .send({ employeeId: EMPLOYEE_ID, roleId: ROLE_ID });
        expect(res.status).toBe(500);
    });
    // POST /team-role (Zod: employeeIds array of UUIDs, roleId UUID required)
    it('POST /team-role should return 400 when missing fields', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/team-role')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /team-role should return 200 with team analysis', async () => {
        mockAnalyzeTeamVsRole.mockResolvedValueOnce({
            teamFitScore: 68.0,
            gapCount: 5,
            members: [],
        });
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/team-role')
            .set('Authorization', `Bearer ${token}`)
            .send({ employeeIds: [EMPLOYEE_ID, EMPLOYEE_ID_2], roleId: ROLE_ID });
        expect(res.status).toBe(200);
        expect(res.body.data.teamFitScore).toBe(68.0);
    });
    // GET /summary/:employeeId
    it('GET /summary/:employeeId should return 400 without roleIds', async () => {
        const res = await supertest(app)
            .get(`/api/v1/gap-analysis/summary/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
    it('GET /summary/:employeeId should return analyses for roles', async () => {
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult());
        const res = await supertest(app)
            .get(`/api/v1/gap-analysis/summary/${EMPLOYEE_ID}?roleIds=${ROLE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.employeeId).toBe(EMPLOYEE_ID);
        expect(res.body.data.analyses).toHaveLength(1);
    });
    // POST /compare (Zod: employeeIds min 2, roleId UUID required)
    it('POST /compare should return 400 with fewer than 2 employees', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/compare')
            .set('Authorization', `Bearer ${token}`)
            .send({ employeeIds: [EMPLOYEE_ID], roleId: ROLE_ID });
        expect(res.status).toBe(400);
    });
    it('POST /compare should return 200 with comparison results', async () => {
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult({ targetId: EMPLOYEE_ID, overallFitScore: 72.5 }));
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult({
            targetId: EMPLOYEE_ID_2,
            targetName: 'Luigi Bianchi',
            overallFitScore: 85.0,
        }));
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/compare')
            .set('Authorization', `Bearer ${token}`)
            .send({ employeeIds: [EMPLOYEE_ID, EMPLOYEE_ID_2], roleId: ROLE_ID });
        expect(res.status).toBe(200);
        expect(res.body.data.ranking).toHaveLength(2);
        // Ranked by fitScore descending
        expect(res.body.data.ranking[0].fitScore).toBe(85.0);
    });
    // POST /recommendations (Zod: employeeId UUID, roleId UUID required)
    it('POST /recommendations should return 400 when missing fields', async () => {
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/recommendations')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /recommendations should return 200 with recommendations', async () => {
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult());
        mockGenerateRecommendations.mockResolvedValueOnce({
            topRecommendations: [{ type: 'training', title: 'Java Advanced', skillName: 'Java' }],
            totalEstimatedHours: 40,
            byPriority: {},
            byType: {},
            skillRecommendations: [],
        });
        const res = await supertest(app)
            .post('/api/v1/gap-analysis/recommendations')
            .set('Authorization', `Bearer ${token}`)
            .send({ employeeId: EMPLOYEE_ID, roleId: ROLE_ID });
        expect(res.status).toBe(200);
        expect(res.body.data.gapAnalysis.overallFitScore).toBe(72.5);
        expect(res.body.data.recommendations.topRecommendations).toHaveLength(1);
    });
    // GET /development-plan/:employeeId
    it('GET /development-plan/:employeeId should return 400 without roleId', async () => {
        const res = await supertest(app)
            .get(`/api/v1/gap-analysis/development-plan/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
    it('GET /development-plan/:employeeId should return development plan', async () => {
        mockAnalyzeEmployeeVsRole.mockResolvedValueOnce(buildGapResult());
        mockGenerateRecommendations.mockResolvedValueOnce({
            topRecommendations: [
                {
                    type: 'training',
                    title: 'Java Advanced',
                    priority: 'high',
                    skillName: 'Java',
                    estimatedHours: 20,
                    expectedGapReduction: 15,
                    resourceName: 'Udemy',
                },
            ],
            totalEstimatedHours: 40,
            byPriority: { high: 1 },
            byType: { training: 1 },
            skillRecommendations: [
                {
                    skillName: 'Java',
                    gapScore: 25,
                    gapSeverity: 'high',
                    recommendations: [
                        { type: 'training', title: 'Java Advanced', estimatedHours: 20, expectedLevelGain: 1 },
                    ],
                },
            ],
        });
        const res = await supertest(app)
            .get(`/api/v1/gap-analysis/development-plan/${EMPLOYEE_ID}?roleId=${ROLE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.currentFitScore).toBe(72.5);
        expect(res.body.data.skillDevelopmentPlan).toHaveLength(1);
    });
    // POST /:employeeId/development-actions (Zod)
    it('POST /:employeeId/development-actions should return 400 when missing fields', async () => {
        const res = await supertest(app)
            .post(`/api/v1/gap-analysis/${EMPLOYEE_ID}/development-actions`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /:employeeId/development-actions should create action', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'da1', employee_id: EMPLOYEE_ID, is_active: true }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post(`/api/v1/gap-analysis/${EMPLOYEE_ID}/development-actions`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Complete Java Course', type: 'training', priority: 'high' });
        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe('da1');
    });
});
//# sourceMappingURL=gap-analysis.test.js.map