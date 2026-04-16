-- Migration 194: i18n — Add bilingual parallel columns (_it/_en) to translatable tables
-- Purely additive: new columns alongside existing ones (no renames, no drops)
-- Old columns (name, description) kept for backward compatibility during transition

BEGIN;

-- rbp_functional_areas (34 records)
ALTER TABLE rbp_functional_areas
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- rbp_dashboards (11 records)
ALTER TABLE rbp_dashboards
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- rbp_pages (139 records)
ALTER TABLE rbp_pages
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(150),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(150),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- rbp_dashboard_nav_items (277 records)
ALTER TABLE rbp_dashboard_nav_items
  ADD COLUMN IF NOT EXISTS label_override_it VARCHAR(150),
  ADD COLUMN IF NOT EXISTS label_override_en VARCHAR(150);

-- rbp_perspectives (3 records)
ALTER TABLE rbp_perspectives
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- platform_pages (135 records)
ALTER TABLE platform_pages
  ADD COLUMN IF NOT EXISTS section_title_it VARCHAR(100),
  ADD COLUMN IF NOT EXISTS section_title_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS section_desc_it TEXT,
  ADD COLUMN IF NOT EXISTS section_desc_en TEXT,
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- widget_catalog (26 records)
ALTER TABLE widget_catalog
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(150),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(150),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- workspace_templates (8 records)
ALTER TABLE workspace_templates
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(150),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(150),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- admin_component_registry (15 records)
ALTER TABLE admin_component_registry
  ADD COLUMN IF NOT EXISTS name_it VARCHAR(200),
  ADD COLUMN IF NOT EXISTS name_en VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- rbp_roles (8 records — name is a code identifier, only description needs i18n)
ALTER TABLE rbp_roles
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- enrichment_entity_descriptors (note: table name is enrichment_entity_descriptors, NOT enrichment_descriptors)
ALTER TABLE enrichment_entity_descriptors
  ADD COLUMN IF NOT EXISTS description_it TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

COMMIT;
