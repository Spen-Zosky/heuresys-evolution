-- Migration: 012_org_chart_generation.sql
-- Description: Org Chart Generation System
-- Created: 2025-12-17
--
-- This migration creates tables for:
-- 1. org_chart_generation_sessions - Track AI generation sessions
-- 2. employees_staging - Working copy of employees for org chart changes
-- 3. org_chart_snapshots - JSON snapshots for export (Tree, Excalidraw)
-- 4. Extensions to industry_prototypes and org_chart_templates

BEGIN;

-- ============================================================================
-- 1. ORG_CHART_GENERATION_SESSIONS
-- ============================================================================
-- Tracks each org chart generation session with AI prompts and responses

CREATE TABLE IF NOT EXISTS org_chart_generation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Session metadata
    session_name VARCHAR(255) NOT NULL,
    session_description TEXT,

    -- Generation configuration
    generation_method VARCHAR(50) NOT NULL DEFAULT 'combined',
    -- Options: 'web_search', 'template', 'nace_esco', 'combined'

    -- Industry context
    nace_section CHAR(1),
    nace_division VARCHAR(2),
    nace_group VARCHAR(4),
    nace_code VARCHAR(10), -- Full NACE code
    industry_name VARCHAR(255),
    company_size VARCHAR(20) DEFAULT 'medium',
    -- Options: 'micro', 'small', 'medium', 'large', 'enterprise'

    -- AI interaction
    ai_provider VARCHAR(50), -- 'gemini', 'openai', 'anthropic'
    ai_model VARCHAR(100),
    ai_prompt TEXT,
    ai_response JSONB,

    -- Generated structure
    generated_structure JSONB,
    -- Schema: {
    --   "units": [{ "code", "name", "parent_code", "level", "type", "headcount_budget" }],
    --   "positions": [{ "code", "title_it", "title_en", "unit_code", "level", "is_manager", "headcount" }]
    -- }

    -- Tenant context snapshot (for regeneration)
    tenant_context JSONB,
    -- Schema: {
    --   "employee_count", "departments", "locations", "cost_centers",
    --   "existing_job_titles", "existing_org_units"
    -- }

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Options: 'pending', 'generating', 'generated', 'assigning', 'completed', 'failed'
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_generation_method CHECK (
        generation_method IN ('web_search', 'template', 'nace_esco', 'combined')
    ),
    CONSTRAINT ck_company_size CHECK (
        company_size IN ('micro', 'small', 'medium', 'large', 'enterprise')
    ),
    CONSTRAINT ck_session_status CHECK (
        status IN ('pending', 'generating', 'generated', 'assigning', 'completed', 'failed', 'approved')
    )
);

-- Indexes for org_chart_generation_sessions
CREATE INDEX idx_ocgs_tenant ON org_chart_generation_sessions(tenant_id);
CREATE INDEX idx_ocgs_status ON org_chart_generation_sessions(status);
CREATE INDEX idx_ocgs_created ON org_chart_generation_sessions(created_at DESC);
CREATE INDEX idx_ocgs_nace ON org_chart_generation_sessions(nace_code);

-- ============================================================================
-- 2. EMPLOYEES_STAGING
-- ============================================================================
-- Working copy of employees with change tracking for org chart modifications

