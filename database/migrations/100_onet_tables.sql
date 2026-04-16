-- Migration 100: O*NET Tables
-- Creates tables for O*NET occupational data import and ESCO mapping
-- Story: S-ONTO-01-04

BEGIN;

-- Import job tracking
CREATE TABLE IF NOT EXISTS onet_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_type VARCHAR(50) NOT NULL, -- occupations, skills, abilities, knowledge, work_activities, links
    source_version VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- O*NET Occupations
CREATE TABLE IF NOT EXISTS onet_occupations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_soc_code VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    job_zone INTEGER,
    related_experience TEXT,
    education_required TEXT,
    on_job_training TEXT,
    source_version VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_occupations_soc_code ON onet_occupations(onet_soc_code);
CREATE INDEX IF NOT EXISTS idx_onet_occupations_title ON onet_occupations USING gin(title gin_trgm_ops);

-- O*NET Skills
CREATE TABLE IF NOT EXISTS onet_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(50) NOT NULL UNIQUE,
    element_name VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    esco_skill_id UUID REFERENCES esco_skills(id),
    similarity_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_skills_element_id ON onet_skills(element_id);
CREATE INDEX IF NOT EXISTS idx_onet_skills_name ON onet_skills USING gin(element_name gin_trgm_ops);

-- O*NET Abilities
CREATE TABLE IF NOT EXISTS onet_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(50) NOT NULL UNIQUE,
    element_name VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_abilities_element_id ON onet_abilities(element_id);

-- O*NET Knowledge
CREATE TABLE IF NOT EXISTS onet_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(50) NOT NULL UNIQUE,
    element_name VARCHAR(500) NOT NULL,
    description TEXT,
    domain VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_knowledge_element_id ON onet_knowledge(element_id);

-- O*NET Work Activities
CREATE TABLE IF NOT EXISTS onet_work_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id VARCHAR(50) NOT NULL UNIQUE,
    element_name VARCHAR(500) NOT NULL,
    description TEXT,
    activity_type VARCHAR(100),
    parent_element_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_work_activities_element_id ON onet_work_activities(element_id);

-- O*NET Occupation-Skill Links
CREATE TABLE IF NOT EXISTS onet_occupation_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES onet_skills(id) ON DELETE CASCADE,
    importance NUMERIC(5,2),
    level NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(occupation_id, skill_id)
);

-- O*NET Occupation-Ability Links
CREATE TABLE IF NOT EXISTS onet_occupation_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    ability_id UUID NOT NULL REFERENCES onet_abilities(id) ON DELETE CASCADE,
    importance NUMERIC(5,2),
    level NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(occupation_id, ability_id)
);

-- O*NET Occupation-Knowledge Links
CREATE TABLE IF NOT EXISTS onet_occupation_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    knowledge_id UUID NOT NULL REFERENCES onet_knowledge(id) ON DELETE CASCADE,
    importance NUMERIC(5,2),
    level NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(occupation_id, knowledge_id)
);

-- O*NET Occupation-Work Activity Links
CREATE TABLE IF NOT EXISTS onet_occupation_work_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES onet_occupations(id) ON DELETE CASCADE,
    work_activity_id UUID NOT NULL REFERENCES onet_work_activities(id) ON DELETE CASCADE,
    importance NUMERIC(5,2),
    level NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(occupation_id, work_activity_id)
);

-- O*NET to ESCO Mapping
CREATE TABLE IF NOT EXISTS onet_esco_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onet_element_id VARCHAR(50) NOT NULL,
    onet_element_type VARCHAR(50) NOT NULL, -- skill, ability, knowledge, occupation
    esco_uri VARCHAR(500),
    esco_skill_id UUID REFERENCES esco_skills(id),
    esco_occupation_id UUID REFERENCES esco_occupations(id),
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0.0,
    mapping_method VARCHAR(50), -- semantic, manual, exact
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onet_esco_mappings_onet ON onet_esco_mappings(onet_element_id, onet_element_type);
CREATE INDEX IF NOT EXISTS idx_onet_esco_mappings_confidence ON onet_esco_mappings(confidence DESC);

-- Statistics function referenced by onet-import service
CREATE OR REPLACE FUNCTION fn_get_onet_stats()
RETURNS TABLE (
    occupations_count BIGINT,
    skills_count BIGINT,
    abilities_count BIGINT,
    knowledge_count BIGINT,
    work_activities_count BIGINT,
    occupation_skill_links BIGINT,
    esco_mappings_count BIGINT,
    import_jobs_total BIGINT,
    import_jobs_completed BIGINT,
    import_jobs_failed BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM onet_occupations),
        (SELECT COUNT(*) FROM onet_skills),
        (SELECT COUNT(*) FROM onet_abilities),
        (SELECT COUNT(*) FROM onet_knowledge),
        (SELECT COUNT(*) FROM onet_work_activities),
        (SELECT COUNT(*) FROM onet_occupation_skills),
        (SELECT COUNT(*) FROM onet_esco_mappings),
        (SELECT COUNT(*) FROM onet_import_jobs),
        (SELECT COUNT(*) FROM onet_import_jobs WHERE status = 'completed'),
        (SELECT COUNT(*) FROM onet_import_jobs WHERE status = 'failed');
END;
$$ LANGUAGE plpgsql;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('100') ON CONFLICT DO NOTHING;

COMMIT;
