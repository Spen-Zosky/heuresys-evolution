/**
 * Org Units Routes
 * CRUD operations for organizational units with hierarchy
 * Epic: 3 - Employee Data Management
 * Story: 3.3 - Organizational Structure Management
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { checkPermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '@heuresys/shared';
import { validate } from '../middleware/validate.js';
import {
  createOrgUnitSchema,
  updateOrgUnitSchema,
  moveOrgUnitSchema,
} from '../schemas/employees.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { cachedForTenant, invalidateCachePattern, CACHE_TTL } from '../services/cache.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// Tenant context required for all routes
router.use(requireTenant);
// Note: authMiddleware is NOT applied globally - read operations are public
// Write operations (POST/PATCH/DELETE) use checkPermission which requires auth

/**
 * GET /org-units
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      is_active,
      org_type,
      parent_id,
      search,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;
    const limitNum = safeParseInt(limit as string, { fallback: 100 });
    const offsetNum = safeParseInt(offset as string, { fallback: 0 });
    const hasFilters = is_active !== undefined || org_type || parent_id || search;

    const fetchData = async () => {
      let query = `
        SELECT o.*, d.name as department_name, l.name as location_name,
          m.first_name || ' ' || m.last_name as manager_name,
          (SELECT COUNT(*) FROM employees e WHERE e.org_unit_id = o.id) as employee_count
        FROM org_units o
        LEFT JOIN org_units d ON o.parent_id = d.id
        LEFT JOIN locations l ON o.default_location_id = l.id
        LEFT JOIN employees m ON o.manager_id = m.id
        WHERE o.tenant_id = $1
      `;
      const params: (string | boolean | number | null)[] = [tenantId];
      let paramIndex = 2;

      if (is_active !== undefined) {
        query += ` AND o.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (org_type) {
        query += ` AND o.org_type = $${paramIndex}`;
        params.push(org_type as string);
        paramIndex++;
      }

      if (parent_id === 'null') {
        query += ' AND o.parent_id IS NULL';
      } else if (parent_id) {
        query += ` AND o.parent_id = $${paramIndex}`;
        params.push(parent_id as string);
        paramIndex++;
      }

      if (search) {
        query += ` AND (o.name ILIKE $${paramIndex} OR o.code ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search as string)}%`);
        paramIndex++;
      }

      query += ` ORDER BY o.org_level, o.sort_order, o.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offsetNum);

      const result = await req.dbClient!.query(query, params);
      const countResult = await req.dbClient!.query(
        'SELECT COUNT(*) FROM org_units WHERE tenant_id = $1',
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
          `org-units:list:${limitNum}:${offsetNum}`,
          fetchData,
          CACHE_TTL.REFERENCE
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
 * GET /org-units/tree or /org-units/hierarchy - Hierarchical tree structure
 */
router.get(
  ['/tree', '/hierarchy'],
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { is_active } = req.query as Record<string, string>;

    let query = `
      SELECT o.id, o.code, o.name, o.parent_id, o.org_level, o.org_type, o.is_active,
        (SELECT COUNT(*) FROM employees e WHERE e.org_unit_id = o.id AND e.is_active = true) as employee_count
      FROM org_units o WHERE o.tenant_id = $1
    `;
    const params: (string | boolean)[] = [tenantId];

    if (is_active !== undefined) {
      query += ' AND o.is_active = $2';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY o.org_level, o.sort_order, o.name';

    const result = await req.dbClient!.query(query, params);

    // Build tree
    const nodeMap = new Map<string, { children: unknown[] }>();
    const roots: unknown[] = [];

    for (const row of result.rows) {
      nodeMap.set(row.id, { ...row, children: [] });
    }

    for (const row of result.rows) {
      const node = nodeMap.get(row.id);
      if (row.parent_id && nodeMap.has(row.parent_id)) {
        nodeMap.get(row.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json({ success: true, data: roots });
  })
);

/**
 * GET /org-units/types
 */
router.get(
  '/types',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient!.query(
      'SELECT DISTINCT org_type FROM org_units WHERE tenant_id = $1 AND org_type IS NOT NULL ORDER BY org_type LIMIT 100',
      [tenantId]
    );
    res.json({ success: true, data: result.rows.map((r) => r.org_type) });
  })
);

/**
 * GET /org-units/:id
 */
