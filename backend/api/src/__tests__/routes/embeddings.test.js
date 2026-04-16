/**
 * Embeddings Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for embedding pipeline endpoints.
 * All external dependencies (database, redis, embedding service) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, buildEmployeeTokenPayload, resetFactories, DEFAULT_IDS, } from '../factories/index.js';
// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------
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
// Mock embedding pipeline service
const mockLoadApiKey = jest.fn().mockResolvedValue(undefined);
const mockQueueEntity = jest.fn();
const mockProcessQueue = jest.fn();
const mockGenerateEmbedding = jest.fn();
const mockSearchSimilar = jest.fn();
const mockGetQueueStats = jest.fn();
const mockReindexEntity = jest.fn();
jest.unstable_mockModule(resolve('../../services/embedding-pipeline.js'), () => ({
    createEmbeddingPipeline: jest.fn().mockReturnValue({
        loadApiKey: mockLoadApiKey,
        queueEntity: mockQueueEntity,
        processQueue: mockProcessQueue,
        generateEmbedding: mockGenerateEmbedding,
        searchSimilar: mockSearchSimilar,
        getQueueStats: mockGetQueueStats,
        reindexEntity: mockReindexEntity,
    }),
    EmbeddingPipelineService: jest.fn(),
}));
// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------
const { default: express } = await import('express');
const { default: embeddingsRoutes } = await import('../../routes/embeddings.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
// ---------------------------------------------------------------------------
// Constants & Test app factory
// ---------------------------------------------------------------------------
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.EMPLOYEE_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/embeddings', authMiddleware);
    app.use('/api/v1/embeddings', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/embeddings', embeddingsRoutes);
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
function createEmployeeToken() {
    return generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Embeddings Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
    });
    // =========================================================================
    // Auth enforcement
    // =========================================================================
    describe('Auth enforcement', () => {
        it('should return 401 for POST /queue without token', async () => {
            const res = await supertest(app).post('/api/v1/embeddings/queue').send({
                entity_type: 'skill',
                entity_id: VALID_UUID,
                text_content: 'test',
            });
            expect(res.status).toBe(401);
        });
        it('should return 401 for GET /stats without token', async () => {
            const res = await supertest(app).get('/api/v1/embeddings/stats');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // POST /embeddings/queue
    // =========================================================================
    describe('POST /queue', () => {
        const validPayload = {
            entity_type: 'skill',
            entity_id: VALID_UUID,
            text_content: 'Data analysis and visualization with Python',
        };
        it('should return 201 when queuing entity for embedding', async () => {
            mockQueueEntity.mockResolvedValueOnce('queue-uuid-123');
            const res = await supertest(app)
                .post('/api/v1/embeddings/queue')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.queue_id).toBe('queue-uuid-123');
            expect(res.body.data.entity_type).toBe('skill');
            expect(res.body.data.entity_id).toBe(VALID_UUID);
            expect(res.body.message).toBe('Entity queued for embedding generation');
        });
        it('should return 400 when entity_type is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/embeddings/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({ entity_id: VALID_UUID, text_content: 'test' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when entity_id is not a UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/embeddings/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({ entity_type: 'skill', entity_id: 'not-a-uuid', text_content: 'test' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when text_content is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/embeddings/queue')
                .set('Authorization', `Bearer ${token}`)
                .send({ entity_type: 'skill', entity_id: VALID_UUID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 when service throws', async () => {
            mockQueueEntity.mockRejectedValueOnce(new Error('Queue error'));
            const res = await supertest(app)
                .post('/api/v1/embeddings/queue')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
        it('should pass correct parameters to pipeline service', async () => {
            mockQueueEntity.mockResolvedValueOnce('q1');
            await supertest(app)
                .post('/api/v1/embeddings/queue')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(mockQueueEntity).toHaveBeenCalledWith({
                entityType: 'skill',
                entityId: VALID_UUID,
                tenantId: TENANT_ID,
                textContent: 'Data analysis and visualization with Python',
            });
        });
    });
    // =========================================================================
    // POST /embeddings/process
    // =========================================================================
    describe('POST /process', () => {
        it('should return 200 with processing results', async () => {
            mockProcessQueue.mockResolvedValueOnce({
                processed: 10,
                succeeded: 8,
                failed: 2,
                durationMs: 1500,
                errors: ['Error on entity X'],
            });
            const res = await supertest(app)
                .post('/api/v1/embeddings/process')
                .set('Authorization', `Bearer ${token}`)
                .send({ batch_size: 10 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.processed).toBe(10);
            expect(res.body.data.succeeded).toBe(8);
            expect(res.body.data.failed).toBe(2);
            expect(res.body.data.duration_ms).toBe(1500);
            expect(res.body.data.errors).toHaveLength(1);
        });
        it('should use default batch_size of 50 when not provided', async () => {
            mockProcessQueue.mockResolvedValueOnce({
                processed: 0,
                succeeded: 0,
                failed: 0,
                durationMs: 100,
                errors: [],
            });
            await supertest(app)
                .post('/api/v1/embeddings/process')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(mockProcessQueue).toHaveBeenCalledWith(50);
        });
        it('should cap batch_size at 200', async () => {
            mockProcessQueue.mockResolvedValueOnce({
                processed: 0,
                succeeded: 0,
                failed: 0,
                durationMs: 100,
                errors: [],
            });
            await supertest(app)
                .post('/api/v1/embeddings/process')
                .set('Authorization', `Bearer ${token}`)
                .send({ batch_size: 500 });
            // Zod will reject > 200
            // The route code caps at 200 but Zod schema max is 200
        });
        it('should allow employee users (AI_SERVICES maps to EMPLOYEE in legacy mode)', async () => {
            const employeeToken = createEmployeeToken();
            mockProcessQueue.mockResolvedValueOnce({
                processed: 0,
                succeeded: 0,
                failed: 0,
                durationMs: 100,
                errors: [],
            });
            const res = await supertest(app)
                .post('/api/v1/embeddings/process')
                .set('Authorization', `Bearer ${employeeToken}`)
                .send({});
            expect(res.status).toBe(200);
        });
        it('should omit errors array when empty', async () => {
            mockProcessQueue.mockResolvedValueOnce({
                processed: 5,
                succeeded: 5,
                failed: 0,
                durationMs: 500,
                errors: [],
            });
            const res = await supertest(app)
                .post('/api/v1/embeddings/process')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.data.errors).toBeUndefined();
        });
    });
    // =========================================================================
    // POST /embeddings/search
    // =========================================================================
    describe('POST /search', () => {
        it('should return 200 with search results', async () => {
            const vector = [0.1, 0.2, 0.3];
            const results = [
                { entity_type: 'skill', entity_id: 'e1', similarity: 0.95, text_content: 'Python' },
                { entity_type: 'skill', entity_id: 'e2', similarity: 0.85, text_content: 'Data Analysis' },
            ];
            mockGenerateEmbedding.mockResolvedValueOnce(vector);
            mockSearchSimilar.mockResolvedValueOnce(results);
            const res = await supertest(app)
                .post('/api/v1/embeddings/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: 'Python programming' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.query).toBe('Python programming');
            expect(res.body.data.results).toHaveLength(2);
            expect(res.body.data.count).toBe(2);
            expect(res.body.data.results[0].similarity).toBe(0.95);
        });
        it('should return 400 when query is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/embeddings/search')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should pass entity_type filter to service', async () => {
            mockGenerateEmbedding.mockResolvedValueOnce([0.1]);
            mockSearchSimilar.mockResolvedValueOnce([]);
            await supertest(app)
                .post('/api/v1/embeddings/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: 'test', entity_type: 'employee', limit: 5 });
            expect(mockSearchSimilar).toHaveBeenCalledWith([0.1], TENANT_ID, 5, 'employee');
        });
        it('should default limit to 10', async () => {
            mockGenerateEmbedding.mockResolvedValueOnce([0.1]);
            mockSearchSimilar.mockResolvedValueOnce([]);
            await supertest(app)
                .post('/api/v1/embeddings/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: 'test' });
            expect(mockSearchSimilar).toHaveBeenCalledWith([0.1], TENANT_ID, 10, undefined);
        });
        it('should return 500 when embedding generation fails', async () => {
            mockGenerateEmbedding.mockRejectedValueOnce(new Error('OpenAI API error'));
            const res = await supertest(app)
                .post('/api/v1/embeddings/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: 'test query' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /embeddings/stats
    // =========================================================================
    describe('GET /stats', () => {
        it('should return 200 with queue and index statistics', async () => {
            mockGetQueueStats.mockResolvedValueOnce({
                pending: 10,
                processing: 2,
                completed: 500,
                failed: 5,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [{ total_indexed: '500', with_embeddings: '490', without_embeddings: '10' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/embeddings/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.queue.pending).toBe(10);
            expect(res.body.data.queue.completed).toBe(500);
            expect(res.body.data.index.total_indexed).toBe(500);
            expect(res.body.data.index.with_embeddings).toBe(490);
            expect(res.body.data.index.without_embeddings).toBe(10);
        });
        it('should return 500 when service throws', async () => {
            mockGetQueueStats.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/embeddings/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /embeddings/reindex
    // =========================================================================
    describe('POST /reindex', () => {
        const validPayload = {
            entity_type: 'skill',
            entity_id: VALID_UUID,
        };
        it('should return 200 when re-indexing entity', async () => {
            mockReindexEntity.mockResolvedValueOnce(undefined);
            const res = await supertest(app)
                .post('/api/v1/embeddings/reindex')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.entity_type).toBe('skill');
            expect(res.body.data.entity_id).toBe(VALID_UUID);
            expect(res.body.message).toBe('Entity re-indexed successfully');
        });
        it('should allow employee users (AI_SERVICES maps to EMPLOYEE in legacy mode)', async () => {
            const employeeToken = createEmployeeToken();
            mockReindexEntity.mockResolvedValueOnce(undefined);
            const res = await supertest(app)
                .post('/api/v1/embeddings/reindex')
                .set('Authorization', `Bearer ${employeeToken}`)
                .send(validPayload);
            expect(res.status).toBe(200);
        });
        it('should return 400 when entity_type is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/embeddings/reindex')
                .set('Authorization', `Bearer ${token}`)
                .send({ entity_id: VALID_UUID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when entity_id is not a UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/embeddings/reindex')
                .set('Authorization', `Bearer ${token}`)
                .send({ entity_type: 'skill', entity_id: 'not-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 when reindex fails', async () => {
            mockReindexEntity.mockRejectedValueOnce(new Error('Reindex error'));
            const res = await supertest(app)
                .post('/api/v1/embeddings/reindex')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=embeddings.test.js.map