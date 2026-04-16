-- ============================================================================
-- Migration 174: rbp_section_translations table for multi-locale labels
-- ============================================================================
-- Decouples sidebar section labels from the rbp_sections.label_it / label_en
-- pair so adding new locales (de, fr, es, ...) becomes a data operation
-- instead of a schema change. Aligns with P9 (data-driven) and P10
-- (multi-tenant scoping). Existing it/en values are migrated automatically.
--
-- The legacy label_it / label_en columns are KEPT for now to avoid breaking
-- the API consumers; a follow-up migration will mark them deprecated and
-- eventually drop them after consumers switch to /api/rbp/sections?locale=xx.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rbp_section_translations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_code TEXT NOT NULL,
    locale       TEXT NOT NULL CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    label        TEXT NOT NULL,
    tenant_id    UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One translation per (section, locale, scope). NULL tenant_id == platform default.
    -- No FK on section_code: rbp_sections is keyed on (tenant_id, code) not code
    -- alone, so referential integrity is enforced at the application layer.
    CONSTRAINT rbp_section_translations_unique
      UNIQUE NULLS NOT DISTINCT (section_code, locale, tenant_id)
);

CREATE INDEX IF NOT EXISTS rbp_section_translations_lookup_idx
  ON rbp_section_translations (section_code, locale);

-- Backfill from existing label_it / label_en at platform scope (tenant_id NULL).
INSERT INTO rbp_section_translations (section_code, locale, label, tenant_id)
SELECT code, 'it', label_it, NULL
  FROM rbp_sections
 WHERE label_it IS NOT NULL
ON CONFLICT (section_code, locale, tenant_id) DO NOTHING;

INSERT INTO rbp_section_translations (section_code, locale, label, tenant_id)
SELECT code, 'en', label_en, NULL
  FROM rbp_sections
 WHERE label_en IS NOT NULL
ON CONFLICT (section_code, locale, tenant_id) DO NOTHING;

DO $$
DECLARE
    v_sections INTEGER;
    v_translations INTEGER;
    v_locales INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sections FROM rbp_sections;
    SELECT COUNT(*) INTO v_translations FROM rbp_section_translations;
    SELECT COUNT(DISTINCT locale) INTO v_locales FROM rbp_section_translations;
    RAISE NOTICE '[migration 174] sections=% translations=% locales=%',
        v_sections, v_translations, v_locales;
    IF v_translations < v_sections * 2 THEN
        RAISE WARNING '[migration 174] expected at least 2x sections translations (it+en), got %', v_translations;
    END IF;
END $$;

COMMIT;
