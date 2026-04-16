/**
 * Knowledge Base Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for CCNL, policies, and KB management endpoints.
 * All external dependencies (database, redis, sentry, document-processor) are mocked.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

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

// Mock document-processor service
const mockIngestCCNL = jest.fn();
const mockIngestCompanyPolicy = jest.fn();
const mockProcessDocument = jest.fn();
const mockProcessPendingDocuments = jest.fn();

jest.unstable_mockModule(resolve('../../services/document-processor.js'), () => ({
  createDocumentProcessor: jest.fn().mockReturnValue({
    ingestCCNL: mockIngestCCNL,
    ingestCompanyPolicy: mockIngestCompanyPolicy,
    processDocument: mockProcessDocument,
    processPendingDocuments: mockProcessPendingDocuments,
  }),
  DocumentProcessor: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: knowledgeBaseRoutes } = await import('../../routes/knowledge-base.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const KB_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
const DOC_ID = '88888888-aaaa-bbbb-cccc-dddddddddddd';

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
  app.use('/api/v1/knowledge-base', authMiddleware);
  app.use('/api/v1/knowledge-base', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/knowledge-base', knowledgeBaseRoutes);
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

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleKB = {
  id: KB_ID,
  tenant_id: TENANT_ID,
  code: 'ccnl-commercio',
  name: 'CCNL Commercio',
  description: 'Contratto Collettivo Nazionale del Commercio',
  kb_type: 'ccnl',
  is_public: false,
  is_active: true,
  document_count: '5',
  total_chunks: '120',
  created_at: '2026-01-01T00:00:00Z',
};

const sampleContract = {
  id: VALID_UUID,
  code: 'ccnl-comm-2024',
  name: 'CCNL Commercio 2024',
  sector: 'Commercio',
  effective_date: '2024-01-01',
  expiry_date: '2027-12-31',
  annual_leave_days: 26,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Knowledge Base Routes', () => {
  let app: Express;
  let token: string;

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
    it('should return 401 when no auth token is provided', async () => {
      const res = await supertest(app).get('/api/v1/knowledge-base');
      expect(res.status).toBe(401);
    });

    it('should return 401 with an invalid token', async () => {
      const res = await supertest(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /knowledge-base
  // =========================================================================

  describe('GET /knowledge-base', () => {
    it('should return list of knowledge bases with counts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [sampleKB], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('ccnl-commercio');
      expect(res.body.data[0].document_count).toBe('5');
      expect(res.body.data[0].total_chunks).toBe('120');
    });

    it('should return empty array when no knowledge bases exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return 500 when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection lost'));

      const res = await supertest(app)
        .get('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /knowledge-base
  // =========================================================================

  describe('POST /knowledge-base', () => {
    const validPayload = {
      code: 'custom-hr-policies',
      name: 'HR Policies Collection',
      description: 'Company HR policies',
    };

    it('should create a new knowledge base', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dup check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: KB_ID, ...validPayload }], rowCount: 1 }); // insert

      const res = await supertest(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Knowledge base created');
    });

    it('should return 409 when code already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: KB_ID }], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Knowledge base with this code already exists');
    });

    it('should return 400 when code is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No code provided' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'valid-code' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /knowledge-base/:id
  // =========================================================================

  describe('GET /knowledge-base/:id', () => {
    it('should return knowledge base details with documents', async () => {
      const docs = [
        {
          id: DOC_ID,
          filename: 'policy.pdf',
          original_name: 'Company Policy',
          status: 'completed',
          chunk_count: 20,
          created_at: '2026-01-01',
          processed_at: '2026-01-01',
        },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [sampleKB], rowCount: 1 })
        .mockResolvedValueOnce({ rows: docs, rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/knowledge-base/${KB_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('ccnl-commercio');
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0].filename).toBe('policy.pdf');
    });

    it('should return 404 when knowledge base is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/knowledge-base/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // GET /knowledge-base/ccnl/contracts
  // =========================================================================

  describe('GET /knowledge-base/ccnl/contracts', () => {
    it('should return list of active CCNL contracts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [sampleContract], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base/ccnl/contracts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('ccnl-comm-2024');
      expect(res.body.data[0].sector).toBe('Commercio');
    });

    it('should return empty array when no contracts exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base/ccnl/contracts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /knowledge-base/ccnl/contracts/:code
  // =========================================================================

  describe('GET /knowledge-base/ccnl/contracts/:code', () => {
    it('should return CCNL contract details by code', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [sampleContract], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base/ccnl/contracts/ccnl-comm-2024')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('CCNL Commercio 2024');
    });

    it('should return 404 when contract code does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base/ccnl/contracts/non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /knowledge-base/ccnl/ingest
  // =========================================================================

  describe('POST /knowledge-base/ccnl/ingest', () => {
    const validCCNL = {
      code: 'ccnl-metalmeccanici',
      name: 'CCNL Metalmeccanici',
      sector: 'Metalmeccanica',
      fullText: 'Full text of the contract...',
    };

    it('should ingest a CCNL document successfully', async () => {
      const processingResult = { documentId: DOC_ID, chunksCreated: 50, success: true };
      mockIngestCCNL.mockResolvedValueOnce(processingResult);

      const res = await supertest(app)
        .post('/api/v1/knowledge-base/ccnl/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send(validCCNL);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('CCNL document ingested and processed');
      expect(res.body.data.documentId).toBe(DOC_ID);
    });

    it('should return 400 when code is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base/ccnl/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test', sector: 'Test', fullText: 'Text' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when fullText is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base/ccnl/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'test', name: 'Test', sector: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 when document processor fails', async () => {
      mockIngestCCNL.mockRejectedValueOnce(new Error('Processing failed'));

      const res = await supertest(app)
        .post('/api/v1/knowledge-base/ccnl/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send(validCCNL);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /knowledge-base/policies
  // NOTE: Due to Express route ordering, GET /policies is caught by GET /:id
  // (with id='policies'). The /:id handler runs first and queries the DB
  // for a knowledge base with id='policies', which returns 404.
  // This documents the ACTUAL behavior of the route.
  // =========================================================================

  describe('GET /knowledge-base/policies (caught by /:id)', () => {
    it('should be caught by /:id route and return 404 since no KB with id=policies exists', async () => {
      // The /:id handler fires first, queries for KB with id='policies' - gets empty result
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base/policies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /knowledge-base/policies/ingest
  // =========================================================================

  describe('POST /knowledge-base/policies/ingest', () => {
    const validPolicy = {
      title: 'Travel Expense Policy',
      content: 'Full content of the travel expense policy...',
      policyType: 'finance',
    };

    it('should ingest a company policy successfully', async () => {
      const result = { documentId: DOC_ID, chunksCreated: 10, success: true };
      mockIngestCompanyPolicy.mockResolvedValueOnce(result);

      const res = await supertest(app)
        .post('/api/v1/knowledge-base/policies/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send(validPolicy);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Company policy ingested and processed');
    });

    it('should return 400 when title is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base/policies/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Some content', policyType: 'hr' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when content is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base/policies/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Title', policyType: 'hr' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when policyType is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/knowledge-base/policies/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Title', content: 'Content' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /knowledge-base/policies/:id
  // =========================================================================

  describe('GET /knowledge-base/policies/:id', () => {
    it('should return policy document with chunks', async () => {
      const doc = {
        id: DOC_ID,
        original_name: 'Policy',
        status: 'completed',
        knowledge_base_name: 'HR KB',
      };
      const chunks = [
        { id: 'chunk-1', chunk_index: 0, section_title: 'Introduction', content_length: 500 },
        { id: 'chunk-2', chunk_index: 1, section_title: 'Details', content_length: 800 },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [doc], rowCount: 1 })
        .mockResolvedValueOnce({ rows: chunks, rowCount: 2 });

      const res = await supertest(app)
        .get(`/api/v1/knowledge-base/policies/${DOC_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.knowledge_base_name).toBe('HR KB');
      expect(res.body.data.chunks).toHaveLength(2);
      expect(res.body.data.chunks[0].section_title).toBe('Introduction');
    });

    it('should return 404 when policy document is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/knowledge-base/policies/${VALID_UUID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /knowledge-base/documents/:id/reprocess
  // =========================================================================

  describe('POST /knowledge-base/documents/:id/reprocess', () => {
    it('should reprocess a document successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID }], rowCount: 1 });
      const processResult = { success: true, documentId: DOC_ID, chunksCreated: 25 };
      mockProcessDocument.mockResolvedValueOnce(processResult);

      const res = await supertest(app)
        .post(`/api/v1/knowledge-base/documents/${DOC_ID}/reprocess`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Document reprocessed successfully');
    });

    it('should return 404 when document does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/knowledge-base/documents/${VALID_UUID}/reprocess`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should handle processing failure gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID }], rowCount: 1 });
      mockProcessDocument.mockResolvedValueOnce({
        success: false,
        error: 'Embedding generation failed',
      });

      const res = await supertest(app)
        .post(`/api/v1/knowledge-base/documents/${DOC_ID}/reprocess`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Document processing failed');
    });
  });

  // =========================================================================
  // POST /knowledge-base/process-pending
  // =========================================================================

  describe('POST /knowledge-base/process-pending', () => {
    it('should process pending documents and return summary', async () => {
      const results = [
        { success: true, documentId: 'doc-1' },
        { success: true, documentId: 'doc-2' },
        { success: false, documentId: 'doc-3', error: 'Parse failure' },
      ];
      mockProcessPendingDocuments.mockResolvedValueOnce(results);

      const res = await supertest(app)
        .post('/api/v1/knowledge-base/process-pending')
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processed).toBe(3);
      expect(res.body.data.successful).toBe(2);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.results).toHaveLength(3);
    });

    it('should handle empty pending queue', async () => {
      mockProcessPendingDocuments.mockResolvedValueOnce([]);

      const res = await supertest(app)
        .post('/api/v1/knowledge-base/process-pending')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(0);
      expect(res.body.data.successful).toBe(0);
      expect(res.body.data.failed).toBe(0);
    });
  });

  // =========================================================================
  // GET /knowledge-base/stats
  // NOTE: Due to Express route ordering, GET /stats is caught by GET /:id
  // (with id='stats'). The /:id handler runs first and queries the DB
  // for a knowledge base with id='stats', which returns 404.
  // =========================================================================

  describe('GET /knowledge-base/stats (caught by /:id)', () => {
    it('should be caught by /:id route and return 404 since no KB with id=stats exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/knowledge-base/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });
});
