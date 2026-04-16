/**
 * Ontology API Routes
 * Provides endpoints for the skill ontology system:
 * - Skills with semantic embeddings
 * - KSABA dimensions
 * - Skill relations
 * - Categories hierarchy
 * - Semantic search
 *
 * Epic: E-ONTO-01
 * Story: S-ONTO-01-06, S-ONTO-01-08
 * Spec: ONTO-SPEC-001
 */

import { Router, Request, Response } from 'express';
import { validateEmbeddingColumn, validateTableName } from '../utils/sql-safety.js';
import {
  createOntologyEmbeddingService,
  OntologyEmbeddingService,
} from '../services/ontology-embedding.js';
import {
  createCrossEntityService,
  CrossEntityEmbeddingService,
  EntityType,
} from '../services/cross-entity-embedding.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { cacheControl } from '../middleware/cacheHeaders.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { pool } from '../config/database.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import {
  ontologySkillSearchSchema,
  ontologyEmbeddingJobSchema,
  ontologyInferRelationsSchema,
  ontologyCrossSearchSchema,
  ontologyCrossEmbeddingsGenerateSchema,
  ontologyOrganizationAdviceSchema,
  createTenantSkillSchema,
  updateTenantSkillSchema,
  createSkillDimensionSchema,
  updateSkillDimensionSchema,
  createSkillRelationSchema,
  createCategorySchema,
  updateCategorySchema,
  recordSkillUsageSchema,
} from '../schemas/semantic.js';
import { logger } from '../config/logger.js';
import { safeParseInt, firstRowOrThrow } from '../utils/query-helpers.js';

const router = Router();

// Ontology/NACE taxonomy data — enable HTTP caching
router.use(cacheControl('static'));

// Embedding service instance (lazy initialized)
let embeddingService: OntologyEmbeddingService | null = null;
let crossEntityService: CrossEntityEmbeddingService | null = null;

async function getEmbeddingService(): Promise<OntologyEmbeddingService> {
  if (!embeddingService) {
    embeddingService = createOntologyEmbeddingService('openai');
    // Try to load API key from database
    const loaded = await embeddingService.loadApiKeyFromDb();
    if (!loaded) {
      // Check environment variable as fallback
      const envKey = process.env.OPENAI_API_KEY;
      if (envKey) {
        embeddingService.setApiKey(envKey);
      }
    }
  }
  return embeddingService;
}

async function getCrossEntityService(): Promise<CrossEntityEmbeddingService> {
  if (!crossEntityService) {
    crossEntityService = createCrossEntityService('openai');
    const loaded = await crossEntityService.loadApiKeyFromDb();
    if (!loaded) {
      const envKey = process.env.OPENAI_API_KEY;
      if (envKey) {
        crossEntityService.setApiKey(envKey);
      }
    }
  }
  return crossEntityService;
}

// =============================================================================
// HELPERS
// =============================================================================

function parsePagination(
  req: Request,
  defaultLimit = 20,
  maxLimit = 100
): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(parseInt(req.query.limit as string) || defaultLimit, 1),
    maxLimit
  );
  const offset = safeParseInt(req.query.offset as string, { fallback: 0, min: 0 });
  return { limit, offset };
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * GET /ontology/stats
 * Get ontology statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const result = await dbClient.query(`
      SELECT
        (SELECT COUNT(*) FROM esco_skills) as total_skills,
        (SELECT COUNT(*) FROM esco_skills WHERE embedding_en IS NOT NULL) as skills_with_embedding,
        (SELECT COUNT(*) FROM ontology_categories) as categories,
        (SELECT COUNT(*) FROM ontology_skill_dimensions) as dimensions,
        (SELECT COUNT(*) FROM ontology_skill_relations) as relations,
        (SELECT COUNT(*) FROM ontology_skill_relations WHERE approval_status = 'pending') as pending_relations,
        (SELECT COUNT(*) FROM tenant_custom_skills) as custom_skills,
        (SELECT COUNT(*) FROM esco_skills WHERE skill_type = 'skill') as type_skill,
        (SELECT COUNT(*) FROM esco_skills WHERE skill_type = 'knowledge') as type_knowledge,
        (SELECT COUNT(*) FROM esco_skills WHERE skill_type = 'competence') as type_competence
    `);

    res.json({
      success: true,
      data: firstRowOrThrow(result, 'OntologyStats'),
    });
  })
);

// =============================================================================
// SKILLS
// =============================================================================

/**
 * GET /ontology/skills
 * List skills with filters and pagination
 */
router.get(
  '/skills',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { limit, offset } = parsePagination(req);
    const {
      skill_type,
      is_digital,
      is_green,
      is_transversal,
      has_embedding,
      search,
      lang = 'en',
    } = req.query as Record<string, string>;

    const params: (string | number | boolean)[] = [];
    let whereClause = 'WHERE 1=1';

    if (skill_type) {
      params.push(skill_type as string);
      whereClause += ` AND s.skill_type = $${params.length}`;
    }

    if (is_digital === 'true') {
      whereClause += ` AND s.is_digital = true`;
    }

    if (is_green === 'true') {
      whereClause += ` AND s.is_green = true`;
    }

    if (is_transversal === 'true') {
      whereClause += ` AND s.is_transversal = true`;
    }

    if (has_embedding === 'true') {
      whereClause += ` AND s.embedding_en IS NOT NULL`;
    } else if (has_embedding === 'false') {
      whereClause += ` AND s.embedding_en IS NULL`;
    }

    if (search) {
      params.push(`%${escapeILIKE(search as string)}%`);
      const searchParam = params.length;
      if (lang === 'it') {
        whereClause += ` AND (s.preferred_label_it ILIKE $${searchParam} OR s.description_it ILIKE $${searchParam})`;
      } else {
        whereClause += ` AND (s.preferred_label_en ILIKE $${searchParam} OR s.description_en ILIKE $${searchParam})`;
      }
    }

    // Count query
    const countResult = await dbClient.query(
      `SELECT COUNT(*) FROM esco_skills s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count);

    // Data query
    params.push(limit, offset);
    const dataQuery = `
      SELECT
        s.id,
        s.uri,
        s.preferred_label_en,
        s.preferred_label_it,
        s.description_en,
        s.description_it,
        s.skill_type,
        s.reuse_level,
        s.is_digital,
        s.is_green,
        s.is_transversal,
        s.primary_category,
        s.cognitive_level,
        s.embedding_en IS NOT NULL as has_embedding_en,
        s.embedding_it IS NOT NULL as has_embedding_it,
        s.embedding_model,
        s.embedding_generated_at,
        (SELECT COUNT(*) FROM ontology_skill_dimensions d WHERE d.esco_skill_id = s.id) as dimensions_count,
        (SELECT COUNT(*) FROM ontology_skill_relations r WHERE r.source_skill_id = s.id OR r.target_skill_id = s.id) as relations_count
      FROM esco_skills s
      ${whereClause}
      ORDER BY s.preferred_label_en
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await dbClient.query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(total, limit, offset),
    });
  })
);

