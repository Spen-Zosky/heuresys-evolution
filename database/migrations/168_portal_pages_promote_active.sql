-- ============================================================================
-- Migration 168: Promote portal pages from DEMO to ACTIVE
-- ============================================================================
-- After live E2E verification (Pietro Barbieri, 2026-04-10) the following
-- portal pages are confirmed to render real data from the DB via API.
-- They can leave the DEMO status and become production-ACTIVE.
--
-- Pages left in DEMO: my_line, recognition_portal, my_leave (duplicate of
-- my_time_off) — not yet verified or still stubs. They stay DEMO until
-- further work.
-- ============================================================================

BEGIN;

-- Promote verified pages
UPDATE rbp_pages
   SET status = 'ACTIVE', updated_at = NOW()
 WHERE status = 'DEMO'
   AND code IN (
       'my_goals',          -- /portal/goals
       'my_learning',       -- /portal/learning
       'my_documents',      -- /portal/documents
       'my_reviews',        -- /portal/reviews
       'my_payslips',       -- /portal/payroll
       'approvals'          -- /portal/approvals
   );

-- Verification
DO $$
DECLARE
    v_active_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_active_count
      FROM rbp_pages
     WHERE status = 'ACTIVE'
       AND route_path LIKE '/portal%';
    RAISE NOTICE 'Portal pages ACTIVE after migration: %', v_active_count;
END $$;

COMMIT;
