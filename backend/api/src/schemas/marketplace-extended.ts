import { z } from 'zod';

// =============================================================================
// MARKETPLACE API KEYS SCHEMAS
// =============================================================================

/**
 * POST /marketplace/api-keys
 */
export const createMarketplaceApiKeySchema = z.object({
  plugin_installation_id: z.string().uuid('Invalid plugin installation ID'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  scopes: z.array(z.string().trim().max(100)).optional(),
  expires_at: z.string().trim().max(50).optional(),
  created_by: z.string().uuid('Invalid user ID').optional(),
});

// =============================================================================
// MARKETPLACE DEPENDENCIES SCHEMAS
// =============================================================================

/**
 * POST /marketplace/dependencies
 */
export const createMarketplaceDependencySchema = z.object({
  plugin_id: z.string().uuid('Invalid plugin ID'),
  depends_on_plugin_id: z.string().uuid('Invalid dependency plugin ID'),
  min_version: z.string().trim().max(50).optional(),
  max_version: z.string().trim().max(50).optional(),
  is_optional: z.boolean().optional().default(false),
});

/**
 * PUT /marketplace/dependencies/:id
 */
export const updateMarketplaceDependencySchema = z.object({
  min_version: z.string().trim().max(50).optional(),
  max_version: z.string().trim().max(50).optional(),
  is_optional: z.boolean().optional(),
});

// =============================================================================
// MARKETPLACE HOOKS SCHEMAS
// =============================================================================

/**
 * POST /marketplace/hooks
 */
export const createMarketplaceHookSchema = z.object({
  plugin_id: z.string().uuid('Invalid plugin ID'),
  hook_name: z.string().trim().min(1, 'hook_name is required').max(200),
  handler_path: z.string().trim().min(1, 'handler_path is required').max(500),
  priority: z.number().int().min(0).max(10000).optional().default(100),
  is_async: z.boolean().optional().default(false),
  timeout_ms: z.number().int().min(100).max(300000).optional().default(5000),
});

/**
 * PUT /marketplace/hooks/:id
 */
export const updateMarketplaceHookSchema = z.object({
  handler_path: z.string().trim().min(1).max(500).optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  is_async: z.boolean().optional(),
  timeout_ms: z.number().int().min(100).max(300000).optional(),
  enabled: z.boolean().optional(),
});

/**
 * POST /marketplace/hooks/ui-slots
 */
export const createMarketplaceUiSlotSchema = z.object({
  plugin_id: z.string().uuid('Invalid plugin ID'),
  slot_name: z.string().trim().min(1, 'slot_name is required').max(200),
  component_path: z.string().trim().min(1, 'component_path is required').max(500),
  props_schema: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(10000).optional().default(100),
});

/**
 * PUT /marketplace/hooks/ui-slots/:id
 */
export const updateMarketplaceUiSlotSchema = z.object({
  component_path: z.string().trim().min(1).max(500).optional(),
  props_schema: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(),
});

// =============================================================================
// MARKETPLACE RUNTIME SCHEMAS
// =============================================================================

/**
 * POST /marketplace/runtime/hooks/:hookName/execute
 */
export const executeHookSchema = z.record(z.unknown());

/**
 * POST /marketplace/runtime/plugins/:pluginId/hooks
 */
export const registerRuntimeHookSchema = z.object({
  hook_name: z.string().trim().min(1, 'hook_name is required').max(200),
  handler_path: z.string().trim().min(1, 'handler_path is required').max(500),
  priority: z.number().int().min(0).max(10000).optional().default(100),
  is_async: z.boolean().optional().default(false),
  timeout_ms: z.number().int().min(100).max(300000).optional().default(5000),
});

/**
 * POST /marketplace/runtime/plugins/:pluginId/ui-slots
 */
export const registerRuntimeUiSlotSchema = z.object({
  slot_name: z.string().trim().min(1, 'slot_name is required').max(200),
  component_path: z.string().trim().min(1, 'component_path is required').max(500),
  props_schema: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(10000).optional().default(100),
});
