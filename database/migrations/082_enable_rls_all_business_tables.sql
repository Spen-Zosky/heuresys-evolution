-- =============================================================================
-- Migration: 082_enable_rls_all_business_tables.sql
-- Description: Enable RLS on ALL business tables that have tenant_id but lack RLS.
--              Creates tenant_isolation policy on each table using:
--                USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
--              Skips SAP tables (prefixed with pa, pb, hrp, pcl, t5, ext_).
--              Skips tables that already have RLS enabled.
--              Skips tenants and users tables (they have custom policies from 001).
-- Date: 2026-02-03
-- Resolves: Audit finding DB-001
-- =============================================================================

DO $$
DECLARE
    tbl RECORD;
    tables_enabled INTEGER := 0;
    tables_skipped_sap INTEGER := 0;
    tables_skipped_rls INTEGER := 0;
    tables_skipped_special INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Starting RLS enablement for all business tables with tenant_id ===';
    RAISE NOTICE '';

    -- Loop through all public tables that have a tenant_id column
    FOR tbl IN
        SELECT DISTINCT t.tablename
        FROM pg_tables t
        JOIN information_schema.columns c
            ON c.table_name = t.tablename
            AND c.table_schema = t.schemaname
        WHERE t.schemaname = 'public'
          AND c.column_name = 'tenant_id'
        ORDER BY t.tablename
    LOOP
        -- Skip SAP tables (prefixed with pa, pb, hrp, pcl, t5, ext_)
        IF tbl.tablename ~ '^(pa|pb|hrp|pcl|t5|ext_)' THEN
            tables_skipped_sap := tables_skipped_sap + 1;
            RAISE NOTICE 'SKIP (SAP table): %', tbl.tablename;
            CONTINUE;
        END IF;

        -- Skip tenants and users tables - they have custom RLS policies from 001_enable_rls.sql
        -- (tenants uses id = current_tenant_id(), users uses employee_id subquery)
        IF tbl.tablename IN ('tenants', 'users') THEN
            tables_skipped_special := tables_skipped_special + 1;
            RAISE NOTICE 'SKIP (custom policy): %', tbl.tablename;
            CONTINUE;
        END IF;

        -- Check if RLS is already enabled on this table
        IF EXISTS (
            SELECT 1 FROM pg_class
            WHERE relname = tbl.tablename
              AND relnamespace = 'public'::regnamespace
              AND relrowsecurity = true
        ) THEN
            tables_skipped_rls := tables_skipped_rls + 1;
            RAISE NOTICE 'SKIP (RLS already enabled): %', tbl.tablename;
            CONTINUE;
        END IF;

        -- Enable RLS on the table
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.tablename);

        -- Drop existing tenant_isolation policy if it somehow exists (defensive)
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl.tablename);

        -- Create the tenant_isolation policy
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'')::uuid)',
            tbl.tablename
        );

        tables_enabled := tables_enabled + 1;
        RAISE NOTICE 'ENABLED RLS + policy: %', tbl.tablename;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '=== RLS Enablement Summary ===';
    RAISE NOTICE 'Tables with RLS newly enabled: %', tables_enabled;
    RAISE NOTICE 'Tables skipped (SAP prefix): %', tables_skipped_sap;
    RAISE NOTICE 'Tables skipped (RLS already on): %', tables_skipped_rls;
    RAISE NOTICE 'Tables skipped (custom policy): %', tables_skipped_special;
    RAISE NOTICE 'Total tables processed: %', tables_enabled + tables_skipped_sap + tables_skipped_rls + tables_skipped_special;
    RAISE NOTICE '=== Done ===';
END
$$;

-- =============================================================================
-- Verification: Show all tables with tenant_id and their RLS status
-- =============================================================================
SELECT
    t.tablename,
    cls.relrowsecurity AS rls_enabled,
    COALESCE(
        (SELECT string_agg(pol.policyname, ', ')
         FROM pg_policies pol
         WHERE pol.tablename = t.tablename AND pol.schemaname = 'public'),
        'NO POLICIES'
    ) AS policies
FROM pg_tables t
JOIN information_schema.columns c
    ON c.table_name = t.tablename
    AND c.table_schema = t.schemaname
JOIN pg_class cls
    ON cls.relname = t.tablename
    AND cls.relnamespace = 'public'::regnamespace
WHERE t.schemaname = 'public'
  AND c.column_name = 'tenant_id'
  AND t.tablename !~ '^(pa|pb|hrp|pcl|t5|ext_)'
ORDER BY cls.relrowsecurity DESC, t.tablename;
