-- Migration 185: register SEE Fase 9 admin UI in platform_pages + nav items
--
-- Adds the /admin/enrichment list page and the /admin/enrichment/:id detail
-- page to the platform_pages registry, plus nav_items entries for the
-- platform_console, tech_admin and hr_strategic dashboards so SUPERUSER,
-- TENANT_OWNER, and HR_DIRECTOR users can discover them from the sidebar.

INSERT INTO platform_pages (
  id, section_key, section_title, section_desc, section_color, section_icon,
  section_order, path, name, description, tags, status, page_order, is_visible
)
VALUES
  (
    gen_random_uuid(), 'admin', 'Administration', 'Amministrazione del tenant',
    'bg-purple-500/10 text-purple-600', 'Sparkles', 90,
    '/admin/enrichment', 'Semantic Enrichment',
    'Gestione job di arricchimento automatico: lista, approvazione candidati, rollback scritture.',
    ARRAY['see','enrichment','ai']::text[], 'active', 10, true
  ),
  (
    gen_random_uuid(), 'admin', 'Administration', 'Amministrazione del tenant',
    'bg-purple-500/10 text-purple-600', 'Sparkles', 90,
    '/admin/enrichment/new', 'New Enrichment Job',
    'Creazione di un nuovo job di arricchimento semantico.',
    ARRAY['see','enrichment','ai']::text[], 'active', 11, false
  )
ON CONFLICT (path) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      status = 'active',
      updated_at = NOW();

-- Register in rbp_pages (the int-id RBP registry used by nav_items FK).
INSERT INTO rbp_pages (code, name, description, route_path, functional_area_code, status, icon)
VALUES
  ('enrichment_list', 'Semantic Enrichment', 'Lista job enrichment', '/admin/enrichment', 'ENRICHMENT', 'ACTIVE', 'Sparkles'),
  ('enrichment_detail', 'Enrichment Job Detail', 'Dettaglio + approvazione candidati', '/admin/enrichment/[id]', 'ENRICHMENT', 'ACTIVE', 'Sparkles')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      route_path = EXCLUDED.route_path,
      functional_area_code = EXCLUDED.functional_area_code,
      status = 'ACTIVE',
      updated_at = NOW();

-- Nav items: wire into platform_console + tech_admin + hr_strategic dashboards.
-- rbp_dashboard_nav_items.target_page_id FKs into rbp_pages (integer id).
INSERT INTO rbp_dashboard_nav_items
  (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT d.id, 'page', p.id, 'admin', 'Enrichment', 'Sparkles', 520, true
  FROM rbp_dashboards d
  JOIN rbp_pages p ON p.code = 'enrichment_list'
 WHERE d.code IN ('platform_console', 'tech_admin', 'hr_strategic')
ON CONFLICT DO NOTHING;
