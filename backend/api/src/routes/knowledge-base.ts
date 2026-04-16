/**
 * Knowledge Base Routes
 * CCNL and company policy document management
 * Epic 5: AI HR Assistant - Stories 5.2, 5.3
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '@heuresys/shared';
import { createDocumentProcessor } from '../services/document-processor.js';
import { validate } from '../middleware/validate.js';
import {
  createKnowledgeBaseSchema,
  ingestCCNLSchema,
  ingestPolicySchema,
  processPendingSchema,
} from '../schemas/platform.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';

const router = Router();

router.use(requireTenant);
router.use(authMiddleware);

// =============================================================================
// KNOWLEDGE BASES
// =============================================================================

/**
 * GET /knowledge-base
 * List knowledge bases available to the tenant
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT kb.*,
        (SELECT COUNT(*) FROM rag_documents d WHERE d.knowledge_base_id = kb.id AND d.status = 'completed') as document_count,
        (SELECT SUM(chunk_count) FROM rag_documents d WHERE d.knowledge_base_id = kb.id AND d.status = 'completed') as total_chunks
      FROM rag_knowledge_bases kb
      WHERE (kb.tenant_id = $1 OR kb.tenant_id IS NULL)
        AND kb.is_active = true
      ORDER BY kb.kb_type, kb.name
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * POST /knowledge-base
 * Create a custom knowledge base
 */
