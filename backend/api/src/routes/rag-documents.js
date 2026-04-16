/**
 * RAG Documents Routes
 * Document management for RAG system
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createRagDocumentSchema, updateRagDocumentSchema } from '../schemas/ai-chat.js';
import { processDocument, getDocumentChunks, deleteDocumentChunks, searchChunks, } from '../services/rag-chunking.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * POST /rag-documents/search
 * Semantic search across document chunks using vector similarity
 */
router.post('/search', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { query, limit, similarity_threshold, knowledge_base_id, document_id } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw Errors.badRequest('query is required and must be a non-empty string');
    }
    const results = await searchChunks(query, tenantId, {
        limit: limit ? parseInt(String(limit), 10) : undefined,
        similarityThreshold: similarity_threshold
            ? parseFloat(String(similarity_threshold))
            : undefined,
        knowledgeBaseId: knowledge_base_id,
        documentId: document_id,
    });
    res.json({
        success: true,
        data: results,
        meta: {
            query,
            result_count: results.length,
        },
    });
}));
/**
 * GET /rag-documents/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'error') as error,
        SUM(file_size) as total_size_bytes,
        SUM(chunk_count) as total_chunks,
        COUNT(*) FILTER (WHERE is_latest = true) as latest_versions
      FROM rag_documents WHERE tenant_id = $1
    `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /rag-documents/source-types
 * Get documents by source type
 */
router.get('/source-types', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT source_type, COUNT(*) as count, SUM(file_size) as total_size
      FROM rag_documents
      WHERE tenant_id = $1
      GROUP BY source_type
      ORDER BY count DESC
    `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /rag-documents
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, source_type, is_latest, search, limit = '100', offset = '0', } = req.query;
    let query = `
      SELECT rd.*,
        e.first_name || ' ' || e.last_name as uploaded_by_name
      FROM rag_documents rd
      LEFT JOIN employees e ON rd.uploaded_by_employee_id = e.id
      WHERE rd.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (status) {
        query += ` AND rd.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    if (source_type) {
        query += ` AND rd.source_type = $${paramIndex}`;
        params.push(source_type);
        paramIndex++;
    }
    if (is_latest !== undefined) {
        query += ` AND rd.is_latest = $${paramIndex}`;
        params.push(is_latest === 'true');
        paramIndex++;
    }
    if (search) {
        query += ` AND (rd.filename ILIKE $${paramIndex} OR rd.original_name ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search)}%`);
        paramIndex++;
    }
    query += ` ORDER BY rd.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM rag_documents WHERE tenant_id = $1', [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /rag-documents/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT rd.*,
        e.first_name || ' ' || e.last_name as uploaded_by_name,
        e.email as uploaded_by_email
      FROM rag_documents rd
      LEFT JOIN employees e ON rd.uploaded_by_employee_id = e.id
      WHERE rd.id = $1 AND rd.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    // Get versions if this is the latest
    let versions = [];
    if (result.rows[0].is_latest) {
        const versionsResult = await req.dbClient.query(`
        SELECT id, version, created_at, version_notes
        FROM rag_documents
        WHERE (parent_document_id = $1 OR id = $1) AND tenant_id = $2
        ORDER BY version DESC
      `, [id, tenantId]);
        versions = versionsResult.rows;
    }
    res.json({ success: true, data: { ...(result.rows[0] || {}), versions } });
}));
/**
 * POST /rag-documents
 * Register a new document for RAG processing
 */
router.post('/', validate(createRagDocumentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { filename, original_name, mime_type, file_size, file_path, source_type = 'document', metadata = {}, uploaded_by_employee_id, } = req.body;
    if (!filename || !original_name || !mime_type || !file_size) {
        throw Errors.badRequest('filename, original_name, mime_type, and file_size are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO rag_documents (tenant_id, filename, original_name, mime_type, file_size, file_path,
        source_type, metadata, uploaded_by_employee_id, status, chunk_count, is_latest, version, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 0, true, 1, NOW())
      RETURNING *
    `, [
        tenantId,
        filename,
        original_name,
        mime_type,
        file_size,
        file_path,
        source_type,
        metadata,
        uploaded_by_employee_id,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Document registered' });
}));
/**
 * PATCH /rag-documents/:id
 */
router.patch('/:id', validate(updateRagDocumentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM rag_documents WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    const allowedFields = [
        'status',
        'chunk_count',
        'error_message',
        'metadata',
        'processed_at',
        'is_latest',
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(req.body[field]);
            paramIndex++;
        }
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    const result = await req.dbClient.query(`UPDATE rag_documents SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Document updated' });
}));
/**
 * POST /rag-documents/:id/reprocess
 * Trigger reprocessing of a document
 */
router.post('/:id/reprocess', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE rag_documents SET status = 'pending', error_message = NULL, chunk_count = 0
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Document queued for reprocessing',
    });
}));
/**
 * POST /rag-documents/:id/process
 * Process (chunk + embed) a document
 */
router.post('/:id/process', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify document exists
    const existing = await req.dbClient.query('SELECT id, status FROM rag_documents WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    const { chunk_size, chunk_overlap } = req.body;
    const result = await processDocument(id, tenantId, {
        chunkSize: chunk_size ? parseInt(String(chunk_size), 10) : undefined,
        chunkOverlap: chunk_overlap ? parseInt(String(chunk_overlap), 10) : undefined,
    });
    const statusCode = result.success ? 200 : 422;
    res.status(statusCode).json({
        success: result.success,
        data: result,
        message: result.success
            ? `Document processed: ${result.chunksCreated} chunks created, ${result.embeddingsGenerated} embeddings generated`
            : `Processing failed: ${result.error}`,
    });
}));
/**
 * GET /rag-documents/:id/chunks
 * Get all chunks for a document
 */
router.get('/:id/chunks', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify document exists
    const existing = await req.dbClient.query('SELECT id FROM rag_documents WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    const chunks = await getDocumentChunks(id, tenantId);
    res.json({
        success: true,
        data: chunks,
        meta: {
            document_id: id,
            total_chunks: chunks.length,
        },
    });
}));
/**
 * DELETE /rag-documents/:id/chunks
 * Delete all chunks for a document (for re-processing)
 */
router.delete('/:id/chunks', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify document exists
    const existing = await req.dbClient.query('SELECT id FROM rag_documents WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    const deletedCount = await deleteDocumentChunks(id, tenantId);
    res.json({
        success: true,
        message: `${deletedCount} chunks deleted for document ${id}`,
        meta: {
            document_id: id,
            chunks_deleted: deletedCount,
        },
    });
}));
/**
 * DELETE /rag-documents/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM rag_documents WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Document');
    }
    res.json({ success: true, message: 'Document deleted' });
}));
export default router;
//# sourceMappingURL=rag-documents.js.map