/**
 * Advanced Search Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for advanced semantic search endpoints.
 * All external dependencies (database, redis, search service) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import {
  buildSysadminTokenPayload,
  buildEmployeeTokenPayload,
  resetFactories,
  DEFAULT_IDS,
} from '../factories/index.js';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------

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

// Mock the advanced search service
const mockAdvancedSearch = jest.fn();
const mockExpandQuery = jest.fn();
const mockGetSearchAnalytics = jest.fn();
const mockSubmitSearchFeedback = jest.fn();

jest.unstable_mockModule(resolve('../../services/advanced-semantic-search.js'), () => ({
  getAdvancedSearchService: jest.fn().mockReturnValue({
    advancedSearch: mockAdvancedSearch,
    expandQuery: mockExpandQuery,
    getSearchAnalytics: mockGetSearchAnalytics,
    submitSearchFeedback: mockSubmitSearchFeedback,
  }),
  AdvancedSearchOptions: {},
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: advancedSearchRoutes } = await import('../../routes/advanced-search.js');
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

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/advanced-search', authMiddleware);
  app.use('/api/v1/advanced-search', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/advanced-search', advancedSearchRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        code: err.code,
      });
    }
  );
  return app;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

function createEmployeeToken(): string {
  return generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Advanced Search Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
  });

  // =========================================================================
  // Authentication Enforcement
  // =========================================================================
  describe('Authentication Enforcement', () => {
    it('should return 401 for GET /analytics without auth token', async () => {
      const res = await supertest(app).get('/api/v1/advanced-search/analytics');
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /search without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .send({ query: 'test', tenantId: TENANT_ID });
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /expand without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/advanced-search/expand')
        .send({ query: 'test' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /feedback/:searchId without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-123')
        .send({ score: 4 });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // POST /advanced-search/search - Advanced semantic search
  // =========================================================================
  describe('POST /advanced-search/search', () => {
    it('should perform search and return results', async () => {
      const token = createSysadminToken();
      const mockResult = {
        query: 'project management',
        expansion: null,
        totalResults: 2,
        results: [
          {
            entityType: 'skill',
            entityId: 's1',
            entityName: 'Project Management',
            finalScore: 0.95,
          },
          {
            entityType: 'skill',
            entityId: 's2',
            entityName: 'Program Management',
            finalScore: 0.82,
          },
        ],
        resultsByType: { skill: [] },
        searchDurationMs: 45,
        analyticsId: 'analytics-1',
      };
      mockAdvancedSearch.mockResolvedValueOnce(mockResult as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'project management', tenantId: TENANT_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalResults).toBe(2);
      expect(res.body.data.results).toHaveLength(2);
      expect(res.body.data.results[0].entityName).toBe('Project Management');
    });

    it('should return 400 when query is missing (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ tenantId: TENANT_ID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });

    it('should return 400 when tenantId is missing (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test query' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when query is too short (less than 2 chars)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'a', tenantId: TENANT_ID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when tenantId is not a valid UUID', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test query', tenantId: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should pass optional parameters to the service', async () => {
      const token = createSysadminToken();
      const mockResult = {
        query: 'data analysis',
        expansion: null,
        totalResults: 0,
        results: [],
        resultsByType: {},
        searchDurationMs: 10,
        analyticsId: 'analytics-2',
      };
      mockAdvancedSearch.mockResolvedValueOnce(mockResult as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: 'data analysis',
          tenantId: TENANT_ID,
          entityTypes: ['skill', 'occupation'],
          limit: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAdvancedSearch).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when the service throws an error', async () => {
      const token = createSysadminToken();
      mockAdvancedSearch.mockRejectedValueOnce(new Error('Service unavailable') as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test query', tenantId: TENANT_ID });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should accept requests from regular employee tokens', async () => {
      const token = createEmployeeToken();
      const mockResult = {
        query: 'leadership',
        expansion: null,
        totalResults: 1,
        results: [
          { entityType: 'skill', entityId: 's1', entityName: 'Leadership', finalScore: 0.9 },
        ],
        resultsByType: {},
        searchDurationMs: 20,
        analyticsId: 'analytics-3',
      };
      mockAdvancedSearch.mockResolvedValueOnce(mockResult as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'leadership', tenantId: TENANT_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // POST /advanced-search/expand - Query expansion
  // =========================================================================
  describe('POST /advanced-search/expand', () => {
    it('should expand a query and return expanded terms', async () => {
      const token = createSysadminToken();
      const mockExpansion = {
        originalQuery: 'project management',
        expandedTerms: ['project management', 'program management', 'PMO'],
        synonymsFound: 2,
        expansionMethod: 'hybrid',
      };
      mockExpandQuery.mockResolvedValueOnce(mockExpansion as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/expand')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'project management' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.originalQuery).toBe('project management');
      expect(res.body.data.expandedTerms).toHaveLength(3);
      expect(res.body.data.synonymsFound).toBe(2);
    });

    it('should return 400 when query is missing (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/expand')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should accept optional language parameter', async () => {
      const token = createSysadminToken();
      const mockExpansion = {
        originalQuery: 'gestione progetti',
        expandedTerms: ['gestione progetti', 'project management'],
        synonymsFound: 1,
        expansionMethod: 'synonym',
      };
      mockExpandQuery.mockResolvedValueOnce(mockExpansion as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/expand')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'gestione progetti', language: 'it' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.expandedTerms).toHaveLength(2);
    });

    it('should return 400 for invalid language value', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/expand')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test', language: 'fr' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 when expand service fails', async () => {
      const token = createSysadminToken();
      mockExpandQuery.mockRejectedValueOnce(new Error('DB connection lost') as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/expand')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test query' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /advanced-search/analytics - Search analytics
  // =========================================================================
  describe('GET /advanced-search/analytics', () => {
    it('should return search analytics summary', async () => {
      const token = createSysadminToken();
      const mockAnalytics = {
        totalSearches: 150,
        avgResultCount: 8.5,
        avgDurationMs: 120,
        topQueries: [
          { query: 'project management', count: 25 },
          { query: 'data analysis', count: 18 },
        ],
        searchesByEntityType: { skill: 100, occupation: 50 },
        zeroResultQueries: 5,
        avgFeedbackScore: 4.2,
      };
      mockGetSearchAnalytics.mockResolvedValueOnce(mockAnalytics as never);

      const res = await supertest(app)
        .get('/api/v1/advanced-search/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSearches).toBe(150);
      expect(res.body.data.topQueries).toHaveLength(2);
      expect(res.body.data.avgFeedbackScore).toBe(4.2);
    });

    it('should pass tenantId query param to the service', async () => {
      const token = createSysadminToken();
      mockGetSearchAnalytics.mockResolvedValueOnce({
        totalSearches: 0,
        avgResultCount: 0,
        avgDurationMs: 0,
        topQueries: [],
        searchesByEntityType: {},
        zeroResultQueries: 0,
        avgFeedbackScore: null,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/advanced-search/analytics')
        .query({ tenantId: TENANT_ID })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockGetSearchAnalytics).toHaveBeenCalledWith(TENANT_ID, 30);
    });

    it('should accept days query parameter', async () => {
      const token = createSysadminToken();
      mockGetSearchAnalytics.mockResolvedValueOnce({
        totalSearches: 50,
        avgResultCount: 5,
        avgDurationMs: 80,
        topQueries: [],
        searchesByEntityType: {},
        zeroResultQueries: 0,
        avgFeedbackScore: null,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/advanced-search/analytics')
        .query({ days: '7' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockGetSearchAnalytics).toHaveBeenCalledWith(undefined, 7);
    });

    it('should cap days at 365', async () => {
      const token = createSysadminToken();
      mockGetSearchAnalytics.mockResolvedValueOnce({
        totalSearches: 0,
        avgResultCount: 0,
        avgDurationMs: 0,
        topQueries: [],
        searchesByEntityType: {},
        zeroResultQueries: 0,
        avgFeedbackScore: null,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/advanced-search/analytics')
        .query({ days: '999' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockGetSearchAnalytics).toHaveBeenCalledWith(undefined, 365);
    });

    it('should default to 30 days when days is not a number', async () => {
      const token = createSysadminToken();
      mockGetSearchAnalytics.mockResolvedValueOnce({
        totalSearches: 0,
        avgResultCount: 0,
        avgDurationMs: 0,
        topQueries: [],
        searchesByEntityType: {},
        zeroResultQueries: 0,
        avgFeedbackScore: null,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/advanced-search/analytics')
        .query({ days: 'invalid' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockGetSearchAnalytics).toHaveBeenCalledWith(undefined, 30);
    });

    it('should return 500 when analytics service fails', async () => {
      const token = createSysadminToken();
      mockGetSearchAnalytics.mockRejectedValueOnce(new Error('Analytics error') as never);

      const res = await supertest(app)
        .get('/api/v1/advanced-search/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /advanced-search/feedback/:searchId - Search feedback
  // =========================================================================
  describe('POST /advanced-search/feedback/:searchId', () => {
    it('should submit feedback successfully', async () => {
      const token = createSysadminToken();
      mockSubmitSearchFeedback.mockResolvedValueOnce(undefined as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-abc-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 4 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Feedback submitted successfully');
      expect(mockSubmitSearchFeedback).toHaveBeenCalledWith('search-abc-123', 4);
    });

    it('should return 400 when score is missing (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-abc-123')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when score is below 1 (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-abc-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when score is above 5 (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-abc-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 6 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when score is not an integer (Zod validation)', async () => {
      const token = createSysadminToken();
      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-abc-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 3.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept minimum score of 1', async () => {
      const token = createSysadminToken();
      mockSubmitSearchFeedback.mockResolvedValueOnce(undefined as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-min')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSubmitSearchFeedback).toHaveBeenCalledWith('search-min', 1);
    });

    it('should accept maximum score of 5', async () => {
      const token = createSysadminToken();
      mockSubmitSearchFeedback.mockResolvedValueOnce(undefined as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-max')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSubmitSearchFeedback).toHaveBeenCalledWith('search-max', 5);
    });

    it('should return 500 when feedback service fails', async () => {
      const token = createSysadminToken();
      mockSubmitSearchFeedback.mockRejectedValueOnce(new Error('DB write error') as never);

      const res = await supertest(app)
        .post('/api/v1/advanced-search/feedback/search-abc-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 3 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
