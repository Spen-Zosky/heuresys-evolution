/**
 * Webhook Dispatcher Service
 * Dispatches webhook events to registered plugin webhook endpoints.
 * Logs delivery attempts to plugin_webhook_deliveries.
 */
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
/**
 * Dispatch webhooks for a plugin installation event.
 * Fires and forgets — does not block the caller.
 */
export function dispatchWebhooks(tenantId, installationId, event, data) {
    // Fire-and-forget
    void dispatchWebhooksAsync(tenantId, installationId, event, data);
}
async function dispatchWebhooksAsync(tenantId, installationId, event, data) {
    try {
        const result = await pool.query(`
      SELECT id, url, secret_hash, events
      FROM plugin_webhooks
      WHERE tenant_id = $1
        AND plugin_installation_id = $2
        AND is_active = true
        AND ($3 = ANY(events) OR events = '{}')
    `, [tenantId, installationId, event]);
        for (const webhook of result.rows) {
            void deliverWebhook(webhook, event, data);
        }
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.webhook-dispatcher');
    }
}
async function deliverWebhook(webhook, event, data) {
    const payload = JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
    });
    const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
    };
    // Sign payload if webhook has a secret
    if (webhook.secret_hash) {
        const signature = crypto
            .createHmac('sha256', webhook.secret_hash)
            .update(payload)
            .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }
    const startTime = Date.now();
    let responseStatus = null;
    let responseBody = null;
    let status = 'failed';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: payload,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        responseStatus = response.status;
        responseBody = await response.text().catch(() => null);
        status = response.ok ? 'success' : 'failed';
    }
    catch (_error) {
        responseBody = _error instanceof Error ? _error.message : 'Unknown error';
    }
    const durationMs = Date.now() - startTime;
    // Log delivery attempt
    try {
        await pool.query(`
      INSERT INTO plugin_webhook_deliveries (
        webhook_id, event_type, payload, response_status, response_body,
        duration_ms, status, delivered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
            webhook.id,
            event,
            payload,
            responseStatus,
            responseBody ? responseBody.substring(0, 5000) : null,
            durationMs,
            status,
            status === 'success' ? new Date().toISOString() : null,
        ]);
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.webhook-dispatcher');
    }
}
//# sourceMappingURL=webhook-dispatcher.js.map