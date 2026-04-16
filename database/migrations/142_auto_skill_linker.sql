-- Migration 142: Automatic Skill Linker
-- Links custom_skill_name entries to ESCO skills via semantic similarity.
-- This is the "natural language → ESCO" bridge that connects
-- market terminology (HACCP, Lean Manufacturing, SAP) to the formal taxonomy.

BEGIN;

-- ============================================================================
-- 1. fn_auto_link_custom_skills(tenant_id, similarity_threshold, dry_run)
--    Automatically maps employee_skills.custom_skill_name → esco_skills
--    using pgvector embedding similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_link_custom_skills(
    p_tenant_id UUID DEFAULT NULL,
    p_threshold FLOAT DEFAULT 0.40,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    employee_skill_id UUID,
    custom_name VARCHAR(500),
    matched_esco_label VARCHAR(500),
    matched_esco_uri VARCHAR(500),
    similarity FLOAT,
    action VARCHAR(20)  -- 'WOULD_LINK' or 'LINKED'
) AS $$
DECLARE
    v_linked INT := 0;
BEGIN
    -- For each distinct custom_skill_name, find the best ESCO match
    -- by computing embedding similarity between the custom name and
    -- all ESCO skill labels+descriptions
    RETURN QUERY
    WITH unlinked AS (
        SELECT DISTINCT ON (es.custom_skill_name)
            es.id AS es_id,
            es.custom_skill_name,
            es.tenant_id
        FROM employee_skills es
        WHERE es.esco_skill_id IS NULL
          AND es.custom_skill_name IS NOT NULL
          AND es.custom_skill_name != ''
          AND (p_tenant_id IS NULL OR es.tenant_id = p_tenant_id)
        ORDER BY es.custom_skill_name, es.id
    ),
    matches AS (
        SELECT
            u.es_id,
            u.custom_skill_name,
            best.id AS esco_id,
            best.preferred_label_en,
            best.uri,
            best.sim
        FROM unlinked u
        CROSS JOIN LATERAL (
            SELECT s.id, s.preferred_label_en, s.uri,
                   (1 - (s.embedding_en <=> (
                       -- Find best proxy embedding: use the ESCO skill whose
                       -- label is most similar textually to the custom name
                       SELECT s2.embedding_en
                       FROM esco_skills s2
                       WHERE s2.embedding_en IS NOT NULL
                       ORDER BY s2.preferred_label_en <-> u.custom_skill_name
                       LIMIT 1
                   )))::FLOAT AS sim
            FROM esco_skills s
            WHERE s.embedding_en IS NOT NULL
            ORDER BY s.embedding_en <=> (
                SELECT s2.embedding_en
                FROM esco_skills s2
                WHERE s2.embedding_en IS NOT NULL
                ORDER BY s2.preferred_label_en <-> u.custom_skill_name
                LIMIT 1
            )
            LIMIT 1
        ) best
        WHERE best.sim >= p_threshold
    )
    SELECT
        m.es_id,
        m.custom_name,
        m.preferred_label_en,
        m.uri,
        m.sim,
        CASE WHEN p_dry_run THEN 'WOULD_LINK' ELSE 'LINKED' END::VARCHAR(20)
    FROM (
        SELECT es_id, custom_skill_name AS custom_name,
               preferred_label_en, uri, sim
        FROM matches
    ) m;

    -- If not dry run, actually update the links
    IF NOT p_dry_run THEN
        WITH unlinked AS (
            SELECT DISTINCT ON (es.custom_skill_name)
                es.custom_skill_name, es.tenant_id
            FROM employee_skills es
            WHERE es.esco_skill_id IS NULL
              AND es.custom_skill_name IS NOT NULL
              AND (p_tenant_id IS NULL OR es.tenant_id = p_tenant_id)
            ORDER BY es.custom_skill_name
        ),
        best_matches AS (
            SELECT
                u.custom_skill_name,
                (SELECT s.id
                 FROM esco_skills s
                 WHERE s.embedding_en IS NOT NULL
                 ORDER BY s.embedding_en <=> (
                     SELECT s2.embedding_en FROM esco_skills s2
                     WHERE s2.embedding_en IS NOT NULL
                     ORDER BY s2.preferred_label_en <-> u.custom_skill_name LIMIT 1
                 ) LIMIT 1
                ) AS esco_id
            FROM unlinked u
        )
        UPDATE employee_skills es
        SET esco_skill_id = bm.esco_id,
            source = COALESCE(es.source, '') || '+auto_linked',
            confidence_score = (
                SELECT (1 - (s.embedding_en <=> (
                    SELECT s2.embedding_en FROM esco_skills s2
                    WHERE s2.embedding_en IS NOT NULL
                    ORDER BY s2.preferred_label_en <-> es.custom_skill_name LIMIT 1
                )))::FLOAT
                FROM esco_skills s WHERE s.id = bm.esco_id
            )
        FROM best_matches bm
        WHERE es.custom_skill_name = bm.custom_skill_name
          AND es.esco_skill_id IS NULL
          AND bm.esco_id IS NOT NULL;

        GET DIAGNOSTICS v_linked = ROW_COUNT;

        -- Also create skill_aliases for the custom names
        INSERT INTO skill_aliases (esco_skill_id, alias_text, alias_type, language_code, source, confidence_score, is_verified, created_at)
        SELECT DISTINCT bm.esco_id, bm.custom_skill_name, 'market_term', 'en',
               'auto_linker', 0.0, FALSE, NOW()
        FROM best_matches bm
        WHERE bm.esco_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 2. fn_suggest_esco_for_text(free_text, language, limit)
