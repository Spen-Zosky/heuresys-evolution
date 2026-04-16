-- Migration: 062_clevel_seeding.sql
-- Description: Seed missing C-Level executives for SmartFood and EcoNova tenants
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- IDENTIFY TENANT GAPS
-- SmartFood: Missing CEO, HR Director, IT Director
-- EcoNova: Has CEO, missing HR Director, IT Manager
-- ============================================================================

DO $$
DECLARE
    v_smartfood_tenant_id UUID;
    v_econova_tenant_id UUID;
    v_smartfood_hr_dept_id UUID;
    v_econova_hr_dept_id UUID;
    v_smartfood_it_dept_id UUID;
    v_econova_it_dept_id UUID;
    v_smartfood_ceo_id UUID;
    v_econova_ceo_id UUID;
    v_new_id UUID;
BEGIN
    -- Get tenant IDs
    SELECT id INTO v_smartfood_tenant_id FROM tenants WHERE code = 'smartfood';
    SELECT id INTO v_econova_tenant_id FROM tenants WHERE code = 'econova';

    IF v_smartfood_tenant_id IS NULL THEN
        RAISE NOTICE 'SmartFood tenant not found - skipping SmartFood C-level seeding';
    END IF;

    IF v_econova_tenant_id IS NULL THEN
        RAISE NOTICE 'EcoNova tenant not found - skipping EcoNova C-level seeding';
    END IF;

    -- ========================================================================
    -- SMARTFOOD C-LEVEL SEEDING
    -- ========================================================================

    IF v_smartfood_tenant_id IS NOT NULL THEN
        RAISE NOTICE 'Processing SmartFood tenant...';

        -- Check if CEO exists
        SELECT id INTO v_smartfood_ceo_id
        FROM employees
        WHERE tenant_id = v_smartfood_tenant_id
        AND job_title ~* '(CEO|Chief Executive|Amministratore Delegato|Direttore Generale)'
        LIMIT 1;

        -- Create CEO if missing
        IF v_smartfood_ceo_id IS NULL THEN
            v_new_id := gen_random_uuid();
            INSERT INTO employees (
                id, tenant_id, employee_number, first_name, last_name,
                email, job_title, auth_role, is_active, status,
                hire_date, created_at, updated_at
            ) VALUES (
                v_new_id,
                v_smartfood_tenant_id,
                'SF-CEO-001',
                'Alessandro',
                'Moretti',
                'alessandro.moretti@smartfood.it',
                'CEO - Chief Executive Officer',
                'TENANT_ADMIN',
                true,
                'active',
                '2020-01-15',
                now(),
                now()
            );
            v_smartfood_ceo_id := v_new_id;
            RAISE NOTICE 'Created SmartFood CEO: Alessandro Moretti';
        ELSE
            RAISE NOTICE 'SmartFood CEO already exists: %', v_smartfood_ceo_id;
            -- Ensure CEO has TENANT_ADMIN role
            UPDATE employees SET auth_role = 'TENANT_ADMIN' WHERE id = v_smartfood_ceo_id;
        END IF;

        -- Get or create HR department
        SELECT id INTO v_smartfood_hr_dept_id
        FROM departments
        WHERE tenant_id = v_smartfood_tenant_id
        AND name ~* '(HR|Human Resources|Risorse Umane|Personale)'
        LIMIT 1;

        IF v_smartfood_hr_dept_id IS NULL THEN
            v_smartfood_hr_dept_id := gen_random_uuid();
            INSERT INTO departments (id, tenant_id, name, code, is_active)
            VALUES (v_smartfood_hr_dept_id, v_smartfood_tenant_id, 'Human Resources', 'HR', true);
            RAISE NOTICE 'Created SmartFood HR department';
        END IF;

        -- Check if HR Director exists
        IF NOT EXISTS (
            SELECT 1 FROM employees
            WHERE tenant_id = v_smartfood_tenant_id
            AND job_title ~* '(HR Director|CHRO|Direttore HR|Direttore Risorse Umane)'
        ) THEN
            v_new_id := gen_random_uuid();
            INSERT INTO employees (
                id, tenant_id, employee_number, first_name, last_name,
                email, job_title, auth_role, department_id, manager_id,
                is_active, status, hire_date, created_at, updated_at
            ) VALUES (
                v_new_id,
                v_smartfood_tenant_id,
                'SF-HR-001',
                'Giulia',
                'Benedetti',
                'giulia.benedetti@smartfood.it',
                'HR Director',
                'HR_DIRECTOR',
                v_smartfood_hr_dept_id,
                v_smartfood_ceo_id,
                true,
                'active',
                '2020-03-01',
                now(),
                now()
            );
            -- Update HR department head
            UPDATE departments SET head_id = v_new_id WHERE id = v_smartfood_hr_dept_id;
            RAISE NOTICE 'Created SmartFood HR Director: Giulia Benedetti';
        ELSE
            RAISE NOTICE 'SmartFood HR Director already exists';
        END IF;

        -- Get or create IT department
        SELECT id INTO v_smartfood_it_dept_id
        FROM departments
        WHERE tenant_id = v_smartfood_tenant_id
        AND name ~* '(IT|Information Technology|Sistemi|Informatica)'
        LIMIT 1;

        IF v_smartfood_it_dept_id IS NULL THEN
            v_smartfood_it_dept_id := gen_random_uuid();
            INSERT INTO departments (id, tenant_id, name, code, is_active)
            VALUES (v_smartfood_it_dept_id, v_smartfood_tenant_id, 'Information Technology', 'IT', true);
            RAISE NOTICE 'Created SmartFood IT department';
        END IF;

        -- Check if IT Director exists
        IF NOT EXISTS (
            SELECT 1 FROM employees
            WHERE tenant_id = v_smartfood_tenant_id
            AND job_title ~* '(IT Director|CTO|CIO|Direttore IT|Direttore Sistemi)'
        ) THEN
            v_new_id := gen_random_uuid();
            INSERT INTO employees (
                id, tenant_id, employee_number, first_name, last_name,
                email, job_title, auth_role, department_id, manager_id,
                is_active, status, hire_date, created_at, updated_at
            ) VALUES (
                v_new_id,
                v_smartfood_tenant_id,
                'SF-IT-001',
                'Roberto',
                'Colombo',
                'roberto.colombo@smartfood.it',
                'IT Director',
                'IT_ADMIN',
                v_smartfood_it_dept_id,
                v_smartfood_ceo_id,
                true,
                'active',
                '2020-02-15',
                now(),
                now()
            );
            -- Update IT department head
            UPDATE departments SET head_id = v_new_id WHERE id = v_smartfood_it_dept_id;
            RAISE NOTICE 'Created SmartFood IT Director: Roberto Colombo';
        ELSE
            RAISE NOTICE 'SmartFood IT Director already exists';
        END IF;
    END IF;

    -- ========================================================================
    -- ECONOVA C-LEVEL SEEDING
    -- ========================================================================

    IF v_econova_tenant_id IS NOT NULL THEN
        RAISE NOTICE 'Processing EcoNova tenant...';

        -- Get existing CEO
        SELECT id INTO v_econova_ceo_id
        FROM employees
        WHERE tenant_id = v_econova_tenant_id
        AND job_title ~* '(CEO|Chief Executive|Amministratore Delegato|Direttore Generale)'
        LIMIT 1;

        IF v_econova_ceo_id IS NULL THEN
            -- Create CEO if missing (shouldn't be, but safety)
            v_new_id := gen_random_uuid();
            INSERT INTO employees (
                id, tenant_id, employee_number, first_name, last_name,
                email, job_title, auth_role, is_active, status,
                hire_date, created_at, updated_at
            ) VALUES (
                v_new_id,
                v_econova_tenant_id,
                'EN-CEO-001',
                'Marco',
                'Verdi',
                'marco.verdi@econova.it',
                'CEO - Chief Executive Officer',
                'TENANT_ADMIN',
                true,
                'active',
                '2019-06-01',
                now(),
                now()
            );
            v_econova_ceo_id := v_new_id;
            RAISE NOTICE 'Created EcoNova CEO: Marco Verdi';
        ELSE
            RAISE NOTICE 'EcoNova CEO already exists: %', v_econova_ceo_id;
            -- Ensure CEO has TENANT_ADMIN role
            UPDATE employees SET auth_role = 'TENANT_ADMIN' WHERE id = v_econova_ceo_id;
        END IF;

        -- Get or create HR department
        SELECT id INTO v_econova_hr_dept_id
        FROM departments
        WHERE tenant_id = v_econova_tenant_id
        AND name ~* '(HR|Human Resources|Risorse Umane|Personale)'
        LIMIT 1;

        IF v_econova_hr_dept_id IS NULL THEN
            v_econova_hr_dept_id := gen_random_uuid();
            INSERT INTO departments (id, tenant_id, name, code, is_active)
            VALUES (v_econova_hr_dept_id, v_econova_tenant_id, 'Human Resources', 'HR', true);
            RAISE NOTICE 'Created EcoNova HR department';
        END IF;

        -- Check if HR Director exists
        IF NOT EXISTS (
            SELECT 1 FROM employees
            WHERE tenant_id = v_econova_tenant_id
            AND job_title ~* '(HR Director|CHRO|Direttore HR|Direttore Risorse Umane)'
        ) THEN
            v_new_id := gen_random_uuid();
            INSERT INTO employees (
                id, tenant_id, employee_number, first_name, last_name,
                email, job_title, auth_role, department_id, manager_id,
                is_active, status, hire_date, created_at, updated_at
            ) VALUES (
                v_new_id,
                v_econova_tenant_id,
                'EN-HR-001',
                'Francesca',
                'Romano',
                'francesca.romano@econova.it',
                'HR Director',
                'HR_DIRECTOR',
                v_econova_hr_dept_id,
                v_econova_ceo_id,
                true,
                'active',
                '2020-01-10',
                now(),
                now()
            );
            -- Update HR department head
            UPDATE departments SET head_id = v_new_id WHERE id = v_econova_hr_dept_id;
            RAISE NOTICE 'Created EcoNova HR Director: Francesca Romano';
        ELSE
            RAISE NOTICE 'EcoNova HR Director already exists';
        END IF;

        -- Get or create IT department
        SELECT id INTO v_econova_it_dept_id
        FROM departments
        WHERE tenant_id = v_econova_tenant_id
        AND name ~* '(IT|Information Technology|Sistemi|Informatica)'
        LIMIT 1;

        IF v_econova_it_dept_id IS NULL THEN
            v_econova_it_dept_id := gen_random_uuid();
            INSERT INTO departments (id, tenant_id, name, code, is_active)
            VALUES (v_econova_it_dept_id, v_econova_tenant_id, 'Information Technology', 'IT', true);
            RAISE NOTICE 'Created EcoNova IT department';
        END IF;

        -- Check if IT Manager exists (smaller company, so IT Manager not Director)
        IF NOT EXISTS (
            SELECT 1 FROM employees
            WHERE tenant_id = v_econova_tenant_id
            AND job_title ~* '(IT Director|IT Manager|CTO|CIO|Responsabile IT|Responsabile Sistemi)'
        ) THEN
            v_new_id := gen_random_uuid();
            INSERT INTO employees (
                id, tenant_id, employee_number, first_name, last_name,
                email, job_title, auth_role, department_id, manager_id,
                is_active, status, hire_date, created_at, updated_at
            ) VALUES (
                v_new_id,
                v_econova_tenant_id,
                'EN-IT-001',
                'Marco',
                'Esposito',
                'marco.esposito@econova.it',
                'IT Manager',
                'IT_ADMIN',
                v_econova_it_dept_id,
                v_econova_ceo_id,
                true,
                'active',
                '2020-03-15',
                now(),
                now()
            );
            -- Update IT department head
            UPDATE departments SET head_id = v_new_id WHERE id = v_econova_it_dept_id;
            RAISE NOTICE 'Created EcoNova IT Manager: Marco Esposito';
        ELSE
            RAISE NOTICE 'EcoNova IT leadership already exists';
        END IF;
    END IF;

    RAISE NOTICE 'C-Level seeding completed';
END $$;

-- ============================================================================
-- UPDATE ORPHAN EMPLOYEES TO REPORT TO CEO
-- ============================================================================

-- SmartFood: Set orphan employees to report to CEO
UPDATE employees e
SET manager_id = (
    SELECT id FROM employees
    WHERE tenant_id = e.tenant_id
    AND job_title ~* '(CEO|Chief Executive)'
    LIMIT 1
)
WHERE e.manager_id IS NULL
AND e.tenant_id IN (SELECT id FROM tenants WHERE code = 'smartfood')
AND e.job_title NOT ~* '(CEO|Chief Executive|Amministratore)'
AND e.auth_role != 'TENANT_ADMIN';

-- EcoNova: Set orphan employees to report to CEO
UPDATE employees e
SET manager_id = (
    SELECT id FROM employees
    WHERE tenant_id = e.tenant_id
    AND job_title ~* '(CEO|Chief Executive)'
    LIMIT 1
)
WHERE e.manager_id IS NULL
AND e.tenant_id IN (SELECT id FROM tenants WHERE code = 'econova')
AND e.job_title NOT ~* '(CEO|Chief Executive|Amministratore)'
AND e.auth_role != 'TENANT_ADMIN';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_smartfood_clevel INTEGER;
    v_econova_clevel INTEGER;
    v_smartfood_orphans INTEGER;
    v_econova_orphans INTEGER;
BEGIN
    -- Count C-Level for SmartFood
    SELECT COUNT(*) INTO v_smartfood_clevel
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'smartfood'
    AND e.auth_role IN ('TENANT_ADMIN', 'HR_DIRECTOR', 'IT_ADMIN');

    -- Count C-Level for EcoNova
    SELECT COUNT(*) INTO v_econova_clevel
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'econova'
    AND e.auth_role IN ('TENANT_ADMIN', 'HR_DIRECTOR', 'IT_ADMIN');

    -- Count orphans (no manager, not CEO)
    SELECT COUNT(*) INTO v_smartfood_orphans
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'smartfood'
    AND e.manager_id IS NULL
    AND e.auth_role != 'TENANT_ADMIN';

    SELECT COUNT(*) INTO v_econova_orphans
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'econova'
    AND e.manager_id IS NULL
    AND e.auth_role != 'TENANT_ADMIN';

    RAISE NOTICE '=== Migration 062 Verification ===';
    RAISE NOTICE 'SmartFood C-Level count: % (expected: 3)', v_smartfood_clevel;
    RAISE NOTICE 'EcoNova C-Level count: % (expected: 3)', v_econova_clevel;
    RAISE NOTICE 'SmartFood orphan employees: % (expected: 0)', v_smartfood_orphans;
    RAISE NOTICE 'EcoNova orphan employees: % (expected: 0)', v_econova_orphans;
    RAISE NOTICE '';

    IF v_smartfood_clevel >= 3 AND v_econova_clevel >= 3 THEN
        RAISE NOTICE 'Migration 062 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 062 may have issues - check C-Level counts';
    END IF;
END $$;
