-- Migration 143: Tenant Onboarding with Ontological Profile & Org Prototype Generator
-- Adds ontological metadata to tenants, creates prototype rules/templates,
-- and seeds the 4 demo tenants with NACE profiles.
--
-- Key design decisions:
--   - "positions" = job_templates (existing table, has esco_occupation_uri)
--   - position_skill_requirements.position_id references job_templates(id)
--   - departments has tenant_id, code, name, name_en
--   - tenants already has nace_code, employee_count, industry_type, address_country
--   - org_templates + org_unit_templates exist but are sparsely populated

BEGIN;

-- ============================================================================
-- A1: Extend tenants with ontological profile columns
-- ============================================================================

-- nace_primary is the 4-digit NACE code (e.g., '64.19'); nace_code is 1-letter section
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nace_primary VARCHAR(10);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nace_secondary TEXT[];
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_size VARCHAR(10)
    CHECK (company_size IN ('MICRO', 'SMALL', 'MEDIUM', 'LARGE'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS employee_count_range_min INTEGER;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS employee_count_range_max INTEGER;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_prototype_customized BOOLEAN DEFAULT false;

-- ============================================================================
-- A2: Extend job_templates (the "positions" table) with prototype tracking
-- ============================================================================

ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS is_prototype_generated BOOLEAN DEFAULT false;
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_job_templates_tenant ON job_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_templates_prototype ON job_templates(tenant_id) WHERE is_prototype_generated = true;

-- ============================================================================
-- A3: Tenant onboarding profiles — snapshot of what was generated
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_onboarding_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nace_occupations_snapshot JSONB,
    size_modifiers JSONB,
    prototype_config JSONB,
    departments_generated INTEGER DEFAULT 0,
    positions_generated INTEGER DEFAULT 0,
    skill_requirements_generated INTEGER DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generator_version VARCHAR(20) DEFAULT '1.0'
);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_profiles_tenant
    ON tenant_onboarding_profiles(tenant_id);

-- ============================================================================
-- A4: Org prototype rules — one row per company_size (+ optional nace_section)
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_prototype_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_size VARCHAR(10) NOT NULL CHECK (company_size IN ('MICRO', 'SMALL', 'MEDIUM', 'LARGE')),
    nace_section VARCHAR(5),
    max_hierarchy_levels INTEGER NOT NULL,
    min_departments INTEGER NOT NULL,
    max_departments INTEGER NOT NULL,
    role_specialization_factor FLOAT NOT NULL CHECK (role_specialization_factor BETWEEN 0.0 AND 1.0),
    merge_support_functions BOOLEAN DEFAULT false,
    department_merge_rules JSONB DEFAULT '{}',
    mandatory_departments JSONB DEFAULT '[]',
    optional_departments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_size, nace_section)
);

-- ============================================================================
-- A5: Org prototype templates — department templates per ISCO major group
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_prototype_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES org_prototype_rules(id) ON DELETE CASCADE,
    isco_major_group VARCHAR(2) NOT NULL,
    department_name_en VARCHAR(100) NOT NULL,
    department_name_it VARCHAR(100),
    function_type VARCHAR(20) CHECK (function_type IN ('CORE', 'SUPPORT', 'MANAGEMENT')),
    default_headcount_pct INTEGER,
    typical_positions JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_prototype_templates_rule
    ON org_prototype_templates(rule_id);

-- ============================================================================
-- A6: Seed org_prototype_rules
-- ============================================================================

INSERT INTO org_prototype_rules
    (company_size, max_hierarchy_levels, min_departments, max_departments,
     role_specialization_factor, merge_support_functions, mandatory_departments)
VALUES
    ('MICRO', 1, 2, 3, 0.2, true,
     '["Core Operations", "Administration"]'),
    ('SMALL', 2, 3, 5, 0.4, true,
     '["Core Operations", "Administration", "Commercial"]'),
    ('MEDIUM', 3, 5, 8, 0.7, false,
     '["Core Operations", "Administration", "Commercial", "Human Resources", "Finance & Accounting"]'),
    ('LARGE', 5, 8, 15, 1.0, false,
     '["Core Operations", "Administration", "Commercial", "Human Resources", "Finance & Accounting", "Legal & Compliance", "IT & Technology"]')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- A7: Seed org_prototype_templates — ISCO major group → department mapping
-- ============================================================================

-- For each rule, create template mappings
-- MICRO/SMALL: merge support functions (groups 4+9 → Administration, 6+7+8 → Production)
DO $$
DECLARE
    v_micro_id UUID;
    v_small_id UUID;
    v_medium_id UUID;
    v_large_id UUID;
