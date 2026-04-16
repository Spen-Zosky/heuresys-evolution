-- Migration 110: Enforce RLS by switching app connection to heuresys_app
-- SEC-01: heuresys (superuser) bypasses all 281 RLS policies
--
-- Strategy: Use heuresys_app (non-superuser, nobypassrls) for application
-- connections. heuresys stays as superuser for migrations only.
--
-- heuresys_app already exists with canlogin=true and a password.
-- This migration ensures it has full permissions on all objects.

-- Grant full access on all existing objects
GRANT USAGE ON SCHEMA public TO heuresys_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO heuresys_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO heuresys_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO heuresys_app;

-- Default privileges for future objects created by heuresys (migrations)
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO heuresys_app;
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO heuresys_app;
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO heuresys_app;

-- Set password for heuresys_app (same as heuresys for simplicity)
ALTER ROLE heuresys_app PASSWORD 'heuresys';

-- Ensure heuresys_app does NOT bypass RLS (defensive)
ALTER ROLE heuresys_app NOBYPASSRLS;

-- Verify
DO $$
DECLARE
  v_super boolean;
  v_bypass boolean;
  v_login boolean;
BEGIN
  SELECT rolsuper, rolbypassrls, rolcanlogin INTO v_super, v_bypass, v_login
  FROM pg_roles WHERE rolname = 'heuresys_app';

  IF v_super OR v_bypass THEN
    RAISE EXCEPTION 'heuresys_app still has superuser=% bypassrls=%', v_super, v_bypass;
  END IF;

  IF NOT v_login THEN
    RAISE EXCEPTION 'heuresys_app cannot login';
  END IF;

  RAISE NOTICE 'SUCCESS: heuresys_app ready — superuser=false, bypassrls=false, login=true';
  RAISE NOTICE 'Application must connect as heuresys_app to enforce RLS on 257 tables';
END $$;
