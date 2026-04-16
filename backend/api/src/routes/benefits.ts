/**
 * Benefits Routes
 * CRUD operations for employee benefits
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createBenefitSchema, updateBenefitSchema } from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { cachedForTenant, CACHE_TTL } from '../services/cache.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

// =============================================================================
// LIST ENDPOINT
// =============================================================================

/**
 * GET /benefits
 * List available benefits with pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const activeOnly = req.query.active !== 'false';

    const whereClause = activeOnly ? 'AND eb.is_active = true' : '';

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(
        `SELECT COUNT(*) as total FROM employee_benefits eb WHERE eb.tenant_id = $1 ${whereClause}`,
        [tenantId]
      ),
      req.dbClient!.query(
        `SELECT eb.id, eb.benefit_name, eb.benefit_type, eb.description,
                eb.monthly_cost, eb.coverage_options, eb.is_active, eb.created_at
         FROM employee_benefits eb
         WHERE eb.tenant_id = $1 ${whereClause}
         ORDER BY eb.benefit_name
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
  })
);

// =============================================================================
// EMPLOYEE SELF-SERVICE ENDPOINTS (must be before parametric routes)
// =============================================================================

/**
 * GET /benefits/me
 * Get current employee's benefit enrollments
 */
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const result = await req.dbClient!.query(
      `
      SELECT
        ebe.id as enrollment_id,
        ebe.coverage_level,
        ebe.enrolled_at,
        ebe.effective_date,
        ebe.is_active,
        eb.id as benefit_id,
        eb.benefit_name,
        eb.benefit_type,
        eb.description,
        eb.monthly_cost,
        eb.coverage_options
      FROM employee_benefit_enrollments ebe
      JOIN employee_benefits eb ON ebe.benefit_id = eb.id
      JOIN employees e ON ebe.employee_id = e.id
      WHERE ebe.employee_id = $1 AND e.tenant_id = $2
      ORDER BY ebe.is_active DESC, eb.benefit_type, eb.benefit_name
    `,
      [employeeId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rows.length,
        active: result.rows.filter((r: { is_active: boolean }) => r.is_active).length,
      },
    });
  })
);

/**
 * GET /benefits/me/summary
 * Get current employee's benefit summary with total costs
 */
router.get(
  '/me/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE ebe.is_active = true) as active_benefits,
        COUNT(*) as total_enrollments,
        COALESCE(SUM(eb.monthly_cost) FILTER (WHERE ebe.is_active = true), 0) as total_monthly_cost,
        COALESCE(SUM(eb.monthly_cost) FILTER (WHERE ebe.is_active = true), 0) * 12 as total_annual_cost
      FROM employee_benefit_enrollments ebe
      JOIN employee_benefits eb ON ebe.benefit_id = eb.id
      JOIN employees e ON ebe.employee_id = e.id
      WHERE ebe.employee_id = $1 AND e.tenant_id = $2
    `,
      [employeeId, tenantId]
    );

    // Get by type breakdown
    const byType = await req.dbClient!.query(
      `
      SELECT
        eb.benefit_type,
        COUNT(*) as count,
        SUM(eb.monthly_cost) as monthly_cost
      FROM employee_benefit_enrollments ebe
      JOIN employee_benefits eb ON ebe.benefit_id = eb.id
      JOIN employees e ON ebe.employee_id = e.id
      WHERE ebe.employee_id = $1 AND e.tenant_id = $2 AND ebe.is_active = true
      GROUP BY eb.benefit_type
      ORDER BY eb.benefit_type
    `,
      [employeeId, tenantId]
    );

    res.json({
      success: true,
      data: {
        summary: result.rows[0],
        byType: byType.rows,
      },
    });
  })
);

/**
 * GET /benefits/available
 * Get benefits available for enrollment (for current employee)
 */
router.get(
  '/available',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    // Get benefits that employee is NOT already enrolled in
    const result = await req.dbClient!.query(
      `
      SELECT
        eb.*
      FROM employee_benefits eb
      WHERE eb.tenant_id = $1
      AND eb.is_active = true
      AND eb.id NOT IN (
        SELECT benefit_id FROM employee_benefit_enrollments
        WHERE employee_id = $2 AND is_active = true
      )
      ORDER BY eb.benefit_type, eb.benefit_name
    `,
      [tenantId, employeeId]
    );

    res.json({ success: true, data: result.rows });
  })
);

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /benefits/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_benefits,
        COUNT(*) FILTER (WHERE is_active = true) as active_benefits,
        COUNT(DISTINCT benefit_type) as benefit_types,
        SUM(monthly_cost) as total_monthly_cost
      FROM employee_benefits WHERE tenant_id = $1
    `,
      [tenantId]
    );

    // Get enrollment stats
    const enrollmentStats = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(*) FILTER (WHERE ebe.is_active = true) as active_enrollments
      FROM employee_benefit_enrollments ebe
      JOIN employees e ON ebe.employee_id = e.id
      WHERE e.tenant_id = $1
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        ...(enrollmentStats.rows[0] || {}),
      },
    });
  })
);

