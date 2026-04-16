/**
 * Webhook Dispatcher Service
 * Dispatches webhook events to registered plugin webhook endpoints.
 * Logs delivery attempts to plugin_webhook_deliveries.
 */
export type WebhookEvent = 'plugin.installed' | 'plugin.uninstalled' | 'plugin.enabled' | 'plugin.disabled' | 'plugin.updated' | 'plugin.configured';
/**
 * Dispatch webhooks for a plugin installation event.
 * Fires and forgets — does not block the caller.
 */
export declare function dispatchWebhooks(tenantId: string, installationId: string, event: WebhookEvent, data: Record<string, unknown>): void;
//# sourceMappingURL=webhook-dispatcher.d.ts.map