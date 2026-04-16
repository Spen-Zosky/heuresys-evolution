/**
 * Marketplace Plugin Hooks & UI Slots Routes
 * Plugin hook point registration, UI slot definitions, and hook execution tracking.
 * Schema (plugin_hooks):
 *   id, plugin_id, hook_name, handler_path, priority, is_async,
 *   timeout_ms, enabled, created_at, updated_at
 * Schema (plugin_ui_slots):
 *   id, plugin_id, slot_name, component_path, props_schema,
 *   priority, enabled, created_at, updated_at
 * Schema (plugin_hook_executions):
 *   id, hook_id, tenant_id, trigger_event, input_data, output_data,
 *   status, error_message, duration_ms, started_at, completed_at
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createMarketplaceHookSchema, updateMarketplaceHookSchema, createMarketplaceUiSlotSchema, updateMarketplaceUiSlotSchema, } from '../schemas/marketplace-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// ====================================================================
// HOOKS (platform-level, no tenant context required for CRUD)
// ====================================================================
/**
 * GET /api/v1/marketplace/hooks
 * List registered hooks, optionally filtered by plugin or hook_name
 */
router.get('/', authMiddleware, requirePermission('MARKETPLACE', 'VIEW'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { plugin_id, hook_name, enabled, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        h.id, h.plugin_id, h.hook_name, h.handler_path,
        h.priority, h.is_async, h.timeout_ms, h.enabled,
        h.created_at, h.updated_at,
        p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_hooks h
      JOIN plugins p ON p.id = h.plugin_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (plugin_id) {
        query += ` AND h.plugin_id = $${paramIndex}`;
        params.push(plugin_id);
        paramIndex++;
    }
    if (hook_name) {
        query += ` AND h.hook_name = $${paramIndex}`;
        params.push(hook_name);
        paramIndex++;
    }
    if (enabled !== undefined) {
        query += ` AND h.enabled = $${paramIndex}`;
        params.push(enabled === 'true' ? 'true' : 'false');
        paramIndex++;
    }
    query += ` ORDER BY h.hook_name ASC, h.priority ASC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/marketplace/hooks/:id
 * Get a specific hook
 */
router.get('/:id', authMiddleware, requirePermission('MARKETPLACE', 'VIEW'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const result = await dbClient.query(`
      SELECT
        h.*, p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_hooks h
      JOIN plugins p ON p.id = h.plugin_id
      WHERE h.id = $1
    `, [id]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Hook');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /api/v1/marketplace/hooks
 * Register a new hook for a plugin (SUPERUSER only)
 */
router.post('/', authMiddleware, requirePermission('MARKETPLACE', 'CREATE'), validate(createMarketplaceHookSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    try {
        const { plugin_id, hook_name, handler_path, priority = 100, is_async = false, timeout_ms = 5000, } = req.body;
        if (!plugin_id || !hook_name || !handler_path) {
            throw Errors.badRequest('plugin_id, hook_name, and handler_path are required');
        }
        // Verify plugin exists
        const pluginCheck = await dbClient.query('SELECT id FROM plugins WHERE id = $1', [plugin_id]);
        if (pluginCheck.rows.length === 0) {
            throw Errors.badRequest('Plugin not found');
        }
        const result = await dbClient.query(`
      INSERT INTO plugin_hooks (
        plugin_id, hook_name, handler_path, priority, is_async, timeout_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [plugin_id, hook_name, handler_path, priority, is_async, timeout_ms]);
        res.status(201).json({ success: true, data: result.rows[0] || null });
    }
    catch (error) {
        if (error instanceof Error &&
            'code' in error &&
            error.code === '23505') {
            throw Errors.conflict('This hook is already registered for this plugin');
        }
        throw error;
    }
}));
/**
 * PUT /api/v1/marketplace/hooks/:id
 * Update a hook (SUPERUSER only)
 */
