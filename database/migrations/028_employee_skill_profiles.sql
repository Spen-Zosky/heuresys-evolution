-- Migration: 028_employee_skill_profiles
-- Description: Create employee skill profile schema with KSABA dimensions
-- Epic: E-ONTO-03 (Business Applications)
-- Story: S-ONTO-03-01 (Employee Skill Profile Model)
-- Created: 2025-12-22

-- =============================================================================
-- EMPLOYEE SKILL PROFILES TABLE
-- Stores employee skill levels across all 5 KSABA dimensions
-- =============================================================================

-- Source types for skill acquisition
CREATE TYPE skill_source_type AS ENUM (
    'self_declaration',   -- Employee declared
    'assessment',         -- Formal assessment
    'certification',      -- From certification
    'training',          -- Completed training
    'inferred',          -- AI-inferred from behavior
    'manager_override',  -- Manager adjusted
    'imported'           -- Imported from external system
);

-- Verification status
CREATE TYPE skill_verification_status AS ENUM (
    'pending',           -- Awaiting verification
    'verified',          -- Manager verified
    'rejected',          -- Manager rejected
    'expired'            -- Verification expired
);

CREATE TABLE IF NOT EXISTS employee_skill_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- ==========================================================================
    -- KSABA DIMENSIONS (0-5 scale for each)
    -- 0 = None, 1 = Basic, 2 = Intermediate, 3 = Advanced, 4 = Expert, 5 = Master
    -- ==========================================================================
    knowledge_level SMALLINT DEFAULT 0 CHECK (knowledge_level >= 0 AND knowledge_level <= 5),
    skill_level SMALLINT DEFAULT 0 CHECK (skill_level >= 0 AND skill_level <= 5),
    ability_level SMALLINT DEFAULT 0 CHECK (ability_level >= 0 AND ability_level <= 5),
    behavior_level SMALLINT DEFAULT 0 CHECK (behavior_level >= 0 AND behavior_level <= 5),
    attitude_level SMALLINT DEFAULT 0 CHECK (attitude_level >= 0 AND attitude_level <= 5),

    -- Composite score (calculated, weighted average)
    composite_score NUMERIC(4,2) DEFAULT 0.00 CHECK (composite_score >= 0 AND composite_score <= 5),

    -- ==========================================================================
    -- SOURCE TRACKING
    -- ==========================================================================
    source skill_source_type NOT NULL DEFAULT 'self_declaration',
    source_description TEXT,  -- Additional context about acquisition
    acquired_date DATE,       -- When skill was acquired
    last_demonstrated DATE,   -- Last time skill was used/demonstrated

    -- ==========================================================================
    -- EVIDENCE LINKING (polymorphic reference)
    -- ==========================================================================
    evidence_type VARCHAR(50),  -- 'certification', 'course', 'assessment', 'project'
    evidence_id UUID,           -- Reference to the evidence entity
    evidence_url TEXT,          -- External evidence link if any
    evidence_notes TEXT,        -- Free-text evidence description

    -- ==========================================================================
    -- VERIFICATION WORKFLOW
    -- ==========================================================================
    verification_status skill_verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES employees(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    verification_expires_at DATE,  -- When verification needs renewal

    -- ==========================================================================
    -- CONFIDENCE & METADATA
    -- ==========================================================================
    confidence_score NUMERIC(4,3) DEFAULT 0.500 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    is_primary BOOLEAN DEFAULT FALSE,  -- Primary/highlighted skill for employee
    is_target BOOLEAN DEFAULT FALSE,   -- Skill employee is actively developing
    target_level SMALLINT CHECK (target_level IS NULL OR (target_level >= 0 AND target_level <= 5)),

    -- ==========================================================================
    -- TIMESTAMPS
    -- ==========================================================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- ==========================================================================
    -- CONSTRAINTS
    -- ==========================================================================
    CONSTRAINT unique_employee_skill UNIQUE (tenant_id, employee_id, skill_id),
    CONSTRAINT valid_target CHECK (target_level IS NULL OR target_level > composite_score)
);

