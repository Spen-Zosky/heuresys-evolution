-- Migration: 025_onet_import.sql
-- Story: S-ONTO-01-04 - O*NET Data Import Pipeline
-- Description: Tables for O*NET occupational data integration

BEGIN;

-- ============================================================================
-- O*NET OCCUPATIONS
-- US Department of Labor occupational classification
-- ============================================================================

CREATE TABLE IF NOT EXISTS onet_occupations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_soc_code VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Job zone (1-5 complexity level)
    job_zone INTEGER CHECK (job_zone BETWEEN 1 AND 5),

    -- Experience requirements
    related_experience TEXT,
    education_required TEXT,
    on_job_training TEXT,

    -- Embeddings for semantic search
    embedding_en vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMPTZ,

    -- Metadata
    source_version VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onet_occupations_code ON onet_occupations(onet_soc_code);
CREATE INDEX IF NOT EXISTS idx_onet_occupations_title ON onet_occupations USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_onet_occupations_job_zone ON onet_occupations(job_zone);
CREATE INDEX IF NOT EXISTS idx_onet_occupations_embedding ON onet_occupations USING ivfflat (embedding_en vector_cosine_ops);

-- ============================================================================
-- O*NET SKILLS
-- Skills from O*NET Content Model
-- ============================================================================

