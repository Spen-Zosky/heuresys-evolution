/**
 * Career Paths Routes
 * Career development paths and levels
 * Extended with Career Path Engine - Sprint 2025-04 S-ONTO-03-07
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { CareerPathService } from '../services/career-path/index.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import {
  createCareerPathSchema,
  updateCareerPathSchema,
  addLevelSkillSchema,
  simulateCareerPathSchema,
  enrollCareerPathSchema,
  updateCareerProgressSchema,
} from '../schemas/talent.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();
const careerPathService = new CareerPathService(pool);

router.use(requireTenant);

/**
 * GET /career-paths/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(DISTINCT department) as departments
      FROM career_paths WHERE tenant_id = $1
    `,
      [tenantId]
    );

    // Get path types breakdown
    const pathTypes = await req.dbClient!.query(
      `
      SELECT path_type, COUNT(*) as count
      FROM career_paths
      WHERE tenant_id = $1
      GROUP BY path_type
      ORDER BY count DESC
    `,
      [tenantId]
    );

    // Get employee assignments
    const assignments = await req.dbClient!.query(
      `
      SELECT COUNT(*) as employees_assigned
      FROM employee_career_paths ecp
      JOIN career_paths cp ON ecp.path_id = cp.id
      WHERE cp.tenant_id = $1
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        path_types: pathTypes.rows,
        employees_assigned: assignments.rows[0]?.employees_assigned || 0,
      },
    });
  })
);

/**
 * GET /career-paths
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      department,
      path_type,
      is_active,
      search,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT cp.*,
        e.first_name || ' ' || e.last_name as created_by_name,
        (SELECT COUNT(*) FROM career_path_levels cpl WHERE cpl.path_id = cp.id) as level_count
      FROM career_paths cp
      LEFT JOIN employees e ON cp.created_by_employee_id = e.id
      WHERE cp.tenant_id = $1
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (department) {
      query += ` AND cp.department = $${paramIndex}`;
      params.push(department as string);
      paramIndex++;
    }

    if (path_type) {
      query += ` AND cp.path_type = $${paramIndex}`;
      params.push(path_type as string);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND cp.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (search) {
      query += ` AND (cp.name ILIKE $${paramIndex} OR cp.description ILIKE $${paramIndex})`;
      params.push(`%${escapeILIKE(search as string)}%`);
      paramIndex++;
    }

    query += ` ORDER BY cp.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM career_paths WHERE tenant_id = $1',
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.count),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * GET /career-paths/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT cp.*,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM career_paths cp
      LEFT JOIN employees e ON cp.created_by_employee_id = e.id
      WHERE cp.id = $1 AND cp.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Career path');
    }

    // Get levels
    const levels = await req.dbClient!.query(
      `
      SELECT id, path_id, title, description, level_order, min_years_experience,
        required_skills, required_certifications, salary_band_min, salary_band_max,
        created_at, target_job_id, typical_duration_months, skill_gap_threshold
      FROM career_path_levels
      WHERE path_id = $1
      ORDER BY level_order
    `,
      [id]
    );

    // Get employees on this path
    const employees = await req.dbClient!.query(
      `
      SELECT ecp.*, e.first_name || ' ' || e.last_name as employee_name
      FROM employee_career_paths ecp
      JOIN employees e ON ecp.employee_id = e.id
      WHERE ecp.path_id = $1
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        levels: levels.rows,
        employees: employees.rows,
      },
    });
  })
);

/**
 * POST /career-paths
 */
