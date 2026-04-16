/**
 * Merit Cycles Routes
 * CRUD operations for merit increase cycles
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createMeritCycleSchema, updateMeritCycleSchema, } from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /merit-cycles/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'planning') as planning,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        SUM(total_budget) as total_budget,
        SUM(budget_spent) as total_spent
      FROM merit_cycles WHERE tenant_id = $1
    `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /merit-cycles/current
 */
router.get('/current', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT mc.*,
        (SELECT COUNT(*) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id) as recommendation_count
      FROM merit_cycles mc
      WHERE mc.tenant_id = $1 AND mc.status IN ('planning', 'active')
      ORDER BY mc.effective_date DESC
      LIMIT 1
    `, [tenantId]);
    if (result.rows.length === 0) {
        res.json({ success: true, data: null, message: 'No active merit cycle' });
        return;
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /merit-cycles
 */
router.get('/', requirePermission('COMPENSATION', 'VIEW'), applyScopeFilter('COMPENSATION'), asyncHandler(async (req, res) => {
    getTenantIdOrThrow(req);
    const { status, limit = '100', offset = '0' } = req.query;
    const scope = getScopeCondition(req, 'mc');
    let query = `
      SELECT mc.*,
        (SELECT COUNT(*) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id) as recommendation_count,
        (SELECT COUNT(*) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id AND mr.status = 'approved') as approved_count
      FROM merit_cycles mc
      WHERE ${scope.where}
    `;
    const params = [...scope.params];
    let paramIndex = params.length + 1;
    if (status) {
        query += ` AND mc.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY mc.effective_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query(`SELECT COUNT(*) FROM merit_cycles mc WHERE ${scope.where}`, scope.params);
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
 * GET /merit-cycles/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT mc.*,
        (SELECT COUNT(*) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id) as recommendation_count,
        (SELECT COUNT(*) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id AND mr.status = 'approved') as approved_count,
        (SELECT SUM(new_salary - current_salary) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id AND mr.status = 'approved') as total_increase
      FROM merit_cycles mc
      WHERE mc.id = $1 AND mc.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Merit cycle');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /merit-cycles/:id/recommendations
 */
router.get('/:id/recommendations', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT mr.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        ROUND((mr.new_salary - mr.current_salary) / mr.current_salary * 100, 2) as increase_percent
      FROM merit_recommendations mr
      JOIN employees e ON mr.employee_id = e.id
      WHERE mr.cycle_id = $1 AND e.tenant_id = $2
      ORDER BY increase_percent DESC NULLS LAST
    `, [id, tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /merit-cycles
 */
router.post('/', requirePermission('COMPENSATION', 'CREATE'), validate(createMeritCycleSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, effective_date, submission_deadline, approval_deadline, total_budget, min_increase_percent, max_increase_percent, guideline_matrix, created_by, } = req.body;
    if (!name || !effective_date) {
        throw Errors.badRequest('name and effective_date are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO merit_cycles (tenant_id, name, description, effective_date, submission_deadline,
        approval_deadline, total_budget, budget_spent, min_increase_percent, max_increase_percent,
        guideline_matrix, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, 'planning', $11, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        name,
        description,
        effective_date,
        submission_deadline,
        approval_deadline,
        total_budget,
        min_increase_percent,
        max_increase_percent,
        guideline_matrix,
        created_by,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Merit cycle created' });
}));
/**
 * PATCH /merit-cycles/:id
 */
router.patch('/:id', requirePermission('COMPENSATION', 'EDIT'), validate(updateMeritCycleSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM merit_cycles WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Merit cycle');
    }
    const allowedFields = [
        'name',
        'description',
        'effective_date',
        'submission_deadline',
        'approval_deadline',
        'total_budget',
        'min_increase_percent',
        'max_increase_percent',
        'guideline_matrix',
        'status',
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
    const result = await req.dbClient.query(`UPDATE merit_cycles SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Merit cycle updated' });
}));
/**
 * POST /merit-cycles/:id/activate
 */
router.post('/:id/activate', requirePermission('COMPENSATION', 'EDIT'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE merit_cycles SET status = 'active', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'planning'
      RETURNING *
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Merit cycle');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Merit cycle activated' });
}));
/**
 * POST /merit-cycles/:id/complete
 */
router.post('/:id/complete', requirePermission('COMPENSATION', 'EDIT'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE merit_cycles SET status = 'completed', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'active'
      RETURNING *
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Merit cycle');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Merit cycle completed' });
}));
/**
 * DELETE /merit-cycles/:id
 */
router.delete('/:id', requirePermission('COMPENSATION', 'DELETE'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query("UPDATE merit_cycles SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id", [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Merit cycle');
    }
    res.json({ success: true, message: 'Merit cycle cancelled' });
}));
export default router;
//# sourceMappingURL=merit-cycles.js.map