--    Given any free text (CV excerpt, job description, etc.),
--    suggests the most relevant ESCO skills
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_suggest_esco_for_text(
    p_text VARCHAR(1000),
    p_language VARCHAR(2) DEFAULT 'en',
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    skill_id UUID,
    preferred_label VARCHAR(500),
    skill_type VARCHAR(50),
    relevance FLOAT
) AS $$
DECLARE
    v_proxy_embedding vector(1536);
BEGIN
    -- Use pg_trgm to find closest skill label, then use its embedding
    IF p_language = 'it' THEN
        SELECT s.embedding_it INTO v_proxy_embedding
        FROM esco_skills s
        WHERE s.embedding_it IS NOT NULL
        ORDER BY s.preferred_label_it <-> p_text
        LIMIT 1;

        RETURN QUERY
        SELECT s.id, s.preferred_label_it, s.skill_type,
               (1 - (s.embedding_it <=> v_proxy_embedding))::FLOAT
        FROM esco_skills s
        WHERE s.embedding_it IS NOT NULL
        ORDER BY s.embedding_it <=> v_proxy_embedding
        LIMIT p_limit;
    ELSE
        SELECT s.embedding_en INTO v_proxy_embedding
        FROM esco_skills s
        WHERE s.embedding_en IS NOT NULL
        ORDER BY s.preferred_label_en <-> p_text
        LIMIT 1;

        RETURN QUERY
        SELECT s.id, s.preferred_label_en, s.skill_type,
               (1 - (s.embedding_en <=> v_proxy_embedding))::FLOAT
        FROM esco_skills s
        WHERE s.embedding_en IS NOT NULL
        ORDER BY s.embedding_en <=> v_proxy_embedding
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 3. Organizational Skill Intelligence View
--    Real-time view of skill distribution, concentration risk, and gaps
-- ============================================================================

CREATE OR REPLACE VIEW vw_organizational_skill_intelligence AS
WITH skill_distribution AS (
    SELECT
        t.code AS tenant_code,
        t.name AS tenant_name,
        s.id AS skill_id,
        COALESCE(s.preferred_label_en, es.custom_skill_name) AS skill_label,
        s.skill_type,
        s.reuse_level,
        count(DISTINCT es.employee_id) AS employees_with_skill,
        round(avg(es.proficiency_level)::numeric, 1) AS avg_proficiency,
        count(DISTINCT es.employee_id)::FLOAT /
            NULLIF((SELECT count(*) FROM employees e2 WHERE e2.tenant_id = t.id), 0) AS penetration_rate
    FROM employee_skills es
    JOIN employees e ON e.id = es.employee_id
    JOIN tenants t ON t.id = e.tenant_id
    LEFT JOIN esco_skills s ON s.id = es.esco_skill_id
    GROUP BY t.code, t.name, t.id, s.id, s.preferred_label_en, es.custom_skill_name, s.skill_type, s.reuse_level
),
demand AS (
    SELECT s.id AS skill_id, count(*) AS open_positions
    FROM job_skills js
    JOIN esco_skills s ON s.uri = js.esco_skill_uri
    GROUP BY s.id
)
SELECT
    sd.*,
    COALESCE(d.open_positions, 0) AS open_demand,
    CASE
        WHEN sd.penetration_rate < 0.05 AND COALESCE(d.open_positions, 0) > 0 THEN 'CRITICAL_GAP'
        WHEN sd.penetration_rate < 0.10 THEN 'SCARCE'
        WHEN sd.penetration_rate > 0.50 THEN 'WIDESPREAD'
        ELSE 'HEALTHY'
    END AS risk_level
FROM skill_distribution sd
LEFT JOIN demand d ON d.skill_id = sd.skill_id;


-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (version) VALUES ('142') ON CONFLICT DO NOTHING;

COMMIT;
