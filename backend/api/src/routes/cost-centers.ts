/**
 * Cost Centers Routes
 * CRUD operations for cost centers with hierarchy
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createCostCenterSchema, updateCostCenterSchema } from '../schemas/employees.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { cachedForTenant, invalidateCachePattern, CACHE_TTL } from '../services/cache.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /cost-centers
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      is_active,
      cost_center_type,
      search,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let whereClause = `WHERE c.tenant_id = $1`;
    const filterParams: (string | boolean)[] = [tenantId];
    let paramIndex = 2;

    if (is_active !== undefined) {
      whereClause += ` AND c.is_active = $${paramIndex}`;
      filterParams.push(is_active === 'true');
      paramIndex++;
    }

    if (cost_center_type) {
      whereClause += ` AND c.cost_center_type = $${paramIndex}`;
      filterParams.push(cost_center_type as string);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`;
      filterParams.push(`%${escapeILIKE(search as string)}%`);
      paramIndex++;
    }

    const limitNum = safeParseInt(limit as string, { fallback: 50 });
    const offsetNum = safeParseInt(offset as string, { fallback: 0 });

    const fetchData = async () => {
      const query = `
        SELECT c.*, o.name as org_unit_name, r.first_name || ' ' || r.last_name as responsible_name,
          (SELECT COUNT(*) FROM employees e WHERE e.cost_center_id = c.id) as employee_count
        FROM cost_centers c
        LEFT JOIN org_units o ON c.org_unit_id = o.id
        LEFT JOIN employees r ON c.responsible_id = r.id
        ${whereClause}
        ORDER BY c.code LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const params = [...filterParams, limitNum, offsetNum];

      const result = await req.dbClient!.query(query, params);
      const countResult = await req.dbClient!.query(
        `SELECT COUNT(*) FROM cost_centers c ${whereClause}`,
        filterParams
      );

      return {
        success: true,
        data: result.rows,
        meta: {
          total: parseInt(countResult.rows[0]?.count),
          limit: limitNum,
          offset: offsetNum,
        },
      };
    };

    const hasFilters = is_active !== undefined || cost_center_type || search;
    const responseData = hasFilters
      ? await fetchData()
      : await cachedForTenant(
          tenantId,
          `cost-centers:list:${limitNum}:${offsetNum}`,
          fetchData,
          CACHE_TTL.REFERENCE
        );

    res.json(responseData);
  })
);

/**
 * GET /cost-centers/types
 */
router.get(
  '/types',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient!.query(
      'SELECT DISTINCT cost_center_type FROM cost_centers WHERE tenant_id = $1 AND cost_center_type IS NOT NULL ORDER BY cost_center_type LIMIT 100',
      [tenantId]
    );
    res.json({ success: true, data: result.rows.map((r) => r.cost_center_type) });
  })
);

/**
 * GET /cost-centers/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `SELECT c.*, o.name as org_unit_name, r.first_name || ' ' || r.last_name as responsible_name,
        p.name as parent_name,
        (SELECT COUNT(*) FROM employees e WHERE e.cost_center_id = c.id) as employee_count
       FROM cost_centers c
       LEFT JOIN org_units o ON c.org_unit_id = o.id
       LEFT JOIN employees r ON c.responsible_id = r.id
       LEFT JOIN cost_centers p ON c.parent_id = p.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Cost center');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /cost-centers
 */
router.post(
  '/',
  requirePermission('ORGANIZATION', 'CREATE'),
  validate(createCostCenterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      code,
      name,
      name_en,
      parent_id,
      cost_center_type,
      responsible_id,
      org_unit_id,
      budget_annual_eur,
      budget_headcount,
      gl_account,
      valid_from,
    } = req.body;

    if (!code || !name) {
      throw Errors.badRequest('Code and name are required');
    }

    const existing = await req.dbClient!.query(
      'SELECT id FROM cost_centers WHERE code = $1 AND tenant_id = $2',
      [code, tenantId]
    );
    if (existing.rows.length > 0) {
      throw Errors.conflict('Cost center code already exists');
    }

    const result = await req.dbClient!.query(
      `INSERT INTO cost_centers (tenant_id, code, name, name_en, parent_id, cost_center_type, responsible_id,
         org_unit_id, budget_annual_eur, budget_headcount, gl_account, valid_from, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW())
       RETURNING *`,
      [
        tenantId,
        code,
        name,
        name_en,
        parent_id,
        cost_center_type,
        responsible_id,
        org_unit_id,
        budget_annual_eur,
        budget_headcount,
        gl_account,
        valid_from,
      ]
    );

    await invalidateCachePattern(`t:${tenantId}:cost-centers:*`);
    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Cost center created' });
  })
);

/**
 * PATCH /cost-centers/:id
 */
router.patch(
  '/:id',
  requirePermission('ORGANIZATION', 'EDIT'),
  validate(updateCostCenterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM cost_centers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Cost center');
    }

    const allowedFields = [
      'name',
      'name_en',
      'parent_id',
      'cost_center_type',
      'responsible_id',
      'org_unit_id',
      'budget_annual_eur',
      'budget_headcount',
      'gl_account',
      'valid_from',
      'valid_to',
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

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE cost_centers SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    await invalidateCachePattern(`t:${tenantId}:cost-centers:*`);
    res.json({ success: true, data: result.rows[0] || null, message: 'Cost center updated' });
  })
);

/**
 * DELETE /cost-centers/:id
 */
router.delete(
  '/:id',
  requirePermission('ORGANIZATION', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id, name FROM cost_centers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Cost center');
    }

    const employeeCount = await req.dbClient!.query(
      'SELECT COUNT(*) FROM employees WHERE cost_center_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (parseInt(employeeCount.rows[0].count) > 0) {
      res
        .status(400)
        .json({ success: false, error: 'Cannot delete cost center with assigned employees' });
      return;
    }

    await req.dbClient!.query(
      'UPDATE cost_centers SET is_active = false, valid_to = CURRENT_DATE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    await invalidateCachePattern(`t:${tenantId}:cost-centers:*`);
    res.json({ success: true, message: `Cost center '${existing.rows[0]?.name}' deactivated` });
  })
);

/**
 * GET /cost-centers/:id/employees
 */
router.get(
  '/:id/employees',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `SELECT id, first_name, last_name, email, job_title, department, hire_date, is_active
       FROM employees WHERE cost_center_id = $1 AND tenant_id = $2 ORDER BY last_name, first_name`,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

export default router;