CREATE TABLE IF NOT EXISTS onet_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(20) NOT NULL UNIQUE,
    element_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Skill category
    category VARCHAR(50), -- 'Basic Skills', 'Cross-Functional Skills', etc.

    -- Importance/Level scales (0-100)
    -- Note: These are global averages, per-occupation values are in linking table

    -- Embeddings for semantic search
    embedding_en vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMPTZ,

    -- ESCO mapping
    mapped_esco_skill_id UUID REFERENCES esco_skills(id),
    mapping_confidence NUMERIC(3,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_skills_element ON onet_skills(element_id);
CREATE INDEX IF NOT EXISTS idx_onet_skills_category ON onet_skills(category);
CREATE INDEX IF NOT EXISTS idx_onet_skills_esco ON onet_skills(mapped_esco_skill_id);

-- ============================================================================
-- O*NET ABILITIES
-- Abilities from O*NET Content Model
-- ============================================================================

CREATE TABLE IF NOT EXISTS onet_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(20) NOT NULL UNIQUE,
    element_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Ability category
    category VARCHAR(50), -- 'Cognitive', 'Psychomotor', 'Physical', 'Sensory'

    -- Embeddings
    embedding_en vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMPTZ,

    -- ESCO mapping
    mapped_esco_skill_id UUID REFERENCES esco_skills(id),
    mapping_confidence NUMERIC(3,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_abilities_element ON onet_abilities(element_id);
CREATE INDEX IF NOT EXISTS idx_onet_abilities_category ON onet_abilities(category);

-- ============================================================================
-- O*NET KNOWLEDGE
-- Knowledge areas from O*NET Content Model
-- ============================================================================

CREATE TABLE IF NOT EXISTS onet_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(20) NOT NULL UNIQUE,
    element_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Knowledge domain
    domain VARCHAR(100),

    -- Embeddings
    embedding_en vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMPTZ,

    -- ESCO mapping
    mapped_esco_skill_id UUID REFERENCES esco_skills(id),
    mapping_confidence NUMERIC(3,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_knowledge_element ON onet_knowledge(element_id);
CREATE INDEX IF NOT EXISTS idx_onet_knowledge_domain ON onet_knowledge(domain);

-- ============================================================================
-- O*NET WORK ACTIVITIES
-- Generalized and Intermediate Work Activities
-- ============================================================================

CREATE TABLE IF NOT EXISTS onet_work_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(20) NOT NULL UNIQUE,
    element_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Activity type
    activity_type VARCHAR(50), -- 'Generalized', 'Intermediate', 'Detailed'
    parent_element_id VARCHAR(20),

    -- Embeddings
    embedding_en vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_work_activities_element ON onet_work_activities(element_id);
CREATE INDEX IF NOT EXISTS idx_onet_work_activities_type ON onet_work_activities(activity_type);

-- ============================================================================
-- OCCUPATION-SKILL LINKING TABLES
-- Per-occupation importance and level ratings
-- ============================================================================

-- Occupation Skills
CREATE TABLE IF NOT EXISTS onet_occupation_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES onet_skills(id) ON DELETE CASCADE,

    -- Importance scale (0-100)
    importance NUMERIC(5,2),
    -- Level scale (0-100)
    level NUMERIC(5,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(occupation_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_onet_occ_skills_occupation ON onet_occupation_skills(occupation_id);
CREATE INDEX IF NOT EXISTS idx_onet_occ_skills_skill ON onet_occupation_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_onet_occ_skills_importance ON onet_occupation_skills(importance DESC);

-- Occupation Abilities
CREATE TABLE IF NOT EXISTS onet_occupation_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    ability_id UUID NOT NULL REFERENCES onet_abilities(id) ON DELETE CASCADE,

    importance NUMERIC(5,2),
    level NUMERIC(5,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(occupation_id, ability_id)
);

CREATE INDEX IF NOT EXISTS idx_onet_occ_abilities_occupation ON onet_occupation_abilities(occupation_id);
CREATE INDEX IF NOT EXISTS idx_onet_occ_abilities_ability ON onet_occupation_abilities(ability_id);

-- Occupation Knowledge
CREATE TABLE IF NOT EXISTS onet_occupation_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    knowledge_id UUID NOT NULL REFERENCES onet_knowledge(id) ON DELETE CASCADE,

    importance NUMERIC(5,2),
    level NUMERIC(5,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(occupation_id, knowledge_id)
);

CREATE INDEX IF NOT EXISTS idx_onet_occ_knowledge_occupation ON onet_occupation_knowledge(occupation_id);
CREATE INDEX IF NOT EXISTS idx_onet_occ_knowledge_knowledge ON onet_occupation_knowledge(knowledge_id);

-- Occupation Work Activities
CREATE TABLE IF NOT EXISTS onet_occupation_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES onet_work_activities(id) ON DELETE CASCADE,

    importance NUMERIC(5,2),
    level NUMERIC(5,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(occupation_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_onet_occ_activities_occupation ON onet_occupation_activities(occupation_id);
CREATE INDEX IF NOT EXISTS idx_onet_occ_activities_activity ON onet_occupation_activities(activity_id);

-- ============================================================================
-- O*NET IMPORT JOBS
-- Track import operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS onet_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_type VARCHAR(50) NOT NULL, -- 'full', 'occupations', 'skills', 'abilities', 'knowledge', 'activities'
    source_version VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_onet_import_jobs_status ON onet_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_onet_import_jobs_created ON onet_import_jobs(created_at DESC);

-- ============================================================================
-- CROSS-TAXONOMY MAPPING VIEW
-- Unified view of skills across ESCO and O*NET
-- ============================================================================

CREATE OR REPLACE VIEW v_unified_skills AS
SELECT
    'esco' as source,
    es.id,
    es.uri as external_id,
    es.preferred_label_en as name,
    es.description_en as description,
    es.skill_type as category,
    es.embedding_en as embedding,
    NULL::UUID as mapped_to_onet,
    NULL::UUID as mapped_to_esco
FROM esco_skills es

UNION ALL

SELECT
    'onet_skill' as source,
    os.id,
    os.element_id as external_id,
    os.element_name as name,
    os.description,
    os.category,
    os.embedding_en as embedding,
    NULL::UUID as mapped_to_onet,
    os.mapped_esco_skill_id as mapped_to_esco
FROM onet_skills os

UNION ALL

SELECT
    'onet_ability' as source,
    oa.id,
    oa.element_id as external_id,
    oa.element_name as name,
    oa.description,
    oa.category,
    oa.embedding_en as embedding,
    NULL::UUID as mapped_to_onet,
    oa.mapped_esco_skill_id as mapped_to_esco
FROM onet_abilities oa

UNION ALL

SELECT
    'onet_knowledge' as source,
    ok.id,
    ok.element_id as external_id,
    ok.element_name as name,
    ok.description,
    ok.domain as category,
    ok.embedding_en as embedding,
    NULL::UUID as mapped_to_onet,
    ok.mapped_esco_skill_id as mapped_to_esco
FROM onet_knowledge ok;

-- ============================================================================
-- STATISTICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_get_onet_stats()
RETURNS TABLE (
    occupations_total BIGINT,
    occupations_with_embeddings BIGINT,
    skills_total BIGINT,
    skills_mapped_to_esco BIGINT,
    abilities_total BIGINT,
    knowledge_total BIGINT,
    work_activities_total BIGINT,
    occupation_skill_links BIGINT,
    last_import_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM onet_occupations),
        (SELECT COUNT(*) FROM onet_occupations WHERE embedding_en IS NOT NULL),
        (SELECT COUNT(*) FROM onet_skills),
        (SELECT COUNT(*) FROM onet_skills WHERE mapped_esco_skill_id IS NOT NULL),
        (SELECT COUNT(*) FROM onet_abilities),
        (SELECT COUNT(*) FROM onet_knowledge),
        (SELECT COUNT(*) FROM onet_work_activities),
        (SELECT COUNT(*) FROM onet_occupation_skills),
        (SELECT MAX(completed_at) FROM onet_import_jobs WHERE status = 'completed');
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE onet_occupations IS 'O*NET-SOC occupational classifications with job zone info';
COMMENT ON TABLE onet_skills IS 'O*NET skills from Content Model with ESCO mappings';
COMMENT ON TABLE onet_abilities IS 'O*NET abilities from Content Model';
COMMENT ON TABLE onet_knowledge IS 'O*NET knowledge areas';
COMMENT ON TABLE onet_work_activities IS 'O*NET work activities hierarchy';
COMMENT ON TABLE onet_occupation_skills IS 'Links occupations to skills with importance/level ratings';
COMMENT ON VIEW v_unified_skills IS 'Cross-taxonomy view of ESCO and O*NET skills';
COMMENT ON FUNCTION fn_get_onet_stats IS 'Returns O*NET database statistics';
