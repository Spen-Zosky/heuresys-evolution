-- Migration: 024_skill_migration_jobs.sql
-- Story: S-ONTO-01-05 - Legacy Skill Migration Bridge
-- Description: Tables for tracking skill migration jobs and tenant custom skills

BEGIN;

-- ============================================================================
-- SKILL MIGRATION JOBS
-- Tracks migration jobs for converting legacy skills to ESCO ontology
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('employee_skills', 'extracted_skills', 'unknown_skills', 'all')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    matched_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),

    CONSTRAINT chk_processed_le_total CHECK (processed_records <= total_records)
);

-- Indexes
CREATE INDEX idx_skill_migration_jobs_tenant ON skill_migration_jobs(tenant_id);
CREATE INDEX idx_skill_migration_jobs_status ON skill_migration_jobs(status);
CREATE INDEX idx_skill_migration_jobs_created ON skill_migration_jobs(created_at DESC);

-- ============================================================================
-- TENANT CUSTOM SKILLS (enhancement if not exists)
-- Note: tenant_custom_skills already exists with proper schema:
--   - name_en, name_it (instead of name)
--   - base_esco_skill_id (instead of parent_esco_skill_id)
--   - embedding_en, embedding_it (instead of embedding)
-- Just add migration-specific columns if needed
-- ============================================================================

-- Add similarity_score and source for migration tracking
DO $$
BEGIN
    -- Add similarity_score if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_custom_skills' AND column_name = 'similarity_score'
    ) THEN
        ALTER TABLE tenant_custom_skills ADD COLUMN similarity_score NUMERIC(3,2);
    END IF;

    -- Add source if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_custom_skills' AND column_name = 'source'
    ) THEN
        ALTER TABLE tenant_custom_skills ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
    END IF;
END $$;

-- Note: Unique constraint already exists as tenant_skills_code_unique on (tenant_id, code)

-- ============================================================================
-- SKILL MIGRATION LOG
-- Detailed log of individual skill migration results
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES skill_migration_jobs(id) ON DELETE CASCADE,
    source_table VARCHAR(50) NOT NULL,
    source_record_id UUID NOT NULL,
    original_text TEXT NOT NULL,
    matched_esco_id UUID REFERENCES esco_skills(id),
    matched_skill_name TEXT,
    confidence NUMERIC(3,2),
    action VARCHAR(20) NOT NULL CHECK (action IN ('mapped', 'custom_skill', 'skipped', 'error')),
    custom_skill_id UUID REFERENCES tenant_custom_skills(id),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_skill_migration_log_job ON skill_migration_log(job_id);
CREATE INDEX idx_skill_migration_log_source ON skill_migration_log(source_table, source_record_id);
CREATE INDEX idx_skill_migration_log_action ON skill_migration_log(action);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Migration summary view
CREATE OR REPLACE VIEW v_skill_migration_summary AS
SELECT
    smj.tenant_id,
    t.name as tenant_name,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE smj.status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE smj.status = 'failed') as failed_jobs,
    SUM(smj.total_records) as total_records_processed,
    SUM(smj.matched_records) as total_matched,
    ROUND(
        CASE
            WHEN SUM(smj.processed_records) > 0 THEN
                (SUM(smj.matched_records)::NUMERIC / SUM(smj.processed_records)) * 100
            ELSE 0
        END, 2
    ) as match_rate_pct,
    MAX(smj.completed_at) as last_completed_at
FROM skill_migration_jobs smj
JOIN tenants t ON t.id = smj.tenant_id
GROUP BY smj.tenant_id, t.name;

-- Pending unknown skills view (for review queue)
CREATE OR REPLACE VIEW v_unknown_skills_review_queue AS
SELECT
    us.id,
    us.tenant_id,
    t.name as tenant_name,
    us.raw_text,
    us.occurrence_count,
    us.first_seen_at,
    us.last_seen_at,
    us.suggested_esco_id,
    es.preferred_label_en as suggested_skill_name,
    us.suggested_confidence,
    us.review_status
FROM unknown_skills us
JOIN tenants t ON t.id = us.tenant_id
LEFT JOIN esco_skills es ON es.id = us.suggested_esco_id
WHERE us.review_status IN ('pending', 'suggested', 'low_confidence')
ORDER BY us.occurrence_count DESC, us.last_seen_at DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get migration statistics
CREATE OR REPLACE FUNCTION fn_get_skill_migration_stats(p_tenant_id UUID)
RETURNS TABLE (
    employee_skills_total BIGINT,
    employee_skills_mapped BIGINT,
    employee_skills_unmapped BIGINT,
    extracted_skills_total BIGINT,
    extracted_skills_mapped BIGINT,
    extracted_skills_unmapped BIGINT,
    unknown_skills_total BIGINT,
    unknown_skills_approved BIGINT,
    unknown_skills_pending BIGINT,
    custom_skills_total BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM employee_skills WHERE tenant_id = p_tenant_id),
        (SELECT COUNT(*) FROM employee_skills WHERE tenant_id = p_tenant_id AND esco_skill_id IS NOT NULL),
        (SELECT COUNT(*) FROM employee_skills WHERE tenant_id = p_tenant_id AND esco_skill_id IS NULL AND custom_skill_name IS NOT NULL),
        (SELECT COUNT(*) FROM extracted_skills WHERE tenant_id = p_tenant_id),
        (SELECT COUNT(*) FROM extracted_skills WHERE tenant_id = p_tenant_id AND esco_skill_id IS NOT NULL),
        (SELECT COUNT(*) FROM extracted_skills WHERE tenant_id = p_tenant_id AND esco_skill_id IS NULL),
        (SELECT COUNT(*) FROM unknown_skills WHERE tenant_id = p_tenant_id),
        (SELECT COUNT(*) FROM unknown_skills WHERE tenant_id = p_tenant_id AND review_status = 'approved'),
        (SELECT COUNT(*) FROM unknown_skills WHERE tenant_id = p_tenant_id AND review_status IN ('pending', 'suggested', 'low_confidence')),
        (SELECT COUNT(*) FROM tenant_custom_skills WHERE tenant_id = p_tenant_id);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE skill_migration_jobs IS 'Tracks skill migration jobs for converting legacy skills to ESCO ontology';
COMMENT ON TABLE skill_migration_log IS 'Detailed log of individual skill migration results';
COMMENT ON VIEW v_skill_migration_summary IS 'Summary statistics for skill migration by tenant';
COMMENT ON VIEW v_unknown_skills_review_queue IS 'Queue of unknown skills pending human review';
COMMENT ON FUNCTION fn_get_skill_migration_stats IS 'Returns skill migration statistics for a tenant';
