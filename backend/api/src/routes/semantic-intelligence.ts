/**
 * Semantic Intelligence API Routes
 *
 * Provides unified cross-domain semantic search capabilities.
 *
 * @author Claude
 * @date 2025-12-22
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import {
  UnifiedSemanticService,
  createUnifiedSemanticService,
  SemanticEntityType,
} from '../services/unified-semantic-service.js';
import {
  EmbeddingQueueProcessor,
  createEmbeddingQueueProcessor,
} from '../services/embedding-queue-processor.js';

// NOTE: pool is retained here only for service singleton construction.
// UnifiedSemanticService and EmbeddingQueueProcessor use pool internally.
// A full migration of service internals is tracked separately.
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { validate } from '../middleware/validate.js';
import {
  semanticSearchSchema,
  semanticDirectSearchSchema,
  semanticEmbeddingsGenerateSchema,
  semanticTalentSearchSchema,
  semanticPerformanceSearchSchema,
  semanticLearningSearchSchema,
  semanticOrgSearchSchema,
  semanticAskSchema,
  semanticQueueProcessSchema,
  semanticQueueCleanupSchema,
} from '../schemas/semantic.js';
import { logger } from '../config/logger.js';

const router = Router();

let semanticService: UnifiedSemanticService | null = null;
let queueProcessor: EmbeddingQueueProcessor | null = null;
let serviceInitialized = false;

/**
 * Initialize semantic service with database pool
 */
function getSemanticService(): UnifiedSemanticService {
  if (!semanticService) {
    semanticService = createUnifiedSemanticService(pool);
  }
  return semanticService;
}

/**
 * Initialize queue processor
 */
function getQueueProcessor(): EmbeddingQueueProcessor {
  if (!queueProcessor) {
    queueProcessor = createEmbeddingQueueProcessor(pool);
    // Start background processing (every 30 seconds, batch of 50)
    queueProcessor.startBackgroundProcessing(30000, 50);
  }
  return queueProcessor;
}

/**
 * Middleware to ensure service is initialized
 */
async function ensureService(
  req: Request,
  _res: Response,
  next: (...args: unknown[]) => void
): Promise<void> {
  try {
    const service = getSemanticService();
    const processor = getQueueProcessor();

    // Load API key if not set
    if (!serviceInitialized) {
      await service.loadApiKeyFromDb();
      await processor.loadApiKey();
      serviceInitialized = true;
    }

    (
      req as Request & {
        semanticService: UnifiedSemanticService;
        queueProcessor: EmbeddingQueueProcessor;
      }
    ).semanticService = service;
    (
      req as Request & {
        semanticService: UnifiedSemanticService;
        queueProcessor: EmbeddingQueueProcessor;
      }
    ).queueProcessor = processor;
    next();
  } catch (error) {
    next(error);
  }
}

// Apply middleware to all routes
router.use(ensureService);

// =============================================================================
// UNIFIED SEARCH ENDPOINTS
// =============================================================================

/**
 * POST /api/v1/semantic/search
 * Unified semantic search across all entity types
 */
