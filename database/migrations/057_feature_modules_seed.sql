-- Migration: 057_feature_modules_seed.sql
-- Description: Seed feature_modules table with 85 platform features across 15 categories
-- Date: 2025-12-30
-- Dependencies: 056_rbac_foundation.sql

-- ============================================================================
-- FEATURE MODULES SEED DATA
-- 15 Categories, 85+ Modules
-- ============================================================================

INSERT INTO feature_modules (code, name, category, api_prefix, frontend_path, requires_tenant, sort_order, description)
VALUES

-- ============================================================================
-- CATEGORY: PLATFORM (8 modules) - Platform administration
-- ============================================================================
('platform_settings', 'Platform Settings', 'platform', '/api/platform', '/platform', false, 1,
 'Global platform configuration and settings'),
('tenant_management', 'Tenant Management', 'platform', '/api/tenants', '/platform/tenants', false, 2,
 'Multi-tenant CRUD operations and configuration'),
('tenant_setup', 'Tenant Setup Wizard', 'platform', '/api/tenant-setup', '/admin/settings/tenant-setup', true, 3,
 'Onboarding wizard for new tenants'),
('system_health', 'System Health Monitoring', 'platform', '/api/health', '/platform/health', false, 4,
 'API health checks, database status, service monitoring'),
('audit_logs', 'Audit Logs', 'platform', '/api/audit-logs', '/admin/audit', true, 5,
 'Comprehensive activity logging and compliance trail'),
('error_analytics', 'Error Analytics', 'platform', '/api/error-analytics', '/platform/errors', false, 6,
 'System error monitoring, tracking, and analytics'),
('impersonation', 'User Impersonation', 'platform', '/api/auth/impersonate', NULL, false, 7,
 'SYSADMIN ability to impersonate tenant users for debugging'),
('api_keys', 'API Key Management', 'platform', '/api/api-keys', '/platform/api-keys', false, 8,
 'Manage API keys for integrations'),

-- ============================================================================
-- CATEGORY: USERS (4 modules) - User account management
-- ============================================================================
('users_tenant', 'User Management (Tenant)', 'users', '/api/users', '/admin/users', true, 10,
 'Tenant-level user CRUD and account management'),
('users_platform', 'User Management (Platform)', 'users', '/api/users', '/platform/users', false, 11,
 'Cross-tenant user management (SYSADMIN)'),
('role_assignment', 'Role Assignment', 'users', '/api/users/roles', '/admin/users/roles', true, 12,
 'Assign RBAC roles to employees'),
('password_management', 'Password Management', 'users', '/api/users/password', '/admin/users', true, 13,
 'Password reset, policies, and management'),

-- ============================================================================
-- CATEGORY: EMPLOYEES (6 modules) - Employee master data
-- ============================================================================
('employees_view', 'View Employees', 'employees', '/api/employees', '/admin/employees', true, 20,
 'View employee profiles and information'),
('employees_manage', 'Manage Employees', 'employees', '/api/employees', '/admin/employees', true, 21,
 'Create, update, delete employee records'),
('org_chart', 'Organization Chart', 'employees', '/api/org-charts', '/admin/org-chart', true, 22,
 'Visual org hierarchy and reporting lines'),
('skill_profile', 'Skill Profiles', 'employees', '/api/employee-skill-profiles', '/admin/employees/skills', true, 23,
 'Employee skill cards and KSABA profiles'),
('employee_documents', 'Employee Documents', 'employees', '/api/employee-documents', '/admin/employees/documents', true, 24,
 'Personal documents, contracts, certificates'),
('contracts', 'Employment Contracts', 'employees', '/api/contracts', '/admin/employees/contracts', true, 25,
 'Employment contracts and terms'),

-- ============================================================================
-- CATEGORY: ORGANIZATION (4 modules) - Org structure
-- ============================================================================
('departments', 'Departments', 'organization', '/api/departments', '/admin/departments', true, 30,
 'Department management and structure'),
('locations', 'Locations', 'organization', '/api/locations', '/admin/locations', true, 31,
 'Office locations and site management'),
('org_units', 'Organization Units', 'organization', '/api/org-units', '/admin/org-units', true, 32,
 'Matrix org structure, divisions, directions'),
('cost_centers', 'Cost Centers', 'organization', '/api/cost-centers', '/admin/cost-centers', true, 33,
 'Budget centers and cost allocation'),

-- ============================================================================
-- CATEGORY: PERFORMANCE (11 modules) - Performance management
-- ============================================================================
('goals', 'Goals', 'performance', '/api/goals', '/admin/goals', true, 40,
 'Goal setting, tracking, and alignment'),
('okrs', 'OKRs', 'performance', '/api/okrs', '/admin/okrs', true, 41,
 'Objectives and Key Results management'),
