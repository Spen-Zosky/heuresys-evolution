-- Migration: 009_payroll_integration
-- Epic: 7 - Payroll Integration (Zucchetti)
-- Stories: 7.1-7.5
-- Description: Complete payroll integration with Zucchetti and other payroll providers

-- =============================================================================
-- PAYROLL INTEGRATION CONFIGURATIONS (Story 7.1)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Provider Details
  provider_name VARCHAR(100) NOT NULL, -- 'zucchetti', 'adsystems', 'teamsystem', 'inaz', 'custom'
  provider_code VARCHAR(50) NOT NULL, -- 'ZUCC', 'ADS', 'TEAM', 'INAZ', 'CUSTOM'
  display_name VARCHAR(200),

  -- Integration Mode
  integration_type VARCHAR(30) NOT NULL DEFAULT 'file', -- 'api', 'file', 'sftp'

  -- API Configuration (encrypted)
  api_endpoint TEXT,
  api_key_encrypted TEXT, -- AES-256 encrypted
  api_secret_encrypted TEXT,

  -- SFTP Configuration (encrypted)
  sftp_host TEXT,
  sftp_port INTEGER DEFAULT 22,
  sftp_username TEXT,
  sftp_password_encrypted TEXT,
  sftp_path TEXT,

  -- Company Identification
  company_code VARCHAR(50), -- Zucchetti company code
  fiscal_code VARCHAR(20), -- Codice Fiscale azienda
  vat_number VARCHAR(20), -- Partita IVA
  inps_code VARCHAR(20), -- Matricola INPS
  inail_code VARCHAR(20), -- Codice INAIL

  -- Export Settings
  export_format VARCHAR(20) DEFAULT 'csv', -- 'csv', 'xml', 'json', 'fixed_width'
  file_encoding VARCHAR(20) DEFAULT 'UTF-8', -- 'UTF-8', 'ISO-8859-1', 'Windows-1252'
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  decimal_separator VARCHAR(1) DEFAULT ',',
  field_delimiter VARCHAR(5) DEFAULT ';',
  include_headers BOOLEAN DEFAULT true,

  -- Scheduling
  auto_export_enabled BOOLEAN DEFAULT false,
  export_schedule VARCHAR(100), -- cron expression: '0 8 25 * *' for 25th of month
  export_day_of_month INTEGER, -- 25 for 25th
  export_cutoff_day INTEGER, -- cutoff for changes (e.g., 20th)
  notification_recipients TEXT[], -- emails for notifications

  -- Connection Status
  last_connection_test TIMESTAMP,
  connection_status VARCHAR(20) DEFAULT 'unknown', -- 'connected', 'error', 'unknown'
  connection_error TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- primary payroll provider

  -- Metadata
  settings JSONB DEFAULT '{}', -- provider-specific settings
  field_mappings JSONB DEFAULT '{}', -- custom field mappings

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  UNIQUE (tenant_id, provider_code)
);

