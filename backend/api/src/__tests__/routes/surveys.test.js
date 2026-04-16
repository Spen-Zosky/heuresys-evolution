/**
 * Surveys Routes - Behavioral Tests
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
const { default: surveysRoutes } = await import('../../routes/surveys.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const SURVEY_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/surveys', authMiddleware);
    app.use('/api/v1/surveys', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/surveys', surveysRoutes);
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
function buildSurvey(o = {}) {
    return {
        id: SURVEY_ID,
        tenant_id: TENANT_ID,
        title: 'Q1 Engagement Survey',
        description: 'Quarterly engagement',
        survey_type: 'engagement',
        status: 'draft',
        is_anonymous: true,
        is_active: true,
        questions: '[]',
        total_invitations: 0,
        created_at: '2026-01-01T00:00:00Z',
        ...o,
    };
}
describe('Surveys Routes', () => {
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
            expect((await supertest(app).get('/api/v1/surveys')).status).toBe(401);
        });
    });
    describe('GET /surveys/stats', () => {
        it('should return statistics', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        total: '5',
                        draft: '1',
                        active: '2',
                        closed: '2',
                        anonymous: '3',
                        total_invitations: '100',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ total_responses: '50' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/surveys/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total).toBe('5');
        });
    });
    describe('GET /surveys/active', () => {
        it('should return active surveys', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [buildSurvey({ status: 'active' })], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/surveys/active')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('GET /surveys/types', () => {
        it('should return type breakdown', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ survey_type: 'engagement', count: '3' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/surveys/types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data[0].survey_type).toBe('engagement');
        });
    });
    describe('GET /surveys', () => {
        it('should return paginated list', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [buildSurvey()], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/surveys')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });
    });
    describe('GET /surveys/:id', () => {
        it('should return survey with response count', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [buildSurvey()], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ response_count: '10' }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.response_count).toBe(10);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /surveys/:id/responses', () => {
        it('should return aggregated data for anonymous surveys', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ is_anonymous: true }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ question_id: 'q1', avg_rating: '4.2', response_count: '20' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/surveys/${SURVEY_ID}/responses`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.anonymous).toBe(true);
        });
        it('should return individual responses for non-anonymous', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ is_anonymous: false }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'r1', employee_name: 'Mario Rossi' }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/surveys/${SURVEY_ID}/responses`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.anonymous).toBe(false);
        });
        it('should return 404 when survey not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/surveys/${SURVEY_ID}/responses`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('POST /surveys', () => {
        it('should create survey (201)', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [buildSurvey()], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/surveys')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Test Survey', survey_type: 'engagement' });
            expect(res.status).toBe(201);
        });
        it('should return 400 when title missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/surveys')
                .set('Authorization', `Bearer ${token}`)
                .send({ survey_type: 'engagement' });
            expect(res.status).toBe(400);
        });
    });
    describe('PATCH /surveys/:id', () => {
        it('should update survey', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: SURVEY_ID }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [buildSurvey({ title: 'Updated' })], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated' });
            expect(res.status).toBe(200);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'X' });
            expect(res.status).toBe(404);
        });
        it('should return 400 with empty body', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: SURVEY_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
    });
    describe('POST /surveys/:id/activate', () => {
        it('should activate survey', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [buildSurvey({ status: 'active' })], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/surveys/${SURVEY_ID}/activate`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/surveys/${SURVEY_ID}/activate`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('POST /surveys/:id/close', () => {
        it('should close survey', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [buildSurvey({ status: 'closed' })], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/surveys/${SURVEY_ID}/close`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('DELETE /surveys/:id', () => {
        it('should delete survey', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: SURVEY_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/surveys/${SURVEY_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
});
//# sourceMappingURL=surveys.test.js.map