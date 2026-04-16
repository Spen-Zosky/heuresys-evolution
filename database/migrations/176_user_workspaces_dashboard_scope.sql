-- ============================================================================
-- Migration 176: scope user_workspaces per dashboard + register composer nav
--                on all 11 dashboards
-- ============================================================================
-- TASK-13 follow-up (2026-04-11): users with multi-role access (e.g.
-- TENANT_OWNER who is also an EMPLOYEE) need separate, independent workspace
-- configurations per dashboard. Today user_workspaces has only (user_id,
-- tenant_id) scoping, which forces a single shared layout across dashboards.
--
-- This migration:
--   1. Adds `dashboard_id` UUID column to user_workspaces (nullable to keep
--      the legacy "default workspace" row alive during the transition).
--      NB: rbp_dashboards.id is INTEGER, so the column is INTEGER FK.
--   2. Adds a unique index on (user_id, tenant_id, dashboard_id) so the
--      backend can ensureDefaultWorkspace() per dashboard without collisions.
--      Uses NULLS NOT DISTINCT so legacy NULL-scoped rows remain unique.
--   3. Registers /portal/workspace/composer nav item on every active
--      dashboard (not just employee_portal) so the composer is discoverable
--      from every role's main sidebar. Each nav item lives in section 'tools'
--      with sort_order 500.
-- ============================================================================

BEGIN;

-- 1. dashboard_id column (nullable for legacy rows)
ALTER TABLE user_workspaces
  ADD COLUMN IF NOT EXISTS dashboard_id INTEGER REFERENCES rbp_dashboards(id) ON DELETE SET NULL;

-- 2. Composite unique constraint
DROP INDEX IF EXISTS user_workspaces_user_tenant_dashboard_uniq;
CREATE UNIQUE INDEX user_workspaces_user_tenant_dashboard_uniq
  ON user_workspaces (user_id, tenant_id, dashboard_id)
  NULLS NOT DISTINCT;

-- 3. Register nav items on ALL dashboards. Skip employee_portal because
--    migration 175 already created its entry. Idempotent via NOT EXISTS.
INSERT INTO rbp_dashboard_nav_items (
    dashboard_id, item_type, target_page_id, section,
    label_override, icon_override, sort_order, is_visible
)
SELECT
    d.id,
    'page',
    p.id,
    'tools',
    'Personalizza Workspace',
    'LayoutGrid',
    500,
    true
FROM rbp_dashboards d
CROSS JOIN rbp_pages p
WHERE p.code = 'workspace_composer'
  AND d.code <> 'employee_portal'  -- already covered by migration 175
  AND NOT EXISTS (
    SELECT 1 FROM rbp_dashboard_nav_items existing
    WHERE existing.dashboard_id = d.id
      AND existing.target_page_id = p.id
  );

DO $$
DECLARE
    v_nav INTEGER;
    v_col_exists BOOLEAN;
    v_idx_exists BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_nav
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_pages p ON nav.target_page_id = p.id
     WHERE p.code = 'workspace_composer' AND nav.is_visible;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name='user_workspaces' AND column_name='dashboard_id'
    ) INTO v_col_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE indexname='user_workspaces_user_tenant_dashboard_uniq'
    ) INTO v_idx_exists;

    RAISE NOTICE '[migration 176] nav_items_visible=% dashboard_id_col=% uniq_idx=%',
        v_nav, v_col_exists, v_idx_exists;

    IF v_nav < 11 THEN
        RAISE EXCEPTION '[migration 176] expected 11 visible nav items (one per dashboard), got %', v_nav;
    END IF;
    IF NOT v_col_exists OR NOT v_idx_exists THEN
        RAISE EXCEPTION '[migration 176] schema changes incomplete';
    END IF;
END $$;

COMMIT;