/**
 * GET /ontology/skills/popular-pairs
 * Get most commonly used skill pairs
 */
router.get(
  '/skills/popular-pairs',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { tenantId, contextType, limit } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 20, max: 100 });

    let query = `
      SELECT
        spu.skill_id_1,
        es1.preferred_label_en as skill_1_label,
        spu.skill_id_2,
        es2.preferred_label_en as skill_2_label,
        spu.co_occurrence_count,
        spu.usage_strength,
        spu.context_type
      FROM skill_pair_usage spu
      JOIN esco_skills es1 ON spu.skill_id_1 = es1.id
      JOIN esco_skills es2 ON spu.skill_id_2 = es2.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (tenantId) {
      query += ` AND (spu.tenant_id = $${paramIndex++} OR spu.tenant_id IS NULL)`;
      params.push(tenantId);
    }

    if (contextType) {
      query += ` AND spu.context_type = $${paramIndex++}`;
      params.push(contextType);
    }

    query += ` ORDER BY spu.co_occurrence_count DESC, spu.usage_strength DESC LIMIT $${paramIndex}`;
    params.push(limitNum);

    const result = await dbClient.query(query, params);

    res.json({
      success: true,
      data: {
        pairs: result.rows.map((row) => ({
          skill1: {
            id: row.skill_id_1,
            label: row.skill_1_label,
          },
          skill2: {
            id: row.skill_id_2,
            label: row.skill_2_label,
          },
          occurrences: parseInt(row.co_occurrence_count),
          strength: parseFloat(row.usage_strength),
          context: row.context_type,
        })),
      },
    });
  })
);

/**
 * GET /ontology/skills/:id
 * Get skill details by ID
 */
router.get(
  '/skills/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id } = req.params as Record<string, string>;

    const result = await dbClient.query(
      `
      SELECT
        s.*,
        s.embedding_en IS NOT NULL as has_embedding_en,
        s.embedding_it IS NOT NULL as has_embedding_it,
        sg.preferred_label_en as skill_group_name
      FROM esco_skills s
      LEFT JOIN esco_skill_groups sg ON s.skill_group_uri = sg.uri
      WHERE s.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill', id);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * GET /ontology/skills/:id/dimensions
 * Get KSABA dimensions for a skill
 */
router.get(
  '/skills/:id/dimensions',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id } = req.params as Record<string, string>;

    // Verify skill exists
    const skillCheck = await dbClient.query('SELECT id FROM esco_skills WHERE id = $1', [id]);
    if (skillCheck.rows.length === 0) {
      throw Errors.notFound('Skill', id);
    }

    const result = await dbClient.query(
      `
      SELECT
        d.id,
        d.dimension_type,
        d.description_en,
        d.description_it,
        d.level_scale,
        d.min_level,
        d.max_level,
        d.is_primary,
        d.embedding IS NOT NULL as has_embedding,
        d.created_at,
        d.updated_at
      FROM ontology_skill_dimensions d
      WHERE d.esco_skill_id = $1
      ORDER BY
        CASE d.dimension_type
          WHEN 'knowledge' THEN 1
          WHEN 'skill' THEN 2
          WHEN 'ability' THEN 3
          WHEN 'behavior' THEN 4
          WHEN 'attitude' THEN 5
        END
    `,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /ontology/skills/:id/relations
 * Get relations for a skill
 */
router.get(
  '/skills/:id/relations',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const id = req.params.id;
    const { direction = 'both', relation_type } = req.query as Record<string, string>;

    if (!id) {
      throw Errors.badRequest('Skill ID required');
    }

    // Verify skill exists
    const skillId = id as string;
    const skillCheck = await dbClient.query('SELECT id FROM esco_skills WHERE id = $1', [skillId]);
    if (skillCheck.rows.length === 0) {
      throw Errors.notFound('Skill', skillId);
    }

    let whereClause = '';
    const params: string[] = [skillId];

    if (direction === 'outgoing') {
      whereClause = 'r.source_skill_id = $1';
    } else if (direction === 'incoming') {
      whereClause = 'r.target_skill_id = $1';
    } else {
      whereClause = '(r.source_skill_id = $1 OR r.target_skill_id = $1)';
    }

    if (relation_type && typeof relation_type === 'string') {
      params.push(relation_type);
      whereClause += ` AND r.relation_type = $${params.length}`;
    }

    const result = await dbClient.query(
      `
      SELECT
        r.id,
        r.relation_type,
        r.strength,
        r.context,
        r.source as provenance,
        r.confidence,
        r.approval_status,
        r.created_at,
        CASE
          WHEN r.source_skill_id = $1 THEN 'outgoing'
          ELSE 'incoming'
        END as direction,
        CASE
          WHEN r.source_skill_id = $1 THEN r.target_skill_id
          ELSE r.source_skill_id
        END as related_skill_id,
        CASE
          WHEN r.source_skill_id = $1 THEN ts.preferred_label_en
          ELSE ss.preferred_label_en
        END as related_skill_name
      FROM ontology_skill_relations r
      JOIN esco_skills ss ON r.source_skill_id = ss.id
      JOIN esco_skills ts ON r.target_skill_id = ts.id
      WHERE ${whereClause}
      ORDER BY r.strength DESC, r.created_at DESC
    `,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

// =============================================================================
// CATEGORIES
// =============================================================================

/**
 * GET /ontology/categories
 * List all categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { level, parent_id, active_only = 'true' } = req.query as Record<string, string>;
    const params: (string | number)[] = [];
    let whereClause = 'WHERE 1=1';

    if (active_only === 'true') {
      whereClause += ' AND c.is_active = true';
    }

    if (level !== undefined) {
      params.push(safeParseInt(level as string, { fallback: 0 }));
      whereClause += ` AND c.level = $${params.length}`;
    }

    if (parent_id) {
      params.push(parent_id as string);
      whereClause += ` AND c.parent_id = $${params.length}`;
    }

    const result = await dbClient.query(
      `
      SELECT
        c.id,
        c.code,
        c.name_en,
        c.name_it,
        c.description_en,
        c.description_it,
        c.level,
        c.parent_id,
        c.esco_pillar,
        c.isced_field,
        c.is_active,
        c.created_at,
        (SELECT COUNT(*) FROM ontology_categories child WHERE child.parent_id = c.id) as children_count
      FROM ontology_categories c
      ${whereClause}
      ORDER BY c.level, c.code
    `,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /ontology/categories/:id
 * Get category details
 */
router.get(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { id } = req.params as Record<string, string>;

    const result = await dbClient.query(
      `
      SELECT
        c.*,
        p.code as parent_code,
        p.name_en as parent_name
      FROM ontology_categories c
      LEFT JOIN ontology_categories p ON c.parent_id = p.id
      WHERE c.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Category', id);
    }

    // Get children
    const children = await dbClient.query(
      `
      SELECT id, code, name_en, name_it, level
      FROM ontology_categories
      WHERE parent_id = $1 AND is_active = true
      ORDER BY code
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        children: children.rows,
      },
    });
  })
);

