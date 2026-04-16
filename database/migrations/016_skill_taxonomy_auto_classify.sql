-- =============================================================================
-- Migration 016: Auto-Classification of ESCO Skills
-- =============================================================================
-- Applies rule-based classification to all 254 ESCO skills
-- Uses ESCO properties (skill_type, reuse_level, is_digital, is_green)
-- and description keyword analysis to determine classifications
-- =============================================================================

-- =============================================================================
-- PART 1: RULE-BASED CLASSIFICATION
-- =============================================================================

-- Insert classifications for all ESCO skills using rule-based logic
INSERT INTO skill_classifications (
    esco_skill_id,
    primary_category,
    primary_category_confidence,
    cognitive_level,
    social_dimension,
    transferability,
    transferability_score,
    skill_cluster_id,
    classification_source,
    needs_review,
    classified_at
)
SELECT
    es.id AS esco_skill_id,

    -- PRIMARY CATEGORY (Hard/Soft/Hybrid)
    CASE
        -- Strong Hard Skill indicators
        WHEN es.skill_type = 'knowledge' THEN 'hard'
        WHEN es.is_digital = true THEN 'hard'
        WHEN LOWER(es.preferred_label) ~ '(programming|coding|software|engineering|technical|database|network|system|server|cloud|security|develop|infrastructure)' THEN 'hard'
        WHEN LOWER(es.description) ~ '(programming|coding|software|engineering|technical|database|network|system|server|cloud|security|develop|infrastructure)' THEN 'hard'

        -- Strong Soft Skill indicators
        WHEN es.reuse_level = 'transversal' AND es.skill_type = 'competence' THEN 'soft'
        WHEN LOWER(es.preferred_label) ~ '(communication|leadership|teamwork|collaboration|negotiation|interpersonal|emotional|empathy|listening|presentation|coaching|mentoring)' THEN 'soft'
        WHEN LOWER(es.description) ~ '(communication|leadership|teamwork|collaboration|negotiation|interpersonal|emotional|empathy|listening|presentation|coaching|mentoring)' THEN 'soft'

        -- Mixed indicators = Hybrid
        WHEN es.reuse_level = 'cross-sectoral' THEN 'hybrid'
        WHEN es.skill_type = 'competence' AND es.reuse_level = 'sector-specific' THEN 'hybrid'

        -- Default based on skill_type
        WHEN es.skill_type = 'skill' THEN 'hard'
        WHEN es.skill_type = 'competence' THEN 'soft'
        ELSE 'hybrid'
    END AS primary_category,

    -- CONFIDENCE SCORE
    CASE
        -- High confidence for clear indicators
        WHEN es.is_digital = true THEN 0.90
        WHEN es.skill_type = 'knowledge' THEN 0.85
        WHEN es.reuse_level = 'transversal' AND es.skill_type = 'competence' THEN 0.85
        WHEN LOWER(es.preferred_label) ~ '(programming|coding|communication|leadership)' THEN 0.80
        -- Medium confidence for derived classifications
        WHEN es.reuse_level = 'cross-sectoral' THEN 0.70
        WHEN es.reuse_level = 'sector-specific' THEN 0.65
        -- Lower confidence for defaults
        ELSE 0.60
    END AS primary_category_confidence,

    -- COGNITIVE LEVEL (Bloom's Taxonomy)
    CASE
        -- Level 4: Create (Strategic)
        WHEN LOWER(es.description) ~ '(design|develop|create|innovate|strateg|architect|build|invent|formulate|compose)' THEN 4
        WHEN LOWER(es.preferred_label) ~ '(design|develop|architect|strateg|innovate)' THEN 4

        -- Level 3: Analyze/Evaluate (Advanced)
        WHEN LOWER(es.description) ~ '(analy[sz]|evaluat|assess|diagnos|troubleshoot|investigate|audit|inspect|review|critique)' THEN 3
        WHEN LOWER(es.preferred_label) ~ '(analy|evaluat|assess|troubleshoot|review)' THEN 3

        -- Level 2: Apply (Operational)
        WHEN LOWER(es.description) ~ '(apply|implement|execut|operat|use|perform|demonstrat|employ|utiliz|practice)' THEN 2
        WHEN LOWER(es.preferred_label) ~ '(operat|implement|execut|use|perform)' THEN 2

        -- Level 1: Remember/Understand (Foundational)
        WHEN LOWER(es.description) ~ '(basic|fundamental|understand|know|recogni[sz]e|identify|aware|comprehend|recall)' THEN 1
        WHEN es.skill_type = 'knowledge' THEN 1

        -- Default: Apply (most skills are operational)
        ELSE 2
    END AS cognitive_level,

    -- SOCIAL DIMENSION (DOMASEC)
    CASE
        -- Intrapersonal (self-management)
        WHEN LOWER(es.preferred_label) ~ '(self-|personal|emotional|resilience|stress|time management|organization|motivation|adaptab)' THEN 'intrapersonal'
        WHEN LOWER(es.description) ~ '(self-|personal development|emotional intelligence|resilience|stress management)' THEN 'intrapersonal'

        -- Interpersonal (people interaction)
        WHEN LOWER(es.preferred_label) ~ '(team|communicat|leadership|negotiat|collaborat|relationship|present|coach|mentor|influenc)' THEN 'interpersonal'
        WHEN LOWER(es.description) ~ '(team|communicat|leadership|negotiat|collaborat|relationship|others|people)' THEN 'interpersonal'

        -- Task-Oriented (execution focus)
        ELSE 'task_oriented'
    END AS social_dimension,

    -- TRANSFERABILITY
    CASE
        WHEN es.reuse_level = 'transversal' THEN 'transferable'
        WHEN es.reuse_level = 'cross-sectoral' THEN 'adjacent'
        WHEN es.reuse_level IN ('sector-specific', 'occupation-specific') THEN 'specialized'
        -- Default based on skill type
        WHEN es.skill_type = 'competence' THEN 'transferable'
        WHEN es.skill_type = 'knowledge' THEN 'adjacent'
        ELSE 'specialized'
    END AS transferability,

    -- TRANSFERABILITY SCORE (0-1)
    CASE
        WHEN es.reuse_level = 'transversal' THEN 0.95
        WHEN es.reuse_level = 'cross-sectoral' THEN 0.70
        WHEN es.reuse_level = 'sector-specific' THEN 0.40
        WHEN es.reuse_level = 'occupation-specific' THEN 0.20
        ELSE 0.50
    END AS transferability_score,

    -- SKILL CLUSTER (based on keywords)
    CASE
        -- Technology & Development
        WHEN LOWER(es.preferred_label) ~ '(programming|coding|software|web|mobile|database|cloud|devops|security|network|IT|computer|system|data engineer)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV')
        WHEN es.is_digital = true AND es.skill_type = 'skill' THEN
            (SELECT id FROM skill_clusters WHERE code = 'TECH-DEV')

        -- Data & Analytics
        WHEN LOWER(es.preferred_label) ~ '(data|analy|statistic|machine learning|AI|business intelligence|visuali[sz]ation)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'DATA-ANA')

        -- Business & Management
        WHEN LOWER(es.preferred_label) ~ '(management|strateg|project|business|planning|organi[sz]ation|leadership)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'BUS-MGT')

        -- Communication & Interpersonal
        WHEN LOWER(es.preferred_label) ~ '(communicat|presentation|negotiat|teamwork|collaborat|interpersonal)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'COMM-INT')

        -- Finance & Accounting
        WHEN LOWER(es.preferred_label) ~ '(financ|account|budget|audit|tax|treasury|investment)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'FIN-ACC')

        -- Human Resources
        WHEN LOWER(es.preferred_label) ~ '(human resource|HR|recruit|talent|training|learning|development|performance)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'HR-PPL')

        -- Operations & Logistics
        WHEN LOWER(es.preferred_label) ~ '(operation|logistics|supply chain|process|quality|lean|manufacturing)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'OPS-LOG')

        -- Sales & Marketing
        WHEN LOWER(es.preferred_label) ~ '(sales|marketing|customer|brand|digital marketing|SEO|social media)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'SALES-MKT')

        -- Legal & Compliance
        WHEN LOWER(es.preferred_label) ~ '(legal|compliance|regulatory|risk|governance|contract|law)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'LEGAL-COMP')

        -- Creative & Design
        WHEN LOWER(es.preferred_label) ~ '(design|creative|UX|UI|graphic|visual|art)' THEN
            (SELECT id FROM skill_clusters WHERE code = 'CREATIVE')

        ELSE NULL
    END AS skill_cluster_id,

    'rule_based' AS classification_source,

    -- Flag for review if confidence is low
    CASE
        WHEN es.reuse_level IS NULL THEN true
        WHEN es.skill_type IS NULL THEN true
        ELSE false
    END AS needs_review,

    NOW() AS classified_at

