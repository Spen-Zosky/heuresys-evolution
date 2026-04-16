/**
 * Training Recommendations Routes
 * Sprint 2025-04 - S-ONTO-03-08
 *
 * Endpoints for training recommendations based on skill gaps
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  employeeIdParamSchema,
  courseIdParamSchema,
  skillIdParamSchema,
  pathIdParamSchema,
  trainingRecommendationsQuerySchema,
  courseSearchQuerySchema,
  learningPathsQuerySchema,
  gapBasedQuerySchema,
} from '../schemas/analytics-extended.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { TrainingRecommendationService } from '../services/training-recommendation/index.js';

import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();
const trainingService = new TrainingRecommendationService(pool);

router.use(requireTenant);

/**
 * GET /training-recommendations/employees/:employeeId
 * Get personalized training recommendations for an employee
 */
router.get(
  '/employees/:employeeId',
  validate(employeeIdParamSchema, 'params'),
  validate(trainingRecommendationsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;

    const preferredLang = req.query['language'] as string | undefined;
    const maxDuration = safeParseInt(req.query['max_duration'] as string, { fallback: 0 });

    const options = {
      max_courses: safeParseInt(req.query['max_courses'] as string, { fallback: 10 }),
      max_learning_paths: safeParseInt(req.query['max_learning_paths'] as string, { fallback: 3 }),
      preferred_delivery_methods: req.query['delivery_methods']
        ? (req.query['delivery_methods'] as string).split(',')
        : [],
      ...(preferredLang ? { preferred_language: preferredLang } : {}),
      ...(maxDuration !== undefined ? { max_duration_hours: maxDuration } : {}),
      include_completed: req.query['include_completed'] === 'true',
      target_skills: req.query['skills'] ? (req.query['skills'] as string).split(',') : [],
    };

    const recommendations = await trainingService.getRecommendationsForEmployee(
      tenantId,
      employeeId,
      options
    );

    res.json({
      success: true,
      data: recommendations,
    });
  })
);

/**
 * GET /training-recommendations/employees/:employeeId/preferences
 * Get employee's learning preferences based on history
 */
router.get(
  '/employees/:employeeId/preferences',
  validate(employeeIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;

    const preferences = await trainingService.getEmployeePreferences(tenantId, employeeId);

    res.json({
      success: true,
      data: preferences,
    });
  })
);

/**
 * GET /training-recommendations/courses/search
 * Search courses by skill using semantic search
 */
router.get(
  '/courses/search',
  validate(courseSearchQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const skillQuery = req.query['skill'] as string;
    const limit = safeParseInt(req.query['limit'] as string, { fallback: 10 });

    if (!skillQuery) {
      throw Errors.badRequest('skill query parameter is required');
    }

    const courses = await trainingService.searchCoursesBySkillEmbedding(
      tenantId,
      skillQuery,
      limit
    );

    res.json({
      success: true,
      data: courses,
      count: courses.length,
    });
  })
);

/**
 * GET /training-recommendations/courses/:courseId/stats
 * Get course completion statistics
 */
router.get(
  '/courses/:courseId/stats',
  validate(courseIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const courseId = req.params['courseId'] as string;

    const rates = await trainingService.getCourseCompletionRates(tenantId, [courseId]);
    const completionRate = rates.get(courseId) || 0;

    // Get additional stats
    const stats = await req.dbClient!.query(
      `
      SELECT
        COUNT(ce.id) as total_enrollments,
        COUNT(ce.id) FILTER (WHERE ce.status = 'completed') as completed,
        COUNT(ce.id) FILTER (WHERE ce.status = 'in_progress') as in_progress,
        AVG(ce.progress_percent) as avg_progress,
        AVG(ce.score) FILTER (WHERE ce.score IS NOT NULL) as avg_score,
        AVG(ce.time_spent_minutes) as avg_time_spent,
        COUNT(ce.id) FILTER (WHERE ce.passed = true) as passed,
        COUNT(ce.id) FILTER (WHERE ce.passed = false) as failed
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE ce.course_id = $1 AND c.tenant_id = $2
    `,
      [courseId, tenantId]
    );

    res.json({
      success: true,
      data: {
        course_id: courseId,
        completion_rate: completionRate,
        ...(stats.rows[0] || {}),
      },
    });
  })
);