router.get(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `SELECT o.*, d.name as department_name, l.name as location_name,
        m.first_name || ' ' || m.last_name as manager_name,
        p.name as parent_name,
        (SELECT COUNT(*) FROM employees e WHERE e.org_unit_id = o.id) as employee_count,
        (SELECT COUNT(*) FROM org_units c WHERE c.parent_id = o.id) as children_count
       FROM org_units o
       LEFT JOIN org_units d ON o.parent_id = d.id
       LEFT JOIN locations l ON o.default_location_id = l.id
       LEFT JOIN employees m ON o.manager_id = m.id
       LEFT JOIN org_units p ON o.parent_id = p.id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Org unit');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /org-units
 */
router.post(
  '/',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(createOrgUnitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      code,
      name,
      name_en,
      parent_id,
      org_level,
      org_type,
      default_location_id,
      manager_id,
      deputy_manager_id,
      headcount_budget,
      valid_from,
      sort_order,
    } = req.body;

    if (!code || !name) {
      throw Errors.badRequest('Code and name are required');
    }

    const existing = await req.dbClient!.query(
      'SELECT id FROM org_units WHERE code = $1 AND tenant_id = $2',
      [code, tenantId]
    );
    if (existing.rows.length > 0) {
      throw Errors.conflict('Org unit code already exists');
    }

    const result = await req.dbClient!.query(
      `INSERT INTO org_units (tenant_id, code, name, name_en, parent_id, org_level, org_type,
         default_location_id, manager_id, deputy_manager_id, headcount_budget, valid_from, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW())
       RETURNING *`,
      [
        tenantId,
        code,
        name,
        name_en,
        parent_id,
        org_level || 1,
        org_type,
        default_location_id,
        manager_id,
        deputy_manager_id,
        headcount_budget,
        valid_from,
        sort_order || 0,
      ]
    );

    await invalidateCachePattern(`t:${tenantId}:org-units:*`);
    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Org unit created' });
  })
);

/**
 * PATCH /org-units/:id
 */
router.patch(
  '/:id',
  validateUUID(),
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(updateOrgUnitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM org_units WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Org unit');
    }

    const allowedFields = [
      'name',
      'name_en',
      'parent_id',
      'org_level',
      'org_type',
      'default_location_id',
      'manager_id',
      'deputy_manager_id',
      'headcount_budget',
      'valid_from',
      'valid_to',
      'sort_order',
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
      `UPDATE org_units SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    await invalidateCachePattern(`t:${tenantId}:org-units:*`);
    res.json({ success: true, data: result.rows[0] || null, message: 'Org unit updated' });
  })
);

/**
 * DELETE /org-units/:id
 */
router.delete(
  '/:id',
  validateUUID(),
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id, name FROM org_units WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Org unit');
    }

    const childCount = await req.dbClient!.query(
      'SELECT COUNT(*) FROM org_units WHERE parent_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (parseInt(childCount.rows[0].count) > 0) {
      throw Errors.badRequest('Cannot delete org unit with children');
    }

    const employeeCount = await req.dbClient!.query(
      'SELECT COUNT(*) FROM employees WHERE org_unit_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (parseInt(employeeCount.rows[0].count) > 0) {
      res
        .status(400)
        .json({ success: false, error: 'Cannot delete org unit with assigned employees' });
      return;
    }

    await req.dbClient!.query(
      'UPDATE org_units SET is_active = false, valid_to = CURRENT_DATE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    await invalidateCachePattern(`t:${tenantId}:org-units:*`);
    res.json({ success: true, message: `Org unit '${existing.rows[0]?.name}' deactivated` });
  })
);

/**
 * GET /org-units/:id/children
 */
router.get(
  '/:id/children',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `SELECT o.id, o.code, o.name, o.org_level, o.org_type, o.is_active,
        (SELECT COUNT(*) FROM employees e WHERE e.org_unit_id = o.id) as employee_count
       FROM org_units o WHERE o.parent_id = $1 AND o.tenant_id = $2 ORDER BY o.sort_order, o.name`,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /org-units/:id/employees
 * Get employees in this org unit
 */
router.get(
  '/:id/employees',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { includeChildren = 'false' } = req.query as Record<string, string>;

    let employeeQuery: string;
    const params: string[] = [tenantId, id];

    if (includeChildren === 'true') {
      // Use recursive CTE to get all child org units
      employeeQuery = `
        WITH RECURSIVE org_tree AS (
          SELECT id FROM org_units WHERE id = $2 AND tenant_id = $1
          UNION ALL
          SELECT o.id FROM org_units o
          INNER JOIN org_tree t ON o.parent_id = t.id
          WHERE o.tenant_id = $1
        )
        SELECT e.id, e.pernr, e.first_name, e.last_name, e.email,
               e.job_title, e.department, e.hire_date, e.is_active,
               o.name as org_unit_name
        FROM employees e
        INNER JOIN org_tree t ON e.org_unit_id = t.id
        LEFT JOIN org_units o ON e.org_unit_id = o.id
        WHERE e.tenant_id = $1 AND e.is_active = true
        ORDER BY e.last_name, e.first_name
      `;
    } else {
      employeeQuery = `
        SELECT id, pernr, first_name, last_name, email,
               job_title, department, hire_date, is_active
        FROM employees
        WHERE org_unit_id = $2 AND tenant_id = $1 AND is_active = true
        ORDER BY last_name, first_name
      `;
    }

    const result = await req.dbClient!.query(employeeQuery, params);

    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
  })
);

