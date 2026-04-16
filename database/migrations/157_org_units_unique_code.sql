-- Migration 157: Add UNIQUE constraint on org_units(tenant_id, code)
-- Required for import engine upsert ON CONFLICT

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_units_tenant_code_unique
  ON org_units (tenant_id, code)
  WHERE code IS NOT NULL;
