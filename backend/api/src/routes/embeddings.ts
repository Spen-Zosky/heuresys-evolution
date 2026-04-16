/**
 * Embeddings API Routes
 *
 * Exposes the embedding generation pipeline via REST endpoints.
 * Provides queue management, processing triggers, semantic search,
 * and queue statistics.
 *
 * Endpoints:
 * - POST /embeddings/queue       — Queue entities for embedding generation
 * - POST /embeddings/process     — Trigger queue processing (admin only)
 * - POST /embeddings/search      — Semantic similarity search
 * - GET  /embeddings/stats       — Queue statistics
 * - POST /embeddings/reindex     — Re-generate embedding for an entity
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import {
  createEmbeddingPipeline,
  EmbeddingPipelineService,
} from '../services/embedding-pipeline.js';
import { validate } from '../middleware/validate.js';
import {
  queueEmbeddingSchema,
  processEmbeddingsSchema,
  embeddingSearchSchema,
  reindexEmbeddingSchema,
} from '../schemas/skills-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

let pipelineService: EmbeddingPipelineService | null = null;
let apiKeyLoaded = false;

/**
 * Get or create the pipeline service singleton.
 * NOTE: Service uses pool internally for its own queries. The singleton pattern
 * means pool is captured once at construction time. A full migration of the service
 * internals is tracked separately — here we migrate only direct pool.query() in routes.
 */
function getPipeline(): EmbeddingPipelineService {
  if (!pipelineService) {
    pipelineService = createEmbeddingPipeline(pool);
  }
  return pipelineService;
}

/**
 * Middleware to ensure the pipeline service is initialized with an API key.
 */
async function ensurePipeline(_req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const service = getPipeline();
    if (!apiKeyLoaded) {
      await service.loadApiKey();
      apiKeyLoaded = true;
    }
    next();
  } catch (error) {
    next(error);
  }
}

router.use(ensurePipeline);

// =============================================================================
// GET /embeddings/queue — View embedding queue items
// =============================================================================

/**
 * @openapi
 * /api/v1/embeddings/queue:
 *   get:
 *     summary: Get embedding queue items and their status
 *     tags: [Embeddings]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (pending, processing, completed, failed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Queue items list
 */
