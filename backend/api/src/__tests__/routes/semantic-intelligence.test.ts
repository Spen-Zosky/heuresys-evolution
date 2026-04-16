/**
 * Semantic Intelligence Routes - Comprehensive Behavioral Tests
 * Tests actual HTTP request/response behavior for all semantic-intelligence endpoints.
 * Covers: unified search, direct search, embedding generation, status, talent/performance/
 * learning/org search, natural language ask, queue management.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockClientRelease,
} as never);

jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
  pool: { query: mockQuery },
  appPool: { connect: mockConnect },
  testConnection: jest.fn().mockResolvedValue(true as never),
  testAppConnection: jest.fn().mockResolvedValue(true as never),
  closePool: jest.fn().mockResolvedValue(undefined as never),
  getAppClient: jest.fn(),
  withTenantClient: jest.fn(),
}));

jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
  getRedis: jest.fn(),
  isRedisReady: jest.fn().mockReturnValue(false),
  blacklistToken: jest.fn().mockResolvedValue(true as never),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false as never),
  closeRedis: jest.fn().mockResolvedValue(undefined as never),
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

// Mock semantic services
const mockUnifiedSearch = jest.fn();
const mockGenerateEntityEmbeddings = jest.fn();
const mockGenerateAllEmbeddings = jest.fn();
const mockGetEmbeddingStatus = jest.fn();
const mockGetIndexStats = jest.fn();
const mockLoadApiKeyFromDb = jest.fn();

jest.unstable_mockModule(resolve('../../services/unified-semantic-service.js'), () => ({
  createUnifiedSemanticService: jest.fn().mockReturnValue({
    unifiedSearch: mockUnifiedSearch,
    generateEntityEmbeddings: mockGenerateEntityEmbeddings,
    generateAllEmbeddings: mockGenerateAllEmbeddings,
    getEmbeddingStatus: mockGetEmbeddingStatus,
    getIndexStats: mockGetIndexStats,
    loadApiKeyFromDb: mockLoadApiKeyFromDb,
  }),
  UnifiedSemanticService: jest.fn(),
  SemanticEntityType: undefined,
}));

const mockGetQueueStats = jest.fn();
const mockProcessBatch = jest.fn();
const mockRetryFailed = jest.fn();
const mockCleanup = jest.fn();
const mockLoadApiKey = jest.fn();
const mockStartBackgroundProcessing = jest.fn();

jest.unstable_mockModule(resolve('../../services/embedding-queue-processor.js'), () => ({
  createEmbeddingQueueProcessor: jest.fn().mockReturnValue({
    getQueueStats: mockGetQueueStats,
    processBatch: mockProcessBatch,
    retryFailed: mockRetryFailed,
    cleanup: mockCleanup,
    loadApiKey: mockLoadApiKey,
    startBackgroundProcessing: mockStartBackgroundProcessing,
  }),
  EmbeddingQueueProcessor: jest.fn(),
}));

const { default: express } = await import('express');
const { default: semanticRoutes } = await import('../../routes/semantic-intelligence.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/semantic', authMiddleware);
  app.use('/api/v1/semantic', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/semantic', semanticRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

const defaultSearchResult = {
  results: [],
  totalResults: 0,
  resultsByType: {},
  queryEmbeddingTime: 10,
  searchTime: 20,
};

describe('Semantic Intelligence Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockLoadApiKeyFromDb.mockResolvedValue(undefined);
    mockLoadApiKey.mockResolvedValue(undefined);
    mockUnifiedSearch.mockResolvedValue(defaultSearchResult);
  });

  // ===========================================================================
  // UNIFIED SEARCH
  // ===========================================================================

  describe('POST /semantic/search', () => {
    it('should perform unified semantic search', async () => {
      const searchResult = {
        results: [{ id: '1', entityType: 'employee', similarity: 0.85 }],
        totalResults: 1,
        resultsByType: { employee: [{ id: '1' }] },
      };
      mockUnifiedSearch.mockResolvedValue(searchResult);

      const res = await supertest(app)
        .post('/api/v1/semantic/search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'software developer with Python skills' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalResults).toBe(1);
      expect(res.body.data.results).toHaveLength(1);
    });

    it('should pass entity type filters', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'python', entityTypes: ['employee', 'skill'], limit: 10 });

      expect(res.status).toBe(200);
      expect(mockUnifiedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'python',
          entityTypes: ['employee', 'skill'],
          limit: 10,
        })
      );
    });

    it('should return 400 when query is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Tenant ID required');
    });
  });

  describe('POST /semantic/search/direct', () => {
    it('should perform direct search bypassing unified index', async () => {
      mockUnifiedSearch.mockResolvedValue(defaultSearchResult);

      const res = await supertest(app)
        .post('/api/v1/semantic/search/direct')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'HR manager' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when query is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/search/direct')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/search/direct')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // EMBEDDING GENERATION
  // ===========================================================================

  describe('POST /semantic/embeddings/generate', () => {
    it('should generate embeddings for a specific entity type', async () => {
      mockGenerateEntityEmbeddings.mockResolvedValue({
        processed: 50,
        skipped: 5,
        errors: 0,
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/embeddings/generate')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ entityType: 'employee', batchSize: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processed).toBe(50);
    });

    it('should return 400 when entityType is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/embeddings/generate')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /semantic/embeddings/generate-all', () => {
    it('should trigger generation for all entity types', async () => {
      mockGenerateAllEmbeddings.mockResolvedValue({});

      const res = await supertest(app)
        .post('/api/v1/semantic/embeddings/generate-all')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('started');
    });
  });

  describe('GET /semantic/embeddings/status', () => {
    it('should return embedding status with summary', async () => {
      mockGetEmbeddingStatus.mockResolvedValue({
        employee: { total: 100, embedded: 80 },
        skill: { total: 200, embedded: 150 },
      });

      const res = await supertest(app)
        .get('/api/v1/semantic/embeddings/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBeDefined();
      expect(res.body.data.summary.totalRecords).toBe(300);
      expect(res.body.data.summary.totalEmbedded).toBe(230);
      expect(res.body.data.summary.overallPercentage).toBe(77);
    });

    it('should handle zero records gracefully', async () => {
      mockGetEmbeddingStatus.mockResolvedValue({});

      const res = await supertest(app)
        .get('/api/v1/semantic/embeddings/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalRecords).toBe(0);
      expect(res.body.data.summary.overallPercentage).toBe(0);
    });
  });

  describe('GET /semantic/index/stats', () => {
    it('should return index statistics', async () => {
      const stats = { totalEntities: 500, totalEmbeddings: 450, indexSize: '2.5 MB' };
      mockGetIndexStats.mockResolvedValue(stats);

      const res = await supertest(app)
        .get('/api/v1/semantic/index/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(stats);
    });
  });

  // ===========================================================================
  // SPECIALIZED SEARCH ENDPOINTS
  // ===========================================================================

  describe('POST /semantic/talent-search', () => {
    it('should search for talent with internal and external results', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [{ id: '1', entityType: 'employee' }],
        totalResults: 1,
        resultsByType: {
          employee: [{ id: '1', name: 'Mario Rossi' }],
          candidate: [],
          skill_gap_analysis: [],
          career_path: [],
        },
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/talent-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'senior developer with React experience' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.internalResults).toBeDefined();
      expect(res.body.data.externalResults).toBeDefined();
      expect(res.body.data.skillGaps).toBeDefined();
      expect(res.body.data.careerPaths).toBeDefined();
    });

    it('should return 400 when query is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/talent-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/talent-search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'developer' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /semantic/performance-search', () => {
    it('should search performance data', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        resultsByType: {
          performance_review: [{ id: '1', score: 4.5 }],
          check_in: [],
          feedback_360: [],
        },
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/performance-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'excellent communication skills' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reviews).toBeDefined();
      expect(res.body.data.checkIns).toBeDefined();
      expect(res.body.data.feedback).toBeDefined();
    });

    it('should return 400 when query is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/performance-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /semantic/learning-search', () => {
    it('should search learning content', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        resultsByType: {
          learning_path: [{ id: '1', title: 'Python Fundamentals' }],
          course: [],
          skill: [],
        },
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/learning-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'machine learning course' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.learningPaths).toBeDefined();
      expect(res.body.data.courses).toBeDefined();
      expect(res.body.data.skills).toBeDefined();
    });

    it('should return 400 when query is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/learning-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /semantic/org-search', () => {
    it('should search organizational structure', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        resultsByType: {
          department: [{ id: '1', name: 'IT' }],
          org_unit: [],
          location: [],
          employee: [],
        },
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/org-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ query: 'information technology department' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.departments).toBeDefined();
      expect(res.body.data.orgUnits).toBeDefined();
      expect(res.body.data.locations).toBeDefined();
      expect(res.body.data.employees).toBeDefined();
    });

    it('should return 400 when query is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/org-search')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // NATURAL LANGUAGE QUERY
  // ===========================================================================

  describe('POST /semantic/ask', () => {
    it('should interpret employee-related question', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        resultsByType: {},
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/ask')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ question: 'Who are the employees with Python skills?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question).toBe('Who are the employees with Python skills?');
      expect(res.body.data.interpretedAs).toBeInstanceOf(Array);
      expect(res.body.data.interpretedAs).toContain('employee');
    });

    it('should interpret skills-related question', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        resultsByType: {},
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/ask')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ question: 'What skills are needed for data science?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interpretedAs).toContain('skill');
    });

    it('should use default entity types for generic question', async () => {
      mockUnifiedSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        resultsByType: {},
      });

      const res = await supertest(app)
        .post('/api/v1/semantic/ask')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ question: 'Something completely unrelated' });

      expect(res.status).toBe(200);
      expect(res.body.data.interpretedAs).toBeInstanceOf(Array);
      expect(res.body.data.interpretedAs.length).toBeGreaterThan(0);
    });

    it('should return 400 when question is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/ask')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/semantic/ask')
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'test question' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // QUEUE MANAGEMENT
  // ===========================================================================

  describe('GET /semantic/queue/status', () => {
    it('should return queue statistics', async () => {
      const queueStats = { pending: 10, processing: 2, completed: 100, failed: 3 };
      mockGetQueueStats.mockResolvedValue(queueStats);

      const res = await supertest(app)
        .get('/api/v1/semantic/queue/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queue).toEqual(queueStats);
      expect(res.body.data.backgroundProcessing).toBe(true);
      expect(res.body.data.batchSize).toBe(50);
    });
  });

  describe('POST /semantic/queue/process', () => {
    it('should manually trigger batch processing', async () => {
      const batchResult = { processed: 50, errors: 2 };
      mockProcessBatch.mockResolvedValue(batchResult);

      const res = await supertest(app)
        .post('/api/v1/semantic/queue/process')
        .set('Authorization', `Bearer ${token}`)
        .send({ batchSize: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(batchResult);
      expect(mockProcessBatch).toHaveBeenCalledWith(100);
    });

    it('should use default batch size when not provided', async () => {
      mockProcessBatch.mockResolvedValue({ processed: 50, errors: 0 });

      const res = await supertest(app)
        .post('/api/v1/semantic/queue/process')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(mockProcessBatch).toHaveBeenCalledWith(50);
    });
  });

  describe('POST /semantic/queue/retry-failed', () => {
    it('should retry all failed queue items', async () => {
      mockRetryFailed.mockResolvedValue(5);

      const res = await supertest(app)
        .post('/api/v1/semantic/queue/retry-failed')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.retriedCount).toBe(5);
      expect(res.body.data.message).toContain('5 failed items');
    });
  });

  describe('POST /semantic/queue/cleanup', () => {
    it('should clean up old completed entries', async () => {
      mockCleanup.mockResolvedValue(25);

      const res = await supertest(app)
        .post('/api/v1/semantic/queue/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({ daysToKeep: 14 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedCount).toBe(25);
      expect(res.body.data.message).toContain('25 completed entries');
      expect(res.body.data.message).toContain('14 days');
      expect(mockCleanup).toHaveBeenCalledWith(14);
    });

    it('should use default daysToKeep when not provided', async () => {
      mockCleanup.mockResolvedValue(10);

      const res = await supertest(app)
        .post('/api/v1/semantic/queue/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(mockCleanup).toHaveBeenCalledWith(7);
    });
  });

  // ===========================================================================
  // AUTH
  // ===========================================================================

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await supertest(app).get('/api/v1/semantic/embeddings/status');
      expect(res.status).toBe(401);
    });
  });
});
