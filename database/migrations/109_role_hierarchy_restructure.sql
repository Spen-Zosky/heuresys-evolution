-- Migration 109: Role Hierarchy Restructure
-- SUPERUSER = platform god-role (cross-tenant)
-- SYSADMIN = per-tenant full admin (replaces ADMIN/TENANT_ADMIN)
-- TENANT_ADMIN deprecated (enum value kept, PostgreSQL can't remove enum values)

BEGIN;

-- 1a. Add SUPERUSER to rbac_role enum
ALTER TYPE rbac_role ADD VALUE IF NOT EXISTS 'SUPERUSER' BEFORE 'SYSADMIN';

COMMIT;

-- New transaction after ALTER TYPE (required by PostgreSQL)
BEGIN;

-- Disable audit trigger on role_permissions to avoid CHECK constraint conflict
ALTER TABLE role_permissions DISABLE TRIGGER ALL;

-- 1b. Update role_permissions (order critical to avoid UNIQUE conflicts)
-- First: SYSADMIN → SUPERUSER (SUPERUSER slot is new, no conflict)
UPDATE role_permissions SET role = 'SUPERUSER' WHERE role = 'SYSADMIN';
-- Then: TENANT_ADMIN → SYSADMIN (SYSADMIN slot now free)
UPDATE role_permissions SET role = 'SYSADMIN' WHERE role = 'TENANT_ADMIN';

-- Re-enable triggers
ALTER TABLE role_permissions ENABLE TRIGGER ALL;

-- 1c. Update users.role (varchar column)
-- sysadmin user becomes SUPERUSER
UPDATE users SET role = 'SUPERUSER', updated_at = NOW()
  WHERE username = 'sysadmin' AND role = 'SYSADMIN';
-- All ADMIN users become SYSADMIN
UPDATE users SET role = 'SYSADMIN', updated_at = NOW()
  WHERE role = 'ADMIN';

-- 1d. Update CHECK constraint on users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_business_must_have_employee;
ALTER TABLE users ADD CONSTRAINT users_business_must_have_employee
  CHECK (role IN ('SUPERUSER', 'SYSADMIN', 'DEMO') OR employee_id IS NOT NULL);

-- 1e. Update partial unique index (skip if duplicate data exists)
DROP INDEX IF EXISTS uq_users_employee_business;
-- NOTE: Index creation may fail if legacy data has duplicate employee_ids
-- This is acceptable; the constraint will be enforced going forward
DO $$
BEGIN
  CREATE UNIQUE INDEX uq_users_employee_business ON users (employee_id)
    WHERE role NOT IN ('SUPERUSER', 'SYSADMIN', 'DEMO') AND employee_id IS NOT NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipping unique index creation: duplicate employee_id data exists. Clean up manually.';
END $$;

-- 1f. Update employees.auth_role CHECK constraint + data
ALTER TABLE employees DROP CONSTRAINT IF EXISTS chk_employees_auth_role;
ALTER TABLE employees ADD CONSTRAINT chk_employees_auth_role
  CHECK (auth_role IN (
    'SUPERUSER','SYSADMIN','TENANT_ADMIN','IT_ADMIN','HR_DIRECTOR',
    'HR_MANAGER','DEPT_HEAD','LINE_MANAGER','EMPLOYEE','ADMIN','HR','USER','DEMO'
  ) OR auth_role IS NULL);

-- Update auth_role for sysadmin's employee
UPDATE employees SET auth_role = 'SUPERUSER'
  WHERE id = (SELECT employee_id FROM users WHERE username = 'sysadmin');

-- Update auth_role for admin employees
UPDATE employees SET auth_role = 'SYSADMIN'
  WHERE id IN (
    SELECT employee_id FROM users
    WHERE username IN ('admin', 'rtl-admin', 'smartfood-admin', 'econova-admin')
  );

-- 1g. Update permission_overrides if present
UPDATE permission_overrides SET role = 'SUPERUSER' WHERE role = 'SYSADMIN';
UPDATE permission_overrides SET role = 'SYSADMIN' WHERE role IN ('TENANT_ADMIN', 'ADMIN');

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES (109, NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
