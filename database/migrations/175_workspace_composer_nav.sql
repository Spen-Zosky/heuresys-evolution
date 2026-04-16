-- ============================================================================
-- Migration 175: register /portal/workspace/composer page and add nav item
-- ============================================================================
-- TASK-13 follow-up: the composer MVP landed at /portal/workspace/composer in
-- commit 4418cf3 but was not yet wired into rbp_pages / rbp_dashboard_nav_items,
-- so it only worked via direct URL. This migration:
--   1. creates the rbp_pages record (status ACTIVE, area WORKSPACE)
--   2. adds a visible nav item under the 'tools' section of employee_portal
-- so the composer becomes discoverable from the portal sidebar for every role
-- that lands on the employee_portal dashboard (= all 8 canonical roles).
-- ============================================================================

BEGIN;

INSERT INTO rbp_pages (
    code, name, description, route_path, functional_area_code,
    status, icon, requires_auth
) VALUES (
    'workspace_composer',
    'Personalizza Workspace',
    'Aggiungi o rimuovi widget dalla tua scrivania personale',
    '/portal/workspace/composer',
    'WORKSPACE',
    'ACTIVE',
    'LayoutGrid',
    true
) ON CONFLICT (code) DO UPDATE
    SET route_path = EXCLUDED.route_path,
        status     = 'ACTIVE',
        updated_at = NOW();

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
WHERE d.code = 'employee_portal'
  AND p.code = 'workspace_composer'
  AND NOT EXISTS (
    SELECT 1 FROM rbp_dashboard_nav_items existing
    WHERE existing.dashboard_id = d.id
      AND existing.target_page_id = p.id
  );

DO $$
DECLARE
    v_page INTEGER;
    v_nav INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_page FROM rbp_pages WHERE code='workspace_composer' AND status='ACTIVE';
    SELECT COUNT(*) INTO v_nav
      FROM rbp_dashboard_nav_items nav
      JOIN rbp_pages p ON nav.target_page_id = p.id
      JOIN rbp_dashboards d ON nav.dashboard_id = d.id
     WHERE p.code='workspace_composer' AND d.code='employee_portal' AND nav.is_visible;
    RAISE NOTICE '[migration 175] active_pages=% visible_nav_items=%', v_page, v_nav;
    IF v_page = 0 OR v_nav = 0 THEN
        RAISE EXCEPTION '[migration 175] page or nav item not registered correctly';
    END IF;
END $$;

COMMIT;
