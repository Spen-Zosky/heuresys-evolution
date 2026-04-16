-- Migration: 019_core_hr_semantic_embeddings.sql
-- Description: Add semantic embedding columns to core HR entities (employees, departments, org_units, locations)
-- Author: Claude
-- Date: 2025-12-22
-- Epic: Semantic Intelligence Layer
-- Phase: 1 - Core HR Semantic

-- =============================================================================
-- PHASE 1.1: Employee Profile Embeddings
-- =============================================================================
-- Employee embeddings capture the semantic profile of each employee:
-- - Job title, skills, education, experience
-- - Used for: talent search, succession planning, skill matching

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS profile_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

-- Index for similarity search on employees
CREATE INDEX IF NOT EXISTS idx_employees_profile_embedding
ON employees USING ivfflat (profile_embedding vector_cosine_ops) WITH (lists = 30);

COMMENT ON COLUMN employees.profile_embedding IS 'Semantic embedding of employee profile (job title, skills, education, experience)';
COMMENT ON COLUMN employees.embedding_text_hash IS 'Hash of source text to detect changes requiring re-embedding';

-- =============================================================================
-- PHASE 1.2: Department Embeddings
-- =============================================================================
-- Department embeddings capture the semantic identity of each department:
-- - Name, description, function
-- - Used for: org search, department matching, reporting context

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_departments_embedding
ON departments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON COLUMN departments.embedding IS 'Semantic embedding of department name and description';

-- =============================================================================
-- PHASE 1.3: Org Unit Embeddings
-- =============================================================================
-- Org unit embeddings capture the hierarchical organizational context:
-- - Name, type, level, parent context
-- - Used for: org chart search, structural analysis

ALTER TABLE org_units
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_org_units_embedding
ON org_units USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON COLUMN org_units.embedding IS 'Semantic embedding of org unit name and hierarchical context';

-- =============================================================================
-- PHASE 1.4: Location Embeddings
-- =============================================================================
-- Location embeddings capture geographic and functional context:
-- - Name, address, city, type
-- - Used for: location search, geographic analysis

ALTER TABLE locations
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_text_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_locations_embedding
ON locations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

COMMENT ON COLUMN locations.embedding IS 'Semantic embedding of location name and address';

-- =============================================================================
-- PHASE 1.5: Unified Semantic Entity Index
-- =============================================================================
-- Central index for cross-entity semantic search
-- Stores entity references with their embeddings for unified queries

CREATE TABLE IF NOT EXISTS semantic_entity_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'employee', 'department', 'org_unit', 'location', 'goal', 'skill', etc.
    entity_id UUID NOT NULL,
    entity_name VARCHAR(500), -- Human-readable name for display
    entity_context TEXT, -- Additional context (department, location, etc.)
    embedding vector(1536) NOT NULL,
    embedding_model VARCHAR(100),
    embedding_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- Additional searchable metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uk_semantic_entity UNIQUE (tenant_id, entity_type, entity_id)
);

-- Index for cross-entity semantic search
CREATE INDEX IF NOT EXISTS idx_semantic_entity_embedding
ON semantic_entity_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for filtering by entity type
CREATE INDEX IF NOT EXISTS idx_semantic_entity_type
ON semantic_entity_index(tenant_id, entity_type);

-- Index for active entities
CREATE INDEX IF NOT EXISTS idx_semantic_entity_active
ON semantic_entity_index(tenant_id, is_active) WHERE is_active = TRUE;

COMMENT ON TABLE semantic_entity_index IS 'Unified semantic index for cross-entity search across all HR entities';

-- =============================================================================
-- PHASE 1.6: Semantic Search Log (Analytics)
-- =============================================================================
-- Track semantic searches for analytics and improvement

CREATE TABLE IF NOT EXISTS semantic_search_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    entity_types TEXT[], -- Which entity types were searched
    filters JSONB, -- Applied filters
    results_count INTEGER,
    top_results JSONB, -- Summary of top results
    search_duration_ms INTEGER,
    feedback_score INTEGER, -- Optional user feedback (1-5)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semantic_search_log_tenant
ON semantic_search_log(tenant_id, created_at DESC);

COMMENT ON TABLE semantic_search_log IS 'Analytics log for semantic search queries';

-- =============================================================================
-- PHASE 1.7: Entity Relationships for Graph Traversal
-- =============================================================================
-- Track semantic relationships between entities for graph-based queries

CREATE TABLE IF NOT EXISTS semantic_entity_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_entity_type VARCHAR(50) NOT NULL,
    source_entity_id UUID NOT NULL,
    target_entity_type VARCHAR(50) NOT NULL,
    target_entity_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL, -- 'manages', 'belongs_to', 'has_skill', 'completed_course', etc.
    relation_strength NUMERIC(3,2) DEFAULT 1.0, -- 0.0 to 1.0
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uk_semantic_relation UNIQUE (tenant_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_semantic_relations_source
ON semantic_entity_relations(tenant_id, source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_semantic_relations_target
ON semantic_entity_relations(tenant_id, target_entity_type, target_entity_id);

COMMENT ON TABLE semantic_entity_relations IS 'Graph of relationships between semantic entities for traversal queries';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration:
--
-- ALTER TABLE employees DROP COLUMN IF EXISTS profile_embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE departments DROP COLUMN IF EXISTS embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE org_units DROP COLUMN IF EXISTS embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- ALTER TABLE locations DROP COLUMN IF EXISTS embedding, DROP COLUMN IF EXISTS embedding_text_hash, DROP COLUMN IF EXISTS embedding_model, DROP COLUMN IF EXISTS embedding_generated_at;
-- DROP TABLE IF EXISTS semantic_entity_index;
-- DROP TABLE IF EXISTS semantic_search_log;
-- DROP TABLE IF EXISTS semantic_entity_relations;
