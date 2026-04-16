-- Migration: 027_skill_pair_usage
-- Description: Create skill_pair_usage table for tracking complementary skill usage
-- Epic: E-ONTO-02 (AI Integration)
-- Story: S-ONTO-02-08-R (Skill Suggestion API)
-- Created: 2025-12-22

-- =============================================================================
-- SKILL PAIR USAGE TABLE
-- Tracks how often skill pairs are used together for complementary suggestions
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_pair_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id_1 UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    skill_id_2 UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    -- Usage metrics
    co_occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Context where skills were seen together
    context_type VARCHAR(50), -- 'employee_profile', 'job_requirement', 'learning_path', 'career_path'

    -- Calculated strength based on usage
    usage_strength NUMERIC(5,4) DEFAULT 0.0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure skill_id_1 < skill_id_2 to avoid duplicates
    CONSTRAINT skill_pair_order CHECK (skill_id_1 < skill_id_2),
    CONSTRAINT skill_pair_unique UNIQUE (skill_id_1, skill_id_2, tenant_id, context_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_skill_pair_usage_skill1 ON skill_pair_usage(skill_id_1);
CREATE INDEX IF NOT EXISTS idx_skill_pair_usage_skill2 ON skill_pair_usage(skill_id_2);
CREATE INDEX IF NOT EXISTS idx_skill_pair_usage_tenant ON skill_pair_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_pair_usage_strength ON skill_pair_usage(usage_strength DESC);
CREATE INDEX IF NOT EXISTS idx_skill_pair_usage_context ON skill_pair_usage(context_type);

-- Function to normalize skill pair order
CREATE OR REPLACE FUNCTION normalize_skill_pair(
    p_skill_id_1 UUID,
    p_skill_id_2 UUID
) RETURNS TABLE(skill_1 UUID, skill_2 UUID) AS $$
BEGIN
    IF p_skill_id_1 < p_skill_id_2 THEN
        RETURN QUERY SELECT p_skill_id_1, p_skill_id_2;
    ELSE
        RETURN QUERY SELECT p_skill_id_2, p_skill_id_1;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to record skill pair usage
CREATE OR REPLACE FUNCTION record_skill_pair_usage(
    p_skill_id_1 UUID,
    p_skill_id_2 UUID,
    p_tenant_id UUID DEFAULT NULL,
    p_context_type VARCHAR(50) DEFAULT 'employee_profile'
) RETURNS UUID AS $$
DECLARE
    v_skill_1 UUID;
    v_skill_2 UUID;
    v_pair_id UUID;
BEGIN
    -- Skip if same skill
    IF p_skill_id_1 = p_skill_id_2 THEN
        RETURN NULL;
    END IF;

    -- Normalize order
    SELECT * INTO v_skill_1, v_skill_2 FROM normalize_skill_pair(p_skill_id_1, p_skill_id_2);

    -- Upsert the pair
    INSERT INTO skill_pair_usage (skill_id_1, skill_id_2, tenant_id, context_type)
    VALUES (v_skill_1, v_skill_2, p_tenant_id, p_context_type)
    ON CONFLICT (skill_id_1, skill_id_2, tenant_id, context_type)
    DO UPDATE SET
        co_occurrence_count = skill_pair_usage.co_occurrence_count + 1,
        last_seen_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_pair_id;

    RETURN v_pair_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update usage strength (to be called periodically)
CREATE OR REPLACE FUNCTION update_skill_pair_strengths() RETURNS INTEGER AS $$
DECLARE
    v_max_count INTEGER;
    v_updated INTEGER;
BEGIN
    -- Get max co-occurrence count for normalization
    SELECT MAX(co_occurrence_count) INTO v_max_count FROM skill_pair_usage;

    IF v_max_count IS NULL OR v_max_count = 0 THEN
        RETURN 0;
    END IF;

    -- Update strengths normalized to 0-1 range
    WITH updated AS (
        UPDATE skill_pair_usage
        SET usage_strength = LEAST(1.0, (co_occurrence_count::NUMERIC / v_max_count)),
            updated_at = NOW()
        WHERE co_occurrence_count > 0
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated FROM updated;

    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED INITIAL DATA FROM EXISTING RELATIONS
-- =============================================================================

-- Populate skill pairs from existing ontology relations
INSERT INTO skill_pair_usage (skill_id_1, skill_id_2, context_type, co_occurrence_count)
SELECT
    LEAST(r.source_skill_id, r.target_skill_id),
    GREATEST(r.source_skill_id, r.target_skill_id),
    'ontology_relation',
    1
FROM ontology_skill_relations r
WHERE r.approval_status = 'approved'
  AND r.source_skill_id != r.target_skill_id
ON CONFLICT (skill_id_1, skill_id_2, tenant_id, context_type) DO NOTHING;

-- Update initial strengths
SELECT update_skill_pair_strengths();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE skill_pair_usage IS 'Tracks skill pairs used together for complementary skill suggestions';
COMMENT ON COLUMN skill_pair_usage.co_occurrence_count IS 'Number of times these skills appeared together';
COMMENT ON COLUMN skill_pair_usage.usage_strength IS 'Normalized strength 0-1 based on usage frequency';
COMMENT ON COLUMN skill_pair_usage.context_type IS 'Context where skills were seen together';
