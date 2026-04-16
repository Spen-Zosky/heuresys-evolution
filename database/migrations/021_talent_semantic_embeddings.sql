-- Migration: 021_talent_semantic_embeddings.sql
-- Description: Add semantic embedding columns to talent management entities
-- Author: Claude
-- Date: 2025-12-22
-- Epic: Semantic Intelligence Layer
-- Phase: 3 - Talent Intelligence

-- =============================================================================
-- PHASE 3.1: Skill Gap Analysis Embeddings
-- =============================================================================
-- Skill gap embeddings capture analysis insights and recommendations:
-- - Recommendations, priority skills, gap descriptions
-- - Used for: learning recommendations, talent matching, career planning

ALTER TABLE skill_gap_analyses
ADD COLUMN IF NOT EXISTS analysis_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_skill_gap_analyses_embedding
ON skill_gap_analyses USING ivfflat (analysis_embedding vector_cosine_ops) WITH (lists = 20);

COMMENT ON COLUMN skill_gap_analyses.analysis_embedding IS 'Semantic embedding of gap analysis (recommendations, priority skills)';

-- =============================================================================
-- PHASE 3.2: Career Path Embeddings
-- =============================================================================
-- Career path embeddings capture progression and development content:
-- - Name, description, target role
-- - Used for: career matching, development planning

ALTER TABLE career_paths
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_career_paths_embedding
ON career_paths USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON COLUMN career_paths.embedding IS 'Semantic embedding of career path (name, description, target role)';

-- =============================================================================
-- PHASE 3.3: Succession Planning Tables
-- =============================================================================
-- Create succession planning structure if not exists

CREATE TABLE IF NOT EXISTS succession_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    position_name VARCHAR(200) NOT NULL,
    position_id UUID, -- Reference to job_templates or positions table
    incumbent_employee_id UUID,
    criticality_level VARCHAR(20) DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    risk_level VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
    notes TEXT,
    target_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Semantic embedding
    embedding vector(1536),
    embedding_text_hash VARCHAR(64),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_succession_plans_tenant
ON succession_plans(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_succession_plans_embedding
ON succession_plans USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON TABLE succession_plans IS 'Succession planning for critical positions';

-- Succession candidates
CREATE TABLE IF NOT EXISTS succession_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    succession_plan_id UUID NOT NULL REFERENCES succession_plans(id) ON DELETE CASCADE,
    candidate_employee_id UUID NOT NULL,
    readiness_level VARCHAR(20) NOT NULL, -- 'ready_now', 'ready_1_year', 'ready_2_years', 'developing'
    readiness_score NUMERIC(3,2), -- 0.0 to 1.0
    development_actions TEXT,
    strengths TEXT,
    development_needs TEXT,
    ranking INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Semantic embedding of candidate assessment
    assessment_embedding vector(1536),
    embedding_model VARCHAR(100),

    CONSTRAINT uk_succession_candidate UNIQUE (succession_plan_id, candidate_employee_id)
);

CREATE INDEX IF NOT EXISTS idx_succession_candidates_plan
ON succession_candidates(succession_plan_id);

CREATE INDEX IF NOT EXISTS idx_succession_candidates_employee
ON succession_candidates(tenant_id, candidate_employee_id);

