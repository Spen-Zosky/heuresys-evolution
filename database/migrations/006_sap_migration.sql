-- Migration: 006_sap_migration
-- Epic: 6 - SAP HCM Migration
-- Stories: 6.1-6.6
-- Description: SAP HCM data migration infrastructure with validation and rollback

-- =============================================================================
-- SAP MIGRATION JOBS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sap_migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Job identification
  job_name VARCHAR(200) NOT NULL,
  job_type VARCHAR(50) NOT NULL, -- 'full', 'delta', 'dry_run', 'rollback'

  -- Source configuration
  source_system VARCHAR(100), -- 'SAP_HCM', 'SAP_SF', etc.
  source_file_path TEXT,
  source_file_hash VARCHAR(64), -- SHA-256 of source file

  -- Status
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'parsing', 'validating', 'mapping', 'executing', 'completed', 'failed', 'rolled_back'
  progress_percent INTEGER DEFAULT 0,
  current_phase VARCHAR(50),

  -- Statistics
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_completion TIMESTAMP,

  -- Configuration
  config JSONB DEFAULT '{}',
  infotype_selection TEXT[], -- Which infotypes to process

  -- Results
  summary JSONB,
  error_log JSONB,

  -- Audit
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sap_jobs_tenant ON sap_migration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sap_jobs_status ON sap_migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sap_jobs_type ON sap_migration_jobs(job_type);

ALTER TABLE sap_migration_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sap_jobs ON sap_migration_jobs;
CREATE POLICY tenant_isolation_sap_jobs ON sap_migration_jobs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- SAP INFOTYPE MAPPINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sap_infotype_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system defaults

  -- SAP source
  infotype VARCHAR(10) NOT NULL, -- 'PA0001', 'PA0002', etc.
  infotype_name VARCHAR(200),
  sap_field VARCHAR(100) NOT NULL,
  sap_field_description VARCHAR(255),

  -- Target mapping
  target_table VARCHAR(100) NOT NULL,
  target_field VARCHAR(100) NOT NULL,

  -- Transformation
  transform_type VARCHAR(50) DEFAULT 'direct', -- 'direct', 'lookup', 'expression', 'custom'
  transform_config JSONB, -- Transformation rules

  -- Validation
  validation_rules JSONB, -- Validation config
  required BOOLEAN DEFAULT false,
  default_value TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- Processing order
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, infotype, sap_field)
);

CREATE INDEX IF NOT EXISTS idx_sap_mappings_tenant ON sap_infotype_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sap_mappings_infotype ON sap_infotype_mappings(infotype);

-- =============================================================================
-- SAP STAGED DATA TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sap_staged_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES sap_migration_jobs(id) ON DELETE CASCADE,

  -- Source identification
  infotype VARCHAR(10) NOT NULL,
  pernr VARCHAR(20) NOT NULL, -- SAP Personnel Number
  subtype VARCHAR(10),
  object_id VARCHAR(50),

  -- Validity period
  begda DATE, -- Begin date
  endda DATE, -- End date
  seqnr INTEGER, -- Sequence number

  -- Raw data
  raw_data JSONB NOT NULL,

  -- Processing status
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'validated', 'mapped', 'imported', 'error', 'skipped'
  validation_errors JSONB,
  validation_warnings JSONB,

  -- Mapped data
  mapped_data JSONB,
  target_table VARCHAR(100),
  target_id UUID, -- ID of created/updated record

  -- Audit
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sap_staged_tenant ON sap_staged_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sap_staged_job ON sap_staged_data(job_id);
CREATE INDEX IF NOT EXISTS idx_sap_staged_pernr ON sap_staged_data(pernr);
CREATE INDEX IF NOT EXISTS idx_sap_staged_infotype ON sap_staged_data(infotype);
CREATE INDEX IF NOT EXISTS idx_sap_staged_status ON sap_staged_data(status);

