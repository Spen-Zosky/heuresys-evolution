-- Migration 030: Career Path Engine Extensions
-- Sprint 2025-04 - S-ONTO-03-07
-- Extends career path system with skill-based progression

-- ============================================================================
-- 0. CREATE ENUM TYPES FIRST
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_skill_importance') THEN
        CREATE TYPE career_skill_importance AS ENUM ('critical', 'important', 'nice_to_have');
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 1. CAREER PATH LEVEL SKILL REQUIREMENTS
-- ============================================================================
-- Links career path levels to specific skill requirements with KSABA levels

CREATE TABLE IF NOT EXISTS career_path_level_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES career_path_levels(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES esco_skills(id),

    -- KSABA required levels for this skill at this career level
    required_knowledge_level SMALLINT CHECK (required_knowledge_level BETWEEN 0 AND 5),
    required_skill_level SMALLINT CHECK (required_skill_level BETWEEN 0 AND 5),
    required_ability_level SMALLINT CHECK (required_ability_level BETWEEN 0 AND 5),
    required_behavior_level SMALLINT CHECK (required_behavior_level BETWEEN 0 AND 5),
    required_attitude_level SMALLINT CHECK (required_attitude_level BETWEEN 0 AND 5),
    min_composite_score NUMERIC(3,2) CHECK (min_composite_score BETWEEN 0 AND 5),

    -- Importance for this level
    importance career_skill_importance DEFAULT 'important',
    weight NUMERIC(3,2) DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 2),
    is_mandatory BOOLEAN DEFAULT FALSE,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(level_id, skill_id)
);

-- ============================================================================
-- 2. EXTEND CAREER PATH LEVELS
-- ============================================================================

-- Add target job reference if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'career_path_levels' AND column_name = 'target_job_id'
    ) THEN
        ALTER TABLE career_path_levels
            ADD COLUMN target_job_id UUID REFERENCES tenant_jobs(id),
            ADD COLUMN typical_duration_months INTEGER DEFAULT 24,
            ADD COLUMN skill_gap_threshold NUMERIC(3,2) DEFAULT 0.5;
    END IF;
END $$;

-- ============================================================================
-- 3. EMPLOYEE CAREER PATH PROGRESS
-- ============================================================================
-- Tracks employee progress through career path levels with skill analysis

CREATE TABLE IF NOT EXISTS employee_career_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    path_id UUID NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES career_path_levels(id) ON DELETE CASCADE,

    -- Progress tracking
    status VARCHAR(20) DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Skill analysis results (cached)
    overall_fit_score NUMERIC(3,2) CHECK (overall_fit_score BETWEEN 0 AND 1),
    skill_coverage_pct NUMERIC(5,2) CHECK (skill_coverage_pct BETWEEN 0 AND 100),
    avg_skill_gap NUMERIC(3,2),
    critical_gaps_count INTEGER DEFAULT 0,

    -- Time estimates
    estimated_months_to_ready INTEGER,
    actual_months_spent INTEGER,

    -- Last analysis
    last_analyzed_at TIMESTAMPTZ,
    analysis_version INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(employee_id, level_id)
);

-- ============================================================================
-- 4. CAREER PATH RECOMMENDATIONS
-- ============================================================================
-- Stores computed career path recommendations for employees

CREATE TABLE IF NOT EXISTS career_path_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    path_id UUID NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,

    -- Recommendation scoring
    fit_score NUMERIC(3,2) CHECK (fit_score BETWEEN 0 AND 1),
    skill_match_score NUMERIC(3,2) CHECK (skill_match_score BETWEEN 0 AND 1),
    interest_match_score NUMERIC(3,2) CHECK (interest_match_score BETWEEN 0 AND 1),
    market_demand_score NUMERIC(3,2) CHECK (market_demand_score BETWEEN 0 AND 1),
    composite_score NUMERIC(3,2) CHECK (composite_score BETWEEN 0 AND 1),

    -- Path analysis
    current_level_id UUID REFERENCES career_path_levels(id),
    reachable_level_id UUID REFERENCES career_path_levels(id),
    target_level_id UUID REFERENCES career_path_levels(id),

    -- Effort estimation
    total_skill_gaps INTEGER DEFAULT 0,
    critical_skill_gaps INTEGER DEFAULT 0,
    estimated_months_to_next INTEGER,
    estimated_months_to_target INTEGER,

    -- Development summary (JSON for flexibility)
    development_summary JSONB,
    /*
    {
        "skills_to_develop": [...],
        "trainings_recommended": [...],
        "milestones": [...]
    }
    */

    -- Status
    is_primary_recommendation BOOLEAN DEFAULT FALSE,
    recommendation_reason TEXT,

    -- Metadata
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,

    UNIQUE(employee_id, path_id)
);

