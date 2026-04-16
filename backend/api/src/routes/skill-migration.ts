/**
 * Skill Migration API Routes
 *
 * Provides endpoints for migrating legacy skills to ESCO ontology:
 * - Migration job management
 * - Unknown skill review queue
 * - Migration statistics
 *
 * @story S-ONTO-01-05 - Legacy Skill Migration Bridge
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { LegacySkillMigrationService } from '../services/legacy-skill-migration.js';
import { asyncHandler } from '../errors/middleware.js';
import { buildMeta } from '../utils/pagination.js';
import { Errors } from '../errors/factory.js';
import { validate } from '../middleware/validate.js';
import {
  createMigrationJobSchema,
  startMigrationJobSchema,
  approveUnknownSkillSchema,
  rejectUnknownSkillSchema,
  matchSkillSchema,
} from '../schemas/semantic.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// Service instance (lazy initialized)
// NOTE: Service uses pool internally for its own queries. The singleton pattern
// means pool is captured once at construction time. A full migration of the service
// internals is tracked separately — here we migrate only direct pool.query() in routes.
let migrationService: LegacySkillMigrationService | null = null;

function getMigrationService(): LegacySkillMigrationService {
  if (!migrationService) {
    migrationService = new LegacySkillMigrationService(pool);
  }
  return migrationService;
}

// =============================================================================
// MIGRATION SUMMARY
// =============================================================================

/**
 * GET /skill-migration/summary
 * Get migration summary for a tenant
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.query.tenant_id as string;

    if (!tenantId) {
      throw Errors.badRequest('tenant_id query parameter is required');
    }

    const service = getMigrationService();
    const summary = await service.getMigrationSummary(tenantId);

    res.json({
      success: true,
      data: summary,
    });
  })
);

/**
 * GET /skill-migration/stats/:tenantId
 * Get detailed migration statistics from database function
 */
router.get(
  '/stats/:tenantId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { tenantId } = req.params as Record<string, string>;

    const result = await dbClient.query(`SELECT * FROM fn_get_skill_migration_stats($1)`, [
      tenantId,
    ]);

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

// =============================================================================
// MIGRATION JOBS
// =============================================================================

/**
 * POST /skill-migration/jobs
 * Create a new migration job
 */
router.post(
  '/jobs',
  validate(createMigrationJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenant_id, job_type = 'all' } = req.body;

    if (!tenant_id) {
      throw Errors.badRequest('tenant_id is required');
    }

    const validJobTypes = ['employee_skills', 'extracted_skills', 'unknown_skills', 'all'];
    if (!validJobTypes.includes(job_type)) {
      throw Errors.badRequest(`job_type must be one of: ${validJobTypes.join(', ')}`);
    }

    const service = getMigrationService();
    const job = await service.createMigrationJob(tenant_id, job_type);

    res.status(201).json({
      success: true,
      data: job,
    });
  })
);

/**
 * GET /skill-migration/jobs
 * List migration jobs for a tenant
 */
router.get(
  '/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.query.tenant_id as string;
    const limit = safeParseInt(req.query.limit as string, { fallback: 20, max: 100 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0, min: 0 });

    if (!tenantId) {
      throw Errors.badRequest('tenant_id query parameter is required');
    }

    const service = getMigrationService();
    const result = await service.listJobs(tenantId, limit, offset);

    res.json({
      success: true,
      data: result.jobs,
      meta: buildMeta(result.total, limit, offset),
    });
  })
);

/**
 * GET /skill-migration/jobs/:jobId
 * Get migration job status
 */
router.get(
  '/jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    const service = getMigrationService();
    const job = await service.getJobStatus(jobId);

    if (!job) {
      throw Errors.notFound('Migration job', jobId);
    }

    res.json({
      success: true,
      data: job,
    });
  })
);

/**
 * POST /skill-migration/jobs/:jobId/start
 * Start executing a migration job
 */
router.post(
  '/jobs/:jobId/start',
  validate(startMigrationJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;
    const { confidence_threshold = 0.75, batch_size = 50, create_custom_skills = true } = req.body;

    const service = getMigrationService();

    // Check job exists and is pending
    const job = await service.getJobStatus(jobId);
    if (!job) {
      throw Errors.notFound('Migration job', jobId);
    }

    if (job.status !== 'pending') {
      throw Errors.badRequest(`Job is already ${job.status}, cannot start`);
    }

    // Execute job (this can take time, consider async in production)
    const stats = await service.executeMigrationJob(jobId, {
      confidenceThreshold: confidence_threshold,
      batchSize: batch_size,
      createCustomSkills: create_custom_skills,
    });

    res.json({
      success: true,
      data: {
        job_id: jobId,
        stats,
      },
    });
  })
);

// =============================================================================
// UNMAPPED RECORDS
// =============================================================================

/**
 * GET /skill-migration/unmapped
 * Count unmapped records by type for a tenant
 */
router.get(
  '/unmapped',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.query.tenant_id as string;
    const jobType = (req.query.job_type as string) || 'all';

    if (!tenantId) {
      throw Errors.badRequest('tenant_id query parameter is required');
    }

    const service = getMigrationService();
    const counts = await service.countUnmappedRecords(
      tenantId,
      jobType as 'employee_skills' | 'extracted_skills' | 'unknown_skills' | 'all'
    );

    res.json({
      success: true,
      data: {
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      },
    });
  })
);

