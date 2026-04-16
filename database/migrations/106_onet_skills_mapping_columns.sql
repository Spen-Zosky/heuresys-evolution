-- Migration 106: Add mapping columns to onet_skills
-- onet.ts routes reference mapped_esco_skill_id and mapping_confidence
-- but the table has esco_skill_id and similarity_score

BEGIN;

-- Add the columns the code expects
ALTER TABLE onet_skills ADD COLUMN IF NOT EXISTS mapped_esco_skill_id UUID REFERENCES esco_skills(id);
ALTER TABLE onet_skills ADD COLUMN IF NOT EXISTS mapping_confidence NUMERIC(5,4);

-- Populate from existing columns
UPDATE onet_skills
SET mapped_esco_skill_id = esco_skill_id
WHERE mapped_esco_skill_id IS NULL AND esco_skill_id IS NOT NULL;

UPDATE onet_skills
SET mapping_confidence = similarity_score
WHERE mapping_confidence IS NULL AND similarity_score IS NOT NULL;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('106') ON CONFLICT DO NOTHING;

COMMIT;
