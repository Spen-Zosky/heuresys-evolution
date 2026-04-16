-- ============================================================================
-- Migration: 017_ontology_foundation.sql
-- Description: Ontology Foundation Layer - Adds semantic capabilities to ESCO skills
-- Epic: E-ONTO-01
-- Story: S-ONTO-01-01
-- Spec: ONTO-SPEC-001
-- Created: 2025-12-22
-- ============================================================================

-- Prerequisites: pgvector extension must be enabled
-- Note: Extension was enabled in FASE 0 preparation

-- ============================================================================
-- PART 1: Add vector embeddings to existing esco_skills table
-- ============================================================================

-- Add embedding columns for semantic search (non-breaking, nullable)
ALTER TABLE esco_skills
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_it vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN esco_skills.embedding_en IS 'OpenAI ada-002 compatible embedding for English text';
COMMENT ON COLUMN esco_skills.embedding_it IS 'OpenAI ada-002 compatible embedding for Italian text';
COMMENT ON COLUMN esco_skills.embedding_model IS 'Model version used to generate embedding';
COMMENT ON COLUMN esco_skills.embedding_generated_at IS 'Timestamp when embedding was last generated';

-- ============================================================================
-- PART 2: Create ontology skill categories (enhanced hierarchy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ontology_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES ontology_categories(id),

    code VARCHAR(50) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_it VARCHAR(255),
    description_en TEXT,
    description_it TEXT,

    -- Hierarchy level (0 = root, 1 = domain, 2 = subdomain, etc.)
    level INTEGER NOT NULL DEFAULT 0,

    -- External mappings
    esco_pillar VARCHAR(100),
    isced_field VARCHAR(20),

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ontology_categories_code_unique UNIQUE(code)
);

COMMENT ON TABLE ontology_categories IS 'Hierarchical categories for ontology skill organization';

CREATE INDEX IF NOT EXISTS idx_ontology_categories_parent ON ontology_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_ontology_categories_level ON ontology_categories(level);
CREATE INDEX IF NOT EXISTS idx_ontology_categories_active ON ontology_categories(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 3: Create KSABA dimensions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ontology_skill_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- KSABA dimension type
    dimension_type VARCHAR(20) NOT NULL CHECK (dimension_type IN ('knowledge', 'skill', 'ability', 'behavior', 'attitude')),

    -- Content
    description_en TEXT,
    description_it TEXT,

    -- Assessment scale
    level_scale VARCHAR(50) DEFAULT 'basic_to_expert',
    min_level INTEGER DEFAULT 1,
    max_level INTEGER DEFAULT 5,

    -- Semantic embedding for this dimension
    embedding vector(1536),
    embedding_model VARCHAR(100),

    -- Metadata
    is_primary BOOLEAN DEFAULT false,  -- Is this the primary dimension for the skill?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ontology_dimensions_unique UNIQUE(esco_skill_id, dimension_type)
);

COMMENT ON TABLE ontology_skill_dimensions IS 'KSABA (Knowledge, Skill, Ability, Behavior, Attitude) dimensions for each skill';

CREATE INDEX IF NOT EXISTS idx_ontology_dimensions_skill ON ontology_skill_dimensions(esco_skill_id);
CREATE INDEX IF NOT EXISTS idx_ontology_dimensions_type ON ontology_skill_dimensions(dimension_type);
CREATE INDEX IF NOT EXISTS idx_ontology_dimensions_primary ON ontology_skill_dimensions(is_primary) WHERE is_primary = true;

-- ============================================================================
-- PART 4: Create enhanced skill relations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ontology_skill_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    target_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- Relation type
    relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('requires', 'enables', 'related_to', 'part_of', 'supersedes', 'similar_to', 'complementary')),

    -- Relation strength (0.00 to 1.00)
    strength DECIMAL(3,2) DEFAULT 1.00 CHECK (strength >= 0 AND strength <= 1),

    -- Context where this relation applies
    context VARCHAR(255),

    -- Provenance
    source VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (source IN ('esco', 'onet', 'manual', 'ai_inferred', 'user_feedback')),
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),

    -- For AI-inferred relations
    model_version VARCHAR(100),
    inference_date TIMESTAMPTZ,

    -- Approval status for inferred relations
    approval_status VARCHAR(20) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ontology_relations_unique UNIQUE(source_skill_id, target_skill_id, relation_type)
);

COMMENT ON TABLE ontology_skill_relations IS 'Semantic relations between skills for ontology reasoning';

