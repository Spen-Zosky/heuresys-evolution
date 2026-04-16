-- Migration 140: Knowledge Graph Functions
-- Provides SQL functions for semantic skill search, gap analysis,
-- career transition planning, and occupation similarity.
-- Depends on: ESCO v1.2.1 data + pgvector embeddings (completed 2026-03-26)

BEGIN;

-- ============================================================================
-- 1. fn_find_similar_skills(skill_uri, language, threshold, max_results)
--    Find semantically similar skills using pgvector cosine similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_find_similar_skills(
    p_skill_uri VARCHAR(500),
    p_language VARCHAR(2) DEFAULT 'en',
    p_threshold FLOAT DEFAULT 0.3,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    skill_id UUID,
    uri VARCHAR(500),
    preferred_label VARCHAR(500),
    skill_type VARCHAR(50),
    reuse_level VARCHAR(50),
    similarity FLOAT
) AS $$
BEGIN
    IF p_language = 'it' THEN
        RETURN QUERY
        SELECT s2.id, s2.uri, s2.preferred_label_it, s2.skill_type, s2.reuse_level,
               (1 - (s2.embedding_it <=> s1.embedding_it))::FLOAT
        FROM esco_skills s1
        JOIN esco_skills s2 ON s2.id != s1.id
        WHERE s1.uri = p_skill_uri
          AND s2.embedding_it IS NOT NULL
          AND (1 - (s2.embedding_it <=> s1.embedding_it)) >= p_threshold
        ORDER BY s2.embedding_it <=> s1.embedding_it
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT s2.id, s2.uri, s2.preferred_label_en, s2.skill_type, s2.reuse_level,
               (1 - (s2.embedding_en <=> s1.embedding_en))::FLOAT
        FROM esco_skills s1
        JOIN esco_skills s2 ON s2.id != s1.id
        WHERE s1.uri = p_skill_uri
          AND s2.embedding_en IS NOT NULL
          AND (1 - (s2.embedding_en <=> s1.embedding_en)) >= p_threshold
        ORDER BY s2.embedding_en <=> s1.embedding_en
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 2. fn_find_matching_occupations(text_query, language, max_results)
--    Find occupations matching a natural language description
--    Uses a reference skill embedding as proxy for the query
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_find_matching_occupations(
    p_query_text VARCHAR(500),
    p_language VARCHAR(2) DEFAULT 'en',
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    occupation_id UUID,
    uri VARCHAR(500),
    preferred_label VARCHAR(500),
    isco_code VARCHAR(10),
    similarity FLOAT
) AS $$
DECLARE
    v_query_embedding vector(1536);
