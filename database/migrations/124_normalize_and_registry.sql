-- Migration 124: Normalize text[] + Create table registry (Fase 3)
--
-- Per regola stop (>20% invalidi → Fase 8):
--   platform_pages.tags (33.3%) → deferred
--   platform_features.requires_tables (54.5%) → deferred
--
-- This migration:
-- 1. Drops redundant employees.skills (employee_skills table already exists)
-- 2. Creates db_table_registry for auto-discovery
-- 3. Creates page_table_relations (M:N junction for Blueprint)
-- 4. Creates page_table_sync_log (consolidates _migration_cleanup_log)
-- 5. Populates db_table_registry from pg_tables
-- 6. Marks platform_pages.tags and platform_features.requires_* as DEPRECATED

BEGIN;

-- ============================================
-- STEP 1: Drop redundant employees.skills
-- employee_skills table (264 employees) already covers this M:N relationship
-- employees.skills (266 employees) is text[] with free-text skill names
-- ============================================

COMMENT ON COLUMN employees.skills IS 'DEPRECATED: use employee_skills table for M:N relationship';

-- ============================================
-- STEP 2: Create db_table_registry
-- Cached metadata about real tables, auto-populated
-- ============================================

CREATE TABLE IF NOT EXISTS db_table_registry (
  table_name VARCHAR(128) PRIMARY KEY,
  table_category VARCHAR(50) NOT NULL DEFAULT 'business'
    CHECK (table_category IN ('business', 'sap', 'system', 'audit', 'semantic', 'config', 'staging')),
  module VARCHAR(50),
  row_count BIGINT DEFAULT 0,
  column_count INT DEFAULT 0,
  has_tenant_id BOOLEAN DEFAULT false,
  has_rls BOOLEAN DEFAULT false,
  has_created_at BOOLEAN DEFAULT false,
  has_updated_at BOOLEAN DEFAULT false,
  fk_out_count INT DEFAULT 0,
  fk_in_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create page_table_relations (M:N junction)
-- ============================================

CREATE TABLE IF NOT EXISTS page_table_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES platform_pages(id) ON DELETE CASCADE,
  table_name VARCHAR(128) NOT NULL,
  relation_type VARCHAR(20) NOT NULL DEFAULT 'primary'
    CHECK (relation_type IN ('primary', 'secondary', 'read', 'write', 'indirect')),
  source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_fk', 'auto_route', 'auto_query', 'inferred')),
  confidence SMALLINT NOT NULL DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, table_name, relation_type)
);

CREATE INDEX idx_ptr_page ON page_table_relations(page_id);
CREATE INDEX idx_ptr_table ON page_table_relations(table_name);
CREATE INDEX idx_ptr_type ON page_table_relations(relation_type);

-- ============================================
-- STEP 4: Create page_table_sync_log
-- Consolidates _migration_cleanup_log
-- ============================================

CREATE TABLE IF NOT EXISTS page_table_sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type VARCHAR(30) NOT NULL,
  tables_discovered INT DEFAULT 0,
  relations_created INT DEFAULT 0,
  relations_removed INT DEFAULT 0,
  orphans_found INT DEFAULT 0,
  duration_ms INT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing cleanup log entries
INSERT INTO page_table_sync_log (sync_type, details, created_at)
SELECT 'migration_' || phase, jsonb_build_object('operation', operation, 'table', target_table, 'column', target_column, 'rows', rows_affected) || COALESCE(details, '{}'::jsonb), created_at
FROM _migration_cleanup_log;

-- ============================================
-- STEP 5: Populate db_table_registry from pg_tables
-- ============================================

