/**
 * Skill Assessments Routes
 * Employee skill assessment management
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import {
  createSkillAssessmentSchema,
  updateSkillAssessmentSchema,
} from '../schemas/skills-assessment.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /skill-assessments/stats
 * Get assessment statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const stats = await req.dbClient!.query(
      `
    SELECT
      COUNT(*) as total_assessments,
      COUNT(DISTINCT esa.employee_id) as employees_assessed,
      COUNT(DISTINCT esa.skill_name) as unique_skills,
      ROUND(AVG(esa.assessed_level)::numeric, 2) as avg_level,
      COUNT(*) FILTER (WHERE esa.gap > 0) as with_gaps,
      ROUND(AVG(CASE WHEN esa.gap > 0 THEN esa.gap END)::numeric, 2) as avg_gap
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1
  `,
      [tenantId]
    );

    // Method distribution
    const methodDist = await req.dbClient!.query(
      `
    SELECT
      assessment_method,
      COUNT(*) as count
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1
    GROUP BY assessment_method
    ORDER BY count DESC
  `,
      [tenantId]
    );

    // Level distribution
    const levelDist = await req.dbClient!.query(
      `
    SELECT
      assessed_level,
      COUNT(*) as count
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1
    GROUP BY assessed_level
    ORDER BY assessed_level
  `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(stats.rows[0] || {}),
        by_method: methodDist.rows,
        by_level: levelDist.rows,
      },
    });
  })
);

/**
 * GET /skill-assessments
 * List all assessments with filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      skill_name,
      method,
      has_gap,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
    SELECT
      esa.id,
      esa.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      e.job_title,
      esa.skill_name,
      esa.esco_skill_uri,
      esa.assessed_level,
      esa.required_level,
      esa.gap,
      esa.assessment_date,
      esa.assessment_method,
      esa.evidence_notes,
      esa.certification_url,
      esa.created_at
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1
  `;
    const params: (string | number | boolean)[] = [tenantId];
    let paramIndex = 2;

    if (employee_id) {
      query += ` AND esa.employee_id = $${paramIndex++}`;
      params.push(employee_id as string);
    }
    if (skill_name) {
      query += ` AND esa.skill_name ILIKE $${paramIndex++}`;
      params.push(`%${escapeILIKE(skill_name as string)}%`);
    }
    if (method) {
      query += ` AND esa.assessment_method = $${paramIndex++}`;
      params.push(method as string);
    }
    if (has_gap === 'true') {
      query += ` AND esa.gap > 0`;
    }

    query += ` ORDER BY esa.assessment_date DESC, esa.skill_name LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Get count
    let countQuery = `
    SELECT COUNT(*) FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1
  `;
    const countParams: (string | number | boolean)[] = [tenantId];
    let countIndex = 2;

    if (employee_id) {
      countQuery += ` AND esa.employee_id = $${countIndex++}`;
      countParams.push(employee_id as string);
    }
    if (skill_name) {
      countQuery += ` AND esa.skill_name ILIKE $${countIndex++}`;
      countParams.push(`%${escapeILIKE(skill_name as string)}%`);
    }
    if (method) {
      countQuery += ` AND esa.assessment_method = $${countIndex++}`;
      countParams.push(method as string);
    }
    if (has_gap === 'true') {
      countQuery += ` AND esa.gap > 0`;
    }

    const countResult = await req.dbClient!.query(countQuery, countParams);

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
 * GET /skill-assessments/employee/:employeeId
 * Get all assessments for an employee
 */
router.get(
  '/employee/:employeeId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'] as string;

    // Verify employee belongs to tenant
    const empCheck = await req.dbClient!.query(
      'SELECT id, first_name, last_name, job_title FROM employees WHERE id = $1 AND tenant_id = $2',
      [employeeId, tenantId]
    );

    if (empCheck.rows.length === 0) {
      throw Errors.notFound('Employee', employeeId);
    }

    const result = await req.dbClient!.query(
      `
    SELECT
      esa.*,
      assessor.first_name || ' ' || assessor.last_name as assessor_name
    FROM employee_skill_assessments esa
    LEFT JOIN employees assessor ON assessor.id = esa.assessed_by
    WHERE esa.employee_id = $1
    ORDER BY esa.skill_name, esa.assessment_date DESC
  `,
      [employeeId]
    );

    // Get summary stats
    const summary = await req.dbClient!.query(
      `
    SELECT
      COUNT(*) as total_skills,
      ROUND(AVG(assessed_level)::numeric, 2) as avg_level,
      COUNT(*) FILTER (WHERE gap > 0) as skills_with_gaps,
      SUM(gap) FILTER (WHERE gap > 0) as total_gap
    FROM employee_skill_assessments
    WHERE employee_id = $1
  `,
      [employeeId]
    );

    res.json({
      success: true,
      data: {
        employee: empCheck.rows[0],
        assessments: result.rows,
        summary: summary.rows[0],
      },
    });
  })
);

