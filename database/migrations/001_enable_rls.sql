-- =============================================================================
-- Migration: 001_enable_rls.sql
-- Description: Enable Row-Level Security (RLS) for multi-tenant data isolation
-- =============================================================================

-- Create app user for RLS (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'heuresys_app') THEN
        CREATE ROLE heuresys_app WITH LOGIN PASSWORD 'heuresys_app_secure';
    END IF;
END
$$;

-- Grant necessary permissions to app user
GRANT CONNECT ON DATABASE heuresys_platform TO heuresys_app;
GRANT USAGE ON SCHEMA public TO heuresys_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO heuresys_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO heuresys_app;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heuresys_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO heuresys_app;

-- =============================================================================
-- Function to get current tenant ID from session variable
-- =============================================================================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- Function to set tenant context
-- =============================================================================
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Enable RLS on tenant-scoped tables
-- =============================================================================

-- List of tables that need RLS (all tables with tenant_id column)
-- Excluding SAP tables (pa*, hrp*, pb*, pcl*, t5*, ext_*)

-- Core tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;

-- Performance & Goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;

-- Feedback & Recognition
ALTER TABLE continuous_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360 ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_sessions ENABLE ROW LEVEL SECURITY;

-- Learning
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- Recruiting
ALTER TABLE recruiting_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiting_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiting_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_job_postings ENABLE ROW LEVEL SECURITY;

-- Compensation
ALTER TABLE salary_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE merit_cycles ENABLE ROW LEVEL SECURITY;

-- Notifications & Audit
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Onboarding
ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_instances ENABLE ROW LEVEL SECURITY;

-- RAG/AI
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Create RLS Policies
-- =============================================================================

-- Generic function to create standard tenant isolation policy
-- Using DO block to handle tables that might not exist

DO $$
DECLARE
    table_list TEXT[] := ARRAY[
        'employees', 'departments', 'locations', 'cost_centers', 'org_units',
        'goals', 'okrs', 'key_results', 'check_ins', 'performance_reviews', 'review_cycles',
        'continuous_feedback', 'feedback_360', 'feedback_requests', 'calibration_sessions',
        'courses', 'course_enrollments', 'learning_paths', 'learning_path_enrollments', 'certifications',
        'recruiting_requisitions', 'recruiting_candidates', 'recruiting_interviews', 'internal_job_postings',
        'salary_bands', 'bonus_plans', 'merit_cycles',
        'notifications', 'audit_logs',
        'onboarding_templates', 'onboarding_instances',
        'rag_documents', 'rag_sessions'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY table_list
    LOOP
        -- Check if table exists and has tenant_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = tbl
            AND column_name = 'tenant_id'
        ) THEN
            -- Drop existing policy if exists
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);

            -- Create policy for tenant isolation
            EXECUTE format(
                'CREATE POLICY tenant_isolation ON %I
                FOR ALL
                USING (tenant_id = current_tenant_id())
                WITH CHECK (tenant_id = current_tenant_id())',
                tbl
            );

            RAISE NOTICE 'Created RLS policy for table: %', tbl;
        ELSE
            RAISE NOTICE 'Skipped table (not found or no tenant_id): %', tbl;
        END IF;
    END LOOP;
END
$$;

-- =============================================================================
-- Special policy for tenants table (self-access only)
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_self_access ON tenants;
CREATE POLICY tenant_self_access ON tenants
    FOR ALL
    USING (id = current_tenant_id())
    WITH CHECK (id = current_tenant_id());

-- =============================================================================
-- Users table policy (employees can see users in their tenant via employee relation)
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tenant_access ON users;
CREATE POLICY user_tenant_access ON users
    FOR ALL
    USING (
        employee_id IS NULL
        OR employee_id IN (
            SELECT id FROM employees WHERE tenant_id = current_tenant_id()
        )
    )
    WITH CHECK (
        employee_id IS NULL
        OR employee_id IN (
            SELECT id FROM employees WHERE tenant_id = current_tenant_id()
        )
    );

-- =============================================================================
-- Bypass RLS for superuser (heuresys) - for administrative tasks
-- =============================================================================
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_centers FORCE ROW LEVEL SECURITY;
ALTER TABLE org_units FORCE ROW LEVEL SECURITY;
ALTER TABLE goals FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Grant BYPASSRLS to main admin user
ALTER ROLE heuresys BYPASSRLS;

-- =============================================================================
-- Verification query
-- =============================================================================
-- Run this to verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename;

COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant ID from session variable for RLS policies';
COMMENT ON FUNCTION set_tenant_context(UUID) IS 'Sets the tenant context for the current session for RLS';
