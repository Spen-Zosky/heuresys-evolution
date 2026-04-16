-- Migration 158: ESCO Auto-Link for imported skills (O2.2)
-- Links imported skill texts to ESCO skills via embedding similarity

CREATE TABLE import_skill_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES import_jobs(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  input_text VARCHAR(500) NOT NULL,
  esco_skill_id UUID REFERENCES esco_skills(id),
  similarity DECIMAL(5,4),
  confidence VARCHAR(10) NOT NULL DEFAULT 'none',
  accepted BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_skill_links_job ON import_skill_links(import_job_id);
CREATE INDEX idx_import_skill_links_tenant ON import_skill_links(tenant_id);

ALTER TABLE import_skill_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON import_skill_links
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