/**
 * GET /org-units/:id/path
 * Get the path from root to this org unit
 */
router.get(
  '/:id/path',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `WITH RECURSIVE org_path AS (
        SELECT id, code, name, parent_id, org_level, 1 as depth
        FROM org_units WHERE id = $1 AND tenant_id = $2
        UNION ALL
        SELECT o.id, o.code, o.name, o.parent_id, o.org_level, p.depth + 1
        FROM org_units o
        INNER JOIN org_path p ON o.id = p.parent_id
        WHERE o.tenant_id = $2
      )
      SELECT id, code, name, org_level FROM org_path ORDER BY depth DESC LIMIT 200`,
      [id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { depth: result.rows.length },
    });
  })
);

/**
 * POST /org-units/:id/move
 * Move org unit to a new parent
 */
router.post(
  '/:id/move',
  checkPermission(PERMISSIONS.TENANT_CONFIGURE),
  validate(moveOrgUnitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { newParentId } = req.body;

    // Verify org unit exists
    const existing = await req.dbClient!.query(
      'SELECT id, name, parent_id FROM org_units WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      throw Errors.notFound('Org unit');
    }

    // If newParentId is provided, verify it exists and is not a descendant
    if (newParentId) {
      const parentCheck = await req.dbClient!.query(
        'SELECT id FROM org_units WHERE id = $1 AND tenant_id = $2',
        [newParentId, tenantId]
      );

      if (parentCheck.rows.length === 0) {
        throw Errors.badRequest('New parent org unit not found');
      }

      // Check for circular reference
      const circularCheck = await req.dbClient!.query(
        `WITH RECURSIVE descendants AS (
          SELECT id FROM org_units WHERE id = $1
          UNION ALL
          SELECT o.id FROM org_units o
          INNER JOIN descendants d ON o.parent_id = d.id
        )
        SELECT 1 FROM descendants WHERE id = $2`,
        [id, newParentId]
      );

      if (circularCheck.rows.length > 0) {
        res
          .status(400)
          .json({ success: false, error: 'Cannot move org unit to its own descendant' });
        return;
      }
    }

    // Update the parent
    const result = await req.dbClient!.query(
      `UPDATE org_units SET parent_id = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [newParentId || null, id, tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: `Org unit '${existing.rows[0]?.name}' moved successfully`,
    });
  })
);

/**
 * GET /org-units/statistics
 * Get org structure statistics
 */
router.get(
  '/meta/statistics',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const [totalResult, byTypeResult, byLevelResult, maxDepthResult] = await Promise.all([
      req.dbClient!.query(
        'SELECT COUNT(*) FROM org_units WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      ),
      req.dbClient!.query(
        `SELECT org_type, COUNT(*) as count
         FROM org_units WHERE tenant_id = $1 AND is_active = true
         GROUP BY org_type ORDER BY count DESC`,
        [tenantId]
      ),
      req.dbClient!.query(
        `SELECT org_level, COUNT(*) as count
         FROM org_units WHERE tenant_id = $1 AND is_active = true
         GROUP BY org_level ORDER BY org_level`,
        [tenantId]
      ),
      req.dbClient!.query(
        `SELECT MAX(org_level) as max_depth FROM org_units WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        totalUnits: parseInt(totalResult.rows[0]?.count, 10),
        maxDepth: maxDepthResult.rows[0]?.max_depth || 0,
        byType: byTypeResult.rows.reduce((acc: Record<string, number>, row) => {
          acc[row.org_type || 'unspecified'] = parseInt(row.count, 10);
          return acc;
        }, {}),
        byLevel: byLevelResult.rows.map((row) => ({
          level: row.org_level,
          count: parseInt(row.count, 10),
        })),
      },
    });
  })
);

export default router;
