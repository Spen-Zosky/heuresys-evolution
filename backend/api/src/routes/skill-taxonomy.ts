/**
 * Skill Taxonomy Routes
 * API endpoints for enhanced skill taxonomy:
 * - Skill Classifications (Hard/Soft/Hybrid, Cognitive Levels, Social Dimension)
 * - Skill Clusters (Families and Subfamilies)
 * - Skill Relationships (Prerequisites, Complementary, Substitution)
 * - Skill Adjacencies (Career paths, co-occurrence)
 */

import { Router, Request, Response } from 'express';
import {
  SkillClassificationService,
  PrimaryCategory,
  CognitiveLevel,
  Transferability,
  SocialDimension,
} from '../services/skill-classification.js';
import {
  SkillRelationshipService,
  RelationshipType,
  AdjacencyType,
} from '../services/skill-relationships.js';
import { validate } from '../middleware/validate.js';
import {
  createClassificationSchema,
  validateClassificationSchema,
  createClusterSchema,
  assignClusterSchema,
  createRelationshipSchema,
  validateRelationshipSchema,
  createAdjacencySchema,
  calculateAdjacencySchema,
} from '../schemas/skills-assessment.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// Helper to get tenant ID from request (global taxonomy, so using 'global' as default)
const getTenantId = (req: Request): string => {
  return (req as unknown as { tenantId?: string }).tenantId || 'global';
};

// Helper to safely get route param
const getParam = (req: Request, param: string): string => {
  const value = req.params[param] as string | undefined;
  if (!value) throw new Error(`Missing required parameter: ${param}`);
  return value;
};

// =============================================================================
// CLASSIFICATION ROUTES
// =============================================================================

/**
 * GET /taxonomy/stats
 * Get classification statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const service = new SkillClassificationService(getTenantId(req));
    const stats = await service.getStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /taxonomy/classifications
 * List all classifications with filtering
 */
router.get(
  '/classifications',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      primary_category,
      cognitive_level,
      social_dimension,
      transferability,
      cluster_id,
      needs_review,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    const service = new SkillClassificationService(getTenantId(req));

    // Build filters object, only including defined values
    const filters: {
      primary_category?: PrimaryCategory;
      cognitive_level?: CognitiveLevel;
      social_dimension?: SocialDimension;
      transferability?: Transferability;
      cluster_id?: string;
      needs_review?: boolean;
      limit?: number;
      offset?: number;
    } = {
      limit: safeParseInt(limit as string, { fallback: 50 }),
      offset: safeParseInt(offset as string, { fallback: 0 }),
    };

    if (primary_category) filters.primary_category = primary_category as PrimaryCategory;
    if (cognitive_level)
      filters.cognitive_level = safeParseInt(cognitive_level as string, {
        fallback: 1,
        min: 1,
        max: 4,
      }) as CognitiveLevel;
    if (social_dimension) filters.social_dimension = social_dimension as SocialDimension;
    if (transferability) filters.transferability = transferability as Transferability;
    if (cluster_id) filters.cluster_id = cluster_id as string;
    if (needs_review === 'true') filters.needs_review = true;
    else if (needs_review === 'false') filters.needs_review = false;

    const result = await service.getAllClassifications(filters);

    res.json({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * GET /taxonomy/classifications/:escoSkillId
 * Get classification for a specific skill
 */
router.get(
  '/classifications/:escoSkillId',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillClassificationService(getTenantId(req));
    const classification = await service.getClassification(escoSkillId);

    if (!classification) {
      throw Errors.notFound('Classification', escoSkillId);
    }

    res.json({ success: true, data: classification });
  })
);

/**
 * POST /taxonomy/classifications
 * Create or update classification for a skill
 */
router.post(
  '/classifications',
  validate(createClassificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      esco_skill_id,
      primary_category,
      primary_category_confidence,
      cognitive_level,
      social_dimension,
      transferability,
      transferability_score,
      skill_cluster_id,
      classification_source,
      needs_review,
    } = req.body;

    if (!esco_skill_id || !primary_category) {
      throw Errors.badRequest('esco_skill_id and primary_category are required');
    }

    const service = new SkillClassificationService(getTenantId(req));
    const userId = (req as unknown as { userId?: string }).userId;

    const result = await service.upsertClassification(
      esco_skill_id as string,
      {
        primary_category,
        primary_category_confidence,
        cognitive_level,
        social_dimension,
        transferability,
        transferability_score,
        skill_cluster_id,
        classification_source,
        needs_review,
      },
      userId
    );

    res.status(201).json({ success: true, data: result, message: 'Classification saved' });
  })
);

/**
 * POST /taxonomy/classifications/:id/validate
 * Validate/approve a classification
 */
