/**
 * Career Paths Routes - Behavioral Tests
 * Tests HTTP request/response for career path CRUD, levels, skills,
 * simulation, enrollment, progress tracking, and fit scoring.
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
const mockSimulateCareerPath = jest.fn();
const mockGetRecommendationsForEmployee = jest.fn();
const mockGetReachableRoles = jest.fn();
jest.unstable_mockModule(resolve('../../services/career-path/index.js'), () => ({
    CareerPathService: jest.fn().mockImplementation(() => ({
        simulateCareerPath: mockSimulateCareerPath,
        getRecommendationsForEmployee: mockGetRecommendationsForEmployee,
        getReachableRoles: mockGetReachableRoles,
    })),
}));
const { default: express } = await import('express');
const { default: careerPathRoutes } = await import('../../routes/career-paths.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/career-paths', authMiddleware);
    app.use('/api/v1/career-paths', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/career-paths', careerPathRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Career Paths Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('Authentication', () => {
        it('should return 401 without token', async () => {
            const res = await supertest(app).get('/api/v1/career-paths');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /career-paths/stats', () => {
        it('should return career path statistics', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ total: '5', active: '4', departments: '3' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ path_type: 'linear', count: '3' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ employees_assigned: '20' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/career-paths/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe('5');
            expect(res.body.data.path_types).toHaveLength(1);
        });
    });
    describe('GET /career-paths', () => {
        it('should return paginated list', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Dev Path' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/career-paths')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });
        it('should filter by department', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/career-paths?department=IT')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const call = mockQuery.mock.calls[0];
            expect(call[1]).toContain('IT');
        });
    });
    describe('GET /career-paths/:id', () => {
        it('should return path with levels and employees', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Dev Path' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'l-1', title: 'Junior' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ employee_name: 'Mario Rossi' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/career-paths/p-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Dev Path');
            expect(res.body.data.levels).toHaveLength(1);
            expect(res.body.data.employees).toHaveLength(1);
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/career-paths/none')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('POST /career-paths', () => {
        it('should create a career path', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-new', name: 'New Path' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/career-paths')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Path', department: 'IT', path_type: 'linear' });
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Career path created');
        });
        it('should return 400 when name missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/career-paths')
                .set('Authorization', `Bearer ${token}`)
                .send({ department: 'IT' });
            expect(res.status).toBe(400);
        });
    });
    describe('PATCH /career-paths/:id', () => {
        it('should update a career path', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'p-1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Updated' }], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/career-paths/p-1')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Career path updated');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/career-paths/none')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'X' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when no fields', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1' }], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/career-paths/p-1')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
    });
    describe('DELETE /career-paths/:id', () => {
        it('should delete a career path', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/career-paths/p-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Career path deleted');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/career-paths/none')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('GET /career-paths/:id/levels', () => {
        it('should return levels with skill requirements', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'l-1', title: 'Junior', skill_requirements: null }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/career-paths/p-1/levels')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
    });
    describe('POST /career-paths/:id/levels/:levelId/skills', () => {
        it('should add a skill requirement', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cls-1' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/career-paths/p-1/levels/l-1/skills')
                .set('Authorization', `Bearer ${token}`)
                .send({ skill_id: '11111111-2222-4333-a444-555555555555', importance: 'essential' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should return 400 when skill_id missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/career-paths/p-1/levels/l-1/skills')
                .set('Authorization', `Bearer ${token}`)
                .send({ importance: 'essential' });
            expect(res.status).toBe(400);
        });
    });
    describe('POST /career-paths/simulate', () => {
        it('should simulate career path', async () => {
            mockSimulateCareerPath.mockResolvedValueOnce({ id: 'sim-1', fit_score: 0.75 });
            const res = await supertest(app)
                .post('/api/v1/career-paths/simulate')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: '11111111-2222-4333-a444-555555555555',
                target_path_id: '22222222-3333-4444-a555-666666666666',
            });
            expect(res.status).toBe(201);
            expect(res.body.data.fit_score).toBe(0.75);
        });
        it('should return 400 when employee_id missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/career-paths/simulate')
                .set('Authorization', `Bearer ${token}`)
                .send({ target_path_id: '22222222-3333-4444-a555-666666666666' });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /career-paths/progress/:employeeId', () => {
        it('should return employee career progress', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ enrollment_id: 'e-1', path_name: 'Dev Path' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/career-paths/progress/emp-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('POST /career-paths/:pathId/enroll/:employeeId', () => {
        it('should enroll employee in path', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'l-1' }], rowCount: 1 }) // first level
                .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1', path_id: 'p-1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // init progress
            const res = await supertest(app)
                .post('/api/v1/career-paths/p-1/enroll/emp-1')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Successfully enrolled in career path');
        });
    });
    describe('Error Handling', () => {
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/career-paths/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
});
//# sourceMappingURL=career-paths.test.js.map