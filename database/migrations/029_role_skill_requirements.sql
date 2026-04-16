-- Migration: 029_role_skill_requirements
-- Description: Create role skill requirements with KSABA dimensions
-- Epic: E-ONTO-03 (Business Applications)
-- Story: S-ONTO-03-04 (Role Skill Requirements)
-- Created: 2025-12-22

-- =============================================================================
-- ROLE SKILL REQUIREMENTS TABLE
-- Defines required skill levels for job roles (job_templates)
-- =============================================================================

-- Requirement importance level
CREATE TYPE requirement_importance AS ENUM (
    'essential',      -- Must have
    'important',      -- Should have
    'nice_to_have',   -- Nice to have
    'developmental'   -- Can be developed on the job
);

CREATE TABLE IF NOT EXISTS role_skill_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global template
    role_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- ==========================================================================
    -- KSABA REQUIRED LEVELS (0-5 scale, NULL = not specified for this dimension)
    -- ==========================================================================
    required_knowledge_level SMALLINT CHECK (required_knowledge_level IS NULL OR (required_knowledge_level >= 0 AND required_knowledge_level <= 5)),
    required_skill_level SMALLINT CHECK (required_skill_level IS NULL OR (required_skill_level >= 0 AND required_skill_level <= 5)),
    required_ability_level SMALLINT CHECK (required_ability_level IS NULL OR (required_ability_level >= 0 AND required_ability_level <= 5)),
    required_behavior_level SMALLINT CHECK (required_behavior_level IS NULL OR (required_behavior_level >= 0 AND required_behavior_level <= 5)),
    required_attitude_level SMALLINT CHECK (required_attitude_level IS NULL OR (required_attitude_level >= 0 AND required_attitude_level <= 5)),

    -- Minimum composite score required (calculated or manual override)
    min_composite_score NUMERIC(4,2) CHECK (min_composite_score IS NULL OR (min_composite_score >= 0 AND min_composite_score <= 5)),

    -- ==========================================================================
    -- IMPORTANCE WEIGHTING
    -- ==========================================================================
    importance requirement_importance NOT NULL DEFAULT 'important',
    weight NUMERIC(3,2) DEFAULT 1.00 CHECK (weight >= 0 AND weight <= 5),  -- For gap analysis scoring

    -- ==========================================================================
    -- ADDITIONAL CONTEXT
    -- ==========================================================================
    is_primary BOOLEAN DEFAULT FALSE,  -- Key skill for this role
    notes TEXT,                         -- Additional requirements context
    source VARCHAR(50) DEFAULT 'manual',  -- 'manual', 'esco_mapping', 'inferred'

    -- ==========================================================================
    -- TIMESTAMPS
    -- ==========================================================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    updated_by UUID REFERENCES employees(id),

    -- ==========================================================================
    -- CONSTRAINTS
    -- ==========================================================================
    CONSTRAINT unique_role_skill UNIQUE (tenant_id, role_id, skill_id)
);

