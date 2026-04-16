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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-hooks.d.ts.map