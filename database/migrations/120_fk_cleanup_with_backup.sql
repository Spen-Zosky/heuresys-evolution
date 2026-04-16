-- Migration 120: FK Cleanup with Safety Net (Fase 1a)
-- Gate 0 PASSED: dati sono seed/test (298 employee_id orfani da ridistribuzione multi-tenant)
-- Backup orfani prima di DELETE, poi pulizia per preparare ADD FK in migration 121

BEGIN;

-- ============================================
-- STEP 1: Creare tabella log di migration
-- ============================================

CREATE TABLE IF NOT EXISTS _migration_cleanup_log (
  id BIGSERIAL PRIMARY KEY,
  phase VARCHAR(30) NOT NULL,
  operation VARCHAR(50) NOT NULL,
  target_table VARCHAR(128),
  target_column VARCHAR(128),
  rows_affected INT DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 2: Backup orfani (safety net)
-- ============================================

CREATE TABLE _cleanup_orphans_backup AS

-- employee_id dangling (11 tabelle, 3637 righe)
-- Note: internal_job_views and employee_benefit_enrollments lack created_at, use NOW() as fallback

-- employee_id dangling (11 tabelle, 3637 righe)
SELECT 'employee_pay_stubs'::text AS source_table, id::text, employee_id::text AS orphan_fk_value, 'employee_id'::text AS fk_column, COALESCE(created_at, NOW()) AS created_at
FROM employee_pay_stubs WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'internal_applications', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM internal_applications WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'internal_job_views', id::text, employee_id::text, 'employee_id', NOW()
FROM internal_job_views WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'skill_development_paths', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM skill_development_paths WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'employee_occupations', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM employee_occupations WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'internal_job_alerts', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM internal_job_alerts WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'employee_skill_assessments', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM employee_skill_assessments WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'employee_benefit_enrollments', id::text, employee_id::text, 'employee_id', NOW()
FROM employee_benefit_enrollments WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'learning_bookmarks', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM learning_bookmarks WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'learning_recommendations', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM learning_recommendations WHERE employee_id NOT IN (SELECT id FROM employees)
UNION ALL
SELECT 'learning_ratings', id::text, employee_id::text, 'employee_id', COALESCE(created_at, NOW())
FROM learning_ratings WHERE employee_id NOT IN (SELECT id FROM employees)

-- course_id dangling (6 tabelle, 2450 righe)
UNION ALL
SELECT 'course_modules', id::text, course_id::text, 'course_id', COALESCE(created_at, NOW())
FROM course_modules WHERE course_id NOT IN (SELECT id FROM courses)
UNION ALL
SELECT 'course_esco_skills', id::text, course_id::text, 'course_id', COALESCE(created_at, NOW())
FROM course_esco_skills WHERE course_id NOT IN (SELECT id FROM courses)
UNION ALL
SELECT 'learning_path_courses', id::text, course_id::text, 'course_id', COALESCE(created_at, NOW())
FROM learning_path_courses WHERE course_id NOT IN (SELECT id FROM courses)
UNION ALL
SELECT 'learning_ratings', id::text, course_id::text, 'course_id', COALESCE(created_at, NOW())
FROM learning_ratings WHERE course_id NOT IN (SELECT id FROM courses)
UNION ALL
SELECT 'learning_bookmarks', id::text, course_id::text, 'course_id', COALESCE(created_at, NOW())
FROM learning_bookmarks WHERE course_id IS NOT NULL AND course_id NOT IN (SELECT id FROM courses)
UNION ALL
SELECT 'learning_recommendations', id::text, course_id::text, 'course_id', COALESCE(created_at, NOW())
FROM learning_recommendations WHERE course_id IS NOT NULL AND course_id NOT IN (SELECT id FROM courses)

-- job_posting_id dangling (2 tabelle, 354 righe)
UNION ALL
SELECT 'internal_applications', id::text, job_posting_id::text, 'job_posting_id', COALESCE(created_at, NOW())
FROM internal_applications WHERE job_posting_id IS NOT NULL AND job_posting_id NOT IN (SELECT id FROM internal_job_postings)
UNION ALL
SELECT 'internal_job_views', id::text, job_posting_id::text, 'job_posting_id', NOW()
FROM internal_job_views WHERE job_posting_id IS NOT NULL AND job_posting_id NOT IN (SELECT id FROM internal_job_postings)

-- position_id dangling (1 tabella, 100 righe)
UNION ALL
SELECT 'position_skill_requirements', id::text, position_id::text, 'position_id', COALESCE(created_at, NOW())
FROM position_skill_requirements WHERE position_id IS NOT NULL AND position_id NOT IN (SELECT id FROM job_templates)
;

-- ============================================
-- STEP 3: DELETE orfani
-- ============================================

-- employee_id cleanup
DELETE FROM employee_pay_stubs WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM internal_applications WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM internal_job_views WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM skill_development_paths WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM employee_occupations WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM internal_job_alerts WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM employee_skill_assessments WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM employee_benefit_enrollments WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM learning_bookmarks WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM learning_recommendations WHERE employee_id NOT IN (SELECT id FROM employees);
DELETE FROM learning_ratings WHERE employee_id NOT IN (SELECT id FROM employees);

-- course_id cleanup
DELETE FROM course_modules WHERE course_id NOT IN (SELECT id FROM courses);
DELETE FROM course_esco_skills WHERE course_id NOT IN (SELECT id FROM courses);
DELETE FROM learning_path_courses WHERE course_id NOT IN (SELECT id FROM courses);
-- learning_ratings and learning_bookmarks: employee_id orphans already deleted above,
-- now clean course_id orphans on remaining rows
DELETE FROM learning_ratings WHERE course_id NOT IN (SELECT id FROM courses);
DELETE FROM learning_bookmarks WHERE course_id IS NOT NULL AND course_id NOT IN (SELECT id FROM courses);
DELETE FROM learning_recommendations WHERE course_id IS NOT NULL AND course_id NOT IN (SELECT id FROM courses);

-- job_posting_id cleanup (rows with employee_id orphans already deleted)
DELETE FROM internal_applications WHERE job_posting_id IS NOT NULL AND job_posting_id NOT IN (SELECT id FROM internal_job_postings);
DELETE FROM internal_job_views WHERE job_posting_id IS NOT NULL AND job_posting_id NOT IN (SELECT id FROM internal_job_postings);

-- position_id cleanup
DELETE FROM position_skill_requirements WHERE position_id IS NOT NULL AND position_id NOT IN (SELECT id FROM job_templates);

-- ============================================
-- STEP 4: Log risultati
-- ============================================

INSERT INTO _migration_cleanup_log (phase, operation, target_table, target_column, rows_affected, details)
SELECT '1a', 'backup_created', source_table, fk_column, COUNT(*), jsonb_build_object('action', 'backed_up_before_delete')
FROM _cleanup_orphans_backup
GROUP BY source_table, fk_column;

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('120_fk_cleanup_with_backup');

COMMIT;