-- =============================================================================
-- PAYROLL EXPORT JOBS (Story 7.2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES payroll_integrations(id) ON DELETE SET NULL,

  -- Job Identification
  job_number VARCHAR(50) NOT NULL, -- auto-generated: PAY-2025-12-001
  job_name VARCHAR(200),

  -- Period
  pay_period_year INTEGER NOT NULL,
  pay_period_month INTEGER NOT NULL, -- 1-12
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,

  -- Export Type
  export_type VARCHAR(30) NOT NULL, -- 'full', 'delta', 'correction', 'annual'
  export_sections TEXT[] DEFAULT ARRAY['anagrafica', 'presenze', 'straordinari', 'variazioni'],

  -- Status Pipeline
  status VARCHAR(30) DEFAULT 'draft',
  -- draft -> validating -> validation_complete -> generating -> generated ->
  -- transmitting -> transmitted -> acknowledged -> completed | failed

  -- Progress Tracking
  progress_percent INTEGER DEFAULT 0,
  current_phase VARCHAR(50),

  -- Counts
  total_employees INTEGER DEFAULT 0,
  exported_employees INTEGER DEFAULT 0,
  employees_with_errors INTEGER DEFAULT 0,
  employees_with_warnings INTEGER DEFAULT 0,

  -- Validation Results
  validation_started_at TIMESTAMP,
  validation_completed_at TIMESTAMP,
  validation_errors JSONB DEFAULT '[]',
  validation_warnings JSONB DEFAULT '[]',
  validation_summary JSONB,

  -- Export File
  export_started_at TIMESTAMP,
  export_completed_at TIMESTAMP,
  export_file_path TEXT,
  export_file_size BIGINT,
  export_file_hash VARCHAR(64), -- SHA-256
  export_file_name VARCHAR(255),

  -- Transmission
  transmission_method VARCHAR(20), -- 'api', 'sftp', 'manual_download'
  transmission_started_at TIMESTAMP,
  transmission_completed_at TIMESTAMP,
  transmission_reference VARCHAR(100), -- Provider reference number
  transmission_response JSONB,

  -- Provider Acknowledgment
  acknowledged_at TIMESTAMP,
  acknowledgment_reference VARCHAR(100),
  acknowledgment_details JSONB,
  records_accepted INTEGER,
  records_rejected INTEGER,

  -- Error Handling
  error_code VARCHAR(50),
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  submitted_by UUID,
  submitted_at TIMESTAMP,
  approved_by UUID,
  approved_at TIMESTAMP
);

-- =============================================================================
-- PAYROLL EXPORT EMPLOYEE DETAILS (Story 7.2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_export_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES payroll_export_jobs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Employee Identification
  employee_code VARCHAR(50), -- Matricola
  fiscal_code VARCHAR(20), -- Codice Fiscale dipendente

  -- Export Status
  status VARCHAR(30) DEFAULT 'pending',
  -- pending -> validating -> validated -> exported -> error | skipped

  -- Data Sections Exported
  sections_included TEXT[],

  -- Validation
  validation_errors JSONB DEFAULT '[]',
  validation_warnings JSONB DEFAULT '[]',
  validation_overrides JSONB DEFAULT '[]', -- warnings overridden by user

  -- Export Data Snapshot
  anagrafica_data JSONB, -- Personal data export
  presenze_data JSONB, -- Attendance data
  straordinari_data JSONB, -- Overtime data
  variazioni_data JSONB, -- Contract changes
  assenze_data JSONB, -- Absence data

  -- Computed Values
  days_worked INTEGER,
  days_absent INTEGER,
  hours_regular DECIMAL(6,2),
  hours_overtime DECIMAL(6,2),
  hours_night DECIMAL(6,2),
  hours_holiday DECIMAL(6,2),

  -- Leave Breakdown
  leave_breakdown JSONB, -- { "ferie": 3, "rol": 1, "malattia": 2 }

  -- Processing
  processed_at TIMESTAMP,
  export_line_number INTEGER, -- position in export file

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PAYROLL VALIDATION RULES (Story 7.3)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system default

  -- Rule Identification
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(200) NOT NULL,
  rule_description TEXT,

  -- Rule Category
  category VARCHAR(50) NOT NULL,
  -- 'data_completeness', 'business_rule', 'anomaly_detection', 'ccnl_compliance'

  -- Rule Definition
  rule_type VARCHAR(30) NOT NULL, -- 'required_field', 'value_range', 'pattern', 'comparison', 'custom'
  rule_config JSONB NOT NULL, -- rule-specific configuration

  -- Severity
  severity VARCHAR(20) DEFAULT 'warning', -- 'error', 'warning', 'info'
  is_blocking BOOLEAN DEFAULT false, -- if true, blocks export

  -- Applicability
  applies_to_sections TEXT[], -- ['anagrafica', 'presenze', 'variazioni']
  ccnl_types TEXT[], -- applicable CCNL types, NULL = all

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_code)
);

