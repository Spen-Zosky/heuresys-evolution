-- ============================================================================
-- Migration 031: Workforce Planning
-- Sprint 2025-04 - S-ONTO-03-10
--
-- Creates workforce_plans table for storing workforce planning scenarios
-- with gap analysis, hiring recommendations, and training investments
-- ============================================================================

BEGIN;

-- ============================================================================
-- WORKFORCE PLANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Plan metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

    -- Plan data (JSONB for flexibility)
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    gap_analysis JSONB NOT NULL DEFAULT '[]'::jsonb,
    hiring_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    training_investments JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Audit fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workforce_plans_tenant ON workforce_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workforce_plans_status ON workforce_plans(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workforce_plans_target_date ON workforce_plans(tenant_id, target_date);
CREATE INDEX IF NOT EXISTS idx_workforce_plans_created ON workforce_plans(tenant_id, created_at DESC);

-- GIN index for JSONB searching
CREATE INDEX IF NOT EXISTS idx_workforce_plans_requirements ON workforce_plans USING GIN (requirements);
CREATE INDEX IF NOT EXISTS idx_workforce_plans_summary ON workforce_plans USING GIN (summary);

-- ============================================================================
-- FUTURE SKILL REQUIREMENTS TABLE (Optional - for requirement templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_requirements_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Template metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,

    -- Skill requirement
    skill_id UUID REFERENCES esco_skills(id),
    skill_name VARCHAR(255) NOT NULL,
    required_count INT NOT NULL DEFAULT 1,
    required_proficiency NUMERIC(3,1) NOT NULL DEFAULT 3.0 CHECK (required_proficiency >= 1 AND required_proficiency <= 5),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    department_id UUID REFERENCES departments(id),
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_skill_req_templates_tenant ON skill_requirements_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_req_templates_skill ON skill_requirements_templates(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_req_templates_dept ON skill_requirements_templates(department_id);

-- ============================================================================
-- UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_workforce_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workforce_plans_updated ON workforce_plans;
CREATE TRIGGER trg_workforce_plans_updated
    BEFORE UPDATE ON workforce_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_workforce_plan_timestamp();

DROP TRIGGER IF EXISTS trg_skill_req_templates_updated ON skill_requirements_templates;
CREATE TRIGGER trg_skill_req_templates_updated
    BEFORE UPDATE ON skill_requirements_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_workforce_plan_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE workforce_plans IS 'Workforce planning scenarios with gap analysis and recommendations';
COMMENT ON COLUMN workforce_plans.requirements IS 'JSON array of FutureRequirement objects';
COMMENT ON COLUMN workforce_plans.gap_analysis IS 'JSON array of GapRiskAssessment objects';
COMMENT ON COLUMN workforce_plans.hiring_recommendations IS 'JSON array of HiringRecommendation objects';
COMMENT ON COLUMN workforce_plans.training_investments IS 'JSON array of TrainingInvestment objects';
COMMENT ON COLUMN workforce_plans.summary IS 'Summary statistics for the plan';

COMMENT ON TABLE skill_requirements_templates IS 'Reusable skill requirement templates for workforce planning';

COMMIT;
