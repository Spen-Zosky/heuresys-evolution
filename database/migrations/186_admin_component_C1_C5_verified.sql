-- Migration 186: C1-C5 extraction verified + portal pages + nav items
--
-- Updates the 5 admin_component_registry candidates (registered in mig 181)
-- to verified_with_data=true now that the extraction is complete.
-- Registers the 4 new portal pages and wires nav items into employee_portal.
-- (Portal org-chart already exists from earlier migrations.)
--
-- Uses explicit UPDATE WHERE instead of ON CONFLICT because the unique
-- constraint (tenant_id, code) does not use NULLS NOT DISTINCT, so
-- ON CONFLICT cannot match rows where tenant_id IS NULL.

BEGIN;

-- ============================================
-- 1. Update admin_component_registry entries
-- ============================================

UPDATE admin_component_registry
   SET verified_with_data = true,
       verified_at = NOW(),
       reuse_contexts = ARRAY['admin','portal']::text[],
       frontend_path = 'services/frontend/src/app/admin/career/_components/career-dashboard-view.tsx',
       export_name = 'CareerDashboardView',
       export_kind = 'named',
       prop_shape = '{"readOnly":"boolean","headerActions":"ReactNode","linkPrefix":"string"}'::jsonb,
       updated_at = NOW()
 WHERE tenant_id IS NULL AND code = 'tab-career-landing';

UPDATE admin_component_registry
   SET verified_with_data = true,
       verified_at = NOW(),
       reuse_contexts = ARRAY['admin','portal']::text[],
       frontend_path = 'services/frontend/src/app/admin/career/learning/_components/learning-catalog-view.tsx',
       export_name = 'LearningCatalogView',
       export_kind = 'named',
       prop_shape = '{"readOnly":"boolean","headerActions":"ReactNode","linkPrefix":"string"}'::jsonb,
       updated_at = NOW()
 WHERE tenant_id IS NULL AND code = 'tab-learning-catalog';

UPDATE admin_component_registry
   SET verified_with_data = true,
       verified_at = NOW(),
       reuse_contexts = ARRAY['admin','portal']::text[],
       frontend_path = 'services/frontend/src/app/admin/career/skills/_components/skill-assessment-view.tsx',
       export_name = 'SkillAssessmentView',
       export_kind = 'named',
       prop_shape = '{"readOnly":"boolean","headerActions":"ReactNode","linkPrefix":"string"}'::jsonb,
       updated_at = NOW()
 WHERE tenant_id IS NULL AND code = 'tab-skill-self-assessment';

UPDATE admin_component_registry
   SET verified_with_data = true,
       verified_at = NOW(),
       reuse_contexts = ARRAY['admin','portal']::text[],
       frontend_path = 'services/frontend/src/app/admin/analytics/workforce/_components/workforce-kpis-view.tsx',
       export_name = 'WorkforceKpisView',
       export_kind = 'named',
       prop_shape = '{"readOnly":"boolean","headerActions":"ReactNode"}'::jsonb,
       updated_at = NOW()
 WHERE tenant_id IS NULL AND code = 'tab-workforce-kpis';

UPDATE admin_component_registry
   SET verified_with_data = true,
       verified_at = NOW(),
       reuse_contexts = ARRAY['admin','portal']::text[],
       frontend_path = 'services/frontend/src/app/admin/org-units/_components/org-units-view.tsx',
       export_name = 'OrgUnitsView',
       export_kind = 'named',
       prop_shape = '{"readOnly":"boolean","headerActions":"ReactNode","renderRowActions":"function"}'::jsonb,
       updated_at = NOW()
 WHERE tenant_id IS NULL AND code = 'tab-org-structure';

-- ============================================
-- 2. Register new portal pages in platform_pages
-- ============================================

