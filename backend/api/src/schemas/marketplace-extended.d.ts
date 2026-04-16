import { z } from 'zod';
/**
 * POST /marketplace/api-keys
 */
export declare const createMarketplaceApiKeySchema: z.ZodObject<{
    plugin_installation_id: z.ZodString;
    name: z.ZodString;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    expires_at: z.ZodOptional<z.ZodString>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    plugin_installation_id: string;
    created_by?: string | undefined;
    scopes?: string[] | undefined;
    expires_at?: string | undefined;
}, {
    name: string;
    plugin_installation_id: string;
    created_by?: string | undefined;
    scopes?: string[] | undefined;
    expires_at?: string | undefined;
}>;
/**
 * POST /marketplace/dependencies
 */
export declare const createMarketplaceDependencySchema: z.ZodObject<{
    plugin_id: z.ZodString;
    depends_on_plugin_id: z.ZodString;
    min_version: z.ZodOptional<z.ZodString>;
    max_version: z.ZodOptional<z.ZodString>;
    is_optional: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    depends_on_plugin_id: string;
    is_optional: boolean;
    plugin_id: string;
    min_version?: string | undefined;
    max_version?: string | undefined;
}, {
    depends_on_plugin_id: string;
    plugin_id: string;
    min_version?: string | undefined;
    max_version?: string | undefined;
    is_optional?: boolean | undefined;
}>;
/**
 * PUT /marketplace/dependencies/:id
 */
export declare const updateMarketplaceDependencySchema: z.ZodObject<{
    min_version: z.ZodOptional<z.ZodString>;
    max_version: z.ZodOptional<z.ZodString>;
    is_optional: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    min_version?: string | undefined;
    max_version?: string | undefined;
    is_optional?: boolean | undefined;
}, {
    min_version?: string | undefined;
    max_version?: string | undefined;
    is_optional?: boolean | undefined;
}>;
/**
 * POST /marketplace/hooks
 */
export declare const createMarketplaceHookSchema: z.ZodObject<{
    plugin_id: z.ZodString;
    hook_name: z.ZodString;
    handler_path: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    is_async: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    timeout_ms: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    priority: number;
    plugin_id: string;
    hook_name: string;
    handler_path: string;
    is_async: boolean;
    timeout_ms: number;
}, {
    plugin_id: string;
    hook_name: string;
    handler_path: string;
    priority?: number | undefined;
    is_async?: boolean | undefined;
    timeout_ms?: number | undefined;
}>;
/**
 * PUT /marketplace/hooks/:id
 */
export declare const updateMarketplaceHookSchema: z.ZodObject<{
    handler_path: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    is_async: z.ZodOptional<z.ZodBoolean>;
    timeout_ms: z.ZodOptional<z.ZodNumber>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enabled?: boolean | undefined;
    priority?: number | undefined;
    handler_path?: string | undefined;
    is_async?: boolean | undefined;
    timeout_ms?: number | undefined;
}, {
    enabled?: boolean | undefined;
    priority?: number | undefined;
    handler_path?: string | undefined;
    is_async?: boolean | undefined;
    timeout_ms?: number | undefined;
}>;
/**
 * POST /marketplace/hooks/ui-slots
 */
export declare const createMarketplaceUiSlotSchema: z.ZodObject<{
    plugin_id: z.ZodString;
    slot_name: z.ZodString;
    component_path: z.ZodString;
    props_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    priority: number;
    plugin_id: string;
    slot_name: string;
    component_path: string;
    props_schema?: Record<string, unknown> | undefined;
}, {
    plugin_id: string;
    slot_name: string;
    component_path: string;
    priority?: number | undefined;
    props_schema?: Record<string, unknown> | undefined;
}>;
/**
 * PUT /marketplace/hooks/ui-slots/:id
 */
export declare const updateMarketplaceUiSlotSchema: z.ZodObject<{
    component_path: z.ZodOptional<z.ZodString>;
    props_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    priority: z.ZodOptional<z.ZodNumber>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enabled?: boolean | undefined;
    priority?: number | undefined;
    component_path?: string | undefined;
    props_schema?: Record<string, unknown> | undefined;
}, {
    enabled?: boolean | undefined;
    priority?: number | undefined;
    component_path?: string | undefined;
    props_schema?: Record<string, unknown> | undefined;
}>;
/**
 * POST /marketplace/runtime/hooks/:hookName/execute
 */
export declare const executeHookSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
/**
 * POST /marketplace/runtime/plugins/:pluginId/hooks
 */
export declare const registerRuntimeHookSchema: z.ZodObject<{
    hook_name: z.ZodString;
    handler_path: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    is_async: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    timeout_ms: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    priority: number;
    hook_name: string;
    handler_path: string;
    is_async: boolean;
    timeout_ms: number;
}, {
    hook_name: string;
    handler_path: string;
    priority?: number | undefined;
    is_async?: boolean | undefined;
    timeout_ms?: number | undefined;
}>;
/**
 * POST /marketplace/runtime/plugins/:pluginId/ui-slots
 */
export declare const registerRuntimeUiSlotSchema: z.ZodObject<{
    slot_name: z.ZodString;
    component_path: z.ZodString;
    props_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    priority: number;
    slot_name: string;
    component_path: string;
    props_schema?: Record<string, unknown> | undefined;
}, {
    slot_name: string;
    component_path: string;
    priority?: number | undefined;
    props_schema?: Record<string, unknown> | undefined;
}>;
//# sourceMappingURL=marketplace-extended.d.ts.map