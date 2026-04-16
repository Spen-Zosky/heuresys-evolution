/**
 * Plugin Runtime Service
 * Executes hooks and retrieves UI slot registrations for the plugin system.
 */

import { pool } from '../config/database.js';

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
export async function executeHook(
  hookName: string,
  tenantId: string,
  payload: Record<string, unknown>
): Promise<HookResult[]> {
  const hooks = await pool.query(
    `
    SELECT ph.id, ph.plugin_id, ph.handler_path, ph.timeout_ms, ph.is_async,
           p.name as plugin_name
    FROM plugin_hooks ph
    JOIN plugins p ON p.id = ph.plugin_id
    JOIN plugin_installations pi ON pi.plugin_id = ph.plugin_id
    WHERE ph.hook_name = $1
      AND pi.tenant_id = $2
      AND pi.status = 'active'
      AND ph.enabled = true
    ORDER BY ph.priority ASC
  `,
    [hookName, tenantId]
  );

  const results: HookResult[] = [];

  for (const hook of hooks.rows) {
    const startTime = Date.now();
    let status: 'success' | 'failed' | 'timeout' = 'failed';
    let output: unknown = null;
    let errorMessage: string | undefined;

    try {
      const controller = new AbortController();
      const timeoutMs = hook.timeout_ms || 5000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(hook.handler_path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hook: hookName, tenant_id: tenantId, payload }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        output = await response.json().catch(() => null);
        status = 'success';
      } else {
        errorMessage = `HTTP ${response.status}`;
        output = await response.text().catch(() => null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        status = 'timeout';
        errorMessage = 'Hook execution timed out';
      } else {
        errorMessage = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    const durationMs = Date.now() - startTime;

    // Log execution
    pool
      .query(
        `
      INSERT INTO plugin_hook_executions (
        hook_id, tenant_id, trigger_event, input_data, output_data,
        status, error_message, duration_ms, started_at, completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `,
        [
          hook.id,
          tenantId,
          hookName,
          JSON.stringify(payload),
          output ? JSON.stringify(output) : null,
          status,
          errorMessage || null,
          durationMs,
          new Date(startTime).toISOString(),
        ]
      )
      .catch(() => {
        /* ignore logging errors */
      });

    results.push({
      hookId: hook.id,
      pluginId: hook.plugin_id,
      pluginName: hook.plugin_name,
      status,
      output,
      durationMs,
      error: errorMessage,
    });
  }

  return results;
}

/**
 * Get all UI slot components registered for a given slot name and tenant.
 */
export async function getUISlots(slotName: string, tenantId: string): Promise<UISlotEntry[]> {
  const result = await pool.query(
    `
    SELECT us.id, us.plugin_id, p.name as plugin_name,
           us.component_path, us.props_schema, us.priority
    FROM plugin_ui_slots us
    JOIN plugins p ON p.id = us.plugin_id
    JOIN plugin_installations pi ON pi.plugin_id = us.plugin_id
    WHERE us.slot_name = $1
      AND pi.tenant_id = $2
      AND pi.status = 'active'
      AND us.enabled = true
    ORDER BY us.priority ASC
  `,
    [slotName, tenantId]
  );

  return result.rows as UISlotEntry[];
}
