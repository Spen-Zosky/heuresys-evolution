-- Migration 190: Workspace Template Designer (P3-14)
-- Updates widget_config for all 8 role templates + registers admin page in rbp_pages + nav_items
-- Idempotent via ON CONFLICT / WHERE NOT EXISTS

BEGIN;

-- ============================================================================
-- 1. Update widget_config for existing templates (they already have code, name, etc.)
-- ============================================================================

-- SUPERUSER — platform_ops
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "system_health",     "x": 0, "y": 0, "w": 4, "h": 3},
  {"widget_code": "active_users_kpi",  "x": 4, "y": 0, "w": 4, "h": 3},
  {"widget_code": "api_usage",         "x": 8, "y": 0, "w": 4, "h": 3},
  {"widget_code": "process_health",    "x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "compliance_status", "x": 6, "y": 3, "w": 6, "h": 4}
]'::jsonb, updated_at = NOW()
WHERE code = 'platform_ops' AND widget_config = '[]'::jsonb;

-- TENANT_OWNER — executive_dashboard
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "headcount_kpi",     "x": 0, "y": 0, "w": 3, "h": 3},
  {"widget_code": "turnover_kpi",      "x": 3, "y": 0, "w": 3, "h": 3},
  {"widget_code": "engagement_score",  "x": 6, "y": 0, "w": 3, "h": 3},
  {"widget_code": "open_positions_kpi","x": 9, "y": 0, "w": 3, "h": 3},
  {"widget_code": "performance_scores","x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "compensation_bands","x": 6, "y": 3, "w": 6, "h": 4}
]'::jsonb, updated_at = NOW()
WHERE code = 'executive_dashboard' AND widget_config = '[]'::jsonb;

-- IT_ADMIN — it_admin_console
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "system_health",      "x": 0, "y": 0, "w": 4, "h": 3},
  {"widget_code": "api_usage",          "x": 4, "y": 0, "w": 4, "h": 3},
  {"widget_code": "active_users_kpi",   "x": 8, "y": 0, "w": 4, "h": 3},
  {"widget_code": "compliance_status",  "x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "notifications_feed", "x": 6, "y": 3, "w": 6, "h": 4}
]'::jsonb, updated_at = NOW()
WHERE code = 'it_admin_console' AND widget_config = '[]'::jsonb;

-- HR_DIRECTOR — hr_strategic_view
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "headcount_kpi",     "x": 0, "y": 0, "w": 3, "h": 3},
  {"widget_code": "turnover_kpi",      "x": 3, "y": 0, "w": 3, "h": 3},
  {"widget_code": "engagement_score",  "x": 6, "y": 0, "w": 3, "h": 3},
  {"widget_code": "open_positions_kpi","x": 9, "y": 0, "w": 3, "h": 3},
  {"widget_code": "performance_scores","x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "skill_gaps_chart",  "x": 6, "y": 3, "w": 6, "h": 4},
  {"widget_code": "pending_approvals", "x": 0, "y": 7, "w": 6, "h": 4}
]'::jsonb, updated_at = NOW()
WHERE code = 'hr_strategic_view' AND widget_config = '[]'::jsonb;

-- HR_MANAGER — hr_command_center
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "headcount_kpi",      "x": 0, "y": 0, "w": 4, "h": 3},
  {"widget_code": "open_positions_kpi", "x": 4, "y": 0, "w": 4, "h": 3},
  {"widget_code": "pending_approvals",  "x": 8, "y": 0, "w": 4, "h": 3},
  {"widget_code": "performance_scores", "x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "team_absences",      "x": 6, "y": 3, "w": 6, "h": 4},
  {"widget_code": "notifications_feed", "x": 0, "y": 7, "w": 12, "h": 3}
]'::jsonb, updated_at = NOW()
WHERE code = 'hr_command_center' AND widget_config = '[]'::jsonb;

-- DEPT_HEAD — dept_head_cockpit
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "headcount_kpi",      "x": 0, "y": 0, "w": 4, "h": 3},
  {"widget_code": "performance_scores", "x": 4, "y": 0, "w": 4, "h": 3},
  {"widget_code": "pending_approvals",  "x": 8, "y": 0, "w": 4, "h": 3},
  {"widget_code": "team_absences",      "x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "org_chart_mini",     "x": 6, "y": 3, "w": 6, "h": 4}
]'::jsonb, updated_at = NOW()
WHERE code = 'dept_head_cockpit' AND widget_config = '[]'::jsonb;

