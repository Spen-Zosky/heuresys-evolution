-- Migration: 060_departments_head_id.sql
-- Description: Add head_id column to departments for DEPT_HEAD role support
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- ADD HEAD_ID COLUMN TO DEPARTMENTS
-- ============================================================================

-- Add head_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'departments' AND column_name = 'head_id'
    ) THEN
        ALTER TABLE departments ADD COLUMN head_id UUID REFERENCES employees(id);
        RAISE NOTICE 'Added head_id column to departments table';
    ELSE
        RAISE NOTICE 'head_id column already exists in departments table';
    END IF;
END $$;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_departments_head_id ON departments(head_id);

-- ============================================================================
-- ADD MANAGER_ID TO ORG_UNITS (if not exists)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'org_units' AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE org_units ADD COLUMN manager_id UUID REFERENCES employees(id);
        RAISE NOTICE 'Added manager_id column to org_units table';
    ELSE
        RAISE NOTICE 'manager_id column already exists in org_units table';
    END IF;
END $$;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_org_units_manager_id ON org_units(manager_id);

-- ============================================================================
-- HELPER FUNCTION: Get Department Head
-- ============================================================================

CREATE OR REPLACE FUNCTION get_department_head(p_department_id UUID)
RETURNS UUID AS $$
DECLARE
    v_head_id UUID;
BEGIN
    SELECT head_id INTO v_head_id
    FROM departments
    WHERE id = p_department_id;

    RETURN v_head_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_department_head IS 'Returns the head_id (employee) for a given department';

-- ============================================================================
-- HELPER FUNCTION: Get Employee's Department Chain
-- For DEPT_HEAD scope enforcement
-- ============================================================================

CREATE OR REPLACE FUNCTION get_department_employees(p_department_id UUID)
RETURNS TABLE (employee_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id
    FROM employees e
    WHERE e.department_id = p_department_id
    AND e.is_active = true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_department_employees IS 'Returns all active employees in a department';

-- ============================================================================
-- HELPER FUNCTION: Get Employee's Team (Direct Reports)
-- For LINE_MANAGER scope enforcement
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_employees(p_manager_id UUID)
RETURNS TABLE (employee_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id
    FROM employees e
    WHERE e.manager_id = p_manager_id
    AND e.is_active = true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_team_employees IS 'Returns all direct reports for a manager';

-- ============================================================================
-- HELPER FUNCTION: Check if Employee is in Scope
-- Main function for RBAC scope enforcement
-- ============================================================================

CREATE OR REPLACE FUNCTION is_employee_in_scope(
    p_requesting_employee_id UUID,
    p_target_employee_id UUID,
    p_scope permission_scope
) RETURNS BOOLEAN AS $$
DECLARE
    v_requester_dept_id UUID;
    v_target_dept_id UUID;
    v_requester_tenant_id UUID;
    v_target_tenant_id UUID;
    v_is_dept_head BOOLEAN;
BEGIN
    -- Own scope: only self
    IF p_scope = 'own' THEN
        RETURN p_requesting_employee_id = p_target_employee_id;
    END IF;

    -- Get requester and target info
    SELECT department_id, tenant_id INTO v_requester_dept_id, v_requester_tenant_id
    FROM employees WHERE id = p_requesting_employee_id;

    SELECT department_id, tenant_id INTO v_target_dept_id, v_target_tenant_id
    FROM employees WHERE id = p_target_employee_id;

    -- Platform scope: any employee (SYSADMIN only)
    IF p_scope = 'platform' THEN
        RETURN true;
    END IF;

    -- Tenant scope: same tenant only
    IF p_scope = 'tenant' THEN
        RETURN v_requester_tenant_id = v_target_tenant_id;
    END IF;

    -- Department scope: same department only
    IF p_scope = 'department' THEN
        RETURN v_requester_dept_id = v_target_dept_id
           AND v_requester_tenant_id = v_target_tenant_id;
    END IF;

    -- Team scope: direct reports only
    IF p_scope = 'team' THEN
        RETURN EXISTS (
            SELECT 1 FROM employees
            WHERE id = p_target_employee_id
            AND manager_id = p_requesting_employee_id
        ) OR p_requesting_employee_id = p_target_employee_id;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_employee_in_scope IS 'Checks if target employee is within the requesting employee scope';

-- ============================================================================
-- AUTO-POPULATE HEAD_ID FROM EXISTING DATA
-- Best-effort based on job title patterns
-- ============================================================================

-- Update departments where we can identify a department head
UPDATE departments d
SET head_id = (
    SELECT e.id
    FROM employees e
    WHERE e.department_id = d.id
    AND e.is_active = true
    AND e.job_title ~* '(Director|Head|Manager|Responsabile|Direttore)'
    ORDER BY
        CASE
            WHEN e.job_title ~* '(Director|Direttore)' THEN 1
            WHEN e.job_title ~* '(Head|Responsabile)' THEN 2
            WHEN e.job_title ~* 'Manager' THEN 3
            ELSE 4
        END
    LIMIT 1
)
WHERE d.head_id IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_dept_count INTEGER;
    v_dept_with_head INTEGER;
    v_org_unit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_dept_count FROM departments;
    SELECT COUNT(*) INTO v_dept_with_head FROM departments WHERE head_id IS NOT NULL;
    SELECT COUNT(*) INTO v_org_unit_count FROM org_units;

    RAISE NOTICE '=== Migration 060 Verification ===';
    RAISE NOTICE 'Total departments: %', v_dept_count;
    RAISE NOTICE 'Departments with head_id assigned: %', v_dept_with_head;
    RAISE NOTICE 'Total org_units: %', v_org_unit_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Migration 060 completed successfully!';
    RAISE NOTICE 'Note: Run 062_clevel_seeding.sql to assign remaining department heads';
END $$;
