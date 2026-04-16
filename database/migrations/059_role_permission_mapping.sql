-- Migration: 059_role_permission_mapping.sql
-- Description: Map permissions to RBAC roles with appropriate scopes
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- ROLE PERMISSION MAPPING
-- Maps each role to permissions with the appropriate scope
-- ============================================================================

-- Clear existing mappings (safe re-run)
TRUNCATE TABLE role_permissions CASCADE;

-- ============================================================================
-- SYSADMIN - Platform administrator (platform scope for ALL)
-- ============================================================================

INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'SYSADMIN'::rbac_role,
    p.id,
    'platform'::permission_scope,
    'Full platform access'
FROM permissions p
WHERE p.is_active = true;

-- ============================================================================
-- TENANT_ADMIN - CEO/COO (tenant scope for most, except platform-only)
-- ============================================================================

INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'TENANT_ADMIN'::rbac_role,
    p.id,
    CASE
        WHEN p.default_scope = 'platform' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    'Tenant-wide access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category != 'platform'; -- Exclude platform-only modules

-- Add read-only access to some platform features for TENANT_ADMIN
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'TENANT_ADMIN'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'Limited platform visibility'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'platform'
AND p.operation = 'read'
AND fm.code IN ('system_health', 'activity_logs', 'integrations')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- IT_ADMIN - IT Director (team scope + config for IT modules)
-- ============================================================================

-- Full access to IT-related modules
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'IT_ADMIN'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'IT admin full access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('sso_config', 'api_keys', 'integrations', 'session_management', 'system_alerts');

-- Read access to users and employees (team scope)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'IT_ADMIN'::rbac_role,
    p.id,
    'team'::permission_scope,
    'IT admin team access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('employees_directory', 'users_tenant', 'org_chart')
