/**
 * Marketplace API Endpoints - Heuresys Platform
 *
 * Backend routes:
 *   /api/v1/marketplace/plugins    - Browse catalog (marketplace-plugins.ts)
 *   /api/v1/marketplace/installations - Tenant installs (marketplace-installations.ts)
 *   /api/v1/marketplace/reviews    - Reviews (marketplace-reviews.ts)
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  Plugin,
  PluginCategory,
  PluginVersion,
  PluginInstallation,
  PluginReview,
  ReviewSummary,
  OffsetMeta,
  PluginFilters,
  InstallPluginRequest,
  UpdatePluginConfigRequest,
  CreatePluginReviewRequest,
  CreatePluginRequest,
  UpdatePluginRequest,
  SubmitPluginForReviewRequest,
  PluginDependency,
  PluginApiKey,
  CreatePluginApiKeyRequest,
  CreatePluginApiKeyResponse,
  PluginWebhook,
  PluginWebhookDelivery,
  CreatePluginWebhookRequest,
  UpdatePluginWebhookRequest,
  PluginHook,
  PluginUISlot,
  PluginHookExecution,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/marketplace';

// ============================================
// PLUGIN CATALOG
// ============================================

/**
 * Get marketplace statistics (platform-wide)
 */
export async function getStats(options?: RequestOptions): Promise<Record<string, number | string>> {
  const response = await apiClient.get<ApiResponse<Record<string, number | string>>>(
    `${BASE_PATH}/plugins/stats`,
    options
  );
  return response.data;
}

/**
 * Get plugin categories with counts
 */
export async function getCategories(options?: RequestOptions): Promise<PluginCategory[]> {
  const response = await apiClient.get<ApiResponse<PluginCategory[]>>(
    `${BASE_PATH}/plugins/categories`,
    options
  );
  return response.data;
}

/**
 * Get featured plugins
 */
export async function getFeaturedPlugins(
  limit?: number,
  options?: RequestOptions
): Promise<Plugin[]> {
  const queryString = limit ? buildQueryString({ limit }) : '';
  const response = await apiClient.get<ApiResponse<Plugin[]>>(
    `${BASE_PATH}/plugins/featured${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get paginated list of published plugins
 *
 * Backend returns: { success, data: Plugin[], meta: { total, limit, offset } }
 */
export async function getPlugins(
  params?: PluginFilters,
  options?: RequestOptions
): Promise<{ plugins: Plugin[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: Plugin[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/plugins${queryString}`, options);
  return { plugins: response.data, meta: response.meta };
}

/**
 * Get plugin by ID or slug
 */
export async function getPluginById(idOrSlug: string, options?: RequestOptions): Promise<Plugin> {
  const response = await apiClient.get<ApiResponse<Plugin>>(
    `${BASE_PATH}/plugins/${idOrSlug}`,
    options
  );
  return response.data;
}

/**
 * Get version history for a plugin
 */
export async function getPluginVersions(
  idOrSlug: string,
  options?: RequestOptions
): Promise<PluginVersion[]> {
  const response = await apiClient.get<ApiResponse<PluginVersion[]>>(
    `${BASE_PATH}/plugins/${idOrSlug}/versions`,
    options
  );
  return response.data;
}

// ============================================
// PLUGIN INSTALLATIONS (tenant-scoped)
// ============================================

/**
 * Get installation stats for current tenant
 */
export async function getInstallationStats(
  options?: RequestOptions
): Promise<{ total: number; active: number; disabled: number; uninstalled: number }> {
  const response = await apiClient.get<
    ApiResponse<{ total: number; active: number; disabled: number; uninstalled: number }>
  >(`${BASE_PATH}/installations/stats`, options);
  return response.data;
}

/**
 * Get installed plugins for current tenant
 *
 * Backend returns: { success, data: PluginInstallation[], meta: { total, limit, offset } }
 */
