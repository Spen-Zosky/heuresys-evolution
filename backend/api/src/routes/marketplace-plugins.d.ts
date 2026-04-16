/**
 * Marketplace Plugins Routes
 * Browse the plugin catalog (platform-level, no tenant_id on plugins table).
 * Also handles plugin CRUD for TENANT_OWNER/developers.
 *
 * NOTE: The plugins, plugin_categories, plugin_versions, plugin_dependencies, and
 * plugin_installations tables are platform-wide and have no tenant_id column.
 * Queries use req.dbClient for consistency with the RLS middleware chain.
 *
 * Actual DB schema:
 *   plugins: id, name, slug, short_description, description, category_id (FK plugin_categories),
 *     publisher_tenant_id, publisher_name, icon_url, homepage_url, repository_url, license,
 *     status (draft|pending_review|published|suspended|deprecated), visibility (public|private|unlisted),
 *     pricing_model (free|freemium|paid|subscription|contact), price_cents, currency, tags TEXT[],
 *     avg_rating, total_ratings, total_installations, featured, created_at, updated_at
 *   plugin_categories: id, name, slug, description, icon, sort_order, parent_id
 *   plugin_versions: id, plugin_id, version, release_notes, changelog, config_schema,
 *     permissions_required, entry_point, status, is_latest, published_at, created_at, updated_at
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-plugins.d.ts.map