-- =============================================================================
-- EMPLOYEE SKILL HISTORY TABLE
-- Tracks changes to skill profiles over time
-- =============================================================================

CREATE TABLE IF NOT EXISTS employee_skill_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES employee_skill_profiles(id) ON DELETE CASCADE,

    -- Previous values
    previous_knowledge_level SMALLINT,
    previous_skill_level SMALLINT,
    previous_ability_level SMALLINT,
    previous_behavior_level SMALLINT,
    previous_attitude_level SMALLINT,
    previous_composite_score NUMERIC(4,2),

    -- New values
    new_knowledge_level SMALLINT,
    new_skill_level SMALLINT,
    new_ability_level SMALLINT,
    new_behavior_level SMALLINT,
    new_attitude_level SMALLINT,
    new_composite_score NUMERIC(4,2),

    -- Change metadata
    change_type VARCHAR(50) NOT NULL,  -- 'initial', 'update', 'verification', 'assessment'
    change_reason TEXT,
    changed_by UUID REFERENCES employees(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- COMPOSITE SCORE CALCULATION FUNCTION
-- Default weighting: Knowledge 20%, Skill 30%, Ability 25%, Behavior 15%, Attitude 10%
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_composite_score(
    p_knowledge SMALLINT,
    p_skill SMALLINT,
    p_ability SMALLINT,
    p_behavior SMALLINT,
    p_attitude SMALLINT,
    p_weights NUMERIC[] DEFAULT ARRAY[0.20, 0.30, 0.25, 0.15, 0.10]
) RETURNS NUMERIC(4,2) AS $$
DECLARE
    v_score NUMERIC;
BEGIN
    -- Calculate weighted average
    v_score := (
        COALESCE(p_knowledge, 0) * p_weights[1] +
        COALESCE(p_skill, 0) * p_weights[2] +
        COALESCE(p_ability, 0) * p_weights[3] +
        COALESCE(p_behavior, 0) * p_weights[4] +
        COALESCE(p_attitude, 0) * p_weights[5]
    );

    RETURN ROUND(v_score, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- TRIGGER: Auto-calculate composite score on insert/update
-- =============================================================================

CREATE OR REPLACE FUNCTION update_skill_composite_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.composite_score := calculate_composite_score(
        NEW.knowledge_level,
        NEW.skill_level,
        NEW.ability_level,
        NEW.behavior_level,
        NEW.attitude_level
    );
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_skill_composite_score
    BEFORE INSERT OR UPDATE OF knowledge_level, skill_level, ability_level, behavior_level, attitude_level
    ON employee_skill_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_skill_composite_score();

-- =============================================================================
-- TRIGGER: Track skill history on changes
-- =============================================================================

CREATE OR REPLACE FUNCTION track_skill_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if any level changed
    IF OLD.knowledge_level IS DISTINCT FROM NEW.knowledge_level OR
       OLD.skill_level IS DISTINCT FROM NEW.skill_level OR
       OLD.ability_level IS DISTINCT FROM NEW.ability_level OR
       OLD.behavior_level IS DISTINCT FROM NEW.behavior_level OR
       OLD.attitude_level IS DISTINCT FROM NEW.attitude_level THEN

        INSERT INTO employee_skill_history (
            profile_id,
            previous_knowledge_level, previous_skill_level, previous_ability_level,
            previous_behavior_level, previous_attitude_level, previous_composite_score,
            new_knowledge_level, new_skill_level, new_ability_level,
            new_behavior_level, new_attitude_level, new_composite_score,
            change_type
        ) VALUES (
            NEW.id,
            OLD.knowledge_level, OLD.skill_level, OLD.ability_level,
            OLD.behavior_level, OLD.attitude_level, OLD.composite_score,
            NEW.knowledge_level, NEW.skill_level, NEW.ability_level,
            NEW.behavior_level, NEW.attitude_level, NEW.composite_score,
            CASE
                WHEN NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN 'verification'
                ELSE 'update'
            END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_skill_history
    AFTER UPDATE ON employee_skill_profiles
    FOR EACH ROW
    EXECUTE FUNCTION track_skill_history();

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary lookups
CREATE INDEX IF NOT EXISTS idx_esp_tenant_employee ON employee_skill_profiles(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_esp_employee ON employee_skill_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_esp_skill ON employee_skill_profiles(skill_id);

-- Filtering
CREATE INDEX IF NOT EXISTS idx_esp_verification ON employee_skill_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_esp_source ON employee_skill_profiles(source);
CREATE INDEX IF NOT EXISTS idx_esp_composite ON employee_skill_profiles(composite_score DESC);

-- Manager verification queue
CREATE INDEX IF NOT EXISTS idx_esp_pending_verification
    ON employee_skill_profiles(tenant_id, verification_status)
    WHERE verification_status = 'pending';

-- Primary/target skills
CREATE INDEX IF NOT EXISTS idx_esp_primary ON employee_skill_profiles(employee_id) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_esp_target ON employee_skill_profiles(employee_id) WHERE is_target = TRUE;

-- History lookups
CREATE INDEX IF NOT EXISTS idx_esh_profile ON employee_skill_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_esh_changed_at ON employee_skill_history(changed_at DESC);

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- Employee skill summary view
CREATE OR REPLACE VIEW v_employee_skill_summary AS
SELECT
    esp.tenant_id,
    esp.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    COUNT(*) as total_skills,
    COUNT(*) FILTER (WHERE esp.verification_status = 'verified') as verified_skills,
    COUNT(*) FILTER (WHERE esp.verification_status = 'pending') as pending_skills,
    ROUND(AVG(esp.composite_score), 2) as avg_composite_score,
    MAX(esp.composite_score) as max_composite_score,
    COUNT(*) FILTER (WHERE esp.is_primary) as primary_skills,
    COUNT(*) FILTER (WHERE esp.is_target) as target_skills
FROM employee_skill_profiles esp
JOIN employees e ON esp.employee_id = e.id
GROUP BY esp.tenant_id, esp.employee_id, e.first_name, e.last_name;

-- Detailed skill profile view with ESCO skill info
CREATE OR REPLACE VIEW v_employee_skill_details AS
SELECT
    esp.*,
    e.first_name || ' ' || e.last_name as employee_name,
    e.job_title,
    e.department_id,
    es.preferred_label_en as skill_name,
    es.preferred_label_it as skill_name_it,
    es.description_en as skill_description,
    es.skill_type,
    esg.preferred_label_en as skill_group
FROM employee_skill_profiles esp
JOIN employees e ON esp.employee_id = e.id
JOIN esco_skills es ON esp.skill_id = es.id
LEFT JOIN esco_skill_groups esg ON es.skill_group_uri = esg.uri;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE employee_skill_profiles IS 'Employee skill profiles with KSABA dimension levels';
COMMENT ON COLUMN employee_skill_profiles.knowledge_level IS 'K - Theoretical understanding (0-5)';
COMMENT ON COLUMN employee_skill_profiles.skill_level IS 'S - Practical application ability (0-5)';
COMMENT ON COLUMN employee_skill_profiles.ability_level IS 'A - Cognitive/physical capacity (0-5)';
COMMENT ON COLUMN employee_skill_profiles.behavior_level IS 'B - Observable actions/habits (0-5)';
COMMENT ON COLUMN employee_skill_profiles.attitude_level IS 'A - Mindset/disposition (0-5)';
COMMENT ON COLUMN employee_skill_profiles.composite_score IS 'Weighted average of KSABA (default: K20 S30 A25 B15 A10)';
COMMENT ON TABLE employee_skill_history IS 'Audit trail of skill profile changes';