CREATE INDEX IF NOT EXISTS idx_succession_candidates_embedding
ON succession_candidates USING ivfflat (assessment_embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON TABLE succession_candidates IS 'Candidates for succession positions with readiness assessment';

-- =============================================================================
-- PHASE 3.4: Internal Mobility Enhancement
-- =============================================================================
-- Enhance internal mobility tracking

CREATE TABLE IF NOT EXISTS internal_mobility_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    current_position VARCHAR(200),
    current_department_id UUID,
    target_position VARCHAR(200),
    target_department_id UUID,
    target_location_id UUID,
    motivation TEXT,
    career_goals TEXT,
    timeline VARCHAR(50), -- 'immediate', '3_months', '6_months', '1_year'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected', 'completed'
    manager_notes TEXT,
    hr_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Semantic embedding of request content
    request_embedding vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mobility_requests_tenant
ON internal_mobility_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_mobility_requests_employee
ON internal_mobility_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_mobility_requests_embedding
ON internal_mobility_requests USING ivfflat (request_embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON TABLE internal_mobility_requests IS 'Internal mobility and transfer requests';

-- =============================================================================
-- PHASE 3.5: Talent Pool Definition
-- =============================================================================
-- Define talent pools for segmentation

CREATE TABLE IF NOT EXISTS talent_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    pool_type VARCHAR(50) NOT NULL, -- 'high_potential', 'leadership', 'technical', 'emerging', 'critical_skills', 'custom'
    criteria JSONB, -- Criteria for pool membership
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Semantic embedding
    embedding vector(1536),
    embedding_model VARCHAR(100),

    CONSTRAINT uk_talent_pool_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_talent_pools_tenant
ON talent_pools(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_talent_pools_embedding
ON talent_pools USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Talent pool membership
CREATE TABLE IF NOT EXISTS talent_pool_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    talent_pool_id UUID NOT NULL REFERENCES talent_pools(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    added_reason TEXT,
    added_by UUID,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_reason TEXT,

    CONSTRAINT uk_talent_pool_member UNIQUE (talent_pool_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_talent_pool_members_pool
ON talent_pool_members(talent_pool_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_talent_pool_members_employee
ON talent_pool_members(tenant_id, employee_id) WHERE removed_at IS NULL;

COMMENT ON TABLE talent_pools IS 'Talent pool definitions for employee segmentation';
COMMENT ON TABLE talent_pool_members IS 'Employee membership in talent pools';

-- =============================================================================
-- PHASE 3.6: Talent Context Aggregation View
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_employee_talent_context AS
SELECT
    e.id AS employee_id,
    e.tenant_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title,
    e.skills AS current_skills,

    -- Skill gap summary
    gap_summary.total_gaps,
    gap_summary.critical_gaps,
    gap_summary.avg_match_score,

    -- Career development
    career_info.career_path_name,
    career_info.career_path_progress,

    -- Succession readiness
    succession_info.positions_in_pipeline,
    succession_info.highest_readiness,

    -- Talent pool membership
    pool_info.pool_names,
    pool_info.pool_count

FROM employees e

-- Skill gaps
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_gaps,
        COUNT(*) FILTER (WHERE overall_match_score < 0.5) AS critical_gaps,
        AVG(overall_match_score) AS avg_match_score
    FROM skill_gap_analyses
    WHERE target_entity_type = 'employee'
    AND target_entity_id = e.id
) gap_summary ON TRUE

-- Career path
LEFT JOIN LATERAL (
    SELECT
        cp.name AS career_path_name,
        0.0 AS career_path_progress -- Placeholder for actual progress calculation
    FROM career_paths cp
    -- This would need a proper junction table in production
    LIMIT 1
) career_info ON TRUE

-- Succession pipeline
LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT succession_plan_id) AS positions_in_pipeline,
        MAX(CASE readiness_level
            WHEN 'ready_now' THEN 4
            WHEN 'ready_1_year' THEN 3
            WHEN 'ready_2_years' THEN 2
            WHEN 'developing' THEN 1
            ELSE 0
        END) AS highest_readiness
    FROM succession_candidates
    WHERE candidate_employee_id = e.id
) succession_info ON TRUE

-- Talent pools
LEFT JOIN LATERAL (
    SELECT
        ARRAY_AGG(tp.name) AS pool_names,
        COUNT(*) AS pool_count
    FROM talent_pool_members tpm
    JOIN talent_pools tp ON tp.id = tpm.talent_pool_id
    WHERE tpm.employee_id = e.id
    AND tpm.removed_at IS NULL
) pool_info ON TRUE

WHERE e.is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_emp_talent_context_pk
ON mv_employee_talent_context(employee_id);

COMMENT ON MATERIALIZED VIEW mv_employee_talent_context IS 'Aggregated talent context for each employee';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
--
-- ALTER TABLE skill_gap_analyses DROP COLUMN IF EXISTS analysis_embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE career_paths DROP COLUMN IF EXISTS embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- DROP MATERIALIZED VIEW IF EXISTS mv_employee_talent_context;
-- DROP TABLE IF EXISTS talent_pool_members;
-- DROP TABLE IF EXISTS talent_pools;
-- DROP TABLE IF EXISTS internal_mobility_requests;
-- DROP TABLE IF EXISTS succession_candidates;
-- DROP TABLE IF EXISTS succession_plans;
