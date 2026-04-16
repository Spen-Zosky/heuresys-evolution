-- Migration 102: Phase 3 Missing Tables
-- Creates tables referenced by existing services that don't exist yet
-- Stories: S-ONTO-01-05 (skill migration), E-ONTO-01 (ESCO skill groups)

BEGIN;

-- Skill Migration Jobs (referenced by legacy-skill-migration.ts)
CREATE TABLE IF NOT EXISTS skill_migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    job_type VARCHAR(50) NOT NULL, -- employee_skills, extracted_skills, unknown_skills, all
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    matched_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_migration_jobs_tenant ON skill_migration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_migration_jobs_status ON skill_migration_jobs(status);

-- ESCO Skill Groups (referenced by ontology.ts for skill detail views)
CREATE TABLE IF NOT EXISTS esco_skill_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri VARCHAR(500) NOT NULL UNIQUE,
    preferred_label_en VARCHAR(500),
    preferred_label_it VARCHAR(500),
    description_en TEXT,
    description_it TEXT,
    broader_uri VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esco_skill_groups_uri ON esco_skill_groups(uri);

-- Seed some ESCO skill groups (top-level pillars)
INSERT INTO esco_skill_groups (uri, preferred_label_en, preferred_label_it) VALUES
('http://data.europa.eu/esco/isced-f/01', 'Transversal skills and competences', 'Competenze trasversali'),
('http://data.europa.eu/esco/isced-f/02', 'Language skills and knowledge', 'Competenze linguistiche'),
('http://data.europa.eu/esco/isced-f/04', 'Communication, collaboration and creativity', 'Comunicazione, collaborazione e creativita'),
('http://data.europa.eu/esco/isced-f/05', 'Information skills', 'Competenze informative'),
('http://data.europa.eu/esco/isced-f/06', 'Assisting and caring', 'Assistenza e cura'),
('http://data.europa.eu/esco/isced-f/07', 'Management skills', 'Competenze manageriali'),
('http://data.europa.eu/esco/isced-f/08', 'Working with computers', 'Uso del computer'),
('http://data.europa.eu/esco/isced-f/09', 'Handling and moving', 'Gestione e movimentazione'),
('http://data.europa.eu/esco/isced-f/10', 'Constructing', 'Costruzione'),
('http://data.europa.eu/esco/isced-f/11', 'Working with machinery and specialized equipment', 'Uso macchinari e attrezzature')
ON CONFLICT (uri) DO NOTHING;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('102') ON CONFLICT DO NOTHING;

COMMIT;
