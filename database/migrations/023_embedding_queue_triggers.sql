-- Migration: 023_embedding_queue_triggers.sql
-- Description: Asynchronous embedding queue with automatic triggers
-- Author: Claude
-- Date: 2025-12-22
-- Epic: Semantic Intelligence Layer
-- Phase: 5 - Dynamic Embedding System

-- =============================================================================
-- PHASE 5.1: Embedding Queue Table
-- =============================================================================
-- Queue for pending embedding generations

CREATE TABLE IF NOT EXISTS embedding_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    tenant_id UUID,
    operation VARCHAR(20) NOT NULL DEFAULT 'upsert', -- 'upsert', 'delete'
    priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Prevent duplicate queue entries
    CONSTRAINT uk_embedding_queue_entity UNIQUE (entity_type, entity_id, status)
);

CREATE INDEX idx_embedding_queue_pending
ON embedding_queue(status, priority, created_at)
WHERE status = 'pending';

CREATE INDEX idx_embedding_queue_processing
ON embedding_queue(status, processed_at)
WHERE status = 'processing';

COMMENT ON TABLE embedding_queue IS 'Asynchronous queue for embedding generation';

-- =============================================================================
-- PHASE 5.2: Queue Statistics View
-- =============================================================================

CREATE OR REPLACE VIEW v_embedding_queue_stats AS
SELECT
    status,
    entity_type,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest,
    AVG(attempts) as avg_attempts
FROM embedding_queue
GROUP BY status, entity_type
ORDER BY status, entity_type;

-- =============================================================================
-- PHASE 5.3: Generic Queue Insert Function
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_queue_embedding()
RETURNS TRIGGER AS $$
DECLARE
    v_entity_type VARCHAR(50);
    v_tenant_id UUID;
    v_operation VARCHAR(20);
BEGIN
    -- Determine entity type from table name
    v_entity_type := TG_ARGV[0];

    -- Determine operation
    IF TG_OP = 'DELETE' THEN
        v_operation := 'delete';
        v_tenant_id := OLD.tenant_id;

        -- Insert delete operation
        INSERT INTO embedding_queue (entity_type, entity_id, tenant_id, operation, priority)
        VALUES (v_entity_type, OLD.id, v_tenant_id, v_operation, 3)
        ON CONFLICT (entity_type, entity_id, status)
        DO UPDATE SET
            operation = 'delete',
            created_at = NOW(),
            attempts = 0,
            error_message = NULL;

        RETURN OLD;
    ELSE
        v_operation := 'upsert';
        v_tenant_id := NEW.tenant_id;

        -- Insert or update queue entry
        INSERT INTO embedding_queue (entity_type, entity_id, tenant_id, operation, priority)
        VALUES (v_entity_type, NEW.id, v_tenant_id, v_operation, 5)
        ON CONFLICT (entity_type, entity_id, status)
        DO UPDATE SET
            operation = 'upsert',
            created_at = NOW(),
            attempts = 0,
            error_message = NULL
        WHERE embedding_queue.status = 'pending';

        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PHASE 5.4: Triggers for Core HR Entities
-- =============================================================================

-- Employees
DROP TRIGGER IF EXISTS trg_employees_embedding_queue ON employees;
CREATE TRIGGER trg_employees_embedding_queue
    AFTER INSERT OR UPDATE OF first_name, last_name, job_title, skills, bio, department_id
    ON employees
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('employee');

-- Departments
DROP TRIGGER IF EXISTS trg_departments_embedding_queue ON departments;
CREATE TRIGGER trg_departments_embedding_queue
    AFTER INSERT OR UPDATE OF name, description
    ON departments
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('department');

-- Org Units
DROP TRIGGER IF EXISTS trg_org_units_embedding_queue ON org_units;
CREATE TRIGGER trg_org_units_embedding_queue
    AFTER INSERT OR UPDATE OF name, description, org_type
    ON org_units
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('org_unit');

-- Locations
DROP TRIGGER IF EXISTS trg_locations_embedding_queue ON locations;
CREATE TRIGGER trg_locations_embedding_queue
    AFTER INSERT OR UPDATE OF name, address, city, country
    ON locations
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('location');

-- =============================================================================
-- PHASE 5.5: Triggers for Performance Entities
-- =============================================================================

-- Performance Reviews
DROP TRIGGER IF EXISTS trg_performance_reviews_embedding_queue ON performance_reviews;
CREATE TRIGGER trg_performance_reviews_embedding_queue
    AFTER INSERT OR UPDATE OF review_type, overall_rating, strengths, areas_for_improvement, goals_achieved, manager_comments
    ON performance_reviews
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('performance_review');

-- Check-ins
DROP TRIGGER IF EXISTS trg_check_ins_embedding_queue ON check_ins;
CREATE TRIGGER trg_check_ins_embedding_queue
    AFTER INSERT OR UPDATE OF check_in_type, notes, accomplishments, blockers, next_steps
    ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('check_in');

-- Feedback 360
DROP TRIGGER IF EXISTS trg_feedback_360_embedding_queue ON feedback_360;
CREATE TRIGGER trg_feedback_360_embedding_queue
    AFTER INSERT OR UPDATE OF feedback_text, strengths, development_areas, relationship_type
    ON feedback_360
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('feedback_360');

-- =============================================================================
-- PHASE 5.6: Triggers for Talent Entities
-- =============================================================================

-- Skill Gap Analyses
DROP TRIGGER IF EXISTS trg_skill_gap_analyses_embedding_queue ON skill_gap_analyses;
CREATE TRIGGER trg_skill_gap_analyses_embedding_queue
    AFTER INSERT OR UPDATE OF recommendations, priority_skills, gap_details
    ON skill_gap_analyses
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('skill_gap_analysis');

