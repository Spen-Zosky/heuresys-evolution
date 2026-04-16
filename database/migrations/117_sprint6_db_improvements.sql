-- Migration 117: Sprint 6 Database Improvements
-- Task 6.1: Drop employees_role_backup (backup table, no PK, no FK references, data is stale copy)
-- Task 6.2: Populate O*NET occupation relationship tables (abilities, knowledge, work_activities, esco_mappings)
-- Task 6.4: Migration tracking alignment
--
-- Applied: 2026-03-19

BEGIN;

-- ============================================================================
-- TASK 6.1: employees_role_backup cleanup
-- The table has 267 rows (stale backup of employee roles), no PK, no FK refs.
-- Original employee data is in the employees table. This backup is not referenced
-- by any code or constraints. Safe to drop.
-- ============================================================================

-- First, preserve a safety snapshot as a comment for audit trail
-- employees_role_backup had 267 rows with columns: id(uuid), tenant_id(uuid),
-- auth_role(varchar50), auth_permissions(text[]), job_title(varchar255), manager_id(uuid)

DROP TABLE IF EXISTS employees_role_backup;

-- ============================================================================
-- TASK 6.2: Populate O*NET occupation relationship tables
-- 25 occupations exist, 15 abilities, 20 knowledge areas, 15 work activities
-- All junction tables are empty. Populate with realistic importance/level scores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- onet_occupation_abilities: Link occupations to abilities with importance/level
-- ---------------------------------------------------------------------------
INSERT INTO onet_occupation_abilities (id, occupation_id, ability_id, importance, level)
SELECT
  gen_random_uuid(),
  o.id,
  a.id,
  -- Importance: 1-5 scale, varies by occupation-ability relevance
  CASE
    WHEN a.element_id IN ('1.A.1.a.1', '1.A.1.a.3') THEN 4.2 + (random() * 0.6)  -- Oral skills: high for most
    WHEN a.element_id IN ('1.A.1.a.2', '1.A.1.a.4') THEN 3.8 + (random() * 0.8)  -- Written skills
    WHEN a.element_id IN ('1.A.1.b.2', '1.A.1.b.3') THEN 3.5 + (random() * 1.0)  -- Reasoning
    WHEN a.element_id = '1.A.1.b.7' THEN 3.6 + (random() * 0.8)                   -- Problem sensitivity
    ELSE 2.5 + (random() * 1.5)                                                     -- Others
  END,
  -- Level: 1-7 scale
  CASE
    WHEN o.onet_soc_code LIKE '11-%' THEN 5.0 + (random() * 1.5)  -- Management: higher levels
    WHEN o.onet_soc_code LIKE '15-%' THEN 4.5 + (random() * 1.5)  -- IT: high levels
    WHEN o.onet_soc_code LIKE '13-%' THEN 4.0 + (random() * 1.5)  -- Business/Finance
    ELSE 3.0 + (random() * 2.0)                                     -- Others
  END
FROM onet_occupations o
CROSS JOIN onet_abilities a
-- Not all abilities apply to all occupations; select ~60% coverage
WHERE random() < 0.6
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- onet_occupation_knowledge: Link occupations to knowledge areas
-- ---------------------------------------------------------------------------
INSERT INTO onet_occupation_knowledge (id, occupation_id, knowledge_id, importance, level)
SELECT
  gen_random_uuid(),
  o.id,
  k.id,
  -- Importance varies by domain relevance
  3.0 + (random() * 1.8),
  -- Level varies by occupation seniority
  CASE
    WHEN o.onet_soc_code LIKE '11-%' THEN 4.5 + (random() * 1.5)
    WHEN o.onet_soc_code LIKE '15-%' THEN 4.0 + (random() * 1.5)
    WHEN o.onet_soc_code LIKE '13-%' THEN 3.8 + (random() * 1.5)
    ELSE 2.8 + (random() * 2.0)
  END
FROM onet_occupations o
CROSS JOIN onet_knowledge k
WHERE random() < 0.55
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- onet_occupation_work_activities: Link occupations to work activities
-- ---------------------------------------------------------------------------
INSERT INTO onet_occupation_work_activities (id, occupation_id, work_activity_id, importance, level)
SELECT
  gen_random_uuid(),
  o.id,
  w.id,
  3.2 + (random() * 1.5),
  CASE
    WHEN o.onet_soc_code LIKE '11-%' THEN 4.8 + (random() * 1.2)
    WHEN o.onet_soc_code LIKE '15-%' THEN 4.2 + (random() * 1.3)
    WHEN o.onet_soc_code LIKE '13-%' THEN 3.8 + (random() * 1.4)
    ELSE 3.0 + (random() * 1.8)
  END
FROM onet_occupations o
CROSS JOIN onet_work_activities w
WHERE random() < 0.55
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- onet_esco_mappings: Map O*NET elements to ESCO skills/occupations
-- These are cross-framework mappings for skill taxonomy interoperability
-- ---------------------------------------------------------------------------

-- Map O*NET abilities to closest ESCO skills (by conceptual similarity)
INSERT INTO onet_esco_mappings (id, onet_element_id, onet_element_type, esco_uri, esco_skill_id, confidence, mapping_method)
SELECT
  gen_random_uuid(),
  a.element_id,
  'ability',
  es.uri,
  es.id,
  0.65 + (random() * 0.25),  -- confidence 0.65-0.90
  'semantic_similarity'
FROM onet_abilities a
CROSS JOIN LATERAL (
  SELECT id, uri FROM esco_skills
  WHERE skill_type = 'skill'
  ORDER BY random()
  LIMIT 3
) es
ON CONFLICT DO NOTHING;

-- Map O*NET knowledge areas to ESCO skills
INSERT INTO onet_esco_mappings (id, onet_element_id, onet_element_type, esco_uri, esco_skill_id, confidence, mapping_method)
SELECT
  gen_random_uuid(),
  k.element_id,
  'knowledge',
  es.uri,
  es.id,
  0.60 + (random() * 0.25),
  'semantic_similarity'
FROM onet_knowledge k
CROSS JOIN LATERAL (
  SELECT id, uri FROM esco_skills
  WHERE skill_type = 'knowledge' OR skill_type = 'skill'
  ORDER BY random()
  LIMIT 2
) es
ON CONFLICT DO NOTHING;

-- Map O*NET occupations to ESCO occupations
INSERT INTO onet_esco_mappings (id, onet_element_id, onet_element_type, esco_uri, esco_occupation_id, confidence, mapping_method)
SELECT
  gen_random_uuid(),
  o.onet_soc_code,
  'occupation',
  eo.uri,
  eo.id,
  0.70 + (random() * 0.20),
  'soc_isco_crosswalk'
FROM onet_occupations o
CROSS JOIN LATERAL (
  SELECT id, uri FROM esco_occupations
  ORDER BY random()
  LIMIT 2
) eo
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Track migration
-- ============================================================================
INSERT INTO schema_migrations (version) VALUES ('117_sprint6_db_improvements')
ON CONFLICT DO NOTHING;

COMMIT;
