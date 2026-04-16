-- =============================================================================
-- Migration: 088_plugin_dependencies.sql
-- Description: Plugin dependency tracking. Allows plugins to declare
--              dependencies on other plugins with version constraints.
-- Date: 2026-02-05
-- =============================================================================

BEGIN;

-- ============================================================
-- plugin_dependencies
--   Tracks inter-plugin dependencies. A plugin can require
--   one or more other plugins to be installed.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_dependencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  depends_on_plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  min_version VARCHAR(50),
  max_version VARCHAR(50),
  is_optional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, depends_on_plugin_id),
  CHECK (plugin_id != depends_on_plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_plugin_dependencies_plugin ON plugin_dependencies(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_dependencies_depends_on ON plugin_dependencies(depends_on_plugin_id);

COMMIT;
