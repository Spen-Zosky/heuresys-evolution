-- ============================================================
-- Enterprise Taxonomy — Phase 2: Data Migration
-- Migra dati da nace_sections/divisions/groups e industry_prototypes
-- Ref: BLUEPRINT-Enterprise-Taxonomy.md
-- ============================================================

BEGIN;

-- 2.1 nace_sections → industry_classifications (livello 1)
INSERT INTO industry_classifications (
    code, parent_code, level, classification_system,
    name_it, name_en, description_it, icon, color, is_active,
    embedding_it, embedding_en, embedding_model, embedding_generated_at, created_at
)
SELECT
    TRIM(code),
    NULL,
    1,
    'NACE',
    name_it,
    name_en,
    description,
    icon,
    color,
    COALESCE(is_active, TRUE),
    embedding_it,
    embedding_en,
    embedding_model,
    embedding_generated_at,
    COALESCE(created_at, NOW())
FROM nace_sections
WHERE deleted_at IS NULL
ON CONFLICT (code) DO NOTHING;

-- 2.2 nace_divisions → industry_classifications (livello 2)
INSERT INTO industry_classifications (
    code, parent_code, level, classification_system,
    name_it, name_en, description_it, is_active,
    embedding_it, embedding_en, embedding_model, embedding_generated_at, created_at
)
SELECT
    code,
    TRIM(section_code),
    2,
    'NACE',
    name_it,
    name_en,
    description,
    COALESCE(is_active, TRUE),
    embedding_it,
    embedding_en,
    embedding_model,
    embedding_generated_at,
    COALESCE(created_at, NOW())
FROM nace_divisions
WHERE deleted_at IS NULL
ON CONFLICT (code) DO NOTHING;

-- 2.3 nace_groups → industry_classifications (livello 3)
INSERT INTO industry_classifications (
    code, parent_code, level, classification_system,
    name_it, name_en, description_it, is_active,
    embedding_it, embedding_en, embedding_model, embedding_generated_at, created_at
)
SELECT
    code,
    division_code,
    3,
    'NACE',
    name_it,
    name_en,
    description,
    COALESCE(is_active, TRUE),
    embedding_it,
    embedding_en,
    embedding_model,
    embedding_generated_at,
    COALESCE(created_at, NOW())
FROM nace_groups
WHERE deleted_at IS NULL
ON CONFLICT (code) DO NOTHING;

-- 2.4 industry_prototypes → industry_profiles
-- NOTA: typical_span_of_control e department_templates sono TEXT[] in sorgente, JSONB in destinazione
INSERT INTO industry_profiles (
    code, name, description, nace_class_code, company_size_code,
    min_employees, max_employees,
    typical_departments, typical_roles, typical_hierarchy,
    typical_span_of_control, esco_occupation_codes, department_templates,
    created_at
)
SELECT
    ip.code,
    ip.name,
    ip.description,
    ip.nace_group,
    ip.size_class::text,
    ip.min_employees,
    ip.max_employees,
    ip.typical_departments,
    ip.typical_roles,
    ip.typical_hierarchy,
    to_jsonb(ip.typical_span_of_control),
    ip.esco_occupation_codes,
    to_jsonb(ip.department_templates),
    COALESCE(ip.created_at, NOW())
FROM industry_prototypes ip
ON CONFLICT (code) DO NOTHING;

-- 2.5 Popolare tenant_industry_classifications da tenants.nace_primary
-- I codici nace_primary (es. 64.19) sono livello 4, ma abbiamo solo livello 3.
-- Tronchiamo al codice gruppo: 64.19 → 64.1, 10.89 → 10.8, 35.11 → 35.1, 70.22 → 70.2
INSERT INTO tenant_industry_classifications (tenant_id, classification_code, classification_role)
SELECT
    t.id,
    CASE
        WHEN length(t.nace_primary) > 4 THEN left(t.nace_primary, length(t.nace_primary) - 1)
        ELSE t.nace_primary
    END,
    'PRIMARY'
FROM tenants t
WHERE t.nace_primary IS NOT NULL
    AND CASE
        WHEN length(t.nace_primary) > 4 THEN left(t.nace_primary, length(t.nace_primary) - 1)
        ELSE t.nace_primary
    END IN (SELECT code FROM industry_classifications)
ON CONFLICT DO NOTHING;

COMMIT;
