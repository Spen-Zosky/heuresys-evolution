-- Migration 111: Document learning schema duplication
-- Date: 2026-03-18
-- Sprint: R2 (Data Integrity)
--
-- FINDING: The 'learning' schema contains 6 tables that partially duplicate
-- tables in the 'public' schema:
--
--   learning.courses           (32 rows)  ↔  public.courses           (127 rows)
--   learning.learning_paths    (8 rows)   ↔  public.learning_paths    (20 rows)
--   learning.learning_path_courses        ↔  public.learning_path_courses
--   learning.enrollments       (34 rows)  — no direct public equivalent (public has course_enrollments)
--   learning.certificates      (16 rows)  — no direct public equivalent (public has certifications)
--   learning.skill_gaps        (32 rows)  — no direct public equivalent
--
-- ACTION REQUIRED (manual review):
--   1. Verify whether learning.* data is referenced by any application code
--   2. If not referenced, migrate any unique records to public.* equivalents
--   3. Then DROP SCHEMA learning CASCADE
--
-- This migration only adds a comment for tracking. No destructive changes.

COMMENT ON SCHEMA learning IS
  'DEPRECATED: Duplicate of public schema tables. '
  'See migration 111 for details. Pending manual consolidation review.';

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('111_document_learning_schema_duplication', NOW())
ON CONFLICT DO NOTHING;
