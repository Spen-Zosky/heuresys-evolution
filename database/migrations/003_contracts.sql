-- Migration: 003_contracts
-- Epic: 3 - Employee Data Management
-- Story: 3.4 - Contract Management
-- Description: Creates contracts table for employee contract tracking

-- =============================================================================
-- CONTRACTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Contract Type (Italian labor law)
  contract_type VARCHAR(50) NOT NULL, -- 'tempo_indeterminato', 'tempo_determinato', 'apprendistato', 'somministrazione', 'collaborazione'
  contract_code VARCHAR(50), -- Internal reference

  -- Contract Duration
  start_date DATE NOT NULL,
  end_date DATE, -- NULL for permanent contracts
  probation_end_date DATE,

  -- CCNL Reference
  ccnl_type VARCHAR(100), -- Reference to tenant's CCNL settings
  ccnl_level VARCHAR(50), -- Job level within CCNL

  -- Compensation
  gross_annual_salary DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'EUR',
  salary_type VARCHAR(20) DEFAULT 'annual', -- 'annual', 'monthly', 'hourly'
  payment_frequency VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'biweekly', 'weekly'

  -- Work Schedule
  work_hours_weekly DECIMAL(4, 1) DEFAULT 40,
  work_schedule_type VARCHAR(20) DEFAULT 'full_time', -- 'full_time', 'part_time', 'shift'
  part_time_percentage DECIMAL(5, 2), -- e.g., 50.00 for 50%

  -- Job Details
  job_title VARCHAR(200),
  job_description TEXT,
  department_id UUID REFERENCES departments(id),
  location_id UUID REFERENCES locations(id),
  cost_center_id UUID REFERENCES cost_centers(id),

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'draft', 'active', 'suspended', 'terminated', 'expired'
  termination_date DATE,
  termination_reason TEXT,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee_id ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS tenant_isolation_contracts ON contracts;

-- Create tenant isolation policy
CREATE POLICY tenant_isolation_contracts ON contracts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- CONTRACT AMENDMENTS TABLE (for contract modifications)
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Amendment Details
  amendment_type VARCHAR(50) NOT NULL, -- 'salary_change', 'role_change', 'schedule_change', 'renewal', 'other'
  effective_date DATE NOT NULL,
  description TEXT,

  -- Changes
  previous_values JSONB, -- Snapshot of changed fields before
  new_values JSONB, -- New values after amendment

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_amendments_contract ON contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_tenant ON contract_amendments(tenant_id);

ALTER TABLE contract_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_contract_amendments ON contract_amendments;

CREATE POLICY tenant_isolation_contract_amendments ON contract_amendments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE contracts IS 'Employee contracts with Italian labor law support (CCNL)';
COMMENT ON COLUMN contracts.contract_type IS 'Italian contract types: tempo_indeterminato, tempo_determinato, apprendistato, somministrazione, collaborazione';
COMMENT ON COLUMN contracts.ccnl_type IS 'Reference to CCNL type from tenant settings';
COMMENT ON COLUMN contracts.ccnl_level IS 'CCNL job level (e.g., B2, C1, Quadro)';
