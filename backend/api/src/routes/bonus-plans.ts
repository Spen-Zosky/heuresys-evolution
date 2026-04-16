/**
 * Bonus Plans Routes
 * CRUD operations for bonus plans and allocations
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createBonusPlanSchema, updateBonusPlanSchema } from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /bonus-plans/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        SUM(total_budget) as total_budget,
        SUM(allocated_amount) as total_allocated
      FROM bonus_plans WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /bonus-plans/active
 */
router.get(
  '/active',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT bp.*,
        (SELECT COUNT(*) FROM bonus_allocations ba WHERE ba.plan_id = bp.id) as allocation_count
      FROM bonus_plans bp
      WHERE bp.tenant_id = $1 AND bp.status = 'active'
      ORDER BY bp.period_end ASC
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /bonus-plans
 */
router.get(
  '/',
  requirePermission('COMPENSATION', 'VIEW'),
  applyScopeFilter('COMPENSATION'),
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req);
    const { status, bonus_type, limit = '100', offset = '0' } = req.query as Record<string, string>;

    const scope = getScopeCondition(req, 'bp');
    let query = `
      SELECT bp.*,
        (SELECT COUNT(*) FROM bonus_allocations ba WHERE ba.plan_id = bp.id) as allocation_count,
        (SELECT SUM(actual_amount) FROM bonus_allocations ba WHERE ba.plan_id = bp.id) as total_allocations
      FROM bonus_plans bp
      WHERE ${scope.where}
    `;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (status) {
      query += ` AND bp.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (bonus_type) {
      query += ` AND bp.bonus_type = $${paramIndex}`;
      params.push(bonus_type as string);
      paramIndex++;
    }

    query += ` ORDER BY bp.period_start DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM bonus_plans bp WHERE ${scope.where}`,
      scope.params
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
 * GET /bonus-plans/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT bp.*,
        (SELECT COUNT(*) FROM bonus_allocations ba WHERE ba.plan_id = bp.id) as allocation_count,
        (SELECT SUM(actual_amount) FROM bonus_allocations ba WHERE ba.plan_id = bp.id) as total_allocations
      FROM bonus_plans bp
      WHERE bp.id = $1 AND bp.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Bonus plan');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /bonus-plans/:id/allocations
 */
router.get(
  '/:id/allocations',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT ba.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email
      FROM bonus_allocations ba
      JOIN employees e ON ba.employee_id = e.id
      WHERE ba.plan_id = $1 AND e.tenant_id = $2
      ORDER BY ba.actual_amount DESC NULLS LAST
    `,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /bonus-plans
 */
router.post(
  '/',
  requirePermission('COMPENSATION', 'CREATE'),
  validate(createBonusPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      description,
      bonus_type,
      period_start,
      period_end,
      payout_date,
      total_budget,
      calculation_method,
      eligibility_rules,
      performance_multipliers,
      created_by,
    } = req.body;

    if (!name || !bonus_type) {
      throw Errors.badRequest('name and bonus_type are required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO bonus_plans (tenant_id, name, description, bonus_type, period_start, period_end,
        payout_date, total_budget, allocated_amount, calculation_method, eligibility_rules,
        performance_multipliers, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, 'draft', $12, NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        name,
        description,
        bonus_type,
        period_start,
        period_end,
        payout_date,
        total_budget,
        calculation_method,
        eligibility_rules,
        performance_multipliers,
        created_by,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Bonus plan created' });
  })
);

/**
 * PATCH /bonus-plans/:id
 */
router.patch(
  '/:id',
  requirePermission('COMPENSATION', 'EDIT'),
  validate(updateBonusPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id, status FROM bonus_plans WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Bonus plan');
    }

    const allowedFields = [
      'name',
      'description',
      'bonus_type',
      'period_start',
      'period_end',
      'payout_date',
      'total_budget',
      'calculation_method',
      'eligibility_rules',
      'performance_multipliers',
      'status',
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
      `UPDATE bonus_plans SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Bonus plan updated' });
  })
);

/**
 * POST /bonus-plans/:id/activate
 */
router.post(
  '/:id/activate',
  requirePermission('COMPENSATION', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE bonus_plans SET status = 'active', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
      RETURNING *
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Bonus plan');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Bonus plan activated' });
  })
);

/**
 * POST /bonus-plans/:id/complete
 */
router.post(
  '/:id/complete',
  requirePermission('COMPENSATION', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE bonus_plans SET status = 'completed', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'active'
      RETURNING *
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Bonus plan');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Bonus plan completed' });
  })
);

/**
 * DELETE /bonus-plans/:id
 */
router.delete(
  '/:id',
  requirePermission('COMPENSATION', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      "UPDATE bonus_plans SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Bonus plan');
    }

    res.json({ success: true, message: 'Bonus plan cancelled' });
  })
);

export default router;