-- =============================================================================
-- PAYROLL ANOMALY PATTERNS (Story 7.3)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_anomaly_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Pattern Identification
  pattern_code VARCHAR(50) NOT NULL,
  pattern_name VARCHAR(200) NOT NULL,
  pattern_description TEXT,

  -- Detection Configuration
  detection_type VARCHAR(30) NOT NULL, -- 'statistical', 'threshold', 'pattern', 'comparison'
  detection_config JSONB NOT NULL,
  -- e.g., { "type": "zscore", "field": "hours_overtime", "threshold": 2.5 }
  -- e.g., { "type": "threshold", "field": "salary_change_percent", "max": 20 }

  -- Severity
  severity VARCHAR(20) DEFAULT 'warning',
  requires_approval BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PAYROLL TRANSMISSION LOG (Story 7.4)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_transmission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES payroll_export_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Transmission Details
  transmission_type VARCHAR(30) NOT NULL, -- 'api', 'sftp', 'manual'
  transmission_attempt INTEGER DEFAULT 1,

  -- Request Details
  request_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  request_method VARCHAR(20),
  request_url TEXT,
  request_headers JSONB,
  request_size BIGINT,

  -- Response Details
  response_timestamp TIMESTAMP,
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,
  response_size BIGINT,

  -- Result
  success BOOLEAN,
  error_code VARCHAR(50),
  error_message TEXT,

  -- Provider Reference
  provider_reference VARCHAR(100),
  provider_message TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  initiated_by UUID
);

-- =============================================================================
-- PAYROLL EXPORT HISTORY (Story 7.5)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_export_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES payroll_export_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- File Details
  file_type VARCHAR(30) NOT NULL, -- 'main_export', 'validation_report', 'error_log', 'acknowledgment'
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_hash VARCHAR(64),
  mime_type VARCHAR(100),

  -- Storage
  storage_type VARCHAR(30) DEFAULT 'local', -- 'local', 's3', 'azure_blob'
  storage_reference TEXT,

  -- Retention
  expires_at TIMESTAMP,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  downloaded_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP,
  last_downloaded_by UUID
);

-- =============================================================================
-- PAYROLL FIELD MAPPINGS (Zucchetti Format)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES payroll_integrations(id) ON DELETE CASCADE,

  -- Section
  section VARCHAR(50) NOT NULL, -- 'anagrafica', 'presenze', 'variazioni', etc.

  -- Source (Heuresys)
  source_table VARCHAR(100) NOT NULL,
  source_field VARCHAR(100) NOT NULL,

  -- Target (Zucchetti)
  target_field VARCHAR(100) NOT NULL,
  target_field_name VARCHAR(200), -- descriptive name
  target_position INTEGER, -- for fixed-width formats
  target_length INTEGER,

  -- Transformation
  transform_type VARCHAR(30) DEFAULT 'direct', -- 'direct', 'lookup', 'format', 'expression', 'custom'
  transform_config JSONB,

  -- Formatting
  format_pattern VARCHAR(100), -- e.g., 'DD/MM/YYYY', '0000.00'
  pad_character VARCHAR(1),
  pad_direction VARCHAR(5), -- 'left', 'right'

  -- Validation
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,

  -- Priority (for ordering in export)
  priority INTEGER DEFAULT 100,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- ATTENDANCE DATA (for payroll export)
-- =============================================================================

CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Date
  attendance_date DATE NOT NULL,

  -- Time Tracking
  clock_in TIME,
  clock_out TIME,
  break_start TIME,
  break_end TIME,

  -- Hours
  hours_regular DECIMAL(5,2) DEFAULT 0,
  hours_overtime DECIMAL(5,2) DEFAULT 0,
  hours_night DECIMAL(5,2) DEFAULT 0,
  hours_holiday DECIMAL(5,2) DEFAULT 0,
  hours_total DECIMAL(5,2) GENERATED ALWAYS AS (hours_regular + hours_overtime + hours_night + hours_holiday) STORED,

  -- Status
  status VARCHAR(30) DEFAULT 'present',
  -- 'present', 'absent', 'partial', 'remote', 'travel', 'training'

  -- Source
  source VARCHAR(30) DEFAULT 'manual', -- 'manual', 'badge', 'import', 'calculated'
  source_reference TEXT,

  -- Validation
  is_validated BOOLEAN DEFAULT false,
  validated_by UUID,
  validated_at TIMESTAMP,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,

  UNIQUE (tenant_id, employee_id, attendance_date)
);

-- =============================================================================
-- OVERTIME RECORDS (for payroll export)
-- =============================================================================

CREATE TABLE IF NOT EXISTS employee_overtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Date
  overtime_date DATE NOT NULL,

  -- Hours by Type
  overtime_type VARCHAR(30) NOT NULL,
  -- 'feriale_diurno', 'feriale_notturno', 'festivo_diurno', 'festivo_notturno'
  hours DECIMAL(5,2) NOT NULL,

  -- Compensation
  rate_multiplier DECIMAL(3,2), -- e.g., 1.25, 1.50, 2.00
  hourly_rate DECIMAL(8,2),
  total_compensation DECIMAL(10,2),

  -- Approval
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
  requested_by UUID,
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMP,
  rejection_reason TEXT,

  -- Payroll Link
  payroll_job_id UUID REFERENCES payroll_export_jobs(id),
  exported_at TIMESTAMP,

  -- Notes
  reason TEXT,
  notes TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Payroll Integrations
CREATE INDEX IF NOT EXISTS idx_payroll_integrations_tenant ON payroll_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_integrations_provider ON payroll_integrations(provider_code);
CREATE INDEX IF NOT EXISTS idx_payroll_integrations_active ON payroll_integrations(is_active);