router.post(
  '/',
  validate(createCareerPathSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      description,
      department,
      path_type = 'linear',
      is_active = true,
      created_by_employee_id,
    } = req.body;

    if (!name) {
      throw Errors.badRequest('Name is required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO career_paths (tenant_id, name, description, department, path_type, is_active,
        created_by_employee_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `,
      [tenantId, name, description, department, path_type, is_active, created_by_employee_id]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Career path created' });
  })
);

/**
 * PATCH /career-paths/:id
 */
router.patch(
  '/:id',
  validate(updateCareerPathSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM career_paths WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Career path');
    }

    const allowedFields = ['name', 'description', 'department', 'path_type', 'is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE career_paths SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Career path updated' });
  })
);

/**
 * DELETE /career-paths/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM career_paths WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Career path');
    }

    res.json({ success: true, message: 'Career path deleted' });
  })
);

// ============================================================================
// CAREER PATH ENGINE ENDPOINTS - S-ONTO-03-07
// ============================================================================

/**
 * GET /career-paths/:id/levels
 * Get career path levels with skill requirements
 */
router.get(
  '/:id/levels',
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req); // Verify tenant access
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        cpl.id,
        cpl.title,
        cpl.level_order,
        cpl.description,
        cpl.typical_duration_months,
        cpl.skill_gap_threshold,
        cpl.target_job_id,
        tj.title as target_job_title,
        (
          SELECT json_agg(json_build_object(
            'skill_id', cls.skill_id,
            'skill_name', es.preferred_label,
            'importance', cls.importance,
            'is_mandatory', cls.is_mandatory,
            'weight', cls.weight,
            'required_knowledge_level', cls.required_knowledge_level,
            'required_skill_level', cls.required_skill_level,
            'required_ability_level', cls.required_ability_level,
            'required_behavior_level', cls.required_behavior_level,
            'required_attitude_level', cls.required_attitude_level,
            'min_composite_score', cls.min_composite_score
          ) ORDER BY cls.importance, cls.weight DESC)
          FROM career_path_level_skills cls
          JOIN esco_skills es ON cls.skill_id = es.id
          WHERE cls.level_id = cpl.id
        ) as skill_requirements
      FROM career_path_levels cpl
      LEFT JOIN tenant_jobs tj ON cpl.target_job_id = tj.id
      WHERE cpl.path_id = $1
      ORDER BY cpl.level_order
    `,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * POST /career-paths/:id/levels/:levelId/skills
 * Add skill requirements to a career path level
 */
router.post(
  '/:id/levels/:levelId/skills',
  validate(addLevelSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { levelId } = req.params as Record<string, string>;
    const {
      skill_id,
      importance = 'important',
      is_mandatory = false,
      weight = 1.0,
      required_knowledge_level,
      required_skill_level,
      required_ability_level,
      required_behavior_level,
      required_attitude_level,
      min_composite_score,
      notes,
    } = req.body;

    if (!skill_id) {
      throw Errors.badRequest('skill_id is required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO career_path_level_skills (
        tenant_id, level_id, skill_id, importance, is_mandatory, weight,
        required_knowledge_level, required_skill_level, required_ability_level,
        required_behavior_level, required_attitude_level, min_composite_score, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (level_id, skill_id) DO UPDATE SET
        importance = EXCLUDED.importance,
        is_mandatory = EXCLUDED.is_mandatory,
        weight = EXCLUDED.weight,
        required_knowledge_level = EXCLUDED.required_knowledge_level,
        required_skill_level = EXCLUDED.required_skill_level,
        required_ability_level = EXCLUDED.required_ability_level,
        required_behavior_level = EXCLUDED.required_behavior_level,
        required_attitude_level = EXCLUDED.required_attitude_level,
        min_composite_score = EXCLUDED.min_composite_score,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `,
      [
        tenantId,
        levelId,
        skill_id,
        importance,
        is_mandatory,
        weight,
        required_knowledge_level,
        required_skill_level,
        required_ability_level,
        required_behavior_level,
        required_attitude_level,
        min_composite_score,
        notes,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /career-paths/simulate
 * Simulate career path for employee
 */
router.post(
  '/simulate',
  validate(simulateCareerPathSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, target_path_id, target_level_id, target_job_id, simulation_name } =
      req.body;

    if (!employee_id) {
      throw Errors.badRequest('employee_id is required');
    }

    if (!target_path_id && !target_job_id) {
      res
        .status(400)
        .json({ success: false, error: 'Either target_path_id or target_job_id is required' });
      return;
    }

    const simulation = await careerPathService.simulateCareerPath(tenantId, {
      employeeId: employee_id,
      targetPathId: target_path_id,
      targetLevelId: target_level_id,
      targetJobId: target_job_id,
      simulationName: simulation_name,
    });

    res.status(201).json({ success: true, data: simulation });
  })
);

/**
 * GET /career-paths/simulations/:id
 * Get simulation details
 */
router.get(
  '/simulations/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        cs.*,
        e.first_name || ' ' || e.last_name as employee_name,
        tj.title as target_job_title,
        cp.name as target_path_name,
        cpl.title as target_level_title
      FROM career_simulations cs
      JOIN employees e ON cs.employee_id = e.id
      LEFT JOIN tenant_jobs tj ON cs.target_job_id = tj.id
      LEFT JOIN career_paths cp ON cs.target_path_id = cp.id
      LEFT JOIN career_path_levels cpl ON cs.target_level_id = cpl.id
      WHERE cs.id = $1 AND cs.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Simulation');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /career-paths/recommendations/:employeeId
 * Get career path recommendations for employee
 */
router.get(
  '/recommendations/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;
    const { refresh } = req.query as Record<string, string>;

    const recommendations = await careerPathService.getRecommendationsForEmployee(
      tenantId,
      employeeId,
      refresh === 'true'
    );

    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
    });
  })
);

/**
 * GET /career-paths/reachable-roles/:employeeId
 * Get reachable roles for employee based on current skills
 */
router.get(
  '/reachable-roles/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;
    const { max_gap_threshold } = req.query as Record<string, string>;

    const roles = await careerPathService.getReachableRoles(
      tenantId,
      employeeId,
      max_gap_threshold ? parseFloat(max_gap_threshold as string) : undefined
    );

    res.json({
      success: true,
      data: roles,
      count: roles.length,
    });
  })
);

/**
 * GET /career-paths/progress/:employeeId
 * Get employee's career progress across all enrolled paths
 */
router.get(
  '/progress/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employeeId } = req.params as Record<string, string>;

    const result = await req.dbClient!.query(
      `
      SELECT
        ecp.id as enrollment_id,
        ecp.path_id,
        cp.name as path_name,
        cp.path_type,
        ecp.current_level_id,
        cpl.title as current_level_title,
        cpl.level_order as current_level_order,
        ecp.status as enrollment_status,
        ecp.started_at,
        prog.overall_fit_score,
        prog.skill_coverage_pct,
        prog.avg_skill_gap,
        prog.critical_gaps_count,
        prog.estimated_months_to_ready,
        prog.status as level_status,
        prog.started_at as level_started_at,
        prog.last_analyzed_at,
        (SELECT COUNT(*) FROM career_path_levels WHERE path_id = cp.id) as total_levels,
        (
          SELECT json_agg(json_build_object(
            'level_id', l.id,
            'title', l.title,
            'level_order', l.level_order,
            'status', COALESCE(p.status, 'not_started'),
            'fit_score', p.overall_fit_score
          ) ORDER BY l.level_order)
          FROM career_path_levels l
          LEFT JOIN employee_career_progress p ON p.level_id = l.id AND p.employee_id = ecp.employee_id
          WHERE l.path_id = cp.id
        ) as levels_progress
      FROM employee_career_paths ecp
      JOIN career_paths cp ON ecp.path_id = cp.id
      LEFT JOIN career_path_levels cpl ON ecp.current_level_id = cpl.id
      LEFT JOIN employee_career_progress prog ON prog.employee_id = ecp.employee_id AND prog.level_id = ecp.current_level_id
      WHERE ecp.employee_id = $1 AND cp.tenant_id = $2
      ORDER BY ecp.started_at DESC
    `,
      [employeeId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

/**
 * POST /career-paths/:pathId/enroll/:employeeId
 * Enroll employee in a career path
 */
router.post(
  '/:pathId/enroll/:employeeId',
  validate(enrollCareerPathSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employeeId, pathId } = req.params as Record<string, string>;
    const { starting_level_id } = req.body;

    // Get first level if not specified
    let levelId = starting_level_id;
    if (!levelId) {
      const levelResult = await req.dbClient!.query(
        `
        SELECT id FROM career_path_levels
        WHERE path_id = $1
        ORDER BY level_order
        LIMIT 1
      `,
        [pathId]
      );

      if (levelResult.rows.length > 0) {
        levelId = levelResult.rows[0]?.id;
      }
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO employee_career_paths (
        employee_id, path_id, current_level_id, status, started_at
      ) VALUES ($1, $2, $3, 'active', NOW())
      ON CONFLICT (employee_id, path_id) DO UPDATE SET
        current_level_id = EXCLUDED.current_level_id,
        status = 'active',
        updated_at = NOW()
      RETURNING *
    `,
      [employeeId, pathId, levelId]
    );

    // Initialize progress for first level
    if (levelId) {
      await req.dbClient!.query(
        `
        INSERT INTO employee_career_progress (
          tenant_id, employee_id, path_id, level_id, status, started_at
        ) VALUES ($1, $2, $3, $4, 'in_progress', NOW())
        ON CONFLICT (employee_id, level_id) DO NOTHING
      `,
        [tenantId, employeeId, pathId, levelId]
      );
    }

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Successfully enrolled in career path',
    });
  })
);

/**
 * PUT /career-paths/progress/:employeeId/:levelId
 * Update employee's progress on a career level
 */
router.put(
  '/progress/:employeeId/:levelId',
  validate(updateCareerProgressSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;
    const levelId = req.params['levelId'] as string;
    const { status } = req.body;

    const updateFields: string[] = [];
    const values: (string | number)[] = [employeeId, levelId, tenantId];
    let paramIndex = 4;

    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(status);

      if (status === 'completed') {
        updateFields.push(`completed_at = NOW()`);
      } else if (status === 'in_progress') {
        updateFields.push(`started_at = COALESCE(started_at, NOW())`);
      }
    }

    if (updateFields.length === 0) {
      throw Errors.badRequest('No update fields provided');
    }

    updateFields.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `
      UPDATE employee_career_progress
      SET ${updateFields.join(', ')}
      WHERE employee_id = $1 AND level_id = $2 AND tenant_id = $3
      RETURNING *
    `,
      values
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Progress record');
    }

    // If completed, advance to next level
    if (status === 'completed') {
      const nextLevel = await req.dbClient!.query(
        `
        SELECT cpl.id, cpl.path_id
        FROM career_path_levels cpl
        JOIN career_path_levels current ON current.id = $1
        WHERE cpl.path_id = current.path_id
          AND cpl.level_order > current.level_order
        ORDER BY cpl.level_order
        LIMIT 1
      `,
        [levelId]
      );

      if (nextLevel.rows.length > 0) {
        // Update current level in enrollment
        await req.dbClient!.query(
          `
          UPDATE employee_career_paths
          SET current_level_id = $1, updated_at = NOW()
          WHERE employee_id = $2 AND path_id = $3
        `,
          [nextLevel.rows[0]?.id, employeeId, nextLevel.rows[0]?.path_id]
        );

        // Initialize next level progress
        await req.dbClient!.query(
          `
          INSERT INTO employee_career_progress (
            tenant_id, employee_id, path_id, level_id, status, started_at
          ) VALUES ($1, $2, $3, $4, 'in_progress', NOW())
          ON CONFLICT (employee_id, level_id) DO NOTHING
        `,
          [tenantId, employeeId, nextLevel.rows[0]?.path_id, nextLevel.rows[0]?.id]
        );
      }
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /career-paths/fit-score/:employeeId/:pathId
 * Calculate fit score for employee on a specific path
 */
router.get(
  '/fit-score/:employeeId/:pathId',
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req); // Verify tenant access
    const { employeeId, pathId } = req.params as Record<string, string>;

    // Use DB function
    const result = await req.dbClient!.query(
      `
      SELECT fn_calculate_path_fit_score($1, $2) as fit_score
    `,
      [employeeId, pathId]
    );

    // Get detailed breakdown
    const levelsResult = await req.dbClient!.query(
      `
      SELECT
        cpl.id as level_id,
        cpl.title,
        cpl.level_order,
        fn_calculate_skill_distance($1, cpl.id) as skill_distance,
        1 - (fn_calculate_skill_distance($1, cpl.id) / 5) as fit_score
      FROM career_path_levels cpl
      WHERE cpl.path_id = $2
      ORDER BY cpl.level_order
    `,
      [employeeId, pathId]
    );

    res.json({
      success: true,
      data: {
        overall_fit_score: result.rows[0]?.fit_score || 0,
        levels: levelsResult.rows,
      },
    });
  })
);

export default router;
