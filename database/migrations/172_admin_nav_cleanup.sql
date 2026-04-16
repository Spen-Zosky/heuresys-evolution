-- ============================================================================
-- Migration 172: Cleanup admin nav items referencing non-existent pages
-- ============================================================================
-- Identified during multi-role-dashboards.mjs E2E runs: 41 nav items across 7
-- dashboards (executive_overview, hr_strategic, hr_operations, department_console,
-- manager_hub, platform_console, tech_admin) point to 8 rbp_pages whose
-- route_paths have no corresponding frontend file:
--
--   /admin/departments        (departments)
--   /admin/teams              (team_management)
--   /admin/workspace          (workspace_admin)
--   /workspace/editor         (workspace_editor)
--   /workspace/templates      (workspace_templates)
--   /perspectives/enterprise  (perspective_enterprise)
--   /perspectives/process     (perspective_process)
--   /perspectives/talent      (perspective_talent)
--
-- The pages are still ACTIVE in rbp_pages and nav items are still visible,
-- causing RSC prefetch 404s to leak into governance logs. We mark the pages
-- DISABLED and hide all nav items pointing to them. They can be re-enabled
-- when proper implementations land (tracked as TASK-05 follow-up in
-- NEXT_SESSION_PLAN.md and future PET/workspace epics).
-- ============================================================================

BEGIN;

-- 1. Mark affected rbp_pages as DISABLED
UPDATE rbp_pages
   SET status = 'DISABLED', updated_at = NOW()
 WHERE code IN (
   'departments',
   'team_management',
   'workspace_admin',
   'workspace_editor',
   'workspace_templates',
   'perspective_enterprise',
   'perspective_process',
   'perspective_talent'
 );

-- 2. Hide nav items pointing to disabled pages
UPDATE rbp_dashboard_nav_items nav
   SET is_visible = false
  FROM rbp_pages p
 WHERE nav.target_page_id = p.id
   AND p.code IN (
     'departments',
     'team_management',
     'workspace_admin',
     'workspace_editor',
     'workspace_templates',
     'perspective_enterprise',
     'perspective_process',
     'perspective_talent'
   );

DO $$
DECLARE
    v_pages_disabled INTEGER;
    v_nav_hidden INTEGER;
    v_visible_nav_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_pages_disabled
      FROM rbp_pages
     WHERE code IN (
       'departments', 'team_management', 'workspace_admin',
       'workspace_editor', 'workspace_templates',
       'perspective_enterprise', 'perspective_process', 'perspective_talent'
     )
       AND status = 'DISABLED';

    SELECT COUNT(*) INTO v_nav_hidden
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_pages p ON nav.target_page_id = p.id
     WHERE p.code IN (
       'departments', 'team_management', 'workspace_admin',
       'workspace_editor', 'workspace_templates',
       'perspective_enterprise', 'perspective_process', 'perspective_talent'
     )
       AND nav.is_visible = false;

    SELECT COUNT(*) INTO v_visible_nav_remaining
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_pages p ON nav.target_page_id = p.id
     WHERE p.code IN (
       'departments', 'team_management', 'workspace_admin',
       'workspace_editor', 'workspace_templates',
       'perspective_enterprise', 'perspective_process', 'perspective_talent'
     )
       AND nav.is_visible = true;

    RAISE NOTICE '[migration 172] pages DISABLED: % | nav items hidden: % | still visible: %',
        v_pages_disabled, v_nav_hidden, v_visible_nav_remaining;

    IF v_visible_nav_remaining > 0 THEN
        RAISE EXCEPTION '[migration 172] % nav items still visible after cleanup', v_visible_nav_remaining;
    END IF;
END $$;

COMMIT;