export async function getInstallations(
  params?: { status?: string; limit?: number; offset?: number },
  options?: RequestOptions
): Promise<{ installations: PluginInstallation[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: PluginInstallation[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/installations${queryString}`, options);
  return { installations: response.data, meta: response.meta };
}

/**
 * Get a specific installation
 */
export async function getInstallationById(
  id: string,
  options?: RequestOptions
): Promise<PluginInstallation> {
  const response = await apiClient.get<ApiResponse<PluginInstallation>>(
    `${BASE_PATH}/installations/${id}`,
    options
  );
  return response.data;
}

/**
 * Install a plugin for the current tenant
 */
export async function installPlugin(
  data: InstallPluginRequest,
  options?: RequestOptions
): Promise<PluginInstallation> {
  const response = await apiClient.post<ApiResponse<PluginInstallation>>(
    `${BASE_PATH}/installations`,
    data,
    options
  );
  return response.data;
}

/**
 * Update plugin installation configuration
 */
export async function updateInstallationConfig(
  installationId: string,
  data: UpdatePluginConfigRequest,
  options?: RequestOptions
): Promise<PluginInstallation> {
  const response = await apiClient.put<ApiResponse<PluginInstallation>>(
    `${BASE_PATH}/installations/${installationId}/configuration`,
    data,
    options
  );
  return response.data;
}

/**
 * Disable an installed plugin
 */
export async function disableInstallation(
  installationId: string,
  options?: RequestOptions
): Promise<{ id: string; status: string }> {
  const response = await apiClient.patch<ApiResponse<{ id: string; status: string }>>(
    `${BASE_PATH}/installations/${installationId}/disable`,
    undefined,
    options
  );
  return response.data;
}

/**
 * Re-enable a disabled plugin
 */
export async function enableInstallation(
  installationId: string,
  options?: RequestOptions
): Promise<{ id: string; status: string }> {
  const response = await apiClient.patch<ApiResponse<{ id: string; status: string }>>(
    `${BASE_PATH}/installations/${installationId}/enable`,
    undefined,
    options
  );
  return response.data;
}

/**
 * Uninstall a plugin (soft delete - marks as uninstalled)
 */
export async function uninstallPlugin(
  installationId: string,
  options?: RequestOptions
): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/installations/${installationId}`, options);
}

/**
 * Update plugin to latest version
 */
export async function updateInstallationVersion(
  installationId: string,
  options?: RequestOptions
): Promise<{ id: string; installed_version: string }> {
  const response = await apiClient.patch<ApiResponse<{ id: string; installed_version: string }>>(
    `${BASE_PATH}/installations/${installationId}/update`,
    undefined,
    options
  );
  return response.data;
}

// ============================================
// PLUGIN REVIEWS (tenant-scoped)
// ============================================

/**
 * Get reviews for a plugin
 *
 * Backend returns: { success, data: { reviews, summary }, meta: { total, limit, offset } }
 */
export async function getPluginReviews(
  pluginId: string,
  params?: { sort?: string; order?: string; limit?: number; offset?: number },
  options?: RequestOptions
): Promise<{ reviews: PluginReview[]; summary: ReviewSummary; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: { reviews: PluginReview[]; summary: ReviewSummary };
    meta: OffsetMeta;
  }>(`${BASE_PATH}/reviews/plugin/${pluginId}${queryString}`, options);
  return { reviews: response.data.reviews, summary: response.data.summary, meta: response.meta };
}

/**
 * Create a review for a plugin
 */
export async function createPluginReview(
  data: CreatePluginReviewRequest,
  options?: RequestOptions
): Promise<PluginReview> {
  const response = await apiClient.post<ApiResponse<PluginReview>>(
    `${BASE_PATH}/reviews`,
    data,
    options
  );
  return response.data;
}

/**
 * Update a review
 */
export async function updatePluginReview(
  reviewId: string,
  data: { rating?: number; title?: string; review_text?: string },
  options?: RequestOptions
): Promise<PluginReview> {
  const response = await apiClient.put<ApiResponse<PluginReview>>(
    `${BASE_PATH}/reviews/${reviewId}`,
    data,
    options
  );
  return response.data;
}