/**
 * GET /benefits
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      benefit_type,
      is_active,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 100 });
    const offsetNum = safeParseInt(offset as string, { fallback: 0 });
    const hasFilters = benefit_type || is_active !== undefined;

    const fetchData = async () => {
      let query = `
        SELECT eb.*,
          (SELECT COUNT(*) FROM employee_benefit_enrollments ebe WHERE ebe.benefit_id = eb.id AND ebe.is_active = true) as enrollment_count
        FROM employee_benefits eb
        WHERE eb.tenant_id = $1
      `;
      const params: (string | boolean | number)[] = [tenantId];
      let paramIndex = 2;

      if (benefit_type) {
        query += ` AND eb.benefit_type = $${paramIndex}`;
        params.push(benefit_type as string);
        paramIndex++;
      }

      if (is_active !== undefined) {
        query += ` AND eb.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      query += ` ORDER BY eb.benefit_type, eb.benefit_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offsetNum);

      const result = await req.dbClient!.query(query, params);
      const countResult = await req.dbClient!.query(
        'SELECT COUNT(*) FROM employee_benefits WHERE tenant_id = $1',
        [tenantId]
      );

      return {
        rows: result.rows,
        total: parseInt(countResult.rows[0]?.count),
      };
    };

    const data = hasFilters
      ? await fetchData()
      : await cachedForTenant(
          tenantId,
          `benefits:list:${limitNum}:${offsetNum}`,
          fetchData,
          CACHE_TTL.MODERATE
        );

    res.json({
      success: true,
      data: data.rows,
      meta: {
        total: data.total,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  })
);

/**
 * GET /benefits/types
 */
router.get(
  '/types',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT DISTINCT benefit_type, COUNT(*) as count
      FROM employee_benefits
      WHERE tenant_id = $1 AND is_active = true
      GROUP BY benefit_type
      ORDER BY benefit_type
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /benefits/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT eb.*,
        (SELECT COUNT(*) FROM employee_benefit_enrollments ebe WHERE ebe.benefit_id = eb.id AND ebe.is_active = true) as active_enrollments,
        (SELECT COUNT(*) FROM employee_benefit_enrollments ebe WHERE ebe.benefit_id = eb.id) as total_enrollments
      FROM employee_benefits eb
      WHERE eb.id = $1 AND eb.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Benefit');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /benefits/:id/enrollments
 */
router.get(
  '/:id/enrollments',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT ebe.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email
      FROM employee_benefit_enrollments ebe
      JOIN employees e ON ebe.employee_id = e.id
      WHERE ebe.benefit_id = $1 AND e.tenant_id = $2
      ORDER BY ebe.enrolled_at DESC
    `,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /benefits
 */
router.post(
  '/',
  requirePermission('COMPENSATION', 'CREATE'),
  validate(createBenefitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      benefit_name,
      benefit_type,
      description,
      monthly_cost,
      coverage_options,
      is_active = true,
    } = req.body;

    if (!benefit_name || !benefit_type) {
      throw Errors.badRequest('benefit_name and benefit_type are required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO employee_benefits (tenant_id, benefit_name, benefit_type, description, monthly_cost,
        coverage_options, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `,
      [tenantId, benefit_name, benefit_type, description, monthly_cost, coverage_options, is_active]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Benefit created' });
  })
);

/**
 * PATCH /benefits/:id
 */
router.patch(
  '/:id',
  requirePermission('COMPENSATION', 'EDIT'),
  validate(updateBenefitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM employee_benefits WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Benefit');
    }

    const allowedFields = [
      'benefit_name',
      'benefit_type',
      'description',
      'monthly_cost',
      'coverage_options',
      'is_active',
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

    const result = await req.dbClient!.query(
      `UPDATE employee_benefits SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Benefit updated' });
  })
);

/**
 * DELETE /benefits/:id
 */
router.delete(
  '/:id',
  requirePermission('COMPENSATION', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Check for active enrollments
    const activeEnrollments = await req.dbClient!.query(
      'SELECT COUNT(*) FROM employee_benefit_enrollments WHERE benefit_id = $1 AND is_active = true',
      [id]
    );
    if (parseInt(activeEnrollments.rows[0].count) > 0) {
      throw Errors.badRequest('Cannot deactivate benefit with active enrollments');
    }

    const result = await req.dbClient!.query(
      'UPDATE employee_benefits SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Benefit');
    }

    res.json({ success: true, message: 'Benefit deactivated' });
  })
);

export default router;