AND p.operation IN ('read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Read access to system health and logs
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'IT_ADMIN'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'IT admin monitoring'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('system_health', 'activity_logs', 'audit_logs')
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- AI and semantic search access
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'IT_ADMIN'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'IT admin AI access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'ai'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- HR_DIRECTOR - Strategic HR (tenant scope for HR modules)
-- ============================================================================

-- Full tenant access to HR-core modules
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_DIRECTOR'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Director full access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category IN ('employees', 'organization', 'performance', 'learning', 'skills', 'recruiting', 'compensation', 'time', 'compliance', 'engagement');

-- Analytics access (tenant scope)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_DIRECTOR'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Director analytics'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'analytics'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Settings access (read/update only)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_DIRECTOR'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Director settings'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'settings'
AND p.operation IN ('read', 'update', 'configure')
ON CONFLICT (role, permission_id) DO NOTHING;

-- AI and knowledge base
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_DIRECTOR'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Director AI access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'ai'
ON CONFLICT (role, permission_id) DO NOTHING;

-- News and notifications
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_DIRECTOR'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Director communications'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category IN ('news', 'notifications')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- HR_MANAGER - Operational HR (tenant scope for most HR, limited strategic)
-- ============================================================================

-- Full access to operational HR modules
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_MANAGER'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Manager operational access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category IN ('employees', 'organization', 'performance', 'learning', 'time', 'compliance', 'engagement')
AND fm.code NOT IN ('succession_planning', 'talent_pools', 'calibration'); -- Exclude strategic

-- Limited skills access (no succession planning)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_MANAGER'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Manager skills access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'skills'
AND fm.code NOT IN ('succession_planning', 'talent_pools')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Recruiting access (full)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_MANAGER'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Manager recruiting access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'recruiting'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Compensation: read only (no comp_analytics, no salary_bands modify)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_MANAGER'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Manager compensation read'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'compensation'
AND fm.code NOT IN ('comp_analytics')
AND (fm.code != 'salary_bands' OR p.operation IN ('read'))
ON CONFLICT (role, permission_id) DO NOTHING;

-- Analytics: read only for basic reports
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_MANAGER'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Manager analytics read'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'analytics'
AND p.operation IN ('read', 'export')
AND fm.code NOT IN ('hr_intelligence', 'workforce_planning')
ON CONFLICT (role, permission_id) DO NOTHING;

-- AI, news, notifications
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'HR_MANAGER'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'HR Manager AI/comms'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category IN ('ai', 'news', 'notifications')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- DEPT_HEAD - Department Head (department scope)
-- ============================================================================

-- Employees: department scope
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'department'::permission_scope,
    'Department head employee access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('employees_directory', 'org_chart', 'skill_profile')
AND p.operation IN ('read');

-- Performance: department scope for reviews and goals
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'department'::permission_scope,
    'Department head performance access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'performance'
AND fm.code IN ('goals', 'okrs', 'performance_reviews', 'check_ins', 'manager_reviews', 'pips')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Learning: department scope for team enrollments
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'department'::permission_scope,
    'Department head learning access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('courses', 'course_enrollments', 'learning_analytics')
AND p.operation IN ('read', 'approve')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Time: department scope for approvals
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'department'::permission_scope,
    'Department head time access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'time'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Skills: read department skill matrix
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'department'::permission_scope,
    'Department head skills access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('skill_matrix', 'gap_analysis', 'career_paths')
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- AI chat and semantic search
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'department'::permission_scope,
    'Department head AI access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('ai_chat', 'semantic_search', 'knowledge_base')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- News and notifications (read)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'DEPT_HEAD'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Department head notifications'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category IN ('news', 'notifications')
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- LINE_MANAGER - Team Manager (team scope)
-- ============================================================================

-- Employees: team scope (direct reports)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'team'::permission_scope,
    'Line manager employee access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('employees_directory', 'org_chart', 'skill_profile')
AND p.operation = 'read';

-- Performance: team scope
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'team'::permission_scope,
    'Line manager performance access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'performance'
AND fm.code IN ('goals', 'okrs', 'check_ins', 'manager_reviews')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Performance reviews: read own team, cannot approve
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'team'::permission_scope,
    'Line manager reviews access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code = 'performance_reviews'
AND p.operation IN ('create', 'read', 'update')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Learning: team enrollments
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'team'::permission_scope,
    'Line manager learning access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('courses', 'course_enrollments')
AND p.operation IN ('read', 'approve')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Time: team approvals
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'team'::permission_scope,
    'Line manager time access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('leave_requests', 'time_tracking', 'overtime', 'attendance')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Skills: read team
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'team'::permission_scope,
    'Line manager skills access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('skill_matrix', 'skill_assessments')
AND p.operation IN ('read', 'approve')
ON CONFLICT (role, permission_id) DO NOTHING;

-- AI chat (own)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Line manager AI access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('ai_chat', 'semantic_search')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- News and notifications (own)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'LINE_MANAGER'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Line manager notifications'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category IN ('news', 'notifications')
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- EMPLOYEE - Standard Employee (own scope)
-- ============================================================================

-- Own profile and documents
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own profile'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('employee_profile', 'skill_profile', 'employee_documents')
AND p.operation IN ('read', 'update');

-- Org chart read (tenant visible)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'Employee org chart view'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code = 'org_chart'
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Own goals and self-assessments
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own goals'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('goals', 'okrs', 'self_assessments', 'check_ins')
AND p.operation IN ('create', 'read', 'update')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Read own performance reviews
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own reviews'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code = 'performance_reviews'
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Learning: own courses and enrollments
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own learning'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('courses', 'learning_paths', 'certifications', 'course_enrollments', 'learning_analytics')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Time: own requests
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own time'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('leave_requests', 'time_tracking', 'overtime', 'attendance', 'leave_balances')
AND p.operation IN ('create', 'read', 'update', 'delete')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Skills: own assessments and career
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own skills'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('skill_assessments', 'gap_analysis', 'career_paths')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Compensation: own pay stubs and benefits
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee own compensation'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('pay_stubs', 'benefits', 'compensation_plans')
AND p.operation IN ('read', 'export')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Compliance: own policies and GDPR
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee compliance'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('policies', 'gdpr', 'whistleblowing')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- AI chat (own)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee AI access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('ai_chat', 'semantic_search', 'knowledge_base')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Dashboards: own
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee dashboards'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code = 'dashboards'
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Engagement: surveys and recognition
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee engagement'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('surveys', 'pulse_checks', 'recognition', 'wellbeing')
AND p.operation IN ('create', 'read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- News and notifications (own)
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'own'::permission_scope,
    'Employee news/notifications'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.code IN ('company_news', 'announcements', 'user_notifications')
AND p.operation IN ('read', 'update', 'delete')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Ontology: read access to taxonomies
INSERT INTO role_permissions (role, permission_id, scope, notes)
SELECT
    'EMPLOYEE'::rbac_role,
    p.id,
    'tenant'::permission_scope,
    'Employee ontology access'
FROM permissions p
JOIN feature_modules fm ON p.module_id = fm.id
WHERE p.is_active = true
AND fm.category = 'ontology'
AND p.operation = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_total_mappings INTEGER;
    v_sysadmin_count INTEGER;
    v_tenant_admin_count INTEGER;
    v_it_admin_count INTEGER;
    v_hr_director_count INTEGER;
    v_hr_manager_count INTEGER;
    v_dept_head_count INTEGER;
    v_line_manager_count INTEGER;
    v_employee_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_mappings FROM role_permissions;
    SELECT COUNT(*) INTO v_sysadmin_count FROM role_permissions WHERE role = 'SYSADMIN';
    SELECT COUNT(*) INTO v_tenant_admin_count FROM role_permissions WHERE role = 'TENANT_ADMIN';
    SELECT COUNT(*) INTO v_it_admin_count FROM role_permissions WHERE role = 'IT_ADMIN';
    SELECT COUNT(*) INTO v_hr_director_count FROM role_permissions WHERE role = 'HR_DIRECTOR';
    SELECT COUNT(*) INTO v_hr_manager_count FROM role_permissions WHERE role = 'HR_MANAGER';
    SELECT COUNT(*) INTO v_dept_head_count FROM role_permissions WHERE role = 'DEPT_HEAD';
    SELECT COUNT(*) INTO v_line_manager_count FROM role_permissions WHERE role = 'LINE_MANAGER';
    SELECT COUNT(*) INTO v_employee_count FROM role_permissions WHERE role = 'EMPLOYEE';

    RAISE NOTICE '=== Migration 059 Verification ===';
    RAISE NOTICE 'Total role-permission mappings: % (expected: 400+)', v_total_mappings;
    RAISE NOTICE '';
    RAISE NOTICE 'SYSADMIN permissions: % (all)', v_sysadmin_count;
    RAISE NOTICE 'TENANT_ADMIN permissions: %', v_tenant_admin_count;
    RAISE NOTICE 'IT_ADMIN permissions: %', v_it_admin_count;
    RAISE NOTICE 'HR_DIRECTOR permissions: %', v_hr_director_count;
    RAISE NOTICE 'HR_MANAGER permissions: %', v_hr_manager_count;
    RAISE NOTICE 'DEPT_HEAD permissions: %', v_dept_head_count;
    RAISE NOTICE 'LINE_MANAGER permissions: %', v_line_manager_count;
    RAISE NOTICE 'EMPLOYEE permissions: %', v_employee_count;

    IF v_total_mappings >= 400 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Migration 059 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 059 may have issues - expected 400+ mappings';
    END IF;
END $$;
