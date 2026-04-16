/**
 * Org Scenarios Routes
 * BUG-054: Company PET staging page requires /api/v1/org-scenarios
 *
 * CRUD for organizational scenarios (restructuring, what-if analysis).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { asyncHandler } from '../errors/middleware.js';
import { validate } from '../middleware/validate.js';
import { Errors } from '../errors/factory.js';
const CreateOrgScenarioSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    scenario_type: z.string().optional(),
    status: z.string().optional(),
    is_baseline: z.boolean().optional(),
    base_org_unit_id: z.string().uuid().optional(),
    changes: z.array(z.unknown()).optional(),
    impact_analysis: z.record(z.unknown()).optional(),
    headcount: z.number().int().optional(),
    departments_count: z.number().int().optional(),
    total_cost: z.number().optional(),
    span_of_control: z.number().optional(),
});
const UpdateOrgScenarioSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    scenario_type: z.string().optional(),
    status: z.string().optional(),
    is_baseline: z.boolean().optional(),
    base_org_unit_id: z.string().uuid().optional(),
    changes: z.array(z.unknown()).optional(),
    impact_analysis: z.record(z.unknown()).optional(),
    headcount: z.number().int().optional(),
    departments_count: z.number().int().optional(),
    total_cost: z.number().optional(),
    span_of_control: z.number().optional(),
});
const router = Router();
router.use(requireTenant);
/**
 * GET /org-scenarios
 * List all scenarios for the current tenant.
 * Returns { scenarios: [...], baseline: ... } to match frontend expectations.
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, scenario_type, limit = '50', offset = '0' } = req.query;
    let query = `
      SELECT
        id,
        name,
        description,
        scenario_type,
        status,
        is_baseline AS "isBaseline",
        base_org_unit_id,
        changes,
        impact_analysis,
        headcount,
        departments_count AS departments,
        total_cost AS "totalCost",
        span_of_control AS "spanOfControl",
        created_by,
        created_at,
        updated_at
      FROM org_scenarios
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `;
    const params = [tenantId];
    let paramIdx = 2;
    if (status && typeof status === 'string') {
        query += ` AND status = $${paramIdx++}`;
        params.push(status);
    }
    if (scenario_type && typeof scenario_type === 'string') {
        query += ` AND scenario_type = $${paramIdx++}`;
        params.push(scenario_type);
    }
    query += ` ORDER BY is_baseline DESC, created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(Number(limit), Number(offset));
    const result = await req.dbClient.query(query, params);
    const scenarios = result.rows;
    const baseline = scenarios.find((s) => s.isBaseline) || null;
    res.json({ success: true, data: { scenarios, baseline } });
}));
/**
 * GET /org-scenarios/:id
 * Get a single scenario by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query(`
      SELECT
        id, name, description, scenario_type, status,
        is_baseline AS "isBaseline", base_org_unit_id,
        changes, impact_analysis,
        headcount, departments_count AS departments,
        total_cost AS "totalCost", span_of_control AS "spanOfControl",
        created_by, created_at, updated_at
      FROM org_scenarios
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Org scenario not found');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /org-scenarios
 * Create a new organizational scenario
 */
router.post('/', validate(CreateOrgScenarioSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, scenario_type, status, is_baseline, base_org_unit_id, changes, impact_analysis, headcount, departments_count, total_cost, span_of_control, } = req.body;
    const userId = req.user?.userId || null;
    const result = await req.dbClient.query(`
      INSERT INTO org_scenarios (
        tenant_id, name, description, scenario_type, status,
        is_baseline, base_org_unit_id, changes, impact_analysis,
        headcount, departments_count, total_cost, span_of_control, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING
        id, name, description, scenario_type, status,
        is_baseline AS "isBaseline", base_org_unit_id,
        changes, impact_analysis,
        headcount, departments_count AS departments,
        total_cost AS "totalCost", span_of_control AS "spanOfControl",
        created_by, created_at, updated_at
      `, [
        tenantId,
        name,
        description || null,
        scenario_type || 'restructuring',
        status || 'draft',
        is_baseline || false,
        base_org_unit_id || null,
        changes ? JSON.stringify(changes) : '[]',
        impact_analysis ? JSON.stringify(impact_analysis) : '{}',
        headcount || null,
        departments_count || null,
        total_cost || null,
        span_of_control || null,
        userId,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PUT /org-scenarios/:id
 * Update an organizational scenario
 */
router.put('/:id', validate(UpdateOrgScenarioSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { name, description, scenario_type, status, is_baseline, base_org_unit_id, changes, impact_analysis, headcount, departments_count, total_cost, span_of_control, } = req.body;
    const result = await req.dbClient.query(`
      UPDATE org_scenarios
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        scenario_type = COALESCE($5, scenario_type),
        status = COALESCE($6, status),
        is_baseline = COALESCE($7, is_baseline),
        base_org_unit_id = COALESCE($8, base_org_unit_id),
        changes = COALESCE($9, changes),
        impact_analysis = COALESCE($10, impact_analysis),
        headcount = COALESCE($11, headcount),
        departments_count = COALESCE($12, departments_count),
        total_cost = COALESCE($13, total_cost),
        span_of_control = COALESCE($14, span_of_control)
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      RETURNING
        id, name, description, scenario_type, status,
        is_baseline AS "isBaseline", base_org_unit_id,
        changes, impact_analysis,
        headcount, departments_count AS departments,
        total_cost AS "totalCost", span_of_control AS "spanOfControl",
        created_by, created_at, updated_at
      `, [
        id,
        tenantId,
        name || null,
        description !== undefined ? description : null,
        scenario_type || null,
        status || null,
        is_baseline !== undefined ? is_baseline : null,
        base_org_unit_id || null,
        changes ? JSON.stringify(changes) : null,
        impact_analysis ? JSON.stringify(impact_analysis) : null,
        headcount !== undefined ? headcount : null,
        departments_count !== undefined ? departments_count : null,
        total_cost !== undefined ? total_cost : null,
        span_of_control !== undefined ? span_of_control : null,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Org scenario not found');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /org-scenarios/:id
 * Soft-delete a scenario
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query(`
      UPDATE org_scenarios
      SET deleted_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      RETURNING id
      `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Org scenario not found');
    }
    res.json({ success: true, data: { id, deleted: true } });
}));
export default router;
//# sourceMappingURL=org-scenarios.js.map