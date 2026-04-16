/**
 * rag-documents Routes - Comprehensive Behavioral Tests
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
// Mock RAG chunking service
const mockProcessDocument = jest.fn();
const mockGetDocumentChunks = jest.fn();
const mockDeleteDocumentChunks = jest.fn();
const mockSearchChunks = jest.fn();
jest.unstable_mockModule(resolve('../../services/rag-chunking.js'), () => ({
    processDocument: mockProcessDocument,
    getDocumentChunks: mockGetDocumentChunks,
    deleteDocumentChunks: mockDeleteDocumentChunks,
    searchChunks: mockSearchChunks,
}));
const { default: express } = await import('express');
const { default: routeHandler } = await import('../../routes/rag-documents.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const DOC_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/rag-documents', authMiddleware);
    app.use('/api/v1/rag-documents', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/rag-documents', routeHandler);
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
describe('rag-documents Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
        mockProcessDocument.mockReset();
        mockGetDocumentChunks.mockReset();
        mockDeleteDocumentChunks.mockReset();
        mockSearchChunks.mockReset();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Auth enforcement', () => {
        it('should return 401 for GET / without token', async () => {
            const res = await supertest(app).get('/api/v1/rag-documents');
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST /search without token', async () => {
            const res = await supertest(app).post('/api/v1/rag-documents/search').send({ query: 'test' });
            expect(res.status).toBe(401);
        });
        it('should return 401 for DELETE /:id without token', async () => {
            const res = await supertest(app).delete(`/api/v1/rag-documents/${DOC_ID}`);
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // POST /search
    // =========================================================================
    describe('POST /search', () => {
        it('should return 200 with search results', async () => {
            const chunks = [
                { id: 'c1', content: 'HR policy text', similarity: 0.92 },
                { id: 'c2', content: 'Leave management', similarity: 0.85 },
            ];
            mockSearchChunks.mockResolvedValueOnce(chunks);
            const res = await supertest(app)
                .post('/api/v1/rag-documents/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: 'HR policy' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta.query).toBe('HR policy');
            expect(res.body.meta.result_count).toBe(2);
        });
        it('should pass options to searchChunks', async () => {
            mockSearchChunks.mockResolvedValueOnce([]);
            await supertest(app)
                .post('/api/v1/rag-documents/search')
                .set('Authorization', `Bearer ${token}`)
                .send({
                query: 'leave policy',
                limit: 5,
                similarity_threshold: 0.8,
                knowledge_base_id: 'kb1',
                document_id: DOC_ID,
            });
            expect(mockSearchChunks).toHaveBeenCalledWith('leave policy', TENANT_ID, expect.objectContaining({
                limit: 5,
                similarityThreshold: 0.8,
                knowledgeBaseId: 'kb1',
                documentId: DOC_ID,
            }));
        });
        it('should return 400 when query is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/rag-documents/search')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('query is required');
        });
        it('should return 400 when query is empty string', async () => {
            const res = await supertest(app)
                .post('/api/v1/rag-documents/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: '   ' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 when search service fails', async () => {
            mockSearchChunks.mockRejectedValueOnce(new Error('Embedding service down'));
            const res = await supertest(app)
                .post('/api/v1/rag-documents/search')
                .set('Authorization', `Bearer ${token}`)
                .send({ query: 'test query' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /stats
    // =========================================================================
    describe('GET /stats', () => {
        it('should return 200 with document statistics', async () => {
            const statsRow = {
                total: '100',
                pending: '5',
                processing: '2',
                completed: '90',
                error: '3',
                total_size_bytes: '5242880',
                total_chunks: '1200',
                latest_versions: '80',
            };
            mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/rag-documents/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe('100');
            expect(res.body.data.completed).toBe('90');
            expect(res.body.data.total_chunks).toBe('1200');
        });
        it('should return 500 when query fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/rag-documents/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /source-types
    // =========================================================================
    describe('GET /source-types', () => {
        it('should return 200 with source type breakdown', async () => {
            const rows = [
                { source_type: 'document', count: '50', total_size: '2621440' },
                { source_type: 'policy', count: '30', total_size: '1048576' },
            ];
            mockQuery.mockResolvedValueOnce({ rows, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/rag-documents/source-types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].source_type).toBe('document');
        });
    });
    // =========================================================================
    // GET / — List documents
    // =========================================================================
    describe('GET /', () => {
        it('should return 200 with document list and meta', async () => {
            const docRow = {
                id: DOC_ID,
                filename: 'policy.pdf',
                status: 'completed',
                uploaded_by_name: 'Mario Rossi',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [docRow], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/rag-documents')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].filename).toBe('policy.pdf');
            expect(res.body.meta.total).toBe(25);
            expect(res.body.meta.limit).toBe(100);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should filter by status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/rag-documents?status=completed')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const params = mockQuery.mock.calls[0][1];
            expect(params).toContain('completed');
        });
        it('should filter by source_type', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            await supertest(app)
                .get('/api/v1/rag-documents?source_type=policy')
                .set('Authorization', `Bearer ${token}`);
            const params = mockQuery.mock.calls[0][1];
            expect(params).toContain('policy');
        });
        it('should filter by is_latest', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            await supertest(app)
                .get('/api/v1/rag-documents?is_latest=true')
                .set('Authorization', `Bearer ${token}`);
            const params = mockQuery.mock.calls[0][1];
            expect(params).toContain(true);
        });
        it('should filter by search term', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            await supertest(app)
                .get('/api/v1/rag-documents?search=policy')
                .set('Authorization', `Bearer ${token}`);
            const params = mockQuery.mock.calls[0][1];
            expect(params).toContain('%policy%');
        });
        it('should accept custom limit and offset', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/rag-documents?limit=20&offset=10')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(20);
            expect(res.body.meta.offset).toBe(10);
        });
    });
    // =========================================================================
    // GET /:id — Document details
    // =========================================================================
    describe('GET /:id', () => {
        it('should return 200 with document details and versions', async () => {
            const docRow = {
                id: DOC_ID,
                filename: 'policy.pdf',
                is_latest: true,
                uploaded_by_name: 'Mario Rossi',
            };
            const versionRows = [
                { id: DOC_ID, version: 2, created_at: '2025-01-02', version_notes: 'Updated' },
                { id: 'v1-id', version: 1, created_at: '2025-01-01', version_notes: 'Initial' },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: [docRow], rowCount: 1 })
                .mockResolvedValueOnce({ rows: versionRows, rowCount: 2 });
            const res = await supertest(app)
                .get(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.filename).toBe('policy.pdf');
            expect(res.body.data.versions).toHaveLength(2);
        });
        it('should not fetch versions when is_latest is false', async () => {
            const docRow = { id: DOC_ID, filename: 'old.pdf', is_latest: false };
            mockQuery.mockResolvedValueOnce({ rows: [docRow], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.versions).toHaveLength(0);
            expect(mockQuery).toHaveBeenCalledTimes(1);
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST / — Create document
    // =========================================================================
    describe('POST /', () => {
        const validBody = {
            filename: 'hr-policy-2025.pdf',
            original_name: 'HR Policy 2025.pdf',
            mime_type: 'application/pdf',
            file_size: 1048576,
        };
        it('should return 201 when document is registered', async () => {
            const insertedRow = { id: DOC_ID, ...validBody, status: 'pending', tenant_id: TENANT_ID };
            mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/rag-documents')
                .set('Authorization', `Bearer ${token}`)
                .send(validBody);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.filename).toBe('hr-policy-2025.pdf');
            expect(res.body.message).toBe('Document registered');
        });
        it('should return 400 when filename is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/rag-documents')
                .set('Authorization', `Bearer ${token}`)
                .send({ original_name: 'test.pdf', mime_type: 'application/pdf', file_size: 1000 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when file_size is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/rag-documents')
                .set('Authorization', `Bearer ${token}`)
                .send({ filename: 'test.pdf', original_name: 'test.pdf', mime_type: 'application/pdf' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should accept optional fields', async () => {
            const fullBody = {
                ...validBody,
                file_path: '/uploads/hr-policy-2025.pdf',
                source_type: 'policy',
                metadata: { department: 'HR' },
                uploaded_by_employee_id: DEFAULT_IDS.EMPLOYEE_ID,
            };
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID, ...fullBody }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/rag-documents')
                .set('Authorization', `Bearer ${token}`)
                .send(fullBody);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB insert error'));
            const res = await supertest(app)
                .post('/api/v1/rag-documents')
                .set('Authorization', `Bearer ${token}`)
                .send(validBody);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // PATCH /:id — Update document
    // =========================================================================
    describe('PATCH /:id', () => {
        it('should return 200 when updating document fields', async () => {
            const existingRow = { id: DOC_ID };
            const updatedRow = { id: DOC_ID, status: 'completed', chunk_count: 15 };
            mockQuery
                .mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 }) // existence check
                .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 }); // UPDATE
            const res = await supertest(app)
                .patch(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'completed', chunk_count: 15 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.message).toBe('Document updated');
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'completed' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when no updatable fields provided', async () => {
            const existingRow = { id: DOC_ID };
            mockQuery.mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ filename: 'new-name.pdf' }); // filename is NOT in allowedFields
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('No fields to update');
        });
    });
    // =========================================================================
    // POST /:id/reprocess
    // =========================================================================
    describe('POST /:id/reprocess', () => {
        it('should return 200 when document is queued for reprocessing', async () => {
            const updatedRow = { id: DOC_ID, status: 'pending', error_message: null, chunk_count: 0 };
            mockQuery.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/rag-documents/${DOC_ID}/reprocess`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('pending');
            expect(res.body.message).toBe('Document queued for reprocessing');
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/rag-documents/${DOC_ID}/reprocess`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /:id/process
    // =========================================================================
    describe('POST /:id/process', () => {
        it('should return 200 when document processed successfully', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID, status: 'pending' }], rowCount: 1 });
            mockProcessDocument.mockResolvedValueOnce({
                success: true,
                chunksCreated: 12,
                embeddingsGenerated: 12,
            });
            const res = await supertest(app)
                .post(`/api/v1/rag-documents/${DOC_ID}/process`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('12 chunks created');
        });
        it('should return 422 when processing fails', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID, status: 'pending' }], rowCount: 1 });
            mockProcessDocument.mockResolvedValueOnce({
                success: false,
                error: 'File not readable',
                chunksCreated: 0,
                embeddingsGenerated: 0,
            });
            const res = await supertest(app)
                .post(`/api/v1/rag-documents/${DOC_ID}/process`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(422);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('File not readable');
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/rag-documents/${DOC_ID}/process`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should pass chunk options to processDocument', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID, status: 'pending' }], rowCount: 1 });
            mockProcessDocument.mockResolvedValueOnce({
                success: true,
                chunksCreated: 5,
                embeddingsGenerated: 5,
            });
            await supertest(app)
                .post(`/api/v1/rag-documents/${DOC_ID}/process`)
                .set('Authorization', `Bearer ${token}`)
                .send({ chunk_size: 500, chunk_overlap: 50 });
            expect(mockProcessDocument).toHaveBeenCalledWith(DOC_ID, TENANT_ID, expect.objectContaining({ chunkSize: 500, chunkOverlap: 50 }));
        });
    });
    // =========================================================================
    // GET /:id/chunks
    // =========================================================================
    describe('GET /:id/chunks', () => {
        it('should return 200 with document chunks', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID }], rowCount: 1 });
            const chunks = [
                { id: 'ch1', content: 'Chunk 1', chunk_index: 0 },
                { id: 'ch2', content: 'Chunk 2', chunk_index: 1 },
            ];
            mockGetDocumentChunks.mockResolvedValueOnce(chunks);
            const res = await supertest(app)
                .get(`/api/v1/rag-documents/${DOC_ID}/chunks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta.document_id).toBe(DOC_ID);
            expect(res.body.meta.total_chunks).toBe(2);
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/rag-documents/${DOC_ID}/chunks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // DELETE /:id/chunks
    // =========================================================================
    describe('DELETE /:id/chunks', () => {
        it('should return 200 with deleted count', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID }], rowCount: 1 });
            mockDeleteDocumentChunks.mockResolvedValueOnce(15);
            const res = await supertest(app)
                .delete(`/api/v1/rag-documents/${DOC_ID}/chunks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('15 chunks deleted');
            expect(res.body.meta.chunks_deleted).toBe(15);
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/rag-documents/${DOC_ID}/chunks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // DELETE /:id
    // =========================================================================
    describe('DELETE /:id', () => {
        it('should return 200 when document deleted', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: DOC_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Document deleted');
        });
        it('should return 404 when document not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/rag-documents/${DOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
});
//# sourceMappingURL=rag-documents.test.js.map