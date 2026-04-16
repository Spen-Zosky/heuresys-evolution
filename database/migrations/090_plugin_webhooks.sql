-- =============================================================================
-- Migration: 090_plugin_webhooks.sql
-- Description: Webhook system for plugins. Allows plugins to register
--              webhook endpoints and tracks delivery attempts.
-- Date: 2026-02-05
-- =============================================================================

BEGIN;

-- ============================================================
-- plugin_webhooks
--   Webhook endpoint registrations for plugins. Each plugin
--   installation can register multiple webhooks for different
--   event types.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plugin_installation_id UUID NOT NULL REFERENCES plugin_installations(id) ON DELETE CASCADE,
  url VARCHAR(1000) NOT NULL,
  secret_hash VARCHAR(128),
  events TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  description VARCHAR(500),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_webhooks_tenant ON plugin_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_webhooks_installation ON plugin_webhooks(plugin_installation_id);
CREATE INDEX IF NOT EXISTS idx_plugin_webhooks_active ON plugin_webhooks(tenant_id, is_active) WHERE is_active = TRUE;

-- Enable RLS for tenant isolation
ALTER TABLE plugin_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plugin_webhooks;
CREATE POLICY tenant_isolation ON plugin_webhooks
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- plugin_webhook_deliveries
--   Tracks individual webhook delivery attempts including
--   status, response, and retry information.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES plugin_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(200) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body TEXT,
  response_headers JSONB,
  duration_ms INTEGER,
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt_number INTEGER DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_webhook_deliveries_webhook ON plugin_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_plugin_webhook_deliveries_status ON plugin_webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_plugin_webhook_deliveries_retry ON plugin_webhook_deliveries(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_plugin_webhook_deliveries_created ON plugin_webhook_deliveries(created_at);

COMMIT;
