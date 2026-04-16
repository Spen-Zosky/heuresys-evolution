-- Migration: 058_permissions_seed.sql
-- Description: Seed CRUD permissions for all feature modules (150+ permissions)
-- Date: 2025-12-30
-- Epic: RBAC Feature Access Matrix Implementation

-- ============================================================================
-- PERMISSIONS SEEDING
-- Format: {module_code}:{operation}
-- Operations: create, read, update, delete, configure, approve, export
-- ============================================================================

-- Clear existing permissions (safe re-run)
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE permissions CASCADE;

-- ============================================================================
-- PLATFORM PERMISSIONS (8 modules)
-- ============================================================================

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'configure' THEN 'platform'::permission_scope
        WHEN op.operation = 'export' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    CASE WHEN op.operation IN ('delete', 'configure') THEN true ELSE false END
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'configure']) as operation
) op
WHERE fm.code = 'platform_settings';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'platform'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'tenant_management';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'platform'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code = 'system_health';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE WHEN fm.code = 'audit_logs' THEN 'platform'::permission_scope ELSE 'tenant'::permission_scope END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code IN ('audit_logs', 'activity_logs');

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'integrations';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'platform'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'configure']) as operation
) op
WHERE fm.code = 'api_keys';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'configure']) as operation
) op
WHERE fm.code = 'sso_config';

-- ============================================================================
-- USER MANAGEMENT PERMISSIONS (4 modules)
-- ============================================================================

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    CASE WHEN op.operation IN ('delete', 'update') THEN true ELSE false END
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'users_tenant';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update']) as operation
) op
WHERE fm.code = 'role_assignment';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['update']) as operation
) op
WHERE fm.code = 'password_reset';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'session_management';

-- ============================================================================
-- EMPLOYEES PERMISSIONS (6 modules)
-- ============================================================================

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        WHEN op.operation = 'export' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    CASE WHEN op.operation IN ('delete', 'export') THEN true ELSE false END
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'export']) as operation
) op
WHERE fm.code = 'employees_directory';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update']) as operation
) op
WHERE fm.code = 'employee_profile';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read']) as operation
) op
WHERE fm.code = 'org_chart';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update']) as operation
) op
WHERE fm.code = 'skill_profile';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    CASE WHEN op.operation IN ('update', 'delete') THEN true ELSE false END
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'employee_documents';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'employee_contracts';

-- ============================================================================
-- ORGANIZATION PERMISSIONS (4 modules)
-- ============================================================================

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    CASE WHEN op.operation = 'delete' THEN true ELSE false END
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code IN ('departments', 'org_units', 'locations', 'cost_centers');

-- ============================================================================
-- PERFORMANCE PERMISSIONS (11 modules)
-- ============================================================================

-- Goals
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read', 'update') THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'goals';

-- OKRs
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read', 'update') THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'okrs';

-- Performance Reviews
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        WHEN op.operation IN ('create', 'update') THEN 'team'::permission_scope
        WHEN op.operation = 'approve' THEN 'department'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve', 'export']) as operation
) op
WHERE fm.code = 'performance_reviews';

-- Check-ins
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read', 'update') THEN 'own'::permission_scope
        ELSE 'team'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'check_ins';

-- Self Assessments
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update']) as operation
) op
WHERE fm.code = 'self_assessments';

-- Manager Reviews
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'team'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update']) as operation
) op
WHERE fm.code = 'manager_reviews';

-- 360 Feedback
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        WHEN op.operation = 'configure' THEN 'tenant'::permission_scope
        ELSE 'team'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'feedback_360';

-- Calibration
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'calibration';

-- Performance Cycles
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'configure']) as operation
) op
WHERE fm.code = 'performance_cycles';

-- Competency Framework
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'competency_framework';

-- PIPs (Performance Improvement Plans)
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'team'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'pips';

-- ============================================================================
-- LEARNING PERMISSIONS (6 modules)
-- ============================================================================

-- Courses
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'courses';

-- Learning Paths
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'learning_paths';

-- Certifications
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'certifications';

-- Training Sessions
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'training_sessions';

-- Course Enrollments
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'course_enrollments';

-- Learning Analytics
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code = 'learning_analytics';

-- ============================================================================
-- SKILLS PERMISSIONS (7 modules)
-- ============================================================================

-- Skill Taxonomy
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'skill_taxonomy';

-- Skill Assessments
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'approve']) as operation
) op
WHERE fm.code = 'skill_assessments';

-- Gap Analysis
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code = 'gap_analysis';

-- Succession Planning
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'succession_planning';

-- Talent Pools
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'talent_pools';

-- Career Paths
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'career_paths';

-- Skill Matrix
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code = 'skill_matrix';

-- ============================================================================
-- RECRUITING PERMISSIONS (5 modules)
-- ============================================================================

-- Job Requisitions
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'approve' THEN 'department'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'requisitions';

-- Candidates
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'candidates';

-- Interviews
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'interviews';

-- Job Offers
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'approve' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'offers';

-- Onboarding
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'configure']) as operation
) op
WHERE fm.code = 'onboarding';

-- ============================================================================
-- COMPENSATION PERMISSIONS (8 modules)
-- ============================================================================

-- Salary Bands
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'salary_bands';

-- Compensation Plans
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'compensation_plans';

-- Bonuses
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'tenant'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'bonuses';

-- Benefits
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'benefits';

-- Payroll
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'approve', 'export']) as operation
) op
WHERE fm.code = 'payroll';

-- Pay Stubs
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code = 'pay_stubs';

-- Compensation Analytics
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code = 'comp_analytics';