CREATE TABLE IF NOT EXISTS employees_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES org_chart_generation_sessions(id) ON DELETE CASCADE,
    original_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Core employee fields (mirror of employees table)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    personal_email VARCHAR(255),

    -- Contact
    phone_mobile VARCHAR(30),
    phone_work VARCHAR(30),
    phone_home VARCHAR(30),

    -- Employment
    job_title VARCHAR(255),
    department VARCHAR(100),
    location VARCHAR(255),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Organizational (THESE ARE THE KEY FIELDS FOR STAGING)
    manager_id UUID, -- Reference to another staging record
    department_id UUID,
    org_unit_id UUID,
    cost_center_id UUID,
    position_id VARCHAR(50),
    cost_center VARCHAR(50),

    -- Hierarchy (NEW - specific to generated org chart)
    hierarchy_level INTEGER CHECK (hierarchy_level BETWEEN 1 AND 7),
    -- 1=CEO, 2=C-Level, 3=VP, 4=Director, 5=Manager, 6=Team Lead, 7=Employee
    reports_to_staging_id UUID REFERENCES employees_staging(id) ON DELETE SET NULL,
    position_code VARCHAR(50), -- Link to generated position
    unit_code VARCHAR(50), -- Link to generated unit

    -- Additional employee fields
    birth_date DATE,
    birth_place VARCHAR(100),
    gender VARCHAR(10),
    nationality VARCHAR(50),
    marital_status VARCHAR(20),

    -- Address
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_postal_code VARCHAR(20),
    address_country VARCHAR(3),
    address_region VARCHAR(50),

    -- Compensation
    salary NUMERIC(15,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    pay_scale_area VARCHAR(10),
    pay_scale_type VARCHAR(10),
    pay_scale_group VARCHAR(10),
    pay_scale_level VARCHAR(10),
    pay_periods_per_year INTEGER DEFAULT 12,

    -- Banking
    iban VARCHAR(34),
    swift_bic VARCHAR(11),
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),

    -- Skills and Performance
    skills TEXT[] DEFAULT '{}',
    performance_rating NUMERIC(3,2),
    potential VARCHAR(20),

    -- Groups
    employee_group VARCHAR(50),
    employee_subgroup VARCHAR(50),

    -- Work
    work_schedule_percentage NUMERIC(5,2) DEFAULT 100.00,

    -- Legacy/SAP
    pernr VARCHAR(8),
    legacy_org_unit_code VARCHAR(50),
    tax_id VARCHAR(20),

    -- ============================================================================
    -- STAGING-SPECIFIC FIELDS (Change Tracking)
    -- ============================================================================

    -- Original values snapshot (before changes)
    original_values JSONB NOT NULL DEFAULT '{}',
    -- Schema: { "field_name": "original_value", ... }

    -- List of modified fields
    diff_fields TEXT[] DEFAULT '{}',
    -- Example: ['job_title', 'department_id', 'manager_id', 'hierarchy_level']

    -- Type of change
    change_type VARCHAR(30) NOT NULL DEFAULT 'unchanged',
    -- Options: 'unchanged', 'new_position', 'reassignment', 'promotion', 'demotion', 'transfer', 'new_hire_slot'

    -- Assignment metadata
    assignment_confidence NUMERIC(5,4), -- 0.0000 to 1.0000
    assignment_method VARCHAR(50), -- 'job_title_match', 'department_match', 'manager_chain', 'manual', 'ai_suggested'
    assignment_notes TEXT,

    -- Approval workflow
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_staging_change_type CHECK (
        change_type IN ('unchanged', 'new_position', 'reassignment', 'promotion', 'demotion', 'transfer', 'new_hire_slot')
    ),
    CONSTRAINT ck_staging_assignment_method CHECK (
        assignment_method IS NULL OR
        assignment_method IN ('job_title_match', 'department_match', 'manager_chain', 'manual', 'ai_suggested', 'esco_match')
    )
);

-- Indexes for employees_staging
CREATE INDEX idx_es_session ON employees_staging(session_id);
CREATE INDEX idx_es_tenant ON employees_staging(tenant_id);
CREATE INDEX idx_es_original_employee ON employees_staging(original_employee_id);
CREATE INDEX idx_es_reports_to ON employees_staging(reports_to_staging_id);
CREATE INDEX idx_es_change_type ON employees_staging(change_type);
CREATE INDEX idx_es_hierarchy ON employees_staging(session_id, hierarchy_level);
CREATE INDEX idx_es_position ON employees_staging(session_id, position_code);
CREATE INDEX idx_es_unit ON employees_staging(session_id, unit_code);
CREATE INDEX idx_es_approved ON employees_staging(session_id, is_approved);

-- ============================================================================
-- 3. ORG_CHART_SNAPSHOTS
-- ============================================================================
-- JSON snapshots for export (Tree structure, Excalidraw format, etc.)

