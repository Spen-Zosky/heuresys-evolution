-- Migration 145: Post-ESCO Import Consolidation
-- Captures all data operations performed after the ESCO v1.2.1 import:
-- 1. Fix occupation hierarchy levels (recursive CTE)
-- 2. Rebuild skill_adjacencies from real ESCO relations
-- 3. Bulk classify skills into 49 internal clusters
-- 4. Rebuild IVFFlat indexes with optimal lists parameter
--
-- Prerequisites: migrations 140-144 applied, ESCO data imported, embeddings generated.
-- This migration is idempotent — safe to re-run.

BEGIN;

-- ============================================================================
-- 1. Fix occupation hierarchy levels
-- Root nodes: occupations whose parent_uri is NULL or points outside the table
-- ============================================================================

WITH RECURSIVE hierarchy AS (
    SELECT uri, parent_uri, 1 AS lvl
    FROM esco_occupations
    WHERE parent_uri IS NULL
       OR parent_uri NOT IN (SELECT uri FROM esco_occupations)
    UNION ALL
    SELECT o.uri, o.parent_uri, h.lvl + 1
    FROM esco_occupations o
    JOIN hierarchy h ON o.parent_uri = h.uri
    WHERE h.lvl < 10
)
UPDATE esco_occupations o SET level = h.lvl
FROM hierarchy h WHERE o.uri = h.uri;

-- ============================================================================
-- 2. Rebuild skill_adjacencies from ESCO skill relations
-- Delete synthetic data, insert from esco_skill_relations (bidirectional)
-- ============================================================================

-- Remove old synthetic adjacencies (those not from ESCO relations)
DELETE FROM skill_adjacencies
WHERE adjacency_type NOT IN ('domain', 'competency')
   OR calculated_at < '2026-03-26';

-- Insert forward direction
INSERT INTO skill_adjacencies (skill_id, adjacent_skill_id, adjacency_score, adjacency_type, calculated_at, created_at)
SELECT sr.source_skill_id, sr.target_skill_id,
       0.80,
       CASE sr.relation_type WHEN 'essential' THEN 'competency' ELSE 'domain' END,
       NOW(), NOW()
FROM esco_skill_relations sr
WHERE sr.source_skill_id != sr.target_skill_id
ON CONFLICT DO NOTHING;

-- Insert reverse direction
INSERT INTO skill_adjacencies (skill_id, adjacent_skill_id, adjacency_score, adjacency_type, calculated_at, created_at)
SELECT sr.target_skill_id, sr.source_skill_id,
       0.80,
       CASE sr.relation_type WHEN 'essential' THEN 'competency' ELSE 'domain' END,
       NOW(), NOW()