ALTER TABLE sap_staged_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sap_staged ON sap_staged_data;
CREATE POLICY tenant_isolation_sap_staged ON sap_staged_data
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- SAP MIGRATION ROLLBACK LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS sap_migration_rollback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES sap_migration_jobs(id) ON DELETE CASCADE,

  -- Operation details
  operation VARCHAR(20) NOT NULL, -- 'insert', 'update', 'delete'
  target_table VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL,

  -- Data for rollback
  old_data JSONB, -- Previous state (for update/delete)
  new_data JSONB, -- New state (for insert/update)

  -- Rollback status
  rolled_back BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sap_rollback_tenant ON sap_migration_rollback_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sap_rollback_job ON sap_migration_rollback_log(job_id);

ALTER TABLE sap_migration_rollback_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sap_rollback ON sap_migration_rollback_log;
CREATE POLICY tenant_isolation_sap_rollback ON sap_migration_rollback_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- SAP PERNR TO EMPLOYEE MAPPING
-- =============================================================================

CREATE TABLE IF NOT EXISTS sap_employee_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  pernr VARCHAR(20) NOT NULL, -- SAP Personnel Number
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Sync status
  last_synced_at TIMESTAMP,
  sync_status VARCHAR(30) DEFAULT 'active', -- 'active', 'inactive', 'archived'

  -- Metadata
  sap_data_snapshot JSONB, -- Last known SAP data
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, pernr)
);