INSERT INTO platform_pages (
  id, section_key, section_title, section_desc, section_color, section_icon,
  section_order, path, name, description, tags, status, page_order, is_visible
)
VALUES
  (gen_random_uuid(), 'portal', 'Portal', 'Area personale dipendente',
   'bg-blue-500/10 text-blue-600', 'User', 10,
   '/portal/career', 'Carriera',
   'Dashboard carriera personale: AI career coach, skill gaps, percorsi consigliati.',
   ARRAY['career','portal','ai']::text[], 'active', 20, true),

  (gen_random_uuid(), 'portal', 'Portal', 'Area personale dipendente',
   'bg-blue-500/10 text-blue-600', 'GraduationCap', 10,
   '/portal/learning/catalog', 'Catalogo Formazione',
   'Catalogo corsi disponibili, filtri per tipo, stato, durata.',
   ARRAY['learning','portal','catalog']::text[], 'active', 25, true),

  (gen_random_uuid(), 'portal', 'Portal', 'Area personale dipendente',
   'bg-blue-500/10 text-blue-600', 'Sparkles', 10,
   '/portal/skills', 'Competenze',
   'Self-assessment competenze, gap analysis, radar chart.',
   ARRAY['skills','portal','assessment']::text[], 'active', 30, true),

  (gen_random_uuid(), 'portal', 'Portal', 'Area personale dipendente',
   'bg-blue-500/10 text-blue-600', 'BarChart3', 10,
   '/portal/analytics', 'Analytics Workforce',
   'KPI workforce: headcount, turnover, trend, metriche per dipartimento.',
   ARRAY['analytics','portal','kpi']::text[], 'active', 35, true)
ON CONFLICT (path) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      status = 'active',
      updated_at = NOW();

-- ============================================
-- 3. Register in rbp_pages
-- ============================================

INSERT INTO rbp_pages (code, name, description, route_path, functional_area_code, status, icon)
VALUES
  ('portal_career',          'Carriera',              'Dashboard carriera personale',      '/portal/career',          'CAREER',       'ACTIVE', 'Compass'),
  ('portal_learning_catalog','Catalogo Formazione',   'Catalogo corsi disponibili',        '/portal/learning/catalog','LEARNING',     'ACTIVE', 'GraduationCap'),
  ('portal_skills',          'Competenze',            'Self-assessment competenze',         '/portal/skills',          'TALENT',       'ACTIVE', 'Sparkles'),
  ('portal_analytics',       'Analytics Workforce',   'KPI workforce organizzazione',      '/portal/analytics',       'ANALYTICS',    'ACTIVE', 'BarChart3')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      route_path = EXCLUDED.route_path,
      functional_area_code = EXCLUDED.functional_area_code,
      status = 'ACTIVE',
      updated_at = NOW();

-- ============================================
-- 4. Wire nav items into employee_portal dashboard
-- ============================================

INSERT INTO rbp_dashboard_nav_items
  (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT d.id, 'page', p.id, 'main', 'Carriera', 'Compass', 200, true
  FROM rbp_dashboards d
  JOIN rbp_pages p ON p.code = 'portal_career'
 WHERE d.code = 'employee_portal'
ON CONFLICT DO NOTHING;

INSERT INTO rbp_dashboard_nav_items
  (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT d.id, 'page', p.id, 'main', 'Catalogo Formazione', 'GraduationCap', 210, true
  FROM rbp_dashboards d
  JOIN rbp_pages p ON p.code = 'portal_learning_catalog'
 WHERE d.code = 'employee_portal'
ON CONFLICT DO NOTHING;

INSERT INTO rbp_dashboard_nav_items
  (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT d.id, 'page', p.id, 'main', 'Competenze', 'Sparkles', 220, true
  FROM rbp_dashboards d
  JOIN rbp_pages p ON p.code = 'portal_skills'
 WHERE d.code = 'employee_portal'
ON CONFLICT DO NOTHING;

INSERT INTO rbp_dashboard_nav_items
  (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT d.id, 'page', p.id, 'main', 'Analytics', 'BarChart3', 230, true
  FROM rbp_dashboards d
  JOIN rbp_pages p ON p.code = 'portal_analytics'
 WHERE d.code IN ('employee_portal', 'hr_manager', 'hr_strategic')
ON CONFLICT DO NOTHING;

COMMIT;
