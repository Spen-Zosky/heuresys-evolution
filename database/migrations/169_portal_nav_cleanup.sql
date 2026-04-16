-- ============================================================================
-- Migration 169: Cleanup employee_portal nav items
-- ============================================================================
-- Remove invisible nav items from employee_portal dashboard that either:
--   (a) point to /admin/* or /workspace/* — out of portal scope
--   (b) are duplicate/stale entries (e.g. duplicate /portal/time-off,
--       /portal/recognition stale)
--
-- Items removed are NOT functional (is_visible=false) — they clutter the
-- sidebar data model without contributing. The audit query below is kept
-- so reviewers see exactly what was deleted.
-- ============================================================================

BEGIN;

-- Audit: what will be deleted
-- (shown via RAISE NOTICE so the migration output is self-documenting)
DO $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r IN
        SELECT nav.id, nav.label_override, p.route_path
          FROM rbp_dashboard_nav_items nav
          LEFT JOIN rbp_pages p ON nav.target_page_id = p.id
          JOIN rbp_dashboards d ON nav.dashboard_id = d.id
         WHERE d.code = 'employee_portal'
           AND nav.is_visible = false
           AND (
               p.route_path LIKE '/admin%' OR
               p.route_path LIKE '/workspace%' OR
               p.route_path LIKE '/perspectives%' OR
               -- duplicate / stale portal entries
               (p.route_path = '/portal/time-off' AND nav.label_override IS NULL) OR
               (p.route_path = '/portal/recognition' AND nav.label_override IS NULL)
           )
    LOOP
        RAISE NOTICE 'DELETE nav_item #%: % -> %', r.id, COALESCE(r.label_override,''), r.route_path;
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE 'Total nav items to remove: %', v_count;
END $$;

-- Perform deletion
DELETE FROM rbp_dashboard_nav_items nav
 USING rbp_pages p, rbp_dashboards d
 WHERE nav.target_page_id = p.id
   AND nav.dashboard_id = d.id
   AND d.code = 'employee_portal'
   AND nav.is_visible = false
   AND (
       p.route_path LIKE '/admin%' OR
       p.route_path LIKE '/workspace%' OR
       p.route_path LIKE '/perspectives%' OR
       (p.route_path = '/portal/time-off' AND nav.label_override IS NULL) OR
       (p.route_path = '/portal/recognition' AND nav.label_override IS NULL)
   );

-- Post-verification
DO $$
DECLARE
    v_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_remaining
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_dashboards d ON nav.dashboard_id = d.id
     WHERE d.code = 'employee_portal';
    RAISE NOTICE 'Nav items remaining in employee_portal: %', v_remaining;
END $$;

COMMIT;
