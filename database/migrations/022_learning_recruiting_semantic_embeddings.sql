-- Migration: 022_learning_recruiting_semantic_embeddings.sql
-- Description: Add semantic embedding columns to learning and recruiting entities
-- Author: Claude
-- Date: 2025-12-22
-- Epic: Semantic Intelligence Layer
-- Phase: 4 - Learning & Recruiting Context

-- =============================================================================
-- PHASE 4.1: Learning Path Embeddings
-- =============================================================================
-- Learning path embeddings capture educational content structure:
-- - Title, description, target role, skill progression
-- - Used for: course recommendations, skill development matching

ALTER TABLE learning_paths
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_learning_paths_embedding
ON learning_paths USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON COLUMN learning_paths.embedding IS 'Semantic embedding of learning path (title, description, target role)';

-- =============================================================================
-- PHASE 4.2: Recruiting Candidate Embeddings
-- =============================================================================
-- Candidate embeddings capture applicant profile:
-- - Skills, experience, notes, current role
-- - Used for: candidate matching, talent sourcing, similar profile search

ALTER TABLE recruiting_candidates
ADD COLUMN IF NOT EXISTS profile_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_recruiting_candidates_embedding
ON recruiting_candidates USING ivfflat (profile_embedding vector_cosine_ops) WITH (lists = 15);

COMMENT ON COLUMN recruiting_candidates.profile_embedding IS 'Semantic embedding of candidate profile (skills, experience, notes)';

