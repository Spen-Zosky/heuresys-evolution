-- =============================================================================
-- Migration: 089_plugin_api_keys.sql
-- Description: API key management for plugins. Allows tenants to generate
--              scoped API keys for plugin integrations.
-- Date: 2026-02-05
-- =============================================================================

BEGIN;

-- ============================================================
-- plugin_api_keys
--   Per-tenant API keys for plugin access. Keys are scoped to
--   a specific plugin installation and have configurable
--   permissions and expiration.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plugin_installation_id UUID NOT NULL REFERENCES plugin_installations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plugin_api_keys_tenant ON plugin_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_api_keys_installation ON plugin_api_keys(plugin_installation_id);
CREATE INDEX IF NOT EXISTS idx_plugin_api_keys_key_prefix ON plugin_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_plugin_api_keys_active ON plugin_api_keys(tenant_id, is_active) WHERE is_active = TRUE;

-- Enable RLS for tenant isolation
ALTER TABLE plugin_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plugin_api_keys;
CREATE POLICY tenant_isolation ON plugin_api_keys
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

COMMIT;
