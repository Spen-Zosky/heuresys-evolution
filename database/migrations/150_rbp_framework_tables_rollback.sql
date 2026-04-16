-- ============================================================================
-- Rollback Migration 150: RBP Framework
-- ============================================================================

BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_rbp_roles_updated_at ON rbp_roles;
DROP TRIGGER IF EXISTS trg_rbp_dashboards_updated_at ON rbp_dashboards;
DROP TRIGGER IF EXISTS trg_rbp_pages_updated_at ON rbp_pages;
DROP TRIGGER IF EXISTS trg_rbp_fa_updated_at ON rbp_functional_areas;
DROP TRIGGER IF EXISTS trg_rbp_rp_updated_at ON rbp_role_permissions;
DROP TRIGGER IF EXISTS trg_rbp_fp_updated_at ON rbp_field_policies;

-- Drop functions
DROP FUNCTION IF EXISTS rbp_set_updated_at();
DROP FUNCTION IF EXISTS rbp_get_recursive_reports(UUID);
DROP FUNCTION IF EXISTS rbp_get_user_effective_permissions(VARCHAR);

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS rbp_team_leaders CASCADE;
DROP TABLE IF EXISTS rbp_team_members CASCADE;
DROP TABLE IF EXISTS rbp_teams CASCADE;
DROP TABLE IF EXISTS rbp_field_policies CASCADE;
DROP TABLE IF EXISTS rbp_scope_rules CASCADE;
DROP TABLE IF EXISTS rbp_role_permissions CASCADE;
DROP TABLE IF EXISTS rbp_dashboard_nav_items CASCADE;
DROP TABLE IF EXISTS rbp_role_dashboards CASCADE;
DROP TABLE IF EXISTS rbp_pages CASCADE;
DROP TABLE IF EXISTS rbp_data_classifications CASCADE;
DROP TABLE IF EXISTS rbp_dashboards CASCADE;
DROP TABLE IF EXISTS rbp_functional_areas CASCADE;
DROP TABLE IF EXISTS rbp_roles CASCADE;

COMMIT;