/**
 * GET /training-recommendations/skills/:skillId/courses
 * Get courses that teach a specific skill
 */
router.get(
  '/skills/:skillId/courses',
  validate(skillIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const skillId = req.params['skillId'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        c.id, c.code, c.title, c.description, c.course_type,
        c.category, c.duration_hours, c.skill_level, c.provider,
        ces.proficiency_level_gained, ces.is_primary,
        (
          SELECT json_build_object(
            'total_enrollments', COUNT(ce.id),
            'completion_rate', COUNT(ce.id) FILTER (WHERE ce.status = 'completed')::numeric / NULLIF(COUNT(ce.id), 0)
          )
          FROM course_enrollments ce WHERE ce.course_id = c.id
        ) as stats
      FROM courses c
      JOIN course_esco_skills ces ON ces.course_id = c.id
      JOIN esco_skills es ON es.uri = ces.esco_skill_uri
      WHERE es.id = $1 AND c.tenant_id = $2 AND c.status = 'published'
      ORDER BY ces.is_primary DESC, ces.proficiency_level_gained DESC
    `,
      [skillId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * GET /training-recommendations/learning-paths
 * Get all learning paths with skill coverage
 */
router.get(
  '/learning-paths',
  validate(learningPathsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const targetRole = req.query['target_role'] as string | undefined;
    const skillLevel = req.query['skill_level'] as string | undefined;

    let query = `
      SELECT
        lp.id, lp.code, lp.title, lp.description, lp.target_role,
        lp.estimated_duration_hours, lp.skill_level, lp.path_type,
        lp.is_active, lp.is_mandatory,
        COUNT(lpc.id) as course_count,
        COUNT(DISTINCT ces.esco_skill_uri) as skills_covered,
        (
          SELECT json_agg(json_build_object(
            'course_id', c.id,
            'title', c.title,
            'sequence_order', lpc2.sequence_order
          ) ORDER BY lpc2.sequence_order)
          FROM learning_path_courses lpc2
          JOIN courses c ON c.id = lpc2.course_id
          WHERE lpc2.learning_path_id = lp.id
        ) as courses
      FROM learning_paths lp
      LEFT JOIN learning_path_courses lpc ON lpc.learning_path_id = lp.id
      LEFT JOIN course_esco_skills ces ON ces.course_id = lpc.course_id
      WHERE lp.tenant_id = $1 AND lp.is_active = true
    `;

    const params: string[] = [tenantId];
    let paramIndex = 2;

    if (targetRole) {
      query += ` AND lp.target_role ILIKE $${paramIndex}`;
      params.push(`%${escapeILIKE(targetRole)}%`);
      paramIndex++;
    }

    if (skillLevel) {
      query += ` AND lp.skill_level = $${paramIndex}`;
      params.push(skillLevel);
      paramIndex++;
    }

    query += `
      GROUP BY lp.id, lp.code, lp.title, lp.description, lp.target_role,
               lp.estimated_duration_hours, lp.skill_level, lp.path_type,
               lp.is_active, lp.is_mandatory
      ORDER BY lp.title
    `;

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * GET /training-recommendations/learning-paths/:pathId
 * Get learning path details with courses and skills
 */
router.get(
  '/learning-paths/:pathId',
  validate(pathIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const pathId = req.params['pathId'] as string;

    // Get path info
    const pathResult = await req.dbClient!.query(
      `
      SELECT
        lp.*,
        COUNT(DISTINCT lpc.course_id) as course_count,
        SUM(c.duration_hours) as total_duration_hours
      FROM learning_paths lp
      LEFT JOIN learning_path_courses lpc ON lpc.learning_path_id = lp.id
      LEFT JOIN courses c ON c.id = lpc.course_id
      WHERE lp.id = $1 AND lp.tenant_id = $2
      GROUP BY lp.id
    `,
      [pathId, tenantId]
    );

    if (pathResult.rows.length === 0) {
      throw Errors.notFound('Learning path');
    }

    // Get courses with skills
    const coursesResult = await req.dbClient!.query(
      `
      SELECT
        lpc.sequence_order,
        lpc.is_mandatory,
        lpc.unlock_after_days,
        c.id as course_id,
        c.code,
        c.title,
        c.description,
        c.course_type,
        c.duration_hours,
        c.skill_level,
        (
          SELECT json_agg(json_build_object(
            'skill_uri', ces.esco_skill_uri,
            'skill_name', ces.skill_name,
            'proficiency_gained', ces.proficiency_level_gained
          ))
          FROM course_esco_skills ces
          WHERE ces.course_id = c.id
        ) as skills_covered
      FROM learning_path_courses lpc
      JOIN courses c ON c.id = lpc.course_id
      WHERE lpc.learning_path_id = $1
      ORDER BY lpc.sequence_order
    `,
      [pathId]
    );

    res.json({
      success: true,
      data: {
        ...(pathResult.rows[0] || {}),
        courses: coursesResult.rows,
      },
    });
  })
);

/**
 * GET /training-recommendations/gap-based
 * Get training recommendations based on skill gaps (bulk)
 */
router.get(
  '/gap-based',
  validate(gapBasedQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.query['org_unit_id'] as string | undefined;
    const limit = safeParseInt(req.query['limit'] as string, { fallback: 20 });

    let query = `
      WITH expanded_gaps AS (
        -- Extract individual skill gaps from JSONB arrays
        SELECT
          sga.tenant_id,
          sga.target_entity_id as employee_id,
          gap->>'skill' as skill_name,
          (gap->>'gap')::numeric as gap_score
        FROM skill_gap_analyses sga,
        jsonb_array_elements(sga.skill_gaps) as gap
        WHERE sga.target_entity_type = 'employee'
        AND jsonb_array_length(sga.skill_gaps) > 0
      ),
      gap_courses AS (
        SELECT
          eg.skill_name,
          COUNT(DISTINCT eg.employee_id) as employees_with_gap,
          AVG(eg.gap_score) as avg_gap,
          c.id as course_id,
          c.title as course_title,
          c.duration_hours,
          ces.proficiency_level_gained
        FROM expanded_gaps eg
        JOIN employees e ON e.id = eg.employee_id
        -- Match by skill name in course_esco_skills
        JOIN course_esco_skills ces ON LOWER(ces.skill_name) ILIKE '%' || LOWER(eg.skill_name) || '%'
                                    OR LOWER(eg.skill_name) ILIKE '%' || LOWER(ces.skill_name) || '%'
        JOIN courses c ON c.id = ces.course_id
        WHERE eg.tenant_id = $1 AND c.status = 'published'
    `;

    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (orgUnitId) {
      query += ` AND e.org_unit_id = $${paramIndex}`;
      params.push(orgUnitId);
      paramIndex++;
    }

    query += `
        GROUP BY eg.skill_name, c.id, c.title, c.duration_hours, ces.proficiency_level_gained
      )
      SELECT
        skill_name,
        employees_with_gap,
        avg_gap,
        json_agg(json_build_object(
          'course_id', course_id,
          'course_title', course_title,
          'duration_hours', duration_hours,
          'proficiency_gained', proficiency_level_gained
        ) ORDER BY proficiency_level_gained DESC) as recommended_courses
      FROM gap_courses
      GROUP BY skill_name, employees_with_gap, avg_gap
      ORDER BY employees_with_gap DESC, avg_gap DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

export default router;
