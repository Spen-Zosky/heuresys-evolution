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
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { dispatchWebhooks } from '../services/webhook-dispatcher.js';
import { validate } from '../middleware/validate.js';
import { createInstallationSchema, updateInstallationConfigSchema, disableInstallationSchema, } from '../schemas/marketplace.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context
router.use(requireTenant);
/**
 * GET /api/v1/marketplace/installations/stats
 * Get installation statistics for the current tenant
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'disabled') as disabled
      FROM plugin_installations
      WHERE tenant_id = $1
    `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /api/v1/marketplace/installations
 * List installed plugins for the current tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status = 'active', limit = '50', offset = '0' } = req.query;
    let query = `
      SELECT
        i.id, i.plugin_id, i.plugin_version_id, i.installed_by,
        i.status, i.auto_update, i.installed_at, i.updated_at,
        i.disabled_at, i.disabled_reason,
        p.name as plugin_name, p.slug as plugin_slug, p.short_description,
        p.icon_url, p.category_id, p.publisher_name, p.featured,
        pv.version as installed_version,
        pv_latest.version as latest_version,
        e.first_name || ' ' || e.last_name as installed_by_name
      FROM plugin_installations i
      JOIN plugins p ON i.plugin_id = p.id
      LEFT JOIN plugin_versions pv ON i.plugin_version_id = pv.id
      LEFT JOIN plugin_versions pv_latest ON pv_latest.plugin_id = p.id AND pv_latest.is_latest = true
      LEFT JOIN users u ON i.installed_by = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE i.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (status && status !== 'all') {
        query += ` AND i.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY i.installed_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM plugin_installations
      WHERE tenant_id = $1
    `;
    const countParams = [tenantId];
    const countParamIndex = 2;
    if (status && status !== 'all') {
        countQuery += ` AND status = $${countParamIndex}`;
        countParams.push(status);
    }
    const countResult = await req.dbClient.query(countQuery, countParams);
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
 * GET /api/v1/marketplace/installations/:id
 * Get a specific installation with its configuration
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        i.*,
        p.name as plugin_name, p.slug as plugin_slug, p.description as plugin_description,
        p.icon_url, p.category_id, p.publisher_name, p.featured,
        pv.version as installed_version, pv.config_schema,
        pv_latest.version as latest_version,
        e.first_name || ' ' || e.last_name as installed_by_name
      FROM plugin_installations i
      JOIN plugins p ON i.plugin_id = p.id
      LEFT JOIN plugin_versions pv ON i.plugin_version_id = pv.id
      LEFT JOIN plugin_versions pv_latest ON pv_latest.plugin_id = p.id AND pv_latest.is_latest = true
      LEFT JOIN users u ON i.installed_by = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE i.id = $1 AND i.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Installation');
    }
    // Get configuration if exists
    const configResult = await req.dbClient.query(`
      SELECT config_data, config_version, updated_by, updated_at
      FROM plugin_configurations
      WHERE plugin_installation_id = $1 AND tenant_id = $2
      ORDER BY config_version DESC
      LIMIT 1
    `, [id, tenantId]);
    const data = result.rows[0];
    data.configuration = configResult.rows.length > 0 ? configResult.rows[0] : null;
    res.json({ success: true, data });
}));
/**
 * POST /api/v1/marketplace/installations
 * Install a plugin for the current tenant
 */
