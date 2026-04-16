/**
 * Succession Planning Routes
 * Critical roles and succession candidates
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createCriticalRoleSchema, updateCriticalRoleSchema, createSuccessionCandidateSchema, updateSuccessionCandidateSchema, } from '../schemas/succession.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /succession/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    // Get critical roles stats
    const rolesResult = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_critical_roles,
        COUNT(DISTINCT department) as departments_covered
      FROM critical_roles WHERE tenant_id = $1
    `, [tenantId]);
    // Get succession candidates stats
    const candidatesResult = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_candidates,
        COUNT(DISTINCT sc.candidate_employee_id) as unique_candidates,
        COUNT(DISTINCT sc.critical_role_id) as roles_with_candidates
      FROM succession_candidates sc
      JOIN critical_roles cr ON sc.critical_role_id = cr.id
      WHERE cr.tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            ...(rolesResult.rows[0] || {}),
            ...(candidatesResult.rows[0] || {}),
        },
    });
}));
/**
 * GET /succession/critical-roles
 */
router.get('/critical-roles', requirePermission('TALENT', 'VIEW'), applyScopeFilter('TALENT'), asyncHandler(async (req, res) => {
    getTenantIdOrThrow(req);
    const { department, succession_status, limit = '100', offset = '0', } = req.query;
    const scope = getScopeCondition(req, 'cr');
    let query = `
      SELECT cr.*,
        e.first_name || ' ' || e.last_name as current_incumbent_name,
        (SELECT COUNT(*) FROM succession_candidates sc WHERE sc.critical_role_id = cr.id) as candidate_count
      FROM critical_roles cr
      LEFT JOIN employees e ON cr.current_incumbent_id = e.id
      WHERE ${scope.where}
    `;
    const params = [...scope.params];
    let paramIndex = params.length + 1;
    if (department) {
        query += ` AND cr.department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
    }
    if (succession_status) {
        query += ` AND cr.succession_status = $${paramIndex}`;
        params.push(succession_status);
        paramIndex++;
    }
    query += ` ORDER BY cr.role_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query(`SELECT COUNT(*) FROM critical_roles cr WHERE ${scope.where}`, scope.params);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /succession/critical-roles/:id
 */
router.get('/critical-roles/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT cr.*,
        e.first_name || ' ' || e.last_name as current_incumbent_name,
        e.email as current_incumbent_email
      FROM critical_roles cr
      LEFT JOIN employees e ON cr.current_incumbent_id = e.id
      WHERE cr.id = $1 AND cr.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Critical role');
    }
    // Get succession candidates
    const candidates = await req.dbClient.query(`
      SELECT sc.*,
        e.first_name || ' ' || e.last_name as candidate_name,
        e.job_title as candidate_current_role
      FROM succession_candidates sc
      JOIN employees e ON sc.candidate_employee_id = e.id
      WHERE sc.critical_role_id = $1
      ORDER BY sc.rank_order, sc.readiness_level DESC
    `, [id]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            candidates: candidates.rows,
        },
    });
}));
/**
 * POST /succession/critical-roles
 */
