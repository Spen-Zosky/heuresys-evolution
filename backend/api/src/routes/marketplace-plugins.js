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
import { Router } from 'express';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createPluginSchema, updatePluginSchema, createPluginVersionSchema, createPluginDependencySchema, } from '../schemas/marketplace.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
/**
 * GET /api/v1/marketplace/plugins/stats
 * Get marketplace statistics (platform-wide)
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const result = await dbClient.query(`
    SELECT
      COUNT(*) as total_plugins,
      COUNT(*) FILTER (WHERE status = 'published') as published,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'pending_review') as pending_review,
      COUNT(*) FILTER (WHERE featured = true) as featured,
      COUNT(*) FILTER (WHERE pricing_model = 'free') as free_plugins,
      COUNT(*) FILTER (WHERE pricing_model IN ('paid', 'subscription')) as paid_plugins,
      ROUND(AVG(avg_rating) FILTER (WHERE avg_rating > 0), 2) as overall_avg_rating,
      COALESCE(SUM(total_installations), 0) as total_downloads
    FROM plugins
  `);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /api/v1/marketplace/plugins/categories
 * Get available plugin categories with counts
 */
router.get('/categories', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const result = await dbClient.query(`
    SELECT
      pc.id, pc.name, pc.slug, pc.description, pc.icon, pc.sort_order,
      COUNT(p.id) FILTER (WHERE p.status = 'published') as plugin_count
    FROM plugin_categories pc
    LEFT JOIN plugins p ON p.category_id = pc.id
    GROUP BY pc.id, pc.name, pc.slug, pc.description, pc.icon, pc.sort_order
    ORDER BY pc.sort_order ASC
  `);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/marketplace/plugins/featured
 * Get featured plugins
 */
router.get('/featured', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { limit = '6' } = req.query;
    const result = await dbClient.query(`
    SELECT
      p.id, p.name, p.slug, p.short_description, p.publisher_name,
      p.icon_url, p.pricing_model, p.price_cents, p.currency,
      p.featured, p.total_installations, p.avg_rating, p.total_ratings,
      p.tags, p.created_at,
      pc.name as category_name, pc.slug as category_slug, pc.icon as category_icon,
      pv.version as latest_version, pv.published_at as latest_version_date
    FROM plugins p
    LEFT JOIN plugin_categories pc ON pc.id = p.category_id
    LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = true
    WHERE p.status = 'published' AND p.visibility = 'public' AND p.featured = true
    ORDER BY p.total_installations DESC
    LIMIT $1
  `, [safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/marketplace/plugins
 * List published plugins with filtering and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { category, pricing_model, featured, search, sort = 'total_installations', order = 'desc', limit = '20', offset = '0', } = req.query;
    let query = `
    SELECT
      p.id, p.name, p.slug, p.short_description, p.publisher_name,
      p.icon_url, p.pricing_model, p.price_cents, p.currency,
      p.status, p.featured, p.total_installations, p.avg_rating,
      p.total_ratings, p.tags, p.created_at, p.updated_at,
      pc.name as category_name, pc.slug as category_slug, pc.icon as category_icon,
      pv.version as latest_version
    FROM plugins p
    LEFT JOIN plugin_categories pc ON pc.id = p.category_id
    LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = true
    WHERE p.status = 'published' AND p.visibility = 'public'
  `;
    const params = [];
    let paramIndex = 1;
    if (category) {
        query += ` AND pc.slug = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    if (pricing_model) {
        query += ` AND p.pricing_model = $${paramIndex}`;
        params.push(pricing_model);
        paramIndex++;
    }
    if (featured === 'true') {
        query += ` AND p.featured = true`;
    }
    if (search) {
        query += ` AND (p.name ILIKE $${paramIndex} OR p.short_description ILIKE $${paramIndex} OR p.publisher_name ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search)}%`);
        paramIndex++;
    }
    // Validate sort column — values are hardcoded safe table-qualified columns
    const allowedSorts = {
        total_installations: 'p.total_installations',
        avg_rating: 'p.avg_rating',
        name: 'p.name',
        created_at: 'p.created_at',
        price_cents: 'p.price_cents',
    };
    const validSortKey = Object.hasOwn(allowedSorts, sort)
        ? sort
        : 'total_installations';
    const sortCol = allowedSorts[validSortKey];
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortOrder} NULLS LAST`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await dbClient.query(query, params);
    // Count query (same filters, no joins needed for count)
    let countQuery = `
    SELECT COUNT(*)
    FROM plugins p
    LEFT JOIN plugin_categories pc ON pc.id = p.category_id
    WHERE p.status = 'published' AND p.visibility = 'public'
  `;
    const countParams = [];
    let countIdx = 1;
    if (category) {
        countQuery += ` AND pc.slug = $${countIdx}`;
        countParams.push(category);
        countIdx++;
    }
    if (pricing_model) {
        countQuery += ` AND p.pricing_model = $${countIdx}`;
        countParams.push(pricing_model);
        countIdx++;
    }
    if (featured === 'true') {
        countQuery += ` AND p.featured = true`;
    }
    if (search) {
        countQuery += ` AND (p.name ILIKE $${countIdx} OR p.short_description ILIKE $${countIdx})`;
        countParams.push(`%${escapeILIKE(search)}%`);
    }
    const countResult = await dbClient.query(countQuery, countParams);
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
 * GET /api/v1/marketplace/plugins/:idOrSlug
 * Get plugin details by ID or slug
 */
router.get('/:idOrSlug', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const idOrSlug = req.params['idOrSlug'];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const result = await dbClient.query(`
    SELECT
      p.*,
      pc.name as category_name, pc.slug as category_slug, pc.icon as category_icon,
      pv.version as latest_version, pv.release_notes, pv.published_at as latest_version_date,
      pv.config_schema, pv.permissions_required
    FROM plugins p
    LEFT JOIN plugin_categories pc ON pc.id = p.category_id
    LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = true
    WHERE ${isUuid ? 'p.id = $1' : 'p.slug = $1'}
  `, [idOrSlug]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Plugin', idOrSlug);
    }
    // Fetch dependencies
    const depsResult = await dbClient.query(`
    SELECT pd.id, pd.depends_on_plugin_id, pd.min_version, pd.max_version, pd.is_optional,
           p.name as dependency_name, p.slug as dependency_slug, p.icon_url as dependency_icon_url
    FROM plugin_dependencies pd
    JOIN plugins p ON p.id = pd.depends_on_plugin_id
    WHERE pd.plugin_id = $1
  `, [result.rows[0]?.id]);
    const data = { ...(result.rows[0] || {}), dependencies: depsResult.rows };
    res.json({ success: true, data });
}));
/**
 * GET /api/v1/marketplace/plugins/:idOrSlug/versions
 * Get version history for a plugin
 */
router.get('/:idOrSlug/versions', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const idOrSlug = req.params['idOrSlug'];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const result = await dbClient.query(`
    SELECT pv.*
    FROM plugin_versions pv
    JOIN plugins p ON p.id = pv.plugin_id
    WHERE ${isUuid ? 'p.id = $1' : 'p.slug = $1'}
    ORDER BY pv.created_at DESC
  `, [idOrSlug]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /api/v1/marketplace/plugins
 * Create a new plugin (SUPERUSER only)
 */
router.post('/', authMiddleware, requirePermission('MARKETPLACE', 'CREATE'), validate(createPluginSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { name, slug, description, short_description, category_id, publisher_tenant_id, publisher_name, icon_url, homepage_url, repository_url, license, pricing_model = 'free', price_cents, currency = 'EUR', tags, screenshot_urls, banner_url, } = req.body;
    if (!name || !publisher_name) {
        throw Errors.badRequest('name and publisher_name are required');
    }
    const pluginSlug = slug ||
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 200);
    // Check duplicate slug
    const existing = await dbClient.query('SELECT id FROM plugins WHERE slug = $1', [pluginSlug]);
    if (existing.rows.length > 0) {
        throw Errors.conflict('A plugin with this slug already exists', { slug: pluginSlug });
    }
    const result = await dbClient.query(`
    INSERT INTO plugins (
      name, slug, description, short_description, category_id,
      publisher_tenant_id, publisher_name, icon_url, homepage_url,
      repository_url, license, pricing_model, price_cents, currency, tags, status,
      screenshot_urls, banner_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', $16, $17)
    RETURNING *
  `, [
        name,
        pluginSlug,
        description || null,
        short_description || null,
        category_id || null,
        publisher_tenant_id || null,
        publisher_name,
        icon_url || null,
        homepage_url || null,
        repository_url || null,
        license || 'proprietary',
        pricing_model,
        price_cents || 0,
        currency,
        tags || '{}',
        screenshot_urls || '{}',
        banner_url || null,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PUT /api/v1/marketplace/plugins/:id
 * Update a plugin (SUPERUSER only)
 */
router.put('/:id', authMiddleware, requirePermission('MARKETPLACE', 'EDIT'), validate(updatePluginSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const { name, description, short_description, category_id, publisher_name, icon_url, homepage_url, repository_url, license, pricing_model, price_cents, currency, tags, status, visibility, featured, screenshot_urls, banner_url, } = req.body;
    const existing = await dbClient.query('SELECT id, status FROM plugins WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Plugin', id);
    }
    const result = await dbClient.query(`
    UPDATE plugins SET
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      short_description = COALESCE($4, short_description),
      category_id = COALESCE($5, category_id),
      publisher_name = COALESCE($6, publisher_name),
      icon_url = COALESCE($7, icon_url),
      homepage_url = COALESCE($8, homepage_url),
      repository_url = COALESCE($9, repository_url),
      license = COALESCE($10, license),
      pricing_model = COALESCE($11, pricing_model),
      price_cents = COALESCE($12, price_cents),
      currency = COALESCE($13, currency),
      tags = COALESCE($14, tags),
      status = COALESCE($15, status),
      visibility = COALESCE($16, visibility),
      featured = COALESCE($17, featured),
      screenshot_urls = COALESCE($18, screenshot_urls),
      banner_url = COALESCE($19, banner_url),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
        id,
        name || null,
        description || null,
        short_description || null,
        category_id || null,
        publisher_name || null,
        icon_url || null,
        homepage_url || null,
        repository_url || null,
        license || null,
        pricing_model || null,
        price_cents ?? null,
        currency || null,
        tags || null,
        status || null,
        visibility || null,
        featured ?? null,
        screenshot_urls || null,
        banner_url || null,
    ]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /api/v1/marketplace/plugins/:id
 * Delete a plugin (SUPERUSER only - only if no active installations)
 */
router.delete('/:id', authMiddleware, requirePermission('MARKETPLACE', 'DELETE'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const installCheck = await dbClient.query(`SELECT COUNT(*) FROM plugin_installations
     WHERE plugin_id = $1 AND status IN ('active', 'disabled')`, [id]);
    if (parseInt(installCheck.rows[0].count) > 0) {
        throw Errors.badRequest('Cannot delete plugin with active installations');
    }
    const result = await dbClient.query('DELETE FROM plugins WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Plugin', id);
    }
    res.json({ success: true, message: 'Plugin deleted' });
}));
/**
 * PATCH /api/v1/marketplace/plugins/:id/publish
 * Publish a plugin (SUPERUSER only - change status to published)
 */
router.patch('/:id/publish', authMiddleware, requirePermission('MARKETPLACE', 'EDIT'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const result = await dbClient.query(`
    UPDATE plugins
    SET status = 'published', updated_at = NOW()
    WHERE id = $1 AND status IN ('draft', 'pending_review')
    RETURNING id, name, status
  `, [id]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Plugin', id);
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Plugin published' });
}));
/**
 * POST /api/v1/marketplace/plugins/:id/versions
 * Create a new version for a plugin (SUPERUSER only)
 */
router.post('/:id/versions', authMiddleware, requirePermission('MARKETPLACE', 'CREATE'), validate(createPluginVersionSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const pluginId = req.params['id'];
    const { version, release_notes, changelog, config_schema, permissions_required, entry_point } = req.body;
    if (!version) {
        throw Errors.badRequest('version is required');
    }
    // Verify plugin exists
    const pluginCheck = await dbClient.query('SELECT id FROM plugins WHERE id = $1', [pluginId]);
    if (pluginCheck.rows.length === 0) {
        throw Errors.notFound('Plugin', pluginId);
    }
    // Unmark current latest
    await dbClient.query('UPDATE plugin_versions SET is_latest = false WHERE plugin_id = $1 AND is_latest = true', [pluginId]);
    const result = await dbClient.query(`
    INSERT INTO plugin_versions (
      plugin_id, version, release_notes, changelog, config_schema,
      permissions_required, entry_point, status, is_latest, published_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', true, NOW())
    RETURNING *
  `, [
        pluginId,
        version,
        release_notes || null,
        changelog || null,
        config_schema ? JSON.stringify(config_schema) : '{}',
        permissions_required || '{}',
        entry_point || null,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /api/v1/marketplace/plugins/:id/dependencies
 * Add a dependency to a plugin (SUPERUSER only)
 */
router.post('/:id/dependencies', authMiddleware, requirePermission('MARKETPLACE', 'CREATE'), validate(createPluginDependencySchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const { depends_on_plugin_id, min_version, max_version, is_optional = false } = req.body;
    if (!depends_on_plugin_id) {
        throw Errors.badRequest('depends_on_plugin_id is required');
    }
    // Verify both plugins exist
    const pluginCheck = await dbClient.query('SELECT id FROM plugins WHERE id = $1', [id]);
    if (pluginCheck.rows.length === 0) {
        throw Errors.notFound('Plugin', id);
    }
    const depCheck = await dbClient.query('SELECT id FROM plugins WHERE id = $1', [
        depends_on_plugin_id,
    ]);
    if (depCheck.rows.length === 0) {
        throw Errors.badRequest('Dependency plugin not found');
    }
    const result = await dbClient.query(`
    INSERT INTO plugin_dependencies (plugin_id, depends_on_plugin_id, min_version, max_version, is_optional)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [id, depends_on_plugin_id, min_version || null, max_version || null, is_optional]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /api/v1/marketplace/plugins/:id/dependencies/:depId
 * Remove a dependency from a plugin (SUPERUSER only)
 */
router.delete('/:id/dependencies/:depId', authMiddleware, requirePermission('MARKETPLACE', 'DELETE'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const depId = req.params['depId'];
    const result = await dbClient.query('DELETE FROM plugin_dependencies WHERE id = $1 RETURNING id', [depId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Dependency', depId);
    }
    res.json({ success: true, message: 'Dependency removed' });
}));
/**
 * GET /api/v1/marketplace/plugins/:id/dependents
 * Get plugins that depend on this plugin (reverse lookup)
 */
router.get('/:id/dependents', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const id = req.params['id'];
    const result = await dbClient.query(`
    SELECT pd.id as dependency_id, pd.min_version, pd.max_version, pd.is_optional,
           p.id as plugin_id, p.name, p.slug, p.icon_url, p.status
    FROM plugin_dependencies pd
    JOIN plugins p ON p.id = pd.plugin_id
    WHERE pd.depends_on_plugin_id = $1
    ORDER BY p.name
  `, [id]);
    res.json({ success: true, data: result.rows });
}));
export default router;
//# sourceMappingURL=marketplace-plugins.js.map