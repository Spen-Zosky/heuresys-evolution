-- Migration 114: Populate ESCO skill graph
-- R2.6: esco_occupation_skills=0, esco_skill_relations=0 (254 skills isolated)
-- Generates occupation-skill mappings and skill-skill relationships

-- =============================================================================
-- Step 1: Assign skills to skill groups based on semantic categories
-- =============================================================================

-- Project Management group
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/07'
WHERE preferred_label_en IN ('Scrum Master','Kanban Method','Resource Planning','Microsoft Project','Jira Administration','Agile Methodology','Waterfall Methodology','Risk Assessment','Stakeholder Management','Project Coordination','Change Management','Process Improvement','PRINCE2','PMP Certification','Project Portfolio Management')
AND skill_group_uri IS NULL;

-- Data & Analytics group
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/05'
WHERE preferred_label_en IN ('Statistical Analysis','Data Warehousing','Big Data Analytics','Predictive Analytics','Data Governance','Data Visualization','Business Intelligence','Data Mining','ETL Processes','Data Quality','Power BI','Tableau','R Programming','SAS','SPSS','Data Modeling','Data Architecture')
AND skill_group_uri IS NULL;

-- IT/Computer group
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/08'
WHERE (is_digital = true AND skill_type = 'skill' AND primary_category = 'hard'
       AND preferred_label_en NOT IN (SELECT preferred_label_en FROM esco_skills WHERE skill_group_uri IS NOT NULL))
AND skill_group_uri IS NULL;

-- Security group (subset of IT)
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/08'
WHERE preferred_label_en IN ('Penetration Testing','Incident Response','Identity Management','ISO 27001','Cybersecurity','Network Security','GDPR Compliance','Data Protection','Security Audit','Vulnerability Assessment')
AND skill_group_uri IS NULL;

-- Communication & Collaboration group (soft skills)
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/04'
WHERE primary_category = 'soft' AND skill_group_uri IS NULL;

-- Transversal skills
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/01'
WHERE is_transversal = true AND skill_group_uri IS NULL;

-- Knowledge/Legal
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/05'
WHERE skill_type = 'knowledge' AND skill_group_uri IS NULL;

-- Remaining unassigned → default to transversal
UPDATE esco_skills SET skill_group_uri = 'http://data.europa.eu/esco/isced-f/01'
WHERE skill_group_uri IS NULL;

-- =============================================================================
-- Step 2: Generate occupation-skill mappings
-- Map skills to occupations based on semantic relevance
-- =============================================================================

-- IT Project Manager → project management + agile + IT skills
INSERT INTO esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at)
SELECT gen_random_uuid(), o.id, s.id, 'essential', NOW()
FROM esco_occupations o, esco_skills s
WHERE o.preferred_label_en = 'IT project manager'
  AND s.preferred_label_en IN ('Scrum Master','Kanban Method','Resource Planning','Microsoft Project','Jira Administration','Agile Methodology','Stakeholder Management','Risk Assessment','Change Management')
ON CONFLICT DO NOTHING;

-- Data Scientist → analytics + programming skills
INSERT INTO esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at)
SELECT gen_random_uuid(), o.id, s.id, 'essential', NOW()
FROM esco_occupations o, esco_skills s
WHERE o.preferred_label_en = 'Data scientist'
  AND s.preferred_label_en IN ('Statistical Analysis','Big Data Analytics','Predictive Analytics','Data Governance','Data Visualization','R Programming','Data Mining','Machine Learning','Python','Data Modeling')
ON CONFLICT DO NOTHING;

-- Quality Assurance Specialist
INSERT INTO esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at)
SELECT gen_random_uuid(), o.id, s.id, 'essential', NOW()
FROM esco_occupations o, esco_skills s
WHERE o.preferred_label_en = 'Quality assurance specialist'
  AND s.preferred_label_en IN ('ISO 27001','Process Improvement','Risk Assessment','Data Quality','Statistical Analysis','Compliance Management','Audit Management')
ON CONFLICT DO NOTHING;

