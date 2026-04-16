-- Migration 103: ESCO Infrastructure Tables
-- Creates missing ESCO tables and columns referenced by esco.ts and ontology.ts routes
-- Phase 3: Foundation Completion

BEGIN;

-- Add missing columns to esco_skills
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS is_transversal BOOLEAN DEFAULT false;
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS description_it TEXT;
UPDATE esco_skills SET description_en = description WHERE description_en IS NULL AND description IS NOT NULL;

-- Add missing columns to esco_occupations
ALTER TABLE esco_occupations ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE esco_occupations ADD COLUMN IF NOT EXISTS description_it TEXT;
ALTER TABLE esco_occupations ADD COLUMN IF NOT EXISTS parent_uri VARCHAR(500);
ALTER TABLE esco_occupations ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
UPDATE esco_occupations SET description_en = description WHERE description_en IS NULL AND description IS NOT NULL;

COMMIT;

-- ISCO Groups (separate transaction)
BEGIN;

CREATE TABLE IF NOT EXISTS esco_isco_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri VARCHAR(500) UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    preferred_label_en VARCHAR(500),
    preferred_label_it VARCHAR(500),
    description_en TEXT,
    description_it TEXT,
    parent_uri VARCHAR(500),
    level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esco_isco_groups_code ON esco_isco_groups(code);

INSERT INTO esco_isco_groups (code, preferred_label_en, preferred_label_it, level) VALUES
('1', 'Managers', 'Dirigenti', 1),
('11', 'Chief Executives, Senior Officials and Legislators', 'Amministratori delegati e dirigenti', 2),
('12', 'Administrative and Commercial Managers', 'Manager amministrativi e commerciali', 2),
('13', 'Production and Specialised Services Managers', 'Manager di produzione e servizi', 2),
('14', 'Hospitality, Retail and Other Services Managers', 'Manager ospitalita e servizi', 2),
('2', 'Professionals', 'Professionisti', 1),
('21', 'Science and Engineering Professionals', 'Professionisti scienze e ingegneria', 2),
('24', 'Business and Administration Professionals', 'Professionisti affari e amministrazione', 2),
('25', 'Information and Communications Technology Professionals', 'Professionisti ICT', 2),
('3', 'Technicians and Associate Professionals', 'Tecnici e professionisti associati', 1),
('33', 'Business and Administration Associate Professionals', 'Tecnici affari e amministrazione', 2),
('4', 'Clerical Support Workers', 'Impiegati', 1),
('41', 'General and Keyboard Clerks', 'Impiegati generici e data entry', 2),
('43', 'Numerical and Material Recording Clerks', 'Impiegati contabili e magazzino', 2)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- Occupation-Skills and Skill Relations (separate transaction)
BEGIN;

CREATE TABLE IF NOT EXISTS esco_occupation_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupation_id UUID NOT NULL REFERENCES esco_occupations(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) DEFAULT 'essential',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(occupation_id, skill_id)
);

CREATE TABLE IF NOT EXISTS esco_skill_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    target_skill_id UUID NOT NULL REFERENCES esco_skills(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_skill_id, target_skill_id, relation_type)
);

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('103') ON CONFLICT DO NOTHING;

COMMIT;
