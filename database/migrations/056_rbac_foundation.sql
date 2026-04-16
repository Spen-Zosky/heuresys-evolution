-- Migration: 056_rbac_foundation.sql
-- Description: RBAC Foundation - ENUM types, feature_modules, permissions tables
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- 1. User Role ENUM (8 roles as per RBAC Authorization Matrix)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rbac_role') THEN
        CREATE TYPE rbac_role AS ENUM (
            'SYSADMIN',      -- Platform admin (multi-tenant)
            'TENANT_ADMIN',  -- CEO/COO (tenant-wide)
            'IT_ADMIN',      -- IT Director (team + config)
            'HR_DIRECTOR',   -- HR strategic (all employees)
            'HR_MANAGER',    -- HR operational (operational scope)
            'DEPT_HEAD',     -- Department head (department scope)
            'LINE_MANAGER',  -- Team manager (direct reports)
            'EMPLOYEE'       -- Standard employee (self only)
        );
        RAISE NOTICE 'Created rbac_role ENUM type';
    ELSE
        RAISE NOTICE 'rbac_role ENUM type already exists';
    END IF;
END $$;

-- 2. Permission Scope ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_scope') THEN
        CREATE TYPE permission_scope AS ENUM (
            'own',        -- Own data only
            'team',       -- Direct reports
            'department', -- Full department
            'tenant',     -- All tenant data
            'platform'    -- Cross-tenant (SYSADMIN only)
        );
        RAISE NOTICE 'Created permission_scope ENUM type';
    ELSE
        RAISE NOTICE 'permission_scope ENUM type already exists';
    END IF;
END $$;

-- 3. CRUD Operation ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crud_operation') THEN
        CREATE TYPE crud_operation AS ENUM (
            'create',
            'read',
            'update',
            'delete',
            'configure',  -- System configuration
            'approve',    -- Approval workflows
            'export'      -- Data export
        );
        RAISE NOTICE 'Created crud_operation ENUM type';
    ELSE
        RAISE NOTICE 'crud_operation ENUM type already exists';
    END IF;
END $$;

-- ============================================================================
-- FEATURE MODULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    api_prefix VARCHAR(100),
    frontend_path VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    requires_tenant BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_feature_modules_code UNIQUE (code)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_feature_modules_category ON feature_modules(category);
CREATE INDEX IF NOT EXISTS idx_feature_modules_active ON feature_modules(is_active) WHERE is_active = true;

COMMENT ON TABLE feature_modules IS 'Platform feature modules for RBAC permission mapping';
COMMENT ON COLUMN feature_modules.code IS 'Unique code identifier (e.g., employees_view, goals)';
COMMENT ON COLUMN feature_modules.category IS 'Category: platform, employees, performance, learning, etc.';
COMMENT ON COLUMN feature_modules.requires_tenant IS 'If false, accessible without tenant context (e.g., ontology)';

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    module_id UUID REFERENCES feature_modules(id) ON DELETE CASCADE,
    operation crud_operation NOT NULL,
    default_scope permission_scope DEFAULT 'own',
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_permissions_code UNIQUE (code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_permissions_operation ON permissions(operation);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active) WHERE is_active = true;

COMMENT ON TABLE permissions IS 'Granular CRUD permissions for each feature module';
COMMENT ON COLUMN permissions.code IS 'Permission code format: {module}:{operation}:{scope}';
COMMENT ON COLUMN permissions.is_sensitive IS 'If true, requires additional audit logging';

