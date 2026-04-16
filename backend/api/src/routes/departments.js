/**
 * Departments Routes
 * CRUD operations for departments within tenant context
 * NOTE: Schema verified from database - departments table columns:
 *   id, tenant_id, code, name, name_en, description, color, icon,
 *   sort_order, is_active, created_at, updated_at, sap_* fields
 */
import { Router } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createDepartmentSchema, updateDepartmentSchema } from '../schemas/employees.js';
import { asyncHandler } from '../errors/middleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { Errors } from '../errors/factory.js';
import { cachedForTenant, invalidateCachePattern, CACHE_TTL } from '../services/cache.js';
// requireRole replaced by requirePermission (RBP Phase 2)
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context
router.use(requireTenant);
/**
 * GET /api/v1/departments
 * List all departments for the current tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const { is_active, search, limit = '100', offset = '0' } = req.query;
    const hasFilters = is_active !== undefined || search;
    const limitNum = safeParseInt(limit, { fallback: 100 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    const fetchData = async () => {
        let query = `
        SELECT
          d.id, d.code, d.name, d.name_en, d.description,
          d.color, d.icon, d.sort_order, d.is_active,
          d.created_at, d.updated_at,
          (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.is_active = true) as employee_count
        FROM departments d
        WHERE ${scope.where}
      `;
        const params = [tenantId];
        let paramIndex = 2;
        if (is_active !== undefined) {
            query += ` AND d.is_active = $${paramIndex}`;
            params.push(is_active === 'true');
            paramIndex++;
        }
        if (search) {
            query += ` AND (d.name ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`;
            params.push(`%${escapeILIKE(search)}%`);
            paramIndex++;
        }
        query += ` ORDER BY d.sort_order, d.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limitNum, offsetNum);
        // Run data and count queries in parallel — they are independent reads
        const [result, countResult] = await Promise.all([
            req.dbClient.query(query, params),
            req.dbClient.query(`SELECT COUNT(*) FROM departments WHERE ${scope.where}`, [tenantId]),
        ]);
        return {
            rows: result.rows,
            total: parseInt(countResult.rows[0].count),
        };
    };
    const data = hasFilters
        ? await fetchData()
        : await cachedForTenant(tenantId, `departments:list:${limitNum}:${offsetNum}`, fetchData, CACHE_TTL.REFERENCE);
    res.json({
        success: true,
        data: data.rows,
        meta: {
            total: data.total,
            limit: limitNum,
            offset: offsetNum,
        },
    });
}));
/**
 * GET /api/v1/departments/:id
 * Get a single department by ID
 */
router.get('/:id', validateUUID(), asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const id = req.params['id'];
    const query = `
      SELECT
        d.id, d.code, d.name, d.name_en, d.description,
        d.color, d.icon, d.sort_order, d.is_active,
        d.created_at, d.updated_at,
        (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.is_active = true) as employee_count
      FROM departments d
      WHERE d.id = $1 AND d.tenant_id = $2
    `;
    const result = await req.dbClient.query(query, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Department');
    }
    res.json({ success: true, data: result.rows[0] });
}));
/**
 * POST /api/v1/departments
 * Create a new department
 */