// =============================================================================
// SEMANTIC SEARCH
// =============================================================================

/**
 * POST /ontology/skills/search
 * Semantic search for skills using vector similarity or text fallback
 */
router.post(
  '/skills/search',
  validate(ontologySkillSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const {
      query,
      language = 'en',
      limit = 20,
      similarity_threshold = 0.7,
      skill_type,
      is_digital,
      is_green,
      is_transversal,
      use_vector = true, // Try vector search by default
      include_custom_skills = false,
    } = req.body;

    if (!query || typeof query !== 'string') {
      throw Errors.badRequest('Query string is required');
    }

    const tenantId = (req as { tenantId?: string }).tenantId;
    const lang: 'en' | 'it' = language === 'it' ? 'it' : 'en';
    const effectiveLimit = Math.min(limit, 100);

    // Check if vector search is possible (embeddings exist)
    const embeddingCheck = await dbClient.query(
      'SELECT COUNT(*) FROM esco_skills WHERE embedding_en IS NOT NULL LIMIT 1'
    );
    const hasEmbeddings = parseInt(embeddingCheck.rows[0]?.count) > 0;

    let searchResults;
    let searchType: 'vector' | 'text' = 'text';

    if (use_vector && hasEmbeddings) {
      try {
        const service = await getEmbeddingService();
        const searchOptions = {
          query,
          language: lang,
          limit: effectiveLimit,
          similarityThreshold: similarity_threshold,
          skillType: skill_type,
          isDigital: is_digital,
          isGreen: is_green,
          isTransversal: is_transversal,
          includeCustomSkills: include_custom_skills,
          ...(tenantId && { tenantId }),
        };
        searchResults = await service.searchSkillsByVector(searchOptions);
        searchType = 'vector';
      } catch (vectorError) {
        // Fall back to text search if vector search fails
        logger.warn({ err: vectorError }, 'Vector search failed, falling back to text search:');
        searchResults = null;
      }
    }

    // Text search fallback
    if (!searchResults) {
      const searchQuery = `%${escapeILIKE(query as string)}%`;
      const params: (string | number | boolean)[] = [searchQuery];

      let whereClause = '';
      if (lang === 'it') {
        whereClause = `(preferred_label_it ILIKE $1 OR description_it ILIKE $1 OR alt_labels_it::text ILIKE $1)`;
      } else {
        whereClause = `(preferred_label_en ILIKE $1 OR description_en ILIKE $1 OR alt_labels::text ILIKE $1)`;
      }

      if (skill_type) {
        params.push(skill_type);
        whereClause += ` AND skill_type = $${params.length}`;
      }
      if (is_digital !== undefined) {
        params.push(is_digital);
        whereClause += ` AND is_digital = $${params.length}`;
      }
      if (is_green !== undefined) {
        params.push(is_green);
        whereClause += ` AND is_green = $${params.length}`;
      }
      if (is_transversal !== undefined) {
        params.push(is_transversal);
        whereClause += ` AND is_transversal = $${params.length}`;
      }

      params.push(effectiveLimit);

      const labelCol = lang === 'it' ? 'preferred_label_it' : 'preferred_label_en';
      const descCol = lang === 'it' ? 'description_it' : 'description_en';

      const result = await dbClient.query(
        `
        SELECT
          id,
          uri,
          preferred_label_en,
          preferred_label_it,
          description_en,
          description_it,
          skill_type,
          is_digital,
          is_green,
          is_transversal,
          CASE
            WHEN LOWER(${labelCol}) = LOWER($1) THEN 1.0
            WHEN ${labelCol} ILIKE $1 THEN 0.9
            WHEN ${descCol} ILIKE $1 THEN 0.7
            ELSE 0.5
          END as similarity,
          'esco' as source
        FROM esco_skills
        WHERE ${whereClause}
        ORDER BY
          CASE WHEN ${labelCol} ILIKE $1 THEN 0 ELSE 1 END,
          ${labelCol}
        LIMIT $${params.length}
      `,
        params
      );

      searchResults = result.rows.map((row) => ({
        id: row.id,
        preferredLabel:
          lang === 'it' ? row.preferred_label_it || row.preferred_label_en : row.preferred_label_en,
        altLabels: [],
        description: lang === 'it' ? row.description_it || row.description_en : row.description_en,
        skillType: row.skill_type,
        similarity: parseFloat(row.similarity),
        source: 'esco' as const,
      }));
    }

    res.json({
      success: true,
      data: {
        results: searchResults,
        search_type: searchType,
        query_language: lang,
        total_results: searchResults.length,
        has_embeddings: hasEmbeddings,
      },
      meta: {
        similarity_threshold,
        vector_search_attempted: use_vector,
        embeddings_available: hasEmbeddings,
      },
    });
  })
);

// =============================================================================
// EMBEDDING MANAGEMENT
// =============================================================================

/**
 * GET /ontology/embeddings/status
 * Get embedding generation status
 */
router.get(
  '/embeddings/status',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const result = await dbClient.query(`
      SELECT
        (SELECT COUNT(*) FROM esco_skills) as total_skills,
        (SELECT COUNT(*) FROM esco_skills WHERE embedding_en IS NOT NULL) as with_embedding_en,
        (SELECT COUNT(*) FROM esco_skills WHERE embedding_it IS NOT NULL) as with_embedding_it,
        (SELECT COUNT(*) FROM tenant_custom_skills WHERE embedding_en IS NOT NULL) as custom_with_embedding,
        (SELECT COUNT(*) FROM ontology_embedding_jobs WHERE status = 'processing') as jobs_processing,
        (SELECT COUNT(*) FROM ontology_embedding_jobs WHERE status = 'pending') as jobs_pending,
        (
          SELECT json_agg(job)
          FROM (
            SELECT id, job_type, target_table, status, total_items, processed_items, failed_items, created_at
            FROM ontology_embedding_jobs
            ORDER BY created_at DESC
            LIMIT 5
          ) job
        ) as recent_jobs
    `);

    const stats = result.rows[0];
    const totalSkills = parseInt(stats.total_skills);
    const withEmbedding = parseInt(stats.with_embedding_en);

    res.json({
      success: true,
      data: {
        coverage: {
          total_skills: totalSkills,
          with_embedding_en: parseInt(stats.with_embedding_en),
          with_embedding_it: parseInt(stats.with_embedding_it),
          custom_with_embedding: parseInt(stats.custom_with_embedding),
          coverage_percentage:
            totalSkills > 0 ? Math.round((withEmbedding / totalSkills) * 100 * 100) / 100 : 0,
        },
        jobs: {
          processing: parseInt(stats.jobs_processing),
          pending: parseInt(stats.jobs_pending),
          recent: stats.recent_jobs || [],
        },
        ready_for_vector_search: withEmbedding > 0,
      },
    });
  })
);