router.post(
  '/search',
  validate(semanticSearchSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const { query, entityTypes, limit = 20, similarityThreshold = 0.5, filters } = req.body;

    if (!query) {
      throw Errors.badRequest('Query is required');
    }

    const result = await service.unifiedSearch({
      query,
      tenantId,
      entityTypes: entityTypes as SemanticEntityType[],
      limit,
      similarityThreshold,
      filters,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/semantic/search/direct
 * Direct search in source tables (bypasses unified index)
 */
router.post(
  '/search/direct',
  validate(semanticDirectSearchSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const { query, entityTypes, limit = 10, similarityThreshold = 0.5 } = req.body;

    if (!query) {
      throw Errors.badRequest('Query is required');
    }

    const result = await service.unifiedSearch({
      query,
      tenantId,
      entityTypes: entityTypes as SemanticEntityType[],
      limit,
      similarityThreshold,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// EMBEDDING GENERATION ENDPOINTS
// =============================================================================

/**
 * POST /api/v1/semantic/embeddings/generate
 * Generate embeddings for a specific entity type
 */
router.post(
  '/embeddings/generate',
  validate(semanticEmbeddingsGenerateSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    const { entityType, batchSize = 50, forceRegenerate = false } = req.body;

    if (!entityType) {
      throw Errors.badRequest('Entity type is required');
    }

    const result = await service.generateEntityEmbeddings({
      entityType: entityType as SemanticEntityType,
      batchSize,
      tenantId,
      forceRegenerate,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/semantic/embeddings/generate-all
 * Generate embeddings for all entity types
 */
router.post(
  '/embeddings/generate-all',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    // Start async generation
    res.json({
      success: true,
      message: 'Embedding generation started. Check status endpoint for progress.',
    });

    // Run in background
    service
      .generateAllEmbeddings(tenantId)
      .then((results) => {
        logger.info(`All embeddings generated: ${String(results)}`);
      })
      .catch((error) => {
        logger.error({ err: error }, 'Error generating all embeddings:');
      });
  })
);

/**
 * GET /api/v1/semantic/embeddings/status
 * Get embedding status for all entity types
 */
router.get(
  '/embeddings/status',
  asyncHandler(async (req: Request, res: Response) => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;

    const status = await service.getEmbeddingStatus();

    // Calculate totals
    let totalRecords = 0;
    let totalEmbedded = 0;

    for (const entityStatus of Object.values(status)) {
      totalRecords += entityStatus.total;
      totalEmbedded += entityStatus.embedded;
    }

    res.json({
      success: true,
      data: {
        status,
        summary: {
          totalRecords,
          totalEmbedded,
          overallPercentage:
            totalRecords > 0 ? Math.round((totalEmbedded / totalRecords) * 100) : 0,
        },
      },
    });
  })
);

/**
 * GET /api/v1/semantic/index/stats
 * Get unified index statistics
 */
router.get(
  '/index/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;

    const stats = await service.getIndexStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

// =============================================================================
// SPECIALIZED SEARCH ENDPOINTS
// =============================================================================

/**
 * POST /api/v1/semantic/talent-search
 * Search for talent across employees, candidates, and skills
 */
router.post(
  '/talent-search',
  validate(semanticTalentSearchSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const {
      query,
      limit = 15,
      similarityThreshold = 0.5,
      includeInternal = true,
      includeExternal = true,
    } = req.body;

    if (!query) {
      throw Errors.badRequest('Query is required');
    }

    const entityTypes: SemanticEntityType[] = [];
    if (includeInternal) {
      entityTypes.push('employee', 'skill_gap_analysis', 'career_path');
    }
    if (includeExternal) {
      entityTypes.push('candidate');
    }

    const result = await service.unifiedSearch({
      query,
      tenantId,
      entityTypes,
      limit,
      similarityThreshold,
    });

    res.json({
      success: true,
      data: {
        ...result,
        internalResults: result.resultsByType.employee || [],
        externalResults: result.resultsByType.candidate || [],
        skillGaps: result.resultsByType.skill_gap_analysis || [],
        careerPaths: result.resultsByType.career_path || [],
      },
    });
  })
);

/**
 * POST /api/v1/semantic/performance-search
 * Search across performance data (reviews, check-ins, feedback)
 */
router.post(
  '/performance-search',
  validate(semanticPerformanceSearchSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const {
      query,
      limit = 20,
      similarityThreshold = 0.5,
      includeReviews = true,
      includeCheckIns = true,
      includeFeedback = true,
    } = req.body;

    if (!query) {
      throw Errors.badRequest('Query is required');
    }

    const entityTypes: SemanticEntityType[] = [];
    if (includeReviews) entityTypes.push('performance_review');
    if (includeCheckIns) entityTypes.push('check_in');
    if (includeFeedback) entityTypes.push('feedback_360');

    const result = await service.unifiedSearch({
      query,
      tenantId,
      entityTypes,
      limit,
      similarityThreshold,
    });

    res.json({
      success: true,
      data: {
        ...result,
        reviews: result.resultsByType.performance_review || [],
        checkIns: result.resultsByType.check_in || [],
        feedback: result.resultsByType.feedback_360 || [],
      },
    });
  })
);

/**
 * POST /api/v1/semantic/learning-search
 * Search across learning content (paths, courses)
 */
router.post(
  '/learning-search',
  validate(semanticLearningSearchSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const { query, limit = 15, similarityThreshold = 0.5 } = req.body;

    if (!query) {
      throw Errors.badRequest('Query is required');
    }

    const entityTypes: SemanticEntityType[] = ['learning_path', 'course', 'skill'];

    const result = await service.unifiedSearch({
      query,
      tenantId,
      entityTypes,
      limit,
      similarityThreshold,
    });

    res.json({
      success: true,
      data: {
        ...result,
        learningPaths: result.resultsByType.learning_path || [],
        courses: result.resultsByType.course || [],
        skills: result.resultsByType.skill || [],
      },
    });
  })
);

/**
 * POST /api/v1/semantic/org-search
 * Search across organizational structure
 */
router.post(
  '/org-search',
  validate(semanticOrgSearchSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const { query, limit = 15, similarityThreshold = 0.5 } = req.body;

    if (!query) {
      throw Errors.badRequest('Query is required');
    }

    const entityTypes: SemanticEntityType[] = ['department', 'org_unit', 'location', 'employee'];

    const result = await service.unifiedSearch({
      query,
      tenantId,
      entityTypes,
      limit,
      similarityThreshold,
    });

    res.json({
      success: true,
      data: {
        ...result,
        departments: result.resultsByType.department || [],
        orgUnits: result.resultsByType.org_unit || [],
        locations: result.resultsByType.location || [],
        employees: result.resultsByType.employee || [],
      },
    });
  })
);

// =============================================================================
// NATURAL LANGUAGE QUERY ENDPOINT
// =============================================================================

/**
 * POST /api/v1/semantic/ask
 * Natural language query endpoint
 * Interprets the query and routes to appropriate search
 */
router.post(
  '/ask',
  validate(semanticAskSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = (req as Request & { semanticService: UnifiedSemanticService }).semanticService;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID required');
    }

    const { question, limit = 15 } = req.body;

    if (!question) {
      throw Errors.badRequest('Question is required');
    }

    // Analyze question to determine entity types
    const questionLower = question.toLowerCase();
    const entityTypes: SemanticEntityType[] = [];

    // Talent/Employee related
    if (
      questionLower.includes('dipendent') ||
      questionLower.includes('employee') ||
      questionLower.includes('chi ') ||
      questionLower.includes('who ') ||
      questionLower.includes('talent') ||
      questionLower.includes('person')
    ) {
      entityTypes.push('employee', 'candidate');
    }

    // Performance related
    if (
      questionLower.includes('performance') ||
      questionLower.includes('review') ||
      questionLower.includes('feedback') ||
      questionLower.includes('valutazion')
    ) {
      entityTypes.push('performance_review', 'check_in', 'feedback_360');
    }

    // Skills/Learning related
    if (
      questionLower.includes('skill') ||
      questionLower.includes('competenz') ||
      questionLower.includes('cors') ||
      questionLower.includes('formaz') ||
      questionLower.includes('learn') ||
      questionLower.includes('train')
    ) {
      entityTypes.push('skill', 'course', 'learning_path', 'skill_gap_analysis');
    }

    // Organization related
    if (
      questionLower.includes('dipartiment') ||
      questionLower.includes('department') ||
      questionLower.includes('team') ||
      questionLower.includes('unit') ||
      questionLower.includes('sede') ||
      questionLower.includes('location')
    ) {
      entityTypes.push('department', 'org_unit', 'location');
    }

    // Career related
    if (
      questionLower.includes('career') ||
      questionLower.includes('carriera') ||
      questionLower.includes('succession') ||
      questionLower.includes('cresci')
    ) {
      entityTypes.push('career_path', 'skill_gap_analysis');
    }

    // Goals related
    if (
      questionLower.includes('goal') ||
      questionLower.includes('obiettiv') ||
      questionLower.includes('okr') ||
      questionLower.includes('target')
    ) {
      entityTypes.push('goal');
    }

    // Default to all if no specific entities detected
    if (entityTypes.length === 0) {
      entityTypes.push('employee', 'department', 'skill', 'course', 'goal');
    }

    // Remove duplicates
    const uniqueEntityTypes = [...new Set(entityTypes)];

    const result = await service.unifiedSearch({
      query: question,
      tenantId,
      entityTypes: uniqueEntityTypes,
      limit,
      similarityThreshold: 0.45, // Lower threshold for natural language
    });

    res.json({
      success: true,
      data: {
        question,
        interpretedAs: uniqueEntityTypes,
        ...result,
      },
    });
  })
);

// =============================================================================
// EMBEDDING QUEUE MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/semantic/queue/status
 * Get embedding queue statistics
 */
router.get(
  '/queue/status',
  asyncHandler(async (req: Request, res: Response) => {
    const processor = (req as Request & { queueProcessor: EmbeddingQueueProcessor }).queueProcessor;
    const stats = await processor.getQueueStats();

    res.json({
      success: true,
      data: {
        queue: stats,
        backgroundProcessing: true,
        processingInterval: '30 seconds',
        batchSize: 50,
      },
    });
  })
);

/**
 * POST /api/v1/semantic/queue/process
 * Manually trigger queue processing
 */
router.post(
  '/queue/process',
  validate(semanticQueueProcessSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const processor = (req as Request & { queueProcessor: EmbeddingQueueProcessor }).queueProcessor;
    const { batchSize = 50 } = req.body;

    const result = await processor.processBatch(batchSize);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/semantic/queue/retry-failed
 * Retry all failed queue items
 */
router.post(
  '/queue/retry-failed',
  asyncHandler(async (req: Request, res: Response) => {
    const processor = (req as Request & { queueProcessor: EmbeddingQueueProcessor }).queueProcessor;
    const count = await processor.retryFailed();

    res.json({
      success: true,
      data: {
        retriedCount: count,
        message: `${count} failed items queued for retry`,
      },
    });
  })
);

/**
 * POST /api/v1/semantic/queue/cleanup
 * Clean up old completed queue entries
 */
router.post(
  '/queue/cleanup',
  validate(semanticQueueCleanupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const processor = (req as Request & { queueProcessor: EmbeddingQueueProcessor }).queueProcessor;
    const { daysToKeep = 7 } = req.body;

    const count = await processor.cleanup(daysToKeep);

    res.json({
      success: true,
      data: {
        deletedCount: count,
        message: `Cleaned up ${count} completed entries older than ${daysToKeep} days`,
      },
    });
  })
);

export default router;