FROM esco_skills es
WHERE NOT EXISTS (
    SELECT 1 FROM skill_classifications sc WHERE sc.esco_skill_id = es.id
);

-- =============================================================================
-- PART 2: POPULATE SKILL RELATIONSHIPS FROM ESCO HIERARCHY
-- =============================================================================

-- Create "builds_on" relationships from ESCO broader_uri
INSERT INTO skill_relationships (source_skill_id, target_skill_id, relationship_type, relationship_strength, relationship_source)
SELECT
    child.id AS source_skill_id,
    parent.id AS target_skill_id,
    'builds_on' AS relationship_type,
    0.80 AS relationship_strength,
    'esco_hierarchy' AS relationship_source
FROM esco_skills child
INNER JOIN esco_skills parent ON child.broader_uri = parent.uri
WHERE child.broader_uri IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM skill_relationships sr
    WHERE sr.source_skill_id = child.id
    AND sr.target_skill_id = parent.id
    AND sr.relationship_type = 'builds_on'
);

-- Create "complementary" relationships from ESCO related_uris
-- This requires parsing the JSONB array
DO $$
DECLARE
    r RECORD;
    related_uri TEXT;
    related_skill_id UUID;
BEGIN
    FOR r IN
        SELECT es.id AS skill_id, jsonb_array_elements_text(es.related_uris) AS related_uri
        FROM esco_skills es
        WHERE es.related_uris IS NOT NULL AND es.related_uris != '[]'::jsonb
    LOOP
        -- Find the related skill
        SELECT id INTO related_skill_id
        FROM esco_skills
        WHERE uri = r.related_uri;

        IF related_skill_id IS NOT NULL AND r.skill_id != related_skill_id THEN
            INSERT INTO skill_relationships (source_skill_id, target_skill_id, relationship_type, relationship_strength, is_bidirectional, relationship_source)
            VALUES (r.skill_id, related_skill_id, 'complementary', 0.60, true, 'esco_hierarchy')
            ON CONFLICT (source_skill_id, target_skill_id, relationship_type) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- PART 3: CALCULATE INITIAL ADJACENCIES (based on cluster membership)