/**
 * GET /ontology/embeddings/jobs
 * List embedding generation jobs
 */
router.get(
  '/embeddings/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const limit = safeParseInt(req.query.limit as string, { fallback: 20, max: 100 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const status = req.query.status as string | undefined;

    let query = `
      SELECT id, target, job_type, status, total_items, processed_items,
             failed_items, started_at, completed_at, created_at, updated_at
      FROM ontology_embedding_jobs
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` WHERE status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await dbClient.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
  })
);

/**
 * POST /ontology/embeddings/jobs
 * Create a new embedding generation job
 */
router.post(
  '/embeddings/jobs',
  validate(ontologyEmbeddingJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { target = 'esco_skills', job_type = 'incremental' } = req.body;

    const tenantId = (req as { tenantId?: string }).tenantId;

    if (
      target !== 'esco_skills' &&
      target !== 'tenant_custom_skills' &&
      target !== 'industry_classifications'
    ) {
      throw Errors.badRequest(
        'Invalid target. Must be "esco_skills", "tenant_custom_skills", or "industry_classifications"'
      );
    }

    if (target === 'tenant_custom_skills' && !tenantId) {
      throw Errors.badRequest('Tenant context required for tenant_custom_skills');
    }

    const service = await getEmbeddingService();
    const jobId = await service.createEmbeddingJob(target, job_type, tenantId);

    res.status(201).json({
      success: true,
      data: {
        job_id: jobId,
        message: 'Embedding job created. Use GET /embeddings/jobs/:id to check status.',
        note: 'Use POST /embeddings/jobs/:id/start to begin processing.',
      },
    });
  })
);

/**
 * GET /ontology/embeddings/jobs/:id
 * Get job status
 */
router.get(
  '/embeddings/jobs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw Errors.badRequest('Job ID required');
    }

    const service = await getEmbeddingService();
    try {
      const status = await service.getJobStatus(id);
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw Errors.notFound('Embedding job', id);
      }
      throw error;
    }
  })
);

/**
 * POST /ontology/embeddings/jobs/:id/start
 * Start processing an embedding job
 */
router.post(
  '/embeddings/jobs/:id/start',
  validate(ontologyEmbeddingJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw Errors.badRequest('Job ID required');
    }

    const service = await getEmbeddingService();

    // Start processing in background
    service.processEmbeddingJob(id).catch((embErr) => {
      logger.error({ err: embErr }, `Embedding job ${String(id)} failed`);
    });

    res.json({
      success: true,
      data: {
        job_id: id,
        message: 'Job processing started in background',
        status_url: `/api/v1/ontology/embeddings/jobs/${id}`,
      },
    });
  })
);

/**
 * POST /ontology/embeddings/infer-relations
 * Infer skill relations using vector similarity
 */
router.post(
  '/embeddings/infer-relations',
  validate(ontologyInferRelationsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { similarity_threshold = 0.85, limit = 1000 } = req.body;

    // Check if we have embeddings
    const embeddingCheck = await dbClient.query(
      'SELECT COUNT(*) FROM esco_skills WHERE embedding_en IS NOT NULL'
    );
    const embeddingCount = parseInt(embeddingCheck.rows[0]?.count);

    if (embeddingCount < 100) {
      throw Errors.badRequest('Not enough skills with embeddings. Generate embeddings first.');
    }

    const service = await getEmbeddingService();
    const result = await service.inferSkillRelations(similarity_threshold, limit);

    res.json({
      success: true,
      data: {
        relations_found: result.relationsFound,
        inference_job_id: result.jobId,
        message: 'Skill relations inferred and saved with pending approval status',
      },
    });
  })
);

// =============================================================================
// TENANT CUSTOM SKILLS
// =============================================================================

/**
 * GET /ontology/tenant-skills
 * List custom skills for current tenant
 */
router.get(
  '/tenant-skills',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const tenantId = (req as { tenantId?: string }).tenantId;

    if (!tenantId) {
      throw Errors.badRequest('Tenant context required');
    }

    const { limit, offset } = parsePagination(req);

    const result = await dbClient.query(
      `
      SELECT
        ts.*,
        es.preferred_label_en as base_skill_name,
        c.name_en as category_name
      FROM tenant_custom_skills ts
      LEFT JOIN esco_skills es ON ts.base_esco_skill_id = es.id
      LEFT JOIN ontology_categories c ON ts.category_id = c.id
      WHERE ts.tenant_id = $1 AND ts.is_active = true
      ORDER BY ts.name_en
      LIMIT $2 OFFSET $3
    `,
      [tenantId, limit, offset]
    );

    const countResult = await dbClient.query(
      'SELECT COUNT(*) FROM tenant_custom_skills WHERE tenant_id = $1 AND is_active = true',
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.count), limit, offset),
    });
  })
);

// =============================================================================
// CROSS-ENTITY SEMANTIC SEARCH
// =============================================================================

/**
 * GET /ontology/cross-search
 * Search across multiple entity types using query parameter
 */
