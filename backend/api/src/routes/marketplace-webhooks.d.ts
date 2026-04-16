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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=marketplace-webhooks.d.ts.map