-- Export Jobs
CREATE INDEX IF NOT EXISTS idx_payroll_export_jobs_tenant ON payroll_export_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_jobs_period ON payroll_export_jobs(pay_period_year, pay_period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_export_jobs_status ON payroll_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_export_jobs_integration ON payroll_export_jobs(integration_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_jobs_number ON payroll_export_jobs(job_number);

-- Export Employees
CREATE INDEX IF NOT EXISTS idx_payroll_export_employees_job ON payroll_export_employees(job_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_employees_employee ON payroll_export_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_employees_status ON payroll_export_employees(status);

-- Validation Rules
CREATE INDEX IF NOT EXISTS idx_payroll_validation_rules_tenant ON payroll_validation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_validation_rules_category ON payroll_validation_rules(category);
CREATE INDEX IF NOT EXISTS idx_payroll_validation_rules_active ON payroll_validation_rules(is_active);

-- Transmission Log
CREATE INDEX IF NOT EXISTS idx_payroll_transmission_log_job ON payroll_transmission_log(job_id);
CREATE INDEX IF NOT EXISTS idx_payroll_transmission_log_tenant ON payroll_transmission_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_transmission_log_timestamp ON payroll_transmission_log(request_timestamp);

-- Export Files
CREATE INDEX IF NOT EXISTS idx_payroll_export_files_job ON payroll_export_files(job_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_files_tenant ON payroll_export_files(tenant_id);

-- Field Mappings
CREATE INDEX IF NOT EXISTS idx_payroll_field_mappings_tenant ON payroll_field_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_field_mappings_integration ON payroll_field_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_payroll_field_mappings_section ON payroll_field_mappings(section);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_employee_attendance_tenant ON employee_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_date ON employee_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_emp_date ON employee_attendance(employee_id, attendance_date);

-- Overtime
CREATE INDEX IF NOT EXISTS idx_employee_overtime_tenant ON employee_overtime(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_overtime_employee ON employee_overtime(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_overtime_date ON employee_overtime(overtime_date);
CREATE INDEX IF NOT EXISTS idx_employee_overtime_status ON employee_overtime(status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE payroll_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_export_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_anomaly_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_transmission_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_export_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_overtime ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS tenant_isolation_payroll_integrations ON payroll_integrations;
CREATE POLICY tenant_isolation_payroll_integrations ON payroll_integrations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_payroll_export_jobs ON payroll_export_jobs;
CREATE POLICY tenant_isolation_payroll_export_jobs ON payroll_export_jobs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_payroll_export_employees ON payroll_export_employees;
CREATE POLICY tenant_isolation_payroll_export_employees ON payroll_export_employees
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_or_system_validation_rules ON payroll_validation_rules;
CREATE POLICY tenant_or_system_validation_rules ON payroll_validation_rules
  FOR ALL USING (
    tenant_id IS NULL OR
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id IS NULL OR
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS tenant_or_system_anomaly_patterns ON payroll_anomaly_patterns;
CREATE POLICY tenant_or_system_anomaly_patterns ON payroll_anomaly_patterns
  FOR ALL USING (
    tenant_id IS NULL OR
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id IS NULL OR
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS tenant_isolation_payroll_transmission_log ON payroll_transmission_log;
CREATE POLICY tenant_isolation_payroll_transmission_log ON payroll_transmission_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_payroll_export_files ON payroll_export_files;
CREATE POLICY tenant_isolation_payroll_export_files ON payroll_export_files
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_or_system_field_mappings ON payroll_field_mappings;
CREATE POLICY tenant_or_system_field_mappings ON payroll_field_mappings
  FOR ALL USING (
    tenant_id IS NULL OR
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id IS NULL OR
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS tenant_isolation_employee_attendance ON employee_attendance;
CREATE POLICY tenant_isolation_employee_attendance ON employee_attendance
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_employee_overtime ON employee_overtime;
CREATE POLICY tenant_isolation_employee_overtime ON employee_overtime
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- DEFAULT VALIDATION RULES (System-wide)
-- =============================================================================

INSERT INTO payroll_validation_rules (tenant_id, rule_code, rule_name, rule_description, category, rule_type, rule_config, severity, is_blocking, applies_to_sections)
VALUES
  -- Data Completeness Rules
  (NULL, 'REQ_FISCAL_CODE', 'Codice Fiscale Obbligatorio', 'Il codice fiscale del dipendente deve essere presente', 'data_completeness', 'required_field', '{"field": "fiscal_code", "source_table": "employees"}', 'error', true, ARRAY['anagrafica']),
  (NULL, 'REQ_CONTRACT', 'Contratto Attivo Obbligatorio', 'Il dipendente deve avere un contratto attivo', 'data_completeness', 'required_field', '{"field": "active_contract", "source_table": "contracts"}', 'error', true, ARRAY['anagrafica']),
  (NULL, 'REQ_IBAN', 'IBAN Obbligatorio per Bonifico', 'L''IBAN deve essere presente per pagamento bonifico', 'data_completeness', 'required_field', '{"field": "iban", "source_table": "employees", "condition": "payment_method = bonifico"}', 'warning', false, ARRAY['anagrafica']),

  -- Business Rules
  (NULL, 'LEAVE_APPROVED', 'Ferie Approvate', 'Tutte le richieste ferie del periodo devono essere approvate', 'business_rule', 'comparison', '{"check": "all_approved", "source_table": "employee_time_off_requests"}', 'error', true, ARRAY['presenze']),
  (NULL, 'BALANCE_POSITIVE', 'Saldo Ferie Positivo', 'Il saldo ferie non deve essere negativo', 'business_rule', 'value_range', '{"field": "leave_balance", "min": 0}', 'warning', false, ARRAY['presenze']),
  (NULL, 'CONTRACT_VALID', 'Contratto Valido nel Periodo', 'Il contratto deve essere valido per tutto il periodo', 'business_rule', 'comparison', '{"check": "contract_covers_period"}', 'error', true, ARRAY['anagrafica']),

  -- CCNL Compliance
  (NULL, 'OT_LIMIT_ANNUAL', 'Limite Straordinario Annuale', 'Straordinario annuale non deve superare limite CCNL', 'ccnl_compliance', 'value_range', '{"field": "annual_overtime_hours", "max_field": "ccnl_overtime_limit"}', 'warning', false, ARRAY['straordinari']),
  (NULL, 'OT_LIMIT_WEEKLY', 'Limite Straordinario Settimanale', 'Straordinario settimanale non deve superare 48 ore totali', 'ccnl_compliance', 'value_range', '{"field": "weekly_total_hours", "max": 48}', 'warning', false, ARRAY['straordinari']),

  -- Anomaly Detection
  (NULL, 'ANOMALY_OT_SPIKE', 'Picco Straordinario', 'Straordinario significativamente superiore alla media', 'anomaly_detection', 'comparison', '{"type": "zscore", "field": "hours_overtime", "threshold": 2.5}', 'warning', false, ARRAY['straordinari']),
  (NULL, 'ANOMALY_SALARY_CHANGE', 'Variazione Stipendio', 'Variazione stipendio superiore al 20%', 'anomaly_detection', 'value_range', '{"field": "salary_change_percent", "max": 20}', 'warning', false, ARRAY['variazioni']),
  (NULL, 'ANOMALY_DUPLICATE', 'Presenze Duplicate', 'Verifica assenza di record presenze duplicati', 'anomaly_detection', 'pattern', '{"check": "no_duplicates", "key_fields": ["employee_id", "attendance_date"]}', 'error', true, ARRAY['presenze'])
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DEFAULT ZUCCHETTI FIELD MAPPINGS (System-wide)
-- =============================================================================

INSERT INTO payroll_field_mappings (tenant_id, integration_id, section, source_table, source_field, target_field, target_field_name, transform_type, transform_config, format_pattern, is_required, priority)
VALUES
  -- Anagrafica
  (NULL, NULL, 'anagrafica', 'employees', 'employee_code', 'MATR', 'Matricola', 'direct', '{}', NULL, true, 10),
  (NULL, NULL, 'anagrafica', 'employees', 'fiscal_code', 'CODFIS', 'Codice Fiscale', 'direct', '{}', NULL, true, 20),
  (NULL, NULL, 'anagrafica', 'employees', 'last_name', 'COGN', 'Cognome', 'direct', '{}', NULL, true, 30),
  (NULL, NULL, 'anagrafica', 'employees', 'first_name', 'NOME', 'Nome', 'direct', '{}', NULL, true, 40),
  (NULL, NULL, 'anagrafica', 'employees', 'birth_date', 'DTNAS', 'Data Nascita', 'format', '{"type": "date"}', 'DD/MM/YYYY', false, 50),
  (NULL, NULL, 'anagrafica', 'employees', 'gender', 'SESSO', 'Sesso', 'lookup', '{"M": "M", "F": "F"}', NULL, false, 60),
  (NULL, NULL, 'anagrafica', 'employees', 'email', 'EMAIL', 'Email', 'direct', '{}', NULL, false, 70),
  (NULL, NULL, 'anagrafica', 'employees', 'phone', 'TEL', 'Telefono', 'direct', '{}', NULL, false, 80),
  (NULL, NULL, 'anagrafica', 'employees', 'hire_date', 'DTASS', 'Data Assunzione', 'format', '{"type": "date"}', 'DD/MM/YYYY', true, 90),
  (NULL, NULL, 'anagrafica', 'contracts', 'ccnl_type', 'CCNL', 'Contratto Collettivo', 'direct', '{}', NULL, false, 100),
  (NULL, NULL, 'anagrafica', 'contracts', 'ccnl_level', 'LIVELLO', 'Livello', 'direct', '{}', NULL, false, 110),
  (NULL, NULL, 'anagrafica', 'departments', 'code', 'REPARTO', 'Reparto', 'lookup', '{"source": "department_id"}', NULL, false, 120),
  (NULL, NULL, 'anagrafica', 'cost_centers', 'code', 'CDC', 'Centro di Costo', 'lookup', '{"source": "cost_center_id"}', NULL, false, 130),

  -- Presenze
  (NULL, NULL, 'presenze', 'employee_attendance', 'attendance_date', 'DATA', 'Data', 'format', '{"type": "date"}', 'DD/MM/YYYY', true, 10),
  (NULL, NULL, 'presenze', 'employee_attendance', 'hours_regular', 'ORE_ORD', 'Ore Ordinarie', 'format', '{"type": "decimal"}', '0.00', true, 20),
  (NULL, NULL, 'presenze', 'employee_attendance', 'status', 'CAUSALE', 'Causale Presenza', 'lookup', '{"present": "P", "absent": "A", "remote": "SW"}', NULL, true, 30),

  -- Straordinari
  (NULL, NULL, 'straordinari', 'employee_overtime', 'overtime_date', 'DATA', 'Data', 'format', '{"type": "date"}', 'DD/MM/YYYY', true, 10),
  (NULL, NULL, 'straordinari', 'employee_overtime', 'hours', 'ORE_STR', 'Ore Straordinario', 'format', '{"type": "decimal"}', '0.00', true, 20),
  (NULL, NULL, 'straordinari', 'employee_overtime', 'overtime_type', 'TIPO_STR', 'Tipo Straordinario', 'lookup', '{"feriale_diurno": "SD", "feriale_notturno": "SN", "festivo_diurno": "SF", "festivo_notturno": "SFN"}', NULL, true, 30),

  -- Assenze
  (NULL, NULL, 'assenze', 'employee_time_off_requests', 'start_date', 'DATA_INI', 'Data Inizio', 'format', '{"type": "date"}', 'DD/MM/YYYY', true, 10),
  (NULL, NULL, 'assenze', 'employee_time_off_requests', 'end_date', 'DATA_FIN', 'Data Fine', 'format', '{"type": "date"}', 'DD/MM/YYYY', true, 20),
  (NULL, NULL, 'assenze', 'employee_time_off_requests', 'leave_type', 'CAUSALE', 'Causale Assenza', 'lookup', '{"ferie": "FER", "rol": "ROL", "malattia": "MAL", "maternita": "MAT", "permesso": "PER", "ex_festivita": "EXF"}', NULL, true, 30),
  (NULL, NULL, 'assenze', 'employee_time_off_requests', 'days_requested', 'GG_ASS', 'Giorni Assenza', 'format', '{"type": "decimal"}', '0.00', true, 40)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE payroll_integrations IS 'Payroll provider integration configurations (Zucchetti, TeamSystem, etc.)';
COMMENT ON TABLE payroll_export_jobs IS 'Payroll export job tracking and status';
COMMENT ON TABLE payroll_export_employees IS 'Per-employee details for each payroll export';
COMMENT ON TABLE payroll_validation_rules IS 'Validation rules for payroll export';
COMMENT ON TABLE payroll_anomaly_patterns IS 'Anomaly detection patterns for payroll data';
COMMENT ON TABLE payroll_transmission_log IS 'Transmission log for payroll exports';
COMMENT ON TABLE payroll_export_files IS 'Generated export files storage';
COMMENT ON TABLE payroll_field_mappings IS 'Field mappings for payroll export formats';
COMMENT ON TABLE employee_attendance IS 'Daily attendance tracking for payroll';
COMMENT ON TABLE employee_overtime IS 'Overtime records for payroll';