('performance_reviews', 'Performance Reviews', 'performance', '/api/performance-reviews', '/admin/reviews', true, 42,
 'Annual/periodic performance evaluation'),
('review_cycles', 'Review Cycles', 'performance', '/api/review-cycles', '/admin/review-cycles', true, 43,
 'Review cycle creation and timeline management'),
('check_ins', 'Check-ins', 'performance', '/api/check-ins', '/admin/check-ins', true, 44,
 '1:1 check-in tracking and progress monitoring'),
('feedback', 'Feedback', 'performance', '/api/feedback', '/admin/feedback', true, 45,
 '360-degree feedback and peer reviews'),
('calibration', 'Calibration Sessions', 'performance', '/api/calibration-sessions', '/admin/calibration', true, 46,
 'Rating calibration workshops and normalization'),
('recognition', 'Recognition', 'performance', '/api/recognition', '/admin/recognition', true, 47,
 'Peer recognition and rewards'),
('self_assessment', 'Self Assessment', 'performance', '/api/performance-reviews/self', '/portal/self-assessment', true, 48,
 'Employee self-evaluation submission'),
('manager_feedback', 'Manager Feedback', 'performance', '/api/feedback/manager', '/admin/feedback', true, 49,
 'Manager feedback and evaluation'),
('performance_analytics', 'Performance Analytics', 'performance', '/api/performance-analytics', '/admin/analytics/performance', true, 50,
 'Performance dashboards and trending'),

-- ============================================================================
-- CATEGORY: LEARNING (6 modules) - Learning & Development
-- ============================================================================
('courses', 'Courses', 'learning', '/api/courses', '/admin/courses', true, 60,
 'Course catalog and content management'),
('learning_paths', 'Learning Paths', 'learning', '/api/learning-paths', '/admin/learning-paths', true, 61,
 'Structured learning journeys'),
('enrollments', 'Enrollments', 'learning', '/api/enrollments', '/admin/enrollments', true, 62,
 'Course and program enrollments'),
('certifications', 'Certifications', 'learning', '/api/certifications', '/admin/certifications', true, 63,
 'Professional certifications tracking'),
('training_recommendations', 'Training Recommendations', 'learning', '/api/training-recommendations', '/admin/training', true, 64,
 'AI-driven learning recommendations'),
('career_coach', 'Career Coach', 'learning', '/api/career-coach', '/portal/career-coach', true, 65,
 'AI-powered career guidance'),

-- ============================================================================
-- CATEGORY: SKILLS (7 modules) - Skills & Talent
-- ============================================================================
('skill_taxonomy', 'Skill Taxonomy', 'skills', '/api/skills/taxonomy', '/admin/skills/taxonomy', false, 70,
 'Global skill taxonomy and classification'),
('skill_assessments', 'Skill Assessments', 'skills', '/api/skill-assessments', '/admin/skills/assessments', true, 71,
 'Competency assessment execution'),
('gap_analysis', 'Gap Analysis', 'skills', '/api/gap-analysis', '/admin/skills/gaps', true, 72,
 'Skills gap identification and recommendations'),
('succession', 'Succession Planning', 'skills', '/api/succession', '/admin/succession', true, 73,
 'Succession readiness and pipeline'),
('career_paths', 'Career Paths', 'skills', '/api/career-paths', '/admin/career-paths', true, 74,
 'Career progression roadmaps'),
('internal_mobility', 'Internal Mobility', 'skills', '/api/internal-mobility', '/admin/mobility', true, 75,
 'Job matching and lateral moves'),
('mentorship', 'Mentorship', 'skills', '/api/mentorship', '/admin/mentorship', true, 76,
 'Mentor-mentee matching and tracking'),

-- ============================================================================
-- CATEGORY: RECRUITING (5 modules) - Talent Acquisition
-- ============================================================================
('requisitions', 'Requisitions', 'recruiting', '/api/requisitions', '/admin/recruiting/requisitions', true, 80,
 'Job opening requests and approvals'),
('job_postings', 'Job Postings', 'recruiting', '/api/job-postings', '/admin/recruiting/postings', true, 81,
 'Career listings, internal/external postings'),
('candidates', 'Candidates', 'recruiting', '/api/candidates', '/admin/recruiting/candidates', true, 82,
 'Applicant tracking and resume management'),
('interviews', 'Interviews', 'recruiting', '/api/interviews', '/admin/recruiting/interviews', true, 83,
 'Interview scheduling, feedback, scoring'),
('offers', 'Offers', 'recruiting', '/api/offers', '/admin/recruiting/offers', true, 84,
 'Offer creation and acceptance'),

-- ============================================================================
-- CATEGORY: COMPENSATION (8 modules) - Compensation & Payroll
-- ============================================================================
('salary_bands', 'Salary Bands', 'compensation', '/api/salary-bands', '/admin/compensation/bands', true, 90,
 'Salary ranges, leveling, benchmarking'),
