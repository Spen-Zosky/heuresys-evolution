/**
 * Plugin Runtime Service
 * Executes hooks and retrieves UI slot registrations for the plugin system.
 */
export interface HookResult {
    hookId: string;
    pluginId: string;
    pluginName: string;
    status: 'success' | 'failed' | 'timeout';
    output: unknown;
    durationMs: number;
    error?: string | undefined;
}
export interface UISlotEntry {
    id: string;
    plugin_id: string;
    plugin_name: string;
    component_path: string;
    props_schema: Record<string, unknown>;
    priority: number;
}
/**
 * Execute all registered hooks for a given hook name and tenant.
 * Runs hooks in priority order, logging each execution.
 */
export declare function executeHook(hookName: string, tenantId: string, payload: Record<string, unknown>): Promise<HookResult[]>;
/**
 * Get all UI slot components registered for a given slot name and tenant.
 */
export declare function getUISlots(slotName: string, tenantId: string): Promise<UISlotEntry[]>;
//# sourceMappingURL=plugin-runtime.d.ts.map