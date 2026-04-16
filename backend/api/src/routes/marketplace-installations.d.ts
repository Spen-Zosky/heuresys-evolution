/**
 * Marketplace Installations Routes
 * Install, uninstall, and manage plugins per tenant
 * Schema verified from database:
 *   plugin_installations: id, tenant_id, plugin_id, plugin_version_id,
 *     installed_by, status, auto_update, installed_at, updated_at,
 *     disabled_at, disabled_reason
 *   plugin_configurations: id, tenant_id, plugin_installation_id,
 *     config_data, config_version, updated_by, created_at, updated_at
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-installations.d.ts.map