('individual_salaries', 'Individual Salaries', 'compensation', '/api/employees/salary', '/admin/compensation/salaries', true, 91,
 'Individual salary management'),
('bonus_plans', 'Bonus Plans', 'compensation', '/api/bonus-plans', '/admin/compensation/bonus', true, 92,
 'Bonus structure and calculation rules'),
('merit_cycles', 'Merit Cycles', 'compensation', '/api/merit-cycles', '/admin/compensation/merit', true, 93,
 'Annual merit increase management'),
('payroll', 'Payroll Processing', 'compensation', '/api/payroll', '/admin/payroll', true, 94,
 'Payroll processing and calculations'),
('pay_stubs', 'Pay Stubs', 'compensation', '/api/pay-stubs', '/portal/payslips', true, 95,
 'Paycheck history and take-home view'),
('benefits', 'Benefits', 'compensation', '/api/benefits', '/admin/benefits', true, 96,
 'Benefit plans and enrollment'),
('compensation_analytics', 'Compensation Analytics', 'compensation', '/api/compensation-analytics', '/admin/analytics/compensation', true, 97,
 'Pay equity, benchmarking, trends'),

-- ============================================================================
-- CATEGORY: TIME (6 modules) - Time & Attendance
-- ============================================================================
('leave_balances', 'Leave Balances', 'time', '/api/leave/balances', '/admin/leave/balances', true, 100,
 'Leave balance tracking by type'),
('leave_requests', 'Leave Requests', 'time', '/api/leave', '/portal/leave', true, 101,
 'Time off request submission'),
('leave_approval', 'Leave Approval', 'time', '/api/leave/approve', '/admin/leave/approve', true, 102,
 'Leave request approval workflow'),
('attendance', 'Attendance Records', 'time', '/api/attendance', '/admin/attendance', true, 103,
 'Attendance tracking and punctuality'),
('overtime', 'Overtime', 'time', '/api/overtime', '/admin/overtime', true, 104,
 'Overtime tracking and compensation'),
('time_analytics', 'Time Analytics', 'time', '/api/time-analytics', '/admin/analytics/time', true, 105,
 'Attendance dashboards and patterns'),

-- ============================================================================
-- CATEGORY: COMPLIANCE (4 modules) - Compliance & Governance
-- ============================================================================
('compliance_audits', 'Compliance Audits', 'compliance', '/api/compliance', '/admin/compliance', true, 110,
 'Compliance audit tracking'),
('policy_violations', 'Policy Violations', 'compliance', '/api/policy-violations', '/admin/compliance/violations', true, 111,
 'Policy breach tracking and resolution'),
('whistleblowing', 'Whistleblowing', 'compliance', '/api/whistleblowing', '/admin/whistleblowing', true, 112,
 'Anonymous reporting channel'),
('gdpr', 'GDPR Management', 'compliance', '/api/gdpr', '/admin/compliance/gdpr', true, 113,
 'Data privacy and GDPR compliance'),

-- ============================================================================
-- CATEGORY: ANALYTICS (7 modules) - Analytics & Reporting
-- ============================================================================
('analytics_platform', 'Platform Analytics', 'analytics', '/api/analytics', '/platform/analytics', false, 120,
 'Cross-tenant platform analytics'),
('analytics_tenant', 'Tenant Analytics', 'analytics', '/api/analytics', '/admin/analytics', true, 121,
 'Tenant-level HR analytics'),
('analytics_team', 'Team Analytics', 'analytics', '/api/analytics/team', '/admin/analytics/team', true, 122,
 'Team-level metrics and dashboards'),
('hr_intelligence', 'HR Intelligence', 'analytics', '/api/hr-intelligence', '/admin/hr-intelligence', true, 123,
 'AI-powered HR insights'),
('workforce_planning', 'Workforce Planning', 'analytics', '/api/workforce-planning', '/admin/workforce', true, 124,
 'Headcount planning and scenarios'),
('reports', 'Reports', 'analytics', '/api/reports', '/admin/reports', true, 125,
 'Custom reporting and data export'),
('dashboards', 'Dashboards', 'analytics', '/api/dashboards', '/admin/dashboard', true, 126,
 'Personal and team dashboards'),

-- ============================================================================
-- CATEGORY: AI (4 modules) - AI & Knowledge Management
-- ============================================================================
('ai_chat', 'AI Chat', 'ai', '/api/ai-chat', '/admin/ai-chat', true, 130,
 'RAG-enabled HR assistant chatbot'),
('knowledge_base', 'Knowledge Base', 'ai', '/api/knowledge-base', '/admin/knowledge', true, 131,
 'Document indexing and semantic search'),