-- Salary Reviews
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'department'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'approve']) as operation
) op
WHERE fm.code = 'salary_reviews';

-- ============================================================================
-- TIME & ATTENDANCE PERMISSIONS (6 modules)
-- ============================================================================

-- Leave Requests
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read', 'update', 'delete') THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'leave_requests';

-- Attendance
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'team'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'export']) as operation
) op
WHERE fm.code = 'attendance';

-- Time Tracking
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read', 'update') THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'approve']) as operation
) op
WHERE fm.code = 'time_tracking';

-- Overtime
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        WHEN op.operation = 'approve' THEN 'team'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'approve']) as operation
) op
WHERE fm.code = 'overtime';

-- Shifts
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'team'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'shifts';

-- Leave Balances
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update']) as operation
) op
WHERE fm.code = 'leave_balances';

-- ============================================================================
-- COMPLIANCE PERMISSIONS (4 modules)
-- ============================================================================

-- Compliance Audits
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'export']) as operation
) op
WHERE fm.code = 'compliance_audits';

-- Policy Management
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'approve']) as operation
) op
WHERE fm.code = 'policies';

-- Whistleblowing
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'create' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update']) as operation
) op
WHERE fm.code = 'whistleblowing';

-- GDPR
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'delete', 'export']) as operation
) op
WHERE fm.code = 'gdpr';

-- ============================================================================
-- ANALYTICS PERMISSIONS (7 modules)
-- ============================================================================

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN fm.code IN ('hr_intelligence', 'workforce_planning', 'headcount_analytics', 'turnover_analytics') THEN 'tenant'::permission_scope
        WHEN fm.code = 'custom_reports' AND op.operation = 'create' THEN 'tenant'::permission_scope
        WHEN fm.code = 'dashboards' AND op.operation IN ('create', 'update') THEN 'tenant'::permission_scope
        ELSE 'own'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    CASE WHEN fm.code IN ('hr_intelligence', 'turnover_analytics') THEN true ELSE false END
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'export']) as operation
) op
WHERE fm.code IN ('hr_intelligence', 'workforce_planning', 'headcount_analytics', 'turnover_analytics', 'diversity_analytics');

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'dashboards';

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'export']) as operation
) op
WHERE fm.code = 'custom_reports';

-- ============================================================================
-- AI PERMISSIONS (4 modules)
-- ============================================================================

-- AI Chat
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read']) as operation
) op
WHERE fm.code = 'ai_chat';

-- Knowledge Base
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'knowledge_base';

-- Semantic Search
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read']) as operation
) op
WHERE fm.code = 'semantic_search';

-- AI Insights
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'configure']) as operation
) op
WHERE fm.code = 'ai_insights';

-- ============================================================================
-- ONTOLOGY PERMISSIONS (3 modules)
-- ============================================================================

INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read']) as operation
) op
WHERE fm.code IN ('esco_skills', 'nace_activities', 'job_families');

-- ============================================================================
-- SETTINGS PERMISSIONS (5 modules)
-- ============================================================================

-- Tenant Config
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'tenant_config';

-- Workflows
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'configure']) as operation
) op
WHERE fm.code = 'workflows';

-- Templates
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'templates';

-- Notifications Config
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'notifications_config';

-- Localization
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update']) as operation
) op
WHERE fm.code = 'localization';

-- ============================================================================
-- ENGAGEMENT PERMISSIONS (4 modules)
-- ============================================================================

-- Surveys
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete', 'export']) as operation
) op
WHERE fm.code = 'surveys';

-- Pulse Checks
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'pulse_checks';

-- Recognition
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation IN ('create', 'read') THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'recognition';

-- Wellbeing
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'configure']) as operation
) op
WHERE fm.code = 'wellbeing';

-- ============================================================================
-- NEWS & NOTIFICATIONS PERMISSIONS (4 modules)
-- ============================================================================

-- Company News
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'company_news';

-- Announcements
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    CASE
        WHEN op.operation = 'read' THEN 'own'::permission_scope
        ELSE 'tenant'::permission_scope
    END,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'announcements';

-- User Notifications
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'own'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    false
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['read', 'update', 'delete']) as operation
) op
WHERE fm.code = 'user_notifications';

-- System Alerts
INSERT INTO permissions (code, module_id, operation, default_scope, name, description, is_sensitive)
SELECT
    fm.code || ':' || op.operation,
    fm.id,
    op.operation::crud_operation,
    'tenant'::permission_scope,
    fm.name || ' - ' || initcap(op.operation::text),
    'Permission to ' || op.operation || ' ' || fm.name,
    true
FROM feature_modules fm
CROSS JOIN (
    SELECT unnest(ARRAY['create', 'read', 'update', 'configure']) as operation
) op
WHERE fm.code = 'system_alerts';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_permission_count INTEGER;
    v_sensitive_count INTEGER;
    v_module_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_permission_count FROM permissions;
    SELECT COUNT(*) INTO v_sensitive_count FROM permissions WHERE is_sensitive = true;
    SELECT COUNT(DISTINCT module_id) INTO v_module_count FROM permissions;

    RAISE NOTICE '=== Migration 058 Verification ===';
    RAISE NOTICE 'Total permissions created: % (expected: 150+)', v_permission_count;
    RAISE NOTICE 'Sensitive permissions: %', v_sensitive_count;
    RAISE NOTICE 'Modules with permissions: % (expected: 85)', v_module_count;

    IF v_permission_count >= 150 THEN
        RAISE NOTICE 'Migration 058 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 058 may have issues - expected 150+ permissions';
    END IF;
END $$;
