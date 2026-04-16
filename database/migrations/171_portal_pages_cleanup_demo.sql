-- ============================================================================
-- Migration 171: Cleanup residual DEMO portal pages
-- ============================================================================
-- After the reuse-first refactor (2026-04-10), three pages remained in DEMO
-- status:
--
--   my_leave           -> /portal/time-off    (duplicate of my_time_off ACTIVE)
--   my_line            -> /portal/my-line     (no frontend file exists)
--   recognition_portal -> /portal/recognition (no frontend file exists)
--
-- None of them resolve to working pages. We mark them DISABLED so they no
-- longer appear as DEMO warnings and can be either implemented later or
-- deleted cleanly.
-- ============================================================================

BEGIN;

UPDATE rbp_pages
   SET status = 'DISABLED', updated_at = NOW()
 WHERE code IN ('my_leave', 'my_line', 'recognition_portal');

-- Also hide any nav items pointing to these (if present)
UPDATE rbp_dashboard_nav_items nav
   SET is_visible = false
  FROM rbp_pages p
 WHERE nav.target_page_id = p.id
   AND p.code IN ('my_leave', 'my_line', 'recognition_portal');

DO $$
DECLARE
    v_demo INTEGER;
    v_disabled INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_demo
      FROM rbp_pages WHERE status='DEMO' AND route_path LIKE '/portal%';
    SELECT COUNT(*) INTO v_disabled
      FROM rbp_pages WHERE status='DISABLED' AND route_path LIKE '/portal%';
    RAISE NOTICE 'Portal pages after cleanup: DEMO=%, DISABLED=%', v_demo, v_disabled;
END $$;

COMMIT;
