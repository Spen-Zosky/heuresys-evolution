-- Migration: 004_leave_management
-- Epic: 4 - Leave & Attendance Management
-- Stories: 4.1-4.7
-- Description: Enhances leave management with tenant isolation, CCNL rules, approvals

-- =============================================================================
-- ADD TENANT_ID TO EXISTING LEAVE TABLES
-- =============================================================================

-- Add tenant_id to employee_time_off_balances if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_time_off_balances' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE employee_time_off_balances ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add tenant_id to employee_time_off_requests if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_time_off_requests' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE employee_time_off_requests ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill tenant_id from employees table
UPDATE employee_time_off_balances b
SET tenant_id = e.tenant_id
FROM employees e
WHERE b.employee_id = e.id AND b.tenant_id IS NULL;

UPDATE employee_time_off_requests r
SET tenant_id = e.tenant_id
FROM employees e
WHERE r.employee_id = e.id AND r.tenant_id IS NULL;

-- =============================================================================
-- ENHANCE BALANCES TABLE
-- =============================================================================

-- Add carryover and expiry tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_time_off_balances' AND column_name = 'carryover_days') THEN
    ALTER TABLE employee_time_off_balances
      ADD COLUMN carryover_days DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN carryover_expires_at DATE,
      ADD COLUMN accrued_days DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN adjustment_days DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN adjustment_reason TEXT;
  END IF;
END $$;

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS idx_time_off_balances_tenant ON employee_time_off_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_off_balances_employee ON employee_time_off_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_off_balances_year ON employee_time_off_balances(year);
CREATE INDEX IF NOT EXISTS idx_time_off_balances_type ON employee_time_off_balances(leave_type);

-- =============================================================================
-- ENHANCE REQUESTS TABLE
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_time_off_requests' AND column_name = 'half_day_start') THEN
    ALTER TABLE employee_time_off_requests
      ADD COLUMN half_day_start BOOLEAN DEFAULT false,
      ADD COLUMN half_day_end BOOLEAN DEFAULT false,
      ADD COLUMN overlap_approved BOOLEAN DEFAULT false,
      ADD COLUMN medical_certificate_required BOOLEAN DEFAULT false,
      ADD COLUMN medical_certificate_uploaded BOOLEAN DEFAULT false,
      ADD COLUMN cancellation_requested BOOLEAN DEFAULT false,
      ADD COLUMN cancellation_reason TEXT,
      ADD COLUMN cancelled_at TIMESTAMP,
      ADD COLUMN cancelled_by UUID;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_time_off_requests_tenant ON employee_time_off_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_employee ON employee_time_off_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON employee_time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON employee_time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_approver ON employee_time_off_requests(approver_id);

-- =============================================================================
-- ROW LEVEL SECURITY FOR LEAVE TABLES
-- =============================================================================

