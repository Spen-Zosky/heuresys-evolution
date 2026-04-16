-- ============================================================================
-- Migration 173: widget_catalog.frontend_module for codegen support
-- ============================================================================
-- Adds a `frontend_module` column to widget_catalog so the build-time codegen
-- (scripts/generate-widget-map.mjs) can resolve each widget code to its
-- frontend module without an external alias map. Aligns widget_catalog with
-- the admin_component_registry pattern (P9 data-driven, P11 reuse-first).
--
-- The module name is the basename of the file under
-- services/frontend/src/components/widgets/types/<module>.tsx
-- (no extension, no path).
--
-- Existing values are populated from the current hand-maintained widgetMap
-- in widget-factory.tsx so the codegen output is byte-equivalent on first run.
-- ============================================================================

BEGIN;

ALTER TABLE widget_catalog
  ADD COLUMN IF NOT EXISTS frontend_module TEXT;

-- Dedicated implementations (verified with real data)
UPDATE widget_catalog SET frontend_module = 'custom-my-card'      WHERE code = 'my_card';
UPDATE widget_catalog SET frontend_module = 'feed-widget'         WHERE code = 'notifications_feed';
UPDATE widget_catalog SET frontend_module = 'list-widget'         WHERE code = 'my_tasks';
UPDATE widget_catalog SET frontend_module = 'list-widget'         WHERE code = 'my_documents';
UPDATE widget_catalog SET frontend_module = 'kpi-ring-widget'     WHERE code = 'learning_progress';
UPDATE widget_catalog SET frontend_module = 'custom-career-path'  WHERE code = 'career_path';
UPDATE widget_catalog SET frontend_module = 'shortcut-widget'     WHERE code = 'quick_links';

-- Generic placeholders for everything else still active
UPDATE widget_catalog
   SET frontend_module = 'generic-placeholder'
 WHERE frontend_module IS NULL
   AND is_active = true;

-- Enforce NOT NULL once seeded for active rows
ALTER TABLE widget_catalog
  ADD CONSTRAINT widget_catalog_frontend_module_active_chk
  CHECK (NOT is_active OR frontend_module IS NOT NULL)
  NOT VALID;

ALTER TABLE widget_catalog VALIDATE CONSTRAINT widget_catalog_frontend_module_active_chk;

DO $$
DECLARE
    v_active INTEGER;
    v_with_module INTEGER;
    v_dedicated INTEGER;
    v_placeholders INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_active FROM widget_catalog WHERE is_active;
    SELECT COUNT(*) INTO v_with_module FROM widget_catalog WHERE is_active AND frontend_module IS NOT NULL;
    SELECT COUNT(*) INTO v_dedicated FROM widget_catalog WHERE is_active AND frontend_module <> 'generic-placeholder';
    SELECT COUNT(*) INTO v_placeholders FROM widget_catalog WHERE is_active AND frontend_module = 'generic-placeholder';
    RAISE NOTICE '[migration 173] active=% with_module=% dedicated=% placeholders=%',
        v_active, v_with_module, v_dedicated, v_placeholders;
    IF v_active <> v_with_module THEN
        RAISE EXCEPTION '[migration 173] % active widgets without frontend_module', v_active - v_with_module;
    END IF;
END $$;

COMMIT;
