/**
 * Marketplace Plugin Dependencies Routes
 * Manage inter-plugin dependency declarations.
 * Schema (plugin_dependencies):
 *   id, plugin_id, depends_on_plugin_id, min_version, max_version,
 *   is_optional, created_at
 *
 * NOTE: Plugin dependencies are platform-level (no tenant_id column).
 * Queries use req.dbClient for consistency with the RLS middleware chain.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-dependencies.d.ts.map