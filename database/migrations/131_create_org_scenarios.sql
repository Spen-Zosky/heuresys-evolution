-- Migration 131: Create org_scenarios table for Company PET staging comparison
-- BUG-054: Staging page fetches /api/v1/org-scenarios but table did not exist

CREATE TABLE IF NOT EXISTS org_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scenario_type VARCHAR(50) NOT NULL DEFAULT 'restructuring',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  is_baseline BOOLEAN DEFAULT FALSE,
  base_org_unit_id UUID REFERENCES org_units(id),
  changes JSONB DEFAULT '[]',
  impact_analysis JSONB DEFAULT '{}',
  headcount INTEGER,
  departments_count INTEGER,
  total_cost NUMERIC(15,2),
  span_of_control NUMERIC(5,2),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_scenarios_tenant ON org_scenarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_scenarios_status ON org_scenarios(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_org_scenarios_deleted ON org_scenarios(deleted_at) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE org_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_scenarios_tenant_isolation ON org_scenarios
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Updated_at trigger
CREATE TRIGGER trg_org_scenarios_updated_at
  BEFORE UPDATE ON org_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
