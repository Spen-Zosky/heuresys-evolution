-- Migration: 061_employee_role_migration.sql
-- Description: Migrate employee roles from legacy to RBAC based on job titles and direct reports
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- BACKUP EXISTING ROLES
-- ============================================================================

-- Create backup table for rollback capability
DROP TABLE IF EXISTS employees_role_backup;
CREATE TABLE employees_role_backup AS
SELECT id, tenant_id, auth_role, auth_permissions, job_title, manager_id
FROM employees;

RAISE NOTICE 'Created employees_role_backup table';

-- ============================================================================
-- ROLE MIGRATION LOGIC
-- Based on job titles and organizational structure
-- ============================================================================

-- STEP 1: CEO/COO -> TENANT_ADMIN
-- These are the highest tenant-level executives
UPDATE employees
SET auth_role = 'TENANT_ADMIN'
WHERE job_title ~* '(^CEO$|^COO$|Chief Executive|Chief Operating|Managing Director|Direttore Generale|Amministratore Delegato)'
AND tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys') -- Exclude platform tenant
AND (auth_role IS NULL OR auth_role IN ('USER', 'EMPLOYEE', 'ADMIN'));

RAISE NOTICE 'Updated CEO/COO to TENANT_ADMIN';

-- STEP 2: IT Leadership -> IT_ADMIN
-- CTO, CIO, IT Directors, Technology leaders
UPDATE employees
SET auth_role = 'IT_ADMIN'
WHERE job_title ~* '(^CTO$|^CIO$|Chief Technology|Chief Information|IT Director|Direttore IT|Direttore Sistemi|Head of IT|Head of Technology)'
AND tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys')
AND (auth_role IS NULL OR auth_role IN ('USER', 'EMPLOYEE'))
AND auth_role != 'TENANT_ADMIN'; -- Don't override if already assigned

RAISE NOTICE 'Updated IT Leadership to IT_ADMIN';

-- STEP 3: HR Leadership -> HR_DIRECTOR
-- CHRO, HR Directors, People Directors
UPDATE employees
SET auth_role = 'HR_DIRECTOR'
WHERE job_title ~* '(^CHRO$|Chief HR|Chief People|HR Director|Direttore HR|Direttore Risorse Umane|Head of HR|Head of People|VP Human Resources)'
AND tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys')
AND (auth_role IS NULL OR auth_role IN ('USER', 'EMPLOYEE'))
AND auth_role NOT IN ('TENANT_ADMIN', 'IT_ADMIN');

RAISE NOTICE 'Updated HR Leadership to HR_DIRECTOR';

-- STEP 4: HR Managers -> HR_MANAGER
-- HR Business Partners, HR Managers, People Partners
UPDATE employees
SET auth_role = 'HR_MANAGER'
WHERE job_title ~* '(HR Manager|HR Business Partner|People Manager|People Partner|Responsabile HR|Responsabile Risorse Umane|HR Specialist Senior|HRBP)'
AND tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys')
AND (auth_role IS NULL OR auth_role IN ('USER', 'EMPLOYEE'))
AND auth_role NOT IN ('TENANT_ADMIN', 'IT_ADMIN', 'HR_DIRECTOR');

RAISE NOTICE 'Updated HR Managers to HR_MANAGER';

-- STEP 5: Department Heads -> DEPT_HEAD
-- Based on: 10+ direct reports OR department head titles
UPDATE employees e
SET auth_role = 'DEPT_HEAD'
WHERE (
    -- By title pattern
    e.job_title ~* '(Department Head|Responsabile Reparto|Department Manager|Capo Reparto|Division Head|Division Manager|Area Manager)'
    OR
    -- By significant number of direct reports (10+)
    (SELECT COUNT(*) FROM employees WHERE manager_id = e.id) >= 10
)
AND e.tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys')
AND (e.auth_role IS NULL OR e.auth_role IN ('USER', 'EMPLOYEE'))
AND e.auth_role NOT IN ('TENANT_ADMIN', 'IT_ADMIN', 'HR_DIRECTOR', 'HR_MANAGER');

RAISE NOTICE 'Updated Department Heads to DEPT_HEAD';

-- STEP 6: Line Managers -> LINE_MANAGER
-- Anyone with 1-9 direct reports who isn't already assigned a higher role
UPDATE employees e
SET auth_role = 'LINE_MANAGER'
WHERE EXISTS (SELECT 1 FROM employees WHERE manager_id = e.id)
AND (SELECT COUNT(*) FROM employees WHERE manager_id = e.id) BETWEEN 1 AND 9
AND e.tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys')
AND (e.auth_role IS NULL OR e.auth_role IN ('USER', 'EMPLOYEE'))
AND e.auth_role NOT IN ('TENANT_ADMIN', 'IT_ADMIN', 'HR_DIRECTOR', 'HR_MANAGER', 'DEPT_HEAD');

