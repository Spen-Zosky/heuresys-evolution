-- Migration 162: Add my_card and my_documents widgets, update EMPLOYEE workspace template
-- Date: 2026-04-08

BEGIN;

-- 1. Insert new widgets into widget_catalog
INSERT INTO widget_catalog (code, name, description, widget_type, data_source_type, data_source_config, default_size, min_size, max_size, icon, functional_area_code, perspective_code, is_active, requires_min_role, metadata)
VALUES
  ('my_card', 'My Card', 'Personal employee card with profile summary and key info', 'CUSTOM', 'SQL', '{}', '{"w": 6, "h": 4}', '{"w": 3, "h": 3}', '{"w": 12, "h": 6}', 'CreditCard', 'SELF_SERVICE', NULL, true, 8, '{}'),
  ('my_documents', 'My Documents', 'Personal documents list with upload and download access', 'LIST', 'SQL', '{}', '{"w": 6, "h": 3}', '{"w": 3, "h": 2}', '{"w": 12, "h": 6}', 'FileText', 'SELF_SERVICE', NULL, true, 8, '{}')
ON CONFLICT (code) DO NOTHING;

-- 2. Update EMPLOYEE workspace template with 7-widget layout
UPDATE workspace_templates
SET widget_config = '[
  {"widget_code": "my_card",             "x": 0, "y": 0,  "w": 6,  "h": 4},
  {"widget_code": "notifications_feed",  "x": 6, "y": 0,  "w": 6,  "h": 3},
  {"widget_code": "my_tasks",            "x": 0, "y": 4,  "w": 6,  "h": 3},
  {"widget_code": "my_documents",        "x": 6, "y": 3,  "w": 6,  "h": 3},
  {"widget_code": "learning_progress",   "x": 0, "y": 7,  "w": 3,  "h": 4},
  {"widget_code": "career_path",         "x": 3, "y": 7,  "w": 9,  "h": 4},
  {"widget_code": "quick_links",         "x": 0, "y": 11, "w": 12, "h": 2}
]'::jsonb,
    updated_at = NOW()
WHERE code = 'employee_essentials';

COMMIT;