router.post('/', validate(createInstallationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { plugin_id, installed_by, auto_update = true } = req.body;
    if (!plugin_id) {
        throw Errors.badRequest('plugin_id is required');
    }
    // Verify plugin exists and is published
    const pluginCheck = await req.dbClient.query('SELECT id FROM plugins WHERE id = $1 AND status = $2', [plugin_id, 'published']);
    if (pluginCheck.rows.length === 0) {
        throw Errors.badRequest('Plugin not found or not available for installation');
    }
    // Check required dependencies
    const depsResult = await req.dbClient.query(`
      SELECT pd.depends_on_plugin_id, p.name, pd.is_optional
      FROM plugin_dependencies pd
      JOIN plugins p ON p.id = pd.depends_on_plugin_id
      WHERE pd.plugin_id = $1 AND pd.is_optional = false
    `, [plugin_id]);
    if (depsResult.rows.length > 0) {
        const installedDeps = await req.dbClient.query(`SELECT plugin_id FROM plugin_installations
         WHERE tenant_id = $1 AND status IN ('active', 'disabled') AND plugin_id = ANY($2)`, [
            tenantId,
            depsResult.rows.map((r) => r.depends_on_plugin_id),
        ]);
        const installedSet = new Set(installedDeps.rows.map((r) => r.plugin_id));
        const missing = depsResult.rows.filter((d) => !installedSet.has(d.depends_on_plugin_id));
        if (missing.length > 0) {
            throw Errors.badRequest('Missing required dependencies', {
                code: 'MISSING_DEPENDENCIES',
                missing: missing.map((d) => ({
                    id: d.depends_on_plugin_id,
                    name: d.name,
                })),
            });
        }
    }
    // Get latest version
    const versionCheck = await req.dbClient.query('SELECT id FROM plugin_versions WHERE plugin_id = $1 AND is_latest = true', [plugin_id]);
    if (versionCheck.rows.length === 0) {
        throw Errors.badRequest('Plugin has no published version');
    }
    const latestVersionId = versionCheck.rows[0]?.id;
    // Check if already installed (active or disabled) for this tenant
    const existingInstall = await req.dbClient.query(`SELECT id FROM plugin_installations
       WHERE plugin_id = $1 AND tenant_id = $2 AND status IN ('active', 'disabled')`, [plugin_id, tenantId]);
    if (existingInstall.rows.length > 0) {
        throw Errors.conflict('Plugin is already installed for this tenant');
    }
    const result = await req.dbClient.query(`
      INSERT INTO plugin_installations (
        tenant_id, plugin_id, plugin_version_id, installed_by,
        status, auto_update
      )
      VALUES ($1, $2, $3, $4, 'active', $5)
      RETURNING *
    `, [tenantId, plugin_id, latestVersionId, installed_by || null, auto_update]);
    // Increment installation count on the plugin
    await req.dbClient.query('UPDATE plugins SET total_installations = total_installations + 1 WHERE id = $1', [plugin_id]);
    // Dispatch webhook event
    dispatchWebhooks(tenantId, result.rows[0]?.id, 'plugin.installed', { plugin_id });
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PUT /api/v1/marketplace/installations/:id/configuration
 * Update or create plugin configuration
 */
router.put('/:id/configuration', validate(updateInstallationConfigSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { config_data, updated_by } = req.body;
    if (!config_data || typeof config_data !== 'object') {
        throw Errors.badRequest('config_data object is required');
    }
    // Verify installation exists
    const installCheck = await req.dbClient.query(`SELECT id FROM plugin_installations
       WHERE id = $1 AND tenant_id = $2 AND status IN ('active', 'disabled')`, [id, tenantId]);
    if (installCheck.rows.length === 0) {
        throw Errors.notFound('Installation');
    }
    // Upsert configuration (UNIQUE on tenant_id, plugin_installation_id)
    const result = await req.dbClient.query(`
      INSERT INTO plugin_configurations (
        tenant_id, plugin_installation_id, config_data, config_version, updated_by
      )
      VALUES ($1, $2, $3, 1, $4)
      ON CONFLICT (tenant_id, plugin_installation_id)
      DO UPDATE SET
        config_data = $3,
        config_version = plugin_configurations.config_version + 1,
        updated_by = $4,
        updated_at = NOW()
      RETURNING *
    `, [tenantId, id, JSON.stringify(config_data), updated_by || null]);
    // Dispatch webhook event
    dispatchWebhooks(tenantId, id, 'plugin.configured', {
        config_version: result.rows[0]?.config_version,
    });
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * PATCH /api/v1/marketplace/installations/:id/disable
 * Disable an installed plugin
 */
router.patch('/:id/disable', validate(disableInstallationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { reason } = req.body;
    const result = await req.dbClient.query(`
      UPDATE plugin_installations
      SET status = 'disabled', disabled_at = NOW(), disabled_reason = $3, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'active'
      RETURNING id, status, disabled_at, disabled_reason
    `, [id, tenantId, reason || null]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Active installation');
    }
    // Dispatch webhook event
    dispatchWebhooks(tenantId, id, 'plugin.disabled', { reason: reason || null });
    res.json({ success: true, data: result.rows[0] || null, message: 'Plugin disabled' });
}));
/**
 * PATCH /api/v1/marketplace/installations/:id/enable
 * Re-enable a disabled plugin
 */
router.patch('/:id/enable', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE plugin_installations
      SET status = 'active', disabled_at = NULL, disabled_reason = NULL, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'disabled'
      RETURNING id, status
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Disabled installation');
    }
    // Dispatch webhook event
    dispatchWebhooks(tenantId, id, 'plugin.enabled', {});
    res.json({ success: true, data: result.rows[0] || null, message: 'Plugin enabled' });
}));
/**
 * DELETE /api/v1/marketplace/installations/:id
 * Uninstall a plugin (hard delete)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Get plugin_id before deleting for counter update
    const installResult = await req.dbClient.query(`SELECT id, plugin_id FROM plugin_installations
       WHERE id = $1 AND tenant_id = $2 AND status IN ('active', 'disabled')`, [id, tenantId]);
    if (installResult.rows.length === 0) {
        throw Errors.notFound('Installation');
    }
    const pluginId = installResult.rows[0]?.plugin_id;
    // Check for active dependents
    const dependentCheck = await req.dbClient.query(`
      SELECT pi.id, p.name
      FROM plugin_installations pi
      JOIN plugin_dependencies pd ON pd.plugin_id = pi.plugin_id
      JOIN plugins p ON p.id = pi.plugin_id
      WHERE pd.depends_on_plugin_id = $1 AND pi.tenant_id = $2
        AND pi.status IN ('active', 'disabled') AND pd.is_optional = false
    `, [pluginId, tenantId]);
    if (dependentCheck.rows.length > 0) {
        throw Errors.badRequest('Cannot uninstall: other installed plugins depend on this plugin', {
            code: 'HAS_DEPENDENTS',
            dependents: dependentCheck.rows.map((r) => ({
                id: r.id,
                name: r.name,
            })),
        });
    }
    // Dispatch webhook event before deletion
    dispatchWebhooks(tenantId, id, 'plugin.uninstalled', { plugin_id: pluginId });
    // Delete associated configurations first
    await req.dbClient.query('DELETE FROM plugin_configurations WHERE plugin_installation_id = $1 AND tenant_id = $2', [id, tenantId]);
    // Delete the installation
    await req.dbClient.query('DELETE FROM plugin_installations WHERE id = $1 AND tenant_id = $2', [
        id,
        tenantId,
    ]);
    // Decrement installation count
    await req.dbClient.query('UPDATE plugins SET total_installations = GREATEST(total_installations - 1, 0) WHERE id = $1', [pluginId]);
    res.json({ success: true, message: 'Plugin uninstalled' });
}));
/**
 * PATCH /api/v1/marketplace/installations/:id/update
 * Update plugin to latest version
 */
