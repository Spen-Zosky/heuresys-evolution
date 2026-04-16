-- =============================================================================
-- Migration: 091_plugin_runtime.sql
-- Description: Plugin runtime infrastructure. Defines hook points, UI slots,
--              and execution tracking for the plugin system.
-- Date: 2026-02-05
-- =============================================================================

BEGIN;

-- ============================================================
-- plugin_hooks
--   Defines hook points that plugins can register to extend
--   platform behavior. Each hook maps a plugin to a specific
--   platform event or extension point.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_hooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  hook_name VARCHAR(200) NOT NULL,
  handler_path VARCHAR(500) NOT NULL,
  priority INTEGER DEFAULT 100,
  is_async BOOLEAN DEFAULT FALSE,
  timeout_ms INTEGER DEFAULT 5000,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, hook_name)
);

CREATE INDEX IF NOT EXISTS idx_plugin_hooks_plugin ON plugin_hooks(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_hooks_name ON plugin_hooks(hook_name);
CREATE INDEX IF NOT EXISTS idx_plugin_hooks_enabled ON plugin_hooks(hook_name, enabled) WHERE enabled = TRUE;

-- ============================================================
-- plugin_ui_slots
--   Defines UI extension slots that plugins can inject content
--   into. Allows plugins to add components to specific areas
--   of the platform UI.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_ui_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  slot_name VARCHAR(200) NOT NULL,
  component_path VARCHAR(500) NOT NULL,
  props_schema JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, slot_name)
);

CREATE INDEX IF NOT EXISTS idx_plugin_ui_slots_plugin ON plugin_ui_slots(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_ui_slots_slot ON plugin_ui_slots(slot_name);
CREATE INDEX IF NOT EXISTS idx_plugin_ui_slots_enabled ON plugin_ui_slots(slot_name, enabled) WHERE enabled = TRUE;

-- ============================================================
-- plugin_hook_executions
--   Tracks individual hook execution attempts for auditing,
--   debugging, and performance monitoring.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_hook_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hook_id UUID NOT NULL REFERENCES plugin_hooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  trigger_event VARCHAR(200) NOT NULL,
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failed', 'timeout')),
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plugin_hook_executions_hook ON plugin_hook_executions(hook_id);
CREATE INDEX IF NOT EXISTS idx_plugin_hook_executions_tenant ON plugin_hook_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_hook_executions_status ON plugin_hook_executions(status);
CREATE INDEX IF NOT EXISTS idx_plugin_hook_executions_started ON plugin_hook_executions(started_at);

-- Enable RLS for tenant isolation on execution logs
ALTER TABLE plugin_hook_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plugin_hook_executions;
CREATE POLICY tenant_isolation ON plugin_hook_executions
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

COMMIT;