-- ============================================================================
-- 5. CAREER SIMULATIONS
-- ============================================================================
-- Stores "what-if" career simulations

CREATE TABLE IF NOT EXISTS career_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Simulation parameters
    simulation_name VARCHAR(200),
    target_job_id UUID REFERENCES tenant_jobs(id),
    target_path_id UUID REFERENCES career_paths(id),
    target_level_id UUID REFERENCES career_path_levels(id),

    -- Current state snapshot
    current_skills_snapshot JSONB,
    current_gap_analysis JSONB,

    -- Simulation results
    is_reachable BOOLEAN,
    skill_distance NUMERIC(5,2),
    estimated_timeline_months INTEGER,
    required_trainings JSONB,
    required_experiences JSONB,
    milestone_plan JSONB,

    -- Comparison
    alternative_paths JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_career_level_skills_level ON career_path_level_skills(level_id);
CREATE INDEX IF NOT EXISTS idx_career_level_skills_skill ON career_path_level_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_career_level_skills_tenant ON career_path_level_skills(tenant_id);

CREATE INDEX IF NOT EXISTS idx_career_progress_employee ON employee_career_progress(employee_id);
CREATE INDEX IF NOT EXISTS idx_career_progress_path ON employee_career_progress(path_id);
CREATE INDEX IF NOT EXISTS idx_career_progress_status ON employee_career_progress(status);

