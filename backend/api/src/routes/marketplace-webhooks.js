/**
 * Marketplace Plugin Webhooks Routes
 * Webhook endpoint registration and delivery tracking for plugins.
 * Schema (plugin_webhooks):
 *   id, tenant_id, plugin_installation_id, url, secret_hash, events,
 *   is_active, description, created_by, created_at, updated_at
 * Schema (plugin_webhook_deliveries):
 *   id, webhook_id, event_type, payload, response_status, response_body,
 *   response_headers, duration_ms, status, attempt_number, next_retry_at,
 *   delivered_at, created_at
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createWebhookSchema, updateWebhookSchema } from '../schemas/marketplace.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context
router.use(requireTenant);
/**
 * GET /api/v1/marketplace/webhooks
 * List webhooks for the current tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { plugin_installation_id, is_active, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        w.id, w.plugin_installation_id, w.url, w.events,
        w.is_active, w.description, w.created_by, w.created_at, w.updated_at,
        p.name as plugin_name, p.slug as plugin_slug,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM plugin_webhooks w
      JOIN plugin_installations pi ON pi.id = w.plugin_installation_id
      JOIN plugins p ON p.id = pi.plugin_id
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE w.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (plugin_installation_id) {
        query += ` AND w.plugin_installation_id = $${paramIndex}`;
        params.push(plugin_installation_id);
        paramIndex++;
    }
    if (is_active !== undefined) {
        query += ` AND w.is_active = $${paramIndex}`;
        params.push(is_active === 'true' ? 'true' : 'false');
        paramIndex++;
    }
    query += ` ORDER BY w.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /api/v1/marketplace/webhooks/:id
 * Get a specific webhook
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        w.id, w.plugin_installation_id, w.url, w.events,
        w.is_active, w.description, w.created_by, w.created_at, w.updated_at,
        p.name as plugin_name, p.slug as plugin_slug
      FROM plugin_webhooks w
      JOIN plugin_installations pi ON pi.id = w.plugin_installation_id
      JOIN plugins p ON p.id = pi.plugin_id
      WHERE w.id = $1 AND w.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Webhook');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /api/v1/marketplace/webhooks
 * Register a new webhook endpoint
 */
router.post('/', validate(createWebhookSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { plugin_installation_id, url, secret, events, description, created_by } = req.body;
    if (!plugin_installation_id || !url) {
        throw Errors.badRequest('plugin_installation_id and url are required');
    }
    // Verify installation exists and belongs to tenant
    const installCheck = await req.dbClient.query(`SELECT id FROM plugin_installations
       WHERE id = $1 AND tenant_id = $2 AND status IN ('active', 'disabled')`, [plugin_installation_id, tenantId]);
    if (installCheck.rows.length === 0) {
        throw Errors.badRequest('Plugin installation not found or not active for this tenant');
    }
    // Hash the secret if provided
    let secretHash = null;
    if (secret) {
        const crypto = await import('crypto');
        secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    }
    const result = await req.dbClient.query(`
      INSERT INTO plugin_webhooks (
        tenant_id, plugin_installation_id, url, secret_hash,
        events, description, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, plugin_installation_id, url, events, is_active,
                description, created_by, created_at
    `, [
        tenantId,
        plugin_installation_id,
        url,
        secretHash,
        events || '{}',
        description || null,
        created_by || null,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PUT /api/v1/marketplace/webhooks/:id
 * Update a webhook
 */
router.put('/:id', validate(updateWebhookSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { url, events, is_active, description } = req.body;
    const result = await req.dbClient.query(`
      UPDATE plugin_webhooks SET
        url = COALESCE($3, url),
        events = COALESCE($4, events),
        is_active = COALESCE($5, is_active),
        description = COALESCE($6, description),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [id, tenantId, url || null, events || null, is_active ?? null, description || null]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Webhook');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /api/v1/marketplace/webhooks/:id
 * Delete a webhook and its delivery history
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM plugin_webhooks WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Webhook');
    }
    res.json({ success: true, message: 'Webhook deleted' });
}));
/**
 * GET /api/v1/marketplace/webhooks/:id/deliveries
 * List delivery attempts for a webhook
 */
router.get('/:id/deliveries', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { status, limit = '50', offset = '0' } = req.query;
    // Verify webhook belongs to tenant
    const webhookCheck = await req.dbClient.query('SELECT id FROM plugin_webhooks WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (webhookCheck.rows.length === 0) {
        throw Errors.notFound('Webhook');
    }
    let query = `
      SELECT
        d.id, d.webhook_id, d.event_type, d.payload,
        d.response_status, d.response_body, d.response_headers,
        d.duration_ms, d.status, d.attempt_number,
        d.next_retry_at, d.delivered_at, d.created_at
      FROM plugin_webhook_deliveries d
      WHERE d.webhook_id = $1
    `;
    const params = [id];
    let paramIndex = 2;
    if (status) {
        query += ` AND d.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY d.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM plugin_webhook_deliveries WHERE webhook_id = $1';
    const countParams = [id];
    if (status) {
        countQuery += ' AND status = $2';
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
 * GET /api/v1/marketplace/webhooks/:id/deliveries/:deliveryId
 * Get a specific delivery attempt
 */
router.get('/:id/deliveries/:deliveryId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const deliveryId = req.params['deliveryId'];
    // Verify webhook belongs to tenant
    const webhookCheck = await req.dbClient.query('SELECT id FROM plugin_webhooks WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (webhookCheck.rows.length === 0) {
        throw Errors.notFound('Webhook');
    }
    const result = await req.dbClient.query(`
      SELECT id, webhook_id, event_type, payload, response_status, response_body,
        response_headers, duration_ms, status, attempt_number, next_retry_at,
        delivered_at, created_at
      FROM plugin_webhook_deliveries
      WHERE id = $1 AND webhook_id = $2
    `, [deliveryId, id]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Delivery');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /api/v1/marketplace/webhooks/:id/test
 * Send a test delivery to a webhook
 */
router.post('/:id/test', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify webhook belongs to tenant and is active
    const webhookCheck = await req.dbClient.query('SELECT id, url, events FROM plugin_webhooks WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (webhookCheck.rows.length === 0) {
        throw Errors.notFound('Webhook');
    }
    // Create a test delivery record
    const result = await req.dbClient.query(`
      INSERT INTO plugin_webhook_deliveries (
        webhook_id, event_type, payload, status
      )
      VALUES ($1, 'webhook.test', $2, 'pending')
      RETURNING *
    `, [
        id,
        JSON.stringify({
            type: 'webhook.test',
            timestamp: new Date().toISOString(),
            data: { message: 'Test delivery' },
        }),
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        message: 'Test delivery created',
    });
}));
export default router;
//# sourceMappingURL=marketplace-webhooks.js.map