-- =============================================================================
-- PHASE 4.3: Job Postings Table (Create if not exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    requisition_id UUID,
    job_template_id UUID,
    title VARCHAR(200) NOT NULL,
    department_id UUID,
    location_id UUID,
    description TEXT,
    requirements TEXT,
    responsibilities TEXT,
    qualifications TEXT,
    benefits TEXT,
    salary_range_min NUMERIC(12,2),
    salary_range_max NUMERIC(12,2),
    salary_currency VARCHAR(3) DEFAULT 'EUR',
    employment_type VARCHAR(50), -- 'full_time', 'part_time', 'contract', 'internship'
    experience_level VARCHAR(50), -- 'entry', 'mid', 'senior', 'executive'
    remote_policy VARCHAR(50), -- 'onsite', 'hybrid', 'remote'
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'published', 'closed', 'filled'
    published_at TIMESTAMP WITH TIME ZONE,
    closes_at TIMESTAMP WITH TIME ZONE,
    filled_at TIMESTAMP WITH TIME ZONE,
    views_count INTEGER DEFAULT 0,
    applications_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Semantic embedding
    content_embedding vector(1536),
    embedding_text_hash VARCHAR(64),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_job_postings_tenant
ON job_postings(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_job_postings_department
ON job_postings(department_id) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_job_postings_embedding
ON job_postings USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON TABLE job_postings IS 'Job postings for internal and external recruiting';

-- =============================================================================
-- PHASE 4.4: Course Enrollment Enhancement
-- =============================================================================
-- Add semantic context to course enrollments

CREATE TABLE IF NOT EXISTS course_enrollments_semantic (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    enrollment_id UUID NOT NULL, -- Reference to existing course_enrollments
    employee_id UUID NOT NULL,
    course_id UUID NOT NULL,

    -- Enrollment context
    enrollment_reason TEXT,
    learning_goals TEXT,
    completion_feedback TEXT,
    skills_acquired TEXT,

    -- Semantic embedding
    context_embedding vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uk_enrollment_semantic UNIQUE (enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_semantic_employee
ON course_enrollments_semantic(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_semantic_embedding
ON course_enrollments_semantic USING ivfflat (context_embedding vector_cosine_ops) WITH (lists = 30);

COMMENT ON TABLE course_enrollments_semantic IS 'Semantic context for course enrollments';

-- =============================================================================
-- PHASE 4.5: Interview Feedback Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS interview_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    candidate_id UUID NOT NULL REFERENCES recruiting_candidates(id) ON DELETE CASCADE,
    interviewer_employee_id UUID,
    interview_date TIMESTAMP WITH TIME ZONE,
    interview_type VARCHAR(50), -- 'phone_screen', 'technical', 'behavioral', 'panel', 'final'
    overall_rating NUMERIC(3,2), -- 1.0 to 5.0
    technical_rating NUMERIC(3,2),
    cultural_fit_rating NUMERIC(3,2),
    communication_rating NUMERIC(3,2),
    strengths TEXT,
    concerns TEXT,
    detailed_notes TEXT,
    recommendation VARCHAR(50), -- 'strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'needs_discussion'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Semantic embedding
    feedback_embedding vector(1536),
    embedding_model VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_candidate
ON interview_feedback(candidate_id);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_embedding
ON interview_feedback USING ivfflat (feedback_embedding vector_cosine_ops) WITH (lists = 15);

COMMENT ON TABLE interview_feedback IS 'Interview feedback with semantic search capability';

-- =============================================================================
-- PHASE 4.6: Recruiting Pipeline Analytics View
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_recruiting_pipeline AS
SELECT
    c.id AS candidate_id,
    c.tenant_id,
    c.first_name || ' ' || c.last_name AS candidate_name,
    c.email,
    c.job_title AS current_title,
    c.current_company,
    c.experience_years,
    c.stage,
    c.rating,
    c.source,
    c.skills,

    -- Job posting info
    jp.title AS applied_position,
    jp.department_id,
    jp.employment_type,
    jp.experience_level,

    -- Interview summary
    interview_stats.interview_count,
    interview_stats.avg_overall_rating,
    interview_stats.latest_recommendation,

    -- Time in pipeline
    EXTRACT(DAY FROM NOW() - c.applied_at) AS days_in_pipeline

FROM recruiting_candidates c

LEFT JOIN job_postings jp ON jp.requisition_id = c.requisition_id

LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS interview_count,
        AVG(overall_rating) AS avg_overall_rating,
        (SELECT recommendation FROM interview_feedback
         WHERE candidate_id = c.id
         ORDER BY interview_date DESC
         LIMIT 1) AS latest_recommendation
    FROM interview_feedback
    WHERE candidate_id = c.id
) interview_stats ON TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_recruiting_pipeline_pk
ON mv_recruiting_pipeline(candidate_id);

CREATE INDEX IF NOT EXISTS idx_mv_recruiting_pipeline_tenant
ON mv_recruiting_pipeline(tenant_id, stage);

COMMENT ON MATERIALIZED VIEW mv_recruiting_pipeline IS 'Recruiting pipeline overview with candidate context';

-- =============================================================================
-- PHASE 4.7: Learning Recommendations Table
-- =============================================================================
-- Store AI-generated learning recommendations

CREATE TABLE IF NOT EXISTS learning_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    recommendation_type VARCHAR(50), -- 'skill_gap', 'career_path', 'trending', 'manager_suggested', 'ai_generated'

    -- Recommendation content
    course_id UUID,
    learning_path_id UUID,
    external_resource_url TEXT,
    recommendation_reason TEXT,
    priority_score NUMERIC(3,2), -- 0.0 to 1.0
    estimated_impact TEXT,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'completed'
    employee_feedback TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Semantic embedding
    recommendation_embedding vector(1536),
    embedding_model VARCHAR(100),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_learning_recommendations_employee
ON learning_recommendations(tenant_id, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_learning_recommendations_embedding
ON learning_recommendations USING ivfflat (recommendation_embedding vector_cosine_ops) WITH (lists = 20);

COMMENT ON TABLE learning_recommendations IS 'AI-generated learning recommendations for employees';

-- =============================================================================
-- PHASE 4.8: Unified Employee Learning Context
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_employee_learning_context AS
SELECT
    e.id AS employee_id,
    e.tenant_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title,
    e.skills AS current_skills,

    -- Course completion stats
    learning_stats.courses_completed,
    learning_stats.courses_in_progress,
    learning_stats.total_learning_hours,
    learning_stats.certifications_earned,

    -- Learning path progress
    path_stats.active_learning_paths,
    path_stats.paths_completed,

    -- Recommendations
    rec_stats.pending_recommendations,
    rec_stats.avg_priority_score

FROM employees e

-- Learning statistics
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS courses_completed,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS courses_in_progress,
        0 AS total_learning_hours, -- Would need duration tracking
        0 AS certifications_earned -- Would need certification tracking
    FROM course_enrollments ce
    WHERE ce.employee_id = e.id
) learning_stats ON TRUE

-- Learning path stats (placeholder)
LEFT JOIN LATERAL (
    SELECT
        0 AS active_learning_paths,
        0 AS paths_completed
) path_stats ON TRUE

-- Recommendation stats
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS pending_recommendations,
        AVG(priority_score) AS avg_priority_score
    FROM learning_recommendations lr
    WHERE lr.employee_id = e.id
    AND lr.status = 'pending'
) rec_stats ON TRUE

WHERE e.is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_emp_learning_context_pk
ON mv_employee_learning_context(employee_id);

COMMENT ON MATERIALIZED VIEW mv_employee_learning_context IS 'Aggregated learning context for each employee';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
--
-- ALTER TABLE learning_paths DROP COLUMN IF EXISTS embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE recruiting_candidates DROP COLUMN IF EXISTS profile_embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- DROP MATERIALIZED VIEW IF EXISTS mv_employee_learning_context;
-- DROP MATERIALIZED VIEW IF EXISTS mv_recruiting_pipeline;
-- DROP TABLE IF EXISTS learning_recommendations;
-- DROP TABLE IF EXISTS interview_feedback;
-- DROP TABLE IF EXISTS course_enrollments_semantic;
-- DROP TABLE IF EXISTS job_postings;