CREATE TABLE IF NOT EXISTS org_chart_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES org_chart_generation_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Snapshot metadata
    snapshot_name VARCHAR(255) NOT NULL,
    snapshot_type VARCHAR(30) NOT NULL,
    -- Options: 'prototype', 'real', 'staging', 'final'
    snapshot_version VARCHAR(20) DEFAULT '1.0.0',

    -- JSON structures
    tree_structure JSONB,
    -- Schema: {
    --   "root": {
    --     "id", "code", "name", "level", "type",
    --     "employee": { "id", "name", "title" },
    --     "children": [...]
    --   }
    -- }

    excalidraw_format JSONB,
    -- Schema: Excalidraw JSON format with elements, appState, files

    employees_map JSONB,
    -- Schema: {
    --   "employee_id": { "position_code", "unit_code", "level", "reports_to" },
    --   ...
    -- }

    statistics JSONB,
    -- Schema: {
    --   "total_positions", "filled_positions", "vacant_positions",
    --   "employees_by_level": { "1": n, "2": n, ... },
    --   "avg_span_of_control", "max_depth"
    -- }

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_snapshot_type CHECK (
        snapshot_type IN ('prototype', 'real', 'staging', 'final')
    )
);

-- Indexes for org_chart_snapshots
CREATE INDEX idx_ocs_session ON org_chart_snapshots(session_id);
CREATE INDEX idx_ocs_tenant ON org_chart_snapshots(tenant_id);
CREATE INDEX idx_ocs_type ON org_chart_snapshots(snapshot_type);
CREATE INDEX idx_ocs_active ON org_chart_snapshots(tenant_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 4. EXTENSIONS TO EXISTING TABLES
-- ============================================================================

-- 4.1 Extend industry_prototypes
ALTER TABLE industry_prototypes
    ADD COLUMN IF NOT EXISTS typical_hierarchy JSONB,
    -- Schema: {
    --   "levels": [
    --     { "level": 1, "name_it": "Amministratore Delegato", "name_en": "CEO", "typical_count": 1 },
    --     { "level": 2, "name_it": "Direttore", "name_en": "C-Level", "typical_count": 4 },
    --     ...
    --   ]
    -- }
    ADD COLUMN IF NOT EXISTS typical_span_of_control INTEGER[] DEFAULT '{5,7,10,8,6,4}',
    -- Array by level: [L1, L2, L3, L4, L5, L6] typical direct reports
    ADD COLUMN IF NOT EXISTS esco_occupation_codes TEXT[] DEFAULT '{}',
    -- ESCO occupation codes typical for this industry
    ADD COLUMN IF NOT EXISTS department_templates TEXT[] DEFAULT '{}';
    -- Template department names for this industry

-- 4.2 Extend org_chart_templates
ALTER TABLE org_chart_templates
    ADD COLUMN IF NOT EXISTS template_structure JSONB,
    -- Schema: same as generated_structure in sessions
    ADD COLUMN IF NOT EXISTS position_definitions JSONB,
    -- Schema: {
    --   "positions": [
    --     { "code", "title_it", "title_en", "level", "esco_code", "description" }
    --   ]
    -- }
    ADD COLUMN IF NOT EXISTS nace_section CHAR(1),
    ADD COLUMN IF NOT EXISTS nace_division VARCHAR(2),
    ADD COLUMN IF NOT EXISTS size_class VARCHAR(20),
    ADD COLUMN IF NOT EXISTS level_count INTEGER DEFAULT 7;

-- ============================================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trg_ocgs_updated_at ON org_chart_generation_sessions;
CREATE TRIGGER trg_ocgs_updated_at
    BEFORE UPDATE ON org_chart_generation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_es_updated_at ON employees_staging;
CREATE TRIGGER trg_es_updated_at
    BEFORE UPDATE ON employees_staging
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ocs_updated_at ON org_chart_snapshots;
CREATE TRIGGER trg_ocs_updated_at
    BEFORE UPDATE ON org_chart_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to compute diff between employees and employees_staging
CREATE OR REPLACE FUNCTION compute_staging_diff(
    p_original_employee_id UUID,
    p_staging_id UUID
) RETURNS TEXT[] AS $$
DECLARE
    v_diff TEXT[] := '{}';
    v_original RECORD;
    v_staging RECORD;
BEGIN
    -- Get original employee
    SELECT * INTO v_original FROM employees WHERE id = p_original_employee_id;
    SELECT * INTO v_staging FROM employees_staging WHERE id = p_staging_id;

    IF v_original IS NULL OR v_staging IS NULL THEN
        RETURN v_diff;
    END IF;

    -- Compare key organizational fields
    IF v_original.job_title IS DISTINCT FROM v_staging.job_title THEN
        v_diff := array_append(v_diff, 'job_title');
    END IF;
    IF v_original.department IS DISTINCT FROM v_staging.department THEN
        v_diff := array_append(v_diff, 'department');
    END IF;
    IF v_original.department_id IS DISTINCT FROM v_staging.department_id THEN
        v_diff := array_append(v_diff, 'department_id');
    END IF;
    IF v_original.org_unit_id IS DISTINCT FROM v_staging.org_unit_id THEN
        v_diff := array_append(v_diff, 'org_unit_id');
    END IF;
    IF v_original.manager_id IS DISTINCT FROM v_staging.manager_id THEN
        v_diff := array_append(v_diff, 'manager_id');
    END IF;
    IF v_original.cost_center_id IS DISTINCT FROM v_staging.cost_center_id THEN
        v_diff := array_append(v_diff, 'cost_center_id');
    END IF;
    IF v_original.position_id IS DISTINCT FROM v_staging.position_id THEN
        v_diff := array_append(v_diff, 'position_id');
    END IF;
    IF v_original.location IS DISTINCT FROM v_staging.location THEN
        v_diff := array_append(v_diff, 'location');
    END IF;

    RETURN v_diff;
END;
$$ LANGUAGE plpgsql;

-- Function to get hierarchy statistics for a session
CREATE OR REPLACE FUNCTION get_session_hierarchy_stats(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_employees', COUNT(*),
        'by_level', jsonb_object_agg(
            COALESCE(hierarchy_level::text, 'unassigned'),
            level_count
        ),
        'by_change_type', jsonb_object_agg(
            change_type,
            type_count
        ),
        'approved_count', SUM(CASE WHEN is_approved THEN 1 ELSE 0 END),
        'pending_count', SUM(CASE WHEN NOT is_approved THEN 1 ELSE 0 END)
    ) INTO v_stats
    FROM (
        SELECT
            hierarchy_level,
            change_type,
            is_approved,
            COUNT(*) OVER (PARTITION BY hierarchy_level) as level_count,
            COUNT(*) OVER (PARTITION BY change_type) as type_count
        FROM employees_staging
        WHERE session_id = p_session_id
    ) sub;

    RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE org_chart_generation_sessions IS 'Tracks org chart generation sessions with AI prompts, responses, and generated structures';
COMMENT ON TABLE employees_staging IS 'Working copy of employees for org chart modifications with change tracking';
COMMENT ON TABLE org_chart_snapshots IS 'JSON snapshots of org charts for export (Tree, Excalidraw, etc.)';

COMMENT ON COLUMN employees_staging.original_values IS 'JSONB snapshot of original field values before staging changes';
COMMENT ON COLUMN employees_staging.diff_fields IS 'Array of field names that differ from original employee record';
COMMENT ON COLUMN employees_staging.change_type IS 'Type of organizational change: unchanged, new_position, reassignment, promotion, demotion, transfer, new_hire_slot';
COMMENT ON COLUMN employees_staging.hierarchy_level IS 'Hierarchy level 1-7: 1=CEO, 2=C-Level, 3=VP, 4=Director, 5=Manager, 6=Team Lead, 7=Employee';

COMMIT;

-- ============================================================================
-- ROLLBACK (for manual rollback if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS org_chart_snapshots CASCADE;
-- DROP TABLE IF EXISTS employees_staging CASCADE;
-- DROP TABLE IF EXISTS org_chart_generation_sessions CASCADE;
-- ALTER TABLE industry_prototypes DROP COLUMN IF EXISTS typical_hierarchy;
-- ALTER TABLE industry_prototypes DROP COLUMN IF EXISTS typical_span_of_control;
-- ALTER TABLE industry_prototypes DROP COLUMN IF EXISTS esco_occupation_codes;
-- ALTER TABLE industry_prototypes DROP COLUMN IF EXISTS department_templates;
-- ALTER TABLE org_chart_templates DROP COLUMN IF EXISTS template_structure;
-- ALTER TABLE org_chart_templates DROP COLUMN IF EXISTS position_definitions;
-- ALTER TABLE org_chart_templates DROP COLUMN IF EXISTS nace_section;
-- ALTER TABLE org_chart_templates DROP COLUMN IF EXISTS nace_division;
-- ALTER TABLE org_chart_templates DROP COLUMN IF EXISTS size_class;
-- ALTER TABLE org_chart_templates DROP COLUMN IF EXISTS level_count;
-- DROP FUNCTION IF EXISTS compute_staging_diff;
-- DROP FUNCTION IF EXISTS get_session_hierarchy_stats;
