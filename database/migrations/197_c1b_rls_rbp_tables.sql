-- Migration 197: C.1b Block A — RLS on 5 RBP tables
--
-- Enables Row-Level Security on rbp_sections, rbp_section_translations,
-- rbp_teams, rbp_team_members, rbp_team_leaders with 3 distinct patterns:
--
-- 1. Platform-OR-Tenant (P10): rbp_sections, rbp_section_translations
--    All rows currently have tenant_id = NULL (platform-shared data).
--    Policy allows reading platform rows + own tenant rows. Writes restricted
--    to own tenant — platform writes must go through SUPERUSER + dedicated API.
--
-- 2. Tenant-scoped: rbp_teams (direct tenant_id column)
--
-- 3. Tenant via FK: rbp_team_members, rbp_team_leaders
--    No tenant_id column; isolation via team_id -> rbp_teams.tenant_id.
--
-- NOTE: FORCE ROW LEVEL SECURITY applies to table owner too, but NOT to
-- SUPERUSER / BYPASSRLS roles. The `heuresys` pool (BYPASSRLS) is unaffected;
-- only `heuresys_app` (no bypass) will be filtered. Routes currently using
-- the superuser `pool` (e.g. routes/rbp.ts) keep unchanged behavior — to be
-- migrated to `req.dbClient` / `appPool` in a separate session (scope creep).
--
-- Idempotent: ENABLE is no-op if already enabled; CREATE POLICY uses DROP-first
-- to allow re-running.

BEGIN;

-- ---------------------------------------------------------------------------
-- Pattern 1: Platform-OR-Tenant (rbp_sections, rbp_section_translations)
-- ---------------------------------------------------------------------------

ALTER TABLE rbp_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbp_sections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rbp_sections;
CREATE POLICY tenant_isolation ON rbp_sections
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

ALTER TABLE rbp_section_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbp_section_translations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rbp_section_translations;
CREATE POLICY tenant_isolation ON rbp_section_translations
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- Pattern 2: Tenant-scoped (rbp_teams)
-- ---------------------------------------------------------------------------

ALTER TABLE rbp_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbp_teams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rbp_teams;
CREATE POLICY tenant_isolation ON rbp_teams
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- Pattern 3: Tenant via FK team_id (rbp_team_members, rbp_team_leaders)
-- ---------------------------------------------------------------------------

ALTER TABLE rbp_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbp_team_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rbp_team_members;
CREATE POLICY tenant_isolation ON rbp_team_members
  FOR ALL
  USING (
    team_id IN (
      SELECT id FROM rbp_teams
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM rbp_teams
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

ALTER TABLE rbp_team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbp_team_leaders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON rbp_team_leaders;
CREATE POLICY tenant_isolation ON rbp_team_leaders
  FOR ALL
  USING (
    team_id IN (
      SELECT id FROM rbp_teams
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM rbp_teams
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

COMMIT;