router.post('/', requirePermission('ORGANIZATION', 'CREATE'), validate(createDepartmentSchema), asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const { code, name, name_en, description, color, icon, sort_order, is_active = true, } = req.body;
    if (!code || !name) {
        throw Errors.badRequest('Code and name are required');
    }
    // Check for duplicate code within tenant
    const existingCheck = await req.dbClient.query('SELECT id FROM departments WHERE code = $1 AND tenant_id = $2', [code, tenantId]);
    if (existingCheck.rows.length > 0) {
        throw Errors.conflict('Department code already exists');
    }
    const query = `
      INSERT INTO departments (tenant_id, code, name, name_en, description, color, icon, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await req.dbClient.query(query, [
        tenantId,
        code,
        name,
        name_en || null,
        description || null,
        color || null,
        icon || null,
        sort_order || 0,
        is_active,
    ]);
    await invalidateCachePattern(`t:${tenantId}:departments:*`);
    res.status(201).json({ success: true, data: result.rows[0] });
}));
/**
 * PUT /api/v1/departments/:id
 * Update a department
 */
router.put('/:id', validateUUID(), requirePermission('ORGANIZATION', 'EDIT'), validate(updateDepartmentSchema), asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const id = req.params['id'];
    const { code, name, name_en, description, color, icon, sort_order, is_active } = req.body;
    // Check department exists and belongs to tenant
    const existingDept = await req.dbClient.query('SELECT id FROM departments WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existingDept.rows.length === 0) {
        throw Errors.notFound('Department');
    }
    // Check for code conflict if code is being changed
    if (code) {
        const codeCheck = await req.dbClient.query('SELECT id FROM departments WHERE code = $1 AND tenant_id = $2 AND id != $3', [code, tenantId, id]);
        if (codeCheck.rows.length > 0) {
            throw Errors.conflict('Department code already exists');
        }
    }
    const query = `
      UPDATE departments SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        name_en = $3,
        description = $4,
        color = $5,
        icon = $6,
        sort_order = COALESCE($7, sort_order),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $9 AND tenant_id = $10
      RETURNING *
    `;
    const result = await req.dbClient.query(query, [
        code || null,
        name || null,
        name_en,
        description,
        color,
        icon,
        sort_order,
        is_active,
        id,
        tenantId,
    ]);
    await invalidateCachePattern(`t:${tenantId}:departments:*`);
    res.json({ success: true, data: result.rows[0] });
}));
/**
 * DELETE /api/v1/departments/:id
 * Soft delete a department (set is_active = false)
 */
router.delete('/:id', validateUUID(), requirePermission('ORGANIZATION', 'DELETE'), asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const id = req.params['id'];
    // Check if department has active employees
    const employeeCheck = await req.dbClient.query('SELECT COUNT(*) FROM employees WHERE department_id = $1 AND tenant_id = $2 AND is_active = true', [id, tenantId]);
    if (parseInt(employeeCheck.rows[0].count) > 0) {
        throw Errors.badRequest('Cannot delete department with assigned employees');
    }
    const query = `
      UPDATE departments
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `;
    const result = await req.dbClient.query(query, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Department');
    }
    await invalidateCachePattern(`t:${tenantId}:departments:*`);
    res.json({ success: true, message: 'Department deactivated' });
}));
/**
 * GET /api/v1/departments/:id/employees
 * List employees in a department
 */
router.get('/:id/employees', validateUUID(), asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const id = req.params['id'];
    const query = `
      SELECT
        e.id, e.first_name, e.last_name, e.email,
        e.job_title, e.is_active, e.hire_date
      FROM employees e
      WHERE e.department_id = $1 AND e.tenant_id = $2
      ORDER BY e.last_name, e.first_name
    `;
    const result = await req.dbClient.query(query, [id, tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/departments/:id/stats
 * Get department statistics (employee count, active count, etc.)
 */
router.get('/:id/stats', validateUUID(), asyncHandler(async (req, res) => {
    const scope = getScopeCondition(req);
    const tenantId = scope.params[0];
    const id = req.params['id'];
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE e.is_active = true) as active_employees,
        COUNT(*) as total_employees,
        COUNT(*) FILTER (WHERE e.hire_date >= NOW() - INTERVAL '1 year') as hired_last_year,
        MIN(e.hire_date) as earliest_hire,
        MAX(e.hire_date) as latest_hire
      FROM employees e
      WHERE e.department_id = $1 AND e.tenant_id = $2
    `;
    const result = await req.dbClient.query(query, [id, tenantId]);
    const stats = result.rows[0] || {};
    res.json({
        success: true,
        data: {
            department_id: id,
            active_employees: safeParseInt(stats.active_employees, { fallback: 0 }),
            total_employees: safeParseInt(stats.total_employees, { fallback: 0 }),
            hired_last_year: safeParseInt(stats.hired_last_year, { fallback: 0 }),
            earliest_hire: stats.earliest_hire,
            latest_hire: stats.latest_hire,
        },
    });
}));
export default router;
//# sourceMappingURL=departments.js.map