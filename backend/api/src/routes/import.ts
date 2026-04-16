/**
 * Import Routes
 * Upload CSV/Excel, dry-run validation, execute import, history.
 * Horizon O2.1 — Import Engine
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { isValidUUID } from '@heuresys/shared';
import { buildMeta } from '../utils/pagination.js';
import { ImportEngineService, ImportType, ValidationError } from '../services/import-engine.js';
import { EscoAutoLinkerService } from '../services/esco-auto-linker.js';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

/**
 * Acquire a PoolClient with tenant RLS context set.
 * req.dbClient from tenantContextMiddleware can be released before async
 * route handlers complete when multer processes multipart uploads.
 * This provides a dedicated client for the import operation.
 */
async function acquireImportClient(tenantId: string) {
  const client = await pool.connect();
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
  return client;
}

const router = Router();

// Tenant context required for all routes
router.use(requireTenant);

// === Multer config: memory storage, max 10MB ===

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Use .csv, .xlsx, or .xls'));
    }
  },
});

// Multer error handler middleware
function handleMulterError(err: Error, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 10MB limit' },
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: err.message },
    });
    return;
  }
  if (err.message?.includes('File type not supported')) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_FILE_TYPE', message: err.message },
    });
    return;
  }
  next(err);
}

// === Zod schemas (no body: wrapper) ===

const uploadQuerySchema = z.object({
  importType: z.enum(['employees', 'org_units', 'roles', 'skills', 'process_roles']),
});

const importIdParamSchema = z.object({
  importId: z.string().uuid(),
});

const historyQuerySchema = z.object({
  status: z.string().optional(),
  importType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// === ENDPOINTS ===

/**
 * POST /upload — Upload file + dry-run validation
 */
router.post(
  '/upload',
  requirePermission('ORGANIZATION', 'CREATE'),
  upload.single('file'),
  handleMulterError,
  validate(uploadQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;

    if (!req.file) {
      throw Errors.badRequest('No file uploaded. Send a file with field name "file".');
    }

    const importType = req.query.importType as ImportType;
    const dbClient = await acquireImportClient(tenantId);

    try {
      logger.info(
        { importType, fileName: req.file.originalname, size: req.file.size, tenantId },
        'Import upload started'
      );

      const service = new ImportEngineService(dbClient);

      // 1. Parse file
      const parsed = await service.parseFile(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (parsed.totalRows === 0) {
        throw Errors.badRequest('File is empty — no data rows found.');
      }

      // 2. Validate data (dry-run)
      const validation = await service.validateData(parsed, importType, tenantId);

      // 3. Create import_jobs record with status 'pending_review'
      const allValidatedData = validation.validRows;
      const previewRows = validation.validRows.slice(0, 10);

      const insertResult = await dbClient.query(
        `INSERT INTO import_jobs
          (tenant_id, import_type, file_name, file_size_bytes, mime_type,
           status, total_rows, valid_rows, error_rows,
           errors, warnings, preview_data, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          tenantId,
          importType,
          req.file.originalname,
          req.file.size,
          req.file.mimetype,
          'pending_review',
          validation.totalRows,
          validation.validCount,
          validation.errorCount,
          JSON.stringify(validation.errors),
          JSON.stringify(validation.warnings),
          JSON.stringify(allValidatedData),
          userId,
        ]
      );

      const importId = insertResult.rows[0]?.id;

      logger.info(
        {
          importId,
          importType,
          totalRows: validation.totalRows,
          validCount: validation.validCount,
        },
        'Import upload completed'
      );

      res.status(201).json({
        success: true,
        data: {
          importId,
          fileName: req.file.originalname,
          importType,
          totalRows: validation.totalRows,
          validCount: validation.validCount,
          errorCount: validation.errorCount,
          preview: previewRows,
          errors: validation.errors.slice(0, 50),
          warnings: validation.warnings.slice(0, 50),
          status: 'pending_review',
        },
      });
    } finally {
      dbClient.release();
    }
  })
);

/**
 * POST /execute/:importId — Execute approved import
 */
router.post(
  '/execute/:importId',
  requirePermission('ORGANIZATION', 'CREATE'),
  validate(importIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = (req as AuthenticatedRequest).user?.userId;
    const importId = req.params.importId as string;

    if (!isValidUUID(importId)) {
      throw Errors.badRequest('Invalid importId format');
    }

    const dbClient = await acquireImportClient(tenantId);

    try {
      // 1. Load import_job, verify status
      const jobResult = await dbClient.query(
        'SELECT * FROM import_jobs WHERE id = $1 AND tenant_id = $2',
        [importId, tenantId]
      );

      if (jobResult.rows.length === 0) {
        throw Errors.notFound('Import job', importId);
      }

      const job = jobResult.rows[0];

      if (job.status !== 'pending_review') {
        throw Errors.badRequest(
          `Import job is in status '${job.status}' — only 'pending_review' jobs can be executed.`
        );
      }

      // 2. Recover validated data from preview_data
      const validatedRows = job.preview_data;
      if (!validatedRows || !Array.isArray(validatedRows) || validatedRows.length === 0) {
        throw Errors.badRequest('No validated data found for this import job.');
      }

      const importType = job.import_type as ImportType;

      // 3. Map to entities
      const service = new ImportEngineService(dbClient);
      const validationResult = {
        validRows: validatedRows,
        errors: [] as ValidationError[],
        warnings: [] as ValidationError[],
        totalRows: validatedRows.length,
        validCount: validatedRows.length,
        errorCount: 0,
      };
      const mapped = service.mapToEntities(validationResult, importType, tenantId);

      // 4. Execute import
      logger.info(
        { importId, importType, rowCount: mapped.entities.length },
        'Import execution started'
      );

      const result = await service.executeImport(mapped, tenantId, userId);

      // 5. Update import_job with results
      const finalStatus = result.errors.length === 0 ? 'completed' : 'partial';

      await dbClient.query(
        `UPDATE import_jobs SET
          status = $1,
          created_rows = $2,
          updated_rows = $3,
          skipped_rows = $4,
          errors = $5,
          executed_at = NOW(),
          completed_at = NOW(),
          updated_at = NOW()
         WHERE id = $6`,
        [
          finalStatus,
          result.createdRows,
          result.updatedRows,
          result.skippedRows,
          JSON.stringify(result.errors),
          importId,
        ]
      );

      logger.info(
        {
          importId,
          created: result.createdRows,
          updated: result.updatedRows,
          skipped: result.skippedRows,
        },
        'Import execution completed'
      );

      res.json({
        success: true,
        data: {
          importId,
          status: finalStatus,
          createdRows: result.createdRows,
          updatedRows: result.updatedRows,
          skippedRows: result.skippedRows,
          errors: result.errors.slice(0, 50),
        },
      });
    } finally {
      dbClient.release();
    }
  })
);

/**
 * GET /history — List imports for tenant
 */
router.get(
  '/history',
  requirePermission('ORGANIZATION', 'VIEW'),
  validate(historyQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, importType, limit, offset } = req.query as unknown as {
      status?: string;
      importType?: string;
      limit: number;
      offset: number;
    };

    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (importType) {
      conditions.push(`import_type = $${paramIdx++}`);
      params.push(importType);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM import_jobs WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count, 10);

    const dataResult = await pool.query(
      `SELECT id, import_type, file_name, file_size_bytes, status,
              total_rows, valid_rows, error_rows,
              created_rows, updated_rows, skipped_rows,
              uploaded_by, executed_at, completed_at, created_at
       FROM import_jobs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: { items: dataResult.rows },
      meta: buildMeta(total, limit, offset),
    });
  })
);

/**
 * GET /history/:importId — Single import detail
 */
router.get(
  '/history/:importId',
  requirePermission('ORGANIZATION', 'VIEW'),
  validate(importIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const importId = req.params.importId as string;

    if (!isValidUUID(importId)) {
      throw Errors.badRequest('Invalid importId format');
    }

    const result = await pool.query(
      `SELECT id, import_type, file_name, file_size_bytes, mime_type, status,
              total_rows, valid_rows, error_rows,
              created_rows, updated_rows, skipped_rows,
              errors, warnings, preview_data,
              uploaded_by, executed_at, completed_at, created_at, updated_at
       FROM import_jobs
       WHERE id = $1 AND tenant_id = $2`,
      [importId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Import job', importId);
    }

    const job = result.rows[0];

    // preview_data in response: only first 10 rows
    if (job.preview_data && Array.isArray(job.preview_data)) {
      job.preview_data = job.preview_data.slice(0, 10);
    }

    res.json({
      success: true,
      data: job,
    });
  })
);

/**
 * POST /auto-link/:importId — Launch ESCO auto-linking on completed import
 */
router.post(
  '/auto-link/:importId',
  requirePermission('ORGANIZATION', 'CREATE'),
  validate(importIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const importId = req.params.importId as string;

    if (!isValidUUID(importId)) {
      throw Errors.badRequest('Invalid importId format');
    }

    const dbClient = await acquireImportClient(tenantId);

    try {
      const linker = new EscoAutoLinkerService(dbClient);
      const summary = await linker.linkImportedSkills(importId, tenantId);

      logger.info({ importId, ...summary }, 'Auto-link completed');

      res.json({
        success: true,
        data: { importId, ...summary },
      });
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('OPENAI_API_KEY')) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: error.message },
        });
        return;
      }
      throw err;
    } finally {
      dbClient.release();
    }
  })
);