CREATE INDEX IF NOT EXISTS idx_career_recommendations_employee ON career_path_recommendations(employee_id);
CREATE INDEX IF NOT EXISTS idx_career_recommendations_score ON career_path_recommendations(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_career_recommendations_primary ON career_path_recommendations(is_primary_recommendation) WHERE is_primary_recommendation = TRUE;

CREATE INDEX IF NOT EXISTS idx_career_simulations_employee ON career_simulations(employee_id);

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- View: Employee career path overview with fit scores
CREATE OR REPLACE VIEW v_employee_career_overview AS
SELECT
    ecp.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title AS current_job,
    cp.id AS path_id,
    cp.name AS path_name,
    cp.path_type,
    cpl.id AS current_level_id,
    cpl.title AS current_level,
    cpl.level_order,
    ecp.status AS path_status,
    ecp.started_at,
    prog.overall_fit_score,
    prog.skill_coverage_pct,
    prog.critical_gaps_count,
    prog.estimated_months_to_ready,
    (SELECT COUNT(*) FROM career_path_levels WHERE path_id = cp.id) AS total_levels,
    e.tenant_id
FROM employee_career_paths ecp
JOIN employees e ON ecp.employee_id = e.id
JOIN career_paths cp ON ecp.path_id = cp.id
LEFT JOIN career_path_levels cpl ON ecp.current_level_id = cpl.id
LEFT JOIN employee_career_progress prog ON prog.employee_id = ecp.employee_id AND prog.level_id = cpl.id;

-- View: Career level skill requirements summary
CREATE OR REPLACE VIEW v_career_level_requirements AS
SELECT
    cpl.id AS level_id,
    cpl.title AS level_title,
    cpl.level_order,
    cp.id AS path_id,
    cp.name AS path_name,
    COUNT(cls.id) AS total_skills_required,
    COUNT(cls.id) FILTER (WHERE cls.is_mandatory) AS mandatory_skills,
    COUNT(cls.id) FILTER (WHERE cls.importance = 'critical') AS critical_skills,
    AVG(cls.min_composite_score) AS avg_required_score,
    cpl.typical_duration_months,
    cp.tenant_id
FROM career_path_levels cpl
JOIN career_paths cp ON cpl.path_id = cp.id
LEFT JOIN career_path_level_skills cls ON cls.level_id = cpl.id
GROUP BY cpl.id, cpl.title, cpl.level_order, cp.id, cp.name, cpl.typical_duration_months, cp.tenant_id;

-- ============================================================================
-- 8. FUNCTIONS
-- ============================================================================

-- Function: Calculate skill distance between employee and career level
CREATE OR REPLACE FUNCTION fn_calculate_skill_distance(
    p_employee_id UUID,
    p_level_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_distance NUMERIC := 0;
    v_total_weight NUMERIC := 0;
    v_skill_record RECORD;
BEGIN
    FOR v_skill_record IN
        SELECT
            cls.skill_id,
            cls.min_composite_score AS required_score,
            cls.weight,
            cls.is_mandatory,
            COALESCE(esp.composite_score, 0) AS employee_score
        FROM career_path_level_skills cls
        LEFT JOIN employee_skill_profiles esp
            ON esp.skill_id = cls.skill_id
            AND esp.employee_id = p_employee_id
            AND esp.verification_status = 'verified'
        WHERE cls.level_id = p_level_id
    LOOP
        -- Calculate gap for this skill
        IF v_skill_record.employee_score < v_skill_record.required_score THEN
            v_distance := v_distance +
                (v_skill_record.required_score - v_skill_record.employee_score) * v_skill_record.weight;
        END IF;
        v_total_weight := v_total_weight + v_skill_record.weight;
    END LOOP;

    -- Normalize distance
    IF v_total_weight > 0 THEN
        RETURN v_distance / v_total_weight;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate fit score for employee on career path
CREATE OR REPLACE FUNCTION fn_calculate_path_fit_score(
    p_employee_id UUID,
    p_path_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_total_distance NUMERIC := 0;
    v_levels_count INTEGER := 0;
    v_level_record RECORD;
BEGIN
    FOR v_level_record IN
        SELECT id FROM career_path_levels
        WHERE path_id = p_path_id
        ORDER BY level_order
    LOOP
        v_total_distance := v_total_distance + fn_calculate_skill_distance(p_employee_id, v_level_record.id);
        v_levels_count := v_levels_count + 1;
    END LOOP;

    IF v_levels_count > 0 THEN
        -- Convert distance to fit score (inverse relationship)
        -- Max distance of 5, fit = 1 - (avg_distance / 5)
        RETURN GREATEST(0, 1 - (v_total_distance / v_levels_count / 5));
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Trigger: Update timestamps on career_path_level_skills
CREATE OR REPLACE FUNCTION fn_update_career_level_skills_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_career_level_skills_timestamp ON career_path_level_skills;
CREATE TRIGGER trg_career_level_skills_timestamp
    BEFORE UPDATE ON career_path_level_skills
    FOR EACH ROW EXECUTE FUNCTION fn_update_career_level_skills_timestamp();

-- Trigger: Update timestamps on employee_career_progress
DROP TRIGGER IF EXISTS trg_career_progress_timestamp ON employee_career_progress;
CREATE TRIGGER trg_career_progress_timestamp
    BEFORE UPDATE ON employee_career_progress
    FOR EACH ROW EXECUTE FUNCTION fn_update_career_level_skills_timestamp();

-- ============================================================================
-- 10. SEED DATA: Link existing career path levels with skills
-- ============================================================================
-- This seeds skill requirements for existing career path levels based on path type

-- Note: In production, this should be done through the API
-- Here we seed a few examples for testing

COMMENT ON TABLE career_path_level_skills IS 'Skill requirements for each career path level with KSABA levels';
COMMENT ON TABLE employee_career_progress IS 'Tracks employee progress through career path levels';
COMMENT ON TABLE career_path_recommendations IS 'AI-generated career path recommendations for employees';
COMMENT ON TABLE career_simulations IS 'What-if career simulations with skill analysis';
COMMENT ON FUNCTION fn_calculate_skill_distance IS 'Calculates normalized skill distance between employee and career level';
COMMENT ON FUNCTION fn_calculate_path_fit_score IS 'Calculates overall fit score for employee on a career path';