router.post(
  '/classifications/:id/validate',
  validate(validateClassificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req, 'id');
    const updates = req.body;
    const userId = (req as unknown as { userId?: string }).userId || 'system';

    const service = new SkillClassificationService(getTenantId(req));
    const result = await service.validateClassification(id, userId, updates);

    res.json({ success: true, data: result, message: 'Classification validated' });
  })
);

// =============================================================================
// CLUSTER ROUTES
// =============================================================================

/**
 * GET /taxonomy/clusters
 * List all skill clusters
 */
router.get(
  '/clusters',
  asyncHandler(async (req: Request, res: Response) => {
    const { level, parent_id, include_skill_count } = req.query as Record<string, string>;

    const service = new SkillClassificationService(getTenantId(req));

    // Build options object
    const options: {
      level?: number;
      parent_id?: string;
      include_skill_count?: boolean;
    } = {};

    if (level) options.level = safeParseInt(level as string, { fallback: 0 });
    if (parent_id) options.parent_id = parent_id as string;
    if (include_skill_count === 'true') options.include_skill_count = true;

    const clusters = await service.getClusters(options);

    res.json({ success: true, data: clusters });
  })
);

/**
 * GET /taxonomy/clusters/summary
 * Get cluster summary with skill counts
 */
router.get(
  '/clusters/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const service = new SkillClassificationService(getTenantId(req));
    const summary = await service.getClusterSummary();

    res.json({ success: true, data: summary });
  })
);

/**
 * GET /taxonomy/clusters/:id/skills
 * Get skills in a cluster
 */
router.get(
  '/clusters/:id/skills',
  asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req, 'id');
    const service = new SkillClassificationService(getTenantId(req));
    const skills = await service.getSkillsInCluster(id);

    res.json({ success: true, data: skills });
  })
);

/**
 * POST /taxonomy/clusters
 * Create a new skill cluster
 */
router.post(
  '/clusters',
  validate(createClusterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      code,
      name_en,
      name_it,
      description,
      parent_cluster_id,
      cluster_level,
      career_path_codes,
      industry_codes,
    } = req.body;

    if (!code || !name_en) {
      throw Errors.badRequest('code and name_en are required');
    }

    const service = new SkillClassificationService(getTenantId(req));
    const cluster = await service.createCluster({
      code,
      name_en,
      name_it,
      description,
      parent_cluster_id,
      cluster_level,
      career_path_codes,
      industry_codes,
    });

    res.status(201).json({ success: true, data: cluster, message: 'Cluster created' });
  })
);

/**
 * POST /taxonomy/skills/:escoSkillId/assign-cluster
 * Assign a skill to a cluster
 */
router.post(
  '/skills/:escoSkillId/assign-cluster',
  validate(assignClusterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const { cluster_id } = req.body;

    if (!cluster_id) {
      throw Errors.badRequest('cluster_id is required');
    }

    const service = new SkillClassificationService(getTenantId(req));
    await service.assignToCluster(escoSkillId, cluster_id as string);

    res.json({ success: true, message: 'Skill assigned to cluster' });
  })
);

/**
 * GET /taxonomy/skills/:escoSkillId/suggest-cluster
 * Suggest clusters for a skill
 */
router.get(
  '/skills/:escoSkillId/suggest-cluster',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillClassificationService(getTenantId(req));
    const suggestions = await service.suggestCluster(escoSkillId);

    res.json({ success: true, data: suggestions });
  })
);

// =============================================================================
// CATEGORY QUERY ROUTES
// =============================================================================

/**
 * GET /taxonomy/skills/by-category/:category
 * Get skills by category (hard/soft/hybrid)
 */
router.get(
  '/skills/by-category/:category',
  asyncHandler(async (req: Request, res: Response) => {
    const category = getParam(req, 'category');

    if (!['hard', 'soft', 'hybrid'].includes(category)) {
      throw Errors.badRequest('Invalid category. Must be hard, soft, or hybrid');
    }

    const service = new SkillClassificationService(getTenantId(req));
    const skills = await service.getSkillsByCategory(category as PrimaryCategory);

    res.json({ success: true, data: skills, count: skills.length });
  })
);

/**
 * GET /taxonomy/skills/by-cognitive-level/:level
 * Get skills by cognitive level (1-4)
 */
router.get(
  '/skills/by-cognitive-level/:level',
  asyncHandler(async (req: Request, res: Response) => {
    const levelStr = getParam(req, 'level');
    const level = safeParseInt(levelStr, { fallback: 0 });

    if (![1, 2, 3, 4].includes(level)) {
      throw Errors.badRequest('Invalid level. Must be 1, 2, 3, or 4');
    }

    const service = new SkillClassificationService(getTenantId(req));
    const skills = await service.getSkillsByCognitiveLevel(level as CognitiveLevel);

    res.json({ success: true, data: skills, count: skills.length });
  })
);

