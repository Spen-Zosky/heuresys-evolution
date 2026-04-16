/**
 * Role Skill Requirements Routes - Unit Tests
 * Tests role-skill CRUD, ESCO seeding, copy-from, and succession endpoints.
 *
 * Endpoints tested:
 *  GET    /roles/:id/skill-requirements                      - Get requirements for role
 *  PUT    /roles/:id/skill-requirements                      - Bulk update requirements
 *  POST   /roles/:id/skill-requirements                      - Add single requirement
 *  DELETE /roles/:id/skill-requirements/:skillId             - Remove requirement
 *  POST   /roles/:id/skill-requirements/seed-from-esco       - Seed from ESCO
 *  POST   /roles/:id/skill-requirements/copy-from/:sourceId  - Copy from another role
 *  GET    /roles/:id/succession                              - Succession plan
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
// Mock succession planning service
const mockGetSuccessionPlan = jest.fn();
jest.unstable_mockModule(resolve('../../services/succession-planning/index.js'), () => ({
    SuccessionPlanningService: jest.fn().mockImplementation(() => ({
        getSuccessionPlan: mockGetSuccessionPlan,
    })),
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/role-skill-requirements.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const ROLE_ID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
const SKILL_ID = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
const SOURCE_ROLE_ID = 'cccccccc-dddd-4eee-ffff-111111111111';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/roles', authMiddleware);
    app.use('/api/v1/roles', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/roles', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('Role Skill Requirements Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get(`/api/v1/roles/${ROLE_ID}/skill-requirements`);
        expect(res.status).toBe(401);
    });
    // ==================== GET /:id/skill-requirements ====================
    describe('GET /:id/skill-requirements', () => {
        it('should return 404 when role not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with requirements grouped by importance', async () => {
            // Role query
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ROLE_ID,
                        title_en: 'Senior Developer',
                        title_it: 'Sviluppatore Senior',
                        job_code: 'SD01',
                        esco_occupation_uri: null,
                    },
                ],
                rowCount: 1,
            });
            // Requirements query
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'r1',
                        skill_id: SKILL_ID,
                        skill_name: 'TypeScript',
                        skill_name_it: 'TypeScript',
                        skill_description: 'A typed superset of JS',
                        skill_type: 'skill',
                        skill_group: 'Programming',
                        required_knowledge_level: 3,
                        required_skill_level: 4,
                        required_ability_level: 3,
                        required_behavior_level: null,
                        required_attitude_level: null,
                        min_composite_score: '3.5',
                        importance: 'essential',
                        weight: '1.0',
                        is_primary: true,
                        notes: null,
                        source: 'manual',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.role.title).toBe('Senior Developer');
            expect(res.body.data.summary.totalRequirements).toBe(1);
            expect(res.body.data.summary.essential).toBe(1);
            expect(res.body.data.requirements.length).toBe(1);
        });
        it('should return 200 with empty requirements', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ROLE_ID,
                        title_en: 'Junior Dev',
                        title_it: null,
                        job_code: 'JD01',
                        esco_occupation_uri: null,
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.summary.totalRequirements).toBe(0);
        });
    });
    // ==================== PUT /:id/skill-requirements ====================
    describe('PUT /:id/skill-requirements', () => {
        it('should return 400 when requirements array empty', async () => {
            const res = await supertest(app)
                .put(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ requirements: [] });
            expect(res.status).toBe(400);
        });
        it('should return 404 when role not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .put(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                requirements: [{ skillId: SKILL_ID, knowledge: 3, skill: 4, importance: 'important' }],
            });
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful bulk update', async () => {
            // Role check
            mockQuery.mockResolvedValueOnce({ rows: [{ id: ROLE_ID }], rowCount: 1 });
            // Upsert result
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'req-1' }], rowCount: 1 });
            const res = await supertest(app)
                .put(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                requirements: [{ skillId: SKILL_ID, knowledge: 3, skill: 4, importance: 'important' }],
            });
            expect(res.status).toBe(200);
            expect(res.body.data.updated).toBe(1);
        });
    });
    // ==================== POST /:id/skill-requirements ====================
    describe('POST /:id/skill-requirements', () => {
        it('should return 400 when skillId missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ knowledge: 3 });
            expect(res.status).toBe(400);
        });
        it('should return 404 when role not found', async () => {
            // role check returns empty, skill check returns a skill
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: SKILL_ID, preferred_label_en: 'TypeScript' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ skillId: SKILL_ID, importance: 'important' });
            expect(res.status).toBe(404);
        });
        it('should return 404 when skill not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: ROLE_ID, title_en: 'Dev' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ skillId: SKILL_ID, importance: 'important' });
            expect(res.status).toBe(404);
        });
        it('should return 201 on successful creation', async () => {
            // Promise.all: role check + skill check
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ROLE_ID, title_en: 'Senior Dev' }],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: SKILL_ID, preferred_label_en: 'TypeScript' }],
                rowCount: 1,
            });
            // Insert
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'new-req', min_composite_score: '3.5' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ skillId: SKILL_ID, knowledge: 3, skill: 4, importance: 'important' });
            expect(res.status).toBe(201);
            expect(res.body.data.skillName).toBe('TypeScript');
        });
    });
    // ==================== DELETE /:id/skill-requirements/:skillId ====================
    describe('DELETE /:id/skill-requirements/:skillId', () => {
        it('should return 404 when requirement not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/roles/${ROLE_ID}/skill-requirements/${SKILL_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful deletion', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'req-1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/roles/${ROLE_ID}/skill-requirements/${SKILL_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.deleted).toBe(true);
        });
    });
    // ==================== POST /:id/skill-requirements/seed-from-esco ====================
    describe('POST /:id/skill-requirements/seed-from-esco', () => {
        it('should return 200 with seeded count', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: 15 }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements/seed-from-esco`)
                .set('Authorization', `Bearer ${token}`)
                .send({ defaultImportance: 'important', defaultLevel: 3 });
            expect(res.status).toBe(200);
            expect(res.body.data.seeded).toBe(15);
        });
        it('should return 200 with zero when no ESCO mapping', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements/seed-from-esco`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.data.seeded).toBe(0);
        });
    });
    // ==================== POST /:id/skill-requirements/copy-from/:sourceRoleId ====================
    describe('POST /:id/skill-requirements/copy-from/:sourceRoleId', () => {
        it('should return 404 when source or target role not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: ROLE_ID, title_en: 'Dev' }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements/copy-from/${SOURCE_ROLE_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
        });
        it('should return 200 on successful copy', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: SOURCE_ROLE_ID, title_en: 'Source Role' },
                    { id: ROLE_ID, title_en: 'Target Role' },
                ],
                rowCount: 2,
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: 8 }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/roles/${ROLE_ID}/skill-requirements/copy-from/${SOURCE_ROLE_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.data.copied).toBe(8);
        });
    });
    // ==================== GET /:id/succession ====================
    describe('GET /:id/succession', () => {
        it('should return 404 when role not found', async () => {
            mockGetSuccessionPlan.mockRejectedValueOnce(new Error('Role not found'));
            const res = await supertest(app)
                .get(`/api/v1/roles/${ROLE_ID}/succession`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 200 with succession plan', async () => {
            mockGetSuccessionPlan.mockResolvedValueOnce({
                role: { id: ROLE_ID, title: 'Senior Dev' },
                candidates: [{ employeeId: 'e1', name: 'Mario Rossi', skillMatch: 0.85 }],
                totalCandidates: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/roles/${ROLE_ID}/succession`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.candidates.length).toBe(1);
        });
    });
});
//# sourceMappingURL=role-skill-requirements.test.js.map