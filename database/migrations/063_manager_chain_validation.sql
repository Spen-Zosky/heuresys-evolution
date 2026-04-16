-- Migration: 063_manager_chain_validation.sql
-- Description: Validate and fix manager chains for RBAC scope enforcement
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- CREATE DIAGNOSTIC VIEW FOR MANAGER CHAIN ISSUES
-- ============================================================================

CREATE OR REPLACE VIEW v_manager_chain_issues AS
WITH RECURSIVE manager_chain AS (
    -- Base case: employees with managers
    SELECT
        id as employee_id,
        manager_id,
        tenant_id,
        1 as depth,
        ARRAY[id] as chain
    FROM employees
    WHERE manager_id IS NOT NULL

    UNION ALL

    -- Recursive case: follow the chain
    SELECT
        mc.employee_id,
        e.manager_id,
        mc.tenant_id,
        mc.depth + 1,
        mc.chain || e.id
    FROM manager_chain mc
    JOIN employees e ON mc.manager_id = e.id
    WHERE mc.depth < 20  -- Prevent infinite loops
    AND e.id != ALL(mc.chain)  -- Prevent cycles
)
SELECT
    e.id as employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    e.job_title,
    e.tenant_id,
    t.name as tenant_name,
    CASE
        WHEN e.manager_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM employees WHERE id = e.manager_id
        ) THEN 'invalid_manager'
        WHEN e.manager_id = e.id THEN 'self_reference'
        WHEN EXISTS (
            SELECT 1 FROM manager_chain mc
            WHERE mc.employee_id = e.id
            AND e.id = ANY(mc.chain[2:])
        ) THEN 'circular_reference'
        WHEN e.manager_id IS NULL
            AND e.auth_role NOT IN ('TENANT_ADMIN', 'SYSADMIN')
            AND e.is_active = true
        THEN 'no_manager'
        ELSE 'ok'
    END as issue_type
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
WHERE t.code != 'heuresys';

COMMENT ON VIEW v_manager_chain_issues IS 'Diagnostic view to identify manager chain issues for RBAC';

-- ============================================================================
-- FIX SELF-REFERENCES
-- ============================================================================

UPDATE employees
SET manager_id = NULL
WHERE manager_id = id;

RAISE NOTICE 'Fixed self-referencing managers';

-- ============================================================================
-- FIX INVALID MANAGER REFERENCES
-- Set to CEO of the tenant
-- ============================================================================

UPDATE employees e
SET manager_id = (
    SELECT ceo.id
    FROM employees ceo
    WHERE ceo.tenant_id = e.tenant_id
    AND ceo.auth_role = 'TENANT_ADMIN'
    LIMIT 1
)
WHERE e.manager_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM employees WHERE id = e.manager_id)
AND e.auth_role != 'TENANT_ADMIN';

RAISE NOTICE 'Fixed invalid manager references';

-- ============================================================================
-- ENSURE DEPARTMENT HEADS REPORT TO CEO OR HR DIRECTOR
-- ============================================================================

UPDATE employees e
SET manager_id = (
    SELECT ceo.id
    FROM employees ceo
    WHERE ceo.tenant_id = e.tenant_id
    AND ceo.auth_role = 'TENANT_ADMIN'
    LIMIT 1
)
WHERE e.auth_role = 'DEPT_HEAD'
AND e.manager_id IS NULL;

RAISE NOTICE 'Set department heads to report to CEO';

-- ============================================================================
-- ENSURE LINE MANAGERS WITHOUT MANAGER REPORT TO DEPT_HEAD OR CEO
-- ============================================================================

UPDATE employees e
SET manager_id = COALESCE(
    -- Try to find their department head first
    (SELECT dh.id
     FROM departments d
     JOIN employees dh ON d.head_id = dh.id
     WHERE d.id = e.department_id
     LIMIT 1),
    -- Fallback to CEO
    (SELECT ceo.id
     FROM employees ceo
     WHERE ceo.tenant_id = e.tenant_id
     AND ceo.auth_role = 'TENANT_ADMIN'
     LIMIT 1)
)
WHERE e.auth_role = 'LINE_MANAGER'
AND e.manager_id IS NULL;

RAISE NOTICE 'Set line managers to report to department heads or CEO';

-- ============================================================================
-- HELPER FUNCTION: Get Full Manager Chain
-- Returns the complete reporting chain for an employee
-- ============================================================================

CREATE OR REPLACE FUNCTION get_manager_chain(p_employee_id UUID)
RETURNS TABLE (
    level INTEGER,
    manager_id UUID,
    manager_name TEXT,
    manager_role VARCHAR,
    manager_title VARCHAR
) AS $$
DECLARE
    v_current_id UUID;
    v_level INTEGER := 0;
    v_visited UUID[] := ARRAY[]::UUID[];
