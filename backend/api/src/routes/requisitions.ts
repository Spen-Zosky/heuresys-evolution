/**
 * Recruiting Requisitions Routes
 * CRUD operations for job requisitions
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createRequisitionSchema,
  updateRequisitionSchema,
} from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /requisitions/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as open_count,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'filled') as filled,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
      SUM(headcount) as total_headcount
    FROM recruiting_requisitions WHERE tenant_id = $1
  `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /requisitions
 */
router.get(
  '/',
  requirePermission('RECRUITMENT', 'VIEW'),
  applyScopeFilter('RECRUITMENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const scope = getScopeCondition(req, 'r');
    const {
      status,
      priority,
      department,
      hiring_manager_id,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
    SELECT r.*,
      (SELECT COUNT(*) FROM recruiting_candidates c WHERE c.requisition_id = r.id) as candidate_count,
      hm.first_name || ' ' || hm.last_name as hiring_manager_name,
      rec.first_name || ' ' || rec.last_name as recruiter_name
    FROM recruiting_requisitions r
    LEFT JOIN employees hm ON r.hiring_manager_id = hm.id
    LEFT JOIN employees rec ON r.recruiter_id = rec.id
    WHERE ${scope.where}
  `;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (priority) {
      query += ` AND r.priority = $${paramIndex}`;
      params.push(priority as string);
      paramIndex++;
    }

    if (department) {
      query += ` AND r.department = $${paramIndex}`;
      params.push(department as string);
      paramIndex++;
    }

    if (hiring_manager_id) {
      query += ` AND r.hiring_manager_id = $${paramIndex}`;
      params.push(hiring_manager_id as string);
      paramIndex++;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countScope = getScopeCondition(req, 'r');
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM recruiting_requisitions r WHERE ${countScope.where}`,
      countScope.params
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
 * GET /requisitions/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    SELECT r.*,
      (SELECT COUNT(*) FROM recruiting_candidates c WHERE c.requisition_id = r.id) as candidate_count,
      (SELECT COUNT(*) FROM recruiting_candidates c WHERE c.requisition_id = r.id AND c.stage = 'offer') as offer_count,
      hm.first_name || ' ' || hm.last_name as hiring_manager_name,
      hm.email as hiring_manager_email,
      rec.first_name || ' ' || rec.last_name as recruiter_name
    FROM recruiting_requisitions r
    LEFT JOIN employees hm ON r.hiring_manager_id = hm.id
    LEFT JOIN employees rec ON r.recruiter_id = rec.id
    WHERE r.id = $1 AND r.tenant_id = $2
  `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Requisition', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /requisitions
 */
router.post(
  '/',
  requirePermission('RECRUITMENT', 'CREATE'),
  validate(createRequisitionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      title,
      department,
      location,
      employment_type,
      priority = 'normal',
      description,
      requirements,
      salary_min,
      salary_max,
      currency = 'EUR',
      hiring_manager_id,
      recruiter_id,
      target_hire_date,
      headcount = 1,
    } = req.body;

    if (!title) {
      throw Errors.badRequest('Title is required');
    }

    const result = await req.dbClient!.query(
      `
    INSERT INTO recruiting_requisitions (tenant_id, title, department, location, employment_type,
      status, priority, description, requirements, salary_min, salary_max, currency,
      hiring_manager_id, recruiter_id, target_hire_date, headcount, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING *
  `,
      [
        tenantId,
        title,
        department,
        location,
        employment_type,
        priority,
        description,
        requirements,
        salary_min,
        salary_max,
        currency,
        hiring_manager_id,
        recruiter_id,
        target_hire_date,
        headcount,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Requisition created' });
  })
);

/**
 * PATCH /requisitions/:id
 */
router.patch(
  '/:id',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(updateRequisitionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM recruiting_requisitions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Requisition', id);
    }

    const allowedFields = [
      'title',
      'department',
      'location',
      'employment_type',
      'status',
      'priority',
      'description',
      'requirements',
      'salary_min',
      'salary_max',
      'currency',
      'hiring_manager_id',
      'recruiter_id',
      'target_hire_date',
      'headcount',
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

    // Auto-set closed_at when status changes to filled/cancelled
    if (req.body.status === 'filled' || req.body.status === 'cancelled') {
      updates.push(`closed_at = NOW()`);
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE recruiting_requisitions SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Requisition updated' });
  })
);

/**
 * DELETE /requisitions/:id
 */
router.delete(
  '/:id',
  requirePermission('RECRUITMENT', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `UPDATE recruiting_requisitions SET status = 'cancelled', closed_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Requisition', id);
    }

    res.json({ success: true, message: 'Requisition cancelled' });
  })
);

/**
 * GET /requisitions/:id/candidates
 */
router.get(
  '/:id/candidates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    SELECT c.*
    FROM recruiting_candidates c
    WHERE c.requisition_id = $1 AND c.tenant_id = $2
    ORDER BY c.rating DESC NULLS LAST, c.applied_at DESC
  `,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

export default router;