/**
 * Delete a review (soft delete)
 */
export async function deletePluginReview(
  reviewId: string,
  options?: RequestOptions
): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/reviews/${reviewId}`, options);
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(
  reviewId: string,
  options?: RequestOptions
): Promise<{ id: string; helpful_count: number }> {
  const response = await apiClient.post<ApiResponse<{ id: string; helpful_count: number }>>(
    `${BASE_PATH}/reviews/${reviewId}/helpful`,
    undefined,
    options
  );
  return response.data;
}

// ============================================
// DEVELOPER PORTAL (manage own plugins)
// ============================================

/**
 * Get plugins owned by the current tenant (developer portal)
 */
export async function getMyPlugins(
  params?: { status?: string; limit?: number; offset?: number },
  options?: RequestOptions
): Promise<{ plugins: Plugin[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: Plugin[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/developer/plugins${queryString}`, options);
  return { plugins: response.data, meta: response.meta };
}

/**
 * Create a new plugin (developer portal)
 */
export async function createPlugin(
  data: CreatePluginRequest,
  options?: RequestOptions
): Promise<Plugin> {
  const response = await apiClient.post<ApiResponse<Plugin>>(`${BASE_PATH}/plugins`, data, options);
  return response.data;
}

/**
 * Update a plugin (developer portal)
 */
export async function updatePlugin(
  pluginId: string,
  data: UpdatePluginRequest,
  options?: RequestOptions
): Promise<Plugin> {
  const response = await apiClient.put<ApiResponse<Plugin>>(
    `${BASE_PATH}/plugins/${pluginId}`,
    data,
    options
  );
  return response.data;
}

/**
 * Delete a plugin (developer portal, draft only)
 */
export async function deletePlugin(pluginId: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/plugins/${pluginId}`, options);
}

/**
 * Submit a plugin for review (developer portal)
 */
export async function submitPluginForReview(
  data: SubmitPluginForReviewRequest,
  options?: RequestOptions
): Promise<Plugin> {
  const response = await apiClient.post<ApiResponse<Plugin>>(
    `${BASE_PATH}/plugins/${data.plugin_id}/submit`,
    data,
    options
  );
  return response.data;
}

// ============================================
// PLUGIN DEPENDENCIES
// ============================================

/**
 * Get dependencies for a plugin
 */
export async function getPluginDependencies(
  pluginId: string,
  options?: RequestOptions
): Promise<PluginDependency[]> {
  const response = await apiClient.get<ApiResponse<PluginDependency[]>>(
    `${BASE_PATH}/plugins/${pluginId}/dependencies`,
    options
  );
  return response.data;
}

/**
 * Get plugins that depend on a given plugin
 */
export async function getPluginDependents(
  pluginId: string,
  options?: RequestOptions
): Promise<PluginDependency[]> {
  const response = await apiClient.get<ApiResponse<PluginDependency[]>>(
    `${BASE_PATH}/plugins/${pluginId}/dependents`,
    options
  );
  return response.data;
}

// ============================================
// PLUGIN API KEYS (tenant-scoped)
// ============================================

/**
 * Get API keys for the current tenant
 */
export async function getApiKeys(
  params?: {
    plugin_installation_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  },
  options?: RequestOptions
): Promise<{ api_keys: PluginApiKey[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: PluginApiKey[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/api-keys${queryString}`, options);
  return { api_keys: response.data, meta: response.meta };
}

/**
 * Create a new API key
 */
export async function createApiKey(
  data: CreatePluginApiKeyRequest,
  options?: RequestOptions
): Promise<CreatePluginApiKeyResponse> {
  const response = await apiClient.post<ApiResponse<CreatePluginApiKeyResponse>>(
    `${BASE_PATH}/api-keys`,
    data,
    options
  );
  return response.data;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  keyId: string,
  options?: RequestOptions
): Promise<{ id: string; revoked_at: string }> {
  const response = await apiClient.patch<ApiResponse<{ id: string; revoked_at: string }>>(
    `${BASE_PATH}/api-keys/${keyId}/revoke`,
    undefined,
    options
  );
  return response.data;
}