router.patch('/:id/update', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Get installation and version info
    const installResult = await req.dbClient.query(`
      SELECT
        i.id, i.plugin_id, i.plugin_version_id,
        pv.version as installed_version,
        pv_latest.id as latest_version_id,
        pv_latest.version as latest_version
      FROM plugin_installations i
      JOIN plugin_versions pv ON i.plugin_version_id = pv.id
      LEFT JOIN plugin_versions pv_latest ON pv_latest.plugin_id = i.plugin_id AND pv_latest.is_latest = true
      WHERE i.id = $1 AND i.tenant_id = $2 AND i.status = 'active'
    `, [id, tenantId]);
    if (installResult.rows.length === 0) {
        throw Errors.notFound('Active installation');
    }
    const install = installResult.rows[0];
    if (install.plugin_version_id === install.latest_version_id) {
        res.json({
            success: true,
            data: { id: install.id, version: install.installed_version },
            message: 'Plugin is already at the latest version',
        });
        return;
    }
    const result = await req.dbClient.query(`
      UPDATE plugin_installations
      SET plugin_version_id = $3, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, plugin_version_id
    `, [id, tenantId, install.latest_version_id]);
    // Dispatch webhook event
    dispatchWebhooks(tenantId, id, 'plugin.updated', {
        from_version: install.installed_version,
        to_version: install.latest_version,
    });
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: `Plugin updated from ${install.installed_version} to ${install.latest_version}`,
    });
}));
export default router;
//# sourceMappingURL=marketplace-installations.js.map