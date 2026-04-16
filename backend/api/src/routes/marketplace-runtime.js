/**
 * Marketplace Runtime Routes
 * Tenant-scoped plugin runtime: hooks, UI slots, and execution history.
 *
 * DB tables: plugin_hooks, plugin_ui_slots, plugin_hook_executions,
 *            plugin_installations, plugins
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { executeHook, getUISlots } from '../services/plugin-runtime.js';
import { validate } from '../middleware/validate.js';
import { executeHookSchema, registerRuntimeHookSchema, registerRuntimeUiSlotSchema, } from '../schemas/marketplace-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context
router.use(requireTenant);
/**
 * GET /hooks
 * List all hooks for tenant's installed plugins
 */
router.get('/hooks', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT ph.id, ph.plugin_id, ph.hook_name, ph.handler_path,
             ph.priority, ph.is_async, ph.timeout_ms, ph.enabled,
             p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_hooks ph
      JOIN plugins p ON p.id = ph.plugin_id
      JOIN plugin_installations pi ON pi.plugin_id = ph.plugin_id
      WHERE pi.tenant_id = $1 AND pi.status = 'active'
      ORDER BY ph.hook_name, ph.priority ASC
    `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /hooks/:hookName
 * Get hooks by name for tenant's installed plugins
 */
router.get('/hooks/:hookName', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const hookName = req.params['hookName'];
    const result = await req.dbClient.query(`
      SELECT ph.id, ph.plugin_id, ph.hook_name, ph.handler_path,
             ph.priority, ph.is_async, ph.timeout_ms, ph.enabled,
             p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_hooks ph
      JOIN plugins p ON p.id = ph.plugin_id
      JOIN plugin_installations pi ON pi.plugin_id = ph.plugin_id
      WHERE ph.hook_name = $1 AND pi.tenant_id = $2 AND pi.status = 'active'
      ORDER BY ph.priority ASC
    `, [hookName, tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /hooks/:hookName/execute
 * Execute all hooks for a given name with payload
 */
router.post('/hooks/:hookName/execute', validate(executeHookSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const hookName = req.params['hookName'];
    const payload = req.body || {};
    const results = await executeHook(hookName, tenantId, payload);
    res.json({ success: true, data: results });
}));
/**
 * GET /ui-slots/:slotName
 * Get UI slot components for a slot name
 */
router.get('/ui-slots/:slotName', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const slotName = req.params['slotName'];
    const slots = await getUISlots(slotName, tenantId);
    res.json({ success: true, data: slots });
}));
/**
 * GET /executions
 * Recent hook executions (paginated)
 */
router.get('/executions', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '50', offset = '0' } = req.query;
    const result = await req.dbClient.query(`
      SELECT he.id, he.hook_id, he.trigger_event, he.status,
             he.error_message, he.duration_ms, he.started_at, he.completed_at,
             ph.hook_name, ph.plugin_id,
             p.name as plugin_name
      FROM plugin_hook_executions he
      JOIN plugin_hooks ph ON ph.id = he.hook_id
      JOIN plugins p ON p.id = ph.plugin_id
      WHERE he.tenant_id = $1
      ORDER BY he.started_at DESC
      LIMIT $2 OFFSET $3
    `, [
        tenantId,
        safeParseInt(limit, { fallback: 50 }),
        safeParseInt(offset, { fallback: 0 }),
    ]);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM plugin_hook_executions WHERE tenant_id = $1', [tenantId]);
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
 * POST /plugins/:pluginId/hooks
 * Register a hook for a plugin
 */
router.post('/plugins/:pluginId/hooks', validate(registerRuntimeHookSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['pluginId'];
    const { hook_name, handler_path, priority = 100, is_async = false, timeout_ms = 5000, } = req.body;
    if (!hook_name || !handler_path) {
        throw Errors.badRequest('hook_name and handler_path are required');
    }
    // Verify plugin is installed for tenant
    const installCheck = await req.dbClient.query("SELECT id FROM plugin_installations WHERE plugin_id = $1 AND tenant_id = $2 AND status = 'active'", [pluginId, tenantId]);
    if (installCheck.rows.length === 0) {
        throw Errors.notFound('Plugin');
    }
    const result = await req.dbClient.query(`
      INSERT INTO plugin_hooks (plugin_id, hook_name, handler_path, priority, is_async, timeout_ms)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (plugin_id, hook_name) DO UPDATE SET
        handler_path = EXCLUDED.handler_path,
        priority = EXCLUDED.priority,
        is_async = EXCLUDED.is_async,
        timeout_ms = EXCLUDED.timeout_ms,
        updated_at = NOW()
      RETURNING *
    `, [pluginId, hook_name, handler_path, priority, is_async, timeout_ms]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /plugins/:pluginId/ui-slots
 * Register a UI slot for a plugin
 */
router.post('/plugins/:pluginId/ui-slots', validate(registerRuntimeUiSlotSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const pluginId = req.params['pluginId'];
    const { slot_name, component_path, props_schema, priority = 100 } = req.body;
    if (!slot_name || !component_path) {
        throw Errors.badRequest('slot_name and component_path are required');
    }
    // Verify plugin is installed for tenant
    const installCheck = await req.dbClient.query("SELECT id FROM plugin_installations WHERE plugin_id = $1 AND tenant_id = $2 AND status = 'active'", [pluginId, tenantId]);
    if (installCheck.rows.length === 0) {
        throw Errors.notFound('Plugin');
    }
    const result = await req.dbClient.query(`
      INSERT INTO plugin_ui_slots (plugin_id, slot_name, component_path, props_schema, priority)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (plugin_id, slot_name) DO UPDATE SET
        component_path = EXCLUDED.component_path,
        props_schema = EXCLUDED.props_schema,
        priority = EXCLUDED.priority,
        updated_at = NOW()
      RETURNING *
    `, [
        pluginId,
        slot_name,
        component_path,
        props_schema ? JSON.stringify(props_schema) : '{}',
        priority,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /plugins/:pluginId/hooks/:hookId
 * Remove a hook
 */
router.delete('/plugins/:pluginId/hooks/:hookId', asyncHandler(async (req, res) => {
    const pluginId = req.params['pluginId'];
    const hookId = req.params['hookId'];
    const result = await req.dbClient.query('DELETE FROM plugin_hooks WHERE id = $1 AND plugin_id = $2 RETURNING id', [hookId, pluginId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Hook');
    }
    res.json({ success: true, message: 'Hook removed' });
}));
/**
 * DELETE /plugins/:pluginId/ui-slots/:slotId
 * Remove a UI slot
 */
router.delete('/plugins/:pluginId/ui-slots/:slotId', asyncHandler(async (req, res) => {
    const pluginId = req.params['pluginId'];
    const slotId = req.params['slotId'];
    const result = await req.dbClient.query('DELETE FROM plugin_ui_slots WHERE id = $1 AND plugin_id = $2 RETURNING id', [slotId, pluginId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('UI slot');
    }
    res.json({ success: true, message: 'UI slot removed' });
}));
export default router;
//# sourceMappingURL=marketplace-runtime.js.map