router.get(
  '/queue',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const status = req.query.status as string | undefined;
    const limit = safeParseInt(req.query.limit as string, { fallback: 20, max: 100 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });

    let query = `
      SELECT id, entity_type, entity_id, status, error_message,
             created_at, updated_at
      FROM embedding_queue
      WHERE tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await dbClient.query(query, params);

    const countResult = await dbClient.query(
      `SELECT COUNT(*) FROM embedding_queue WHERE tenant_id = $1${status ? ' AND status = $2' : ''}`,
      status ? [tenantId, status] : [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        total: parseInt(countResult.rows[0]?.count),
        limit,
        offset,
      },
    });
  })
);

// =============================================================================
// POST /embeddings/queue — Queue entities for embedding generation
// =============================================================================

/**
 * @openapi
 * /api/v1/embeddings/queue:
 *   post:
 *     summary: Queue an entity for embedding generation
 *     tags: [Embeddings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entity_type, entity_id, text_content]
 *             properties:
 *               entity_type:
 *                 type: string
 *               entity_id:
 *                 type: string
 *                 format: uuid
 *               text_content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entity queued successfully
 */
router.post(
  '/queue',
  validate(queueEmbeddingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { entity_type, entity_id, text_content } = req.body as {
      entity_type?: string;
      entity_id?: string;
      text_content?: string;
    };

    if (!entity_type || !entity_id || !text_content) {
      throw Errors.badRequest('entity_type, entity_id, and text_content are required');
    }

    const service = getPipeline();
    const queueId = await service.queueEntity({
      entityType: entity_type,
      entityId: entity_id,
      tenantId,
      textContent: text_content,
    });

    res.status(201).json({
      success: true,
      data: { queue_id: queueId, entity_type, entity_id },
      message: 'Entity queued for embedding generation',
    });
  })
);

// =============================================================================
// POST /embeddings/process — Trigger queue processing (admin only)
// =============================================================================

/**
 * @openapi
 * /api/v1/embeddings/process:
 *   post:
 *     summary: Trigger embedding queue processing (admin only)
 *     tags: [Embeddings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               batch_size:
 *                 type: integer
 *                 default: 50
 *     responses:
 *       200:
 *         description: Processing result
 */
router.post(
  '/process',
  requirePermission('AI_SERVICES', 'CREATE'),
  validate(processEmbeddingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { batch_size } = req.body as { batch_size?: number };
    const batchSize =
      typeof batch_size === 'number' && batch_size > 0 ? Math.min(batch_size, 200) : 50;

    const service = getPipeline();
    const result = await service.processQueue(batchSize);

    res.json({
      success: true,
      data: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        duration_ms: result.durationMs,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      },
      message: `Processed ${result.processed} items: ${result.succeeded} succeeded, ${result.failed} failed`,
    });
  })
);

// =============================================================================
// POST /embeddings/search — Semantic similarity search
// =============================================================================

/**
 * @openapi
 * /api/v1/embeddings/search:
 *   post:
 *     summary: Semantic similarity search
 *     tags: [Embeddings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: Text query to search for
 *               entity_type:
 *                 type: string
 *                 description: Optional filter by entity type
 *               limit:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Search results with similarity scores
 */
router.post(
  '/search',
  validate(embeddingSearchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { query, entity_type, limit } = req.body as {
      query?: string;
      entity_type?: string;
      limit?: number;
    };

    if (!query || !query.trim()) {
      throw Errors.badRequest('query is required and must be a non-empty string');
    }

    const effectiveLimit = typeof limit === 'number' && limit > 0 ? Math.min(limit, 100) : 10;

    const service = getPipeline();

    // Generate embedding for the query text
    const queryVector = await service.generateEmbedding(query.trim());

    // Search for similar entities
    const results = await service.searchSimilar(queryVector, tenantId, effectiveLimit, entity_type);

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length,
      },
    });
  })
);

// =============================================================================
// GET /embeddings/stats — Queue statistics
// =============================================================================

/**
 * @openapi
 * /api/v1/embeddings/stats:
 *   get:
 *     summary: Get embedding queue statistics
 *     tags: [Embeddings]
 *     responses:
 *       200:
 *         description: Queue stats (pending, processing, completed, failed)
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const service = getPipeline();
    const stats = await service.getQueueStats();

    // Also get count of indexed entities
    const indexResult = await dbClient.query(
      `SELECT COUNT(*) AS total_indexed,
            COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embeddings,
            COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embeddings
     FROM semantic_entity_index
     WHERE is_active = true`
    );

    const indexRow = indexResult.rows[0];

    res.json({
      success: true,
      data: {
        queue: stats,
        index: {
          total_indexed: parseInt(indexRow.total_indexed, 10),
          with_embeddings: parseInt(indexRow.with_embeddings, 10),
          without_embeddings: parseInt(indexRow.without_embeddings, 10),
        },
      },
    });
  })
);

// =============================================================================
// POST /embeddings/reindex — Re-generate embedding for an entity
// =============================================================================

/**
 * @openapi
 * /api/v1/embeddings/reindex:
 *   post:
 *     summary: Re-generate embedding for a specific entity
 *     tags: [Embeddings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entity_type, entity_id]
 *             properties:
 *               entity_type:
 *                 type: string
 *               entity_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Entity re-indexed successfully
 */
router.post(
  '/reindex',
  requirePermission('AI_SERVICES', 'CREATE'),
  validate(reindexEmbeddingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { entity_type, entity_id } = req.body as {
      entity_type?: string;
      entity_id?: string;
    };

    if (!entity_type || !entity_id) {
      throw Errors.badRequest('entity_type and entity_id are required');
    }

    const service = getPipeline();
    await service.reindexEntity(entity_type, entity_id, tenantId);

    res.json({
      success: true,
      data: { entity_type, entity_id },
      message: 'Entity re-indexed successfully',
    });
  })
);

export default router;