CREATE INDEX IF NOT EXISTS idx_sap_emp_mapping_tenant ON sap_employee_mapping(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sap_emp_mapping_pernr ON sap_employee_mapping(pernr);
CREATE INDEX IF NOT EXISTS idx_sap_emp_mapping_employee ON sap_employee_mapping(employee_id);

ALTER TABLE sap_employee_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sap_emp_mapping ON sap_employee_mapping;
CREATE POLICY tenant_isolation_sap_emp_mapping ON sap_employee_mapping
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- SAP DELTA SYNC LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS sap_delta_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Sync details
  sync_type VARCHAR(30) NOT NULL, -- 'scheduled', 'manual', 'triggered'
  source_timestamp TIMESTAMP, -- SAP data timestamp
  local_timestamp TIMESTAMP DEFAULT NOW(),

  -- Statistics
  records_checked INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  records_unchanged INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(30) DEFAULT 'completed',
  error_message TEXT,
  details JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sap_delta_tenant ON sap_delta_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sap_delta_date ON sap_delta_sync_log(created_at);

ALTER TABLE sap_delta_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sap_delta ON sap_delta_sync_log;
CREATE POLICY tenant_isolation_sap_delta ON sap_delta_sync_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- INSERT DEFAULT INFOTYPE MAPPINGS
-- =============================================================================

-- PA0001 - Organizational Assignment
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0001', 'Organizational Assignment', 'PERNR', 'employees', 'employee_number', 'direct', true),
  (NULL, 'PA0001', 'Organizational Assignment', 'BUKRS', 'employees', 'company_code', 'lookup', false),
  (NULL, 'PA0001', 'Organizational Assignment', 'WERKS', 'employees', 'location_id', 'lookup', false),
  (NULL, 'PA0001', 'Organizational Assignment', 'ORGEH', 'employees', 'org_unit_id', 'lookup', false),
  (NULL, 'PA0001', 'Organizational Assignment', 'PLANS', 'employees', 'position_title', 'direct', false),
  (NULL, 'PA0001', 'Organizational Assignment', 'STELL', 'employees', 'job_title', 'direct', false),
  (NULL, 'PA0001', 'Organizational Assignment', 'KOSTL', 'employees', 'cost_center_id', 'lookup', false)
ON CONFLICT DO NOTHING;

-- PA0002 - Personal Data
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0002', 'Personal Data', 'VORNA', 'employees', 'first_name', 'direct', true),
  (NULL, 'PA0002', 'Personal Data', 'NACHN', 'employees', 'last_name', 'direct', true),
  (NULL, 'PA0002', 'Personal Data', 'GBDAT', 'employees', 'date_of_birth', 'date', false),
  (NULL, 'PA0002', 'Personal Data', 'GESCH', 'employees', 'gender', 'lookup', false),
  (NULL, 'PA0002', 'Personal Data', 'GBORT', 'employees', 'birth_place', 'direct', false),
  (NULL, 'PA0002', 'Personal Data', 'NATIO', 'employees', 'nationality', 'direct', false),
  (NULL, 'PA0002', 'Personal Data', 'FAMST', 'employees', 'marital_status', 'lookup', false),
  (NULL, 'PA0002', 'Personal Data', 'SPRSL', 'employees', 'language', 'direct', false)
ON CONFLICT DO NOTHING;

-- PA0006 - Address
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0006', 'Address', 'STRAS', 'employees', 'address_line1', 'direct', false),
  (NULL, 'PA0006', 'Address', 'ORT01', 'employees', 'city', 'direct', false),
  (NULL, 'PA0006', 'Address', 'PSTLZ', 'employees', 'postal_code', 'direct', false),
  (NULL, 'PA0006', 'Address', 'LAND1', 'employees', 'country', 'direct', false),
  (NULL, 'PA0006', 'Address', 'REESSION', 'employees', 'state', 'direct', false)
ON CONFLICT DO NOTHING;

-- PA0105 - Communication
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0105', 'Communication', 'USRID_LONG', 'employees', 'work_email', 'expression', false),
  (NULL, 'PA0105', 'Communication', 'TELNR', 'employees', 'work_phone', 'direct', false)
ON CONFLICT DO NOTHING;

-- PA0000 - Actions
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0000', 'Actions', 'MASSN', 'employee_contracts', 'action_type', 'lookup', false),
  (NULL, 'PA0000', 'Actions', 'MASSG', 'employee_contracts', 'action_reason', 'lookup', false),
  (NULL, 'PA0000', 'Actions', 'STAT2', 'employees', 'employment_status', 'lookup', false)
ON CONFLICT DO NOTHING;

-- PA0007 - Planned Working Time
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0007', 'Planned Working Time', 'SCHKZ', 'employees', 'work_schedule', 'direct', false),
  (NULL, 'PA0007', 'Planned Working Time', 'EMPCT', 'employees', 'employment_percentage', 'direct', false),
  (NULL, 'PA0007', 'Planned Working Time', 'WKWDY', 'employees', 'weekly_hours', 'direct', false)
ON CONFLICT DO NOTHING;

-- PA0008 - Basic Pay
INSERT INTO sap_infotype_mappings (tenant_id, infotype, infotype_name, sap_field, target_table, target_field, transform_type, required)
VALUES
  (NULL, 'PA0008', 'Basic Pay', 'TRFAR', 'employees', 'pay_grade', 'direct', false),
  (NULL, 'PA0008', 'Basic Pay', 'TRFGB', 'employees', 'pay_area', 'direct', false),
  (NULL, 'PA0008', 'Basic Pay', 'TRFGR', 'employees', 'pay_group', 'direct', false),
  (NULL, 'PA0008', 'Basic Pay', 'TRFST', 'employees', 'pay_level', 'direct', false)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE sap_migration_jobs IS 'SAP HCM data migration job tracking';
COMMENT ON TABLE sap_infotype_mappings IS 'Field mappings from SAP infotypes to Heuresys tables';
COMMENT ON TABLE sap_staged_data IS 'Staging area for parsed SAP data before import';
COMMENT ON TABLE sap_migration_rollback_log IS 'Rollback log for migration operations';
COMMENT ON TABLE sap_employee_mapping IS 'PERNR to Employee ID mapping for sync';
COMMENT ON TABLE sap_delta_sync_log IS 'Delta synchronization history';
