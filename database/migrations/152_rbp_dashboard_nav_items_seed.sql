-- ============================================================================
-- Migration 152: Seed rbp_dashboard_nav_items
-- Populates sidebar navigation for all 10 dashboards
-- ============================================================================

BEGIN;

-- Helper: resolve dashboard_id and page_id by code
-- Using subqueries to keep it portable

-- ============================================================================
-- 1. PLATFORM CONSOLE (dashboard_id = 1)
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'platform_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'platform_overview'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'platform_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'tenant_management'), 'main', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'platform_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'system_health'), 'main', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'platform_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'platform_security'), 'admin', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'platform_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'platform_users'), 'admin', 50, true);

-- ============================================================================
-- 2. TECH ADMIN (dashboard_id = 2) — SYSADMIN + IT_ADMIN
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'tech_admin'), 'page', (SELECT id FROM rbp_pages WHERE code = 'tenant_config'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'tech_admin'), 'page', (SELECT id FROM rbp_pages WHERE code = 'user_management'), 'main', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'tech_admin'), 'page', (SELECT id FROM rbp_pages WHERE code = 'audit_log'), 'main', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'tech_admin'), 'page', (SELECT id FROM rbp_pages WHERE code = 'marketplace'), 'tools', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'tech_admin'), 'page', (SELECT id FROM rbp_pages WHERE code = 'ai_chat'), 'tools', 50, true);

-- ============================================================================
-- 3. HR STRATEGIC (dashboard_id = 3) — HR_DIRECTOR
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
-- Core HR
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'employee_directory'), 'hr', 10, true),
-- Talent & Succession
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'succession_planning'), 'talent', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'skill_profiles'), 'talent', 25, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'gap_analysis'), 'talent', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'career_paths'), 'talent', 35, true),
-- Performance
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'performance_reviews'), 'performance', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'calibration'), 'performance', 45, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'goals_management'), 'performance', 50, true),
-- Compensation
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'compensation_modeling'), 'compensation', 60, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'salary_bands'), 'compensation', 65, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'bonus_plans'), 'compensation', 70, true),
-- Analytics
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'analytics_dashboard'), 'analytics', 80, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'hr_intelligence'), 'analytics', 85, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'predictions'), 'analytics', 90, true),
-- Compliance
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'compliance_dashboard'), 'compliance', 100, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'audit_log'), 'compliance', 105, true),
-- Cross-dashboard link to Workforce Intelligence
((SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'page', (SELECT id FROM rbp_pages WHERE code = 'career_simulator'), 'analytics', 95, true);

-- ============================================================================
-- 4. HR OPERATIONS (dashboard_id = 4) — HR_MANAGER
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
-- Core HR
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'employee_directory'), 'hr', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'org_chart'), 'hr', 15, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'departments'), 'hr', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'positions'), 'hr', 25, true),
-- Talent
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'skill_profiles'), 'talent', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'esco_explorer'), 'talent', 35, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'internal_mobility'), 'talent', 40, true),
-- Performance
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'performance_reviews'), 'performance', 50, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'goals_management'), 'performance', 55, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'check_ins'), 'performance', 60, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'feedback_management'), 'performance', 65, true),
-- T&A
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'recruiting'), 'operations', 70, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'requisitions'), 'operations', 75, true),
-- Learning
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'training_catalog'), 'learning', 80, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'knowledge_base'), 'learning', 85, true),
-- Engagement
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'engagement_surveys'), 'engagement', 90, true),
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'recognition_admin'), 'engagement', 95, true),
-- Teams
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'team_management'), 'teams', 100, true),
-- Compliance
((SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'page', (SELECT id FROM rbp_pages WHERE code = 'compliance_dashboard'), 'compliance', 110, true);

-- ============================================================================
-- 5. DEPARTMENT CONSOLE (dashboard_id = 5) — DEPT_HEAD
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'employee_directory'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'org_chart'), 'main', 15, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'performance_reviews'), 'performance', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'goals_management'), 'performance', 25, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'check_ins'), 'performance', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'team_management'), 'teams', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'analytics_dashboard'), 'analytics', 50, true),
((SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'page', (SELECT id FROM rbp_pages WHERE code = 'training_catalog'), 'learning', 60, true);

-- ============================================================================
-- 6. COMPANY PET ANALYTICS (dashboard_id = 6)
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'company_pet'), 'page', (SELECT id FROM rbp_pages WHERE code = 'company_pet_overview'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'company_pet'), 'page', (SELECT id FROM rbp_pages WHERE code = 'company_pet_hierarchy'), 'main', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'company_pet'), 'page', (SELECT id FROM rbp_pages WHERE code = 'company_pet_workforce'), 'main', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'company_pet'), 'page', (SELECT id FROM rbp_pages WHERE code = 'company_pet_staging'), 'main', 40, true);

