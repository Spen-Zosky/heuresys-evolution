-- Migration 159: Public API keys table + pg_trgm index for ESCO skill search
-- Horizon O2.4 — Public REST API v1

-- Public API key store (separate from plugin_api_keys)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  key_hash VARCHAR(128) NOT NULL,
  name VARCHAR(200) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON api_keys
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- pg_trgm GIN index on esco_skills.preferred_label for ILIKE performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_esco_skills_label_trgm
  ON esco_skills USING gin (preferred_label gin_trgm_ops);