-- =============================================================================

-- Create adjacencies for skills in the same cluster
INSERT INTO skill_adjacencies (skill_id, adjacent_skill_id, adjacency_score, adjacency_type)
SELECT DISTINCT
    sc1.esco_skill_id AS skill_id,
    sc2.esco_skill_id AS adjacent_skill_id,
    0.70 AS adjacency_score,  -- Same cluster = high adjacency
    'domain' AS adjacency_type
FROM skill_classifications sc1
INNER JOIN skill_classifications sc2
    ON sc1.skill_cluster_id = sc2.skill_cluster_id
    AND sc1.esco_skill_id < sc2.esco_skill_id  -- Avoid duplicates and self-refs
WHERE sc1.skill_cluster_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM skill_adjacencies sa
    WHERE sa.skill_id = sc1.esco_skill_id
    AND sa.adjacent_skill_id = sc2.esco_skill_id
);

-- Also insert reverse direction
INSERT INTO skill_adjacencies (skill_id, adjacent_skill_id, adjacency_score, adjacency_type)
SELECT DISTINCT
    sc2.esco_skill_id AS skill_id,
    sc1.esco_skill_id AS adjacent_skill_id,
    0.70 AS adjacency_score,
    'domain' AS adjacency_type
FROM skill_classifications sc1
INNER JOIN skill_classifications sc2
    ON sc1.skill_cluster_id = sc2.skill_cluster_id
    AND sc1.esco_skill_id < sc2.esco_skill_id
WHERE sc1.skill_cluster_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM skill_adjacencies sa
    WHERE sa.skill_id = sc2.esco_skill_id
    AND sa.adjacent_skill_id = sc1.esco_skill_id
);

-- =============================================================================
-- PART 4: VERIFICATION AND STATISTICS
-- =============================================================================

DO $$
DECLARE
    v_total_skills INTEGER;
    v_classified INTEGER;
    v_hard INTEGER;
    v_soft INTEGER;
    v_hybrid INTEGER;
    v_needs_review INTEGER;
    v_relationships INTEGER;
    v_adjacencies INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_skills FROM esco_skills;
    SELECT COUNT(*) INTO v_classified FROM skill_classifications;
    SELECT COUNT(*) INTO v_hard FROM skill_classifications WHERE primary_category = 'hard';
    SELECT COUNT(*) INTO v_soft FROM skill_classifications WHERE primary_category = 'soft';
    SELECT COUNT(*) INTO v_hybrid FROM skill_classifications WHERE primary_category = 'hybrid';
    SELECT COUNT(*) INTO v_needs_review FROM skill_classifications WHERE needs_review = true;
    SELECT COUNT(*) INTO v_relationships FROM skill_relationships;
    SELECT COUNT(*) INTO v_adjacencies FROM skill_adjacencies;

    RAISE NOTICE '=== SKILL TAXONOMY AUTO-CLASSIFICATION COMPLETE ===';
    RAISE NOTICE 'Total ESCO Skills: %', v_total_skills;
    RAISE NOTICE 'Classified Skills: %', v_classified;
    RAISE NOTICE '';
    RAISE NOTICE '=== CLASSIFICATION BREAKDOWN ===';
    RAISE NOTICE 'Hard Skills: %', v_hard;
    RAISE NOTICE 'Soft Skills: %', v_soft;
    RAISE NOTICE 'Hybrid Skills: %', v_hybrid;
    RAISE NOTICE '';
    RAISE NOTICE 'Needs Human Review: %', v_needs_review;
    RAISE NOTICE '';
    RAISE NOTICE '=== RELATIONSHIPS & ADJACENCIES ===';
    RAISE NOTICE 'Skill Relationships: %', v_relationships;
    RAISE NOTICE 'Skill Adjacencies: %', v_adjacencies;
END $$;

-- Show classification statistics view
SELECT * FROM v_skill_classification_stats;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