FROM esco_skill_relations sr
WHERE sr.source_skill_id != sr.target_skill_id
  AND NOT EXISTS (
    SELECT 1 FROM skill_adjacencies sa
    WHERE sa.skill_id = sr.target_skill_id AND sa.adjacent_skill_id = sr.source_skill_id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. Bulk classify unclassified skills into 49 internal clusters
-- Uses keyword matching on preferred_label_en + description_en
-- ============================================================================

INSERT INTO skill_classifications (esco_skill_id, skill_cluster_id, confidence_score, classification_source, primary_category, created_at)
SELECT s.id, sc.id, 0.65, 'rule_based',
       CASE s.skill_type WHEN 'knowledge' THEN 'hard' WHEN 'competence' THEN 'soft' ELSE 'hard' END,
       NOW()
FROM esco_skills s
CROSS JOIN LATERAL (
    SELECT
    CASE
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'programming|software dev|coding|developer|algorithm|api |framework|debugging|compiler' THEN 'TECH-PROG'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'web develop|frontend|backend|html|css|javascript|react|angular|http|rest |web app|website' THEN 'TECH-WEB'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'mobile dev|ios|android|swift|kotlin|flutter|smartphone' THEN 'TECH-MOBILE'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'cloud|devops|docker|kubernetes|aws|azure|infrastructure|server admin|linux|virtuali' THEN 'TECH-INFRA'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'security|cyber|encrypt|firewall|penetration|vulnerab|authentication|threat|malware|cryptograph' THEN 'TECH-SEC'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'database|\bsql\b|nosql|data engineer|\betl\b|postgresql|mongodb|warehouse|\bquery\b|oracle|mysql|redis' THEN 'TECH-DB'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'machine learning|deep learning|neural|\bai\b|artificial intelligence|\bnlp\b|natural language process' THEN 'DATA-ML'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'business intelligence|dashboard|reporting|power bi|tableau' THEN 'DATA-BI'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'statistic|regression|hypothesis|probability|sampling|variance' THEN 'DATA-STAT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'visuali[sz]|chart|graph|infographic' THEN 'DATA-VIZ'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'strateg|business model|competitive|market analysis' THEN 'BUS-STRAT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'leader|manage team|supervisory|mentor|coach|delegat' THEN 'BUS-LEAD'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'project manag|agile|scrum|kanban|sprint|milestone' THEN 'BUS-PM'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'entrepreneur|innovat|startup|venture|disrupt' THEN 'BUS-ENT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'negotiat|persuad|influenc|mediat|conflict resol' THEN 'COMM-NEGOT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'teamwork|collaborat|cooperat|group work' THEN 'COMM-TEAM'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'present|public speak|oral communic' THEN 'COMM-VERBAL'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'writ|documentation|technical writ|report writ|copywriting' THEN 'COMM-WRITTEN'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'accounting|bookkeep|ledger|financial statement|audit|\btax\b' THEN 'FIN-AUDIT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'budget|cost control|financial plan|forecast' THEN 'FIN-BUDG'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'invest|portfolio|asset|stock|bond|equity|fund' THEN 'FIN-INV'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'recruit|hiring|talent acqui|interview|onboard|staffing' THEN 'HR-RECRUIT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'training|learning|upskill|education|teach|instruct' THEN 'HR-L&D'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'compensat|payroll|salary|benefit|reward|remunerat' THEN 'HR-COMP'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'performance review|appraisal|feedback|\bkpi\b|objective' THEN 'HR-PERF'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'process|\blean\b|six sigma|kaizen|continuous improve|workflow|\bbpm\b' THEN 'OPS-PROC'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'supply chain|logistics|warehouse|inventory|procurement|sourcing|shipping' THEN 'OPS-SCM'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'quality|\biso\b|inspection|testing|compliance|standard|certif' THEN 'OPS-QUAL'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'sales|\bb2b\b|\bb2c\b|account manag|\bcrm\b|pipeline|prospect' THEN 'SALES-B2B'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'digital market|\bseo\b|\bsem\b|social media|content market|email market|advertis' THEN 'MKT-DIGITAL'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'brand|positioning|market research|consumer|product launch' THEN 'MKT-BRAND'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'customer|service desk|support|satisfaction|helpdesk|complaint' THEN 'CX-SERVICE'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'legal|\blaw\b|contract|regulat|litigation|patent' THEN 'LEGAL-CORP'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'compliance|gdpr|data protect|privacy|anti.money|\baml\b' THEN 'COMP-REG'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'risk|contingency|disaster recovery|business continuity|resilience' THEN 'RISK-MGT'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ '\bux\b|user experience|usability|wireframe|prototype|user research' THEN 'DES-UX'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'graphic design|visual design|typography|illustration|photoshop|figma' THEN 'DES-GRAPH'
        WHEN (lower(s.preferred_label_en) || ' ' || coalesce(lower(s.description_en),'')) ~ 'product design|industrial design|3d model|\bcad\b|rendering' THEN 'DES-PROD'
        ELSE NULL
    END AS matched_code
) matched
JOIN skill_clusters sc ON sc.code = matched.matched_code
WHERE matched.matched_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM skill_classifications scl WHERE scl.esco_skill_id = s.id)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Rebuild IVFFlat indexes with optimal lists parameter
-- sqrt(14011) ≈ 118, sqrt(3040) ≈ 55
-- ============================================================================

SET maintenance_work_mem = '256MB';

DROP INDEX IF EXISTS idx_esco_skills_embedding_en;
DROP INDEX IF EXISTS idx_esco_skills_embedding_it;
DROP INDEX IF EXISTS idx_esco_occupations_embedding_en;
DROP INDEX IF EXISTS idx_esco_occupations_embedding_it;

CREATE INDEX idx_esco_skills_embedding_en ON esco_skills
  USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 118)
  WHERE embedding_en IS NOT NULL;

CREATE INDEX idx_esco_skills_embedding_it ON esco_skills
  USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 118)
  WHERE embedding_it IS NOT NULL;

CREATE INDEX idx_esco_occupations_embedding_en ON esco_occupations
  USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 55);

CREATE INDEX idx_esco_occupations_embedding_it ON esco_occupations
  USING ivfflat (embedding_it vector_cosine_ops) WITH (lists = 55);

RESET maintenance_work_mem;

-- ============================================================================
-- Record migration
-- ============================================================================

INSERT INTO schema_migrations (version) VALUES ('145') ON CONFLICT DO NOTHING;

COMMIT;
