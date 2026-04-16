-- ============================================================================
-- Migration 177: relax legacy "one default workspace per user" constraint
-- ============================================================================
-- Migration 176 added dashboard_id scoping to user_workspaces but the existing
-- idx_user_workspaces_default partial unique index still enforces "one default
-- per user" globally. That blocks saving a distinct default workspace per
-- dashboard context. This migration drops the legacy index and replaces it
-- with one scoped per (user_id, dashboard_id) so each dashboard can have its
-- own is_default=true row without colliding with the others.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_user_workspaces_default;

CREATE UNIQUE INDEX idx_user_workspaces_default_per_dashboard
  ON user_workspaces (user_id, dashboard_id)
  WHERE is_default = true;

DO $$
DECLARE
    v_new_idx BOOLEAN;
    v_legacy  BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_user_workspaces_default_per_dashboard') INTO v_new_idx;
    SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_user_workspaces_default') INTO v_legacy;
    RAISE NOTICE '[migration 177] new_idx=% legacy_idx=%', v_new_idx, v_legacy;
    IF NOT v_new_idx OR v_legacy THEN
        RAISE EXCEPTION '[migration 177] index swap incomplete';
    END IF;
END $$;

COMMIT;