router.get(
  '/cross-search',
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    const language = (req.query.language as string) || 'en';
    const entityTypesParam = req.query.entityTypes as string;
    const limit = safeParseInt(req.query.limit as string, { fallback: 10, max: 50 });
    const similarityThreshold = parseFloat(req.query.similarityThreshold as string) || 0.5;
    const tenantId = (req as { tenantId?: string }).tenantId;

    if (!query || query.trim().length === 0) {
      throw Errors.badRequest('Query parameter "q" is required');
    }

    const validEntityTypes: EntityType[] = [
      'skills',
      'occupations',
      'jobs',
      'courses',
      'goals',
      'industry_classifications_l1',
      'industry_classifications_l2',
      'industry_classifications_l3',
    ];

    let requestedTypes: EntityType[] = ['skills', 'occupations', 'jobs', 'courses'];
    if (entityTypesParam) {
      requestedTypes = entityTypesParam
        .split(',')
        .filter((t) => validEntityTypes.includes(t as EntityType)) as EntityType[];
    }

    if (requestedTypes.length === 0) {
      throw Errors.badRequest('At least one valid entity type is required');
    }

    const service = await getCrossEntityService();
    const searchOptions: {
      query: string;
      language: 'en' | 'it';
      entityTypes: EntityType[];
      limit: number;
      similarityThreshold: number;
      tenantId?: string;
    } = {
      query: query.trim(),
      language: language === 'it' ? 'it' : 'en',
      entityTypes: requestedTypes,
      limit,
      similarityThreshold: Math.min(Math.max(similarityThreshold, 0), 1),
    };
    if (tenantId) {
      searchOptions.tenantId = tenantId;
    }
    const result = await service.crossEntitySearch(searchOptions);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /ontology/cross-search
 * Search across multiple entity types using semantic similarity
 */
router.post(
  '/cross-search',
  validate(ontologyCrossSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      query,
      language = 'en',
      entityTypes = ['skills', 'occupations', 'jobs', 'courses'],
      limit = 10,
      similarityThreshold = 0.5,
      tenantId,
    } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw Errors.badRequest('Query is required');
    }

    // Validate entity types
    const validEntityTypes: EntityType[] = [
      'skills',
      'occupations',
      'jobs',
      'courses',
      'goals',
      'industry_classifications_l1',
      'industry_classifications_l2',
      'industry_classifications_l3',
    ];
    const requestedTypes = (entityTypes as string[]).filter((t) =>
      validEntityTypes.includes(t as EntityType)
    ) as EntityType[];

    if (requestedTypes.length === 0) {
      throw Errors.badRequest('At least one valid entity type is required');
    }

    const service = await getCrossEntityService();
    const result = await service.crossEntitySearch({
      query: query.trim(),
      language: language === 'it' ? 'it' : 'en',
      entityTypes: requestedTypes,
      limit: Math.min(Math.max(limit, 1), 50),
      similarityThreshold: Math.min(Math.max(similarityThreshold, 0), 1),
      tenantId,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /ontology/cross-embeddings/status
 * Get embedding coverage status for all entity types
 */
router.get(
  '/cross-embeddings/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const service = await getCrossEntityService();
    const status = await service.getEmbeddingStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * POST /ontology/cross-embeddings/generate
 * Generate embeddings for a specific entity type
 */
router.post(
  '/cross-embeddings/generate',
  validate(ontologyCrossEmbeddingsGenerateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { entityType, jobType = 'incremental', tenantId } = req.body;

    const validEntityTypes: EntityType[] = [
      'occupations',
      'jobs',
      'courses',
      'goals',
      'industry_classifications_l1',
      'industry_classifications_l2',
      'industry_classifications_l3',
    ];

    if (!entityType || !validEntityTypes.includes(entityType)) {
      throw Errors.badRequest(`Invalid entityType. Valid types: ${validEntityTypes.join(', ')}`);
    }

    if (jobType !== 'full' && jobType !== 'incremental') {
      throw Errors.badRequest('jobType must be "full" or "incremental"');
    }

    const service = await getCrossEntityService();
    const result = await service.generateEntityEmbeddings({
      entityType,
      jobType,
      tenantId,
    });

    res.json({
      success: true,
      data: {
        entityType,
        jobType,
        processed: result.processed,
        failed: result.failed,
        tokensUsed: result.tokens,
      },
    });
  })
);

// =============================================================================
// ORGANIZATION ADVISORY
// =============================================================================

/**
 * POST /ontology/organization/advice
 * Get organizational structure advice based on industry and company size
 */
router.post(
  '/organization/advice',
  validate(ontologyOrganizationAdviceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { industry, companySize, language = 'it', additionalContext } = req.body;

    if (!industry || typeof industry !== 'string') {
      throw Errors.badRequest(
        'industry is required (e.g., "lavorazioni meccaniche", "software development")'
      );
    }

    if (!companySize || typeof companySize !== 'number' || companySize < 1) {
      throw Errors.badRequest('companySize is required and must be a positive number');
    }

    const service = await getCrossEntityService();
    const advice = await service.getOrganizationAdvice({
      industry,
      companySize,
      language: language === 'en' ? 'en' : 'it',
      additionalContext,
    });

    res.json({
      success: true,
      data: advice,
    });
  })
);

/**
 * GET /ontology/industries
 * List available NACE industry classifications
 */
router.get(
  '/industries',
  asyncHandler(async (req: Request, res: Response) => {
    // Use pool directly — industry_classifications is platform-level data
    const dbClient = (req as unknown as { dbClient?: import('pg').PoolClient }).dbClient ?? pool;
    const levelParam = req.query['level'] as string | undefined;
    const limitParam = parseInt(req.query['limit'] as string) || 500;
    const language = (req.query.language as string) === 'en' ? 'en' : 'it';
    const nameCol = language === 'it' ? 'name_it' : 'name_en';
    const descCol = language === 'it' ? 'description_it' : 'description_en';

    // Support both numeric levels (1-6) and text levels (section/division/group)
    let numericLevel: number;
    switch (levelParam) {
      case 'section':
        numericLevel = 1;
        break;
      case 'division':
        numericLevel = 2;
        break;
      case 'group':
        numericLevel = 3;
        break;
      default:
        numericLevel = parseInt(levelParam || '') || 2; // default: division (level 2)
    }

    const limit = Math.min(limitParam, 1000);
    const search = req.query['q'] as string | undefined;
    const params: (number | string)[] = [numericLevel, limit];
    let searchClause = '';
    if (search) {
      searchClause = `AND (${nameCol} ILIKE $3 OR code ILIKE $3)`;
      params.push('%' + search + '%');
    }

    const result = await dbClient.query(
      `SELECT code, name_it, name_en, ${nameCol} AS name, ${descCol} AS description, level
       FROM industry_classifications
       WHERE level = $1 AND is_active = true ${searchClause}
       ORDER BY code
       LIMIT $2`,
      params
    );

    res.json({
      success: true,
      data: { items: result.rows },
      meta: {
        level: numericLevel,
        language,
        count: result.rows.length,
      },
    });
  })
);

/**
 * GET /ontology/industries/:code/occupations
 * Get typical occupations for an industry
 */
router.get(
  '/industries/:code/occupations',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const code = (req.params.code as string) || '';
    const language = (req.query.language as string) === 'en' ? 'en' : 'it';
    const limit = safeParseInt(req.query.limit as string, { fallback: 20, max: 50 });

    const embCol = validateEmbeddingColumn(
      language === 'it' ? 'embedding_it' : 'embedding_en',
      'ontology.industries-occupations'
    );
    const labelCol = validateEmbeddingColumn(
      language === 'it' ? 'preferred_label_it' : 'preferred_label_en',
      'ontology.industries-occupations'
    );

    // Determine NACE level based on code format
    const naceLevel = code.length === 1 ? 1 : code.length <= 2 ? 2 : 3;
    const tableName = validateTableName(
      'industry_classifications',
      'ontology.industries-occupations'
    );

    // Get industry embedding
    const industryResult = await dbClient.query(
      `
      SELECT ${embCol} as embedding, name_en, name_it
      FROM ${tableName}
      WHERE code = $1 AND level = ${naceLevel}
    `,
      [code]
    );

    if (industryResult.rows.length === 0) {
      throw Errors.notFound('Industry', code);
    }

    const industry = industryResult.rows[0];

    if (!industry.embedding) {
      throw Errors.badRequest('Industry embeddings not generated. Run embedding generation first.');
    }

    // Find similar occupations
    const occResult = await dbClient.query(
      `
      SELECT id, uri, ${labelCol} as label, isco_code, occupation_type,
             1 - (${embCol} <=> $1::vector) as similarity
      FROM esco_occupations
      WHERE ${embCol} IS NOT NULL
      ORDER BY ${embCol} <=> $1::vector
      LIMIT $2
    `,
      [industry.embedding, limit]
    );

    res.json({
      success: true,
      data: {
        industry: {
          code,
          name: language === 'it' ? industry.name_it : industry.name_en,
        },
        occupations: occResult.rows.map((row) => ({
          id: row.id,
          uri: row.uri,
          label: row.label,
          iscoCode: row.isco_code,
          type: row.occupation_type,
          relevance: parseFloat(row.similarity.toFixed(4)),
        })),
      },
    });
  })
);

