-- Migration 094: Index Cleanup + Missing FK Indexes
-- Part of Sprint 1 (Audit Remediation)
-- H7: Remove redundant indexes covered by unique/composite indexes
-- H8: Add missing FK indexes on high-traffic tables
-- All operations are idempotent (DROP IF EXISTS, CREATE IF NOT EXISTS)

BEGIN;

-- =============================================================================
-- PART 1: DROP REDUNDANT INDEXES (H7)
-- Each dropped index is fully covered by a unique or composite index
-- =============================================================================

-- employee_attendance: 6 redundant indexes covered by unique constraint
DROP INDEX IF EXISTS idx_employee_attendance_date;
DROP INDEX IF EXISTS idx_employee_attendance_employee;
DROP INDEX IF EXISTS idx_employee_attendance_tenant;
-- Keep idx_employee_attendance_emp_date (covers employee_id + attendance_date lookups)

-- career_path_level_skills: 2 single-col indexes covered by unique constraint
DROP INDEX IF EXISTS idx_career_level_skills_level;
DROP INDEX IF EXISTS idx_career_level_skills_skill;

-- career_profiles: employee index covered by unique constraint
DROP INDEX IF EXISTS idx_career_profiles_employee;

-- career_path_recommendations: employee index covered by unique constraint
DROP INDEX IF EXISTS idx_career_recommendations_employee;

-- club_memberships: 2 single-col indexes covered by unique constraint
DROP INDEX IF EXISTS idx_club_memberships_club;
DROP INDEX IF EXISTS idx_club_memberships_emp;

-- competency_review_ratings: single-col index covered by unique constraint
DROP INDEX IF EXISTS idx_competency_review_ratings_review;

-- document_acknowledgments: 2 single-col indexes covered by unique constraint
DROP INDEX IF EXISTS idx_document_acknowledgments_document;
DROP INDEX IF EXISTS idx_document_acknowledgments_employee;

-- document_versions: single-col covered by composite
DROP INDEX IF EXISTS idx_document_versions_doc;

-- employee_career_progress: single-col covered by unique constraint
DROP INDEX IF EXISTS idx_career_progress_employee;

-- employee_permission_overrides: 2 single-col covered by unique constraint
DROP INDEX IF EXISTS idx_employee_permission_overrides_employee;
DROP INDEX IF EXISTS idx_employee_permission_overrides_permission;

-- employee_skill_mappings: single-col covered by unique constraint
DROP INDEX IF EXISTS idx_employee_skill_mappings_employee;

-- career_goals: single-col covered by composite
DROP INDEX IF EXISTS idx_career_goals_profile;

-- career_recommendations: single-col covered by composite
DROP INDEX IF EXISTS idx_career_recommendations_profile;

-- check_ins: duplicate indexes on same column
DROP INDEX IF EXISTS idx_check_ins_date;
-- Keep idx_check_ins_scheduled

-- analytics_aggregations: 2 indexes covered by unique constraint
DROP INDEX IF EXISTS idx_aggregations_period;
DROP INDEX IF EXISTS idx_aggregations_tenant_metric;

-- ai_analytics_daily: single-col covered by unique constraint
DROP INDEX IF EXISTS idx_ai_analytics_tenant;

-- ai_provider_metrics: 2 single-col covered by composite
DROP INDEX IF EXISTS idx_ai_metrics_provider;
DROP INDEX IF EXISTS idx_ai_metrics_recorded_at;

-- business_processes: single-col covered by unique constraint
DROP INDEX IF EXISTS idx_business_processes_prototype;

-- =============================================================================
-- PART 2: ADD MISSING FK INDEXES (H8)
-- Focus on high-traffic tables and critical join paths
-- =============================================================================

-- audit_logs: high-traffic table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_employee ON audit_logs (user_id_employee_id);

-- ai_escalation_queue: AI pipeline joins
CREATE INDEX IF NOT EXISTS idx_ai_escalation_employee ON ai_escalation_queue (employee_id);
CREATE INDEX IF NOT EXISTS idx_ai_escalation_session ON ai_escalation_queue (session_id);
CREATE INDEX IF NOT EXISTS idx_ai_escalation_message ON ai_escalation_queue (message_id);

-- calibration tables: performance review workflow
CREATE INDEX IF NOT EXISTS idx_calibration_adj_applied ON calibration_adjustments (applied_by);
CREATE INDEX IF NOT EXISTS idx_calibration_adj_approved ON calibration_adjustments (approved_by);
CREATE INDEX IF NOT EXISTS idx_calibration_adj_proposed ON calibration_adjustments (proposed_by);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_dept ON calibration_sessions (department_id);

-- career management: frequently joined
CREATE INDEX IF NOT EXISTS idx_career_path_rec_current ON career_path_recommendations (current_level_id);
CREATE INDEX IF NOT EXISTS idx_career_path_rec_target ON career_path_recommendations (target_level_id);
CREATE INDEX IF NOT EXISTS idx_career_simulations_target_job ON career_simulations (target_job_id);

-- employee core: most frequent joins
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees (location_id);

-- contracts: HR core joins
CREATE INDEX IF NOT EXISTS idx_contracts_cost_center ON contracts (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_contracts_department ON contracts (department_id);
CREATE INDEX IF NOT EXISTS idx_contracts_location ON contracts (location_id);

-- courses and enrollments: learning module
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON course_enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses (created_by_employee_id);

-- feedback system: performance reviews
CREATE INDEX IF NOT EXISTS idx_feedback_360_review ON feedback_360 (performance_review_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_target ON feedback_360 (target_employee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_reviewer ON feedback_360 (reviewer_employee_id);
CREATE INDEX IF NOT EXISTS idx_continuous_feedback_review ON continuous_feedback (performance_review_id);

-- goals: OKR system
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals (owner_id);
CREATE INDEX IF NOT EXISTS idx_goals_template ON goals (template_id);
CREATE INDEX IF NOT EXISTS idx_goal_comments_author ON goal_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_author ON goal_updates (author_id);

-- employee documents: document management
CREATE INDEX IF NOT EXISTS idx_employee_docs_uploaded ON employee_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_employee_docs_signed ON employee_documents (signed_by);

-- employee skills: skill management
CREATE INDEX IF NOT EXISTS idx_employee_skills_verified ON employee_skills (verified_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skill_profiles_verified ON employee_skill_profiles (verified_by);

-- engagement: survey system
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_template ON engagement_surveys (template_id);

-- export system
CREATE INDEX IF NOT EXISTS idx_export_jobs_config ON export_jobs (config_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_triggered ON export_jobs (triggered_by);

-- learning paths
CREATE INDEX IF NOT EXISTS idx_learning_path_enroll_path ON learning_path_enrollments (learning_path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_enroll_emp ON learning_path_enrollments (employee_id);

COMMIT;
