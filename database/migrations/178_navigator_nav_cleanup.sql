-- ============================================================================
-- Migration 178: Hide Navigator + Perspectives admin pages not implemented
-- ============================================================================
-- Follow-up to migration 172. The multi-role-deep-coverage E2E (2026-04-11)
-- surfaced 4 ACTIVE rbp_pages with visible nav items but no corresponding
-- page.tsx under services/frontend/src/app/admin/**:
--   - /admin/navigator/config, /admin/navigator/preview, /admin/navigator/audit
--   - /admin/perspectives/config
-- There is no backend nor any short-term plan to implement them. We mark the
-- pages DISABLED and hide the nav items to clear the E2E gate, the same pattern
-- used in migration 172.
--
-- Note: /platform/system-health is the 4th path from the same audit and is NOT
-- cleaned up here — it is implemented in the companion commit as a thin wrapper
-- over GET /health.
-- ============================================================================

BEGIN;

-- 1. Mark affected rbp_pages as DISABLED
UPDATE rbp_pages
   SET status = 'DISABLED', updated_at = NOW()
 WHERE code IN (
   'navigator_config',
   'navigator_preview',
   'navigator_audit',
   'perspective_config'
 );

-- 2. Hide nav items pointing to disabled pages
UPDATE rbp_dashboard_nav_items nav
   SET is_visible = false
  FROM rbp_pages p
 WHERE nav.target_page_id = p.id
   AND p.code IN (
     'navigator_config',
     'navigator_preview',
     'navigator_audit',
     'perspective_config'
   );

DO $$
DECLARE
    v_pages_disabled INTEGER;
    v_nav_hidden INTEGER;
    v_visible_nav_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_pages_disabled
      FROM rbp_pages
     WHERE code IN ('navigator_config', 'navigator_preview', 'navigator_audit', 'perspective_config')
       AND status = 'DISABLED';

    SELECT COUNT(*) INTO v_nav_hidden
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_pages p ON nav.target_page_id = p.id
     WHERE p.code IN ('navigator_config', 'navigator_preview', 'navigator_audit', 'perspective_config')
       AND nav.is_visible = false;

    SELECT COUNT(*) INTO v_visible_nav_remaining
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_pages p ON nav.target_page_id = p.id
     WHERE p.code IN ('navigator_config', 'navigator_preview', 'navigator_audit', 'perspective_config')
       AND nav.is_visible = true;

    RAISE NOTICE '[migration 178] pages DISABLED: % | nav items hidden: % | still visible: %',
        v_pages_disabled, v_nav_hidden, v_visible_nav_remaining;

    IF v_visible_nav_remaining > 0 THEN
        RAISE EXCEPTION '[migration 178] % nav items still visible after cleanup', v_visible_nav_remaining;
    END IF;
END $$;

COMMIT;