ALTER TABLE employee_time_off_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_time_off_balances ON employee_time_off_balances;
CREATE POLICY tenant_isolation_time_off_balances ON employee_time_off_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE employee_time_off_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_time_off_requests ON employee_time_off_requests;
CREATE POLICY tenant_isolation_time_off_requests ON employee_time_off_requests
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- LEAVE APPROVAL WORKFLOW TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS leave_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES employee_time_off_requests(id) ON DELETE CASCADE,

  step_order INTEGER NOT NULL DEFAULT 1,
  approver_id UUID REFERENCES employees(id),
  approver_type VARCHAR(50), -- 'direct_manager', 'hr', 'department_head', 'custom'

  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'skipped'
  decision_at TIMESTAMP,
  decision_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_tenant ON leave_approval_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_request ON leave_approval_steps(request_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_approver ON leave_approval_steps(approver_id);

ALTER TABLE leave_approval_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_leave_approval_steps ON leave_approval_steps;
CREATE POLICY tenant_isolation_leave_approval_steps ON leave_approval_steps
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- LEAVE ACCRUAL RULES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS leave_accrual_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  leave_type VARCHAR(50) NOT NULL, -- 'ferie', 'rol', 'ex_festivita', etc.
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Accrual settings
  accrual_method VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly', 'hourly'
  accrual_amount DECIMAL(5,2) NOT NULL, -- Amount per period
  max_accrual DECIMAL(5,2), -- Maximum that can be accrued

  -- Carryover settings
  allow_carryover BOOLEAN DEFAULT true,
  max_carryover_days DECIMAL(5,2),
  carryover_expiry_months INTEGER, -- Months after year end

  -- Eligibility
  min_tenure_months INTEGER DEFAULT 0, -- Minimum months before accrual starts
  prorated_first_year BOOLEAN DEFAULT true,

  -- CCNL reference
  ccnl_type VARCHAR(100),
  is_ccnl_default BOOLEAN DEFAULT false,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_accrual_rules_tenant ON leave_accrual_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_accrual_rules_type ON leave_accrual_rules(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_accrual_rules_ccnl ON leave_accrual_rules(ccnl_type);

ALTER TABLE leave_accrual_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_leave_accrual_rules ON leave_accrual_rules;
CREATE POLICY tenant_isolation_leave_accrual_rules ON leave_accrual_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- SICK LEAVE & MEDICAL CERTIFICATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS medical_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_id UUID REFERENCES employee_time_off_requests(id) ON DELETE SET NULL,

  certificate_number VARCHAR(100),
  issue_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  diagnosis_code VARCHAR(50), -- ICD-10 code
  doctor_name VARCHAR(200),
  hospital_name VARCHAR(200),

  document_url TEXT,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  verified_by UUID,

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_certificates_tenant ON medical_certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_medical_certificates_employee ON medical_certificates(employee_id);
CREATE INDEX IF NOT EXISTS idx_medical_certificates_dates ON medical_certificates(start_date, end_date);

ALTER TABLE medical_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_medical_certificates ON medical_certificates;
CREATE POLICY tenant_isolation_medical_certificates ON medical_certificates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- HOLIDAYS CALENDAR TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system-wide holidays

  date DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),

  holiday_type VARCHAR(50) DEFAULT 'national', -- 'national', 'regional', 'company', 'optional'
  country_code VARCHAR(3) DEFAULT 'ITA',
  region_code VARCHAR(10), -- For regional holidays

  is_recurring BOOLEAN DEFAULT true, -- Same date every year
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_tenant ON holidays(tenant_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_unique ON holidays(tenant_id, date, holiday_type) WHERE is_active = true;

-- =============================================================================
-- INSERT DEFAULT ITALIAN HOLIDAYS (system-wide)
-- =============================================================================

INSERT INTO holidays (tenant_id, date, name, name_en, holiday_type, country_code, is_recurring)
VALUES
  (NULL, '2025-01-01', 'Capodanno', 'New Year''s Day', 'national', 'ITA', true),
  (NULL, '2025-01-06', 'Epifania', 'Epiphany', 'national', 'ITA', true),
  (NULL, '2025-04-25', 'Festa della Liberazione', 'Liberation Day', 'national', 'ITA', true),
  (NULL, '2025-05-01', 'Festa dei Lavoratori', 'Labour Day', 'national', 'ITA', true),
  (NULL, '2025-06-02', 'Festa della Repubblica', 'Republic Day', 'national', 'ITA', true),
  (NULL, '2025-08-15', 'Ferragosto', 'Assumption Day', 'national', 'ITA', true),
  (NULL, '2025-11-01', 'Ognissanti', 'All Saints'' Day', 'national', 'ITA', true),
  (NULL, '2025-12-08', 'Immacolata Concezione', 'Immaculate Conception', 'national', 'ITA', true),
  (NULL, '2025-12-25', 'Natale', 'Christmas Day', 'national', 'ITA', true),
  (NULL, '2025-12-26', 'Santo Stefano', 'St. Stephen''s Day', 'national', 'ITA', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- LEAVE BALANCE TRANSACTION LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS leave_balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  balance_id UUID NOT NULL REFERENCES employee_time_off_balances(id) ON DELETE CASCADE,

  transaction_type VARCHAR(50) NOT NULL, -- 'accrual', 'usage', 'adjustment', 'carryover', 'expiry'
  days_amount DECIMAL(5,2) NOT NULL, -- Positive for additions, negative for deductions

  reference_type VARCHAR(50), -- 'request', 'manual', 'system'
  reference_id UUID, -- ID of the request or other reference

  description TEXT,
  performed_by UUID,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_transactions_tenant ON leave_balance_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_balance ON leave_balance_transactions(balance_id);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_date ON leave_balance_transactions(created_at);

ALTER TABLE leave_balance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_leave_balance_transactions ON leave_balance_transactions;
CREATE POLICY tenant_isolation_leave_balance_transactions ON leave_balance_transactions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE employee_time_off_balances IS 'Employee leave balances by type and year';
COMMENT ON TABLE employee_time_off_requests IS 'Leave requests with approval workflow';
COMMENT ON TABLE leave_approval_steps IS 'Multi-step approval workflow for leave requests';
COMMENT ON TABLE leave_accrual_rules IS 'Configurable leave accrual rules per tenant/CCNL';
COMMENT ON TABLE medical_certificates IS 'Medical certificates for sick leave validation';
COMMENT ON TABLE holidays IS 'Public and company holidays calendar';
COMMENT ON TABLE leave_balance_transactions IS 'Audit log for all balance changes';