('semantic_search', 'Semantic Search', 'ai', '/api/semantic-intelligence', '/admin/search', false, 132,
 'Semantic embeddings and vector search'),
('predictions', 'AI Predictions', 'ai', '/api/predictions', '/admin/predictions', true, 133,
 'Predictive analytics (attrition, performance)'),

-- ============================================================================
-- CATEGORY: ONTOLOGY (6 modules) - Reference Data & Taxonomies
-- ============================================================================
('esco', 'ESCO Taxonomy', 'ontology', '/api/esco', '/admin/ontology/esco', false, 140,
 'European Skills/Competencies/Occupations'),
('nace', 'NACE Classification', 'ontology', '/api/nace', '/admin/ontology/nace', false, 141,
 'Economic activities classification'),
('onet', 'O*NET', 'ontology', '/api/onet', '/admin/ontology/onet', false, 142,
 'Occupational Information Network (US)'),
('ontology_core', 'Ontology Management', 'ontology', '/api/ontology', '/admin/ontology', false, 143,
 'Skill ontology and semantic relationships'),
('skill_extraction', 'Skill Extraction', 'ontology', '/api/skill-extraction', '/admin/skills/extraction', false, 144,
 'AI extraction of skills from text/CVs'),
('skill_migration', 'Skill Migration', 'ontology', '/api/skill-migration', '/admin/skills/migration', false, 145,
 'Legacy skill data migration'),

-- ============================================================================
-- CATEGORY: SETTINGS (5 modules) - Configuration
-- ============================================================================
('tenant_config', 'Tenant Configuration', 'settings', '/api/tenant-setup', '/admin/settings', true, 150,
 'Tenant-specific configuration'),
('sso_config', 'SSO Configuration', 'settings', '/api/auth/sso', '/admin/settings/sso', true, 151,
 'Single sign-on setup and management'),
('ai_providers', 'AI Provider Configuration', 'settings', '/api/ai-providers', '/admin/settings/ai', true, 152,
 'Configure AI providers (Gemini, OpenAI, Anthropic)'),
('integrations', 'Integrations', 'settings', '/api/integrations', '/admin/settings/integrations', true, 153,
 'Third-party integrations'),
('exports', 'Data Exports', 'settings', '/api/exports', '/admin/exports', true, 154,
 'Data export functionality'),

-- ============================================================================
-- CATEGORY: ENGAGEMENT (4 modules) - Employee Engagement
-- ============================================================================
('surveys', 'Surveys', 'engagement', '/api/surveys', '/admin/surveys', true, 160,
 'Employee surveys and pulse checks'),
('engagement_hub', 'Engagement Hub', 'engagement', '/api/engagement', '/admin/engagement', true, 161,
 'Engagement tracking and programs'),
('wellbeing', 'Wellbeing', 'engagement', '/api/wellbeing', '/admin/wellbeing', true, 162,
 'Wellness tracking and programs'),
('social', 'Social Features', 'engagement', '/api/social', '/admin/social', true, 163,
 'Social collaboration features'),

-- ============================================================================
-- CATEGORY: NEWS (2 modules) - Communications
-- ============================================================================
('news_view', 'View News', 'news', '/api/news', '/admin/news', true, 170,
 'View company news and announcements'),
('news_manage', 'Manage News', 'news', '/api/news', '/admin/news/manage', true, 171,
 'Create and manage news articles'),

-- ============================================================================
-- CATEGORY: NOTIFICATIONS (2 modules)
-- ============================================================================
('notifications', 'Notifications', 'notifications', '/api/notifications', '/admin/notifications', true, 180,
 'System notifications and alerts'),
('notification_settings', 'Notification Settings', 'notifications', '/api/notifications/settings', '/admin/settings/notifications', true, 181,
 'Notification preferences and channels')

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    api_prefix = EXCLUDED.api_prefix,
    frontend_path = EXCLUDED.frontend_path,
    requires_tenant = EXCLUDED.requires_tenant,
    sort_order = EXCLUDED.sort_order,
    description = EXCLUDED.description,
    updated_at = now();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_total INTEGER;
    v_by_category RECORD;
BEGIN
    SELECT COUNT(*) INTO v_total FROM feature_modules;

    RAISE NOTICE '=== Migration 057 Verification ===';
    RAISE NOTICE 'Total feature modules: %', v_total;
    RAISE NOTICE '';
    RAISE NOTICE 'Modules by category:';

    FOR v_by_category IN
        SELECT category, COUNT(*) as count
        FROM feature_modules
        GROUP BY category
        ORDER BY MIN(sort_order)
    LOOP
        RAISE NOTICE '  - %: %', v_by_category.category, v_by_category.count;
    END LOOP;

    IF v_total >= 85 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Migration 057 completed successfully!';
    ELSE
        RAISE WARNING 'Expected at least 85 modules, got %', v_total;
    END IF;
END $$;