router.post('/critical-roles', requirePermission('TALENT', 'CREATE'), validate(createCriticalRoleSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { role_name, department, current_incumbent_id, criticality_level = 'High', impact_if_vacant, time_to_fill_estimate, succession_status = 'at_risk', } = req.body;
    if (!role_name) {
        throw Errors.badRequest('Role name is required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO critical_roles (tenant_id, role_name, department, current_incumbent_id, criticality_level,
        impact_if_vacant, time_to_fill_estimate, succession_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        role_name,
        department,
        current_incumbent_id,
        criticality_level,
        impact_if_vacant,
        time_to_fill_estimate,
        succession_status,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Critical role created' });
}));
/**
 * PATCH /succession/critical-roles/:id
 */
router.patch('/critical-roles/:id', requirePermission('TALENT', 'EDIT'), validate(updateCriticalRoleSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM critical_roles WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Critical role');
    }
    const allowedFields = [
        'role_name',
        'department',
        'current_incumbent_id',
        'criticality_level',
        'impact_if_vacant',
        'time_to_fill_estimate',
        'succession_status',
    ];
    const updates = [];
    const values = [];
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
    const result = await req.dbClient.query(`UPDATE critical_roles SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Critical role updated' });
}));
/**
 * GET /succession/candidates
 * Get all succession candidates
 */
router.get('/candidates', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { readiness_level, limit = '100', offset = '0' } = req.query;
    let query = `
      SELECT sc.*,
        e.first_name || ' ' || e.last_name as candidate_name,
        e.job_title as current_role,
        cr.role_name as target_role
      FROM succession_candidates sc
      JOIN employees e ON sc.candidate_employee_id = e.id
      JOIN critical_roles cr ON sc.critical_role_id = cr.id
      WHERE cr.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (readiness_level) {
        query += ` AND sc.readiness_level = $${paramIndex}`;
        params.push(readiness_level);
        paramIndex++;
    }
    query += ` ORDER BY sc.rank_order, sc.readiness_level DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query(`
      SELECT COUNT(*) FROM succession_candidates sc
      JOIN critical_roles cr ON sc.critical_role_id = cr.id
      WHERE cr.tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * POST /succession/candidates
 * Add a succession candidate
 */
router.post('/candidates', requirePermission('TALENT', 'CREATE'), validate(createSuccessionCandidateSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { critical_role_id, candidate_employee_id, readiness_level = 'ready_2_years', strengths, development_needs, development_plan, rank_order = 1, } = req.body;
    if (!critical_role_id || !candidate_employee_id) {
        res.status(400).json({
            success: false,
            error: 'critical_role_id and candidate_employee_id are required',
        });
        return;
    }
    // Verify critical role exists and belongs to tenant
    const roleCheck = await req.dbClient.query('SELECT id FROM critical_roles WHERE id = $1 AND tenant_id = $2', [critical_role_id, tenantId]);
    if (roleCheck.rows.length === 0) {
        throw Errors.badRequest('Invalid critical role');
    }
    const result = await req.dbClient.query(`
      INSERT INTO succession_candidates (critical_role_id, candidate_employee_id, readiness_level,
        strengths, development_needs, development_plan, rank_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [
        critical_role_id,
        candidate_employee_id,
        readiness_level,
        strengths,
        development_needs,
        development_plan,
        rank_order,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Succession candidate added' });
}));
/**
 * PATCH /succession/candidates/:id
 */
router.patch('/candidates/:id', requirePermission('TALENT', 'EDIT'), validate(updateSuccessionCandidateSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify candidate belongs to a role in this tenant
    const existing = await req.dbClient.query(`
      SELECT sc.id FROM succession_candidates sc
      JOIN critical_roles cr ON sc.critical_role_id = cr.id
      WHERE sc.id = $1 AND cr.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Succession candidate');
    }
    const allowedFields = [
        'readiness_level',
        'strengths',
        'development_needs',
        'development_plan',
        'rank_order',
    ];
    const updates = [];
    const values = [];
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
    const result = await req.dbClient.query(`UPDATE succession_candidates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, [...values, id]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Succession candidate updated',
    });
}));
/**
 * DELETE /succession/candidates/:id
 */
router.delete('/candidates/:id', requirePermission('TALENT', 'DELETE'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify candidate belongs to a role in this tenant
    const existing = await req.dbClient.query(`
      SELECT sc.id FROM succession_candidates sc
      JOIN critical_roles cr ON sc.critical_role_id = cr.id
      WHERE sc.id = $1 AND cr.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Succession candidate');
    }
    await req.dbClient.query('DELETE FROM succession_candidates WHERE id = $1 AND critical_role_id IN (SELECT id FROM critical_roles WHERE tenant_id = $2)', [id, tenantId]);
    res.json({ success: true, message: 'Succession candidate removed' });
}));
/**
 * DELETE /succession/critical-roles/:id
 */
router.delete('/critical-roles/:id', requirePermission('TALENT', 'DELETE'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM critical_roles WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Critical role');
    }
    res.json({ success: true, message: 'Critical role deleted' });
}));
export default router;
//# sourceMappingURL=succession.js.map