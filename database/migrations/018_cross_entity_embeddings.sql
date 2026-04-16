-- Migration: 018_cross_entity_embeddings.sql
-- Description: Add embedding columns to occupations, jobs, goals, courses, and NACE taxonomy
-- Author: Claude
-- Date: 2025-12-22
-- Epic: E-ONTO-01 (Ontology Foundation)
-- Story: Cross-Entity Semantic Search

-- =============================================================================
-- PHASE 1: Add embedding columns to ESCO Occupations
-- =============================================================================

-- Add embedding columns to esco_occupations
ALTER TABLE esco_occupations
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

-- Create IVFFlat indexes for occupations
CREATE INDEX IF NOT EXISTS idx_esco_occupations_embedding_en
ON esco_occupations USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_esco_occupations_embedding_it
ON esco_occupations USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 50);

COMMENT ON COLUMN esco_occupations.embedding_en IS 'Vector embedding of occupation description (English)';
COMMENT ON COLUMN esco_occupations.embedding_it IS 'Vector embedding of occupation description (Italian)';

-- =============================================================================
-- PHASE 2: Add embedding columns to Job Templates
-- =============================================================================

ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_job_templates_embedding_en
ON job_templates USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 20);

CREATE INDEX IF NOT EXISTS idx_job_templates_embedding_it
ON job_templates USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 20);

COMMENT ON COLUMN job_templates.embedding_en IS 'Vector embedding of job description (English)';
COMMENT ON COLUMN job_templates.embedding_it IS 'Vector embedding of job description (Italian)';

-- =============================================================================
-- PHASE 3: Add embedding columns to Goals
-- =============================================================================

ALTER TABLE goals
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_goals_embedding
ON goals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 30);

COMMENT ON COLUMN goals.embedding IS 'Vector embedding of goal title and description';

-- =============================================================================
-- PHASE 4: Add embedding columns to Courses
-- =============================================================================

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_courses_embedding_en
ON courses USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_courses_embedding_it
ON courses USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 10);

COMMENT ON COLUMN courses.embedding_en IS 'Vector embedding of course description (English)';
COMMENT ON COLUMN courses.embedding_it IS 'Vector embedding of course description (Italian)';

-- =============================================================================
-- PHASE 5: Add embedding columns to NACE Taxonomy
-- =============================================================================

-- NACE Sections (21 records)
ALTER TABLE nace_sections
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_nace_sections_embedding_en
ON nace_sections USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 5);

CREATE INDEX IF NOT EXISTS idx_nace_sections_embedding_it
ON nace_sections USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 5);

-- NACE Divisions (88 records)
ALTER TABLE nace_divisions
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_nace_divisions_embedding_en
ON nace_divisions USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 15);

CREATE INDEX IF NOT EXISTS idx_nace_divisions_embedding_it
ON nace_divisions USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 15);

-- NACE Groups (272 records)
ALTER TABLE nace_groups
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_nace_groups_embedding_en
ON nace_groups USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 30);

CREATE INDEX IF NOT EXISTS idx_nace_groups_embedding_it
ON nace_groups USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 30);

-- =============================================================================
-- PHASE 6: Create Industry-Occupation Mapping Table
-- =============================================================================

-- This table maps NACE industries to typical ESCO occupations
CREATE TABLE IF NOT EXISTS industry_occupation_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nace_division_code VARCHAR(10) NOT NULL,
    esco_occupation_uri VARCHAR(255) NOT NULL,
    relevance_score NUMERIC(3,2) DEFAULT 1.0,  -- 0.0 to 1.0
    is_core_occupation BOOLEAN DEFAULT FALSE,   -- Core vs supporting role
    typical_headcount_pct NUMERIC(5,2),         -- Typical % of workforce
    min_company_size INTEGER,                   -- Minimum company size for this role
    source VARCHAR(50) DEFAULT 'inferred',      -- 'manual', 'inferred', 'esco_api'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uk_industry_occupation UNIQUE (nace_division_code, esco_occupation_uri)
);

CREATE INDEX IF NOT EXISTS idx_iom_nace ON industry_occupation_mapping(nace_division_code);
CREATE INDEX IF NOT EXISTS idx_iom_occupation ON industry_occupation_mapping(esco_occupation_uri);
CREATE INDEX IF NOT EXISTS idx_iom_core ON industry_occupation_mapping(is_core_occupation);

COMMENT ON TABLE industry_occupation_mapping IS 'Maps NACE industries to typical ESCO occupations with workforce distribution data';

-- =============================================================================
-- PHASE 7: Create Org Template Suggestions Table
-- =============================================================================

-- Pre-computed organizational templates by industry and company size
CREATE TABLE IF NOT EXISTS org_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nace_section_code CHAR(1) NOT NULL,
    nace_division_code VARCHAR(10),
    company_size_min INTEGER NOT NULL,
    company_size_max INTEGER NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    description TEXT,
    org_structure JSONB NOT NULL,  -- Hierarchical org structure
    recommended_roles JSONB NOT NULL,  -- Array of {occupation_uri, count, is_core, notes}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_size_range CHECK (company_size_min <= company_size_max)
);

CREATE INDEX IF NOT EXISTS idx_org_templates_nace ON org_templates(nace_section_code, nace_division_code);
CREATE INDEX IF NOT EXISTS idx_org_templates_size ON org_templates(company_size_min, company_size_max);

COMMENT ON TABLE org_templates IS 'Pre-computed organizational templates by industry and company size';

-- =============================================================================
-- PHASE 8: Create Cross-Entity Search Tracking
-- =============================================================================

-- Track cross-entity searches for analytics
CREATE TABLE IF NOT EXISTS cross_entity_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    entity_types TEXT[] NOT NULL,  -- ['skills', 'occupations', 'jobs', ...]
    results_count INTEGER,
    top_results JSONB,  -- Summary of top results per entity type
    search_duration_ms INTEGER,
    tenant_id UUID,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ces_tenant ON cross_entity_searches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ces_created ON cross_entity_searches(created_at DESC);

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
--
-- ALTER TABLE esco_occupations DROP COLUMN IF EXISTS embedding_en, DROP COLUMN IF EXISTS embedding_it, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE job_templates DROP COLUMN IF EXISTS embedding_en, DROP COLUMN IF EXISTS embedding_it, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE goals DROP COLUMN IF EXISTS embedding, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE courses DROP COLUMN IF EXISTS embedding_en, DROP COLUMN IF EXISTS embedding_it, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE nace_sections DROP COLUMN IF EXISTS embedding_en, DROP COLUMN IF EXISTS embedding_it, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE nace_divisions DROP COLUMN IF EXISTS embedding_en, DROP COLUMN IF EXISTS embedding_it, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE nace_groups DROP COLUMN IF EXISTS embedding_en, DROP COLUMN IF EXISTS embedding_it, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- DROP TABLE IF EXISTS industry_occupation_mapping;
-- DROP TABLE IF EXISTS org_templates;
-- DROP TABLE IF EXISTS cross_entity_searches;