-- Career Paths
DROP TRIGGER IF EXISTS trg_career_paths_embedding_queue ON career_paths;
CREATE TRIGGER trg_career_paths_embedding_queue
    AFTER INSERT OR UPDATE OF name, description, target_role
    ON career_paths
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('career_path');

-- =============================================================================
-- PHASE 5.7: Triggers for Learning & Recruiting Entities
-- =============================================================================

-- Learning Paths
DROP TRIGGER IF EXISTS trg_learning_paths_embedding_queue ON learning_paths;
CREATE TRIGGER trg_learning_paths_embedding_queue
    AFTER INSERT OR UPDATE OF name, description, target_role, skills_covered
    ON learning_paths
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('learning_path');

-- Recruiting Candidates
DROP TRIGGER IF EXISTS trg_recruiting_candidates_embedding_queue ON recruiting_candidates;
CREATE TRIGGER trg_recruiting_candidates_embedding_queue
    AFTER INSERT OR UPDATE OF first_name, last_name, job_title, skills, experience_years, notes, current_company
    ON recruiting_candidates
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_embedding('candidate');

-- =============================================================================
-- PHASE 5.8: Queue Processing Helper Functions
-- =============================================================================

-- Get next batch of items to process
CREATE OR REPLACE FUNCTION fn_get_embedding_queue_batch(
    p_batch_size INTEGER DEFAULT 50,
    p_entity_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    entity_type VARCHAR(50),
    entity_id UUID,
    tenant_id UUID,
    operation VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH batch AS (
        SELECT eq.id
        FROM embedding_queue eq
        WHERE eq.status = 'pending'
        AND eq.attempts < eq.max_attempts
        AND (p_entity_type IS NULL OR eq.entity_type = p_entity_type)
        ORDER BY eq.priority, eq.created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE embedding_queue eq
    SET status = 'processing',
        processed_at = NOW(),
        attempts = attempts + 1
    FROM batch
    WHERE eq.id = batch.id
    RETURNING eq.id, eq.entity_type, eq.entity_id, eq.tenant_id, eq.operation;
END;
$$ LANGUAGE plpgsql;

-- Mark queue items as completed
CREATE OR REPLACE FUNCTION fn_complete_embedding_queue(
    p_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE embedding_queue
    SET status = 'completed',
        processed_at = NOW()
    WHERE id = ANY(p_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Mark queue item as failed
CREATE OR REPLACE FUNCTION fn_fail_embedding_queue(
    p_id UUID,
    p_error TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE embedding_queue
    SET status = CASE
            WHEN attempts >= max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        error_message = p_error,
        processed_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old completed entries (keep last 7 days)
CREATE OR REPLACE FUNCTION fn_cleanup_embedding_queue(
    p_days INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM embedding_queue
    WHERE status = 'completed'
    AND processed_at < NOW() - (p_days || ' days')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Reset stuck processing items (older than 10 minutes)
CREATE OR REPLACE FUNCTION fn_reset_stuck_embedding_queue()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE embedding_queue
    SET status = 'pending',
        processed_at = NULL
    WHERE status = 'processing'
    AND processed_at < NOW() - INTERVAL '10 minutes';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PHASE 5.9: Queue Statistics Function
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_embedding_queue_status()
RETURNS TABLE (
    status VARCHAR(20),
    entity_type VARCHAR(50),
    count BIGINT,
    oldest_entry TIMESTAMP WITH TIME ZONE,
    failed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        eq.status,
        eq.entity_type,
        COUNT(*)::BIGINT as count,
        MIN(eq.created_at) as oldest_entry,
        COUNT(*) FILTER (WHERE eq.status = 'failed')::BIGINT as failed_count
    FROM embedding_queue eq
    GROUP BY eq.status, eq.entity_type
    ORDER BY eq.status, eq.entity_type;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
--
-- DROP TRIGGER IF EXISTS trg_employees_embedding_queue ON employees;
-- DROP TRIGGER IF EXISTS trg_departments_embedding_queue ON departments;
-- DROP TRIGGER IF EXISTS trg_org_units_embedding_queue ON org_units;
-- DROP TRIGGER IF EXISTS trg_locations_embedding_queue ON locations;
-- DROP TRIGGER IF EXISTS trg_performance_reviews_embedding_queue ON performance_reviews;
-- DROP TRIGGER IF EXISTS trg_check_ins_embedding_queue ON check_ins;
-- DROP TRIGGER IF EXISTS trg_feedback_360_embedding_queue ON feedback_360;
-- DROP TRIGGER IF EXISTS trg_skill_gap_analyses_embedding_queue ON skill_gap_analyses;
-- DROP TRIGGER IF EXISTS trg_career_paths_embedding_queue ON career_paths;
-- DROP TRIGGER IF EXISTS trg_learning_paths_embedding_queue ON learning_paths;
-- DROP TRIGGER IF EXISTS trg_recruiting_candidates_embedding_queue ON recruiting_candidates;
-- DROP FUNCTION IF EXISTS fn_queue_embedding();
-- DROP FUNCTION IF EXISTS fn_get_embedding_queue_batch(INTEGER, VARCHAR);
-- DROP FUNCTION IF EXISTS fn_complete_embedding_queue(UUID[]);
-- DROP FUNCTION IF EXISTS fn_fail_embedding_queue(UUID, TEXT);
-- DROP FUNCTION IF EXISTS fn_cleanup_embedding_queue(INTEGER);
-- DROP FUNCTION IF EXISTS fn_reset_stuck_embedding_queue();
-- DROP FUNCTION IF EXISTS fn_embedding_queue_status();
-- DROP VIEW IF EXISTS v_embedding_queue_stats;
-- DROP TABLE IF EXISTS embedding_queue;
