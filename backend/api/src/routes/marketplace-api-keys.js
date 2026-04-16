/**
 * Marketplace Plugin API Keys Routes
 * Per-tenant API key management for plugin integrations.
 * Schema (plugin_api_keys):
 *   id, tenant_id, plugin_installation_id, name, key_hash, key_prefix,
 *   scopes, expires_at, last_used_at, is_active, created_by, created_at, revoked_at
 */
import { Router } from 'express';
import crypto from 'crypto';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createMarketplaceApiKeySchema } from '../schemas/marketplace-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context
router.use(requireTenant);
/**
 * Generate a random API key with a readable prefix
 */
function generateApiKey() {
    const prefix = 'hpk_'; // heuresys plugin key
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const key = `${prefix}${randomBytes}`;
    const keyPrefix = key.substring(0, 12);
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, prefix: keyPrefix, hash };
}
/**
 * GET /api/v1/marketplace/api-keys
 * List API keys for the current tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { plugin_installation_id, is_active, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        k.id, k.plugin_installation_id, k.name, k.key_prefix,
        k.scopes, k.expires_at, k.last_used_at, k.is_active,
        k.created_by, k.created_at, k.revoked_at,
        p.name as plugin_name, p.slug as plugin_slug,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM plugin_api_keys k
      JOIN plugin_installations pi ON pi.id = k.plugin_installation_id
      JOIN plugins p ON p.id = pi.plugin_id
      LEFT JOIN users u ON k.created_by = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE k.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (plugin_installation_id) {
        query += ` AND k.plugin_installation_id = $${paramIndex}`;
        params.push(plugin_installation_id);
        paramIndex++;
    }
    if (is_active !== undefined) {
        query += ` AND k.is_active = $${paramIndex}`;
        params.push(is_active === 'true' ? 'true' : 'false');
        paramIndex++;
    }
    query += ` ORDER BY k.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/marketplace/api-keys/:id
 * Get a specific API key (without the actual key value)
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        k.id, k.plugin_installation_id, k.name, k.key_prefix,
        k.scopes, k.expires_at, k.last_used_at, k.is_active,
        k.created_by, k.created_at, k.revoked_at,
        p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_api_keys k
      JOIN plugin_installations pi ON pi.id = k.plugin_installation_id
      JOIN plugins p ON p.id = pi.plugin_id
      WHERE k.id = $1 AND k.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('API key');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /api/v1/marketplace/api-keys
 * Create a new API key for a plugin installation
 * Returns the full key only once at creation time
 */
router.post('/', validate(createMarketplaceApiKeySchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { plugin_installation_id, name, scopes, expires_at, created_by } = req.body;
    if (!plugin_installation_id || !name) {
        throw Errors.badRequest('plugin_installation_id and name are required');
    }
    // Verify installation exists and belongs to tenant
    const installCheck = await req.dbClient.query(`SELECT id FROM plugin_installations
       WHERE id = $1 AND tenant_id = $2 AND status IN ('active', 'disabled')`, [plugin_installation_id, tenantId]);
    if (installCheck.rows.length === 0) {
        throw Errors.badRequest('Plugin installation not found or not active for this tenant');
    }
    const { key, prefix, hash } = generateApiKey();
    const result = await req.dbClient.query(`
      INSERT INTO plugin_api_keys (
        tenant_id, plugin_installation_id, name, key_hash, key_prefix,
        scopes, expires_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, plugin_installation_id, name, key_prefix, scopes,
                expires_at, is_active, created_by, created_at
    `, [
        tenantId,
        plugin_installation_id,
        name,
        hash,
        prefix,
        scopes || '{}',
        expires_at || null,
        created_by || null,
    ]);
    // Return the full key only at creation time
    const data = { ...(result.rows[0] || {}), key };
    res.status(201).json({ success: true, data });
}));
/**
 * PATCH /api/v1/marketplace/api-keys/:id/revoke
 * Revoke an API key
 */
router.patch('/:id/revoke', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE plugin_api_keys
      SET is_active = false, revoked_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND is_active = true
      RETURNING id, name, key_prefix, is_active, revoked_at
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Active API key');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'API key revoked' });
}));
/**
 * DELETE /api/v1/marketplace/api-keys/:id
 * Delete an API key permanently
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM plugin_api_keys WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('API key');
    }
    res.json({ success: true, message: 'API key deleted' });
}));
export default router;
//# sourceMappingURL=marketplace-api-keys.js.map