BEGIN
    -- Use the closest skill embedding as a proxy for the query
    -- (Real implementation would call OpenAI API for query embedding)
    IF p_language = 'it' THEN
        SELECT s.embedding_it INTO v_query_embedding
        FROM esco_skills s
        WHERE s.embedding_it IS NOT NULL
          AND s.preferred_label_it ILIKE '%' || p_query_text || '%'
        ORDER BY length(s.preferred_label_it) ASC
        LIMIT 1;

        IF v_query_embedding IS NULL THEN
            SELECT s.embedding_it INTO v_query_embedding
            FROM esco_skills s
            WHERE s.embedding_it IS NOT NULL
            ORDER BY s.preferred_label_it <-> p_query_text
            LIMIT 1;
        END IF;

        RETURN QUERY
        SELECT o.id, o.uri, o.preferred_label_it, o.isco_code,
               (1 - (o.embedding_it <=> v_query_embedding))::FLOAT
        FROM esco_occupations o
        WHERE o.embedding_it IS NOT NULL
        ORDER BY o.embedding_it <=> v_query_embedding
        LIMIT p_limit;
    ELSE
        SELECT s.embedding_en INTO v_query_embedding
        FROM esco_skills s
        WHERE s.embedding_en IS NOT NULL
          AND s.preferred_label_en ILIKE '%' || p_query_text || '%'
        ORDER BY length(s.preferred_label_en) ASC
        LIMIT 1;

        IF v_query_embedding IS NULL THEN
            SELECT s.embedding_en INTO v_query_embedding
            FROM esco_skills s
            WHERE s.embedding_en IS NOT NULL
            ORDER BY s.preferred_label_en <-> p_query_text
            LIMIT 1;
        END IF;

        RETURN QUERY
        SELECT o.id, o.uri, o.preferred_label_en, o.isco_code,
               (1 - (o.embedding_en <=> v_query_embedding))::FLOAT
        FROM esco_occupations o
        WHERE o.embedding_en IS NOT NULL
        ORDER BY o.embedding_en <=> v_query_embedding
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 3. fn_skill_gap_analysis(employee_id, target_occupation_uri)
--    Returns missing skills with transferability score
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_skill_gap_analysis(
    p_employee_id UUID,
    p_target_occupation_uri VARCHAR(500)
)
RETURNS TABLE (
    missing_skill_id UUID,
    missing_skill_label VARCHAR(500),
    skill_type VARCHAR(50),
    relation_type VARCHAR(50),
    closest_existing_skill VARCHAR(500),
    transferability FLOAT,
    gap_difficulty VARCHAR(20)  -- 'easy', 'moderate', 'hard'
) AS $$
BEGIN
    RETURN QUERY
    WITH emp_skills AS (
        SELECT es.esco_skill_id, sk.preferred_label_en, sk.embedding_en
        FROM employee_skills es
        JOIN esco_skills sk ON sk.id = es.esco_skill_id
        WHERE es.employee_id = p_employee_id
    ),
    target_skills AS (
        SELECT s.id, s.preferred_label_en, s.skill_type, os.relation_type, s.embedding_en
        FROM esco_occupation_skills os
        JOIN esco_skills s ON s.id = os.skill_id
        JOIN esco_occupations o ON o.id = os.occupation_id
        WHERE o.uri = p_target_occupation_uri
    ),
    gap AS (
        SELECT
            ts.id,
            ts.preferred_label_en,
            ts.skill_type,
            ts.relation_type,
            (SELECT es.preferred_label_en
             FROM emp_skills es
             ORDER BY es.embedding_en <=> ts.embedding_en LIMIT 1
            ) AS closest_label,
            COALESCE(
                (SELECT (1 - (ts.embedding_en <=> es.embedding_en))::FLOAT
                 FROM emp_skills es
                 ORDER BY es.embedding_en <=> ts.embedding_en LIMIT 1),
                0.0
            ) AS transfer_score
        FROM target_skills ts
        WHERE ts.id NOT IN (SELECT esco_skill_id FROM emp_skills)
    )
    SELECT
        g.id,
        g.preferred_label_en,
        g.skill_type,
        g.relation_type,
        g.closest_label,
        g.transfer_score,
        CASE
            WHEN g.transfer_score >= 0.5 THEN 'easy'
            WHEN g.transfer_score >= 0.35 THEN 'moderate'
            ELSE 'hard'
        END::VARCHAR(20)
    FROM gap g
    ORDER BY
        CASE g.relation_type WHEN 'essential' THEN 0 ELSE 1 END,
        g.transfer_score ASC;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 4. fn_career_transition_bridge(source_occupation_uri, target_occupation_uri)
