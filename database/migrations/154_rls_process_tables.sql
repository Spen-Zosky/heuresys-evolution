-- Migration 154: RLS policies for business process tables
-- Tables: business_processes, org_unit_process_mapping, process_cost_centers
-- These tables lack tenant_id; tenant filtering via business_processes.profile_id = tenants.industry_profile_id

BEGIN;

-- ============================================================
-- 1. Enable RLS on all three tables
-- ============================================================

ALTER TABLE business_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_processes FORCE ROW LEVEL SECURITY;

ALTER TABLE org_unit_process_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_unit_process_mapping FORCE ROW LEVEL SECURITY;

ALTER TABLE process_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_cost_centers FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. business_processes — tenant sees rows matching its industry profile
-- ============================================================

CREATE POLICY tenant_isolation ON business_processes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenants
            WHERE tenants.id = current_tenant_id()
              AND tenants.industry_profile_id = business_processes.profile_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenants
            WHERE tenants.id = current_tenant_id()
              AND tenants.industry_profile_id = business_processes.profile_id
        )
    );

-- ============================================================
-- 3. org_unit_process_mapping — tenant sees rows for its processes
-- ============================================================

CREATE POLICY tenant_isolation ON org_unit_process_mapping
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = org_unit_process_mapping.process_id
              AND t.id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = org_unit_process_mapping.process_id
              AND t.id = current_tenant_id()
        )
    );

-- ============================================================
-- 4. process_cost_centers — tenant sees rows for its processes
-- ============================================================

CREATE POLICY tenant_isolation ON process_cost_centers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_cost_centers.process_id
              AND t.id = current_tenant_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_processes bp
            JOIN tenants t ON t.industry_profile_id = bp.profile_id
            WHERE bp.id = process_cost_centers.process_id
              AND t.id = current_tenant_id()
        )
    );

COMMIT;
