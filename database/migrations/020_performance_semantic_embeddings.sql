-- Migration: 020_performance_semantic_embeddings.sql
-- Description: Add semantic embedding columns to performance management entities
-- Author: Claude
-- Date: 2025-12-22
-- Epic: Semantic Intelligence Layer
-- Phase: 2 - Performance Context

-- =============================================================================
-- PHASE 2.1: Performance Review Embeddings
-- =============================================================================
-- Performance review embeddings capture qualitative assessment content:
-- - Strengths, areas for improvement, manager/employee comments
-- - Used for: trend analysis, feedback search, talent identification

ALTER TABLE performance_reviews
ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

-- Index for similarity search on performance reviews
CREATE INDEX IF NOT EXISTS idx_performance_reviews_embedding
ON performance_reviews USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 30);

COMMENT ON COLUMN performance_reviews.content_embedding IS 'Semantic embedding of review narrative (strengths, improvements, comments)';

-- =============================================================================
-- PHASE 2.2: Check-in Embeddings
-- =============================================================================
-- Check-in embeddings capture ongoing feedback and discussion content:
-- - Agenda, notes, action items
-- - Used for: continuous feedback analysis, conversation search

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

-- Index for similarity search on check-ins
CREATE INDEX IF NOT EXISTS idx_check_ins_embedding
ON check_ins USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 50);

COMMENT ON COLUMN check_ins.content_embedding IS 'Semantic embedding of check-in content (agenda, notes, action items)';

-- =============================================================================
-- PHASE 2.3: Feedback 360 Embeddings
-- =============================================================================
-- 360 feedback embeddings capture multi-source assessment:
-- - Strengths, areas for improvement from multiple reviewers
-- - Used for: holistic talent view, feedback pattern analysis

ALTER TABLE feedback_360
ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_feedback_360_embedding
ON feedback_360 USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 20);

COMMENT ON COLUMN feedback_360.content_embedding IS 'Semantic embedding of 360 feedback content (strengths, improvements)';

-- =============================================================================
-- PHASE 2.4: Performance Aggregation View
-- =============================================================================
-- Materialized view for aggregated employee performance context

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_employee_performance_context AS
SELECT
    e.id AS employee_id,
    e.tenant_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title,
    e.department,

    -- Latest review metrics
    latest_review.overall_rating AS latest_overall_rating,
    latest_review.potential_rating AS latest_potential_rating,
    latest_review.strengths AS latest_strengths,
    latest_review.areas_for_improvement AS latest_areas_for_improvement,

    -- Review history stats
    review_stats.review_count,
    review_stats.avg_rating,
    review_stats.rating_trend,

    -- Check-in stats
    checkin_stats.checkin_count_90d,
    checkin_stats.avg_mood_90d,

    -- 360 feedback summary
    feedback_stats.feedback_count,
    feedback_stats.avg_360_rating

FROM employees e

-- Latest review
LEFT JOIN LATERAL (
    SELECT overall_rating, potential_rating, strengths, areas_for_improvement
    FROM performance_reviews pr
    WHERE pr.employee_id = e.id
    AND pr.status = 'completed'
    ORDER BY pr.review_period_end DESC
    LIMIT 1
) latest_review ON TRUE

-- Review statistics
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS review_count,
        AVG(overall_rating) AS avg_rating,
        CASE
            WHEN COUNT(*) >= 2 THEN
                (SELECT AVG(overall_rating) FROM (
                    SELECT overall_rating FROM performance_reviews
                    WHERE employee_id = e.id AND status = 'completed'
                    ORDER BY review_period_end DESC LIMIT 2
                ) recent) -
                (SELECT AVG(overall_rating) FROM (
                    SELECT overall_rating FROM performance_reviews
                    WHERE employee_id = e.id AND status = 'completed'
                    ORDER BY review_period_end DESC LIMIT 4 OFFSET 2
                ) older)
            ELSE NULL
        END AS rating_trend
    FROM performance_reviews
    WHERE employee_id = e.id AND status = 'completed'
) review_stats ON TRUE

-- Check-in statistics (last 90 days)
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS checkin_count_90d,
        AVG(employee_mood) AS avg_mood_90d
    FROM check_ins
    WHERE employee_id = e.id
    AND completed_at >= NOW() - INTERVAL '90 days'
) checkin_stats ON TRUE

-- 360 feedback statistics
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS feedback_count,
        AVG(overall_rating) AS avg_360_rating
    FROM feedback_360
    WHERE target_employee_id = e.id
    AND status = 'completed'
) feedback_stats ON TRUE

WHERE e.is_active = TRUE;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_emp_perf_context_pk
ON mv_employee_performance_context(employee_id);

CREATE INDEX IF NOT EXISTS idx_mv_emp_perf_context_tenant
ON mv_employee_performance_context(tenant_id);

COMMENT ON MATERIALIZED VIEW mv_employee_performance_context IS 'Aggregated performance context for each employee - refresh periodically';

-- =============================================================================
-- PHASE 2.5: Performance Trend Analysis Table
-- =============================================================================
-- Pre-computed performance trends for analytics

CREATE TABLE IF NOT EXISTS performance_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Metrics
    overall_rating NUMERIC(3,2),
    goal_achievement_pct NUMERIC(5,2),
    competency_score NUMERIC(3,2),
    engagement_score NUMERIC(3,2),

    -- Derived insights
    performance_tier VARCHAR(20), -- 'top_performer', 'solid_contributor', 'needs_support', 'at_risk'
    trend_direction VARCHAR(20), -- 'improving', 'stable', 'declining'

    -- Semantic summary
    summary_text TEXT,
    summary_embedding vector(1536),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uk_performance_trend UNIQUE (tenant_id, employee_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_performance_trends_employee
ON performance_trends(tenant_id, employee_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_performance_trends_embedding
ON performance_trends USING ivfflat (summary_embedding vector_cosine_ops) WITH (lists = 30);

COMMENT ON TABLE performance_trends IS 'Pre-computed performance trend summaries with semantic embeddings';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
--
-- ALTER TABLE performance_reviews DROP COLUMN IF EXISTS content_embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE check_ins DROP COLUMN IF EXISTS content_embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE feedback_360 DROP COLUMN IF EXISTS content_embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- DROP MATERIALIZED VIEW IF EXISTS mv_employee_performance_context;
-- DROP TABLE IF EXISTS performance_trends;