--    Calculates the skill bridge between two occupations
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_career_transition_bridge(
    p_source_uri VARCHAR(500),
    p_target_uri VARCHAR(500)
)
RETURNS TABLE (
    skill_label VARCHAR(500),
    skill_type VARCHAR(50),
    status VARCHAR(20),           -- 'HAVE', 'LEARN', 'TRANSFERABLE'
    closest_source_skill VARCHAR(500),
    transferability FLOAT,
    is_essential BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH source_skills AS (
        SELECT s.id, s.preferred_label_en, s.embedding_en
        FROM esco_occupation_skills os
        JOIN esco_skills s ON s.id = os.skill_id
        JOIN esco_occupations o ON o.id = os.occupation_id
        WHERE o.uri = p_source_uri
    ),
    target_skills AS (
        SELECT s.id, s.preferred_label_en, s.skill_type, os.relation_type, s.embedding_en
        FROM esco_occupation_skills os
        JOIN esco_skills s ON s.id = os.skill_id
        JOIN esco_occupations o ON o.id = os.occupation_id
        WHERE o.uri = p_target_uri
    )
    SELECT
        ts.preferred_label_en,
        ts.skill_type,
        CASE
            WHEN ts.id IN (SELECT id FROM source_skills) THEN 'HAVE'
            WHEN (SELECT MIN(ss.embedding_en <=> ts.embedding_en) FROM source_skills ss) < 0.5 THEN 'TRANSFERABLE'
            ELSE 'LEARN'
        END::VARCHAR(20),
        (SELECT ss.preferred_label_en FROM source_skills ss
         ORDER BY ss.embedding_en <=> ts.embedding_en LIMIT 1),
        COALESCE(
            (1 - (SELECT MIN(ss.embedding_en <=> ts.embedding_en) FROM source_skills ss))::FLOAT,
            0.0
        ),
        ts.relation_type = 'essential'
    FROM target_skills ts
    ORDER BY
        CASE
            WHEN ts.id IN (SELECT id FROM source_skills) THEN 0
            WHEN (SELECT MIN(ss.embedding_en <=> ts.embedding_en) FROM source_skills ss) < 0.5 THEN 1
            ELSE 2
        END,
        CASE ts.relation_type WHEN 'essential' THEN 0 ELSE 1 END;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 5. fn_occupation_similarity(occupation_uri, threshold, max_results)
--    Find similar occupations by embedding + shared skill overlap
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_occupation_similarity(
    p_occupation_uri VARCHAR(500),
    p_threshold FLOAT DEFAULT 0.5,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    occupation_id UUID,
    uri VARCHAR(500),
    preferred_label VARCHAR(500),
    isco_code VARCHAR(10),
    embedding_similarity FLOAT,
    skill_overlap_jaccard FLOAT,
    combined_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH source AS (
        SELECT o.id, o.embedding_en
        FROM esco_occupations o WHERE o.uri = p_occupation_uri
    ),
    source_skills AS (
        SELECT os.skill_id
        FROM esco_occupation_skills os
        JOIN source s ON s.id = os.occupation_id
        WHERE os.relation_type = 'essential'
    ),
    candidates AS (
        SELECT o.id, o.uri, o.preferred_label_en, o.isco_code,
               (1 - (o.embedding_en <=> s.embedding_en))::FLOAT AS emb_sim
        FROM esco_occupations o, source s
        WHERE o.id != s.id
          AND o.embedding_en IS NOT NULL
          AND (1 - (o.embedding_en <=> s.embedding_en)) >= p_threshold
        ORDER BY o.embedding_en <=> s.embedding_en
        LIMIT p_limit * 2  -- fetch extra for re-ranking
    ),
    with_jaccard AS (
        SELECT c.*,
            COALESCE(
                (SELECT count(*)::FLOAT /
                        NULLIF((SELECT count(DISTINCT skill_id)
                                FROM esco_occupation_skills
                                WHERE occupation_id IN (c.id, (SELECT id FROM source))
                                  AND relation_type = 'essential'), 0)
                 FROM esco_occupation_skills os1
                 WHERE os1.occupation_id = c.id
                   AND os1.relation_type = 'essential'
                   AND os1.skill_id IN (SELECT skill_id FROM source_skills)
                ), 0.0
            ) AS jaccard
        FROM candidates c
    )
    SELECT wj.id, wj.uri, wj.preferred_label_en, wj.isco_code,
           wj.emb_sim, wj.jaccard,
           (wj.emb_sim * 0.4 + wj.jaccard * 0.6)::FLOAT  -- weighted: skill overlap matters more
    FROM with_jaccard wj
    ORDER BY (wj.emb_sim * 0.4 + wj.jaccard * 0.6) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 6. fn_employee_career_recommendations(employee_id, max_results)
--    Suggests occupations based on current skill profile
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_employee_career_recommendations(
    p_employee_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    occupation_id UUID,
    occupation_label VARCHAR(500),
    isco_code VARCHAR(10),
    skill_coverage FLOAT,       -- % of essential skills the employee has
    total_essential INT,
    skills_held INT,
    skills_missing INT,
    embedding_match FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH emp_skills AS (
        SELECT DISTINCT es.esco_skill_id
        FROM employee_skills es
        WHERE es.employee_id = p_employee_id
    ),
    emp_profile_embedding AS (
        -- Average of employee's skill embeddings as profile vector
        SELECT avg(s.embedding_en) AS profile_emb
        FROM emp_skills es
        JOIN esco_skills s ON s.id = es.esco_skill_id
        WHERE s.embedding_en IS NOT NULL
    ),
    occ_coverage AS (
        SELECT
            o.id,
            o.preferred_label_en,
            o.isco_code,
            count(*) FILTER (WHERE os.relation_type = 'essential') AS total_ess,
            count(*) FILTER (WHERE os.relation_type = 'essential' AND os.skill_id IN (SELECT esco_skill_id FROM emp_skills)) AS held_ess,
            (1 - (o.embedding_en <=> epe.profile_emb))::FLOAT AS emb_match
        FROM esco_occupations o
        CROSS JOIN emp_profile_embedding epe
        JOIN esco_occupation_skills os ON os.occupation_id = o.id
        WHERE o.embedding_en IS NOT NULL
          AND epe.profile_emb IS NOT NULL
        GROUP BY o.id, o.preferred_label_en, o.isco_code, o.embedding_en, epe.profile_emb
        HAVING count(*) FILTER (WHERE os.relation_type = 'essential') > 0
    )
    SELECT
        oc.id,
        oc.preferred_label_en,
        oc.isco_code,
        (oc.held_ess::FLOAT / oc.total_ess)::FLOAT,
        oc.total_ess::INT,
        oc.held_ess::INT,
        (oc.total_ess - oc.held_ess)::INT,
        oc.emb_match
    FROM occ_coverage oc
    WHERE oc.held_ess > 0  -- at least some skill overlap
    ORDER BY (oc.held_ess::FLOAT / oc.total_ess * 0.6 + oc.emb_match * 0.4) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (version) VALUES ('140') ON CONFLICT DO NOTHING;

COMMIT;
