/**
 * Skill Extraction Routes - Comprehensive Behavioral Tests
 * Tests actual HTTP request/response behavior for all skill-extraction endpoints.
 * Covers: extract, extract-batch, jobs CRUD, map-single, search, stats.
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
// Mock skill extraction service
const mockExtractSkills = jest.fn();
jest.unstable_mockModule(resolve('../../services/skill-extraction/index.js'), () => ({
    getSkillExtractionService: jest.fn().mockReturnValue({
        extractSkills: mockExtractSkills,
    }),
    ExtractionOptions: undefined,
}));
const { default: express } = await import('express');
const { default: skillExtractionRoutes } = await import('../../routes/skill-extraction.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const JOB_ID = '11111111-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/skill-extraction', authMiddleware);
    app.use('/api/v1/skill-extraction', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/skill-extraction', skillExtractionRoutes);
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
describe('Skill Extraction Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // ===========================================================================
    // EXTRACT
    // ===========================================================================
    describe('POST /skill-extraction/extract', () => {
        it('should extract skills from text', async () => {
            const extractionResult = {
                rawSkills: [{ name: 'Python', type: 'skill', context: 'programming' }],
                mappedSkills: [{ rawSkill: { name: 'Python' }, escoSkillId: 'abc', matchConfidence: 0.95 }],
                unmappedSkills: [],
            };
            mockExtractSkills.mockResolvedValue(extractionResult);
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'I am proficient in Python programming and data analysis with pandas.' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.rawSkills).toHaveLength(1);
            expect(res.body.data.mappedSkills).toHaveLength(1);
        });
        it('should reject text shorter than 10 characters', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'short' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing text', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should pass options to extraction service', async () => {
            mockExtractSkills.mockResolvedValue({ rawSkills: [], mappedSkills: [], unmappedSkills: [] });
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract')
                .set('Authorization', `Bearer ${token}`)
                .send({
                text: 'Expert in machine learning and deep learning techniques with TensorFlow',
                options: { language: 'en', minConfidence: 0.7 },
            });
            expect(res.status).toBe(200);
            expect(mockExtractSkills).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ language: 'en', minConfidence: 0.7 }));
        });
    });
    // ===========================================================================
    // EXTRACT BATCH
    // ===========================================================================
    describe('POST /skill-extraction/extract-batch', () => {
        it('should extract skills from multiple texts', async () => {
            mockExtractSkills.mockResolvedValue({ rawSkills: [], mappedSkills: [], unmappedSkills: [] });
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract-batch')
                .set('Authorization', `Bearer ${token}`)
                .send({
                items: [
                    { id: '1', text: 'Proficient in Python programming and data analysis' },
                    { id: '2', text: 'Expert in React and TypeScript development' },
                ],
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe(2);
            expect(res.body.data.successful).toBe(2);
            expect(res.body.data.failed).toBe(0);
            expect(res.body.data.results).toHaveLength(2);
        });
        it('should handle partial failures in batch', async () => {
            mockExtractSkills
                .mockResolvedValueOnce({ rawSkills: [], mappedSkills: [], unmappedSkills: [] })
                .mockRejectedValueOnce(new Error('Extraction failed'));
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract-batch')
                .set('Authorization', `Bearer ${token}`)
                .send({
                items: [
                    { id: '1', text: 'Proficient in Python programming and data analysis' },
                    { id: '2', text: 'Expert in React and TypeScript development' },
                ],
            });
            expect(res.status).toBe(200);
            expect(res.body.data.successful).toBe(1);
            expect(res.body.data.failed).toBe(1);
            expect(res.body.data.results[1].error).toBe('Extraction failed');
        });
        it('should reject empty items array', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract-batch')
                .set('Authorization', `Bearer ${token}`)
                .send({ items: [] });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing items', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/extract-batch')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // ===========================================================================
    // JOBS
    // ===========================================================================
    describe('GET /skill-extraction/jobs', () => {
        it('should return paginated list of extraction jobs', async () => {
            const jobs = [{ id: JOB_ID, status: 'completed', extracted_count: 5, mapped_count: 4 }];
            mockQuery
                .mockResolvedValueOnce({ rows: jobs, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/jobs')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.jobs).toHaveLength(1);
            expect(res.body.data.meta.total).toBe(1);
        });
        it('should filter by status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/jobs?status=completed')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('status = $'), expect.arrayContaining(['completed']));
        });
        it('should respect pagination params', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/jobs?limit=5&offset=10')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.meta.limit).toBe(5);
            expect(res.body.data.meta.offset).toBe(10);
        });
    });
    describe('GET /skill-extraction/jobs/:jobId', () => {
        it('should return job details', async () => {
            const job = { id: JOB_ID, status: 'completed', extracted_skills: ['Python'] };
            mockQuery.mockResolvedValueOnce({ rows: [job], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/skill-extraction/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(JOB_ID);
        });
        it('should return 404 when job not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/skill-extraction/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('DELETE /skill-extraction/jobs/:jobId', () => {
        it('should delete a job', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: JOB_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/skill-extraction/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Extraction job deleted');
        });
        it('should return 404 when job not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/skill-extraction/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // ===========================================================================
    // MAP SINGLE
    // ===========================================================================
    describe('POST /skill-extraction/map-single', () => {
        it('should map a single skill name to ESCO', async () => {
            const mappedSkill = {
                rawSkill: { name: 'Python', type: 'skill', context: 'Python' },
                escoSkillId: 'abc-123',
                escoSkillUri: 'http://esco/abc',
                escoSkillLabel: 'Python programming',
                matchConfidence: 0.92,
                matchMethod: 'embedding',
            };
            mockExtractSkills.mockResolvedValue({ mappedSkills: [mappedSkill] });
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/map-single')
                .set('Authorization', `Bearer ${token}`)
                .send({ skillName: 'Python' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.escoSkillId).toBe('abc-123');
            expect(res.body.data.matchConfidence).toBe(0.92);
        });
        it('should return fallback when no mapping found', async () => {
            mockExtractSkills.mockResolvedValue({ mappedSkills: [] });
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/map-single')
                .set('Authorization', `Bearer ${token}`)
                .send({ skillName: 'UnknownSkill123' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.escoSkillId).toBeNull();
            expect(res.body.data.matchConfidence).toBe(0);
            expect(res.body.data.matchMethod).toBe('none');
        });
        it('should reject missing skillName', async () => {
            const res = await supertest(app)
                .post('/api/v1/skill-extraction/map-single')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // ===========================================================================
    // SEARCH
    // ===========================================================================
    describe('GET /skill-extraction/search', () => {
        it('should search ESCO skills by query', async () => {
            const skills = [
                {
                    id: '1',
                    uri: 'http://esco/1',
                    label: 'Python programming',
                    skill_type: 'skill',
                    sim_score: 0.9,
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: skills, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/search?q=Python')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.query).toBe('Python');
            expect(res.body.data.language).toBe('en');
            expect(res.body.data.results).toHaveLength(1);
        });
        it('should return 400 when query is missing', async () => {
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/search')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('q (query) is required');
        });
        it('should support Italian language', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/search?q=programmazione&language=it')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.language).toBe('it');
        });
    });
    // ===========================================================================
    // STATS
    // ===========================================================================
    describe('GET /skill-extraction/stats', () => {
        it('should return extraction statistics', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_jobs: '100',
                        completed_jobs: '85',
                        failed_jobs: '5',
                        processing_jobs: '2',
                        avg_processing_ms: '150.5',
                        total_extracted: '500',
                        total_mapped: '400',
                        total_unmapped: '100',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/skill-extraction/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.jobs.total).toBe(100);
            expect(res.body.data.jobs.completed).toBe(85);
            expect(res.body.data.jobs.failed).toBe(5);
            expect(res.body.data.skills.totalExtracted).toBe(500);
            expect(res.body.data.skills.totalMapped).toBe(400);
            expect(res.body.data.performance.avgProcessingMs).toBe(151);
        });
    });
    // ===========================================================================
    // AUTH
    // ===========================================================================
    describe('Authentication', () => {
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/skill-extraction/stats');
            expect(res.status).toBe(401);
        });
    });
});
//# sourceMappingURL=skill-extraction.test.js.map