/**
 * GET /auto-link/:importId/results — Get auto-linking results
 */
router.get(
  '/auto-link/:importId/results',
  requirePermission('ORGANIZATION', 'VIEW'),
  validate(importIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const importId = req.params.importId as string;

    if (!isValidUUID(importId)) {
      throw Errors.badRequest('Invalid importId format');
    }

    const result = await pool.query(
      `SELECT isl.id, isl.input_text, isl.esco_skill_id,
              isl.similarity, isl.confidence, isl.accepted, isl.created_at,
              es.preferred_label AS esco_preferred_label,
              es.skill_type AS esco_skill_type
       FROM import_skill_links isl
       LEFT JOIN esco_skills es ON es.id = isl.esco_skill_id
       WHERE isl.import_job_id = $1 AND isl.tenant_id = $2
       ORDER BY isl.similarity DESC NULLS LAST`,
      [importId, tenantId]
    );

    interface SkillLinkRow {
      id: string;
      input_text: string;
      esco_skill_id: string | null;
      similarity: number | null;
      confidence: string | null;
      accepted: boolean | null;
      created_at: Date;
      esco_preferred_label: string | null;
      esco_skill_type: string | null;
    }

    const rows = result.rows as SkillLinkRow[];
    const summary = {
      total: rows.length,
      linked: rows.filter((r) => r.confidence !== 'none').length,
      unlinked: rows.filter((r) => r.confidence === 'none').length,
      highConfidence: rows.filter((r) => r.confidence === 'high').length,
      mediumConfidence: rows.filter((r) => r.confidence === 'medium').length,
      lowConfidence: rows.filter((r) => r.confidence === 'low').length,
    };

    res.json({
      success: true,
      data: { items: rows, summary },
    });
  })
);

export default router;