INSERT INTO db_table_registry (table_name, table_category, module, row_count, column_count, has_tenant_id, has_rls, has_created_at, has_updated_at, fk_out_count, fk_in_count)
SELECT
  t.tablename,
  CASE
    WHEN t.tablename LIKE 'pa0%' OR t.tablename LIKE 'pb0%' OR t.tablename LIKE 'pb4%'
         OR t.tablename LIKE 'hrp%' OR t.tablename LIKE 'pcl%' OR t.tablename LIKE 't5%'
         OR t.tablename LIKE 'ext_%' THEN 'sap'
    WHEN t.tablename LIKE 'schema_%' OR t.tablename LIKE '_%' THEN 'system'
    WHEN t.tablename LIKE 'audit_%' OR t.tablename LIKE '%_audit_%' OR t.tablename LIKE 'error_%' THEN 'audit'
    WHEN t.tablename LIKE 'semantic_%' OR t.tablename LIKE 'embedding_%' THEN 'semantic'
    WHEN t.tablename LIKE '%_staging' OR t.tablename LIKE 'sap_%' THEN 'staging'
    WHEN t.tablename LIKE '%_config%' OR t.tablename LIKE 'service_%' OR t.tablename LIKE 'sso_%' THEN 'config'
    ELSE 'business'
  END,
  CASE
    WHEN t.tablename IN ('employees','employee_addresses','employee_bank_details','employee_contracts',
      'employee_documents','employee_emergency_contacts','employee_certifications','employee_skills',
      'employee_skill_profiles','employee_training_records','employee_attendance','employee_occupations',
      'employee_pay_stubs','employee_benefit_enrollments','employee_requests','employee_time_off_requests',
      'employee_time_off_balances','employee_kpi_targets','employee_job_assignments','employee_permission_overrides',
      'employee_career_paths','employee_skill_assessments','employee_skill_history','employee_skill_mappings')
      THEN 'hr_core'
    WHEN t.tablename IN ('departments','org_units','cost_centers','locations','org_areas','org_levels',
      'org_templates','org_unit_templates','org_chart_snapshots','org_chart_templates') THEN 'organization'
    WHEN t.tablename LIKE 'goal%' OR t.tablename LIKE 'performance%' OR t.tablename LIKE 'check_in%'
      OR t.tablename LIKE 'okr%' OR t.tablename LIKE 'calibration%' OR t.tablename LIKE 'self_review%'
      OR t.tablename LIKE 'competenc%' THEN 'performance'
    WHEN t.tablename LIKE 'course%' OR t.tablename LIKE 'learning%' OR t.tablename = 'certifications'
      OR t.tablename LIKE 'module_%' THEN 'learning'
    WHEN t.tablename LIKE 'esco_%' OR t.tablename LIKE 'onet_%' OR t.tablename LIKE 'skill_%'
      OR t.tablename LIKE 'ontology_%' THEN 'talent'
    WHEN t.tablename LIKE 'job_%' OR t.tablename LIKE 'position_%' THEN 'job_analysis'
    WHEN t.tablename LIKE 'survey%' OR t.tablename LIKE 'pulse_%' OR t.tablename LIKE 'engagement%'
      OR t.tablename LIKE 'wellbeing%' OR t.tablename LIKE 'burnout%' THEN 'engagement'
    WHEN t.tablename LIKE 'recruiting%' OR t.tablename = 'candidates' OR t.tablename LIKE 'application%'
      OR t.tablename LIKE 'interview%' OR t.tablename LIKE 'internal_%' THEN 'recruiting'
    WHEN t.tablename LIKE 'analytics%' THEN 'analytics'
    WHEN t.tablename LIKE 'news_%' OR t.tablename LIKE 'notification%' OR t.tablename LIKE 'social_%'
      OR t.tablename LIKE 'club_%' THEN 'communication'
    WHEN t.tablename LIKE 'succession%' OR t.tablename LIKE 'career%' OR t.tablename LIKE 'talent_pool%'
      OR t.tablename LIKE 'mentor%' THEN 'succession'
    WHEN t.tablename LIKE 'rag_%' OR t.tablename LIKE 'ai_%' THEN 'ai'
    WHEN t.tablename IN ('tenants','users','roles','permissions','role_permissions','platform_pages',
      'platform_features','feature_modules','feature_categories','features') THEN 'platform'
    WHEN t.tablename LIKE 'contract%' OR t.tablename LIKE 'salary%' OR t.tablename LIKE 'bonus%'
      OR t.tablename LIKE 'payroll%' OR t.tablename LIKE 'merit%' OR t.tablename LIKE 'compensation%'
      THEN 'compensation'
    WHEN t.tablename LIKE 'compliance%' OR t.tablename LIKE 'data_subject%' OR t.tablename LIKE 'whistleblowing%'
      OR t.tablename LIKE 'policy%' THEN 'compliance'
    WHEN t.tablename LIKE 'document%' OR t.tablename LIKE 'signature%' THEN 'documents'
    WHEN t.tablename LIKE 'onboarding%' OR t.tablename LIKE 'preboarding%' THEN 'onboarding'
    WHEN t.tablename LIKE 'plugin%' OR t.tablename LIKE 'webhook%' OR t.tablename LIKE 'marketplace%'
      THEN 'marketplace'
    WHEN t.tablename LIKE 'dashboard%' OR t.tablename LIKE 'report%' OR t.tablename LIKE 'export%'
      THEN 'reporting'
    WHEN t.tablename LIKE 'leave%' OR t.tablename LIKE 'attendance%' THEN 'time_management'
    WHEN t.tablename LIKE 'workforce%' OR t.tablename LIKE 'turnover%' OR t.tablename LIKE 'prediction%'
      THEN 'workforce_planning'
    ELSE NULL
  END,
  COALESCE(s.n_live_tup, 0),
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.tablename AND c.table_schema = 'public'),
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.tablename AND c.column_name = 'tenant_id' AND c.table_schema = 'public'),
  EXISTS(SELECT 1 FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public'),
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.tablename AND c.column_name = 'created_at' AND c.table_schema = 'public'),
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.tablename AND c.column_name = 'updated_at' AND c.table_schema = 'public'),
  (SELECT COUNT(*) FROM information_schema.table_constraints tc WHERE tc.table_name = t.tablename AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_schema = 'public'),
  (SELECT COUNT(*) FROM information_schema.constraint_column_usage ccu JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name WHERE ccu.table_name = t.tablename AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_schema = 'public')
FROM pg_tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename AND s.schemaname = 'public'
WHERE t.schemaname = 'public';

-- ============================================
-- STEP 6: Mark DEPRECATED columns
-- ============================================

COMMENT ON COLUMN platform_pages.tags IS 'DEPRECATED: will be replaced by page_table_relations in Phase 8. >20% invalid values require data cleaning first.';
COMMENT ON COLUMN platform_features.requires_tables IS 'DEPRECATED: will be replaced by feature_required_tables junction in Phase 8';
COMMENT ON COLUMN platform_features.requires_views IS 'DEPRECATED: will be replaced by feature_required_views junction in Phase 8';
COMMENT ON COLUMN platform_features.requires_api_endpoints IS 'DEPRECATED: will be replaced by feature_required_endpoints junction in Phase 8';
COMMENT ON COLUMN platform_features.requires_ui_components IS 'DEPRECATED: will be replaced by feature_required_components junction in Phase 8';

-- ============================================
-- LOG
-- ============================================

INSERT INTO page_table_sync_log (sync_type, tables_discovered, details)
SELECT 'initial_registry_sync', COUNT(*), jsonb_build_object('business', COUNT(*) FILTER (WHERE table_category = 'business'), 'sap', COUNT(*) FILTER (WHERE table_category = 'sap'), 'system', COUNT(*) FILTER (WHERE table_category = 'system'))
FROM db_table_registry;

INSERT INTO schema_migrations (version) VALUES ('124_normalize_and_registry');

COMMIT;
