-- Migration: 093_rls_join_tables_tenant_id.sql
-- Description: Add tenant_id column and RLS policies to 3 tables that have
--              RLS enabled but no tenant_id and no policies.
-- Date: 2026-02-25

BEGIN;

-- 1. calibration_participants (joins via session_id -> calibration_sessions.tenant_id)
ALTER TABLE calibration_participants ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE calibration_participants cp
SET tenant_id = cs.tenant_id
FROM calibration_sessions cs
WHERE cp.session_id = cs.id AND cp.tenant_id IS NULL;
ALTER TABLE calibration_participants ALTER COLUMN tenant_id SET NOT NULL;
CREATE POLICY tenant_isolation ON calibration_participants
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON calibration_participants
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 2. course_enrollments (joins via employee_id -> employees.tenant_id)
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE course_enrollments ce
SET tenant_id = e.tenant_id
FROM employees e
WHERE ce.employee_id = e.id AND ce.tenant_id IS NULL;
-- Some enrollments may not have matching employees; set default
UPDATE course_enrollments SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE course_enrollments ALTER COLUMN tenant_id SET NOT NULL;
CREATE POLICY tenant_isolation ON course_enrollments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON course_enrollments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3. learning_path_enrollments (joins via employee_id -> employees.tenant_id)
ALTER TABLE learning_path_enrollments ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE learning_path_enrollments lpe
SET tenant_id = e.tenant_id
FROM employees e
WHERE lpe.employee_id = e.id AND lpe.tenant_id IS NULL;
UPDATE learning_path_enrollments SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE learning_path_enrollments ALTER COLUMN tenant_id SET NOT NULL;
CREATE POLICY tenant_isolation ON learning_path_enrollments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_insert ON learning_path_enrollments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMIT;
