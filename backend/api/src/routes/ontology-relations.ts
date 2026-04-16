/**
 * Ontology Relations Routes
 * Advanced ontological analysis endpoints for the ESCO knowledge graph.
 * Mount point: /api/v1/ontology (appended alongside existing ontology routes)
 *
 * Endpoints:
 *   GET /api/v1/ontology/skill-clusters
 *   GET /api/v1/ontology/career-pathways/:occupationId
 *   GET /api/v1/ontology/process-skill-impact
 *
 * Horizon O3.7
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
import { OntologyRelationsService } from '../services/ontology-relations.js';
import { pool } from '../config/database.js';

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SKILL_TYPES = new Set(['skill', 'knowledge', 'competence']);

// =============================================================================
// GET /skill-clusters
// =============================================================================

/**
 * GET /api/v1/ontology/skill-clusters
 * Returns ESCO skills clustered by broader_uri hierarchy.
 *
 * Query params:
 *   limit    — clusters per page (default 20, max 100)
 *   offset   — pagination offset (default 0)
 *   skillType — filter: skill | knowledge | competence
 */
router.get(
  '/skill-clusters',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = safeParseInt(req.query['limit'] as string, { fallback: 20, min: 1, max: 100 });
    const offset = safeParseInt(req.query['offset'] as string, { fallback: 0, min: 0 });
    const rawType = req.query['skillType'] as string | undefined;

    if (rawType && !ALLOWED_SKILL_TYPES.has(rawType)) {
      throw Errors.badRequest(`Invalid skillType. Allowed: ${[...ALLOWED_SKILL_TYPES].join(', ')}`);
    }

    const dbClient = (req as unknown as { dbClient?: import('pg').PoolClient }).dbClient;
    const service = new OntologyRelationsService(dbClient ?? pool);
    const result = await service.getSkillClusters({
      limit,
      offset,
      ...(rawType ? { skillType: rawType } : {}),
    });

    res.json({
      success: true,
      data: result.clusters,
      meta: { total: result.total, limit, offset },
    });
  })
);

// =============================================================================
// GET /career-pathways/:occupationId
// =============================================================================

/**
 * GET /api/v1/ontology/career-pathways/:occupationId
 * Returns inferred career pathway steps from the given ESCO occupation.
 * Neighbors are occupations sharing >= 60% of skills with the source.
 */
router.get(
  '/career-pathways/:occupationId',
  asyncHandler(async (req: Request, res: Response) => {
    const { occupationId } = req.params as { occupationId: string };

    if (!UUID_REGEX.test(occupationId)) {
      throw Errors.badRequest('Invalid occupationId format');
    }

    const dbClient = (req as unknown as { dbClient?: import('pg').PoolClient }).dbClient;
    const service = new OntologyRelationsService(dbClient ?? pool);
    const result = await service.getCareerPathways(occupationId);

    res.json({ success: true, data: result });
  })
);

// =============================================================================
// GET /process-skill-impact
// =============================================================================

/**
 * GET /api/v1/ontology/process-skill-impact
 * Returns skills cross-referenced with business processes.
 * Marks critical skills (appearing in >2 processes) and unique skills (only 1 process).
 */
router.get(
  '/process-skill-impact',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = (req as unknown as { dbClient?: import('pg').PoolClient }).dbClient;
    const service = new OntologyRelationsService(dbClient ?? pool);
    const result = await service.getProcessSkillImpact();

    res.json({ success: true, data: result });
  })
);

export default router;
