/**
 * Workspace Template Designer Routes
 * CRUD for workspace_templates — admin management of role-default templates.
 * P3-14: Template Designer
 */
import { Router } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { pool } from '../config/database.js';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
// All template routes require auth + tenant + WORKSPACE MANAGE permission
router.use(authMiddleware);
router.use(requireTenant);
router.use(requirePermission('WORKSPACE', 'EDIT'));
// ============================================================================
// GET /templates — List all templates (platform + tenant), ordered by role
// ============================================================================
router.get('/', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const result = await pool.query(`SELECT wt.id, wt.target_role_id, wt.tenant_id, wt.name,
              wt.name_it, wt.name_en, wt.description_it, wt.description_en,
              wt.layout_config, wt.widget_config, wt.is_active,
              wt.created_at, wt.updated_at,
              r.name AS role_name, r.code AS role_code, r.hierarchy_level,
              COALESCE(json_array_length(wt.widget_config::json), 0) AS widget_count
         FROM workspace_templates wt
         JOIN rbp_roles r ON r.id = wt.target_role_id
        WHERE wt.tenant_id IS NULL OR wt.tenant_id = $1
        ORDER BY r.hierarchy_level, wt.tenant_id NULLS FIRST`, [tenantId]);
    return res.json({ success: true, data: result.rows });
}));
// ============================================================================
// GET /templates/:id — Get single template
// ============================================================================
router.get('/:id', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { id } = req.params;
    const result = await pool.query(`SELECT wt.id, wt.target_role_id, wt.tenant_id, wt.name,
              wt.name_it, wt.name_en, wt.description_it, wt.description_en,
              wt.layout_config, wt.widget_config, wt.is_active,
              wt.created_at, wt.updated_at,
              r.name AS role_name, r.code AS role_code, r.hierarchy_level
         FROM workspace_templates wt
         JOIN rbp_roles r ON r.id = wt.target_role_id
        WHERE wt.id = $1
          AND (wt.tenant_id IS NULL OR wt.tenant_id = $2)`, [id, tenantId]);
    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
}));
// ============================================================================
// POST /templates — Create template
// ============================================================================
router.post('/', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { name, target_role_id, widget_config, layout_config } = req.body;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (!target_role_id || typeof target_role_id !== 'number') {
        return res.status(400).json({ success: false, error: 'target_role_id is required' });
    }
    const result = await pool.query(`INSERT INTO workspace_templates
         (target_role_id, tenant_id, name, widget_config, layout_config, is_active)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, true)
       RETURNING id, target_role_id, tenant_id, name, widget_config, layout_config, is_active, created_at`, [
        target_role_id,
        tenantId,
        name,
        JSON.stringify(widget_config ?? []),
        JSON.stringify(layout_config ?? { columns: 12, gap: 16 }),
    ]);
    return res.status(201).json({ success: true, data: result.rows[0] });
}));
// ============================================================================
// PUT /templates/:id — Update template
// ============================================================================
router.put('/:id', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { id } = req.params;
    const { name, target_role_id, widget_config, layout_config } = req.body;
    // Build dynamic SET clause
    const sets = [];
    const params = [id, tenantId];
    if (name !== undefined) {
        params.push(name);
        sets.push(`name = $${params.length}`);
    }
    if (target_role_id !== undefined) {
        params.push(target_role_id);
        sets.push(`target_role_id = $${params.length}`);
    }
    if (widget_config !== undefined) {
        params.push(JSON.stringify(widget_config));
        sets.push(`widget_config = $${params.length}::jsonb`);
    }
    if (layout_config !== undefined) {
        params.push(JSON.stringify(layout_config));
        sets.push(`layout_config = $${params.length}::jsonb`);
    }
    if (sets.length === 0) {
        return res.status(400).json({ success: false, error: 'No updatable fields provided' });
    }
    sets.push('updated_at = NOW()');
    const result = await pool.query(`UPDATE workspace_templates
          SET ${sets.join(', ')}
        WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)
       RETURNING id, target_role_id, tenant_id, name, widget_config, layout_config, is_active, updated_at`, params);
    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
}));
// ============================================================================
// DELETE /templates/:id — Soft-delete (set is_active=false)
// ============================================================================
router.delete('/:id', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { id } = req.params;
    const result = await pool.query(`UPDATE workspace_templates
          SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)
       RETURNING id`, [id, tenantId]);
    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
    }
    return res.json({ success: true, data: { id: result.rows[0].id, is_active: false } });
}));
// ============================================================================
// POST /templates/:id/clone — Clone a template
// ============================================================================
router.post('/:id/clone', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { id } = req.params;
    const { name: overrideName } = (req.body ?? {});
    // Fetch source template
    const source = await pool.query(`SELECT target_role_id, name, widget_config, layout_config
         FROM workspace_templates
        WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`, [id, tenantId]);
    if (source.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Source template not found' });
    }
    const src = source.rows[0];
    const clonedName = overrideName || `${src.name} (copy)`;
    const result = await pool.query(`INSERT INTO workspace_templates
         (target_role_id, tenant_id, name, widget_config, layout_config, is_active)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, true)
       RETURNING id, target_role_id, tenant_id, name, widget_config, layout_config, is_active, created_at`, [
        src.target_role_id,
        tenantId,
        clonedName,
        JSON.stringify(src.widget_config),
        JSON.stringify(src.layout_config),
    ]);
    return res.status(201).json({ success: true, data: result.rows[0] });
}));
// ============================================================================
// PATCH /templates/:id/toggle — Toggle is_active
// ============================================================================
router.patch('/:id/toggle', asyncHandler(async (req, res) => {
    const authReq = req;
    const tenantId = authReq.tenantId ?? authReq.user.tenantId;
    const { id } = req.params;
    const result = await pool.query(`UPDATE workspace_templates
          SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)
       RETURNING id, is_active`, [id, tenantId]);
    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
}));
export default router;
//# sourceMappingURL=workspace-templates.js.map