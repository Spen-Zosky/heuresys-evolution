-- Migration 107: Add alt_labels columns
-- esco.ts references alt_labels and alt_labels_it on both skills and occupations

BEGIN;

-- esco_skills: already has alt_labels, needs alt_labels_it
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS alt_labels_it TEXT;

-- esco_occupations: needs both
ALTER TABLE esco_occupations ADD COLUMN IF NOT EXISTS alt_labels TEXT;
ALTER TABLE esco_occupations ADD COLUMN IF NOT EXISTS alt_labels_it TEXT;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('107') ON CONFLICT DO NOTHING;

COMMIT;
