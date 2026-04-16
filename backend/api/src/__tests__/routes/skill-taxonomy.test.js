/**
 * skill-taxonomy Routes - Comprehensive Behavioral Tests
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
// Mock SkillClassificationService
const mockGetStats = jest.fn();
const mockGetAllClassifications = jest.fn();
const mockGetClassification = jest.fn();
const mockUpsertClassification = jest.fn();
const mockValidateClassification = jest.fn();
const mockGetClusters = jest.fn();
const mockGetClusterSummary = jest.fn();
const mockGetSkillsInCluster = jest.fn();
const mockCreateCluster = jest.fn();
const mockAssignToCluster = jest.fn();
const mockSuggestCluster = jest.fn();
const mockGetSkillsByCategory = jest.fn();
const mockGetSkillsByCognitiveLevel = jest.fn();
const mockGetSkillsByTransferability = jest.fn();
jest.unstable_mockModule(resolve('../../services/skill-classification.js'), () => ({
    SkillClassificationService: jest.fn().mockImplementation(() => ({
        getStats: mockGetStats,
        getAllClassifications: mockGetAllClassifications,
        getClassification: mockGetClassification,
        upsertClassification: mockUpsertClassification,
        validateClassification: mockValidateClassification,
        getClusters: mockGetClusters,
        getClusterSummary: mockGetClusterSummary,
        getSkillsInCluster: mockGetSkillsInCluster,
        createCluster: mockCreateCluster,
        assignToCluster: mockAssignToCluster,
        suggestCluster: mockSuggestCluster,
        getSkillsByCategory: mockGetSkillsByCategory,
        getSkillsByCognitiveLevel: mockGetSkillsByCognitiveLevel,
        getSkillsByTransferability: mockGetSkillsByTransferability,
    })),
    // Re-export types as empty values (they're just type references)
    PrimaryCategory: undefined,
    CognitiveLevel: undefined,
    Transferability: undefined,
    SocialDimension: undefined,
}));
// Mock SkillRelationshipService
const mockRelGetStats = jest.fn();
const mockGetRelationships = jest.fn();
const mockGetSkillRelationshipSummary = jest.fn();
const mockGetPrerequisites = jest.fn();
const mockGetComplementarySkills = jest.fn();
const mockGetSubstitutionSkills = jest.fn();
const mockGetBuildsOnSkills = jest.fn();
const mockGetEnabledSkills = jest.fn();
const mockCreateRelationship = jest.fn();
const mockValidateRelationship = jest.fn();
const mockDeleteRelationship = jest.fn();
const mockGetAdjacencies = jest.fn();
const mockCreateAdjacency = jest.fn();
const mockCalculateJobPostingAdjacencies = jest.fn();
const mockCalculateEmployeeAdjacencies = jest.fn();
const mockGetSkillGraph = jest.fn();
const mockFindSkillPath = jest.fn();
const mockGetCareerPathSkills = jest.fn();
jest.unstable_mockModule(resolve('../../services/skill-relationships.js'), () => ({
    SkillRelationshipService: jest.fn().mockImplementation(() => ({
        getStats: mockRelGetStats,
        getRelationships: mockGetRelationships,
        getSkillRelationshipSummary: mockGetSkillRelationshipSummary,
        getPrerequisites: mockGetPrerequisites,
        getComplementarySkills: mockGetComplementarySkills,
        getSubstitutionSkills: mockGetSubstitutionSkills,
        getBuildsOnSkills: mockGetBuildsOnSkills,
        getEnabledSkills: mockGetEnabledSkills,
        createRelationship: mockCreateRelationship,
        validateRelationship: mockValidateRelationship,
        deleteRelationship: mockDeleteRelationship,
        getAdjacencies: mockGetAdjacencies,
        createAdjacency: mockCreateAdjacency,
        calculateJobPostingAdjacencies: mockCalculateJobPostingAdjacencies,
        calculateEmployeeAdjacencies: mockCalculateEmployeeAdjacencies,
        getSkillGraph: mockGetSkillGraph,
        findSkillPath: mockFindSkillPath,
        getCareerPathSkills: mockGetCareerPathSkills,
    })),
    RelationshipType: undefined,
    AdjacencyType: undefined,
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/skill-taxonomy.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const SKILL_UUID = '11111111-aaaa-bbbb-cccc-dddddddddddd';
const SKILL_UUID_2 = '22222222-aaaa-bbbb-cccc-dddddddddddd';
const CLUSTER_UUID = '33333333-aaaa-bbbb-cccc-dddddddddddd';
const REL_UUID = '44444444-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/skill-taxonomy', authMiddleware);
    app.use('/api/v1/skill-taxonomy', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/skill-taxonomy', routes);
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
describe('skill-taxonomy Routes', () => {
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
            const res = await supertest(app).get('/api/v1/skill-taxonomy/stats');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /stats
    // =========================================================================
    describe('GET /stats', () => {
        it('should return classification stats', async () => {
            const stats = { total: 100, hard: 40, soft: 35, hybrid: 25 };
            mockGetStats.mockResolvedValueOnce(stats);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(stats);
        });
        it('should return 500 when service throws', async () => {
            mockGetStats.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /classifications
    // =========================================================================
    describe('GET /classifications', () => {
        it('should return paginated classifications', async () => {
            const data = [{ id: '1', primary_category: 'hard' }];
            mockGetAllClassifications.mockResolvedValueOnce({ data, total: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/classifications')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(data);
            expect(res.body.meta.total).toBe(1);
            expect(res.body.meta.limit).toBe(50);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should pass filters to service', async () => {
            mockGetAllClassifications.mockResolvedValueOnce({ data: [], total: 0 });
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/classifications')
                .query({ primary_category: 'hard', needs_review: 'true', limit: '10', offset: '5' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(10);
            expect(res.body.meta.offset).toBe(5);
        });
    });
    // =========================================================================
    // GET /classifications/:escoSkillId
    // =========================================================================
    describe('GET /classifications/:escoSkillId', () => {
        it('should return 404 when classification not found', async () => {
            mockGetClassification.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/classifications/${SKILL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return classification when found', async () => {
            const cls = { id: '1', esco_skill_id: SKILL_UUID, primary_category: 'soft' };
            mockGetClassification.mockResolvedValueOnce(cls);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/classifications/${SKILL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(cls);
        });
    });
    // =========================================================================
    // POST /classifications
    // =========================================================================
    describe('POST /classifications', () => {
        it('should return 400 when esco_skill_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/classifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ primary_category: 'hard' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create classification with valid data', async () => {
            const result = { id: '1', esco_skill_id: SKILL_UUID, primary_category: 'hard' };
            mockUpsertClassification.mockResolvedValueOnce(result);
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/classifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ esco_skill_id: SKILL_UUID, primary_category: 'hard' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(result);
            expect(res.body.message).toMatch(/saved/i);
        });
        it('should return 500 when service throws', async () => {
            mockUpsertClassification.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/classifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ esco_skill_id: SKILL_UUID, primary_category: 'hard' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /classifications/:id/validate
    // =========================================================================
    describe('POST /classifications/:id/validate', () => {
        it('should validate a classification', async () => {
            const result = { id: '1', needs_review: false };
            mockValidateClassification.mockResolvedValueOnce(result);
            const res = await supertest(app)
                .post(`/api/v1/skill-taxonomy/classifications/${SKILL_UUID}/validate`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/validated/i);
        });
    });
    // =========================================================================
    // GET /clusters
    // =========================================================================
    describe('GET /clusters', () => {
        it('should return clusters list', async () => {
            const clusters = [{ id: CLUSTER_UUID, code: 'CL1', name_en: 'Data Science' }];
            mockGetClusters.mockResolvedValueOnce(clusters);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/clusters')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(clusters);
        });
        it('should pass filter options to service', async () => {
            mockGetClusters.mockResolvedValueOnce([]);
            await supertest(app)
                .get('/api/v1/skill-taxonomy/clusters')
                .query({ level: '2', parent_id: CLUSTER_UUID, include_skill_count: 'true' })
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetClusters).toHaveBeenCalledWith(expect.objectContaining({ level: 2, parent_id: CLUSTER_UUID, include_skill_count: true }));
        });
    });
    // =========================================================================
    // GET /clusters/summary
    // =========================================================================
    describe('GET /clusters/summary', () => {
        it('should return cluster summary', async () => {
            const summary = { total_clusters: 5, skills_classified: 80 };
            mockGetClusterSummary.mockResolvedValueOnce(summary);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/clusters/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(summary);
        });
    });
    // =========================================================================
    // GET /clusters/:id/skills
    // =========================================================================
    describe('GET /clusters/:id/skills', () => {
        it('should return skills in cluster', async () => {
            const skills = [{ id: SKILL_UUID, preferred_label: 'Python' }];
            mockGetSkillsInCluster.mockResolvedValueOnce(skills);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/clusters/${CLUSTER_UUID}/skills`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(skills);
        });
    });
    // =========================================================================
    // POST /clusters
    // =========================================================================
    describe('POST /clusters', () => {
        it('should return 400 when code missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/clusters')
                .set('Authorization', `Bearer ${token}`)
                .send({ name_en: 'Test Cluster' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create cluster with valid data', async () => {
            const cluster = { id: CLUSTER_UUID, code: 'DS', name_en: 'Data Science' };
            mockCreateCluster.mockResolvedValueOnce(cluster);
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/clusters')
                .set('Authorization', `Bearer ${token}`)
                .send({ code: 'DS', name_en: 'Data Science' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(cluster);
        });
    });
    // =========================================================================
    // POST /skills/:escoSkillId/assign-cluster
    // =========================================================================
    describe('POST /skills/:escoSkillId/assign-cluster', () => {
        it('should return 400 when cluster_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/skill-taxonomy/skills/${SKILL_UUID}/assign-cluster`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should assign skill to cluster', async () => {
            mockAssignToCluster.mockResolvedValueOnce(undefined);
            const res = await supertest(app)
                .post(`/api/v1/skill-taxonomy/skills/${SKILL_UUID}/assign-cluster`)
                .set('Authorization', `Bearer ${token}`)
                .send({ cluster_id: CLUSTER_UUID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/assigned/i);
        });
    });
    // =========================================================================
    // GET /skills/:escoSkillId/suggest-cluster
    // =========================================================================
    describe('GET /skills/:escoSkillId/suggest-cluster', () => {
        it('should return cluster suggestions', async () => {
            const suggestions = [{ id: CLUSTER_UUID, name_en: 'Data Science', score: 0.9 }];
            mockSuggestCluster.mockResolvedValueOnce(suggestions);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/skills/${SKILL_UUID}/suggest-cluster`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(suggestions);
        });
    });
    // =========================================================================
    // GET /skills/by-category/:category
    // =========================================================================
    describe('GET /skills/by-category/:category', () => {
        it('should return 400 for invalid category', async () => {
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/skills/by-category/invalid')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/invalid category/i);
        });
        it('should return skills for valid category', async () => {
            const skills = [{ id: '1', preferred_label: 'Python' }];
            mockGetSkillsByCategory.mockResolvedValueOnce(skills);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/skills/by-category/hard')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(skills);
            expect(res.body.count).toBe(1);
        });
    });
    // =========================================================================
    // GET /skills/by-cognitive-level/:level
    // =========================================================================
    describe('GET /skills/by-cognitive-level/:level', () => {
        it('should return 400 for invalid level', async () => {
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/skills/by-cognitive-level/5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/invalid level/i);
        });
        it('should return skills for valid cognitive level', async () => {
            const skills = [{ id: '1' }];
            mockGetSkillsByCognitiveLevel.mockResolvedValueOnce(skills);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/skills/by-cognitive-level/2')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(skills);
            expect(res.body.count).toBe(1);
        });
    });
    // =========================================================================
    // GET /skills/by-transferability/:transferability
    // =========================================================================
    describe('GET /skills/by-transferability/:transferability', () => {
        it('should return 400 for invalid transferability', async () => {
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/skills/by-transferability/invalid')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/invalid transferability/i);
        });
        it('should return skills for valid transferability', async () => {
            const skills = [{ id: '1' }, { id: '2' }];
            mockGetSkillsByTransferability.mockResolvedValueOnce(skills);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/skills/by-transferability/specialized')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(skills);
            expect(res.body.count).toBe(2);
        });
    });
    // =========================================================================
    // RELATIONSHIP ROUTES
    // =========================================================================
    describe('GET /relationships/stats', () => {
        it('should return relationship stats', async () => {
            const stats = { total: 200, prerequisite: 50, complementary: 80 };
            mockRelGetStats.mockResolvedValueOnce(stats);
            const res = await supertest(app)
                .get('/api/v1/skill-taxonomy/relationships/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(stats);
        });
    });
    describe('GET /relationships/:escoSkillId', () => {
        it('should return relationships for a skill', async () => {
            const rels = [{ id: REL_UUID, relationship_type: 'prerequisite' }];
            mockGetRelationships.mockResolvedValueOnce(rels);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(rels);
        });
        it('should pass type and direction filters', async () => {
            mockGetRelationships.mockResolvedValueOnce([]);
            await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}`)
                .query({ type: 'prerequisite', direction: 'outgoing' })
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetRelationships).toHaveBeenCalledWith(SKILL_UUID, expect.objectContaining({ type: 'prerequisite', direction: 'outgoing' }));
        });
    });
    describe('GET /relationships/:escoSkillId/prerequisites', () => {
        it('should return prerequisites', async () => {
            const prereqs = [{ id: '1', skill_label: 'Basic Math' }];
            mockGetPrerequisites.mockResolvedValueOnce(prereqs);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}/prerequisites`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(prereqs);
        });
    });
    describe('GET /relationships/:escoSkillId/complementary', () => {
        it('should return complementary skills', async () => {
            mockGetComplementarySkills.mockResolvedValueOnce([{ id: '1' }]);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}/complementary`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('GET /relationships/:escoSkillId/substitutions', () => {
        it('should return substitution skills', async () => {
            mockGetSubstitutionSkills.mockResolvedValueOnce([]);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}/substitutions`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
    describe('GET /relationships/:escoSkillId/builds-on', () => {
        it('should return builds-on skills', async () => {
            mockGetBuildsOnSkills.mockResolvedValueOnce([{ id: '1' }]);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}/builds-on`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('GET /relationships/:escoSkillId/enables', () => {
        it('should return enabled skills', async () => {
            mockGetEnabledSkills.mockResolvedValueOnce([{ id: '1' }]);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/relationships/${SKILL_UUID}/enables`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('POST /relationships', () => {
        it('should return 400 when source_skill_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/relationships')
                .set('Authorization', `Bearer ${token}`)
                .send({ target_skill_id: SKILL_UUID_2, relationship_type: 'prerequisite' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create relationship with valid data', async () => {
            const rel = { id: REL_UUID, source_skill_id: SKILL_UUID, target_skill_id: SKILL_UUID_2 };
            mockCreateRelationship.mockResolvedValueOnce(rel);
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/relationships')
                .set('Authorization', `Bearer ${token}`)
                .send({
                source_skill_id: SKILL_UUID,
                target_skill_id: SKILL_UUID_2,
                relationship_type: 'prerequisite',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(rel);
        });
    });
    describe('POST /relationships/:id/validate', () => {
        it('should validate a relationship', async () => {
            mockValidateRelationship.mockResolvedValueOnce({ id: REL_UUID });
            const res = await supertest(app)
                .post(`/api/v1/skill-taxonomy/relationships/${REL_UUID}/validate`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/validated/i);
        });
    });
    describe('DELETE /relationships/:id', () => {
        it('should delete a relationship', async () => {
            mockDeleteRelationship.mockResolvedValueOnce(undefined);
            const res = await supertest(app)
                .delete(`/api/v1/skill-taxonomy/relationships/${REL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/deleted/i);
        });
        it('should return 500 when delete fails', async () => {
            mockDeleteRelationship.mockRejectedValueOnce(new Error('not found'));
            const res = await supertest(app)
                .delete(`/api/v1/skill-taxonomy/relationships/${REL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // ADJACENCY ROUTES
    // =========================================================================
    describe('GET /adjacencies/:escoSkillId', () => {
        it('should return adjacencies for a skill', async () => {
            const adjs = [{ id: '1', adjacent_skill_id: SKILL_UUID_2, adjacency_score: 0.8 }];
            mockGetAdjacencies.mockResolvedValueOnce(adjs);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/adjacencies/${SKILL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(adjs);
        });
    });
    describe('POST /adjacencies', () => {
        it('should return 400 when skill_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/adjacencies')
                .set('Authorization', `Bearer ${token}`)
                .send({ adjacent_skill_id: SKILL_UUID_2, adjacency_score: 0.8 });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create adjacency with valid data', async () => {
            const adj = { id: '1', skill_id: SKILL_UUID, adjacent_skill_id: SKILL_UUID_2 };
            mockCreateAdjacency.mockResolvedValueOnce(adj);
            const res = await supertest(app)
                .post('/api/v1/skill-taxonomy/adjacencies')
                .set('Authorization', `Bearer ${token}`)
                .send({ skill_id: SKILL_UUID, adjacent_skill_id: SKILL_UUID_2, adjacency_score: 0.8 });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(adj);
        });
    });
    describe('POST /adjacencies/:escoSkillId/calculate', () => {
        it('should calculate adjacencies for all types', async () => {
            mockCalculateJobPostingAdjacencies.mockResolvedValueOnce(5);
            mockCalculateEmployeeAdjacencies.mockResolvedValueOnce(3);
            const res = await supertest(app)
                .post(`/api/v1/skill-taxonomy/adjacencies/${SKILL_UUID}/calculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ type: 'all' });
            expect(res.status).toBe(200);
            expect(res.body.data.job_posting_adjacencies).toBe(5);
            expect(res.body.data.employee_adjacencies).toBe(3);
            expect(res.body.data.total).toBe(8);
        });
        it('should calculate only job_posting adjacencies', async () => {
            mockCalculateJobPostingAdjacencies.mockResolvedValueOnce(10);
            const res = await supertest(app)
                .post(`/api/v1/skill-taxonomy/adjacencies/${SKILL_UUID}/calculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ type: 'job_posting' });
            expect(res.status).toBe(200);
            expect(res.body.data.job_posting_adjacencies).toBe(10);
            expect(res.body.data.employee_adjacencies).toBe(0);
        });
    });
    // =========================================================================
    // GRAPH ROUTES
    // =========================================================================
    describe('GET /graph/:escoSkillId', () => {
        it('should return skill graph', async () => {
            const graph = { nodes: [{ id: SKILL_UUID }], edges: [] };
            mockGetSkillGraph.mockResolvedValueOnce(graph);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/graph/${SKILL_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(graph);
        });
        it('should pass depth parameter', async () => {
            mockGetSkillGraph.mockResolvedValueOnce({ nodes: [], edges: [] });
            await supertest(app)
                .get(`/api/v1/skill-taxonomy/graph/${SKILL_UUID}`)
                .query({ depth: '3' })
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetSkillGraph).toHaveBeenCalledWith(SKILL_UUID, 3);
        });
    });
    describe('GET /path/:fromSkillId/:toSkillId', () => {
        it('should return path between skills', async () => {
            const path = [{ skill_id: SKILL_UUID }, { skill_id: SKILL_UUID_2 }];
            mockFindSkillPath.mockResolvedValueOnce(path);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/path/${SKILL_UUID}/${SKILL_UUID_2}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(path);
        });
        it('should return null data when no path found', async () => {
            mockFindSkillPath.mockResolvedValueOnce([]);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/path/${SKILL_UUID}/${SKILL_UUID_2}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeNull();
            expect(res.body.message).toMatch(/no path/i);
        });
    });
    describe('GET /career-path/:fromSkillId/:toSkillId', () => {
        it('should return career path skills', async () => {
            const careerPath = { steps: [{ skill_id: SKILL_UUID }] };
            mockGetCareerPathSkills.mockResolvedValueOnce(careerPath);
            const res = await supertest(app)
                .get(`/api/v1/skill-taxonomy/career-path/${SKILL_UUID}/${SKILL_UUID_2}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(careerPath);
        });
    });
});
//# sourceMappingURL=skill-taxonomy.test.js.map