router.post(
  '/',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(createKnowledgeBaseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { code, name, description, kbType = 'custom', isPublic = false, allowedRoles } = req.body;

    if (!code || !name) {
      throw Errors.badRequest('code and name are required');
    }

    // Check for duplicate code
    const existing = await req.dbClient!.query(
      'SELECT id FROM rag_knowledge_bases WHERE code = $1 AND tenant_id = $2',
      [code, tenantId]
    );

    if (existing.rows.length > 0) {
      throw Errors.conflict('Knowledge base with this code already exists');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO rag_knowledge_bases (tenant_id, code, name, description, kb_type, is_public, allowed_roles, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *
    `,
      [tenantId, code, name, description, kbType, isPublic, allowedRoles || null]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Knowledge base created',
    });
  })
);

/**
 * GET /knowledge-base/:id
 * Get knowledge base details with documents
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const kbId = req.params['id'] as string;

    const kbResult = await req.dbClient!.query(
      `
      SELECT id, tenant_id, code, name, description, kb_type, is_public,
        allowed_roles, embedding_model, chunk_size, chunk_overlap,
        is_active, created_at, updated_at
      FROM rag_knowledge_bases
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) AND is_active = true
    `,
      [kbId, tenantId]
    );

    if (kbResult.rows.length === 0) {
      throw Errors.notFound('Knowledge base');
    }

    const documentsResult = await req.dbClient!.query(
      `
      SELECT id, filename, original_name, status, chunk_count, created_at, processed_at
      FROM rag_documents
      WHERE knowledge_base_id = $1 AND tenant_id = $2 AND is_latest = true
      ORDER BY created_at DESC
    `,
      [kbId, tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(kbResult.rows[0] || {}),
        documents: documentsResult.rows,
      },
    });
  })
);

// =============================================================================
// CCNL MANAGEMENT
// =============================================================================

/**
 * GET /knowledge-base/ccnl/contracts
 * List available CCNL contracts
 */
router.get(
  '/ccnl/contracts',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await req.dbClient!.query(`
      SELECT id, code, name, sector, effective_date, expiry_date,
        annual_leave_days, is_active, created_at
      FROM ccnl_contracts
      WHERE is_active = true
      ORDER BY name
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /knowledge-base/ccnl/contracts/:code
 * Get CCNL contract details
 */
router.get(
  '/ccnl/contracts/:code',
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.params['code'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT id, code, name, name_en, sector, effective_date, expiry_date,
        min_notice_days, probation_period_days, annual_leave_days,
        sick_leave_rules, overtime_rates, full_text, full_text_version,
        is_active, created_at, updated_at
      FROM ccnl_contracts WHERE code = $1 AND is_active = true
    `,
      [code]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('CCNL contract');
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * POST /knowledge-base/ccnl/ingest
 * Ingest a new CCNL document
 */
router.post(
  '/ccnl/ingest',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(ingestCCNLSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { code, name, sector, fullText, effectiveDate, version, metadata } = req.body;

    if (!code || !name || !sector || !fullText) {
      throw Errors.badRequest('code, name, sector, and fullText are required');
    }

    const processor = createDocumentProcessor(tenantId);
    const result = await processor.ingestCCNL({
      code,
      name,
      sector,
      fullText,
      effectiveDate,
      version,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'CCNL document ingested and processed',
    });
  })
);

// =============================================================================
// COMPANY POLICIES
// =============================================================================

/**
 * GET /knowledge-base/policies
 * List company policies
 */
router.get(
  '/policies',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { policyType } = req.query as Record<string, string>;

    let query = `
      SELECT d.id, d.original_name as title, d.status, d.chunk_count,
        d.metadata->>'policyType' as policy_type,
        d.metadata->>'effectiveDate' as effective_date,
        d.created_at, d.processed_at
      FROM rag_documents d
      JOIN rag_knowledge_bases kb ON d.knowledge_base_id = kb.id
      WHERE d.tenant_id = $1
        AND kb.kb_type = 'company_policy'
        AND d.is_latest = true
    `;
    const params: unknown[] = [tenantId];

    if (policyType) {
      query += ` AND d.metadata->>'policyType' = $2`;
      params.push(policyType);
    }

    query += ` ORDER BY d.original_name`;

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * POST /knowledge-base/policies/ingest
 * Ingest a company policy document
 */
router.post(
  '/policies/ingest',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(ingestPolicySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { title, content, policyType, effectiveDate, version, orgUnitId, metadata } = req.body;

    if (!title || !content || !policyType) {
      throw Errors.badRequest('title, content, and policyType are required');
    }

    const processor = createDocumentProcessor(tenantId);
    const result = await processor.ingestCompanyPolicy({
      title,
      content,
      policyType,
      effectiveDate,
      version,
      orgUnitId,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Company policy ingested and processed',
    });
  })
);

/**
 * GET /knowledge-base/policies/:id
 * Get policy document details
 */
router.get(
  '/policies/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const docId = req.params['id'] as string;

    const docResult = await req.dbClient!.query(
      `
      SELECT d.*, kb.name as knowledge_base_name
      FROM rag_documents d
      JOIN rag_knowledge_bases kb ON d.knowledge_base_id = kb.id
      WHERE d.id = $1 AND d.tenant_id = $2
    `,
      [docId, tenantId]
    );

    if (docResult.rows.length === 0) {
      throw Errors.notFound('Policy document');
    }

    // Get chunks
    const chunksResult = await req.dbClient!.query(
      `
      SELECT id, chunk_index, section_title, LENGTH(content) as content_length
      FROM rag_document_chunks
      WHERE document_id = $1 AND tenant_id = $2
      ORDER BY chunk_index
    `,
      [docId, tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(docResult.rows[0] || {}),
        chunks: chunksResult.rows,
      },
    });
  })
);

// =============================================================================
// DOCUMENT PROCESSING
// =============================================================================

/**
 * POST /knowledge-base/documents/:id/reprocess
 * Reprocess a document
 */
router.post(
  '/documents/:id/reprocess',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const docId = req.params['id'] as string;

    // Verify document exists
    const docResult = await req.dbClient!.query(
      'SELECT id FROM rag_documents WHERE id = $1 AND tenant_id = $2',
      [docId, tenantId]
    );

    if (docResult.rows.length === 0) {
      throw Errors.notFound('Document');
    }

    const processor = createDocumentProcessor(tenantId);
    const result = await processor.processDocument(docId);

    res.json({
      success: true,
      data: result,
      message: result.success ? 'Document reprocessed successfully' : 'Document processing failed',
    });
  })
);

/**
 * POST /knowledge-base/process-pending
 * Process all pending documents
 */
router.post(
  '/process-pending',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(processPendingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = 10 } = req.body;

    const processor = createDocumentProcessor(tenantId);
    const results = await processor.processPendingDocuments(limit);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      data: {
        processed: results.length,
        successful,
        failed,
        results,
      },
      message: `Processed ${results.length} documents: ${successful} successful, ${failed} failed`,
    });
  })
);

/**
 * GET /knowledge-base/stats
 * Get knowledge base statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(DISTINCT kb.id) as total_knowledge_bases,
        COUNT(DISTINCT d.id) as total_documents,
        SUM(d.chunk_count) as total_chunks,
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'completed') as completed_documents,
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'pending') as pending_documents,
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'error') as error_documents
      FROM rag_knowledge_bases kb
      LEFT JOIN rag_documents d ON d.knowledge_base_id = kb.id AND d.tenant_id = $1
      WHERE (kb.tenant_id = $1 OR kb.tenant_id IS NULL) AND kb.is_active = true
    `,
      [tenantId]
    );

    // By type breakdown
    const byTypeResult = await req.dbClient!.query(
      `
      SELECT kb.kb_type, COUNT(DISTINCT d.id) as document_count
      FROM rag_knowledge_bases kb
      LEFT JOIN rag_documents d ON d.knowledge_base_id = kb.id AND d.tenant_id = $1
      WHERE (kb.tenant_id = $1 OR kb.tenant_id IS NULL) AND kb.is_active = true
      GROUP BY kb.kb_type
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        summary: result.rows[0],
        byType: byTypeResult.rows,
      },
    });
  })
);

export default router;