CREATE INDEX IF NOT EXISTS idx_ontology_relations_source ON ontology_skill_relations(source_skill_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_target ON ontology_skill_relations(target_skill_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_type ON ontology_skill_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_pending ON ontology_skill_relations(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ontology_relations_inferred ON ontology_skill_relations(source) WHERE source = 'ai_inferred';

-- ============================================================================
-- PART 5: Create tenant-specific custom skills table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_custom_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identity
    code VARCHAR(100) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_it VARCHAR(255),

    -- Classification (maps to KSABA primary type)
    skill_type VARCHAR(50) NOT NULL CHECK (skill_type IN ('knowledge', 'skill', 'ability', 'behavior', 'attitude', 'competence')),

    -- Content
    description_en TEXT,
    description_it TEXT,

    -- Optional link to base ontology skill (for extensions)
    base_esco_skill_id UUID REFERENCES esco_skills(id),

    -- Category
    category_id UUID REFERENCES ontology_categories(id),

    -- Embeddings
    embedding_en vector(1536),
    embedding_it vector(1536),
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMPTZ,

    -- Versioning
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES tenant_custom_skills(id),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    CONSTRAINT tenant_skills_code_unique UNIQUE(tenant_id, code)
);

COMMENT ON TABLE tenant_custom_skills IS 'Tenant-specific custom skills that extend the base ontology';

CREATE INDEX IF NOT EXISTS idx_tenant_skills_tenant ON tenant_custom_skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_skills_base ON tenant_custom_skills(base_esco_skill_id);
CREATE INDEX IF NOT EXISTS idx_tenant_skills_category ON tenant_custom_skills(category_id);
CREATE INDEX IF NOT EXISTS idx_tenant_skills_active ON tenant_custom_skills(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 6: Create KSABA dimensions for tenant custom skills
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_skill_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_skill_id UUID NOT NULL REFERENCES tenant_custom_skills(id) ON DELETE CASCADE,

    dimension_type VARCHAR(20) NOT NULL CHECK (dimension_type IN ('knowledge', 'skill', 'ability', 'behavior', 'attitude')),

    description_en TEXT,
    description_it TEXT,

    level_scale VARCHAR(50) DEFAULT 'basic_to_expert',
    min_level INTEGER DEFAULT 1,
    max_level INTEGER DEFAULT 5,

    embedding vector(1536),

    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT tenant_dimensions_unique UNIQUE(tenant_skill_id, dimension_type)
);

CREATE INDEX IF NOT EXISTS idx_tenant_dimensions_skill ON tenant_skill_dimensions(tenant_skill_id);

-- ============================================================================
-- PART 7: Create vector indexes for similarity search
-- ============================================================================

-- IVFFlat indexes for esco_skills embeddings
CREATE INDEX IF NOT EXISTS idx_esco_skills_embedding_en
ON esco_skills USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 100)
WHERE embedding_en IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_esco_skills_embedding_it
ON esco_skills USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 100)
WHERE embedding_it IS NOT NULL;

-- IVFFlat indexes for tenant custom skills
CREATE INDEX IF NOT EXISTS idx_tenant_skills_embedding_en
ON tenant_custom_skills USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 50)
WHERE embedding_en IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_skills_embedding_it
ON tenant_custom_skills USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 50)
WHERE embedding_it IS NOT NULL;

-- IVFFlat indexes for dimensions
CREATE INDEX IF NOT EXISTS idx_ontology_dimensions_embedding
ON ontology_skill_dimensions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- ============================================================================
-- PART 8: Create embedding generation tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ontology_embedding_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job scope
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('full', 'incremental', 'skill_specific', 'tenant_specific')),
    target_table VARCHAR(100) NOT NULL,
    tenant_id UUID REFERENCES tenants(id),

    -- Progress tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,

    -- Provider info
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,

    -- Cost tracking
    tokens_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,4),

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error handling
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON ontology_embedding_jobs(status);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_tenant ON ontology_embedding_jobs(tenant_id);

-- ============================================================================
-- PART 9: Create inference tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ontology_inference_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('full_inference', 'incremental', 'skill_specific')),

    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    total_pairs INTEGER,
    processed_pairs INTEGER DEFAULT 0,
    relations_found INTEGER DEFAULT 0,

    -- Configuration
    similarity_threshold DECIMAL(3,2) DEFAULT 0.75,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inference_jobs_status ON ontology_inference_jobs(status);

-- ============================================================================
-- PART 10: Seed initial ontology categories from ESCO pillars
-- ============================================================================

INSERT INTO ontology_categories (code, name_en, name_it, level, esco_pillar, description_en)
VALUES
    ('SKILLS', 'Skills', 'Competenze', 0, 'skill', 'Technical and professional skills'),
    ('KNOWLEDGE', 'Knowledge', 'Conoscenze', 0, 'knowledge', 'Theoretical and practical knowledge domains'),
    ('ATTITUDES', 'Attitudes & Values', 'Attitudini e Valori', 0, 'attitude', 'Personal attitudes, work styles, and values'),
    ('TRANSVERSAL', 'Transversal Skills', 'Competenze Trasversali', 0, 'transversal', 'Cross-cutting skills applicable across domains'),
    ('DIGITAL', 'Digital Skills', 'Competenze Digitali', 1, 'skill', 'Technology and digital competencies'),
    ('GREEN', 'Green Skills', 'Competenze Verdi', 1, 'skill', 'Environmental and sustainability competencies'),
    ('COMMUNICATION', 'Communication', 'Comunicazione', 1, 'skill', 'Verbal, written, and interpersonal communication'),
    ('MANAGEMENT', 'Management', 'Gestione', 1, 'skill', 'Leadership and management competencies'),
    ('ANALYTICAL', 'Analytical & Problem Solving', 'Analisi e Problem Solving', 1, 'skill', 'Critical thinking and analytical skills')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Record migration execution
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
        CREATE TABLE schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    INSERT INTO schema_migrations (version) VALUES ('017_ontology_foundation')
    ON CONFLICT (version) DO NOTHING;
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (save as 017_ontology_foundation_rollback.sql)
-- ============================================================================
/*
-- To rollback this migration, execute the following:

DROP TABLE IF EXISTS ontology_inference_jobs CASCADE;
DROP TABLE IF EXISTS ontology_embedding_jobs CASCADE;
DROP TABLE IF EXISTS tenant_skill_dimensions CASCADE;
DROP TABLE IF EXISTS tenant_custom_skills CASCADE;
DROP TABLE IF EXISTS ontology_skill_relations CASCADE;
DROP TABLE IF EXISTS ontology_skill_dimensions CASCADE;
DROP TABLE IF EXISTS ontology_categories CASCADE;

ALTER TABLE esco_skills
DROP COLUMN IF EXISTS embedding_en,
DROP COLUMN IF EXISTS embedding_it,
DROP COLUMN IF EXISTS embedding_model,
DROP COLUMN IF EXISTS embedding_generated_at;

DELETE FROM schema_migrations WHERE version = '017_ontology_foundation';
*/
