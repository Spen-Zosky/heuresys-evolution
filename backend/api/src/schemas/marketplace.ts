import { z } from 'zod';

// =============================================================================
// MARKETPLACE DEVELOPER SCHEMAS
// =============================================================================

/**
 * POST /developer/plugins
 */
export const createDeveloperPluginSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(200).optional(),
  short_description: z.string().trim().max(500).optional(),
  description: z.string().trim().max(10000).optional(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  pricing_model: z
    .enum(['free', 'freemium', 'paid', 'subscription', 'contact'])
    .optional()
    .default('free'),
  price_cents: z.number().int().min(0).optional(),
  currency: z.string().trim().max(3).optional().default('EUR'),
  tags: z.array(z.string().trim().max(50)).optional(),
  icon_url: z.string().trim().url('Invalid icon URL').max(2000).optional(),
  homepage_url: z.string().trim().url('Invalid homepage URL').max(2000).optional(),
  repository_url: z.string().trim().url('Invalid repository URL').max(2000).optional(),
  license: z.string().trim().max(100).optional(),
  screenshot_urls: z.array(z.string().trim().url().max(2000)).optional(),
  banner_url: z.string().trim().url('Invalid banner URL').max(2000).optional().nullable(),
});

/**
 * PUT /developer/plugins/:id
 */
export const updateDeveloperPluginSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  short_description: z.string().trim().max(500).optional(),
  description: z.string().trim().max(10000).optional(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  pricing_model: z.enum(['free', 'freemium', 'paid', 'subscription', 'contact']).optional(),
  price_cents: z.number().int().min(0).optional(),
  currency: z.string().trim().max(3).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  icon_url: z.string().trim().url('Invalid icon URL').max(2000).optional().nullable(),
  homepage_url: z.string().trim().url('Invalid homepage URL').max(2000).optional().nullable(),
  repository_url: z.string().trim().url('Invalid repository URL').max(2000).optional().nullable(),
  license: z.string().trim().max(100).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  screenshot_urls: z.array(z.string().trim().url().max(2000)).optional(),
  banner_url: z.string().trim().url('Invalid banner URL').max(2000).optional().nullable(),
});

/**
 * POST /developer/plugins/:id/versions
 */
export const createPluginVersionSchema = z.object({
  version: z.string().trim().min(1, 'Version is required').max(50),
  release_notes: z.string().trim().max(10000).optional(),
  changelog: z.string().trim().max(50000).optional(),
  config_schema: z.record(z.unknown()).optional(),
  permissions_required: z.array(z.string().trim().max(100)).optional(),
  entry_point: z.string().trim().max(500).optional(),
});

/**
 * POST /developer/api-keys
 */
export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  plugin_installation_id: z.string().uuid('Invalid installation ID').optional(),
  scopes: z.array(z.string().trim().max(100)).optional(),
  expires_in_days: z.coerce.number().int().min(1).max(365).optional(),
});

// =============================================================================
// MARKETPLACE PLUGINS (PUBLIC / TENANT_OWNER) SCHEMAS
// =============================================================================

/**
 * POST /marketplace/plugins
 */
export const createPluginSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  short_description: z.string().trim().max(500).optional(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  publisher_tenant_id: z.string().uuid('Invalid publisher tenant ID').optional().nullable(),
  publisher_name: z.string().trim().min(1, 'Publisher name is required').max(200),
  icon_url: z.string().trim().url('Invalid icon URL').max(2000).optional().nullable(),
  homepage_url: z.string().trim().url('Invalid homepage URL').max(2000).optional().nullable(),
  repository_url: z.string().trim().url('Invalid repository URL').max(2000).optional().nullable(),
  license: z.string().trim().max(100).optional(),
  pricing_model: z
    .enum(['free', 'freemium', 'paid', 'subscription', 'contact'])
    .optional()
    .default('free'),
  price_cents: z.number().int().min(0).optional(),
  currency: z.string().trim().max(3).optional().default('EUR'),
  tags: z.array(z.string().trim().max(50)).optional(),
  screenshot_urls: z.array(z.string().trim().url().max(2000)).optional(),
  banner_url: z.string().trim().url('Invalid banner URL').max(2000).optional().nullable(),
});

