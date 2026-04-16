-- Migration: 013_prototype_generator_schema.sql
-- Description: Tenant Prototype Generator system - 9 new tables for business processes,
--              org unit mapping, tasks, KPIs, distribution, and staffing rules
-- Author: Claude AI
-- Date: 2025-12-19

BEGIN;

-- ============================================================================
-- 1. BUSINESS PROCESSES TABLE
-- Stores standard business processes per industry prototype (Porter's Value Chain)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prototype_id UUID NOT NULL REFERENCES industry_prototypes(id) ON DELETE CASCADE,
    process_code VARCHAR(20) NOT NULL,
    process_name VARCHAR(100) NOT NULL,
    process_category VARCHAR(50) NOT NULL CHECK (process_category IN ('primary', 'support')),
    value_chain_position INTEGER NOT NULL CHECK (value_chain_position BETWEEN 1 AND 9),
    description TEXT,
    typical_inputs TEXT[] DEFAULT '{}',
    typical_outputs TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(prototype_id, process_code)
);

COMMENT ON TABLE business_processes IS 'Standard business processes per industry prototype following Porter''s Value Chain';
COMMENT ON COLUMN business_processes.process_category IS 'primary: inbound logistics, operations, outbound, marketing, service | support: procurement, technology, HR, infrastructure';
COMMENT ON COLUMN business_processes.value_chain_position IS '1-5 for primary activities, 6-9 for support activities';

-- ============================================================================
-- 2. PROCESS COST CENTERS TABLE
-- Links business processes to cost centers
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    cost_center_code VARCHAR(20) NOT NULL,
    cost_center_name VARCHAR(100) NOT NULL,
    cost_type VARCHAR(50) NOT NULL CHECK (cost_type IN ('direct', 'indirect', 'overhead')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(process_id, cost_center_code)
);

COMMENT ON TABLE process_cost_centers IS 'Cost centers associated with business processes';
COMMENT ON COLUMN process_cost_centers.cost_type IS 'direct: production costs | indirect: support costs | overhead: administrative costs';

-- ============================================================================
-- 3. ORG UNIT PROCESS MAPPING TABLE
-- Maps organizational units to business processes and cost centers
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_unit_process_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_unit_template_id UUID NOT NULL REFERENCES org_unit_templates(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    cost_center_id UUID REFERENCES process_cost_centers(id) ON DELETE SET NULL,
    responsibility_level VARCHAR(20) NOT NULL CHECK (responsibility_level IN ('primary', 'secondary', 'support')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_unit_template_id, process_id)
);

COMMENT ON TABLE org_unit_process_mapping IS 'Maps org unit templates to business processes with responsibility levels';
COMMENT ON COLUMN org_unit_process_mapping.responsibility_level IS 'primary: main owner | secondary: shared responsibility | support: contributing role';

-- ============================================================================
-- 4. ORG UNIT TASKS TABLE
-- Extended tasks specific to organizational units
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_unit_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_unit_template_id UUID NOT NULL REFERENCES org_unit_templates(id) ON DELETE CASCADE,
    task_code VARCHAR(20) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_description TEXT,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'on_demand')),
    complexity_level INTEGER NOT NULL CHECK (complexity_level BETWEEN 1 AND 5),
    estimated_hours DECIMAL(6,2),
    requires_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_unit_template_id, task_code)
);

COMMENT ON TABLE org_unit_tasks IS 'Extended tasks associated with org unit templates';
COMMENT ON COLUMN org_unit_tasks.complexity_level IS '1: simple, 2: routine, 3: moderate, 4: complex, 5: highly complex';

-- ============================================================================
-- 5. ORG UNIT KPIS TABLE
-- KPIs specific to organizational units
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_unit_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_unit_template_id UUID NOT NULL REFERENCES org_unit_templates(id) ON DELETE CASCADE,
    kpi_code VARCHAR(20) NOT NULL,
    kpi_name VARCHAR(200) NOT NULL,
    kpi_description TEXT,
    measurement_unit VARCHAR(50) NOT NULL,
    target_direction VARCHAR(20) NOT NULL CHECK (target_direction IN ('increase', 'decrease', 'maintain', 'range')),
    benchmark_value DECIMAL(15,2),
    benchmark_min DECIMAL(15,2),
    benchmark_max DECIMAL(15,2),
    data_source VARCHAR(100),
    calculation_formula TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_unit_template_id, kpi_code)
);

