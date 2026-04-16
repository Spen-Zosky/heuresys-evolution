-- =============================================================================
-- Migration 014: Enhanced Skills Taxonomy
-- =============================================================================
-- Extends ESCO taxonomy with modern skill classifications:
-- - Hard/Soft/Hybrid skills (Primary Category)
-- - Cognitive Levels (Bloom's Revised Taxonomy)
-- - Social Dimension (DOMASEC Framework)
-- - Transferability Classification
-- - Skill Clusters/Families
-- - Skill Relationships and Adjacencies
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- PART 1: SKILL CLUSTERS (Families/Groups)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name_en VARCHAR(200) NOT NULL,
    name_it VARCHAR(200),
    description TEXT,

    -- Hierarchy support
    parent_cluster_id UUID REFERENCES skill_clusters(id) ON DELETE SET NULL,
    cluster_level INTEGER DEFAULT 1 CHECK (cluster_level BETWEEN 1 AND 3),
    -- 1 = Family (e.g., "Technology & Development")
    -- 2 = SubFamily (e.g., "Programming & Software Development")
    -- 3 = Group (e.g., "Web Development")

    -- Career/Industry relevance
    career_path_codes TEXT[],
    industry_codes TEXT[],  -- NACE section codes

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for skill_clusters
CREATE INDEX IF NOT EXISTS idx_skill_clusters_parent ON skill_clusters(parent_cluster_id);
CREATE INDEX IF NOT EXISTS idx_skill_clusters_level ON skill_clusters(cluster_level);
CREATE INDEX IF NOT EXISTS idx_skill_clusters_active ON skill_clusters(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_skill_clusters_career ON skill_clusters USING gin(career_path_codes);
CREATE INDEX IF NOT EXISTS idx_skill_clusters_industry ON skill_clusters USING gin(industry_codes);

-- =============================================================================
-- PART 2: SKILL CLASSIFICATIONS (Extended Classification Dimensions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- PRIMARY CATEGORY (Hard vs Soft vs Hybrid)
    primary_category VARCHAR(20) NOT NULL
        CHECK (primary_category IN ('hard', 'soft', 'hybrid')),
    primary_category_confidence DECIMAL(3,2) CHECK (primary_category_confidence BETWEEN 0 AND 1),

    -- COGNITIVE LEVEL (Bloom's Revised Taxonomy)
    cognitive_level INTEGER CHECK (cognitive_level BETWEEN 1 AND 4),
    -- 1 = Remember/Understand (Foundational)
    -- 2 = Apply (Operational)
    -- 3 = Analyze/Evaluate (Advanced)
    -- 4 = Create (Strategic)
    cognitive_level_label VARCHAR(30),

    -- SOCIAL DIMENSION (DOMASEC Framework)
    social_dimension VARCHAR(30)
        CHECK (social_dimension IN ('intrapersonal', 'interpersonal', 'task_oriented')),
    -- intrapersonal = Self-management, emotional intelligence, personal development
    -- interpersonal = Communication, teamwork, leadership, negotiation
    -- task_oriented = Planning, execution, quality focus, delivery

    -- TRANSFERABILITY
    transferability VARCHAR(20) NOT NULL DEFAULT 'transferable'
        CHECK (transferability IN ('specialized', 'adjacent', 'transferable')),
    -- specialized = Domain-specific, low transferability
    -- adjacent = Related domains, medium transferability
    -- transferable = Cross-industry, high transferability
    transferability_score DECIMAL(3,2) CHECK (transferability_score BETWEEN 0 AND 1),

    -- SKILL CLUSTER/FAMILY
    skill_cluster_id UUID REFERENCES skill_clusters(id) ON DELETE SET NULL,

    -- CLASSIFICATION METADATA
    classification_source VARCHAR(50) DEFAULT 'ai_assisted'
        CHECK (classification_source IN ('esco_derived', 'rule_based', 'ai_assisted', 'manual')),
    classified_by UUID REFERENCES users(id),
    classified_at TIMESTAMPTZ,
    needs_review BOOLEAN DEFAULT false,
    review_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_skill_classifications_esco UNIQUE(esco_skill_id)
);

-- Indexes for skill_classifications
CREATE INDEX IF NOT EXISTS idx_skill_class_esco ON skill_classifications(esco_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_class_category ON skill_classifications(primary_category);
CREATE INDEX IF NOT EXISTS idx_skill_class_cognitive ON skill_classifications(cognitive_level);
CREATE INDEX IF NOT EXISTS idx_skill_class_social ON skill_classifications(social_dimension);
CREATE INDEX IF NOT EXISTS idx_skill_class_transfer ON skill_classifications(transferability);
CREATE INDEX IF NOT EXISTS idx_skill_class_cluster ON skill_classifications(skill_cluster_id);
CREATE INDEX IF NOT EXISTS idx_skill_class_review ON skill_classifications(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_skill_class_source ON skill_classifications(classification_source);

-- =============================================================================
-- PART 3: SKILL RELATIONSHIPS (Prerequisites, Complementary, Substitution)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    target_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- Relationship type
    relationship_type VARCHAR(30) NOT NULL
        CHECK (relationship_type IN ('prerequisite', 'complementary', 'substitution', 'builds_on', 'enables')),
    -- prerequisite = Source skill required before learning target
    -- complementary = Skills work well together, enhance each other
    -- substitution = Skills can replace each other in certain contexts
    -- builds_on = Target skill extends/deepens source skill
    -- enables = Source skill enables learning target skill

    -- Relationship strength/confidence
    relationship_strength DECIMAL(3,2) DEFAULT 0.50
        CHECK (relationship_strength BETWEEN 0 AND 1),
    is_bidirectional BOOLEAN DEFAULT false,

    -- Context-specific info
    substitution_context TEXT,  -- For substitution: context where replacement is valid
    prerequisite_level INTEGER CHECK (prerequisite_level BETWEEN 1 AND 5),  -- Min proficiency needed

    -- Metadata
    relationship_source VARCHAR(50) DEFAULT 'ai_inferred'
        CHECK (relationship_source IN ('esco_hierarchy', 'ai_inferred', 'manual', 'cooccurrence')),
    validated_by UUID REFERENCES users(id),
    validated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_no_self_relationship CHECK (source_skill_id != target_skill_id),
    CONSTRAINT uq_skill_relationship UNIQUE(source_skill_id, target_skill_id, relationship_type)
);

-- Indexes for skill_relationships
CREATE INDEX IF NOT EXISTS idx_skill_rel_source ON skill_relationships(source_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_rel_target ON skill_relationships(target_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_rel_type ON skill_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_skill_rel_strength ON skill_relationships(relationship_strength DESC);
CREATE INDEX IF NOT EXISTS idx_skill_rel_bidirectional ON skill_relationships(is_bidirectional) WHERE is_bidirectional = true;

-- =============================================================================
-- PART 4: SKILL ADJACENCIES (Career Path Proximity)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_adjacencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    adjacent_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,

    -- Adjacency metrics
    adjacency_score DECIMAL(4,3) NOT NULL CHECK (adjacency_score BETWEEN 0 AND 1),
    adjacency_type VARCHAR(30)
        CHECK (adjacency_type IN ('domain', 'competency', 'tool', 'method', 'career_path')),
    -- domain = Same knowledge domain
    -- competency = Similar competency area
    -- tool = Same tool/technology family
    -- method = Same methodology
    -- career_path = Common in career transitions

    -- Co-occurrence data
    job_posting_cooccurrence INTEGER DEFAULT 0,  -- # job postings with both skills
    employee_cooccurrence INTEGER DEFAULT 0,      -- # employees with both skills

    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_no_self_adjacency CHECK (skill_id != adjacent_skill_id),
    CONSTRAINT uq_skill_adjacency UNIQUE(skill_id, adjacent_skill_id)
);

-- Indexes for skill_adjacencies
CREATE INDEX IF NOT EXISTS idx_skill_adj_skill ON skill_adjacencies(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_adj_adjacent ON skill_adjacencies(adjacent_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_adj_score ON skill_adjacencies(adjacency_score DESC);
CREATE INDEX IF NOT EXISTS idx_skill_adj_type ON skill_adjacencies(adjacency_type);
CREATE INDEX IF NOT EXISTS idx_skill_adj_cooccur ON skill_adjacencies(job_posting_cooccurrence DESC);

-- =============================================================================
-- PART 5: ALTER EXISTING TABLES
-- =============================================================================

-- 5.1 Extend esco_skills with convenience columns
ALTER TABLE esco_skills
    ADD COLUMN IF NOT EXISTS primary_category VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cognitive_level INTEGER,
    ADD COLUMN IF NOT EXISTS is_classified BOOLEAN DEFAULT false;

ALTER TABLE esco_skills
    ADD CONSTRAINT IF NOT EXISTS ck_esco_primary_category
        CHECK (primary_category IS NULL OR primary_category IN ('hard', 'soft', 'hybrid'));
ALTER TABLE esco_skills
    ADD CONSTRAINT IF NOT EXISTS ck_esco_cognitive_level
        CHECK (cognitive_level IS NULL OR cognitive_level BETWEEN 1 AND 4);

-- 5.2 Extend job_skills with classification columns
ALTER TABLE job_skills
    ADD COLUMN IF NOT EXISTS primary_category VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cognitive_level INTEGER,
    ADD COLUMN IF NOT EXISTS transferability VARCHAR(20),
    ADD COLUMN IF NOT EXISTS skill_cluster_id UUID;

ALTER TABLE job_skills
    ADD CONSTRAINT IF NOT EXISTS ck_js_primary_category
        CHECK (primary_category IS NULL OR primary_category IN ('hard', 'soft', 'hybrid'));
ALTER TABLE job_skills
    ADD CONSTRAINT IF NOT EXISTS ck_js_cognitive_level
        CHECK (cognitive_level IS NULL OR cognitive_level BETWEEN 1 AND 4);
ALTER TABLE job_skills
    ADD CONSTRAINT IF NOT EXISTS ck_js_transferability
        CHECK (transferability IS NULL OR transferability IN ('specialized', 'adjacent', 'transferable'));

-- 5.3 Extend employee_skills with classification columns
ALTER TABLE employee_skills
    ADD COLUMN IF NOT EXISTS primary_category VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cognitive_level_achieved INTEGER,
    ADD COLUMN IF NOT EXISTS transferability_demonstrated VARCHAR(20);

ALTER TABLE employee_skills
    ADD CONSTRAINT IF NOT EXISTS ck_es_primary_category
        CHECK (primary_category IS NULL OR primary_category IN ('hard', 'soft', 'hybrid'));
ALTER TABLE employee_skills
    ADD CONSTRAINT IF NOT EXISTS ck_es_cognitive_level
        CHECK (cognitive_level_achieved IS NULL OR cognitive_level_achieved BETWEEN 1 AND 4);
ALTER TABLE employee_skills
    ADD CONSTRAINT IF NOT EXISTS ck_es_transferability
        CHECK (transferability_demonstrated IS NULL OR transferability_demonstrated IN ('specialized', 'adjacent', 'transferable'));

-- =============================================================================
-- PART 6: TRIGGERS AND FUNCTIONS
-- =============================================================================

-- 6.1 Function to sync classification to esco_skills
CREATE OR REPLACE FUNCTION sync_skill_classification_to_esco()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE esco_skills
    SET
        is_classified = true,
        primary_category = NEW.primary_category,
        cognitive_level = NEW.cognitive_level,
        updated_at = NOW()
    WHERE id = NEW.esco_skill_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_sync_skill_classification ON skill_classifications;
CREATE TRIGGER trg_sync_skill_classification
    AFTER INSERT OR UPDATE ON skill_classifications
    FOR EACH ROW EXECUTE FUNCTION sync_skill_classification_to_esco();

-- 6.2 Function to clear classification when deleted
CREATE OR REPLACE FUNCTION clear_skill_classification_from_esco()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE esco_skills
    SET
        is_classified = false,
        primary_category = NULL,
        cognitive_level = NULL,
        updated_at = NOW()
    WHERE id = OLD.esco_skill_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clear_skill_classification ON skill_classifications;
CREATE TRIGGER trg_clear_skill_classification
    AFTER DELETE ON skill_classifications
    FOR EACH ROW EXECUTE FUNCTION clear_skill_classification_from_esco();

-- 6.3 Function to get cognitive level label
CREATE OR REPLACE FUNCTION get_cognitive_level_label(level INTEGER)
RETURNS VARCHAR(30) AS $$
BEGIN
    RETURN CASE level
        WHEN 1 THEN 'Remember/Understand'
        WHEN 2 THEN 'Apply'
        WHEN 3 THEN 'Analyze/Evaluate'
        WHEN 4 THEN 'Create'
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6.4 Function to auto-set cognitive level label
CREATE OR REPLACE FUNCTION auto_set_cognitive_level_label()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cognitive_level IS NOT NULL AND NEW.cognitive_level_label IS NULL THEN
        NEW.cognitive_level_label := get_cognitive_level_label(NEW.cognitive_level);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_cognitive_label ON skill_classifications;
CREATE TRIGGER trg_auto_cognitive_label
    BEFORE INSERT OR UPDATE ON skill_classifications
    FOR EACH ROW EXECUTE FUNCTION auto_set_cognitive_level_label();

-- =============================================================================
-- PART 7: VIEWS FOR CONVENIENCE
-- =============================================================================

-- 7.1 View: Skills with full classification
CREATE OR REPLACE VIEW v_skills_classified AS
SELECT
    es.id,
    es.uri,
    es.preferred_label,
    es.description,
    es.skill_type AS esco_skill_type,
    es.reuse_level,
    es.is_digital,
    es.is_green,
    sc.primary_category,
    sc.primary_category_confidence,
    sc.cognitive_level,
    sc.cognitive_level_label,
    sc.social_dimension,
    sc.transferability,
    sc.transferability_score,
    sc.classification_source,
    sc.needs_review,
    skc.id AS cluster_id,
    skc.code AS cluster_code,
    skc.name_en AS cluster_name,
    skc.cluster_level
FROM esco_skills es
LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id
LEFT JOIN skill_clusters skc ON sc.skill_cluster_id = skc.id;

-- 7.2 View: Skill clusters with skill counts
CREATE OR REPLACE VIEW v_skill_clusters_summary AS
SELECT
    skc.id,
    skc.code,
    skc.name_en,
    skc.name_it,
    skc.cluster_level,
    skc.parent_cluster_id,
    parent.code AS parent_code,
    parent.name_en AS parent_name,
    COUNT(sc.id) AS skill_count,
    COUNT(sc.id) FILTER (WHERE sc.primary_category = 'hard') AS hard_skill_count,
    COUNT(sc.id) FILTER (WHERE sc.primary_category = 'soft') AS soft_skill_count,
    COUNT(sc.id) FILTER (WHERE sc.primary_category = 'hybrid') AS hybrid_skill_count
FROM skill_clusters skc
LEFT JOIN skill_clusters parent ON skc.parent_cluster_id = parent.id
LEFT JOIN skill_classifications sc ON skc.id = sc.skill_cluster_id
GROUP BY skc.id, skc.code, skc.name_en, skc.name_it, skc.cluster_level,
         skc.parent_cluster_id, parent.code, parent.name_en;

-- 7.3 View: Classification statistics
CREATE OR REPLACE VIEW v_skill_classification_stats AS
SELECT
    COUNT(*) AS total_skills,
    COUNT(sc.id) AS classified_skills,
    COUNT(*) - COUNT(sc.id) AS unclassified_skills,
    ROUND(100.0 * COUNT(sc.id) / NULLIF(COUNT(*), 0), 2) AS classification_percentage,
    COUNT(sc.id) FILTER (WHERE sc.primary_category = 'hard') AS hard_skills,
    COUNT(sc.id) FILTER (WHERE sc.primary_category = 'soft') AS soft_skills,
    COUNT(sc.id) FILTER (WHERE sc.primary_category = 'hybrid') AS hybrid_skills,
    COUNT(sc.id) FILTER (WHERE sc.cognitive_level = 1) AS cognitive_level_1,
    COUNT(sc.id) FILTER (WHERE sc.cognitive_level = 2) AS cognitive_level_2,
    COUNT(sc.id) FILTER (WHERE sc.cognitive_level = 3) AS cognitive_level_3,
    COUNT(sc.id) FILTER (WHERE sc.cognitive_level = 4) AS cognitive_level_4,
    COUNT(sc.id) FILTER (WHERE sc.social_dimension = 'intrapersonal') AS intrapersonal,
    COUNT(sc.id) FILTER (WHERE sc.social_dimension = 'interpersonal') AS interpersonal,
    COUNT(sc.id) FILTER (WHERE sc.social_dimension = 'task_oriented') AS task_oriented,
    COUNT(sc.id) FILTER (WHERE sc.transferability = 'specialized') AS specialized,
    COUNT(sc.id) FILTER (WHERE sc.transferability = 'adjacent') AS adjacent,
    COUNT(sc.id) FILTER (WHERE sc.transferability = 'transferable') AS transferable,
    COUNT(sc.id) FILTER (WHERE sc.needs_review = true) AS needs_review
FROM esco_skills es
LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id;

-- =============================================================================
-- PART 8: HELPER FUNCTIONS
-- =============================================================================

-- 8.1 Get all skills in a cluster including sub-clusters
CREATE OR REPLACE FUNCTION get_cluster_skills(p_cluster_id UUID)
RETURNS TABLE (
    skill_id UUID,
    preferred_label VARCHAR,
    primary_category VARCHAR,
    cognitive_level INTEGER,
    cluster_code VARCHAR,
    cluster_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE cluster_tree AS (
        SELECT id, code, name_en
        FROM skill_clusters
        WHERE id = p_cluster_id

        UNION ALL

        SELECT skc.id, skc.code, skc.name_en
        FROM skill_clusters skc
        INNER JOIN cluster_tree ct ON skc.parent_cluster_id = ct.id
    )
    SELECT
        es.id,
        es.preferred_label,
        sc.primary_category,
        sc.cognitive_level,
        ct.code,
        ct.name_en
    FROM esco_skills es
    INNER JOIN skill_classifications sc ON es.id = sc.esco_skill_id
    INNER JOIN cluster_tree ct ON sc.skill_cluster_id = ct.id;
END;
$$ LANGUAGE plpgsql;

-- 8.2 Get skill relationships graph
CREATE OR REPLACE FUNCTION get_skill_relationships_graph(
    p_skill_id UUID,
    p_depth INTEGER DEFAULT 2
)
RETURNS TABLE (
    source_id UUID,
    source_label VARCHAR,
    target_id UUID,
    target_label VARCHAR,
    relationship_type VARCHAR,
    relationship_strength DECIMAL,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE skill_graph AS (
        -- Base case: direct relationships
        SELECT
            sr.source_skill_id,
            es1.preferred_label AS source_label,
            sr.target_skill_id,
            es2.preferred_label AS target_label,
            sr.relationship_type,
            sr.relationship_strength,
            1 AS depth
        FROM skill_relationships sr
        INNER JOIN esco_skills es1 ON sr.source_skill_id = es1.id
        INNER JOIN esco_skills es2 ON sr.target_skill_id = es2.id
        WHERE sr.source_skill_id = p_skill_id OR sr.target_skill_id = p_skill_id

        UNION

        -- Recursive case: relationships of related skills
        SELECT
            sr.source_skill_id,
            es1.preferred_label,
            sr.target_skill_id,
            es2.preferred_label,
            sr.relationship_type,
            sr.relationship_strength,
            sg.depth + 1
        FROM skill_relationships sr
        INNER JOIN esco_skills es1 ON sr.source_skill_id = es1.id
        INNER JOIN esco_skills es2 ON sr.target_skill_id = es2.id
        INNER JOIN skill_graph sg ON (sr.source_skill_id = sg.target_id OR sr.target_skill_id = sg.source_id)
        WHERE sg.depth < p_depth
    )
    SELECT DISTINCT * FROM skill_graph;
END;
$$ LANGUAGE plpgsql;

-- 8.3 Get adjacent skills for career path
CREATE OR REPLACE FUNCTION get_career_path_adjacent_skills(
    p_skill_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    adjacent_skill_id UUID,
    adjacent_skill_label VARCHAR,
    adjacency_score DECIMAL,
    adjacency_type VARCHAR,
    primary_category VARCHAR,
    cognitive_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sa.adjacent_skill_id,
        es.preferred_label,
        sa.adjacency_score,
        sa.adjacency_type,
        sc.primary_category,
        sc.cognitive_level
    FROM skill_adjacencies sa
    INNER JOIN esco_skills es ON sa.adjacent_skill_id = es.id
    LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id
    WHERE sa.skill_id = p_skill_id
    ORDER BY sa.adjacency_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

COMMENT ON TABLE skill_clusters IS 'Skill families and groups for organizing ESCO skills';
COMMENT ON TABLE skill_classifications IS 'Extended classifications for ESCO skills (hard/soft, cognitive level, social dimension, transferability)';
COMMENT ON TABLE skill_relationships IS 'Relationships between skills (prerequisite, complementary, substitution, etc.)';
COMMENT ON TABLE skill_adjacencies IS 'Skill adjacency scores for career path analysis';

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 014_skill_taxonomy_enhancement.sql completed successfully';
    RAISE NOTICE 'Created tables: skill_clusters, skill_classifications, skill_relationships, skill_adjacencies';
    RAISE NOTICE 'Extended tables: esco_skills, job_skills, employee_skills';
    RAISE NOTICE 'Created views: v_skills_classified, v_skill_clusters_summary, v_skill_classification_stats';
END $$;
