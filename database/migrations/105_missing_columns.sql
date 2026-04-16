-- Migration 105: Add missing columns referenced by routes
-- Fixes column-not-found errors in onet.ts and esco.ts

BEGIN;

-- onet_occupations: embedding_en referenced by onet.ts line 249
ALTER TABLE onet_occupations ADD COLUMN IF NOT EXISTS embedding_en vector(1536);

-- skill_classifications: confidence_score referenced by esco.ts lines 535, 712, 852-856
ALTER TABLE skill_classifications ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4) DEFAULT 0.0;

-- Populate confidence_score from primary_category_confidence if available
UPDATE skill_classifications
SET confidence_score = primary_category_confidence
WHERE confidence_score = 0.0 AND primary_category_confidence IS NOT NULL;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('105') ON CONFLICT DO NOTHING;

COMMIT;
