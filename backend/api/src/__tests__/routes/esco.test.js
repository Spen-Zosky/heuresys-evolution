/**
 * ESCO Routes - Unit Tests
 *
 * Tests:
 *   GET  /esco/stats                        - ESCO statistics
 *   GET  /esco/isco-groups                  - List ISCO groups
 *   GET  /esco/isco-groups/:code            - Get ISCO group by code
 *   GET  /esco/occupations                  - Search occupations
 *   GET  /esco/occupations/:id              - Get occupation details
 *   GET  /esco/skills                       - Search skills
 *   GET  /esco/skills/:id                   - Get skill details
 *   GET  /esco/skill-groups                 - List skill groups
 *   GET  /esco/occupation-skills/:id        - Get skills for occupation
 *   GET  /esco/skill-relations/:skillId     - Get related skills
 *   GET  /esco/skill-clusters               - List skill clusters
 *   GET  /esco/skill-clusters/:code         - Get cluster details
 *   GET  /esco/skill-classifications/:id    - Get classifications for skill
 *   GET  /esco/classification-stats         - Classification statistics
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
// Mock the cache service - cached() just executes the callback directly
jest.unstable_mockModule(resolve('../../services/cache.js'), () => ({
    cached: jest.fn().mockImplementation(async (_key, fn) => fn()),
}));
// Mock cacheControl middleware - pass through
jest.unstable_mockModule(resolve('../../middleware/cacheHeaders.js'), () => ({
    cacheControl: jest
        .fn()
        .mockReturnValue((_req, _res, next) => next()),
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/esco.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const { cached } = await import('../../services/cache.js');
const { cacheControl } = await import('../../middleware/cacheHeaders.js');
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/esco', authMiddleware);
    app.use('/api/v1/esco', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/esco', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('ESCO Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        cached.mockImplementation(async (_key, fn) => fn());
        cacheControl.mockReturnValue((_req, _res, next) => next());
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/esco/stats');
        expect(res.status).toBe(401);
    });
    // GET /stats
    it('GET /stats should return ESCO statistics', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    isco_groups: '436',
                    occupations: '3008',
                    skills: '13890',
                    skills_count: '10000',
                    knowledge_count: '3890',
                    digital_skills: '500',
                    green_skills: '200',
                    transversal_skills: '150',
                    skill_groups: '100',
                    occupation_skill_relations: '50000',
                    skill_skill_relations: '20000',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.occupations).toBe('3008');
    });
    it('GET /stats should return 500 on DB error', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app)
            .get('/api/v1/esco/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // GET /isco-groups
    it('GET /isco-groups should return groups', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'g1',
                    code: '1',
                    preferred_label_en: 'Managers',
                    level: 1,
                    children_count: '5',
                    occupations_count: '10',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/isco-groups')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.count).toBe(1);
    });
    it('GET /isco-groups should support level filter', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/isco-groups?level=2')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    // GET /isco-groups/:code
    it('GET /isco-groups/:code should return group with children', async () => {
        // group query
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'g1',
                    uri: 'http://esco/isco/1',
                    code: '1',
                    preferred_label_en: 'Managers',
                    level: 1,
                },
            ],
            rowCount: 1,
        });
        // children query
        mockQuery.mockResolvedValueOnce({
            rows: [{ code: '11', preferred_label_en: 'Chief Executives', level: 2 }],
            rowCount: 1,
        });
        // occupations query
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'o1', preferred_label_en: 'CEO' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/isco-groups/1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.code).toBe('1');
        expect(res.body.data.children).toHaveLength(1);
        expect(res.body.data.occupations).toHaveLength(1);
    });
    it('GET /isco-groups/:code should return 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/isco-groups/9999')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // GET /occupations
    it('GET /occupations should return occupations list', async () => {
        // data query
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 'o1', code: '1120', preferred_label_en: 'Managing director', skills_count: '20' },
            ],
            rowCount: 1,
        });
        // count query
        mockQuery.mockResolvedValueOnce({ rows: [{ count: '3008' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/esco/occupations')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta.total).toBe(3008);
    });
    // GET /occupations/:id
    it('GET /occupations/:id should return occupation with skills', async () => {
        // occupation query
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'o1', code: '1120', preferred_label_en: 'Managing director' }],
            rowCount: 1,
        });
        // essential skills
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 's1', preferred_label_en: 'Leadership', skill_type: 'skill' }],
            rowCount: 1,
        });
        // optional skills
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/occupations/o1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.essential_skills).toHaveLength(1);
        expect(res.body.data.optional_skills).toHaveLength(0);
    });
    it('GET /occupations/:id should return 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/occupations/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // GET /skills
    it('GET /skills should return skills list with search', async () => {
        // data query
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 's1', preferred_label_en: 'Java', skill_type: 'skill', is_digital: true }],
            rowCount: 1,
        });
        // count query
        mockQuery.mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/esco/skills?search=Java')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // GET /skills/:id
    it('GET /skills/:id should return skill with relations', async () => {
        // skill query
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 's1', uri: 'http://esco/skill/s1', preferred_label_en: 'Java', skill_type: 'skill' },
            ],
            rowCount: 1,
        });
        // occupations query
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'o1', preferred_label_en: 'Software Developer', relation_type: 'essential' }],
            rowCount: 1,
        });
        // related skills query
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        // classifications query
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/skills/s1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.preferred_label_en).toBe('Java');
        expect(res.body.data.occupations).toHaveLength(1);
    });
    it('GET /skills/:id should return 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/skills/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // GET /skill-groups
    it('GET /skill-groups should return root groups', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'sg1',
                    code: 'S1',
                    preferred_label_en: 'Communication skills',
                    children_count: '5',
                    skills_count: '20',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/skill-groups')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // GET /skill-relations/:skillId
    it('GET /skill-relations/:skillId should return 404 when skill not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/skill-relations/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('GET /skill-relations/:skillId should return related skills', async () => {
        // skill URI query
        mockQuery.mockResolvedValueOnce({ rows: [{ uri: 'http://esco/skill/s1' }], rowCount: 1 });
        // related skills query
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 's2', preferred_label_en: 'Python', relation_type: 'broader' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/skill-relations/s1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // GET /skill-clusters
    it('GET /skill-clusters should return clusters', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: 'c1',
                    code: 'TC-01',
                    name_en: 'Technical Skills',
                    mapped_skills: '500',
                    avg_confidence: '0.85',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/skill-clusters')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // GET /skill-clusters/:code
    it('GET /skill-clusters/:code should return 404 when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/esco/skill-clusters/NONEXIST')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // GET /classification-stats
    it('GET /classification-stats should return classification statistics', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    total_skills: '13890',
                    mapped_skills: '10000',
                    total_classifications: '12000',
                    total_clusters: '50',
                    l1_clusters: '10',
                    l2_clusters: '40',
                    avg_confidence: '0.82',
                    needs_review: '150',
                    high_confidence: '8000',
                    medium_confidence: '1500',
                    low_confidence: '500',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/esco/classification-stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.total_skills).toBe('13890');
    });
});
//# sourceMappingURL=esco.test.js.map