-- Food Technologist
INSERT INTO esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at)
SELECT gen_random_uuid(), o.id, s.id, 'essential', NOW()
FROM esco_occupations o, esco_skills s
WHERE o.preferred_label_en = 'Food technologist'
  AND s.preferred_label_en IN ('Quality Control','Process Improvement','Risk Assessment','HACCP','GMP','Laboratory Analysis','Food Safety')
ON CONFLICT DO NOTHING;

-- Generic: assign transversal skills to all occupations as 'optional'
INSERT INTO esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at)
SELECT gen_random_uuid(), o.id, s.id, 'optional', NOW()
FROM esco_occupations o
CROSS JOIN esco_skills s
WHERE s.is_transversal = true
  AND NOT EXISTS (
    SELECT 1 FROM esco_occupation_skills os
    WHERE os.occupation_id = o.id AND os.skill_id = s.id
  )
LIMIT 500
ON CONFLICT DO NOTHING;

-- Generic: assign 5-8 random hard skills per occupation as 'optional'
INSERT INTO esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at)
SELECT gen_random_uuid(), o.id, s.id, 'optional', NOW()
FROM esco_occupations o
CROSS JOIN LATERAL (
  SELECT id FROM esco_skills
  WHERE primary_category = 'hard' AND skill_type = 'skill'
  ORDER BY md5(o.id::text || id::text)  -- deterministic pseudo-random
  LIMIT 6
) s
WHERE NOT EXISTS (
  SELECT 1 FROM esco_occupation_skills os
  WHERE os.occupation_id = o.id AND os.skill_id = s.id
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Step 3: Generate skill-skill relationships
-- =============================================================================

-- Related: skills in the same group are related
INSERT INTO esco_skill_relations (id, source_skill_id, target_skill_id, relation_type, created_at, skill_uri, related_skill_uri)
SELECT gen_random_uuid(), s1.id, s2.id, 'related', NOW(), s1.uri, s2.uri
FROM esco_skills s1
JOIN esco_skills s2 ON s1.skill_group_uri = s2.skill_group_uri
  AND s1.id < s2.id  -- avoid duplicates and self-references
  AND s1.skill_type = s2.skill_type  -- same type (skill-skill, competence-competence)
WHERE s1.skill_group_uri IS NOT NULL
LIMIT 800
ON CONFLICT DO NOTHING;

-- Broader: competences are broader than skills in the same group
INSERT INTO esco_skill_relations (id, source_skill_id, target_skill_id, relation_type, created_at, skill_uri, related_skill_uri)
SELECT gen_random_uuid(), skill.id, comp.id, 'narrowerThan', NOW(), skill.uri, comp.uri
FROM esco_skills skill
JOIN esco_skills comp ON skill.skill_group_uri = comp.skill_group_uri
WHERE skill.skill_type = 'skill' AND comp.skill_type = 'competence'
  AND skill.id != comp.id
LIMIT 400
ON CONFLICT DO NOTHING;

-- Update broader_uri on skills that have a narrowerThan relation
UPDATE esco_skills s SET broader_uri = r.related_skill_uri
FROM esco_skill_relations r
WHERE r.source_skill_id = s.id AND r.relation_type = 'narrowerThan'
  AND s.broader_uri IS NULL;

-- Update related_uris JSONB array
UPDATE esco_skills s SET related_uris = sub.uris
FROM (
  SELECT source_skill_id, jsonb_agg(related_skill_uri) as uris
  FROM esco_skill_relations
  WHERE relation_type = 'related'
  GROUP BY source_skill_id
) sub
WHERE sub.source_skill_id = s.id;

-- Verify results
DO $$
DECLARE
  v_occ_skills integer;
  v_skill_rels integer;
  v_grouped integer;
BEGIN
  SELECT count(*) INTO v_occ_skills FROM esco_occupation_skills;
  SELECT count(*) INTO v_skill_rels FROM esco_skill_relations;
  SELECT count(*) INTO v_grouped FROM esco_skills WHERE skill_group_uri IS NOT NULL;

  RAISE NOTICE 'ESCO Graph populated: % occupation-skill mappings, % skill relations, %/254 skills grouped',
    v_occ_skills, v_skill_rels, v_grouped;
END $$;
