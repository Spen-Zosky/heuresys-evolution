/**
 * Marketplace Plugin API Keys Routes
 * Per-tenant API key management for plugin integrations.
 * Schema (plugin_api_keys):
 *   id, tenant_id, plugin_installation_id, name, key_hash, key_prefix,
 *   scopes, expires_at, last_used_at, is_active, created_by, created_at, revoked_at
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-api-keys.d.ts.map