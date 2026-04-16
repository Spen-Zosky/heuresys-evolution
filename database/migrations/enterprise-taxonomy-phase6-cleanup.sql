-- ============================================================
-- Enterprise Taxonomy — Phase 6: Legacy Cleanup
-- DROP obsolete NACE tables, migrate FK references
-- ============================================================

-- 1. Migrate business_processes.prototype_id → profile_id
ALTER TABLE business_processes ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES industry_profiles(id);

UPDATE business_processes bp
SET profile_id = ip2.id
FROM industry_prototypes ip1
JOIN industry_profiles ip2 ON ip2.code = ip1.code
WHERE bp.prototype_id = ip1.id
  AND bp.profile_id IS NULL;

-- 2. Migrate tenants.industry_prototype_id → industry_profile_id
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry_profile_id UUID REFERENCES industry_profiles(id);

UPDATE tenants t
SET industry_profile_id = ip2.id
FROM industry_prototypes ip1
JOIN industry_profiles ip2 ON ip2.code = ip1.code
WHERE t.industry_prototype_id = ip1.id
  AND t.industry_profile_id IS NULL;

-- 3. DROP empty dependent tables
DROP TABLE IF EXISTS prototype_staffing_rules CASCADE;
DROP TABLE IF EXISTS prototype_generation_sessions CASCADE;

-- 4. DROP prototype_id from business_processes (after migration)
ALTER TABLE business_processes DROP COLUMN IF EXISTS prototype_id;

-- 5. DROP legacy view that depends on removed columns/tables
DROP VIEW IF EXISTS v_tenants_with_profile CASCADE;

-- 6. DROP legacy columns from tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS industry_prototype_id;
ALTER TABLE tenants DROP COLUMN IF EXISTS is_prototype_customized;
ALTER TABLE tenants DROP COLUMN IF EXISTS nace_code;
ALTER TABLE tenants DROP COLUMN IF EXISTS nace_primary;
ALTER TABLE tenants DROP COLUMN IF EXISTS nace_secondary;

-- 6. DROP industry_prototypes
DROP TABLE IF EXISTS industry_prototypes CASCADE;

-- 7. DROP NACE legacy tables (order: children → parents for FK)
DROP TABLE IF EXISTS nace_groups CASCADE;
DROP TABLE IF EXISTS nace_divisions CASCADE;
DROP TABLE IF EXISTS nace_sections CASCADE;

-- 8. DROP other legacy
DROP TABLE IF EXISTS ateco_codes CASCADE;
DROP TABLE IF EXISTS _company_sizes_legacy CASCADE;
