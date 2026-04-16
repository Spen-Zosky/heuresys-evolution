-- Migration 155: Process Layer + Blueprint Generator schema
-- 7 tables: process_phases, process_roles, process_skill_requirements,
-- process_kpis, blueprint_templates, blueprint_runs, blueprint_results
-- RLS policies, FK indexes

BEGIN;

-- ============================================================
-- 1. CREATE TABLES
-- ============================================================

-- 1.1 process_phases
CREATE TABLE IF NOT EXISTS process_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  phase_code VARCHAR(50) NOT NULL,
  phase_name VARCHAR(255) NOT NULL,
  phase_order INTEGER NOT NULL,
  description TEXT,
  estimated_duration_days INTEGER,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(process_id, phase_code)
);

-- 1.2 process_roles
CREATE TABLE IF NOT EXISTS process_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES process_phases(id) ON DELETE SET NULL,
  role_name VARCHAR(255) NOT NULL,
  role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('owner','executor','approver','reviewer','informed')),
  esco_occupation_id UUID REFERENCES esco_occupations(id),
  min_headcount INTEGER DEFAULT 1,
  max_headcount INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 process_skill_requirements
CREATE TABLE IF NOT EXISTS process_skill_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES process_phases(id) ON DELETE SET NULL,
  esco_skill_id UUID NOT NULL REFERENCES esco_skills(id),
  proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
  is_mandatory BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(process_id, phase_id, esco_skill_id)
);

-- 1.4 process_kpis
CREATE TABLE IF NOT EXISTS process_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES process_phases(id) ON DELETE SET NULL,
  kpi_code VARCHAR(50) NOT NULL,
  kpi_name VARCHAR(255) NOT NULL,
  measurement_unit VARCHAR(100),
  target_direction VARCHAR(20) CHECK (target_direction IN ('higher_better','lower_better','target_range')),
  benchmark_value NUMERIC,
  benchmark_min NUMERIC,
  benchmark_max NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(process_id, kpi_code)
);

-- 1.5 blueprint_templates
CREATE TABLE IF NOT EXISTS blueprint_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES industry_profiles(id),
  template_name VARCHAR(255) NOT NULL,
  template_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  description TEXT,
  template_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, template_name, template_version)
);

-- 1.6 blueprint_runs
CREATE TABLE IF NOT EXISTS blueprint_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_id UUID NOT NULL REFERENCES blueprint_templates(id),
  run_mode VARCHAR(20) NOT NULL CHECK (run_mode IN ('greenfield','overlay')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  input_config JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7 blueprint_results
CREATE TABLE IF NOT EXISTS blueprint_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES blueprint_runs(id) ON DELETE CASCADE,
  result_type VARCHAR(50) NOT NULL CHECK (result_type IN ('org_unit_suggestion','process_mapping','skill_gap','role_assignment','kpi_target','cleanup_action')),
  entity_type VARCHAR(100),
  entity_id UUID,
  severity VARCHAR(20) CHECK (severity IN ('info','warning','critical','action_required')),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  suggested_action JSONB,
  is_applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ENABLE RLS + POLICIES
-- ============================================================

-- 2.1 process_phases — via business_processes.profile_id
ALTER TABLE process_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_phases FORCE ROW LEVEL SECURITY;

CREATE POLICY process_phases_tenant_isolation ON process_phases
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_phases.process_id
              AND t.id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_phases.process_id
              AND t.id = current_tenant_id()
        )
    );

-- 2.2 process_roles — via business_processes.profile_id
ALTER TABLE process_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY process_roles_tenant_isolation ON process_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_roles.process_id
              AND t.id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_roles.process_id
              AND t.id = current_tenant_id()
        )
    );

-- 2.3 process_skill_requirements — via business_processes.profile_id
ALTER TABLE process_skill_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_skill_requirements FORCE ROW LEVEL SECURITY;

CREATE POLICY process_skill_requirements_tenant_isolation ON process_skill_requirements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_skill_requirements.process_id
              AND t.id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_skill_requirements.process_id
              AND t.id = current_tenant_id()
        )
    );

-- 2.4 process_kpis — via business_processes.profile_id
ALTER TABLE process_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_kpis FORCE ROW LEVEL SECURITY;

CREATE POLICY process_kpis_tenant_isolation ON process_kpis
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_kpis.process_id
              AND t.id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_kpis.process_id
              AND t.id = current_tenant_id()
        )
    );

-- 2.5 blueprint_templates — via profile_id
ALTER TABLE blueprint_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY blueprint_templates_tenant_isolation ON blueprint_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenants
            WHERE tenants.id = current_tenant_id()
              AND tenants.industry_profile_id = blueprint_templates.profile_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenants
            WHERE tenants.id = current_tenant_id()
              AND tenants.industry_profile_id = blueprint_templates.profile_id
        )
    );

-- 2.6 blueprint_runs — diretta su tenant_id
ALTER TABLE blueprint_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY blueprint_runs_tenant_isolation ON blueprint_runs
    FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- 2.7 blueprint_results — via blueprint_runs.tenant_id
ALTER TABLE blueprint_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_results FORCE ROW LEVEL SECURITY;

CREATE POLICY blueprint_results_tenant_isolation ON blueprint_results
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM blueprint_runs br
            WHERE br.id = blueprint_results.run_id
              AND br.tenant_id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM blueprint_runs br
            WHERE br.id = blueprint_results.run_id
              AND br.tenant_id = current_tenant_id()
        )
    );

-- ============================================================
-- 3. FK INDEXES (12 indexes — skip leading columns of UNIQUE)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_process_roles_process_id ON process_roles(process_id);
CREATE INDEX IF NOT EXISTS idx_process_roles_phase_id ON process_roles(phase_id);
CREATE INDEX IF NOT EXISTS idx_process_roles_esco_occupation_id ON process_roles(esco_occupation_id);
CREATE INDEX IF NOT EXISTS idx_process_skill_requirements_phase_id ON process_skill_requirements(phase_id);
CREATE INDEX IF NOT EXISTS idx_process_skill_requirements_esco_skill_id ON process_skill_requirements(esco_skill_id);
CREATE INDEX IF NOT EXISTS idx_process_kpis_phase_id ON process_kpis(phase_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_templates_created_by ON blueprint_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_blueprint_runs_tenant_id ON blueprint_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_runs_template_id ON blueprint_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_runs_created_by ON blueprint_runs(created_by);
CREATE INDEX IF NOT EXISTS idx_blueprint_results_run_id ON blueprint_results(run_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_results_applied_by ON blueprint_results(applied_by);

-- ============================================================
-- 4. REGISTER MIGRATION
-- ============================================================

INSERT INTO schema_migrations (version) VALUES (155);

COMMIT;