/**
 * GET /taxonomy/skills/by-transferability/:transferability
 * Get skills by transferability (specialized/adjacent/transferable)
 */
router.get(
  '/skills/by-transferability/:transferability',
  asyncHandler(async (req: Request, res: Response) => {
    const transferability = getParam(req, 'transferability');

    if (!['specialized', 'adjacent', 'transferable'].includes(transferability)) {
      throw Errors.badRequest(
        'Invalid transferability. Must be specialized, adjacent, or transferable'
      );
    }

    const service = new SkillClassificationService(getTenantId(req));
    const skills = await service.getSkillsByTransferability(transferability as Transferability);

    res.json({ success: true, data: skills, count: skills.length });
  })
);

// =============================================================================
// RELATIONSHIP ROUTES
// =============================================================================

/**
 * GET /taxonomy/relationships/stats
 * Get relationship statistics
 */
router.get(
  '/relationships/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const service = new SkillRelationshipService(getTenantId(req));
    const stats = await service.getStats();

    res.json({ success: true, data: stats });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId
 * Get all relationships for a skill
 */
router.get(
  '/relationships/:escoSkillId',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const { type, direction } = req.query as Record<string, string>;

    const service = new SkillRelationshipService(getTenantId(req));

    const options: {
      type?: RelationshipType;
      direction?: 'outgoing' | 'incoming' | 'both';
    } = {};

    if (type) options.type = type as RelationshipType;
    if (direction) options.direction = direction as 'outgoing' | 'incoming' | 'both';

    const relationships = await service.getRelationships(escoSkillId, options);

    res.json({ success: true, data: relationships });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId/summary
 * Get relationship summary for a skill
 */
router.get(
  '/relationships/:escoSkillId/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillRelationshipService(getTenantId(req));
    const summary = await service.getSkillRelationshipSummary(escoSkillId);

    res.json({ success: true, data: summary });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId/prerequisites
 * Get prerequisite skills
 */
router.get(
  '/relationships/:escoSkillId/prerequisites',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillRelationshipService(getTenantId(req));
    const prerequisites = await service.getPrerequisites(escoSkillId);

    res.json({ success: true, data: prerequisites });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId/complementary
 * Get complementary skills
 */
router.get(
  '/relationships/:escoSkillId/complementary',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillRelationshipService(getTenantId(req));
    const complementary = await service.getComplementarySkills(escoSkillId);

    res.json({ success: true, data: complementary });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId/substitutions
 * Get substitution skills
 */
router.get(
  '/relationships/:escoSkillId/substitutions',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillRelationshipService(getTenantId(req));
    const substitutions = await service.getSubstitutionSkills(escoSkillId);

    res.json({ success: true, data: substitutions });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId/builds-on
 * Get skills that build on this skill
 */
router.get(
  '/relationships/:escoSkillId/builds-on',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillRelationshipService(getTenantId(req));
    const buildsOn = await service.getBuildsOnSkills(escoSkillId);

    res.json({ success: true, data: buildsOn });
  })
);

/**
 * GET /taxonomy/relationships/:escoSkillId/enables
 * Get skills that this skill enables
 */
router.get(
  '/relationships/:escoSkillId/enables',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const service = new SkillRelationshipService(getTenantId(req));
    const enabled = await service.getEnabledSkills(escoSkillId);

    res.json({ success: true, data: enabled });
  })
);

/**
 * POST /taxonomy/relationships
 * Create a new skill relationship
 */
router.post(
  '/relationships',
  validate(createRelationshipSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      source_skill_id,
      target_skill_id,
      relationship_type,
      relationship_strength,
      is_bidirectional,
      substitution_context,
      prerequisite_level,
      relationship_source,
    } = req.body;

    if (!source_skill_id || !target_skill_id || !relationship_type) {
      throw Errors.badRequest(
        'source_skill_id, target_skill_id, and relationship_type are required'
      );
    }

    const service = new SkillRelationshipService(getTenantId(req));
    const relationship = await service.createRelationship(
      source_skill_id as string,
      target_skill_id as string,
      relationship_type as RelationshipType,
      {
        strength: relationship_strength,
        is_bidirectional,
        substitution_context,
        prerequisite_level,
        source: relationship_source,
      }
    );

    res.status(201).json({ success: true, data: relationship, message: 'Relationship created' });
  })
);

/**
 * POST /taxonomy/relationships/:id/validate
 * Validate a relationship
 */
router.post(
  '/relationships/:id/validate',
  validate(validateRelationshipSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req, 'id');
    const updates = req.body;
    const userId = (req as unknown as { userId?: string }).userId || 'system';

    const service = new SkillRelationshipService(getTenantId(req));
    const result = await service.validateRelationship(id, userId, updates);

    res.json({ success: true, data: result, message: 'Relationship validated' });
  })
);