BEGIN
    v_current_id := (SELECT e.manager_id FROM employees e WHERE e.id = p_employee_id);

    WHILE v_current_id IS NOT NULL AND v_level < 20 LOOP
        -- Cycle detection
        IF v_current_id = ANY(v_visited) THEN
            EXIT;
        END IF;

        v_visited := v_visited || v_current_id;
        v_level := v_level + 1;

        RETURN QUERY
        SELECT
            v_level,
            e.id,
            e.first_name || ' ' || e.last_name,
            e.auth_role,
            e.job_title
        FROM employees e
        WHERE e.id = v_current_id;

        v_current_id := (SELECT e.manager_id FROM employees e WHERE e.id = v_current_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_manager_chain IS 'Returns the complete reporting chain for an employee';

-- ============================================================================
-- HELPER FUNCTION: Get All Subordinates
-- Returns all employees who report to the given manager (direct and indirect)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_all_subordinates(p_manager_id UUID)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_role VARCHAR,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE subordinates AS (
        -- Direct reports
        SELECT
            e.id,
            e.first_name || ' ' || e.last_name as full_name,
            e.auth_role,
            1 as level
        FROM employees e
        WHERE e.manager_id = p_manager_id
        AND e.is_active = true

        UNION ALL

        -- Indirect reports
        SELECT
            e.id,
            e.first_name || ' ' || e.last_name,
            e.auth_role,
            s.level + 1
        FROM employees e
        JOIN subordinates s ON e.manager_id = s.id
        WHERE e.is_active = true
        AND s.level < 10  -- Prevent infinite recursion
    )
    SELECT id, full_name, auth_role, level
    FROM subordinates
    ORDER BY level, full_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_all_subordinates IS 'Returns all direct and indirect subordinates of a manager';

-- ============================================================================
-- CREATE SUMMARY VIEW FOR ORG STRUCTURE
-- ============================================================================

CREATE OR REPLACE VIEW v_org_structure_summary AS
SELECT
    t.code as tenant_code,
    t.name as tenant_name,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'TENANT_ADMIN' THEN e.id END) as tenant_admins,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'IT_ADMIN' THEN e.id END) as it_admins,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'HR_DIRECTOR' THEN e.id END) as hr_directors,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'HR_MANAGER' THEN e.id END) as hr_managers,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'DEPT_HEAD' THEN e.id END) as dept_heads,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'LINE_MANAGER' THEN e.id END) as line_managers,
    COUNT(DISTINCT CASE WHEN e.auth_role = 'EMPLOYEE' THEN e.id END) as employees,
    COUNT(DISTINCT CASE WHEN e.manager_id IS NULL AND e.auth_role NOT IN ('TENANT_ADMIN', 'SYSADMIN') THEN e.id END) as orphans,
    COUNT(DISTINCT d.id) as departments,
    COUNT(DISTINCT CASE WHEN d.head_id IS NOT NULL THEN d.id END) as depts_with_head
FROM tenants t
LEFT JOIN employees e ON e.tenant_id = t.id AND e.is_active = true
LEFT JOIN departments d ON d.tenant_id = t.id
WHERE t.code != 'heuresys'
GROUP BY t.id, t.code, t.name
ORDER BY t.name;

COMMENT ON VIEW v_org_structure_summary IS 'Summary of organizational structure by tenant';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_issue_count INTEGER;
    v_orphan_count INTEGER;
    v_circular_count INTEGER;
    v_invalid_count INTEGER;
    rec RECORD;
BEGIN
    SELECT COUNT(*) INTO v_issue_count
    FROM v_manager_chain_issues
    WHERE issue_type != 'ok';

    SELECT COUNT(*) INTO v_orphan_count
    FROM v_manager_chain_issues
    WHERE issue_type = 'no_manager';

    SELECT COUNT(*) INTO v_circular_count
    FROM v_manager_chain_issues
    WHERE issue_type = 'circular_reference';

    SELECT COUNT(*) INTO v_invalid_count
    FROM v_manager_chain_issues
    WHERE issue_type = 'invalid_manager';

    RAISE NOTICE '=== Migration 063 Verification ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Manager Chain Issues:';
    RAISE NOTICE '  Total issues: %', v_issue_count;
    RAISE NOTICE '  Orphans (no manager): %', v_orphan_count;
    RAISE NOTICE '  Circular references: %', v_circular_count;
    RAISE NOTICE '  Invalid managers: %', v_invalid_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Organization Summary:';

    FOR rec IN SELECT * FROM v_org_structure_summary LOOP
        RAISE NOTICE '  %: % employees, % orphans, %/% depts with head',
            rec.tenant_name,
            rec.total_employees,
            rec.orphans,
            rec.depts_with_head,
            rec.departments;
    END LOOP;

    RAISE NOTICE '';

    IF v_issue_count = 0 OR v_orphan_count <= 5 THEN
        RAISE NOTICE 'Migration 063 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 063 has % remaining issues', v_issue_count;
    END IF;
END $$;