/**
 * GET /skill-assessments/gaps
 * Get all assessments with skill gaps
 */
router.get(
  '/gaps',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { min_gap = '1', limit = '50' } = req.query as Record<string, string>;

    const result = await req.dbClient!.query(
      `
    SELECT
      esa.id,
      esa.employee_id,
      e.first_name || ' ' || e.last_name as employee_name,
      e.job_title,
      d.name as department,
      esa.skill_name,
      esa.assessed_level,
      esa.required_level,
      esa.gap,
      esa.assessment_date
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    LEFT JOIN org_units d ON d.id = e.org_unit_id
    WHERE e.tenant_id = $1 AND esa.gap >= $2
    ORDER BY esa.gap DESC, esa.skill_name
    LIMIT $3
  `,
      [
        tenantId,
        safeParseInt(min_gap as string, { fallback: 0 }),
        safeParseInt(limit as string, { fallback: 50 }),
      ]
    );

    // Get gap distribution
    const gapDist = await req.dbClient!.query(
      `
    SELECT
      gap,
      COUNT(*) as count
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1 AND esa.gap > 0
    GROUP BY gap
    ORDER BY gap
  `,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      gap_distribution: gapDist.rows,
    });
  })
);

/**
 * GET /skill-assessments/:id
 * Get single assessment detail
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    SELECT
      esa.*,
      e.first_name || ' ' || e.last_name as employee_name,
      e.job_title,
      assessor.first_name || ' ' || assessor.last_name as assessor_name
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    LEFT JOIN employees assessor ON assessor.id = esa.assessed_by
    WHERE esa.id = $1 AND e.tenant_id = $2
  `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Assessment', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /skill-assessments
 * Create new assessment
 */
router.post(
  '/',
  validate(createSkillAssessmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      skill_name,
      esco_skill_uri,
      assessed_level,
      required_level,
      assessment_date,
      assessment_method,
      assessed_by,
      evidence_notes,
      certification_url,
    } = req.body;

    if (!employee_id || !skill_name || !assessed_level) {
      throw Errors.badRequest('employee_id, skill_name, and assessed_level are required');
    }

    // Verify employee belongs to tenant
    const empCheck = await req.dbClient!.query(
      'SELECT id FROM employees WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );

    if (empCheck.rows.length === 0) {
      throw Errors.notFound('Employee', employee_id);
    }

    const result = await req.dbClient!.query(
      `
    INSERT INTO employee_skill_assessments (
      employee_id, skill_name, esco_skill_uri, assessed_level, required_level,
      assessment_date, assessment_method, assessed_by, evidence_notes, certification_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `,
      [
        employee_id,
        skill_name,
        esco_skill_uri,
        assessed_level,
        required_level,
        assessment_date || new Date(),
        assessment_method,
        assessed_by,
        evidence_notes,
        certification_url,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Assessment created' });
  })
);

/**
 * PATCH /skill-assessments/:id
 * Update assessment
 */
router.patch(
  '/:id',
  validate(updateSkillAssessmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Verify assessment belongs to tenant employee
    const existing = await req.dbClient!.query(
      `
    SELECT esa.id FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE esa.id = $1 AND e.tenant_id = $2
  `,
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw Errors.notFound('Assessment', id);
    }

    const allowedFields = [
      'assessed_level',
      'required_level',
      'assessment_method',
      'evidence_notes',
      'certification_url',
    ];
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
      `UPDATE employee_skill_assessments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...values, id]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Assessment updated' });
  })
);

/**
 * DELETE /skill-assessments/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    DELETE FROM employee_skill_assessments esa
    USING employees e
    WHERE esa.employee_id = e.id
    AND esa.id = $1 AND e.tenant_id = $2
    RETURNING esa.id
  `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Assessment', id);
    }

    res.json({ success: true, message: 'Assessment deleted' });
  })
);

/**
 * GET /skill-assessments/skills/summary
 * Get summary by skill across all employees
 */
router.get(
  '/skills/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
    SELECT
      esa.skill_name,
      COUNT(DISTINCT esa.employee_id) as employees_with_skill,
      ROUND(AVG(esa.assessed_level)::numeric, 2) as avg_level,
      MIN(esa.assessed_level) as min_level,
      MAX(esa.assessed_level) as max_level,
      COUNT(*) FILTER (WHERE esa.gap > 0) as with_gaps,
      ROUND(AVG(CASE WHEN esa.gap > 0 THEN esa.gap END)::numeric, 2) as avg_gap
    FROM employee_skill_assessments esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.tenant_id = $1
    GROUP BY esa.skill_name
    ORDER BY employees_with_skill DESC
    LIMIT 50
  `,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

export default router;