-- ============================================================================
-- ROLE PERMISSIONS MAPPING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role rbac_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    scope permission_scope NOT NULL,
    conditions JSONB DEFAULT '{}',
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by UUID,
    notes TEXT,

    CONSTRAINT uq_role_permission UNIQUE (role, permission_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_scope ON role_permissions(scope);

COMMENT ON TABLE role_permissions IS 'Mapping of RBAC roles to permissions with scope';
COMMENT ON COLUMN role_permissions.conditions IS 'Additional conditions (JSON), e.g., {"department_only": true}';

-- ============================================================================
-- EMPLOYEE PERMISSION OVERRIDES TABLE
-- Note: References employees table, NOT users (employees = source of truth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    scope permission_scope,
    is_granted BOOLEAN NOT NULL DEFAULT true,
    conditions JSONB DEFAULT '{}',
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by UUID REFERENCES employees(id),
    expires_at TIMESTAMPTZ,
    reason TEXT,

    CONSTRAINT uq_employee_permission UNIQUE (employee_id, permission_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_permission_overrides_employee ON employee_permission_overrides(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_permission_overrides_permission ON employee_permission_overrides(permission_id);
CREATE INDEX IF NOT EXISTS idx_employee_permission_overrides_expires ON employee_permission_overrides(expires_at)
    WHERE expires_at IS NOT NULL;

COMMENT ON TABLE employee_permission_overrides IS 'Custom permission overrides for individual employees';
COMMENT ON COLUMN employee_permission_overrides.is_granted IS 'true = grant, false = revoke';
COMMENT ON COLUMN employee_permission_overrides.expires_at IS 'Optional expiration for temporary permissions';

-- ============================================================================
-- UPDATE EMPLOYEES TABLE - Ensure auth_role uses rbac_role type
-- ============================================================================

-- First check if auth_role column needs to be updated to use rbac_role type
DO $$
DECLARE
    col_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'auth_role';

    IF col_type IS NULL THEN
        -- Column doesn't exist, add it
        ALTER TABLE employees ADD COLUMN auth_role VARCHAR(50) DEFAULT 'EMPLOYEE';
        RAISE NOTICE 'Added auth_role column to employees table';
    ELSIF col_type != 'USER-DEFINED' THEN
        -- Column exists but is VARCHAR, that's fine for now
        -- We'll keep VARCHAR for compatibility but validate values
        RAISE NOTICE 'auth_role column exists as VARCHAR - keeping for compatibility';
    END IF;
END $$;

-- Add constraint to validate auth_role values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_employees_auth_role'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT chk_employees_auth_role
        CHECK (auth_role IN ('SYSADMIN', 'TENANT_ADMIN', 'IT_ADMIN', 'HR_DIRECTOR',
                             'HR_MANAGER', 'DEPT_HEAD', 'LINE_MANAGER', 'EMPLOYEE',
                             'ADMIN', 'HR', 'USER', 'DEMO', NULL));
        RAISE NOTICE 'Added auth_role check constraint to employees table';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add constraint: %', SQLERRM;
END $$;

-- Create index on auth_role for performance
CREATE INDEX IF NOT EXISTS idx_employees_auth_role ON employees(auth_role);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get effective permissions for an employee
CREATE OR REPLACE FUNCTION get_employee_permissions(p_employee_id UUID)
RETURNS TABLE (
    permission_code VARCHAR,
    scope permission_scope,
    source VARCHAR
) AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    -- Get employee's role
    SELECT auth_role INTO v_role FROM employees WHERE id = p_employee_id;

    IF v_role IS NULL THEN
        v_role := 'EMPLOYEE';
    END IF;

    -- Return role-based permissions
    RETURN QUERY
    SELECT
        p.code::VARCHAR,
        rp.scope,
        'role'::VARCHAR as source
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role::TEXT = v_role
    AND p.is_active = true

    UNION ALL

    -- Return custom granted overrides
    SELECT
        p.code::VARCHAR,
        COALESCE(epo.scope, p.default_scope),
        'override'::VARCHAR as source
    FROM employee_permission_overrides epo
    JOIN permissions p ON epo.permission_id = p.id
    WHERE epo.employee_id = p_employee_id
    AND epo.is_granted = true
    AND p.is_active = true
    AND (epo.expires_at IS NULL OR epo.expires_at > now())

    EXCEPT

    -- Remove revoked permissions
    SELECT
        p.code::VARCHAR,
        rp.scope,
        'role'::VARCHAR
    FROM employee_permission_overrides epo
    JOIN permissions p ON epo.permission_id = p.id
    JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role::TEXT = v_role
    WHERE epo.employee_id = p_employee_id
    AND epo.is_granted = false
    AND (epo.expires_at IS NULL OR epo.expires_at > now());
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_employee_permissions IS 'Returns effective permissions for an employee (role-based + overrides)';

-- Function to check if employee has a specific permission
CREATE OR REPLACE FUNCTION employee_has_permission(
    p_employee_id UUID,
    p_permission_code VARCHAR,
    p_required_scope permission_scope DEFAULT 'own'
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN := false;
    v_scope permission_scope;
    v_scope_order INTEGER;
    v_required_order INTEGER;
BEGIN
    -- Scope hierarchy: own < team < department < tenant < platform
    v_required_order := CASE p_required_scope
        WHEN 'own' THEN 1
        WHEN 'team' THEN 2
        WHEN 'department' THEN 3
        WHEN 'tenant' THEN 4
        WHEN 'platform' THEN 5
    END;

    -- Check if employee has the permission with sufficient scope
    SELECT scope INTO v_scope
    FROM get_employee_permissions(p_employee_id)
    WHERE permission_code = p_permission_code
    LIMIT 1;

    IF v_scope IS NOT NULL THEN
        v_scope_order := CASE v_scope
            WHEN 'own' THEN 1
            WHEN 'team' THEN 2
            WHEN 'department' THEN 3
            WHEN 'tenant' THEN 4
            WHEN 'platform' THEN 5
        END;

        v_has_permission := v_scope_order >= v_required_order;
    END IF;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION employee_has_permission IS 'Checks if employee has specific permission with required scope';

-- ============================================================================
-- AUDIT TRIGGER FOR PERMISSION CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_permission_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            action, category, resource_type, resource_id,
            description, new_value, success
        ) VALUES (
            'PERMISSION_GRANTED',
            'RBAC',
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'Permission change: ' || TG_OP,
            to_jsonb(NEW),
            true
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            action, category, resource_type, resource_id,
            description, old_value, new_value, success
        ) VALUES (
            'PERMISSION_UPDATED',
            'RBAC',
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'Permission change: ' || TG_OP,
            to_jsonb(OLD),
            to_jsonb(NEW),
            true
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            action, category, resource_type, resource_id,
            description, old_value, success
        ) VALUES (
            'PERMISSION_REVOKED',
            'RBAC',
            TG_TABLE_NAME,
            OLD.id::TEXT,
            'Permission change: ' || TG_OP,
            to_jsonb(OLD),
            true
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to permission tables
DROP TRIGGER IF EXISTS trg_audit_role_permissions ON role_permissions;
CREATE TRIGGER trg_audit_role_permissions
    AFTER INSERT OR UPDATE OR DELETE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION audit_permission_changes();

DROP TRIGGER IF EXISTS trg_audit_employee_permission_overrides ON employee_permission_overrides;
CREATE TRIGGER trg_audit_employee_permission_overrides
    AFTER INSERT OR UPDATE OR DELETE ON employee_permission_overrides
    FOR EACH ROW EXECUTE FUNCTION audit_permission_changes();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_enum_count INTEGER;
    v_table_count INTEGER;
BEGIN
    -- Verify ENUMs
    SELECT COUNT(*) INTO v_enum_count
    FROM pg_type
    WHERE typname IN ('rbac_role', 'permission_scope', 'crud_operation');

    -- Verify tables
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_name IN ('feature_modules', 'permissions', 'role_permissions', 'employee_permission_overrides');

    RAISE NOTICE '=== Migration 056 Verification ===';
    RAISE NOTICE 'ENUM types created: % (expected: 3)', v_enum_count;
    RAISE NOTICE 'RBAC tables created: % (expected: 4)', v_table_count;

    IF v_enum_count >= 3 AND v_table_count >= 4 THEN
        RAISE NOTICE 'Migration 056 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 056 may have issues - check counts above';
    END IF;
END $$;
