/**
 * skill-verifications Routes - Comprehensive Behavioral Tests
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
const { default: routes } = await import('../../routes/skill-verifications.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const MANAGER_ID = DEFAULT_IDS.EMPLOYEE_ID;
const PROFILE_ID = '55555555-6666-7777-a888-999999999999';
const VERIFIER_ID = '66666666-7777-8888-a999-aaaaaaaaaaaa';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/skill-verifications', authMiddleware);
    app.use('/api/v1/skill-verifications', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/skill-verifications', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('skill-verifications Routes', () => {
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
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/skill-verifications/pending');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /team/:managerId
    // =========================================================================
    describe('GET /team/:managerId', () => {
        it('should return 404 when manager not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/skill-verifications/team/${MANAGER_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return team verifications with summary', async () => {
            // 1st query: manager lookup
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: MANAGER_ID, tenant_id: TENANT_ID, first_name: 'Marco', last_name: 'Rossi' }],
                rowCount: 1,
            });
            // 2nd query: verifications
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        profile_id: PROFILE_ID,
                        employee_id: '111',
                        employee_name: 'Lucia Bianchi',
                        job_title: 'Analyst',
                        department_name: 'IT',
                        skill_id: '222',
                        skill_name: 'Python',
                        skill_name_it: 'Python',
                        skill_type: 'skill',
                        skill_group: null,
                        knowledge_level: 3,
                        skill_level: 4,
                        ability_level: 3,
                        behavior_level: 2,
                        attitude_level: 4,
                        composite_score: '3.20',
                        source: 'self_declaration',
                        source_description: null,
                        acquired_date: '2024-01-01',
                        evidence_type: 'certificate',
                        evidence_id: 'cert-1',
                        evidence_url: 'https://example.com',
                        evidence_notes: 'Python cert',
                        verification_status: 'pending',
                        created_at: '2025-01-01T00:00:00Z',
                        updated_at: '2025-01-02T00:00:00Z',
                    },
                ],
                rowCount: 1,
            });
            // 3rd query: counts
            mockQuery.mockResolvedValueOnce({
                rows: [{ pending_count: '5', expired_count: '2', employees_with_pending: '3' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/skill-verifications/team/${MANAGER_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.manager.id).toBe(MANAGER_ID);
            expect(res.body.data.manager.name).toBe('Marco Rossi');
            expect(res.body.data.summary.pendingCount).toBe(5);
            expect(res.body.data.summary.expiredCount).toBe(2);
            expect(res.body.data.summary.employeesWithPending).toBe(3);
            expect(res.body.data.verifications).toHaveLength(1);
            expect(res.body.data.verifications[0].profileId).toBe(PROFILE_ID);
            expect(res.body.data.verifications[0].employee.name).toBe('Lucia Bianchi');
            expect(res.body.data.verifications[0].skill.name).toBe('Python');
            expect(res.body.data.verifications[0].evidence).not.toBeNull();
            expect(res.body.data.verifications[0].evidence.type).toBe('certificate');
        });
        it('should return 500 when DB query fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get(`/api/v1/skill-verifications/team/${MANAGER_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /pending
    // =========================================================================
    describe('GET /pending', () => {
        it('should return 400 when x-tenant-id header missing', async () => {
            const res = await supertest(app)
                .get('/api/v1/skill-verifications/pending')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/x-tenant-id/i);
        });
        it('should return pending verifications with pagination', async () => {
            // 1st query: verifications
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        profile_id: PROFILE_ID,
                        employee_id: '111',
                        employee_name: 'Lucia Bianchi',
                        job_title: 'Analyst',
                        manager_id: MANAGER_ID,
                        manager_name: 'Marco Rossi',
                        department_name: 'IT',
                        skill_id: '222',
                        skill_name: 'Python',
                        skill_type: 'skill',
                        knowledge_level: 3,
                        skill_level: 4,
                        ability_level: 3,
                        behavior_level: 2,
                        attitude_level: 4,
                        composite_score: '3.20',
                        source: 'self_declaration',
                        evidence_type: null,
                        verification_status: 'pending',
                        created_at: '2025-01-01T00:00:00Z',
                    },
                ],
                rowCount: 1,
            });
            // 2nd query: count
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '10' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-verifications/pending')
                .set('Authorization', `Bearer ${token}`)
                .set('x-tenant-id', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.verifications).toHaveLength(1);
            expect(res.body.data.verifications[0].profileId).toBe(PROFILE_ID);
            expect(res.body.data.verifications[0].hasEvidence).toBe(false);
            expect(res.body.data.meta.total).toBe(10);
        });
        it('should filter by orgUnitId and employeeId', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-verifications/pending')
                .query({ orgUnitId: DEFAULT_IDS.DEPARTMENT_ID, employeeId: DEFAULT_IDS.EMPLOYEE_ID })
                .set('Authorization', `Bearer ${token}`)
                .set('x-tenant-id', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.data.verifications).toEqual([]);
        });
    });
    // =========================================================================
    // POST /:profileId/approve
    // =========================================================================
    describe('POST /:profileId/approve', () => {
        it('should return 400 when verifierId missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/approve`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when verifierId is not UUID', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/approve`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: 'not-a-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 404 when profile not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/approve`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when skill already verified', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        verification_status: 'verified',
                        employee_id: '111',
                        skill_id: '222',
                        employee_name: 'Test',
                        skill_name: 'Python',
                        knowledge_level: 3,
                        skill_level: 3,
                        ability_level: 3,
                        behavior_level: 3,
                        attitude_level: 3,
                        composite_score: '3.00',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/approve`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/already verified/i);
        });
        it('should approve a pending skill verification', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        employee_id: '111',
                        skill_id: '222',
                        verification_status: 'pending',
                        knowledge_level: 3,
                        skill_level: 4,
                        ability_level: 3,
                        behavior_level: 2,
                        attitude_level: 4,
                        composite_score: '3.20',
                        employee_name: 'Lucia Bianchi',
                        skill_name: 'Python',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        verification_status: 'verified',
                        verified_at: '2025-06-01T00:00:00Z',
                        verification_expires_at: '2026-06-01',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/approve`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, notes: 'Good skill level' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.profileId).toBe(PROFILE_ID);
            expect(res.body.data.newStatus).toBe('verified');
            expect(res.body.data.previousStatus).toBe('pending');
            expect(res.body.data.verifiedBy).toBe(VERIFIER_ID);
        });
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('connection error'));
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/approve`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID });
            expect(res.status).toBe(500);
        });
    });
    // =========================================================================
    // POST /:profileId/reject
    // =========================================================================
    describe('POST /:profileId/reject', () => {
        it('should return 400 when reason is missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/reject`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 404 when profile not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/reject`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, reason: 'Insufficient evidence' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when already rejected', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        verification_status: 'rejected',
                        employee_id: '111',
                        skill_id: '222',
                        employee_name: 'Test',
                        skill_name: 'Python',
                        knowledge_level: 3,
                        skill_level: 3,
                        ability_level: 3,
                        behavior_level: 3,
                        attitude_level: 3,
                        composite_score: '3.00',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/reject`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, reason: 'Insufficient evidence' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/already rejected/i);
        });
        it('should reject a skill verification', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        employee_id: '111',
                        skill_id: '222',
                        verification_status: 'pending',
                        knowledge_level: 3,
                        skill_level: 4,
                        ability_level: 3,
                        behavior_level: 2,
                        attitude_level: 4,
                        composite_score: '3.20',
                        employee_name: 'Lucia Bianchi',
                        skill_name: 'Python',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: PROFILE_ID, verified_at: '2025-06-01T00:00:00Z' }],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/reject`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, reason: 'No supporting evidence' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.newStatus).toBe('rejected');
            expect(res.body.data.reason).toBe('No supporting evidence');
        });
    });
    // =========================================================================
    // POST /:profileId/override
    // =========================================================================
    describe('POST /:profileId/override', () => {
        it('should return 400 when verifierId missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/override`)
                .set('Authorization', `Bearer ${token}`)
                .send({ knowledge: 4, reason: 'Observed skill' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when reason missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/override`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, knowledge: 4 });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when no KSABA dimension provided', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/override`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, reason: 'Override needed' });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/at least one KSABA/i);
        });
        it('should return 404 when profile not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/override`)
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID, knowledge: 4, reason: 'Override' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should override skill levels successfully', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        employee_id: '111',
                        skill_id: '222',
                        knowledge_level: 2,
                        skill_level: 3,
                        ability_level: 2,
                        behavior_level: 2,
                        attitude_level: 3,
                        composite_score: '2.40',
                        employee_name: 'Lucia Bianchi',
                        skill_name: 'Python',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        verification_status: 'verified',
                        composite_score: '3.60',
                        updated_at: '2025-06-01',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/skill-verifications/${PROFILE_ID}/override`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                verifierId: VERIFIER_ID,
                knowledge: 4,
                skill: 5,
                reason: 'Observed advanced proficiency',
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.previous.ksaba.knowledge).toBe(2);
            expect(res.body.data.new.ksaba.knowledge).toBe(4);
            expect(res.body.data.new.ksaba.skill).toBe(5);
            expect(res.body.data.reason).toBe('Observed advanced proficiency');
        });
    });
    // =========================================================================
    // GET /audit/:profileId
    // =========================================================================
    describe('GET /audit/:profileId', () => {
        it('should return 404 when profile not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/skill-verifications/audit/${PROFILE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return audit trail with profile info', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: PROFILE_ID,
                        employee_id: '111',
                        employee_name: 'Lucia Bianchi',
                        skill_id: '222',
                        skill_name: 'Python',
                        verification_status: 'verified',
                        verified_by: VERIFIER_ID,
                        verified_by_name: 'Marco Rossi',
                        verified_at: '2025-06-01',
                        verification_notes: 'Good',
                        verification_expires_at: '2026-06-01',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'h1',
                        previous_knowledge_level: 2,
                        previous_skill_level: 3,
                        previous_ability_level: 2,
                        previous_behavior_level: 2,
                        previous_attitude_level: 3,
                        previous_composite_score: '2.40',
                        new_knowledge_level: 4,
                        new_skill_level: 5,
                        new_ability_level: 3,
                        new_behavior_level: 3,
                        new_attitude_level: 4,
                        new_composite_score: '3.80',
                        change_type: 'manager_override',
                        change_reason: 'Advanced proficiency observed',
                        changed_at: '2025-06-01',
                        changed_by_name: 'Marco Rossi',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/skill-verifications/audit/${PROFILE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.profile.currentStatus).toBe('verified');
            expect(res.body.data.profile.verifiedByName).toBe('Marco Rossi');
            expect(res.body.data.auditTrail).toHaveLength(1);
            expect(res.body.data.auditTrail[0].changeType).toBe('manager_override');
            expect(res.body.data.auditTrail[0].previous.ksaba.knowledge).toBe(2);
            expect(res.body.data.auditTrail[0].new.ksaba.knowledge).toBe(4);
            expect(res.body.data.meta.total).toBe(1);
        });
    });
    // =========================================================================
    // POST /bulk-approve
    // =========================================================================
    describe('POST /bulk-approve', () => {
        it('should return 400 when profileIds missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-verifications/bulk-approve')
                .set('Authorization', `Bearer ${token}`)
                .send({ verifierId: VERIFIER_ID });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when verifierId missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-verifications/bulk-approve')
                .set('Authorization', `Bearer ${token}`)
                .send({ profileIds: [PROFILE_ID] });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should bulk approve profiles', async () => {
            const profileId2 = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
            mockQuery.mockResolvedValueOnce({ rows: [{ id: PROFILE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: profileId2 }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/skill-verifications/bulk-approve')
                .set('Authorization', `Bearer ${token}`)
                .send({
                profileIds: [PROFILE_ID, profileId2],
                verifierId: VERIFIER_ID,
                notes: 'Batch approved',
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.approved).toBe(2);
            expect(res.body.data.failed).toBe(0);
            expect(res.body.data.approvedIds).toContain(PROFILE_ID);
        });
        it('should handle partial failures in bulk approve', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: PROFILE_ID }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const failId = '88888888-9999-aaaa-bbbb-cccccccccccc';
            const res = await supertest(app)
                .post('/api/v1/skill-verifications/bulk-approve')
                .set('Authorization', `Bearer ${token}`)
                .send({ profileIds: [PROFILE_ID, failId], verifierId: VERIFIER_ID });
            expect(res.status).toBe(200);
            expect(res.body.data.approved).toBe(1);
            expect(res.body.data.failed).toBe(1);
            expect(res.body.data.errors).toHaveLength(1);
            expect(res.body.data.errors[0].profileId).toBe(failId);
        });
    });
});
//# sourceMappingURL=skill-verifications.test.js.map