/**
 * Delete an API key
 */
export async function deleteApiKey(keyId: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/api-keys/${keyId}`, options);
}

// ============================================
// PLUGIN WEBHOOKS (tenant-scoped)
// ============================================

/**
 * Get webhooks for the current tenant
 */
export async function getWebhooks(
  params?: {
    plugin_installation_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  },
  options?: RequestOptions
): Promise<{ webhooks: PluginWebhook[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: PluginWebhook[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/webhooks${queryString}`, options);
  return { webhooks: response.data, meta: response.meta };
}

/**
 * Get a specific webhook
 */
export async function getWebhookById(
  webhookId: string,
  options?: RequestOptions
): Promise<PluginWebhook> {
  const response = await apiClient.get<ApiResponse<PluginWebhook>>(
    `${BASE_PATH}/webhooks/${webhookId}`,
    options
  );
  return response.data;
}

/**
 * Create a new webhook
 */
export async function createWebhook(
  data: CreatePluginWebhookRequest,
  options?: RequestOptions
): Promise<PluginWebhook> {
  const response = await apiClient.post<ApiResponse<PluginWebhook>>(
    `${BASE_PATH}/webhooks`,
    data,
    options
  );
  return response.data;
}

/**
 * Update a webhook
 */
export async function updateWebhook(
  webhookId: string,
  data: UpdatePluginWebhookRequest,
  options?: RequestOptions
): Promise<PluginWebhook> {
  const response = await apiClient.put<ApiResponse<PluginWebhook>>(
    `${BASE_PATH}/webhooks/${webhookId}`,
    data,
    options
  );
  return response.data;
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/webhooks/${webhookId}`, options);
}

/**
 * Test a webhook (send test event)
 */
export async function testWebhook(
  webhookId: string,
  options?: RequestOptions
): Promise<PluginWebhookDelivery> {
  const response = await apiClient.post<ApiResponse<PluginWebhookDelivery>>(
    `${BASE_PATH}/webhooks/${webhookId}/test`,
    undefined,
    options
  );
  return response.data;
}

/**
 * Get delivery history for a webhook
 */
export async function getWebhookDeliveries(
  webhookId: string,
  params?: { status?: string; limit?: number; offset?: number },
  options?: RequestOptions
): Promise<{ deliveries: PluginWebhookDelivery[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: PluginWebhookDelivery[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/webhooks/${webhookId}/deliveries${queryString}`, options);
  return { deliveries: response.data, meta: response.meta };
}

// ============================================
// PLUGIN RUNTIME (hooks & UI slots)
// ============================================

/**
 * Get hooks for a plugin
 */
export async function getPluginHooks(
  pluginId: string,
  options?: RequestOptions
): Promise<PluginHook[]> {
  const response = await apiClient.get<ApiResponse<PluginHook[]>>(
    `${BASE_PATH}/plugins/${pluginId}/hooks`,
    options
  );
  return response.data;
}

/**
 * Get UI slots for a plugin
 */
export async function getPluginUISlots(
  pluginId: string,
  options?: RequestOptions
): Promise<PluginUISlot[]> {
  const response = await apiClient.get<ApiResponse<PluginUISlot[]>>(
    `${BASE_PATH}/plugins/${pluginId}/ui-slots`,
    options
  );
  return response.data;
}

/**
 * Get hook execution history
 */
export async function getHookExecutions(
  hookId: string,
  params?: { status?: string; limit?: number; offset?: number },
  options?: RequestOptions
): Promise<{ executions: PluginHookExecution[]; meta: OffsetMeta }> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: PluginHookExecution[];
    meta: OffsetMeta;
  }>(`${BASE_PATH}/hooks/${hookId}/executions${queryString}`, options);
  return { executions: response.data, meta: response.meta };
}