RAISE NOTICE 'Updated Line Managers to LINE_MANAGER';

-- STEP 7: All remaining active employees -> EMPLOYEE
-- Default role for all workers
UPDATE employees
SET auth_role = 'EMPLOYEE'
WHERE tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys')
AND (auth_role IS NULL OR auth_role IN ('USER'));

RAISE NOTICE 'Updated remaining to EMPLOYEE';

-- ============================================================================
-- MAINTAIN LEGACY COMPATIBILITY
-- Map legacy roles to new RBAC roles for existing records
-- ============================================================================

-- Map 'ADMIN' -> 'TENANT_ADMIN' (if not already mapped)
UPDATE employees
SET auth_role = 'TENANT_ADMIN'
WHERE auth_role = 'ADMIN'
AND tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys');

-- Map 'HR' -> 'HR_MANAGER' (if not already mapped)
UPDATE employees
SET auth_role = 'HR_MANAGER'
WHERE auth_role = 'HR'
AND tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys');

-- Ensure Heuresys platform users keep their special roles
-- SYSADMIN stays as SYSADMIN (or null for platform tenant)
-- Don't modify heuresys tenant employees

-- ============================================================================
-- UPDATE DEPARTMENTS HEAD_ID BASED ON NEW ROLES
-- Assign DEPT_HEAD or highest role as department head
-- ============================================================================

UPDATE departments d
SET head_id = (
    SELECT e.id
    FROM employees e
    WHERE e.department_id = d.id
    AND e.is_active = true
    ORDER BY
        CASE e.auth_role
            WHEN 'TENANT_ADMIN' THEN 1
            WHEN 'HR_DIRECTOR' THEN 2
            WHEN 'IT_ADMIN' THEN 3
            WHEN 'DEPT_HEAD' THEN 4
            WHEN 'HR_MANAGER' THEN 5
            WHEN 'LINE_MANAGER' THEN 6
            WHEN 'EMPLOYEE' THEN 7
            ELSE 8
        END,
        e.created_at ASC
    LIMIT 1
)
WHERE d.head_id IS NULL
AND d.tenant_id IN (SELECT id FROM tenants WHERE code != 'heuresys');

RAISE NOTICE 'Updated department heads based on new roles';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_tenant_admin_count INTEGER;
    v_it_admin_count INTEGER;
    v_hr_director_count INTEGER;
    v_hr_manager_count INTEGER;
    v_dept_head_count INTEGER;
    v_line_manager_count INTEGER;
    v_employee_count INTEGER;
    v_null_count INTEGER;
    v_total INTEGER;
BEGIN
    -- Count by role (excluding heuresys tenant)
    SELECT COUNT(*) INTO v_tenant_admin_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'TENANT_ADMIN' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_it_admin_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'IT_ADMIN' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_hr_director_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'HR_DIRECTOR' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_hr_manager_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'HR_MANAGER' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_dept_head_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'DEPT_HEAD' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_line_manager_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'LINE_MANAGER' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_employee_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role = 'EMPLOYEE' AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_null_count
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.auth_role IS NULL AND t.code != 'heuresys';

    SELECT COUNT(*) INTO v_total
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code != 'heuresys';

    RAISE NOTICE '=== Migration 061 Verification ===';
    RAISE NOTICE 'Role Distribution (tenant employees only):';
    RAISE NOTICE '  TENANT_ADMIN: %', v_tenant_admin_count;
    RAISE NOTICE '  IT_ADMIN: %', v_it_admin_count;
    RAISE NOTICE '  HR_DIRECTOR: %', v_hr_director_count;
    RAISE NOTICE '  HR_MANAGER: %', v_hr_manager_count;
    RAISE NOTICE '  DEPT_HEAD: %', v_dept_head_count;
    RAISE NOTICE '  LINE_MANAGER: %', v_line_manager_count;
    RAISE NOTICE '  EMPLOYEE: %', v_employee_count;
    RAISE NOTICE '  NULL/Unassigned: %', v_null_count;
    RAISE NOTICE '  ----------------------';
    RAISE NOTICE '  TOTAL: %', v_total;
    RAISE NOTICE '';

    IF v_null_count = 0 THEN
        RAISE NOTICE 'Migration 061 completed successfully! All employees have roles.';
    ELSE
        RAISE WARNING 'Migration 061 has % employees without roles', v_null_count;
    END IF;
END $$;
