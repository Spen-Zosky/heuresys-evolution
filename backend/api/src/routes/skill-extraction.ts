/**
 * Skill Extraction Routes
 * API endpoints for LLM-powered skill extraction
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-07 (Skill Extraction Service)
 * Created: 2025-12-22
 */

import { Router, Request, Response } from 'express';
import { validateEmbeddingColumn } from '../utils/sql-safety.js';
import {
  getSkillExtractionService,
  ExtractionOptions,
} from '../services/skill-extraction/index.js';
import { asyncHandler } from '../errors/middleware.js';
import { buildMeta } from '../utils/pagination.js';
import { Errors } from '../errors/factory.js';
import { validate } from '../middleware/validate.js';
import {
  skillExtractionExtractSchema,
  skillExtractionExtractBatchSchema,
  skillExtractionMapSingleSchema,
} from '../schemas/semantic.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// =============================================================================
// SKILL EXTRACTION ENDPOINTS
// =============================================================================

/**
 * POST /skill-extraction/extract
 * Extract skills from text using LLM and map to ESCO ontology
 */
router.post(
  '/extract',
  validate(skillExtractionExtractSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { text, options } = req.body as {
      text: string;
      options?: ExtractionOptions;
    };

    if (!text || typeof text !== 'string') {
      throw Errors.badRequest('text is required and must be a string');
    }

    if (text.length < 10) {
      throw Errors.badRequest('text must be at least 10 characters');
    }

    if (text.length > 50000) {
      throw Errors.badRequest('text must not exceed 50000 characters');
    }

    const service = getSkillExtractionService();
    const result = await service.extractSkills(text, options || {});

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /skill-extraction/extract-batch
 * Extract skills from multiple texts in batch
 */
router.post(
  '/extract-batch',
  validate(skillExtractionExtractBatchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, options } = req.body as {
      items: Array<{ id: string; text: string }>;
      options?: ExtractionOptions;
    };

    if (!Array.isArray(items) || items.length === 0) {
      throw Errors.badRequest('items array is required and must not be empty');
    }

    if (items.length > 10) {
      throw Errors.badRequest('Maximum 10 items per batch');
    }

    const service = getSkillExtractionService();
    const results: Array<{ id: string; result: unknown; error?: string }> = [];

    for (const item of items) {
      try {
        const result = await service.extractSkills(item.text, options || {});
        results.push({ id: item.id, result });
      } catch (err) {
        results.push({
          id: item.id,
          result: null,
          error: (err as Error).message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        total: items.length,
        successful: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
        results,
      },
    });
  })
);

// =============================================================================
// EXTRACTION JOB MANAGEMENT
// =============================================================================

/**
 * GET /skill-extraction/jobs
 * List extraction jobs with pagination
 */
router.get(
  '/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { status, limit, offset } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 20, max: 100 });
    const offsetNum = safeParseInt(offset as string, { fallback: 0 });

    let query = `
    SELECT
      id, tenant_id, job_type, source_type,
      status, processing_time_ms,
      jsonb_array_length(COALESCE(extracted_skills, '[]')) as extracted_count,
      jsonb_array_length(COALESCE(mapped_skills, '[]')) as mapped_count,
      jsonb_array_length(COALESCE(unmapped_skills, '[]')) as unmapped_count,
      created_at, completed_at
    FROM skill_extraction_jobs
    WHERE 1=1
  `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);

    const result = await dbClient.query(query, params);

    // Get total count
    const countQuery = status
      ? `SELECT COUNT(*) FROM skill_extraction_jobs WHERE status = $1`
      : `SELECT COUNT(*) FROM skill_extraction_jobs`;
    const countResult = await dbClient.query(countQuery, status ? [status] : []);

    res.json({
      success: true,
      data: {
        jobs: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.count), limitNum, offsetNum),
      },
    });
  })
);

/**
 * GET /skill-extraction/jobs/:jobId
 * Get extraction job details with full results
 */
router.get(
  '/jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { jobId } = req.params as Record<string, string>;

    const result = await dbClient.query(
      `
    SELECT id, tenant_id, job_type, source_type, source_reference, source_text,
      status, extracted_skills, mapped_skills, unmapped_skills, extraction_model,
      processing_time_ms, error_message, created_at, completed_at
    FROM skill_extraction_jobs
    WHERE id = $1
  `,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Extraction job', jobId);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * DELETE /skill-extraction/jobs/:jobId
 * Delete an extraction job
 */
router.delete(
  '/jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { jobId } = req.params as Record<string, string>;

    const result = await dbClient.query(
      `
    DELETE FROM skill_extraction_jobs
    WHERE id = $1
    RETURNING id
  `,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Extraction job', jobId);
    }

    res.json({
      success: true,
      message: 'Extraction job deleted',
    });
  })
);