/**
 * DELETE /taxonomy/relationships/:id
 * Delete a relationship
 */
router.delete(
  '/relationships/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req, 'id');
    const service = new SkillRelationshipService(getTenantId(req));
    await service.deleteRelationship(id);

    res.json({ success: true, message: 'Relationship deleted' });
  })
);

// =============================================================================
// ADJACENCY ROUTES
// =============================================================================

/**
 * GET /taxonomy/adjacencies/:escoSkillId
 * Get adjacent skills
 */
router.get(
  '/adjacencies/:escoSkillId',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const { type, min_score, limit } = req.query as Record<string, string>;

    const service = new SkillRelationshipService(getTenantId(req));

    const options: {
      type?: AdjacencyType;
      min_score?: number;
      limit?: number;
    } = {};

    if (type) options.type = type as AdjacencyType;
    if (min_score) options.min_score = parseFloat(min_score as string);
    if (limit) options.limit = safeParseInt(limit as string, { fallback: 50 });

    const adjacencies = await service.getAdjacencies(escoSkillId, options);

    res.json({ success: true, data: adjacencies });
  })
);

/**
 * POST /taxonomy/adjacencies
 * Create a manual adjacency
 */
router.post(
  '/adjacencies',
  validate(createAdjacencySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { skill_id, adjacent_skill_id, adjacency_score, adjacency_type } = req.body;

    if (!skill_id || !adjacent_skill_id || adjacency_score === undefined) {
      throw Errors.badRequest('skill_id, adjacent_skill_id, and adjacency_score are required');
    }

    const service = new SkillRelationshipService(getTenantId(req));
    const adjacency = await service.createAdjacency(
      skill_id as string,
      adjacent_skill_id as string,
      adjacency_score as number,
      (adjacency_type || 'domain') as AdjacencyType
    );

    res.status(201).json({ success: true, data: adjacency, message: 'Adjacency created' });
  })
);

/**
 * POST /taxonomy/adjacencies/:escoSkillId/calculate
 * Calculate adjacencies for a skill
 */
router.post(
  '/adjacencies/:escoSkillId/calculate',
  validate(calculateAdjacencySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const { type = 'all' } = req.body;

    const service = new SkillRelationshipService(getTenantId(req));

    let jobCount = 0;
    let employeeCount = 0;

    if (type === 'all' || type === 'job_posting') {
      jobCount = await service.calculateJobPostingAdjacencies(escoSkillId);
    }

    if (type === 'all' || type === 'employee') {
      employeeCount = await service.calculateEmployeeAdjacencies(escoSkillId);
    }

    res.json({
      success: true,
      data: {
        job_posting_adjacencies: jobCount,
        employee_adjacencies: employeeCount,
        total: jobCount + employeeCount,
      },
      message: 'Adjacencies calculated',
    });
  })
);

// =============================================================================
// GRAPH ROUTES
// =============================================================================

/**
 * GET /taxonomy/graph/:escoSkillId
 * Get skill graph for visualization
 */
router.get(
  '/graph/:escoSkillId',
  asyncHandler(async (req: Request, res: Response) => {
    const escoSkillId = getParam(req, 'escoSkillId');
    const { depth = '2' } = req.query as Record<string, string>;

    const service = new SkillRelationshipService(getTenantId(req));
    const graph = await service.getSkillGraph(
      escoSkillId,
      safeParseInt(depth as string, { fallback: 2 })
    );

    res.json({ success: true, data: graph });
  })
);

/**
 * GET /taxonomy/path/:fromSkillId/:toSkillId
 * Find path between two skills
 */
router.get(
  '/path/:fromSkillId/:toSkillId',
  asyncHandler(async (req: Request, res: Response) => {
    const fromSkillId = getParam(req, 'fromSkillId');
    const toSkillId = getParam(req, 'toSkillId');
    const { max_depth = '5' } = req.query as Record<string, string>;

    const service = new SkillRelationshipService(getTenantId(req));
    const path = await service.findSkillPath(
      fromSkillId,
      toSkillId,
      safeParseInt(max_depth as string, { fallback: 5 })
    );

    if (path.length === 0) {
      res.json({ success: true, data: null, message: 'No path found between skills' });
      return;
    }

    res.json({ success: true, data: path });
  })
);

/**
 * GET /taxonomy/career-path/:fromSkillId/:toSkillId
 * Get career path skills using adjacencies
 */
router.get(
  '/career-path/:fromSkillId/:toSkillId',
  asyncHandler(async (req: Request, res: Response) => {
    const fromSkillId = getParam(req, 'fromSkillId');
    const toSkillId = getParam(req, 'toSkillId');

    const service = new SkillRelationshipService(getTenantId(req));
    const careerPath = await service.getCareerPathSkills(fromSkillId, toSkillId);

    res.json({ success: true, data: careerPath });
  })
);

export default router;