// =============================================================================
// UNKNOWN SKILLS REVIEW
// =============================================================================

/**
 * GET /skill-migration/unknown-skills
 * Get unknown skills review queue
 */
router.get(
  '/unknown-skills',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const tenantId = req.query.tenant_id as string;
    const status = req.query.status as string;
    const limit = safeParseInt(req.query.limit as string, { fallback: 20, max: 100 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0, min: 0 });

    let query = `
    SELECT
      us.id,
      us.tenant_id,
      us.raw_text,
      us.occurrence_count,
      us.first_seen_at,
      us.last_seen_at,
      us.suggested_esco_id,
      es.preferred_label_en as suggested_skill_name,
      us.suggested_confidence,
      us.review_status,
      us.mapped_to_esco_id,
      mes.preferred_label_en as mapped_skill_name
    FROM unknown_skills us
    LEFT JOIN esco_skills es ON es.id = us.suggested_esco_id
    LEFT JOIN esco_skills mes ON mes.id = us.mapped_to_esco_id
    WHERE 1=1
  `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (tenantId) {
      query += ` AND us.tenant_id = $${paramIndex++}`;
      params.push(tenantId);
    }

    if (status) {
      query += ` AND us.review_status = $${paramIndex++}`;
      params.push(status);
    }

    // Get total count
    const countResult = await dbClient.query(
      query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM'),
      params
    );

    // Add ordering and pagination
    query += ` ORDER BY us.occurrence_count DESC, us.last_seen_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await dbClient.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
  })
);

/**
 * POST /skill-migration/unknown-skills/:skillId/approve
 * Approve an unknown skill mapping
 */
router.post(
  '/unknown-skills/:skillId/approve',
  validate(approveUnknownSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const skillId = req.params.skillId as string;
    const { user_id, esco_skill_id, use_suggested = true } = req.body;

    if (!user_id) {
      throw Errors.badRequest('user_id is required');
    }

    const service = getMigrationService();
    await service.approveUnknownSkillMapping(skillId, user_id, use_suggested, esco_skill_id);

    res.json({
      success: true,
      message: 'Unknown skill mapping approved',
    });
  })
);

/**
 * POST /skill-migration/unknown-skills/:skillId/reject
 * Reject an unknown skill mapping
 */
router.post(
  '/unknown-skills/:skillId/reject',
  validate(rejectUnknownSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const skillId = req.params.skillId as string;
    const { user_id } = req.body;

    if (!user_id) {
      throw Errors.badRequest('user_id is required');
    }

    const service = getMigrationService();
    await service.rejectUnknownSkillMapping(skillId, user_id);

    res.json({
      success: true,
      message: 'Unknown skill mapping rejected',
    });
  })
);

// =============================================================================
// MIGRATION LOG
// =============================================================================

/**
 * GET /skill-migration/jobs/:jobId/log
 * Get migration log for a job
 */
router.get(
  '/jobs/:jobId/log',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const jobId = req.params.jobId as string;
    const action = req.query.action as string;
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0, min: 0 });

    let query = `
    SELECT
      sml.*,
      es.preferred_label_en as matched_skill_preferred_label
    FROM skill_migration_log sml
    LEFT JOIN esco_skills es ON es.id = sml.matched_esco_id
    WHERE sml.job_id = $1
  `;
    const params: unknown[] = [jobId];
    let paramIndex = 2;

    if (action) {
      query += ` AND sml.action = $${paramIndex++}`;
      params.push(action);
    }

    // Get total count
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await dbClient.query(countQuery, params);

    // Add pagination
    query += ` ORDER BY sml.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await dbClient.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
  })
);

// =============================================================================
// QUICK MATCH (Single skill)
// =============================================================================

/**
 * POST /skill-migration/match
 * Find best ESCO match for a single skill text
 */
router.post(
  '/match',
  validate(matchSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { skill_text, limit = 5 } = req.body;

    if (!skill_text) {
      throw Errors.badRequest('skill_text is required');
    }

    const dbClient = req.dbClient!;

    // Use semantic search from ontology
    const result = await dbClient.query(
      `
    WITH query_embedding AS (
      SELECT embedding_en
      FROM esco_skills
      WHERE LOWER(preferred_label_en) = LOWER($1)
      LIMIT 1
    )
    SELECT
      es.id,
      es.preferred_label_en,
      es.skill_type,
      es.reuse_level,
      CASE
        WHEN LOWER(es.preferred_label_en) = LOWER($1) THEN 1.0
        ELSE similarity(LOWER(es.preferred_label_en), LOWER($1))
      END as text_similarity
    FROM esco_skills es
    WHERE LOWER(es.preferred_label_en) % LOWER($1)
       OR LOWER(es.preferred_label_en) = LOWER($1)
    ORDER BY
      CASE WHEN LOWER(es.preferred_label_en) = LOWER($1) THEN 0 ELSE 1 END,
      similarity(LOWER(es.preferred_label_en), LOWER($1)) DESC
    LIMIT $2
  `,
      [skill_text, limit]
    );

    res.json({
      success: true,
      data: {
        query: skill_text,
        matches: result.rows.map((row) => ({
          id: row.id,
          preferred_label: row.preferred_label_en,
          skill_type: row.skill_type,
          reuse_level: row.reuse_level,
          confidence: parseFloat(row.text_similarity),
        })),
      },
    });
  })
);

export default router;