BEGIN
    SELECT id INTO v_micro_id FROM org_prototype_rules WHERE company_size = 'MICRO' AND nace_section IS NULL;
    SELECT id INTO v_small_id FROM org_prototype_rules WHERE company_size = 'SMALL' AND nace_section IS NULL;
    SELECT id INTO v_medium_id FROM org_prototype_rules WHERE company_size = 'MEDIUM' AND nace_section IS NULL;
    SELECT id INTO v_large_id FROM org_prototype_rules WHERE company_size = 'LARGE' AND nace_section IS NULL;

    -- ---- MICRO (merged) ----
    INSERT INTO org_prototype_templates (rule_id, isco_major_group, department_name_en, department_name_it, function_type, default_headcount_pct) VALUES
        (v_micro_id, '1', 'Management', 'Direzione', 'MANAGEMENT', 15),
        (v_micro_id, '2', 'Core Operations', 'Operazioni Core', 'CORE', 40),
        (v_micro_id, '3', 'Core Operations', 'Operazioni Core', 'CORE', 0),
        (v_micro_id, '4', 'Administration', 'Amministrazione', 'SUPPORT', 20),
        (v_micro_id, '5', 'Core Operations', 'Operazioni Core', 'CORE', 0),
        (v_micro_id, '6', 'Core Operations', 'Operazioni Core', 'CORE', 0),
        (v_micro_id, '7', 'Core Operations', 'Operazioni Core', 'CORE', 0),
        (v_micro_id, '8', 'Core Operations', 'Operazioni Core', 'CORE', 0),
        (v_micro_id, '9', 'Administration', 'Amministrazione', 'SUPPORT', 0)
    ON CONFLICT DO NOTHING;

    -- ---- SMALL (partially merged) ----
    INSERT INTO org_prototype_templates (rule_id, isco_major_group, department_name_en, department_name_it, function_type, default_headcount_pct) VALUES
        (v_small_id, '1', 'Management', 'Direzione', 'MANAGEMENT', 10),
        (v_small_id, '2', 'Core Operations', 'Operazioni Core', 'CORE', 30),
        (v_small_id, '3', 'Technical Support', 'Supporto Tecnico', 'CORE', 15),
        (v_small_id, '4', 'Administration', 'Amministrazione', 'SUPPORT', 15),
        (v_small_id, '5', 'Commercial', 'Commerciale', 'CORE', 15),
        (v_small_id, '6', 'Production', 'Produzione', 'CORE', 5),
        (v_small_id, '7', 'Production', 'Produzione', 'CORE', 0),
        (v_small_id, '8', 'Production', 'Produzione', 'CORE', 0),
        (v_small_id, '9', 'Administration', 'Amministrazione', 'SUPPORT', 0)
    ON CONFLICT DO NOTHING;

    -- ---- MEDIUM (some specialization) ----
    INSERT INTO org_prototype_templates (rule_id, isco_major_group, department_name_en, department_name_it, function_type, default_headcount_pct) VALUES
        (v_medium_id, '1', 'Management', 'Direzione', 'MANAGEMENT', 8),
        (v_medium_id, '2', 'Core Operations', 'Operazioni Core', 'CORE', 25),
        (v_medium_id, '3', 'Technical Services', 'Servizi Tecnici', 'CORE', 12),
        (v_medium_id, '4', 'Administration', 'Amministrazione', 'SUPPORT', 10),
        (v_medium_id, '5', 'Commercial & Sales', 'Commerciale e Vendite', 'CORE', 15),
        (v_medium_id, '6', 'Production', 'Produzione', 'CORE', 8),
        (v_medium_id, '7', 'Manufacturing', 'Manifattura', 'CORE', 8),
        (v_medium_id, '8', 'Operations', 'Operations', 'CORE', 6),
        (v_medium_id, '9', 'General Support', 'Supporto Generale', 'SUPPORT', 3)
    ON CONFLICT DO NOTHING;

    -- ---- LARGE (full specialization) ----
    INSERT INTO org_prototype_templates (rule_id, isco_major_group, department_name_en, department_name_it, function_type, default_headcount_pct) VALUES
        (v_large_id, '1', 'Executive Management', 'Direzione Generale', 'MANAGEMENT', 5),
        (v_large_id, '2', 'Core Professionals', 'Professionisti Core', 'CORE', 20),
        (v_large_id, '3', 'Technical & Associate', 'Tecnici e Associati', 'CORE', 12),
        (v_large_id, '4', 'Administration & Clerical', 'Amministrazione e Segreteria', 'SUPPORT', 8),
        (v_large_id, '5', 'Sales & Customer Service', 'Vendite e Servizio Clienti', 'CORE', 15),
        (v_large_id, '6', 'Agricultural & Primary', 'Agricoltura e Primario', 'CORE', 5),
        (v_large_id, '7', 'Skilled Trades & Crafts', 'Artigianato Specializzato', 'CORE', 8),
        (v_large_id, '8', 'Plant & Machine Operations', 'Impianti e Macchinari', 'CORE', 8),
        (v_large_id, '9', 'General Support Services', 'Servizi di Supporto Generale', 'SUPPORT', 4)
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- A8: Update demo tenants with NACE profiles and company size
-- ============================================================================

UPDATE tenants SET
    nace_primary = '70.22',
    company_size = 'SMALL',
    employee_count_range_min = 1,
    employee_count_range_max = 10
WHERE code = 'heuresys';

UPDATE tenants SET
    nace_primary = '64.19',
    company_size = 'LARGE',
    employee_count_range_min = 100,
    employee_count_range_max = 500
WHERE code = 'rtl-bank';

UPDATE tenants SET
    nace_primary = '10.89',
    company_size = 'MEDIUM',
    employee_count_range_min = 50,
    employee_count_range_max = 150
WHERE code = 'smartfood';

UPDATE tenants SET
    nace_primary = '35.11',
    company_size = 'SMALL',
    employee_count_range_min = 10,
    employee_count_range_max = 50
WHERE code = 'econova';

-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (version) VALUES ('143') ON CONFLICT DO NOTHING;

COMMIT;
