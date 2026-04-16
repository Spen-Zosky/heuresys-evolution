/**
 * Marketplace Developer Portal Routes
 * Developer-facing routes for managing plugins, versions, API keys.
 * All routes require tenant context and ADMIN role.
 * Ownership enforced via publisher_tenant_id.
 *
 * DB tables: plugins, plugin_versions, plugin_categories, plugin_api_keys, plugin_reviews
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-developer.d.ts.map