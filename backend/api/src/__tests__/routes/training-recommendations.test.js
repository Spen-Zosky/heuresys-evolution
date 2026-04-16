/**
 * Training Recommendations Routes - Behavioral Tests
 * Uses requireTenant, dbClient, and TrainingRecommendationService (with pool).
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
const mockGetRecommendations = jest.fn();
const mockGetPreferences = jest.fn();
const mockSearchCourses = jest.fn();
const mockGetCompletionRates = jest.fn();
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
jest.unstable_mockModule(resolve('../../services/training-recommendation/index.js'), () => ({
    TrainingRecommendationService: jest.fn().mockImplementation(() => ({
        getRecommendationsForEmployee: mockGetRecommendations,
        getEmployeePreferences: mockGetPreferences,
        searchCoursesBySkillEmbedding: mockSearchCourses,
        getCourseCompletionRates: mockGetCompletionRates,
    })),
}));
const { default: express } = await import('express');
const { default: trainingRoutes } = await import('../../routes/training-recommendations.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const COURSE_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
const SKILL_ID = '88888888-aaaa-bbbb-cccc-dddddddddddd';
const PATH_ID = '77777777-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/training-recommendations', authMiddleware);
    app.use('/api/v1/training-recommendations', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/training-recommendations', trainingRoutes);
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
describe('Training Recommendations Routes', () => {
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
            expect((await supertest(app).get(`/api/v1/training-recommendations/employees/${EMPLOYEE_ID}`))
                .status).toBe(401);
        });
    });
    describe('GET /training-recommendations/employees/:employeeId', () => {
        it('should return personalized recommendations', async () => {
            mockGetRecommendations.mockResolvedValueOnce({
                courses: [{ id: COURSE_ID, title: 'TypeScript Advanced' }],
                learning_paths: [{ id: PATH_ID, title: 'Full Stack Path' }],
            });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/employees/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.courses).toHaveLength(1);
        });
        it('should return 500 on service error', async () => {
            mockGetRecommendations.mockRejectedValueOnce(new Error('Service error'));
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/employees/${EMPLOYEE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
    describe('GET /training-recommendations/employees/:employeeId/preferences', () => {
        it('should return employee preferences', async () => {
            mockGetPreferences.mockResolvedValueOnce({
                preferred_delivery: ['online'],
                preferred_language: 'it',
                avg_duration: 4,
            });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/employees/${EMPLOYEE_ID}/preferences`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.preferred_delivery).toContain('online');
        });
    });
    describe('GET /training-recommendations/courses/search', () => {
        it('should search courses by skill', async () => {
            mockSearchCourses.mockResolvedValueOnce([
                { id: COURSE_ID, title: 'TypeScript Advanced', score: 0.95 },
            ]);
            const res = await supertest(app)
                .get('/api/v1/training-recommendations/courses/search?skill=TypeScript')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should return 400 when skill query missing', async () => {
            const res = await supertest(app)
                .get('/api/v1/training-recommendations/courses/search')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
        });
    });
    describe('GET /training-recommendations/courses/:courseId/stats', () => {
        it('should return course completion stats', async () => {
            mockGetCompletionRates.mockResolvedValueOnce(new Map([[COURSE_ID, 0.75]]));
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_enrollments: '100',
                        completed: '75',
                        in_progress: '15',
                        avg_progress: '82',
                        avg_score: '88',
                        avg_time_spent: '120',
                        passed: '70',
                        failed: '5',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/courses/${COURSE_ID}/stats`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.completion_rate).toBe(0.75);
            expect(res.body.data.total_enrollments).toBe('100');
        });
    });
    describe('GET /training-recommendations/skills/:skillId/courses', () => {
        it('should return courses for a skill', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: COURSE_ID,
                        title: 'TypeScript Advanced',
                        course_type: 'online',
                        proficiency_level_gained: 4,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/skills/${SKILL_ID}/courses`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
    });
    describe('GET /training-recommendations/learning-paths', () => {
        it('should return learning paths list', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: PATH_ID, title: 'Full Stack Path', course_count: '5', skills_covered: '8' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/training-recommendations/learning-paths')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should support target_role filter', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/training-recommendations/learning-paths?target_role=developer')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET /training-recommendations/learning-paths/:pathId', () => {
        it('should return learning path details with courses', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: PATH_ID,
                        title: 'Full Stack Path',
                        course_count: '5',
                        total_duration_hours: '40',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ course_id: COURSE_ID, title: 'TypeScript', sequence_order: 1 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.courses).toHaveLength(1);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /training-recommendations/gap-based', () => {
        it('should return gap-based recommendations', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        skill_name: 'TypeScript',
                        employees_with_gap: '10',
                        avg_gap: '2.5',
                        recommended_courses: '[]',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/training-recommendations/gap-based')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should support org_unit_id filter', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/training-recommendations/gap-based?org_unit_id=${DEFAULT_IDS.DEPARTMENT_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
});
//# sourceMappingURL=training-recommendations.test.js.map