router.put('/:id', authMiddleware, requirePermission('MARKETPLACE', 'EDIT'), validate(updateMarketplaceHookSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const { handler_path, priority, is_async, timeout_ms, enabled } = req.body;
    const result = await dbClient.query(`
      UPDATE plugin_hooks SET
        handler_path = COALESCE($2, handler_path),
        priority = COALESCE($3, priority),
        is_async = COALESCE($4, is_async),
        timeout_ms = COALESCE($5, timeout_ms),
        enabled = COALESCE($6, enabled),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
        id,
        handler_path || null,
        priority ?? null,
        is_async ?? null,
        timeout_ms ?? null,
        enabled ?? null,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Hook');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /api/v1/marketplace/hooks/:id
 * Delete a hook (SUPERUSER only)
 */
router.delete('/:id', authMiddleware, requirePermission('MARKETPLACE', 'DELETE'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const result = await dbClient.query('DELETE FROM plugin_hooks WHERE id = $1 RETURNING id', [
        id,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Hook');
    }
    res.json({ success: true, message: 'Hook deleted' });
}));
// ====================================================================
// UI SLOTS (platform-level)
// ====================================================================
/**
 * GET /api/v1/marketplace/hooks/ui-slots/list
 * List registered UI slots, optionally filtered by plugin or slot_name
 */
router.get('/ui-slots/list', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { plugin_id, slot_name, enabled, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        s.id, s.plugin_id, s.slot_name, s.component_path,
        s.props_schema, s.priority, s.enabled,
        s.created_at, s.updated_at,
        p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_ui_slots s
      JOIN plugins p ON p.id = s.plugin_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (plugin_id) {
        query += ` AND s.plugin_id = $${paramIndex}`;
        params.push(plugin_id);
        paramIndex++;
    }
    if (slot_name) {
        query += ` AND s.slot_name = $${paramIndex}`;
        params.push(slot_name);
        paramIndex++;
    }
    if (enabled !== undefined) {
        query += ` AND s.enabled = $${paramIndex}`;
        params.push(enabled === 'true' ? 'true' : 'false');
        paramIndex++;
    }
    query += ` ORDER BY s.slot_name ASC, s.priority ASC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /api/v1/marketplace/hooks/ui-slots
 * Register a new UI slot for a plugin (SUPERUSER only)
 */
router.post('/ui-slots', authMiddleware, requirePermission('MARKETPLACE', 'CREATE'), validate(createMarketplaceUiSlotSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    try {
        const { plugin_id, slot_name, component_path, props_schema, priority = 100 } = req.body;
        if (!plugin_id || !slot_name || !component_path) {
            throw Errors.badRequest('plugin_id, slot_name, and component_path are required');
        }
        // Verify plugin exists
        const pluginCheck = await dbClient.query('SELECT id FROM plugins WHERE id = $1', [plugin_id]);
        if (pluginCheck.rows.length === 0) {
            throw Errors.badRequest('Plugin not found');
        }
        const result = await dbClient.query(`
      INSERT INTO plugin_ui_slots (
        plugin_id, slot_name, component_path, props_schema, priority
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
            plugin_id,
            slot_name,
            component_path,
            props_schema ? JSON.stringify(props_schema) : '{}',
            priority,
        ]);
        res.status(201).json({ success: true, data: result.rows[0] || null });
    }
    catch (error) {
        if (error instanceof Error &&
            'code' in error &&
            error.code === '23505') {
            throw Errors.conflict('This UI slot is already registered for this plugin');
        }
        throw error;
    }
}));
/**
 * PUT /api/v1/marketplace/hooks/ui-slots/:id
 * Update a UI slot (SUPERUSER only)
 */
router.put('/ui-slots/:id', authMiddleware, requirePermission('MARKETPLACE', 'EDIT'), validate(updateMarketplaceUiSlotSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const { component_path, props_schema, priority, enabled } = req.body;
    const result = await dbClient.query(`
      UPDATE plugin_ui_slots SET
        component_path = COALESCE($2, component_path),
        props_schema = COALESCE($3, props_schema),
        priority = COALESCE($4, priority),
        enabled = COALESCE($5, enabled),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
        id,
        component_path || null,
        props_schema ? JSON.stringify(props_schema) : null,
        priority ?? null,
        enabled ?? null,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('UI slot');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /api/v1/marketplace/hooks/ui-slots/:id
 * Delete a UI slot (SUPERUSER only)
 */
router.delete('/ui-slots/:id', authMiddleware, requirePermission('MARKETPLACE', 'DELETE'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const result = await dbClient.query('DELETE FROM plugin_ui_slots WHERE id = $1 RETURNING id', [
        id,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('UI slot');
    }
    res.json({ success: true, message: 'UI slot deleted' });
}));
// ====================================================================
// HOOK EXECUTIONS (tenant-scoped)
// ====================================================================
/**
 * GET /api/v1/marketplace/hooks/executions/list
 * List hook executions for the current tenant
 */
router.get('/executions/list', requireTenant, asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const { hook_id, status, limit = '50', offset = '0' } = req.query;
    let query = `
      SELECT
        he.id, he.hook_id, he.tenant_id, he.trigger_event,
        he.input_data, he.output_data, he.status, he.error_message,
        he.duration_ms, he.started_at, he.completed_at,
        h.hook_name, h.plugin_id,
        p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_hook_executions he
      JOIN plugin_hooks h ON h.id = he.hook_id
      JOIN plugins p ON p.id = h.plugin_id
      WHERE he.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (hook_id) {
        query += ` AND he.hook_id = $${paramIndex}`;
        params.push(hook_id);
        paramIndex++;
    }
    if (status) {
        query += ` AND he.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY he.started_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/marketplace/hooks/executions/:id
 * Get a specific hook execution
 */
router.get('/executions/:id', requireTenant, asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await dbClient.query(`
      SELECT
        he.*,
        h.hook_name, h.plugin_id, h.handler_path,
        p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_hook_executions he
      JOIN plugin_hooks h ON h.id = he.hook_id
      JOIN plugins p ON p.id = h.plugin_id
      WHERE he.id = $1 AND he.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Hook execution');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
export default router;
//# sourceMappingURL=marketplace-hooks.js.map