-- ============================================================================
-- 7. WORKFORCE INTELLIGENCE (dashboard_id = 7) — HR_DIRECTOR exclusive
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'workforce_intelligence'), 'page', (SELECT id FROM rbp_pages WHERE code = 'career_simulator'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'workforce_intelligence'), 'page', (SELECT id FROM rbp_pages WHERE code = 'skill_galaxy'), 'main', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'workforce_intelligence'), 'page', (SELECT id FROM rbp_pages WHERE code = 'what_if'), 'main', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'workforce_intelligence'), 'page', (SELECT id FROM rbp_pages WHERE code = 'org_dashboard_wi'), 'main', 40, true);

-- ============================================================================
-- 8. DASHBOARDS HUB (dashboard_id = 8) — Cross-dashboard navigator
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, target_dashboard_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'dashboards_hub'), 'dashboard', NULL, (SELECT id FROM rbp_dashboards WHERE code = 'hr_strategic'), 'dashboards', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'dashboards_hub'), 'dashboard', NULL, (SELECT id FROM rbp_dashboards WHERE code = 'hr_operations'), 'dashboards', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'dashboards_hub'), 'dashboard', NULL, (SELECT id FROM rbp_dashboards WHERE code = 'company_pet'), 'dashboards', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'dashboards_hub'), 'dashboard', NULL, (SELECT id FROM rbp_dashboards WHERE code = 'workforce_intelligence'), 'dashboards', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'dashboards_hub'), 'dashboard', NULL, (SELECT id FROM rbp_dashboards WHERE code = 'department_console'), 'dashboards', 50, true);

-- ============================================================================
-- 9. MANAGER HUB (dashboard_id = 9) — LINE_MANAGER
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_line'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'approvals'), 'main', 15, true),
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'performance_reviews'), 'performance', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'goals_management'), 'performance', 25, true),
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'check_ins'), 'performance', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'team_management'), 'teams', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'manager_hub'), 'page', (SELECT id FROM rbp_pages WHERE code = 'team_map'), 'teams', 45, true);

-- ============================================================================
-- 10. EMPLOYEE PORTAL (dashboard_id = 10) — EMPLOYEE self-service
-- ============================================================================
INSERT INTO rbp_dashboard_nav_items (dashboard_id, item_type, target_page_id, section, sort_order, is_visible) VALUES
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_profile'), 'main', 10, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_goals'), 'career', 20, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_reviews'), 'career', 25, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_learning'), 'career', 30, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_leave'), 'time', 40, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_documents'), 'docs', 50, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'my_payslips'), 'docs', 55, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'approvals'), 'actions', 60, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'recognition_portal'), 'social', 70, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'org_chart_readonly'), 'explore', 80, true),
((SELECT id FROM rbp_dashboards WHERE code = 'employee_portal'), 'page', (SELECT id FROM rbp_pages WHERE code = 'ai_chat'), 'tools', 90, true);

-- Log
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM rbp_dashboard_nav_items;
    RAISE NOTICE 'Migration 152 complete. Total nav items: %', v_count;
END $$;

COMMIT;
