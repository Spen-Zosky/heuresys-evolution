-- Migration 141: Materialized View for Occupation Similarity
-- Pre-computes similarity scores between all occupation pairs
-- where embedding similarity > 0.5 or shared essential skill overlap > 10%
-- Refresh periodically after data changes

BEGIN;

-- ============================================================================
-- Materialized view: occupation similarity pairs
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_occupation_similarity;

CREATE MATERIALIZED VIEW mv_occupation_similarity AS
WITH occupation_essential_skills AS (
    SELECT os.occupation_id, array_agg(os.skill_id) AS skill_ids,
           count(*) AS skill_count
    FROM esco_occupation_skills os
    WHERE os.relation_type = 'essential'
    GROUP BY os.occupation_id
),
pairs AS (
    SELECT
        o1.id AS occ_a_id,
        o2.id AS occ_b_id,
        o1.preferred_label_en AS label_a,
        o2.preferred_label_en AS label_b,
        o1.isco_code AS isco_a,
        o2.isco_code AS isco_b,
        (1 - (o1.embedding_en <=> o2.embedding_en))::FLOAT AS embedding_similarity
    FROM esco_occupations o1
    JOIN esco_occupations o2 ON o1.id < o2.id
    WHERE o1.embedding_en IS NOT NULL
      AND o2.embedding_en IS NOT NULL
      AND (1 - (o1.embedding_en <=> o2.embedding_en)) > 0.45
)
SELECT
    p.occ_a_id, p.occ_b_id, p.label_a, p.label_b, p.isco_a, p.isco_b,
    p.embedding_similarity,
    COALESCE(
        (SELECT count(*)::FLOAT /
                NULLIF(LEAST(a.skill_count, b.skill_count), 0)
         FROM (SELECT unnest(a_sk.skill_ids) AS sid) x
         WHERE x.sid = ANY(b_sk.skill_ids)
        ), 0.0
    ) AS skill_overlap_ratio,
    (p.embedding_similarity * 0.4 + COALESCE(
        (SELECT count(*)::FLOAT /
                NULLIF(LEAST(a.skill_count, b.skill_count), 0)
         FROM (SELECT unnest(a_sk.skill_ids) AS sid) x
         WHERE x.sid = ANY(b_sk.skill_ids)
        ), 0.0
    ) * 0.6) AS combined_score,
    NOW() AS computed_at
FROM pairs p
LEFT JOIN occupation_essential_skills a ON a.occupation_id = p.occ_a_id
LEFT JOIN occupation_essential_skills b ON b.occupation_id = p.occ_b_id
LEFT JOIN occupation_essential_skills a_sk ON a_sk.occupation_id = p.occ_a_id
LEFT JOIN occupation_essential_skills b_sk ON b_sk.occupation_id = p.occ_b_id
WHERE p.embedding_similarity > 0.5
   OR COALESCE(
        (SELECT count(*)::FLOAT /
                NULLIF(LEAST(a.skill_count, b.skill_count), 0)
         FROM (SELECT unnest(a_sk.skill_ids) AS sid) x
         WHERE x.sid = ANY(b_sk.skill_ids)
        ), 0.0
   ) > 0.1;

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_mv_occ_sim_a ON mv_occupation_similarity(occ_a_id);
CREATE INDEX IF NOT EXISTS idx_mv_occ_sim_b ON mv_occupation_similarity(occ_b_id);
CREATE INDEX IF NOT EXISTS idx_mv_occ_sim_combined ON mv_occupation_similarity(combined_score DESC);

-- ============================================================================
-- Refresh function (call after ESCO data or embedding updates)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_refresh_occupation_similarity()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_occupation_similarity;
END;
$$ LANGUAGE plpgsql;

-- Create unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_occ_sim_pair
    ON mv_occupation_similarity(occ_a_id, occ_b_id);

-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (version) VALUES ('141') ON CONFLICT DO NOTHING;

COMMIT;
