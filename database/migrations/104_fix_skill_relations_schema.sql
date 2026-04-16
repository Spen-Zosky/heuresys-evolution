-- Migration 104: Fix esco_skill_relations schema
-- The esco.ts routes reference skill_uri and related_skill_uri (VARCHAR/URI-based)
-- but migration 103 created source_skill_id and target_skill_id (UUID FK-based)
-- This adds the URI columns the code expects

BEGIN;

-- Add URI-based columns that the code actually uses
ALTER TABLE esco_skill_relations ADD COLUMN IF NOT EXISTS skill_uri VARCHAR(500);
ALTER TABLE esco_skill_relations ADD COLUMN IF NOT EXISTS related_skill_uri VARCHAR(500);

-- Populate from existing FK relationships
UPDATE esco_skill_relations sr
SET skill_uri = s.uri
FROM esco_skills s
WHERE s.id = sr.source_skill_id AND sr.skill_uri IS NULL;

UPDATE esco_skill_relations sr
SET related_skill_uri = s.uri
FROM esco_skills s
WHERE s.id = sr.target_skill_id AND sr.related_skill_uri IS NULL;

-- Add indexes for the URI-based lookups used by esco.ts
CREATE INDEX IF NOT EXISTS idx_esco_skill_relations_skill_uri ON esco_skill_relations(skill_uri);
CREATE INDEX IF NOT EXISTS idx_esco_skill_relations_related_uri ON esco_skill_relations(related_skill_uri);

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('104') ON CONFLICT DO NOTHING;

COMMIT;
