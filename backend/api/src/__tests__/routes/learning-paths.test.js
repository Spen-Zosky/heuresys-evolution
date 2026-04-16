/**
 * Learning Paths Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for learning path CRUD endpoints.
 * All external dependencies (database, redis, sentry) are mocked.
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
const { default: express } = await import('express');
const { default: learningPathsRoutes } = await import('../../routes/learning-paths.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const PATH_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/learning-paths', authMiddleware);
    app.use('/api/v1/learning-paths', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/learning-paths', learningPathsRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({
            success: false,
            error: err.message || 'Internal Server Error',
            code: err.code,
        });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
const samplePath = {
    id: PATH_ID,
    tenant_id: TENANT_ID,
    code: 'LP-001',
    title: 'Percorso Compliance Bancaria',
    title_en: 'Banking Compliance Path',
    description: 'Percorso formativo per la compliance bancaria',
    target_role: 'Compliance Officer',
    skills_gained: ['compliance', 'risk-management'],
    total_hours: 40,
    estimated_duration_hours: 40,
    skill_level: 'intermediate',
    path_type: 'certification',
    is_mandatory: true,
    is_active: true,
    course_count: '5',
    enrollment_count: '12',
    created_by: VALID_UUID,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
};
describe('Learning Paths Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Authentication', () => {
        it('should return 401 when no auth token is provided', async () => {
            const res = await supertest(app).get('/api/v1/learning-paths');
            expect(res.status).toBe(401);
        });
        it('should return 401 with an invalid token', async () => {
            const res = await supertest(app)
                .get('/api/v1/learning-paths')
                .set('Authorization', 'Bearer bad-token');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /learning-paths/stats
    // =========================================================================
    describe('GET /learning-paths/stats', () => {
        it('should return aggregated statistics', async () => {
            const stats = {
                total_paths: '10',
                active_paths: '8',
                mandatory_paths: '3',
                avg_hours: '25.5',
            };
            mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total_paths).toBe('10');
            expect(res.body.data.active_paths).toBe('8');
            expect(res.body.data.mandatory_paths).toBe('3');
            expect(res.body.data.avg_hours).toBe('25.5');
        });
        it('should return zero stats when no paths exist', async () => {
            const stats = { total_paths: '0', active_paths: '0', mandatory_paths: '0', avg_hours: null };
            mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total_paths).toBe('0');
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB timeout'));
            const res = await supertest(app)
                .get('/api/v1/learning-paths/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /learning-paths
    // =========================================================================
    describe('GET /learning-paths', () => {
        it('should return paginated list of learning paths', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [samplePath], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].title).toBe('Percorso Compliance Bancaria');
            expect(res.body.meta.total).toBe(1);
            expect(res.body.meta.limit).toBe(100);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should filter by is_active', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [samplePath], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths?is_active=true')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by target_role', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [samplePath], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths?target_role=Compliance%20Officer')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by skill_level', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [samplePath], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths?skill_level=intermediate')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by is_mandatory', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [samplePath], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths?is_mandatory=true')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should respect custom limit and offset', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths?limit=10&offset=20')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(10);
            expect(res.body.meta.offset).toBe(20);
            expect(res.body.meta.total).toBe(50);
        });
        it('should return empty array when no paths match', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.total).toBe(0);
        });
    });
    // =========================================================================
    // GET /learning-paths/:id
    // =========================================================================
    describe('GET /learning-paths/:id', () => {
        it('should return a single learning path with counts', async () => {
            const detail = { ...samplePath, completed_count: '7' };
            mockQuery.mockResolvedValueOnce({ rows: [detail], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(PATH_ID);
            expect(res.body.data.title).toBe('Percorso Compliance Bancaria');
            expect(res.body.data.completed_count).toBe('7');
        });
        it('should return 404 when learning path is not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/learning-paths/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Query failed'));
            const res = await supertest(app)
                .get(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /learning-paths/:id/courses
    // =========================================================================
    describe('GET /learning-paths/:id/courses', () => {
        it('should return courses in the learning path ordered by sequence', async () => {
            const courses = [
                {
                    id: 'c1',
                    code: 'C-001',
                    title: 'Intro Compliance',
                    duration_hours: 8,
                    category: 'compliance',
                    skill_level: 'beginner',
                    sequence_order: 1,
                    is_mandatory: true,
                },
                {
                    id: 'c2',
                    code: 'C-002',
                    title: 'Advanced Compliance',
                    duration_hours: 16,
                    category: 'compliance',
                    skill_level: 'intermediate',
                    sequence_order: 2,
                    is_mandatory: true,
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: courses, rowCount: 2 });
            const res = await supertest(app)
                .get(`/api/v1/learning-paths/${PATH_ID}/courses`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].sequence_order).toBe(1);
            expect(res.body.data[1].sequence_order).toBe(2);
        });
        it('should return empty array when path has no courses', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/learning-paths/${PATH_ID}/courses`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // POST /learning-paths
    // =========================================================================
    describe('POST /learning-paths', () => {
        const validPayload = {
            title: 'Percorso Data Science',
            code: 'LP-DS-001',
            description: 'Percorso per data scientist',
            target_role: 'Data Scientist',
            skill_level: 'advanced',
        };
        it('should create a new learning path with 201', async () => {
            const created = {
                id: PATH_ID,
                ...validPayload,
                tenant_id: TENANT_ID,
                is_active: true,
                is_mandatory: false,
            };
            mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(PATH_ID);
            expect(res.body.message).toBe('Learning path created');
        });
        it('should return 400 when title is missing (Zod validation)', async () => {
            const res = await supertest(app)
                .post('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`)
                .send({ code: 'LP-002' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when title is empty string', async () => {
            const res = await supertest(app)
                .post('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: '' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 on database insert failure', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Insert failed'));
            const res = await supertest(app)
                .post('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
        it('should accept optional is_mandatory and is_active with defaults', async () => {
            const created = { id: PATH_ID, title: 'Test', is_mandatory: false, is_active: true };
            mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/learning-paths')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Test' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // PATCH /learning-paths/:id
    // =========================================================================
    describe('PATCH /learning-paths/:id', () => {
        it('should update an existing learning path', async () => {
            const updated = { ...samplePath, title: 'Updated Path' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PATH_ID }], rowCount: 1 }) // existence check
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // update
            const res = await supertest(app)
                .patch(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated Path' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('Updated Path');
            expect(res.body.message).toBe('Learning path updated');
        });
        it('should return 404 when path to update does not exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/learning-paths/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'New Title' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when no recognized fields are sent', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: PATH_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ unknown_field: 'value' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('No fields to update');
        });
        it('should return 500 on database error', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: PATH_ID }], rowCount: 1 })
                .mockRejectedValueOnce(new Error('Update failed'));
            const res = await supertest(app)
                .patch(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Fail' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // DELETE /learning-paths/:id
    // =========================================================================
    describe('DELETE /learning-paths/:id', () => {
        it('should soft-delete (deactivate) a learning path', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: PATH_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Learning path deactivated');
        });
        it('should return 404 when path to delete does not exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/learning-paths/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 500 on database error during delete', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Delete failed'));
            const res = await supertest(app)
                .delete(`/api/v1/learning-paths/${PATH_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=learning-paths.test.js.map