-- Migration 156: Import Engine
-- Creates import_jobs table for CSV/Excel import tracking

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  import_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  created_rows INTEGER,
  updated_rows INTEGER,
  skipped_rows INTEGER,
  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  preview_data JSONB,
  uploaded_by UUID NOT NULL,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(tenant_id, status);

-- RLS
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON import_jobs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Grant to app role
GRANT SELECT, INSERT, UPDATE ON import_jobs TO heuresys_app;