-- LINE_MANAGER — manager_overview
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "my_card",            "x": 0, "y": 0, "w": 4, "h": 3},
  {"widget_code": "pending_approvals",  "x": 4, "y": 0, "w": 4, "h": 3},
  {"widget_code": "team_absences",      "x": 8, "y": 0, "w": 4, "h": 3},
  {"widget_code": "performance_scores", "x": 0, "y": 3, "w": 6, "h": 4},
  {"widget_code": "notifications_feed", "x": 6, "y": 3, "w": 6, "h": 4},
  {"widget_code": "quick_links",        "x": 0, "y": 7, "w": 12, "h": 2}
]'::jsonb, updated_at = NOW()
WHERE code = 'manager_overview' AND widget_config = '[]'::jsonb;

-- EMPLOYEE — employee_essentials
UPDATE workspace_templates SET widget_config = '[
  {"widget_code": "my_card",            "x": 0, "y": 0, "w": 4, "h": 3},
  {"widget_code": "notifications_feed", "x": 4, "y": 0, "w": 4, "h": 3},
  {"widget_code": "quick_links",        "x": 8, "y": 0, "w": 4, "h": 3},
  {"widget_code": "leave_balance",      "x": 0, "y": 3, "w": 4, "h": 4},
  {"widget_code": "learning_progress",  "x": 4, "y": 3, "w": 4, "h": 4},
  {"widget_code": "career_path",        "x": 8, "y": 3, "w": 4, "h": 4},
  {"widget_code": "my_documents",       "x": 0, "y": 7, "w": 6, "h": 3},
  {"widget_code": "my_tasks",           "x": 6, "y": 7, "w": 6, "h": 3}
]'::jsonb, updated_at = NOW()
WHERE code = 'employee_essentials' AND widget_config = '[]'::jsonb;

-- ============================================================================
-- 2. Register admin page in platform_pages (P9 data-driven)
-- ============================================================================

INSERT INTO platform_pages (section_key, section_title, section_order, path, name, description, tags, status, page_order)
VALUES (
  'admin', 'Administration', 90,
  '/admin/workspace-templates',
  'Workspace Template Designer',
  'Admin CRUD for role-default workspace templates',
  ARRAY['workspace', 'templates', 'admin', 'P3-14'],
  'active',
  85
)
ON CONFLICT (path) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status;

-- ============================================================================
-- 3. Register page in rbp_pages (WORKSPACE functional area)
-- ============================================================================

INSERT INTO rbp_pages (code, name, description, route_path, functional_area_code, status, icon, suggested_dashboards)
VALUES (
  'ADMIN_WORKSPACE_TEMPLATES',
  'Workspace Template Designer',
  'Admin CRUD for role-default workspace templates',
  '/admin/workspace-templates',
  'WORKSPACE',
  'ACTIVE',
  'LayoutTemplate',
  ARRAY['platform_console', 'tech_admin']
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  route_path = EXCLUDED.route_path,
  status = EXCLUDED.status;

-- ============================================================================
-- 4. Register nav items for platform_console (dashboard_id=1) and tech_admin (dashboard_id=2)
-- ============================================================================

INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT 1, 'page', rp.id, 'admin', 'Workspace Templates', 'LayoutTemplate', 850, true
  FROM rbp_pages rp
 WHERE rp.code = 'ADMIN_WORKSPACE_TEMPLATES'
   AND NOT EXISTS (
     SELECT 1 FROM rbp_dashboard_nav_items n
      WHERE n.dashboard_id = 1 AND n.target_page_id = rp.id
   );

INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, label_override, icon_override, sort_order, is_visible)
SELECT 2, 'page', rp.id, 'admin', 'Workspace Templates', 'LayoutTemplate', 850, true
  FROM rbp_pages rp
 WHERE rp.code = 'ADMIN_WORKSPACE_TEMPLATES'
   AND NOT EXISTS (
     SELECT 1 FROM rbp_dashboard_nav_items n
      WHERE n.dashboard_id = 2 AND n.target_page_id = rp.id
   );

COMMIT;