-- =============================================================================
-- AUTO-CALCULATE MIN COMPOSITE SCORE IF NOT PROVIDED
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_role_requirement_composite()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if not explicitly set
    IF NEW.min_composite_score IS NULL THEN
        -- Calculate from individual dimensions if provided
        IF NEW.required_knowledge_level IS NOT NULL OR
           NEW.required_skill_level IS NOT NULL OR
           NEW.required_ability_level IS NOT NULL OR
           NEW.required_behavior_level IS NOT NULL OR
           NEW.required_attitude_level IS NOT NULL THEN

            NEW.min_composite_score := calculate_composite_score(
                COALESCE(NEW.required_knowledge_level, 0)::SMALLINT,
                COALESCE(NEW.required_skill_level, 0)::SMALLINT,
                COALESCE(NEW.required_ability_level, 0)::SMALLINT,
                COALESCE(NEW.required_behavior_level, 0)::SMALLINT,
                COALESCE(NEW.required_attitude_level, 0)::SMALLINT
            );
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_role_requirement_composite
    BEFORE INSERT OR UPDATE OF required_knowledge_level, required_skill_level, required_ability_level, required_behavior_level, required_attitude_level
    ON role_skill_requirements
    FOR EACH ROW
    EXECUTE FUNCTION calculate_role_requirement_composite();

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rsr_role ON role_skill_requirements(role_id);
CREATE INDEX IF NOT EXISTS idx_rsr_skill ON role_skill_requirements(skill_id);
CREATE INDEX IF NOT EXISTS idx_rsr_tenant_role ON role_skill_requirements(tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_rsr_importance ON role_skill_requirements(importance);
CREATE INDEX IF NOT EXISTS idx_rsr_primary ON role_skill_requirements(role_id) WHERE is_primary = TRUE;

-- =============================================================================
-- HELPER VIEW: Role requirements with skill details
-- =============================================================================

CREATE OR REPLACE VIEW v_role_skill_requirements AS
SELECT
    rsr.*,
    jt.title_en as role_title,
    jt.title_it as role_title_it,
    jt.job_code as role_code,
    jt.esco_occupation_uri,
    es.preferred_label_en as skill_name,
    es.preferred_label_it as skill_name_it,
    es.skill_type,
    esg.preferred_label_en as skill_group
FROM role_skill_requirements rsr
JOIN job_templates jt ON rsr.role_id = jt.id
JOIN esco_skills es ON rsr.skill_id = es.id
LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri;

-- =============================================================================
-- FUNCTION: Copy requirements from one role to another
-- =============================================================================

CREATE OR REPLACE FUNCTION copy_role_requirements(
    p_source_role_id UUID,
    p_target_role_id UUID,
    p_tenant_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO role_skill_requirements (
        tenant_id, role_id, skill_id,
        required_knowledge_level, required_skill_level, required_ability_level,
        required_behavior_level, required_attitude_level, min_composite_score,
        importance, weight, is_primary, notes, source
    )
    SELECT
        p_tenant_id, p_target_role_id, skill_id,
        required_knowledge_level, required_skill_level, required_ability_level,
        required_behavior_level, required_attitude_level, min_composite_score,
        importance, weight, is_primary, notes, 'copied'
    FROM role_skill_requirements
    WHERE role_id = p_source_role_id
      AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    ON CONFLICT (tenant_id, role_id, skill_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED: Import skill requirements from ESCO occupation mappings
-- =============================================================================

-- This function can be used to auto-populate requirements based on ESCO occupation skills
CREATE OR REPLACE FUNCTION seed_role_requirements_from_esco(
    p_role_id UUID,
    p_tenant_id UUID DEFAULT NULL,
    p_default_importance requirement_importance DEFAULT 'important',
    p_default_level SMALLINT DEFAULT 3
) RETURNS INTEGER AS $$
DECLARE
    v_occupation_uri VARCHAR;
    v_count INTEGER := 0;
BEGIN
    -- Get the ESCO occupation URI for this role
    SELECT esco_occupation_uri INTO v_occupation_uri
    FROM job_templates WHERE id = p_role_id;

    IF v_occupation_uri IS NULL THEN
        RETURN 0;
    END IF;

    -- Insert skills associated with this occupation
    INSERT INTO role_skill_requirements (
        tenant_id, role_id, skill_id,
        required_skill_level, importance, source
    )
    SELECT
        p_tenant_id, p_role_id, osm.skill_id,
        p_default_level, p_default_importance, 'esco_mapping'
    FROM esco_occupation_skill_map osm
    WHERE osm.occupation_uri = v_occupation_uri
    ON CONFLICT (tenant_id, role_id, skill_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE role_skill_requirements IS 'Skill requirements for job roles with KSABA dimensions';
COMMENT ON COLUMN role_skill_requirements.importance IS 'How critical this skill is for the role';
COMMENT ON COLUMN role_skill_requirements.weight IS 'Weighting factor for gap analysis scoring (0-5)';
COMMENT ON COLUMN role_skill_requirements.is_primary IS 'Key/defining skill for this role';
