-- 163_employee_portal_all_roles.sql
-- Every user is always an EMPLOYEE too — add employee_portal dashboard
-- to all roles so DashboardSwitcher can offer it.
-- SUPERUSER excluded (platform-level, no tenant context).

BEGIN;

INSERT INTO rbp_role_dashboards (role_id, dashboard_id, is_default)
SELECT r.id, d.id, false
FROM rbp_roles r
CROSS JOIN rbp_dashboards d
WHERE d.code = 'employee_portal'
  AND r.code NOT IN ('EMPLOYEE', 'SUPERUSER')
  AND NOT EXISTS (
    SELECT 1 FROM rbp_role_dashboards rd
    WHERE rd.role_id = r.id AND rd.dashboard_id = d.id
  );

COMMIT;
