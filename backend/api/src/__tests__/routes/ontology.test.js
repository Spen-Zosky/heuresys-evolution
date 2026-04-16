/**
 * Ontology Routes - Unit Tests
 * Tests HTTP behavior for the skill ontology system endpoints.
 * Note: Ontology routes use req.dbClient and lazy-initialized
 * OntologyEmbeddingService / CrossEntityEmbeddingService.
 *
 * Endpoints tested:
 *  GET    /stats                               - Ontology statistics
 *  GET    /skills                              - List skills with filters
 *  GET    /skills/popular-pairs                - Popular skill pairs
 *  GET    /skills/:id                          - Get skill detail
 *  GET    /skills/:id/dimensions               - KSABA dimensions for skill
 *  GET    /skills/:id/relations                - Skill relations
 *  GET    /skills/:id/suggestions              - Skill suggestions
 *  POST   /skills/search                       - Semantic search (Zod)
 *  POST   /skills/record-usage                 - Record skill usage (Zod)
 *  POST   /skills/:id/dimensions               - Create dimension (Zod)
 *  PUT    /skills/:id/dimensions/:dimensionId  - Update dimension (Zod)
 *  DELETE /skills/:id/dimensions/:dimensionId  - Delete dimension
 *  POST   /skills/:id/relations                - Create relation (Zod)
 *  DELETE /skills/:id/relations/:relationId    - Delete relation
 *  GET    /categories                          - List categories
 *  GET    /categories/:id                      - Get category detail
 *  POST   /categories                          - Create category (Zod)
 *  PUT    /categories/:id                      - Update category (Zod)
 *  DELETE /categories/:id                      - Delete category
 *  GET    /embeddings/status                   - Embedding status
 *  GET    /tenant-skills                       - List tenant custom skills
 *  POST   /tenant-skills                       - Create tenant skill (Zod)
 *  PUT    /tenant-skills/:id                   - Update tenant skill (Zod)
 *  DELETE /tenant-skills/:id                   - Delete tenant skill
 *  GET    /industries                          - List NACE industries
 *  GET    /industries/:code/occupations        - Occupations for industry
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockPoolQuery },
    appPool: { connect: jest.fn() },
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
// Mock embedding services (lazy initialized in route)
const mockSearchSkillsByVector = jest.fn();
const mockCreateEmbeddingJob = jest.fn();
const mockGetJobStatus = jest.fn();
const mockProcessEmbeddingJob = jest.fn();
const mockInferSkillRelations = jest.fn();
const mockLoadApiKeyFromDb = jest.fn().mockResolvedValue(true);
const mockSetApiKey = jest.fn();
jest.unstable_mockModule(resolve('../../services/ontology-embedding.js'), () => ({
    createOntologyEmbeddingService: jest.fn().mockReturnValue({
        searchSkillsByVector: mockSearchSkillsByVector,
        createEmbeddingJob: mockCreateEmbeddingJob,
        getJobStatus: mockGetJobStatus,
        processEmbeddingJob: mockProcessEmbeddingJob,
        inferSkillRelations: mockInferSkillRelations,
        loadApiKeyFromDb: mockLoadApiKeyFromDb,
        setApiKey: mockSetApiKey,
    }),
    OntologyEmbeddingService: jest.fn(),
}));
const mockCrossEntitySearch = jest.fn();
const mockGetEmbeddingStatus = jest.fn();
const mockGenerateEntityEmbeddings = jest.fn();
const mockGetOrganizationAdvice = jest.fn();
const mockCrossLoadApiKey = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule(resolve('../../services/cross-entity-embedding.js'), () => ({
    createCrossEntityService: jest.fn().mockReturnValue({
        crossEntitySearch: mockCrossEntitySearch,
        getEmbeddingStatus: mockGetEmbeddingStatus,
        generateEntityEmbeddings: mockGenerateEntityEmbeddings,
        getOrganizationAdvice: mockGetOrganizationAdvice,
        loadApiKeyFromDb: mockCrossLoadApiKey,
        setApiKey: jest.fn(),
    }),
    CrossEntityEmbeddingService: jest.fn(),
    EntityType: {},
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/ontology.js');
const supertest = (await import('supertest')).default;
const UUID_1 = '11111111-1111-4111-a111-111111111111';
const UUID_2 = '22222222-2222-4222-a222-222222222222';
function createTestApp() {
    const app = express();
    app.use(express.json());
    // Ontology routes use req.dbClient (no auth / no tenant required for most)
    // but some endpoints check req.tenantId optionally
    app.use('/api/v1/ontology', (req, _res, next) => {
        req.tenantId = UUID_1;
        req.dbClient = { query: mockPoolQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/ontology', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('ontology Routes', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        app = createTestApp();
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // ── GET /stats ────────────────────────────────────────────────────────
    it('GET /stats returns 200 with ontology statistics', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                {
                    total_skills: '13500',
                    skills_with_embedding: '0',
                    categories: '10',
                    dimensions: '5',
                    relations: '20',
                    pending_relations: '3',
                    custom_skills: '0',
                    type_skill: '8000',
                    type_knowledge: '3000',
                    type_competence: '2500',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/stats');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('total_skills');
        expect(res.body.data).toHaveProperty('categories');
    });
    it('GET /stats returns 500 on DB error', async () => {
        mockPoolQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app).get('/api/v1/ontology/stats');
        expect(res.status).toBe(500);
    });
    // ── GET /skills ───────────────────────────────────────────────────────
    it('GET /skills returns 200 with skill list', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [{ id: 'sk-1', preferred_label_en: 'Programming' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/skills');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta).toHaveProperty('total');
    });
    // ── GET /skills/popular-pairs ──────────────────────────────────────────
    it('GET /skills/popular-pairs returns 200 with pairs', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                {
                    skill_id_1: 'sk-1',
                    skill_1_label: 'Python',
                    skill_id_2: 'sk-2',
                    skill_2_label: 'Data Science',
                    co_occurrence_count: '50',
                    usage_strength: '0.85',
                    context_type: 'employee_profile',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/skills/popular-pairs');
        expect(res.status).toBe(200);
        expect(res.body.data.pairs).toHaveLength(1);
        expect(res.body.data.pairs[0].skill1).toHaveProperty('id');
    });
    // ── GET /skills/:id ───────────────────────────────────────────────────
    it('GET /skills/:id returns 200 with skill detail', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ id: 'sk-1', preferred_label_en: 'Programming', skill_type: 'skill' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/skills/sk-1');
        expect(res.status).toBe(200);
        expect(res.body.data.preferred_label_en).toBe('Programming');
    });
    it('GET /skills/:id returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/ontology/skills/nonexistent');
        expect(res.status).toBe(404);
    });
    // ── GET /skills/:id/dimensions ─────────────────────────────────────────
    it('GET /skills/:id/dimensions returns 404 when skill not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/ontology/skills/nonexistent/dimensions');
        expect(res.status).toBe(404);
    });
    it('GET /skills/:id/dimensions returns 200 with dimensions', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ id: 'sk-1' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [{ id: 'dim-1', dimension_type: 'knowledge', is_primary: true }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/skills/sk-1/dimensions');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].dimension_type).toBe('knowledge');
    });
    // ── GET /skills/:id/relations ──────────────────────────────────────────
    it('GET /skills/:id/relations returns 404 when skill not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/ontology/skills/nonexistent/relations');
        expect(res.status).toBe(404);
    });
    it('GET /skills/:id/relations returns 200 with relations', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ id: 'sk-1' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [{ id: 'rel-1', relation_type: 'related', strength: 0.8 }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/skills/sk-1/relations');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // ── POST /skills/search ────────────────────────────────────────────────
    it('POST /skills/search returns 400 on Zod validation (missing query)', async () => {
        const res = await supertest(app).post('/api/v1/ontology/skills/search').send({});
        expect(res.status).toBe(400);
    });
    it('POST /skills/search returns 200 with text fallback results', async () => {
        // First query: embedding check (no embeddings available -> text fallback)
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [
                {
                    id: 'sk-1',
                    uri: 'http://example.com/sk-1',
                    preferred_label_en: 'Programming',
                    preferred_label_it: null,
                    description_en: 'Programming skill',
                    description_it: null,
                    skill_type: 'skill',
                    is_digital: true,
                    is_green: false,
                    is_transversal: false,
                    similarity: '0.9',
                    source: 'esco',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/search')
            .send({ query: 'programming' });
        expect(res.status).toBe(200);
        expect(res.body.data.search_type).toBe('text');
        expect(res.body.data.results).toHaveLength(1);
    });
    // ── POST /skills/record-usage ──────────────────────────────────────────
    it('POST /skills/record-usage returns 400 on Zod validation (missing skillIds)', async () => {
        const res = await supertest(app).post('/api/v1/ontology/skills/record-usage').send({});
        expect(res.status).toBe(400);
    });
    it('POST /skills/record-usage returns 200 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ record_skill_pair_usage: true }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/record-usage')
            .send({ skillIds: [UUID_1, UUID_2] });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('pairsRecorded');
    });
    // ── GET /categories ────────────────────────────────────────────────────
    it('GET /categories returns 200 with category list', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ id: 'cat-1', code: 'SOFT', name_en: 'Soft Skills', level: 0 }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/categories');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].code).toBe('SOFT');
    });
    // ── GET /categories/:id ────────────────────────────────────────────────
    it('GET /categories/:id returns 200 with category detail and children', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({
            rows: [{ id: 'cat-1', code: 'SOFT', name_en: 'Soft Skills' }],
            rowCount: 1,
        })
            .mockResolvedValueOnce({
            rows: [{ id: 'cat-2', code: 'COMM', name_en: 'Communication' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/categories/cat-1');
        expect(res.status).toBe(200);
        expect(res.body.data.children).toHaveLength(1);
    });
    it('GET /categories/:id returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/ontology/categories/nonexistent');
        expect(res.status).toBe(404);
    });
    // ── POST /categories ───────────────────────────────────────────────────
    it('POST /categories returns 400 on Zod validation (missing code)', async () => {
        const res = await supertest(app).post('/api/v1/ontology/categories').send({ name_en: 'Test' });
        expect(res.status).toBe(400);
    });
    it('POST /categories returns 201 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ id: 'cat-new', code: 'TECH', name_en: 'Technical Skills', level: 0 }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/ontology/categories')
            .send({ code: 'TECH', name_en: 'Technical Skills' });
        expect(res.status).toBe(201);
        expect(res.body.data.code).toBe('TECH');
    });
    // ── PUT /categories/:id ────────────────────────────────────────────────
    it('PUT /categories/:id returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .put('/api/v1/ontology/categories/nonexistent')
            .send({ name_en: 'Updated' });
        expect(res.status).toBe(404);
    });
    it('PUT /categories/:id returns 200 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ id: 'cat-1', code: 'SOFT', name_en: 'Updated' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .put('/api/v1/ontology/categories/cat-1')
            .send({ name_en: 'Updated' });
        expect(res.status).toBe(200);
        expect(res.body.data.name_en).toBe('Updated');
    });
    // ── DELETE /categories/:id ─────────────────────────────────────────────
    it('DELETE /categories/:id returns 400 when has child categories', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 });
        const res = await supertest(app).delete('/api/v1/ontology/categories/cat-1');
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('child categories');
    });
    it('DELETE /categories/:id returns 404 when not found', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).delete('/api/v1/ontology/categories/nonexistent');
        expect(res.status).toBe(404);
    });
    it('DELETE /categories/:id returns 200 on success', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }], rowCount: 1 });
        const res = await supertest(app).delete('/api/v1/ontology/categories/cat-1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Category deleted');
    });
    // ── GET /embeddings/status ─────────────────────────────────────────────
    it('GET /embeddings/status returns 200 with coverage stats', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                {
                    total_skills: '13500',
                    with_embedding_en: '1000',
                    with_embedding_it: '500',
                    custom_with_embedding: '10',
                    jobs_processing: '0',
                    jobs_pending: '0',
                    recent_jobs: null,
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/embeddings/status');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('coverage');
        expect(res.body.data).toHaveProperty('ready_for_vector_search');
    });
    // ── POST /skills/:id/dimensions ────────────────────────────────────────
    it('POST /skills/:id/dimensions returns 400 on invalid dimension_type via Zod', async () => {
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/sk-1/dimensions')
            .send({ dimension_type: 'invalid_type' });
        expect(res.status).toBe(400);
    });
    it('POST /skills/:id/dimensions returns 404 when skill not found', async () => {
        // skill check returns empty
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/sk-1/dimensions')
            .send({ dimension_type: 'knowledge' });
        expect(res.status).toBe(404);
    });
    it('POST /skills/:id/dimensions returns 201 on success', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ id: 'sk-1' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [{ id: 'dim-1', dimension_type: 'knowledge', esco_skill_id: 'sk-1' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/sk-1/dimensions')
            .send({ dimension_type: 'knowledge', description_en: 'Programming knowledge' });
        expect(res.status).toBe(201);
        expect(res.body.data.dimension_type).toBe('knowledge');
    });
    // ── DELETE /skills/:id/dimensions/:dimensionId ─────────────────────────
    it('DELETE /skills/:id/dimensions/:dimensionId returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).delete('/api/v1/ontology/skills/sk-1/dimensions/dim-1');
        expect(res.status).toBe(404);
    });
    it('DELETE /skills/:id/dimensions/:dimensionId returns 200 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'dim-1' }], rowCount: 1 });
        const res = await supertest(app).delete('/api/v1/ontology/skills/sk-1/dimensions/dim-1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Dimension deleted');
    });
    // ── POST /skills/:id/relations ─────────────────────────────────────────
    it('POST /skills/:id/relations returns 400 on Zod validation (missing target_skill_id)', async () => {
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/sk-1/relations')
            .send({ relation_type: 'related' });
        expect(res.status).toBe(400);
    });
    it('POST /skills/:id/relations returns 201 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                { id: 'rel-1', source_skill_id: 'sk-1', target_skill_id: UUID_2, relation_type: 'related' },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/ontology/skills/sk-1/relations')
            .send({ target_skill_id: UUID_2, relation_type: 'related' });
        expect(res.status).toBe(201);
        expect(res.body.data.relation_type).toBe('related');
    });
    // ── DELETE /skills/:id/relations/:relationId ───────────────────────────
    it('DELETE /skills/:id/relations/:relationId returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).delete('/api/v1/ontology/skills/sk-1/relations/rel-1');
        expect(res.status).toBe(404);
    });
    it('DELETE /skills/:id/relations/:relationId returns 200 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'rel-1' }], rowCount: 1 });
        const res = await supertest(app).delete('/api/v1/ontology/skills/sk-1/relations/rel-1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Relation deleted');
    });
    // ── GET /tenant-skills ─────────────────────────────────────────────────
    it('GET /tenant-skills returns 200 with tenant custom skills', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({
            rows: [{ id: 'ts-1', name_en: 'Custom Skill', tenant_id: UUID_1 }],
            rowCount: 1,
        })
            .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
        const res = await supertest(app).get('/api/v1/ontology/tenant-skills');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta).toHaveProperty('total');
    });
    // ── POST /tenant-skills ────────────────────────────────────────────────
    it('POST /tenant-skills returns 400 on Zod validation (missing tenant_id)', async () => {
        const res = await supertest(app)
            .post('/api/v1/ontology/tenant-skills')
            .send({ code: 'TS-001', name_en: 'Custom Skill' });
        expect(res.status).toBe(400);
    });
    it('POST /tenant-skills returns 201 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ id: 'ts-1', tenant_id: UUID_1, code: 'TS-001', name_en: 'Custom Skill' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/ontology/tenant-skills')
            .send({ tenant_id: UUID_1, code: 'TS-001', name_en: 'Custom Skill' });
        expect(res.status).toBe(201);
        expect(res.body.data.code).toBe('TS-001');
    });
    // ── PUT /tenant-skills/:id ─────────────────────────────────────────────
    it('PUT /tenant-skills/:id returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .put('/api/v1/ontology/tenant-skills/nonexistent')
            .send({ name_en: 'Updated Skill' });
        expect(res.status).toBe(404);
    });
    it('PUT /tenant-skills/:id returns 200 on success', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ id: 'ts-1', name_en: 'Updated Skill' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .put('/api/v1/ontology/tenant-skills/ts-1')
            .send({ name_en: 'Updated Skill' });
        expect(res.status).toBe(200);
        expect(res.body.data.name_en).toBe('Updated Skill');
    });
    // ── DELETE /tenant-skills/:id ──────────────────────────────────────────
    it('DELETE /tenant-skills/:id returns 404 when not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).delete('/api/v1/ontology/tenant-skills/nonexistent');
        expect(res.status).toBe(404);
    });
    it('DELETE /tenant-skills/:id returns 200 on soft delete', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'ts-1' }], rowCount: 1 });
        const res = await supertest(app).delete('/api/v1/ontology/tenant-skills/ts-1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Skill deactivated');
    });
    it('DELETE /tenant-skills/:id?hard=true returns 200 on hard delete', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'ts-1' }], rowCount: 1 });
        const res = await supertest(app).delete('/api/v1/ontology/tenant-skills/ts-1?hard=true');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Skill permanently deleted');
    });
    // ── GET /industries ────────────────────────────────────────────────────
    it('GET /industries returns 200 with NACE industry list', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                {
                    code: '01',
                    name: 'Crop production',
                    name_it: 'Produzione agricola',
                    name_en: 'Crop production',
                    description: null,
                    level: 2,
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/industries');
        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.meta).toHaveProperty('level');
    });
    // ── GET /industries/:code/occupations ──────────────────────────────────
    it('GET /industries/:code/occupations returns 404 when industry not found', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/ontology/industries/ZZ/occupations');
        expect(res.status).toBe(404);
    });
    // ── GET /skills/:id/suggestions ────────────────────────────────────────
    it('GET /skills/:id/suggestions returns 200 with suggestions', async () => {
        // usage-based query
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                {
                    paired_skill_id: 'sk-2',
                    skill_label: 'Data Science',
                    co_occurrence_count: '10',
                    usage_strength: '0.8',
                },
            ],
            rowCount: 1,
        });
        // relation-based query
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // semantic query
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ skill_id: 'sk-3', skill_label: 'Machine Learning', similarity: 0.75 }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/ontology/skills/sk-1/suggestions');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('suggestions');
        expect(res.body.data).toHaveProperty('sources');
    });
});
//# sourceMappingURL=ontology.test.js.map