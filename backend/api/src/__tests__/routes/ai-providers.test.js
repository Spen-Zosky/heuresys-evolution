/**
 * AI Providers Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for AI provider management,
 * metrics, cost tracking, usage logs, and configuration endpoints.
 * All external dependencies (database, redis, provider factory) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
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
// Mock AI provider factory
const mockHealthCheck = jest.fn();
const mockGetMetrics = jest.fn();
const mockSaveMetricsToDb = jest.fn();
const mockLoadCostSummary = jest.fn();
const mockGenerateEmbedding = jest.fn();
const mockGetProvider = jest.fn();
jest.unstable_mockModule(resolve('../../services/ai-providers/index.js'), () => ({
    getProviderFactory: jest.fn().mockReturnValue({
        healthCheck: mockHealthCheck,
        getMetrics: mockGetMetrics,
        saveMetricsToDb: mockSaveMetricsToDb,
        loadCostSummary: mockLoadCostSummary,
        generateEmbedding: mockGenerateEmbedding,
        getProvider: mockGetProvider,
    }),
    initProviderFactory: jest.fn().mockResolvedValue(undefined),
    ProviderName: {},
}));
// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------
const { default: express } = await import('express');
const { default: aiProvidersRoutes } = await import('../../routes/ai-providers.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/ai-providers', authMiddleware);
    app.use('/api/v1/ai-providers', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/ai-providers', aiProvidersRoutes);
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
// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('AI Providers Routes - Behavioral Tests', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
    });
    // =========================================================================
    // Authentication Enforcement
    // =========================================================================
    describe('Authentication Enforcement', () => {
        it('should return 401 for GET /status without auth token', async () => {
            const res = await supertest(app).get('/api/v1/ai-providers/status');
            expect(res.status).toBe(401);
        });
        it('should return 401 for GET /metrics without auth token', async () => {
            const res = await supertest(app).get('/api/v1/ai-providers/metrics');
            expect(res.status).toBe(401);
        });
        it('should return 401 for GET /costs without auth token', async () => {
            const res = await supertest(app).get('/api/v1/ai-providers/costs');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /ai-providers/status - Provider health
    // =========================================================================
    describe('GET /ai-providers/status', () => {
        it('should return provider health status', async () => {
            const token = createSysadminToken();
            mockHealthCheck.mockResolvedValueOnce({
                openai: { status: 'healthy', latencyMs: 50 },
                gemini: { status: 'healthy', latencyMs: 80 },
            });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.openai.status).toBe('healthy');
            expect(res.body.data.gemini.status).toBe('healthy');
        });
        it('should return 500 when health check fails', async () => {
            const token = createSysadminToken();
            mockHealthCheck.mockRejectedValueOnce(new Error('Provider unreachable'));
            const res = await supertest(app)
                .get('/api/v1/ai-providers/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /ai-providers/metrics - Provider metrics
    // =========================================================================
    describe('GET /ai-providers/metrics', () => {
        it('should return provider metrics with timestamp', async () => {
            const token = createSysadminToken();
            mockGetMetrics.mockReturnValue({
                openai: { totalRequests: 100, avgLatencyMs: 120, errorRate: 0.02 },
                gemini: { totalRequests: 50, avgLatencyMs: 95, errorRate: 0.01 },
            });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/metrics')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.providers.openai.totalRequests).toBe(100);
            expect(res.body.data.timestamp).toBeDefined();
        });
    });
    // =========================================================================
    // POST /ai-providers/metrics/save - Save metrics
    // =========================================================================
    describe('POST /ai-providers/metrics/save', () => {
        it('should save metrics to database', async () => {
            const token = createSysadminToken();
            mockSaveMetricsToDb.mockResolvedValueOnce(undefined);
            const res = await supertest(app)
                .post('/api/v1/ai-providers/metrics/save')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Metrics saved to database');
        });
        it('should return 500 when save fails', async () => {
            const token = createSysadminToken();
            mockSaveMetricsToDb.mockRejectedValueOnce(new Error('DB write error'));
            const res = await supertest(app)
                .post('/api/v1/ai-providers/metrics/save')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /ai-providers/costs - Cost summary
    // =========================================================================
    describe('GET /ai-providers/costs', () => {
        it('should return cost summary with totals', async () => {
            const token = createSysadminToken();
            mockLoadCostSummary.mockResolvedValueOnce([
                { provider: 'openai', totalCost: 12.5, totalTokens: 250000, totalRequests: 100 },
                { provider: 'gemini', totalCost: 5.25, totalTokens: 150000, totalRequests: 60 },
            ]);
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.costs).toHaveLength(2);
            expect(res.body.data.totalCost).toBe(17.75);
            expect(res.body.data.totalTokens).toBe(400000);
            expect(res.body.data.totalRequests).toBe(160);
            expect(res.body.data.period.days).toBe(30);
        });
        it('should accept days query parameter', async () => {
            const token = createSysadminToken();
            mockLoadCostSummary.mockResolvedValueOnce([]);
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs')
                .query({ days: '7' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.period.days).toBe(7);
        });
        it('should accept provider filter', async () => {
            const token = createSysadminToken();
            mockLoadCostSummary.mockResolvedValueOnce([
                { provider: 'openai', totalCost: 12.5, totalTokens: 250000, totalRequests: 100 },
            ]);
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs')
                .query({ provider: 'openai' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.costs).toHaveLength(1);
        });
    });
    // =========================================================================
    // GET /ai-providers/costs/daily - Daily cost breakdown
    // =========================================================================
    describe('GET /ai-providers/costs/daily', () => {
        it('should return daily cost data', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { date: '2025-01-01', provider: 'openai', cost: 1.5, tokens: 30000 },
                    { date: '2025-01-02', provider: 'openai', cost: 2.0, tokens: 40000 },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs/daily')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
        });
        it('should accept days and provider filters', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs/daily')
                .query({ days: '3', provider: 'gemini' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
        });
        it('should return 500 on DB error', async () => {
            const token = createSysadminToken();
            mockQuery.mockRejectedValueOnce(new Error('Query failed'));
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs/daily')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /ai-providers/costs/monthly - Monthly cost summary
    // =========================================================================
    describe('GET /ai-providers/costs/monthly', () => {
        it('should return monthly cost data', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ month: '2025-01', provider: 'openai', cost: 45.0, tokens: 900000 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs/monthly')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
        it('should accept months and provider filters', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs/monthly')
                .query({ months: '6', provider: 'openai' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /ai-providers/costs/by-tenant - Cost by tenant
    // =========================================================================
    describe('GET /ai-providers/costs/by-tenant', () => {
        it('should return cost breakdown by tenant', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ tenant_id: TENANT_ID, tenant_name: 'RTL Bank', total_cost: 25.0 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/costs/by-tenant')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].tenant_name).toBe('RTL Bank');
        });
    });
    // =========================================================================
    // GET /ai-providers/usage - Usage log
    // =========================================================================
    describe('GET /ai-providers/usage', () => {
        it('should return usage log entries with pagination', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'usage-1',
                        provider: 'openai',
                        model: 'gpt-4o',
                        operation: 'embedding',
                        total_tokens: 500,
                    },
                    {
                        id: 'usage-2',
                        provider: 'openai',
                        model: 'gpt-4o',
                        operation: 'chat',
                        total_tokens: 1200,
                    },
                ],
                rowCount: 2,
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/usage')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.entries).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(50);
            expect(res.body.data.meta.limit).toBe(50);
        });
        it('should accept provider and operation filters', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/usage')
                .query({ provider: 'gemini', operation: 'embedding' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.entries).toHaveLength(0);
            expect(res.body.data.meta.total).toBe(0);
        });
        it('should cap limit at 500', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/usage')
                .query({ limit: '1000' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.meta.limit).toBe(500);
        });
    });
    // =========================================================================
    // GET /ai-providers/config - Provider configuration
    // =========================================================================
    describe('GET /ai-providers/config', () => {
        it('should return provider configuration list', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { provider: 'openai', model: 'gpt-4o', is_enabled: true, priority: 1 },
                    { provider: 'gemini', model: 'gemini-pro', is_enabled: true, priority: 2 },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-providers/config')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].provider).toBe('openai');
            expect(res.body.data[0].is_enabled).toBe(true);
        });
    });
    // =========================================================================
    // PUT /ai-providers/config/:provider - Update config
    // =========================================================================
    describe('PUT /ai-providers/config/:provider', () => {
        it('should update provider configuration', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ provider: 'openai', model: 'gpt-4o-mini', is_enabled: true, priority: 1 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .put('/api/v1/ai-providers/config/openai')
                .set('Authorization', `Bearer ${token}`)
                .send({ model: 'gpt-4o-mini', priority: 1 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.model).toBe('gpt-4o-mini');
        });
        it('should return 400 when no fields provided', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .put('/api/v1/ai-providers/config/openai')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('No fields to update');
        });
        it('should return 404 when provider config not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .put('/api/v1/ai-providers/config/unknown-provider')
                .set('Authorization', `Bearer ${token}`)
                .send({ is_enabled: false });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should update only provided fields', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ provider: 'gemini', is_enabled: false }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .put('/api/v1/ai-providers/config/gemini')
                .set('Authorization', `Bearer ${token}`)
                .send({ is_enabled: false });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockQuery).toHaveBeenCalled();
        });
    });
    // =========================================================================
    // POST /ai-providers/test/:provider - Test provider
    // =========================================================================
    describe('POST /ai-providers/test/:provider', () => {
        it('should test a provider and return embedding info', async () => {
            const token = createSysadminToken();
            const mockProvider = {
                validateApiKey: jest.fn().mockResolvedValue(true),
                generateEmbedding: jest.fn().mockResolvedValue({
                    provider: 'openai',
                    model: 'text-embedding-3-small',
                    embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
                    tokensUsed: 10,
                    latencyMs: 50,
                }),
                estimateCost: jest.fn().mockReturnValue(0.0001),
            };
            mockGetProvider.mockReturnValue(mockProvider);
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/ai-providers/test/openai')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'Hello world' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.provider).toBe('openai');
            expect(res.body.data.dimensions).toBe(6);
            expect(res.body.data.tokensUsed).toBe(10);
            expect(res.body.data.embeddingPreview).toHaveLength(5);
        });
        it('should return 400 when text is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/ai-providers/test/openai')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 503 when API key is invalid', async () => {
            const token = createSysadminToken();
            const mockProvider = {
                validateApiKey: jest.fn().mockResolvedValue(false),
            };
            mockGetProvider.mockReturnValue(mockProvider);
            const res = await supertest(app)
                .post('/api/v1/ai-providers/test/openai')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'Test text' });
            expect(res.status).toBe(503);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('API key is invalid');
        });
    });
    // =========================================================================
    // POST /ai-providers/test-fallback - Test fallback mechanism
    // =========================================================================
    describe('POST /ai-providers/test-fallback', () => {
        it('should test fallback and return result', async () => {
            const token = createSysadminToken();
            mockGenerateEmbedding.mockResolvedValueOnce({
                provider: 'gemini',
                model: 'text-embedding-004',
                embedding: [0.1, 0.2, 0.3],
                tokensUsed: 8,
                latencyMs: 60,
            });
            const res = await supertest(app)
                .post('/api/v1/ai-providers/test-fallback')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'Fallback test', preferredProvider: 'openai' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.provider).toBe('gemini');
            expect(res.body.data.dimensions).toBe(3);
        });
        it('should return 400 when text is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/ai-providers/test-fallback')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 500 when all providers fail', async () => {
            const token = createSysadminToken();
            mockGenerateEmbedding.mockRejectedValueOnce(new Error('All providers failed'));
            const res = await supertest(app)
                .post('/api/v1/ai-providers/test-fallback')
                .set('Authorization', `Bearer ${token}`)
                .send({ text: 'Fallback test' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=ai-providers.test.js.map