COMMENT ON TABLE org_unit_kpis IS 'KPIs associated with org unit templates';
COMMENT ON COLUMN org_unit_kpis.target_direction IS 'increase: higher is better | decrease: lower is better | maintain: stable | range: within bounds';

-- ============================================================================
-- 6. JOB TASK DISTRIBUTION TABLE
-- Distributes org unit tasks to job roles with responsibility percentages
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_task_distribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
    org_unit_task_id UUID NOT NULL REFERENCES org_unit_tasks(id) ON DELETE CASCADE,
    responsibility_percentage INTEGER NOT NULL CHECK (responsibility_percentage BETWEEN 0 AND 100),
    is_primary_owner BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_template_id, org_unit_task_id)
);

COMMENT ON TABLE job_task_distribution IS 'Distribution of org unit tasks to job roles';
COMMENT ON COLUMN job_task_distribution.responsibility_percentage IS 'Percentage of task responsibility assigned to this job role (0-100)';
COMMENT ON COLUMN job_task_distribution.is_primary_owner IS 'True if this role is the primary accountable party for the task';

-- ============================================================================
-- 7. JOB KPI DISTRIBUTION TABLE
-- Distributes org unit KPIs to job roles with accountability levels
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_kpi_distribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
    org_unit_kpi_id UUID NOT NULL REFERENCES org_unit_kpis(id) ON DELETE CASCADE,
    accountability_level VARCHAR(20) NOT NULL CHECK (accountability_level IN ('owner', 'contributor', 'informed')),
    weight_percentage INTEGER NOT NULL CHECK (weight_percentage BETWEEN 0 AND 100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_template_id, org_unit_kpi_id)
);

COMMENT ON TABLE job_kpi_distribution IS 'Distribution of org unit KPIs to job roles';
COMMENT ON COLUMN job_kpi_distribution.accountability_level IS 'owner: fully accountable | contributor: partial accountability | informed: receives reports';
COMMENT ON COLUMN job_kpi_distribution.weight_percentage IS 'Weight of this KPI in the job role''s overall performance evaluation (0-100)';

-- ============================================================================
-- 8. PROTOTYPE STAFFING RULES TABLE
-- Staffing rules per prototype, org unit, job role, and company size
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_staffing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prototype_id UUID NOT NULL REFERENCES industry_prototypes(id) ON DELETE CASCADE,
    org_unit_template_id UUID NOT NULL REFERENCES org_unit_templates(id) ON DELETE CASCADE,
    job_template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
    company_size VARCHAR(20) NOT NULL CHECK (company_size IN ('micro', 'small', 'medium', 'large', 'enterprise')),
    min_headcount INTEGER NOT NULL CHECK (min_headcount >= 0),
    max_headcount INTEGER CHECK (max_headcount IS NULL OR max_headcount >= min_headcount),
    recommended_headcount INTEGER,
    is_mandatory BOOLEAN DEFAULT true,
    rationale TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(prototype_id, org_unit_template_id, job_template_id, company_size)
);

COMMENT ON TABLE prototype_staffing_rules IS 'Staffing rules per industry prototype, adjusted by company size';
COMMENT ON COLUMN prototype_staffing_rules.company_size IS 'micro: <10 | small: 10-49 | medium: 50-249 | large: 250-999 | enterprise: 1000+';
COMMENT ON COLUMN prototype_staffing_rules.is_mandatory IS 'If true, this role must be filled; if false, role is optional';

-- ============================================================================
-- 9. PROTOTYPE GENERATION SESSIONS TABLE
-- Tracks prototype generation sessions for tenants
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_generation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prototype_id UUID NOT NULL REFERENCES industry_prototypes(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'researching', 'generating_structure', 'generating_roles',
        'calculating_staffing', 'defining_tasks', 'defining_kpis',
        'distributing', 'completed', 'failed', 'cancelled'
    )),
    phase VARCHAR(50),
    config JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    error_log TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE prototype_generation_sessions IS 'Tracks prototype generation sessions for tenants';
