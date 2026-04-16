-- Migration 085: Add tenant_id to RBAC and operational tables
-- Tables: role_permissions, employee_permission_overrides, ontology_inference_jobs
-- Note: ontology_embedding_jobs already has tenant_id (skipped)

BEGIN;

-- ============================================================
-- 1. role_permissions
--    System-level role-to-permission mappings.
--    Existing 813 rows have NULL granted_by (seeded data).
--    tenant_id is NULLABLE: NULL means system-wide default,
--    non-NULL means tenant-specific override.
-- ============================================================

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill: Existing rows are system-level defaults, keep tenant_id NULL.
-- No backfill needed - NULL tenant_id = system-wide permission mapping.
-- NOT NULL is NOT enforced: system-level rows must remain NULL.

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant
  ON role_permissions(tenant_id);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: allow access to system-wide rows (tenant_id IS NULL) OR tenant-specific rows
DROP POLICY IF EXISTS tenant_isolation ON role_permissions;
CREATE POLICY tenant_isolation ON role_permissions
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- 2. employee_permission_overrides
--    Per-employee permission overrides (0 rows currently).
--    Has employee_id FK -> employees.tenant_id for backfill.
--    tenant_id should be NOT NULL for data integrity.
-- ============================================================

ALTER TABLE employee_permission_overrides
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill from employees table (handles future rows with data)
UPDATE employee_permission_overrides epo
  SET tenant_id = e.tenant_id
  FROM employees e
  WHERE epo.employee_id = e.id
    AND epo.tenant_id IS NULL;

-- Set NOT NULL after backfill (table is currently empty, safe to enforce)
ALTER TABLE employee_permission_overrides
  ALTER COLUMN tenant_id SET NOT NULL;

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_employee_permission_overrides_tenant
  ON employee_permission_overrides(tenant_id);

-- Enable RLS
ALTER TABLE employee_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: strict tenant isolation
DROP POLICY IF EXISTS tenant_isolation ON employee_permission_overrides;
CREATE POLICY tenant_isolation ON employee_permission_overrides
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- 3. ontology_inference_jobs
--    Operational job tracking (0 rows currently).
--    Similar to ontology_embedding_jobs which already has tenant_id.
--    tenant_id is NULLABLE: some jobs may be cross-tenant.
-- ============================================================

ALTER TABLE ontology_inference_jobs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- No backfill needed (0 rows).
-- NOT NULL is NOT enforced: some inference jobs may span tenants.

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_inference_jobs_tenant
  ON ontology_inference_jobs(tenant_id);

-- Enable RLS
ALTER TABLE ontology_inference_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: match pattern from ontology_embedding_jobs
DROP POLICY IF EXISTS tenant_isolation ON ontology_inference_jobs;
CREATE POLICY tenant_isolation ON ontology_inference_jobs
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- 4. ontology_embedding_jobs (SKIPPED)
--    Already has tenant_id column and RLS enabled.
--    Already has idx_embedding_jobs_tenant index.
--    Already has tenant_isolation policy.
-- ============================================================

COMMIT;
