-- Migration 096: Create 22 missing tables for data population
-- 19 actual tables + 3 views (leave_balances, leave_requests, attendance_records)
-- All tables include tenant_id, RLS policies, and proper indexes

BEGIN;

-- ============================================================
-- SECTION 1: HR Core Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  contract_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  pay_scale_area VARCHAR(10),
  ccnl_code VARCHAR(10),
  level VARCHAR(20),
  annual_salary NUMERIC(12,2),
  currency VARCHAR(5) DEFAULT 'EUR',
  fte_percentage NUMERIC(5,2) DEFAULT 100.00,
  probation_end_date DATE,
  notice_period_days INTEGER,
  is_current BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  address_type VARCHAR(20) NOT NULL DEFAULT 'home',
  street VARCHAR(200),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  province VARCHAR(10),
  country_code VARCHAR(3) DEFAULT 'IT',
  is_primary BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  relationship VARCHAR(100),
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  iban VARCHAR(34),
  swift_bic VARCHAR(11),
  bank_name VARCHAR(200),
  bank_account_number VARCHAR(30),
  bank_key VARCHAR(15),
  bank_control_key VARCHAR(5),
  bank_country VARCHAR(3) DEFAULT 'IT',
  is_primary BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  effective_date DATE NOT NULL,
  salary NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  salary_type VARCHAR(20) DEFAULT 'annual',
  change_reason VARCHAR(100),
  previous_salary NUMERIC(12,2),
  change_percentage NUMERIC(5,2),
  contract_id UUID REFERENCES contracts(id),
  approved_by UUID REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  course_id UUID REFERENCES courses(id),
  training_title VARCHAR(255) NOT NULL,
  training_type VARCHAR(50) DEFAULT 'internal',
  provider VARCHAR(200),
  start_date DATE,
  end_date DATE,
  completion_date DATE,
  status VARCHAR(30) DEFAULT 'enrolled',
  score NUMERIC(5,2),
  passed BOOLEAN,
  certificate_url TEXT,
  credit_hours NUMERIC(5,1),
  cost NUMERIC(10,2),
  cost_currency VARCHAR(3) DEFAULT 'EUR',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 2: Leave & Attendance (VIEWS on existing tables)
-- ============================================================

CREATE OR REPLACE VIEW leave_balances AS
SELECT
  id,
  tenant_id,
  employee_id,
  leave_type,
  total_days AS balance,
  used_days,
  pending_days,
  year,
  carryover_days,
  carryover_expires_at,
  accrued_days,
  adjustment_days,
  created_at,
  updated_at
FROM employee_time_off_balances;

CREATE OR REPLACE VIEW leave_requests AS
SELECT
  id,
  tenant_id,
  employee_id,
  leave_type,
  start_date,
  end_date,
  days_requested,
  reason,
  status,
  approver_id,
  approved_at,
  rejection_reason,
  half_day_start,
  half_day_end,
  medical_certificate_required,
  cancellation_requested,
  cancellation_reason,
  created_at,
  updated_at
FROM employee_time_off_requests;

CREATE OR REPLACE VIEW attendance_records AS
SELECT
  id,
  tenant_id,
  employee_id,
  attendance_date,
  clock_in,
  clock_out,
  hours_regular,
  hours_overtime,
  hours_total AS hours_worked,
  status,
  source,
  notes,
  is_validated,
  created_at,
  updated_at
FROM employee_attendance;

