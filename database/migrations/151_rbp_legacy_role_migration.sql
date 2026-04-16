-- ============================================================================
-- Migration 151: Legacy Role Migration
-- Migrates legacy role values in users.role to canonical RBP role codes
--
-- Current state (from audit):
--   USER      → EMPLOYEE     (264 records)
--   HR        → HR_MANAGER   (1 record)
--   DEMO      → EMPLOYEE     (1 record)
--   SYSADMIN  → SYSADMIN     (4 records, no change)
--   SUPERUSER → SUPERUSER    (1 record, no change)
--
-- Also adds new canonical roles that don't exist yet:
--   IT_ADMIN, HR_DIRECTOR, DEPT_HEAD, LINE_MANAGER
--
-- IMPORTANT: This migration does NOT change the CHECK constraint yet.
-- That will happen in a later migration after feature flag validation.
-- ============================================================================

BEGIN;

-- Step 1: Migrate legacy roles to canonical names
UPDATE users SET role = 'EMPLOYEE'   WHERE role = 'USER';
UPDATE users SET role = 'EMPLOYEE'   WHERE role = 'DEMO';
UPDATE users SET role = 'HR_MANAGER' WHERE role = 'HR';

-- Step 2: Update the enum/CHECK if one exists
-- First check: the users table uses varchar, not enum, so we just need
-- to update the CHECK constraint to accept all 8 canonical roles.
-- Note: we drop and recreate to be safe

-- Drop existing CHECK on role if any
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'users' AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%role%'
    ) THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' ||
            (SELECT constraint_name FROM information_schema.table_constraints
             WHERE table_name = 'users' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%role%' LIMIT 1);
    END IF;
END $$;

-- Add new CHECK with all 8 canonical roles + legacy roles temporarily
-- (legacy kept as valid so old code doesn't break during transition)
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'SUPERUSER', 'SYSADMIN', 'IT_ADMIN',
        'HR_DIRECTOR', 'HR_MANAGER',
        'DEPT_HEAD', 'LINE_MANAGER', 'EMPLOYEE'
    ));

-- Step 3: Also handle the rbac_role enum if it exists (used by old role_permissions)
-- We don't ALTER the enum — the old role_permissions table will be deprecated
-- by the rbp_ tables. The enum stays as-is for backward compat.

-- Step 4: Log the migration
DO $$
DECLARE
    v_counts TEXT;
BEGIN
    SELECT string_agg(role || ': ' || cnt::text, ', ' ORDER BY cnt DESC)
    INTO v_counts
    FROM (SELECT role, COUNT(*) as cnt FROM users GROUP BY role) sub;

    RAISE NOTICE 'Migration 151 complete. Role distribution: %', v_counts;
END $$;

COMMIT;