// =============================================================================
// SKILL MAPPING ENDPOINTS
// =============================================================================

/**
 * POST /skill-extraction/map-single
 * Map a single skill name to ESCO ontology
 */
router.post(
  '/map-single',
  validate(skillExtractionMapSingleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { skillName, language, minConfidence } = req.body as {
      skillName: string;
      language?: 'en' | 'it';
      minConfidence?: number;
    };

    if (!skillName || typeof skillName !== 'string') {
      throw Errors.badRequest('skillName is required');
    }

    const service = getSkillExtractionService();
    const result = await service.extractSkills(skillName, {
      language: language || 'en',
      minConfidence: minConfidence || 0.5,
    });

    // Return just the first mapped skill
    const mappedSkill = result.mappedSkills[0];

    res.json({
      success: true,
      data: mappedSkill || {
        rawSkill: { name: skillName, type: 'skill', context: skillName },
        escoSkillId: null,
        escoSkillUri: null,
        escoSkillLabel: null,
        matchConfidence: 0,
        matchMethod: 'none',
      },
    });
  })
);

/**
 * GET /skill-extraction/search
 * Search ESCO skills by text query
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const { q, language, limit } = req.query as Record<string, string>;

    if (!q || typeof q !== 'string') {
      throw Errors.badRequest('q (query) is required');
    }

    const lang = (language as string) || 'en';
    const limitNum = safeParseInt(limit as string, { fallback: 10, max: 50 });
    const labelColumn = validateEmbeddingColumn(
      lang === 'it' ? 'preferred_label_it' : 'preferred_label_en',
      'skill-extraction.search-skills'
    );

    const dbClient = req.dbClient!;

    const result = await dbClient.query(
      `
    SELECT
      id,
      uri,
      ${labelColumn} as label,
      skill_type,
      similarity(LOWER(${labelColumn}), LOWER($1)) as sim_score
    FROM esco_skills
    WHERE ${labelColumn} IS NOT NULL
      AND (
        LOWER(${labelColumn}) LIKE '%' || LOWER($1) || '%'
        OR similarity(LOWER(${labelColumn}), LOWER($1)) > 0.3
      )
    ORDER BY sim_score DESC, ${labelColumn}
    LIMIT $2
  `,
      [q, limitNum]
    );

    res.json({
      success: true,
      data: {
        query: q,
        language: lang,
        results: result.rows,
      },
    });
  })
);

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * GET /skill-extraction/stats
 * Get extraction statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;

    const result = await dbClient.query(`
    SELECT
      COUNT(*) as total_jobs,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
      COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
      AVG(processing_time_ms) FILTER (WHERE status = 'completed') as avg_processing_ms,
      SUM(jsonb_array_length(COALESCE(extracted_skills, '[]'))) as total_extracted,
      SUM(jsonb_array_length(COALESCE(mapped_skills, '[]'))) as total_mapped,
      SUM(jsonb_array_length(COALESCE(unmapped_skills, '[]'))) as total_unmapped
    FROM skill_extraction_jobs
  `);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        jobs: {
          total: safeParseInt(stats.total_jobs, { fallback: 0 }),
          completed: safeParseInt(stats.completed_jobs, { fallback: 0 }),
          failed: safeParseInt(stats.failed_jobs, { fallback: 0 }),
          processing: safeParseInt(stats.processing_jobs, { fallback: 0 }),
        },
        skills: {
          totalExtracted: safeParseInt(stats.total_extracted, { fallback: 0 }),
          totalMapped: safeParseInt(stats.total_mapped, { fallback: 0 }),
          totalUnmapped: safeParseInt(stats.total_unmapped, { fallback: 0 }),
          mappingRate:
            stats.total_extracted > 0
              ? Math.round((stats.total_mapped / stats.total_extracted) * 100) / 100
              : 0,
        },
        performance: {
          avgProcessingMs: Math.round(parseFloat(stats.avg_processing_ms) || 0),
        },
      },
    });
  })
);

export default router;