-- ============================================================
-- SECTION 3: Workforce Planning Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS workforce_plan_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workforce_plan_id UUID NOT NULL REFERENCES workforce_plans(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scenario_type VARCHAR(50) DEFAULT 'base',
  assumptions JSONB DEFAULT '{}',
  target_date DATE,
  status VARCHAR(20) DEFAULT 'draft',
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workforce_plan_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workforce_plan_id UUID NOT NULL REFERENCES workforce_plans(id),
  scenario_id UUID REFERENCES workforce_plan_scenarios(id),
  action_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_department_id UUID REFERENCES departments(id),
  target_role VARCHAR(200),
  headcount INTEGER DEFAULT 1,
  target_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  estimated_cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 4: Recruiting & Mobility
-- ============================================================

CREATE TABLE IF NOT EXISTS internal_mobility_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title VARCHAR(255) NOT NULL,
  department_id UUID REFERENCES departments(id),
  location_id UUID REFERENCES locations(id),
  work_type VARCHAR(30) DEFAULT 'hybrid',
  summary TEXT,
  job_level VARCHAR(50),
  job_family VARCHAR(100),
  required_skills TEXT[],
  min_tenure_months INTEGER DEFAULT 6,
  min_rating NUMERIC(3,1),
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  currency VARCHAR(10) DEFAULT 'EUR',
  status VARCHAR(30) DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  hiring_manager_id UUID REFERENCES employees(id),
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 5: Job Structure (job_families first for FK)
-- ============================================================

CREATE TABLE IF NOT EXISTS job_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES job_families(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS job_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_title VARCHAR(200) NOT NULL,
  job_family_id UUID REFERENCES job_families(id),
  department_id UUID REFERENCES departments(id),
  job_level VARCHAR(50),
  scope_of_work TEXT,
  key_responsibilities JSONB DEFAULT '[]',
  required_qualifications JSONB DEFAULT '[]',
  esco_occupation_uri VARCHAR(500),
  complexity_score INTEGER CHECK (complexity_score BETWEEN 1 AND 5),
  analyst_id UUID REFERENCES employees(id),
  analysis_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_analysis_id UUID REFERENCES job_analysis(id),
  job_title VARCHAR(200) NOT NULL,
  evaluation_method VARCHAR(50) DEFAULT 'point_factor',
  total_points INTEGER,
  job_grade VARCHAR(20),
  knowledge_points INTEGER,
  problem_solving_points INTEGER,
  accountability_points INTEGER,
  evaluated_by UUID REFERENCES employees(id),
  evaluation_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 6: Ontology Extension Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS ontology_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  feedback_type VARCHAR(30) NOT NULL,
  feedback_text TEXT,
  submitted_by UUID REFERENCES employees(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ontology_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC(5,4),
  measurement_date DATE DEFAULT CURRENT_DATE,
  model_version VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ontology_source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_system VARCHAR(50) NOT NULL,
  source_id VARCHAR(200) NOT NULL,
  source_type VARCHAR(50),
  target_table VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL,
  confidence_score NUMERIC(5,4),
  mapping_method VARCHAR(50) DEFAULT 'manual',
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cross_entity_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_entity_type VARCHAR(50) NOT NULL,
  source_entity_id UUID NOT NULL,
  target_entity_type VARCHAR(50) NOT NULL,
  target_entity_id UUID NOT NULL,
  relation_type VARCHAR(50) NOT NULL,
  confidence_score NUMERIC(5,4),
  source VARCHAR(30) DEFAULT 'manual',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type)
);

CREATE TABLE IF NOT EXISTS skill_taxonomy_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  skill_id UUID NOT NULL REFERENCES esco_skills(id),
  extension_type VARCHAR(50) NOT NULL,
  extension_key VARCHAR(100),
  extension_value TEXT,
  language VARCHAR(10) DEFAULT 'it',
  source VARCHAR(50) DEFAULT 'manual',
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 7: Calibration Results
-- ============================================================

CREATE TABLE IF NOT EXISTS calibration_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  calibration_session_id UUID NOT NULL REFERENCES calibration_sessions(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  performance_review_id UUID REFERENCES performance_reviews(id),
  pre_calibration_rating NUMERIC(3,1),
  post_calibration_rating NUMERIC(3,1),
  final_rating NUMERIC(3,1),
  rating_change NUMERIC(3,1) GENERATED ALWAYS AS (post_calibration_rating - pre_calibration_rating) STORED,
  justification TEXT,
  is_outlier BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  calibration_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 8: RBAC Extension
-- ============================================================

CREATE TABLE IF NOT EXISTS permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id),
  is_granted BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB DEFAULT '{}',
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES employees(id),
  expires_at TIMESTAMPTZ,
  reason TEXT,
  UNIQUE(tenant_id, role, permission_id)
);

-- ============================================================
-- SECTION 9: RLS Policies
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_plan_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_plan_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_mobility_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology_source_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_entity_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_taxonomy_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant isolation via session variable
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'employee_contracts', 'employee_addresses', 'employee_emergency_contacts',
      'employee_bank_details', 'salary_history', 'employee_training_records',
      'workforce_plan_scenarios', 'workforce_plan_actions', 'internal_mobility_postings',
      'job_families', 'job_analysis', 'job_evaluations',
      'ontology_feedback', 'ontology_source_mappings',
      'cross_entity_relations', 'skill_taxonomy_extensions',
      'calibration_results', 'permission_overrides'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'')::uuid)',
      'rls_' || tbl || '_tenant',
      tbl
    );
  END LOOP;
END $$;

-- ontology_quality_metrics has no tenant_id - open policy
CREATE POLICY rls_ontology_quality_metrics_open ON ontology_quality_metrics FOR ALL USING (true);

-- ============================================================
-- SECTION 10: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_employee_contracts_tenant ON employee_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_contracts_employee ON employee_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_addresses_tenant ON employee_addresses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_addresses_employee ON employee_addresses(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_emergency_contacts_tenant ON employee_emergency_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_emergency_contacts_employee ON employee_emergency_contacts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_bank_details_tenant ON employee_bank_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_bank_details_employee ON employee_bank_details(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_tenant ON salary_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_employee ON salary_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_date ON salary_history(effective_date);
CREATE INDEX IF NOT EXISTS idx_employee_training_records_tenant ON employee_training_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_training_records_employee ON employee_training_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_workforce_plan_scenarios_tenant ON workforce_plan_scenarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workforce_plan_scenarios_plan ON workforce_plan_scenarios(workforce_plan_id);
CREATE INDEX IF NOT EXISTS idx_workforce_plan_actions_tenant ON workforce_plan_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workforce_plan_actions_plan ON workforce_plan_actions(workforce_plan_id);
CREATE INDEX IF NOT EXISTS idx_internal_mobility_postings_tenant ON internal_mobility_postings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_mobility_postings_status ON internal_mobility_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_families_tenant ON job_families(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_analysis_tenant ON job_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_analysis_family ON job_analysis(job_family_id);
CREATE INDEX IF NOT EXISTS idx_job_evaluations_tenant ON job_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_evaluations_analysis ON job_evaluations(job_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ontology_feedback_tenant ON ontology_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ontology_feedback_entity ON ontology_feedback(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ontology_quality_entity ON ontology_quality_metrics(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ontology_source_mappings_tenant ON ontology_source_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ontology_source_mappings_source ON ontology_source_mappings(source_system, source_id);
CREATE INDEX IF NOT EXISTS idx_cross_entity_relations_tenant ON cross_entity_relations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cross_entity_relations_source ON cross_entity_relations(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_cross_entity_relations_target ON cross_entity_relations(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_extensions_tenant ON skill_taxonomy_extensions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_extensions_skill ON skill_taxonomy_extensions(skill_id);
CREATE INDEX IF NOT EXISTS idx_calibration_results_tenant ON calibration_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calibration_results_session ON calibration_results(calibration_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_results_employee ON calibration_results(employee_id);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_tenant ON permission_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_role ON permission_overrides(role);

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('096_create_missing_tables', now())
ON CONFLICT DO NOTHING;

COMMIT;
