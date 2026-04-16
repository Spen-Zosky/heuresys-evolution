-- =============================================================================
-- Migration: 084_configure_app_role.sql
-- Description: Configure heuresys_app role for RLS-enforced application access.
--              This role has LOGIN but NO SUPERUSER and NO BYPASSRLS, ensuring
--              that all RLS policies are enforced for application queries.
--              The existing heuresys (superuser) role remains for admin tasks.
-- Date: 2026-02-03
-- Story: S2-002 - Switch application to heuresys_app role
-- =============================================================================

-- =============================================================================
-- STEP 1: Ensure heuresys_app role exists with correct attributes
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'heuresys_app') THEN
        CREATE ROLE heuresys_app WITH
            LOGIN
            NOSUPERUSER
            NOBYPASSRLS
            NOCREATEDB
            NOCREATEROLE
            PASSWORD 'heuresys_app_secure';
        RAISE NOTICE 'Created role heuresys_app';
    ELSE
        -- Ensure correct attributes even if role already exists
        ALTER ROLE heuresys_app WITH
            LOGIN
            NOSUPERUSER
            NOBYPASSRLS
            NOCREATEDB
            NOCREATEROLE;
        -- Update password
        ALTER ROLE heuresys_app WITH PASSWORD 'heuresys_app_secure';
        RAISE NOTICE 'Updated role heuresys_app attributes and password';
    END IF;
END
$$;

-- =============================================================================
-- STEP 2: GRANT CONNECT on database
-- =============================================================================
GRANT CONNECT ON DATABASE heuresys_platform TO heuresys_app;

-- =============================================================================
-- STEP 3: GRANT USAGE on public schema
-- =============================================================================
GRANT USAGE ON SCHEMA public TO heuresys_app;

-- =============================================================================
-- STEP 4: GRANT DML privileges on ALL existing tables in public schema
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO heuresys_app;

-- =============================================================================
-- STEP 5: GRANT sequence privileges (for SERIAL/BIGSERIAL columns)
-- =============================================================================
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO heuresys_app;

-- =============================================================================
-- STEP 6: GRANT EXECUTE on all functions in public schema
-- =============================================================================
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO heuresys_app;

-- =============================================================================
-- STEP 7: Set DEFAULT PRIVILEGES for future objects created by heuresys
--         (the superuser that runs migrations)
-- =============================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heuresys_app;

ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO heuresys_app;

ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO heuresys_app;

-- =============================================================================
-- STEP 8: Handle additional schemas if they exist
--         (analytics, learning, etc. - currently all in public, but future-proof)
-- =============================================================================
DO $$
DECLARE
    s_name TEXT;
    additional_schemas TEXT[] := ARRAY['analytics', 'learning', 'reporting'];
BEGIN
    FOREACH s_name IN ARRAY additional_schemas
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.schemata s
            WHERE s.schema_name = s_name
        ) THEN
            EXECUTE format('GRANT USAGE ON SCHEMA %I TO heuresys_app', s_name);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO heuresys_app', s_name);
            EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO heuresys_app', s_name);
            EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO heuresys_app', s_name);

            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heuresys_app', s_name);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO heuresys_app', s_name);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO heuresys_app', s_name);

            RAISE NOTICE 'Granted privileges on schema: %', s_name;
        ELSE
            RAISE NOTICE 'Schema does not exist (skipped): %', s_name;
        END IF;
    END LOOP;
END
$$;

-- =============================================================================
-- STEP 9: Set application_name default for heuresys_app connections
-- =============================================================================
ALTER ROLE heuresys_app SET application_name = 'heuresys-api-gateway';

-- =============================================================================
-- STEP 10: Set search_path for heuresys_app (restrict to public schema)
-- =============================================================================
ALTER ROLE heuresys_app SET search_path = public;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreatedb, rolcreaterole
    INTO r
    FROM pg_roles
    WHERE rolname = 'heuresys_app';

    IF r IS NULL THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: heuresys_app role does not exist!';
    END IF;

    IF r.rolsuper THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: heuresys_app must NOT be superuser!';
    END IF;

    IF r.rolbypassrls THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: heuresys_app must NOT have BYPASSRLS!';
    END IF;

    IF NOT r.rolcanlogin THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: heuresys_app must have LOGIN!';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '=== heuresys_app Role Verification ===';
    RAISE NOTICE 'Role:        %', r.rolname;
    RAISE NOTICE 'Superuser:   % (expected: false)', r.rolsuper;
    RAISE NOTICE 'BypassRLS:   % (expected: false)', r.rolbypassrls;
    RAISE NOTICE 'Can Login:   % (expected: true)', r.rolcanlogin;
    RAISE NOTICE 'Create DB:   % (expected: false)', r.rolcreatedb;
    RAISE NOTICE 'Create Role: % (expected: false)', r.rolcreaterole;
    RAISE NOTICE '=== All checks passed ===';
END
$$;

-- Show table privilege count for verification
SELECT
    grantee,
    COUNT(*) AS table_count,
    string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE grantee = 'heuresys_app'
  AND table_schema = 'public'
GROUP BY grantee;