COMMENT ON COLUMN prototype_generation_sessions.status IS 'Current status of the generation process';
COMMENT ON COLUMN prototype_generation_sessions.phase IS 'Current phase within the status';
COMMENT ON COLUMN prototype_generation_sessions.config IS 'JSON config parameters for generation';
COMMENT ON COLUMN prototype_generation_sessions.results IS 'JSON results and statistics from generation';

-- ============================================================================
-- INDICES
-- ============================================================================

-- Business processes indices
CREATE INDEX idx_business_processes_prototype ON business_processes(prototype_id);
CREATE INDEX idx_business_processes_category ON business_processes(process_category);
CREATE INDEX idx_business_processes_position ON business_processes(value_chain_position);

-- Process cost centers indices
CREATE INDEX idx_process_cost_centers_process ON process_cost_centers(process_id);
CREATE INDEX idx_process_cost_centers_type ON process_cost_centers(cost_type);

-- Org unit process mapping indices
CREATE INDEX idx_org_unit_process_mapping_unit ON org_unit_process_mapping(org_unit_template_id);
CREATE INDEX idx_org_unit_process_mapping_process ON org_unit_process_mapping(process_id);
CREATE INDEX idx_org_unit_process_mapping_cost_center ON org_unit_process_mapping(cost_center_id);

-- Org unit tasks indices
CREATE INDEX idx_org_unit_tasks_unit ON org_unit_tasks(org_unit_template_id);
CREATE INDEX idx_org_unit_tasks_frequency ON org_unit_tasks(frequency);
CREATE INDEX idx_org_unit_tasks_complexity ON org_unit_tasks(complexity_level);

-- Org unit KPIs indices
CREATE INDEX idx_org_unit_kpis_unit ON org_unit_kpis(org_unit_template_id);
CREATE INDEX idx_org_unit_kpis_direction ON org_unit_kpis(target_direction);

-- Job task distribution indices
CREATE INDEX idx_job_task_distribution_job ON job_task_distribution(job_template_id);
CREATE INDEX idx_job_task_distribution_task ON job_task_distribution(org_unit_task_id);
CREATE INDEX idx_job_task_distribution_primary ON job_task_distribution(is_primary_owner) WHERE is_primary_owner = true;

-- Job KPI distribution indices
CREATE INDEX idx_job_kpi_distribution_job ON job_kpi_distribution(job_template_id);
CREATE INDEX idx_job_kpi_distribution_kpi ON job_kpi_distribution(org_unit_kpi_id);
CREATE INDEX idx_job_kpi_distribution_level ON job_kpi_distribution(accountability_level);

-- Prototype staffing rules indices
CREATE INDEX idx_prototype_staffing_rules_prototype ON prototype_staffing_rules(prototype_id);
CREATE INDEX idx_prototype_staffing_rules_org_unit ON prototype_staffing_rules(org_unit_template_id);
CREATE INDEX idx_prototype_staffing_rules_job ON prototype_staffing_rules(job_template_id);
CREATE INDEX idx_prototype_staffing_rules_size ON prototype_staffing_rules(company_size);
CREATE INDEX idx_prototype_staffing_rules_mandatory ON prototype_staffing_rules(is_mandatory) WHERE is_mandatory = true;

-- Prototype generation sessions indices
CREATE INDEX idx_prototype_generation_sessions_tenant ON prototype_generation_sessions(tenant_id);
CREATE INDEX idx_prototype_generation_sessions_prototype ON prototype_generation_sessions(prototype_id);
CREATE INDEX idx_prototype_generation_sessions_status ON prototype_generation_sessions(status);
CREATE INDEX idx_prototype_generation_sessions_created ON prototype_generation_sessions(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_processes_updated_at
    BEFORE UPDATE ON business_processes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_process_cost_centers_updated_at
    BEFORE UPDATE ON process_cost_centers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_unit_process_mapping_updated_at
    BEFORE UPDATE ON org_unit_process_mapping
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_unit_tasks_updated_at
    BEFORE UPDATE ON org_unit_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_unit_kpis_updated_at
    BEFORE UPDATE ON org_unit_kpis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_task_distribution_updated_at
    BEFORE UPDATE ON job_task_distribution
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_kpi_distribution_updated_at
    BEFORE UPDATE ON job_kpi_distribution
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prototype_staffing_rules_updated_at
    BEFORE UPDATE ON prototype_staffing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prototype_generation_sessions_updated_at
    BEFORE UPDATE ON prototype_generation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