// =============================================================================
// WRITE OPERATIONS - TENANT CUSTOM SKILLS
// =============================================================================

/**
 * POST /ontology/tenant-skills
 * Create a new tenant custom skill
 */
router.post(
  '/tenant-skills',
  validate(createTenantSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const {
      tenant_id,
      code,
      name_en,
      name_it,
      description_en,
      description_it,
      skill_type,
      base_esco_skill_id,
      category_id,
    } = req.body;

    if (!tenant_id || !code || !name_en) {
      throw Errors.badRequest('tenant_id, code, and name_en are required');
    }

    const result = await dbClient.query(
      `INSERT INTO tenant_custom_skills
       (tenant_id, code, name_en, name_it, description_en, description_it,
        skill_type, base_esco_skill_id, category_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [
        tenant_id,
        code,
        name_en,
        name_it || name_en,
        description_en,
        description_it || description_en,
        skill_type || 'skill',
        base_esco_skill_id,
        category_id,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * PUT /ontology/tenant-skills/:id
 * Update a tenant custom skill
 */
router.put(
  '/tenant-skills/:id',
  validate(updateTenantSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const id = req.params.id as string;
    const {
      name_en,
      name_it,
      description_en,
      description_it,
      skill_type,
      base_esco_skill_id,
      category_id,
      is_active,
    } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (name_en !== undefined) {
      updates.push(`name_en = $${paramIndex++}`);
      params.push(name_en);
    }
    if (name_it !== undefined) {
      updates.push(`name_it = $${paramIndex++}`);
      params.push(name_it);
    }
    if (description_en !== undefined) {
      updates.push(`description_en = $${paramIndex++}`);
      params.push(description_en);
    }
    if (description_it !== undefined) {
      updates.push(`description_it = $${paramIndex++}`);
      params.push(description_it);
    }
    if (skill_type !== undefined) {
      updates.push(`skill_type = $${paramIndex++}`);
      params.push(skill_type);
    }
    if (base_esco_skill_id !== undefined) {
      updates.push(`base_esco_skill_id = $${paramIndex++}`);
      params.push(base_esco_skill_id);
    }
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      params.push(category_id);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const tenantId = (req as { tenantId?: string }).tenantId;
    let updateQuery: string;
    if (tenantId) {
      params.push(tenantId);
      updateQuery = `UPDATE tenant_custom_skills SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`;
    } else {
      updateQuery = `UPDATE tenant_custom_skills SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    }

    const result = await dbClient.query(updateQuery, params);

    if (result.rows.length === 0) {
      throw Errors.notFound('Tenant custom skill', id);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * DELETE /ontology/tenant-skills/:id
 * Delete a tenant custom skill (soft delete by setting is_active = false)
 */
router.delete(
  '/tenant-skills/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const id = req.params.id as string;
    const hardDelete = req.query.hard === 'true';
    const tenantId = (req as { tenantId?: string }).tenantId;

    if (hardDelete) {
      const result = await dbClient.query(
        tenantId
          ? `DELETE FROM tenant_custom_skills WHERE id = $1 AND tenant_id = $2 RETURNING id`
          : `DELETE FROM tenant_custom_skills WHERE id = $1 RETURNING id`,
        tenantId ? [id, tenantId] : [id]
      );

      if (result.rows.length === 0) {
        throw Errors.notFound('Tenant custom skill', id);
      }
    } else {
      const result = await dbClient.query(
        tenantId
          ? `UPDATE tenant_custom_skills SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id`
          : `UPDATE tenant_custom_skills SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
        tenantId ? [id, tenantId] : [id]
      );

      if (result.rows.length === 0) {
        throw Errors.notFound('Tenant custom skill', id);
      }
    }

    res.json({
      success: true,
      message: hardDelete ? 'Skill permanently deleted' : 'Skill deactivated',
    });
  })
);

// =============================================================================
// WRITE OPERATIONS - SKILL DIMENSIONS
// =============================================================================

/**
 * POST /ontology/skills/:id/dimensions
 * Add a dimension to an ESCO skill
 */
router.post(
  '/skills/:id/dimensions',
  validate(createSkillDimensionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const escoSkillId = req.params.id as string;
    const {
      dimension_type,
      description_en,
      description_it,
      level_scale,
      min_level,
      max_level,
      is_primary,
    } = req.body;

    const validDimensions = ['knowledge', 'skill', 'ability', 'behavior', 'attitude'];
    if (!dimension_type || !validDimensions.includes(dimension_type)) {
      throw Errors.badRequest(`dimension_type must be one of: ${validDimensions.join(', ')}`);
    }

    // Verify the ESCO skill exists
    const skillCheck = await dbClient.query('SELECT id FROM esco_skills WHERE id = $1', [
      escoSkillId,
    ]);

    if (skillCheck.rows.length === 0) {
      throw Errors.notFound('ESCO skill', escoSkillId);
    }

    const result = await dbClient.query(
      `INSERT INTO ontology_skill_dimensions
       (esco_skill_id, dimension_type, description_en, description_it, level_scale, min_level, max_level, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        escoSkillId,
        dimension_type,
        description_en,
        description_it,
        level_scale || 'basic_to_expert',
        min_level || 1,
        max_level || 5,
        is_primary || false,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * PUT /ontology/skills/:id/dimensions/:dimensionId
 * Update a skill dimension
 */
router.put(
  '/skills/:id/dimensions/:dimensionId',
  validate(updateSkillDimensionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const escoSkillId = req.params.id as string;
    const dimensionId = req.params.dimensionId as string;
    const { description_en, description_it, level_scale, min_level, max_level, is_primary } =
      req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (description_en !== undefined) {
      updates.push(`description_en = $${paramIndex++}`);
      params.push(description_en);
    }
    if (description_it !== undefined) {
      updates.push(`description_it = $${paramIndex++}`);
      params.push(description_it);
    }
    if (level_scale !== undefined) {
      updates.push(`level_scale = $${paramIndex++}`);
      params.push(level_scale);
    }
    if (min_level !== undefined) {
      updates.push(`min_level = $${paramIndex++}`);
      params.push(min_level);
    }
    if (max_level !== undefined) {
      updates.push(`max_level = $${paramIndex++}`);
      params.push(max_level);
    }
    if (is_primary !== undefined) {
      updates.push(`is_primary = $${paramIndex++}`);
      params.push(is_primary);
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');
    params.push(dimensionId, escoSkillId);

    const result = await dbClient.query(
      `UPDATE ontology_skill_dimensions SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND esco_skill_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill dimension', dimensionId);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * DELETE /ontology/skills/:id/dimensions/:dimensionId
 * Delete a skill dimension
 */
router.delete(
  '/skills/:id/dimensions/:dimensionId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const escoSkillId = req.params.id as string;
    const dimensionId = req.params.dimensionId as string;

    const result = await dbClient.query(
      `DELETE FROM ontology_skill_dimensions WHERE id = $1 AND esco_skill_id = $2 RETURNING id`,
      [dimensionId, escoSkillId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill dimension', dimensionId);
    }

    res.json({
      success: true,
      message: 'Dimension deleted',
    });
  })
);

// =============================================================================
// WRITE OPERATIONS - SKILL RELATIONS
// =============================================================================

/**
 * POST /ontology/skills/:id/relations
 * Add a relation between skills
 */
router.post(
  '/skills/:id/relations',
  validate(createSkillRelationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const sourceSkillId = req.params.id as string;
    const { target_skill_id, relation_type, strength, bidirectional } = req.body;

    const validRelations = [
      'broader',
      'narrower',
      'related',
      'similar',
      'prerequisite',
      'complements',
    ];
    if (!relation_type || !validRelations.includes(relation_type)) {
      throw Errors.badRequest(`relation_type must be one of: ${validRelations.join(', ')}`);
    }

    if (!target_skill_id) {
      throw Errors.badRequest('target_skill_id is required');
    }

    // Insert the relation
    const result = await dbClient.query(
      `INSERT INTO ontology_skill_relations
       (source_skill_id, target_skill_id, relation_type, strength, source, is_inferred)
       VALUES ($1, $2, $3, $4, 'manual', false)
       ON CONFLICT (source_skill_id, target_skill_id, relation_type) DO UPDATE SET
         strength = EXCLUDED.strength,
         updated_at = NOW()
       RETURNING *`,
      [sourceSkillId, target_skill_id, relation_type, strength || 1.0]
    );

    // If bidirectional, create reverse relation
    if (bidirectional) {
      const reverseType =
        relation_type === 'broader'
          ? 'narrower'
          : relation_type === 'narrower'
            ? 'broader'
            : relation_type;

      await dbClient.query(
        `INSERT INTO ontology_skill_relations
         (source_skill_id, target_skill_id, relation_type, strength, source, is_inferred)
         VALUES ($1, $2, $3, $4, 'manual', false)
         ON CONFLICT (source_skill_id, target_skill_id, relation_type) DO UPDATE SET
           strength = EXCLUDED.strength,
           updated_at = NOW()`,
        [target_skill_id, sourceSkillId, reverseType, strength || 1.0]
      );
    }

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * DELETE /ontology/skills/:id/relations/:relationId
 * Delete a skill relation
 */
router.delete(
  '/skills/:id/relations/:relationId',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const skillId = req.params.id as string;
    const relationId = req.params.relationId as string;
    const deleteBidirectional = req.query.bidirectional === 'true';

    // Get the relation first if we need to delete bidirectionally
    let reverseRelation = null;
    if (deleteBidirectional) {
      const relResult = await dbClient.query(
        `SELECT target_skill_id, relation_type FROM ontology_skill_relations WHERE id = $1`,
        [relationId]
      );
      if (relResult.rows.length > 0) {
        reverseRelation = relResult.rows[0];
      }
    }

    const result = await dbClient.query(
      `DELETE FROM ontology_skill_relations WHERE id = $1 AND source_skill_id = $2 RETURNING id`,
      [relationId, skillId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Skill relation', relationId);
    }

    // Delete reverse relation if bidirectional
    if (deleteBidirectional && reverseRelation) {
      const reverseType =
        reverseRelation.relation_type === 'broader'
          ? 'narrower'
          : reverseRelation.relation_type === 'narrower'
            ? 'broader'
            : reverseRelation.relation_type;

      await dbClient.query(
        `DELETE FROM ontology_skill_relations
         WHERE source_skill_id = $1 AND target_skill_id = $2 AND relation_type = $3`,
        [reverseRelation.target_skill_id, skillId, reverseType]
      );
    }

    res.json({
      success: true,
      message: 'Relation deleted',
    });
  })
);

// =============================================================================
// WRITE OPERATIONS - CATEGORIES
// =============================================================================

/**
 * POST /ontology/categories
 * Create a new ontology category
 */
router.post(
  '/categories',
  validate(createCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const {
      code,
      name_en,
      name_it,
      description_en,
      description_it,
      parent_id,
      level,
      esco_pillar,
      isced_field,
    } = req.body;

    if (!code || !name_en) {
      throw Errors.badRequest('code and name_en are required');
    }

    // Calculate level based on parent
    let categoryLevel = level;
    if (categoryLevel === undefined && parent_id) {
      const parentResult = await dbClient.query(
        'SELECT level FROM ontology_categories WHERE id = $1',
        [parent_id]
      );
      if (parentResult.rows.length > 0) {
        categoryLevel = parentResult.rows[0]?.level + 1;
      }
    }

    const result = await dbClient.query(
      `INSERT INTO ontology_categories
       (code, name_en, name_it, description_en, description_it, parent_id, level, esco_pillar, isced_field, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [
        code,
        name_en,
        name_it || name_en,
        description_en,
        description_it || description_en,
        parent_id,
        categoryLevel || 0,
        esco_pillar,
        isced_field,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * PUT /ontology/categories/:id
 * Update an ontology category
 */
router.put(
  '/categories/:id',
  validate(updateCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const id = req.params.id as string;
    const {
      name_en,
      name_it,
      description_en,
      description_it,
      parent_id,
      level,
      esco_pillar,
      isced_field,
      is_active,
    } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (name_en !== undefined) {
      updates.push(`name_en = $${paramIndex++}`);
      params.push(name_en);
    }
    if (name_it !== undefined) {
      updates.push(`name_it = $${paramIndex++}`);
      params.push(name_it);
    }
    if (description_en !== undefined) {
      updates.push(`description_en = $${paramIndex++}`);
      params.push(description_en);
    }
    if (description_it !== undefined) {
      updates.push(`description_it = $${paramIndex++}`);
      params.push(description_it);
    }
    if (parent_id !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      params.push(parent_id);
    }
    if (level !== undefined) {
      updates.push(`level = $${paramIndex++}`);
      params.push(level);
    }
    if (esco_pillar !== undefined) {
      updates.push(`esco_pillar = $${paramIndex++}`);
      params.push(esco_pillar);
    }
    if (isced_field !== undefined) {
      updates.push(`isced_field = $${paramIndex++}`);
      params.push(isced_field);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const result = await dbClient.query(
      `UPDATE ontology_categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Category', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * DELETE /ontology/categories/:id
 * Delete an ontology category
 */
router.delete(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const id = req.params.id as string;

    // Check for child categories
    const childCheck = await dbClient.query(
      `SELECT COUNT(*) FROM ontology_categories WHERE parent_id = $1`,
      [id]
    );

    if (parseInt(childCheck.rows[0].count) > 0) {
      throw Errors.badRequest(
        'Cannot delete category with child categories. Delete children first.'
      );
    }

    const result = await dbClient.query(
      `DELETE FROM ontology_categories WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Category', id);
    }

    res.json({ success: true, message: 'Category deleted' });
  })
);

// =============================================================================
// SKILL SUGGESTIONS (Usage-Based)
// =============================================================================

/**
 * GET /ontology/skills/:id/suggestions
 * Get skill suggestions based on usage patterns and relationships
 */
router.get(
  '/skills/:id/suggestions',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const skillId = req.params.id as string;
    const tenantId = req.query.tenantId as string | undefined;
    const { limit, includeRelations, includeUsage } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 10, max: 50 });
    const withRelations = includeRelations !== 'false';
    const withUsage = includeUsage !== 'false';

    const suggestions: Array<{
      skillId: string;
      skillLabel: string;
      score: number;
      source: 'usage' | 'relation' | 'semantic';
      relationType?: string;
      usageCount?: number;
    }> = [];

    // 1. Get usage-based suggestions from skill_pair_usage
    if (withUsage) {
      const usageResult = await dbClient.query(
        `
        SELECT
          CASE
            WHEN spu.skill_id_1 = $1 THEN spu.skill_id_2
            ELSE spu.skill_id_1
          END as paired_skill_id,
          es.preferred_label_en as skill_label,
          spu.co_occurrence_count,
          spu.usage_strength
        FROM skill_pair_usage spu
        JOIN esco_skills es ON (
          CASE
            WHEN spu.skill_id_1 = $1 THEN spu.skill_id_2
            ELSE spu.skill_id_1
          END = es.id
        )
        WHERE (spu.skill_id_1 = $1 OR spu.skill_id_2 = $1)
          AND ($2::UUID IS NULL OR spu.tenant_id = $2 OR spu.tenant_id IS NULL)
        ORDER BY spu.usage_strength DESC, spu.co_occurrence_count DESC
        LIMIT $3
      `,
        [skillId, tenantId || null, limitNum]
      );

      for (const row of usageResult.rows) {
        suggestions.push({
          skillId: row.paired_skill_id,
          skillLabel: row.skill_label,
          score: parseFloat(row.usage_strength) || 0,
          source: 'usage',
          usageCount: parseInt(row.co_occurrence_count),
        });
      }
    }

    // 2. Get relation-based suggestions
    if (withRelations) {
      const relationResult = await dbClient.query(
        `
        SELECT
          CASE
            WHEN r.source_skill_id = $1 THEN r.target_skill_id
            ELSE r.source_skill_id
          END as related_skill_id,
          es.preferred_label_en as skill_label,
          r.relation_type,
          r.strength
        FROM ontology_skill_relations r
        JOIN esco_skills es ON (
          CASE
            WHEN r.source_skill_id = $1 THEN r.target_skill_id
            ELSE r.source_skill_id
          END = es.id
        )
        WHERE (r.source_skill_id = $1 OR r.target_skill_id = $1)
          AND r.approval_status = 'approved'
          AND r.relation_type IN ('complementary', 'related_to', 'similar_to')
        ORDER BY r.strength DESC
        LIMIT $2
      `,
        [skillId, limitNum]
      );

      for (const row of relationResult.rows) {
        // Avoid duplicates
        if (!suggestions.find((s) => s.skillId === row.related_skill_id)) {
          suggestions.push({
            skillId: row.related_skill_id,
            skillLabel: row.skill_label,
            score: parseFloat(row.strength) || 0,
            source: 'relation',
            relationType: row.relation_type,
          });
        }
      }
    }

    // 3. Get semantic similarity suggestions (if not enough from other sources)
    if (suggestions.length < limitNum) {
      const needed = limitNum - suggestions.length;
      const existingIds = suggestions.map((s) => s.skillId);
      existingIds.push(skillId); // Exclude the source skill

      const semanticResult = await dbClient.query(
        `
        SELECT
          es2.id as skill_id,
          es2.preferred_label_en as skill_label,
          1 - (es1.embedding_en <=> es2.embedding_en) as similarity
        FROM esco_skills es1
        JOIN esco_skills es2 ON es2.id != es1.id
        WHERE es1.id = $1
          AND es2.embedding_en IS NOT NULL
          AND es2.id != ALL($2)
        ORDER BY es1.embedding_en <=> es2.embedding_en
        LIMIT $3
      `,
        [skillId, existingIds, needed]
      );

      for (const row of semanticResult.rows) {
        suggestions.push({
          skillId: row.skill_id,
          skillLabel: row.skill_label,
          score: parseFloat(row.similarity) || 0,
          source: 'semantic',
        });
      }
    }

    // Sort by score descending and limit
    suggestions.sort((a, b) => b.score - a.score);
    const finalSuggestions = suggestions.slice(0, limitNum);

    res.json({
      success: true,
      data: {
        skillId,
        suggestions: finalSuggestions,
        sources: {
          usage: finalSuggestions.filter((s) => s.source === 'usage').length,
          relation: finalSuggestions.filter((s) => s.source === 'relation').length,
          semantic: finalSuggestions.filter((s) => s.source === 'semantic').length,
        },
      },
    });
  })
);

/**
 * POST /ontology/skills/record-usage
 * Record skill pair usage for improving suggestions
 */
router.post(
  '/skills/record-usage',
  validate(recordSkillUsageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { skillIds, tenantId, contextType } = req.body as {
      skillIds: string[];
      tenantId?: string;
      contextType?: string;
    };

    if (!Array.isArray(skillIds) || skillIds.length < 2) {
      throw Errors.badRequest('skillIds array must contain at least 2 skills');
    }

    if (skillIds.length > 20) {
      throw Errors.badRequest('Maximum 20 skills per usage record');
    }

    const context = contextType || 'employee_profile';
    let recorded = 0;

    // Record all pairs
    for (let i = 0; i < skillIds.length; i++) {
      for (let j = i + 1; j < skillIds.length; j++) {
        const result = await dbClient.query(`SELECT record_skill_pair_usage($1, $2, $3, $4)`, [
          skillIds[i],
          skillIds[j],
          tenantId || null,
          context,
        ]);
        if (result.rows[0].record_skill_pair_usage) {
          recorded++;
        }
      }
    }

    res.json({
      success: true,
      data: {
        skillCount: skillIds.length,
        pairsRecorded: recorded,
        contextType: context,
      },
    });
  })
);

export default router;