/**
 * PUT /marketplace/plugins/:id
 */
export const updatePluginSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  short_description: z.string().trim().max(500).optional(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  publisher_name: z.string().trim().min(1).max(200).optional(),
  icon_url: z.string().trim().url('Invalid icon URL').max(2000).optional().nullable(),
  homepage_url: z.string().trim().url('Invalid homepage URL').max(2000).optional().nullable(),
  repository_url: z.string().trim().url('Invalid repository URL').max(2000).optional().nullable(),
  license: z.string().trim().max(100).optional(),
  pricing_model: z.enum(['free', 'freemium', 'paid', 'subscription', 'contact']).optional(),
  price_cents: z.number().int().min(0).optional(),
  currency: z.string().trim().max(3).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  status: z.enum(['draft', 'pending_review', 'published', 'suspended', 'deprecated']).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  featured: z.boolean().optional(),
  screenshot_urls: z.array(z.string().trim().url().max(2000)).optional(),
  banner_url: z.string().trim().url('Invalid banner URL').max(2000).optional().nullable(),
});

/**
 * POST /marketplace/plugins/:id/dependencies
 */
export const createPluginDependencySchema = z.object({
  depends_on_plugin_id: z.string().uuid('Invalid dependency plugin ID'),
  min_version: z.string().trim().max(50).optional(),
  max_version: z.string().trim().max(50).optional(),
  is_optional: z.boolean().optional().default(false),
});

// =============================================================================
// MARKETPLACE REVIEWS SCHEMAS
// =============================================================================

/**
 * POST /marketplace/reviews
 */
export const createReviewSchema = z.object({
  plugin_id: z.string().uuid('Invalid plugin ID'),
  user_id: z.string().uuid('Invalid user ID'),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  title: z.string().trim().max(300).optional(),
  review_text: z.string().trim().max(5000).optional(),
});

/**
 * PUT /marketplace/reviews/:id
 */
export const updateReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5')
    .optional(),
  title: z.string().trim().max(300).optional(),
  review_text: z.string().trim().max(5000).optional(),
});

// =============================================================================
// MARKETPLACE WEBHOOKS SCHEMAS
// =============================================================================

/**
 * POST /marketplace/webhooks
 */
export const createWebhookSchema = z.object({
  plugin_installation_id: z.string().uuid('Invalid plugin installation ID'),
  url: z.string().trim().url('Invalid webhook URL').max(2000),
  secret: z.string().trim().max(500).optional(),
  events: z.array(z.string().trim().max(100)).optional(),
  description: z.string().trim().max(500).optional(),
  created_by: z.string().uuid('Invalid user ID').optional(),
});

/**
 * PUT /marketplace/webhooks/:id
 */
export const updateWebhookSchema = z.object({
  url: z.string().trim().url('Invalid webhook URL').max(2000).optional(),
  events: z.array(z.string().trim().max(100)).optional(),
  is_active: z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
});

// =============================================================================
// MARKETPLACE INSTALLATIONS SCHEMAS
// =============================================================================

/**
 * POST /marketplace/installations
 */
export const createInstallationSchema = z.object({
  plugin_id: z.string().uuid('Invalid plugin ID'),
  installed_by: z.string().uuid('Invalid user ID').optional(),
  auto_update: z.boolean().optional().default(true),
});

/**
 * PUT /marketplace/installations/:id/configuration
 */
export const updateInstallationConfigSchema = z.object({
  config_data: z.record(z.unknown()).refine((val) => val !== null && typeof val === 'object', {
    message: 'config_data must be a non-null object',
  }),
  updated_by: z.string().uuid('Invalid user ID').optional(),
});

/**
 * PATCH /marketplace/installations/:id/disable
 */
export const disableInstallationSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});
