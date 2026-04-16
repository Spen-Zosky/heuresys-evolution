/**
 * Employee Skill Profiles Routes - Unit Tests
 *
 * Tests:
 *   GET  /:id/skill-profile     - Get complete skill profile
 *   PUT  /:id/skill-profile     - Bulk update skill levels
 *   POST /:id/skills/declare    - Declare a new skill
 *   GET  /:id/skills/history    - Get skill history
 *   GET  /:id/skills/pending    - Get pending verifications
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
const { default: routes } = await import('../../routes/employee-skill-profiles.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const SKILL_ID = '55555555-6666-4777-a888-999999999999';
const SKILL_ID_2 = '66666666-7777-4888-a999-aaaaaaaaaaaa';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/employee-skill-profiles', authMiddleware);
    app.use('/api/v1/employee-skill-profiles', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/employee-skill-profiles', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Employee Skill Profiles Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`);
        expect(res.status).toBe(401);
    });
    // GET /:id/skill-profile
    it('GET /:id/skill-profile should return 404 when employee not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('GET /:id/skill-profile should return 200 with skill profile', async () => {
        // employee query
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: EMPLOYEE_ID,
                    first_name: 'Mario',
                    last_name: 'Rossi',
                    job_title: 'Developer',
                    org_unit_id: 'd1',
                    tenant_id: TENANT_ID,
                },
            ],
            rowCount: 1,
        });
        // skills query
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'sp1',
                    skill_id: 'sk1',
                    knowledge_level: 3,
                    skill_level: 4,
                    ability_level: 3,
                    behavior_level: 3,
                    attitude_level: 4,
                    composite_score: '3.4',
                    source: 'self_declaration',
                    source_description: null,
                    acquired_date: null,
                    last_demonstrated: null,
                    evidence_type: null,
                    evidence_id: null,
                    evidence_url: null,
                    verification_status: 'verified',
                    verified_by: null,
                    verified_at: null,
                    confidence_score: '0.8',
                    is_primary: true,
                    is_target: false,
                    target_level: null,
                    created_at: '2025-01-01',
                    updated_at: '2025-01-01',
                    skill_name: 'Java',
                    skill_name_it: 'Java',
                    skill_description: 'Java programming',
                    skill_type: 'skill',
                    reuse_level: 'sector-specific',
                    skill_group: 'Programming',
                },
            ],
            rowCount: 1,
        });
        // summary query
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    total_skills: '5',
                    verified_skills: '3',
                    pending_skills: '2',
                    avg_composite_score: '3.5',
                    max_composite_score: '4.2',
                    primary_skills: '2',
                    target_skills: '1',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.employee.name).toBe('Mario Rossi');
        expect(res.body.data.skills).toHaveLength(1);
        expect(res.body.data.summary.totalSkills).toBe(5);
    });
    it('GET /:id/skill-profile should return 500 on DB error', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app)
            .get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // PUT /:id/skill-profile
    it('PUT /:id/skill-profile should return 400 when skills array missing', async () => {
        // employee check needed for Zod to pass first
        const res = await supertest(app)
            .put(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('PUT /:id/skill-profile should return 404 when employee not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .put(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ skills: [{ skillId: SKILL_ID, knowledge: 3 }] });
        expect(res.status).toBe(404);
    });
    it('PUT /:id/skill-profile should update skills successfully', async () => {
        // employee check
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: EMPLOYEE_ID, tenant_id: TENANT_ID }],
            rowCount: 1,
        });
        // batch upsert
        mockQuery.mockResolvedValueOnce({ rows: [{ skill_id: SKILL_ID }], rowCount: 1 });
        const res = await supertest(app)
            .put(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ skills: [{ skillId: SKILL_ID, knowledge: 3, skill: 4 }] });
        expect(res.status).toBe(200);
        expect(res.body.data.updated).toBe(1);
    });
    // POST /:id/skills/declare
    it('POST /:id/skills/declare should return 400 when skillId missing', async () => {
        const res = await supertest(app)
            .post(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/declare`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /:id/skills/declare should return 404 when skill not found in ontology', async () => {
        // esco skill check
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/declare`)
            .set('Authorization', `Bearer ${token}`)
            .send({ skillId: SKILL_ID_2 });
        expect(res.status).toBe(404);
    });
    it('POST /:id/skills/declare should return 404 when employee not found', async () => {
        // esco skill exists
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: SKILL_ID, preferred_label_en: 'Java' }],
            rowCount: 1,
        });
        // employee not found
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/declare`)
            .set('Authorization', `Bearer ${token}`)
            .send({ skillId: SKILL_ID });
        expect(res.status).toBe(404);
    });
    it('POST /:id/skills/declare should create skill declaration successfully', async () => {
        // skill exists
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: SKILL_ID, preferred_label_en: 'Java' }],
            rowCount: 1,
        });
        // employee exists
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: EMPLOYEE_ID, tenant_id: TENANT_ID }],
            rowCount: 1,
        });
        // insert
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'sp1', composite_score: '2.5', verification_status: 'pending' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/declare`)
            .set('Authorization', `Bearer ${token}`)
            .send({ skillId: SKILL_ID, knowledge: 3, skill: 2 });
        expect(res.status).toBe(201);
        expect(res.body.data.verificationStatus).toBe('pending');
    });
    // GET /:id/skills/history
    it('GET /:id/skills/history should return history', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'h1',
                    skill_id: 'sk1',
                    skill_name: 'Java',
                    change_type: 'update',
                    changed_at: '2025-01-01',
                    previous_knowledge_level: 2,
                    new_knowledge_level: 3,
                    previous_composite_score: '2.0',
                    new_composite_score: '3.0',
                    previous_skill_level: null,
                    previous_ability_level: null,
                    previous_behavior_level: null,
                    previous_attitude_level: null,
                    new_skill_level: null,
                    new_ability_level: null,
                    new_behavior_level: null,
                    new_attitude_level: null,
                    change_reason: 'Training completed',
                    changed_by_name: 'Admin',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/history`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.history).toHaveLength(1);
    });
    // GET /:id/skills/pending
    it('GET /:id/skills/pending should return pending skills', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'sp1',
                    skill_id: 'sk1',
                    skill_name: 'Java',
                    skill_type: 'skill',
                    knowledge_level: 3,
                    skill_level: 3,
                    ability_level: 3,
                    behavior_level: 3,
                    attitude_level: 3,
                    composite_score: '3.0',
                    source: 'self_declaration',
                    source_description: null,
                    evidence_type: null,
                    evidence_url: null,
                    created_at: '2025-01-01',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/pending`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.pending).toHaveLength(1);
        expect(res.body.data.count).toBe(1);
    });
    it('GET /:id/skills/pending should return 500 on DB error', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB failure'));
        const res = await supertest(app)
            .get(`/api/v1/employee-skill-profiles/${EMPLOYEE_ID}/pending`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
});
//# sourceMappingURL=employee-skill-profiles.test.js.map