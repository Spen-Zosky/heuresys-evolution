-- Migration: 083_standardize_timestamptz.sql
-- Purpose: Convert all 'timestamp without time zone' columns to 'timestamp with time zone' (TIMESTAMPTZ)
-- in non-SAP public schema tables, preserving existing values as UTC.
--
-- This migration standardizes timestamp types across the database to ensure consistent
-- timezone-aware datetime handling. The AT TIME ZONE 'UTC' clause preserves existing
-- values correctly by interpreting them as UTC timestamps.
--
-- Scope: 146 non-SAP tables, 323 columns, 128 views dropped and recreated
-- Excluded: SAP infotype tables (pa*, pb*, hrp*, pcl*, t5*, ext_*)
--
-- IMPORTANT: This migration drops ALL views before altering column types,
-- then recreates them afterward, because PostgreSQL does not allow altering
-- a column type when views depend on it.
--
-- Views are recreated in topological (dependency) order to ensure views
-- that depend on other views are created after their dependencies.
--
-- Generated from schema analysis on 2026-02-03.

BEGIN;

-- Increase maintenance_work_mem for pgvector IVFFlat index operations
SET LOCAL maintenance_work_mem = '256MB';

-- ============================================================================
-- PHASE 1: DROP ALL VIEWS (to remove dependencies before ALTER TABLE)
-- ============================================================================

-- DROP ALL VIEWS
DROP VIEW IF EXISTS analytics.v_candidate_detail CASCADE;
DROP VIEW IF EXISTS analytics.v_candidate_summary CASCADE;
DROP VIEW IF EXISTS analytics.v_compliance_dashboard CASCADE;
DROP VIEW IF EXISTS analytics.v_employee_experience_score CASCADE;
DROP VIEW IF EXISTS analytics.v_employee_lifecycle CASCADE;
DROP VIEW IF EXISTS analytics.v_executive_dashboard CASCADE;
DROP VIEW IF EXISTS analytics.v_performance_snapshot CASCADE;
DROP VIEW IF EXISTS analytics.v_recruiting_pipeline CASCADE;
DROP VIEW IF EXISTS analytics.v_total_rewards_statement CASCADE;
DROP VIEW IF EXISTS analytics.v_workforce_planning_dashboard CASCADE;
DROP VIEW IF EXISTS learning.v_course_popularity CASCADE;
DROP VIEW IF EXISTS learning.v_employee_learning_summary CASCADE;
DROP VIEW IF EXISTS learning.v_skill_gap_analysis CASCADE;
DROP VIEW IF EXISTS public.branches CASCADE;
DROP VIEW IF EXISTS public.error_stats CASCADE;
DROP VIEW IF EXISTS public.recent_errors CASCADE;
DROP VIEW IF EXISTS public.v_360_feedback_summary CASCADE;
DROP VIEW IF EXISTS public.v_360_response_rates CASCADE;
DROP VIEW IF EXISTS public.v_active_job_postings CASCADE;
DROP VIEW IF EXISTS public.v_ai_daily_costs CASCADE;
DROP VIEW IF EXISTS public.v_ai_monthly_costs CASCADE;
DROP VIEW IF EXISTS public.v_ai_tenant_costs CASCADE;
DROP VIEW IF EXISTS public.v_applicant_pipeline CASCADE;
DROP VIEW IF EXISTS public.v_appraisal_status CASCADE;
DROP VIEW IF EXISTS public.v_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.v_benefits_enrollment CASCADE;
DROP VIEW IF EXISTS public.v_calibration_9box CASCADE;
DROP VIEW IF EXISTS public.v_calibration_bell_curve CASCADE;
DROP VIEW IF EXISTS public.v_candidate_detail_cluster CASCADE;
DROP VIEW IF EXISTS public.v_candidate_summary CASCADE;
DROP VIEW IF EXISTS public.v_career_level_requirements CASCADE;
DROP VIEW IF EXISTS public.v_certification_compliance CASCADE;
DROP VIEW IF EXISTS public.v_comp_analysis CASCADE;
DROP VIEW IF EXISTS public.v_compensation_bands CASCADE;
DROP VIEW IF EXISTS public.v_compensation_by_department CASCADE;
DROP VIEW IF EXISTS public.v_compliance_dashboard_cluster CASCADE;
DROP VIEW IF EXISTS public.v_compliance_summary CASCADE;
DROP VIEW IF EXISTS public.v_course_analytics CASCADE;
DROP VIEW IF EXISTS public.v_data_integrity_check CASCADE;
DROP VIEW IF EXISTS public.v_dei_demographics CASCADE;
DROP VIEW IF EXISTS public.v_dei_pay_equity CASCADE;
DROP VIEW IF EXISTS public.v_embedding_queue_stats CASCADE;
DROP VIEW IF EXISTS public.v_employee_career_overview CASCADE;
DROP VIEW IF EXISTS public.v_employee_context CASCADE;
DROP VIEW IF EXISTS public.v_employee_experience_score_cluster CASCADE;
DROP VIEW IF EXISTS public.v_employee_learning_profile CASCADE;
DROP VIEW IF EXISTS public.v_employee_lifecycle_cluster CASCADE;
DROP VIEW IF EXISTS public.v_employee_master CASCADE;
DROP VIEW IF EXISTS public.v_employee_predictions CASCADE;
DROP VIEW IF EXISTS public.v_employee_sap_master CASCADE;
DROP VIEW IF EXISTS public.v_employee_skill_details CASCADE;
DROP VIEW IF EXISTS public.v_employee_skill_summary CASCADE;
DROP VIEW IF EXISTS public.v_employee_skills CASCADE;
DROP VIEW IF EXISTS public.v_employee_skills_summary CASCADE;
DROP VIEW IF EXISTS public.v_engagement_analytics CASCADE;
DROP VIEW IF EXISTS public.v_engagement_summary CASCADE;
DROP VIEW IF EXISTS public.v_executive_dashboard_cluster CASCADE;
DROP VIEW IF EXISTS public.v_feature_summary CASCADE;
DROP VIEW IF EXISTS public.v_feedback_given_summary CASCADE;
DROP VIEW IF EXISTS public.v_feedback_summary CASCADE;
DROP VIEW IF EXISTS public.v_feedback_wall CASCADE;
DROP VIEW IF EXISTS public.v_flight_risk_features CASCADE;
DROP VIEW IF EXISTS public.v_goal_cascade CASCADE;
DROP VIEW IF EXISTS public.v_goals_summary CASCADE;
DROP VIEW IF EXISTS public.v_headcount_trend CASCADE;
DROP VIEW IF EXISTS public.v_hr_essentials CASCADE;
DROP VIEW IF EXISTS public.v_job_profile CASCADE;
DROP VIEW IF EXISTS public.v_learning_dashboard CASCADE;
DROP VIEW IF EXISTS public.v_learning_path_progress CASCADE;
DROP VIEW IF EXISTS public.v_learning_recommendations CASCADE;
DROP VIEW IF EXISTS public.v_learning_skills_development CASCADE;
DROP VIEW IF EXISTS public.v_manager_chain_issues CASCADE;
DROP VIEW IF EXISTS public.v_my_applications CASCADE;
DROP VIEW IF EXISTS public.v_my_performance_reviews CASCADE;
DROP VIEW IF EXISTS public.v_nine_box_grid CASCADE;
DROP VIEW IF EXISTS public.v_nine_box_summary CASCADE;
DROP VIEW IF EXISTS public.v_okr_progress CASCADE;
DROP VIEW IF EXISTS public.v_onboarding_dashboard CASCADE;
DROP VIEW IF EXISTS public.v_org_hierarchy CASCADE;
DROP VIEW IF EXISTS public.v_org_structure CASCADE;
DROP VIEW IF EXISTS public.v_org_structure_stats CASCADE;
DROP VIEW IF EXISTS public.v_org_structure_summary CASCADE;
DROP VIEW IF EXISTS public.v_org_unit_headcount CASCADE;
DROP VIEW IF EXISTS public.v_overtime_analysis CASCADE;
DROP VIEW IF EXISTS public.v_payroll_summary CASCADE;
DROP VIEW IF EXISTS public.v_people_inspector CASCADE;
DROP VIEW IF EXISTS public.v_performance_skill_summary CASCADE;
DROP VIEW IF EXISTS public.v_performance_snapshot_cluster CASCADE;
DROP VIEW IF EXISTS public.v_platform_tables CASCADE;
DROP VIEW IF EXISTS public.v_recruiting_pipeline CASCADE;
DROP VIEW IF EXISTS public.v_recruiting_pipeline_cluster CASCADE;
DROP VIEW IF EXISTS public.v_requisition_pipeline CASCADE;
DROP VIEW IF EXISTS public.v_review_cycle_summary CASCADE;
DROP VIEW IF EXISTS public.v_risk_distribution CASCADE;
DROP VIEW IF EXISTS public.v_role_skill_requirements CASCADE;
DROP VIEW IF EXISTS public.v_sap_esco_skills CASCADE;
DROP VIEW IF EXISTS public.v_sap_only_tables CASCADE;
DROP VIEW IF EXISTS public.v_skill_classification_stats CASCADE;
DROP VIEW IF EXISTS public.v_skill_clusters_summary CASCADE;
DROP VIEW IF EXISTS public.v_skill_gaps CASCADE;
DROP VIEW IF EXISTS public.v_skill_migration_summary CASCADE;
DROP VIEW IF EXISTS public.v_skills_classified CASCADE;
DROP VIEW IF EXISTS public.v_skills_gap CASCADE;
DROP VIEW IF EXISTS public.v_skills_matrix CASCADE;
DROP VIEW IF EXISTS public.v_succession_pipeline CASCADE;
DROP VIEW IF EXISTS public.v_succession_readiness CASCADE;
DROP VIEW IF EXISTS public.v_sync_dashboard CASCADE;
DROP VIEW IF EXISTS public.v_sync_status CASCADE;
DROP VIEW IF EXISTS public.v_sync_status_by_tenant CASCADE;
DROP VIEW IF EXISTS public.v_team_goals CASCADE;
DROP VIEW IF EXISTS public.v_tenant_absence_stats CASCADE;
DROP VIEW IF EXISTS public.v_tenant_demographics CASCADE;
DROP VIEW IF EXISTS public.v_tenant_employee_profile CASCADE;
DROP VIEW IF EXISTS public.v_tenant_inspector CASCADE;
DROP VIEW IF EXISTS public.v_tenant_job_stats CASCADE;
DROP VIEW IF EXISTS public.v_tenant_salary_stats CASCADE;
DROP VIEW IF EXISTS public.v_tenants_with_profile CASCADE;
DROP VIEW IF EXISTS public.v_time_balance CASCADE;
DROP VIEW IF EXISTS public.v_total_rewards_statement_cluster CASCADE;
DROP VIEW IF EXISTS public.v_turnover_analysis CASCADE;
DROP VIEW IF EXISTS public.v_unified_employee CASCADE;
DROP VIEW IF EXISTS public.v_unified_skills CASCADE;
DROP VIEW IF EXISTS public.v_unique_sap_employee CASCADE;
DROP VIEW IF EXISTS public.v_unknown_skills_review_queue CASCADE;
DROP VIEW IF EXISTS public.v_upcoming_interviews CASCADE;
DROP VIEW IF EXISTS public.v_whistleblowing_dashboard CASCADE;
DROP VIEW IF EXISTS public.v_workforce_overview CASCADE;
DROP VIEW IF EXISTS public.v_workforce_planning_dashboard_cluster CASCADE;

-- Total: 128 views


-- ============================================================================
-- PHASE 2: ALTER TABLE - Convert timestamp to timestamptz
-- ============================================================================

-- Migration: 083_standardize_timestamptz.sql
-- Purpose: Convert all 'timestamp without time zone' columns to 'timestamp with time zone' (TIMESTAMPTZ)
-- in non-SAP public schema tables, preserving existing values as UTC.
--
-- This migration standardizes timestamp types across the database to ensure consistent
-- timezone-aware datetime handling. The AT TIME ZONE 'UTC' clause preserves existing
-- values correctly by interpreting them as UTC timestamps.
--
-- Scope: 146 non-SAP tables, 323 columns
-- Excluded: SAP infotype tables (pa*, pb*, hrp*, pcl*, t5*, ext_*)
--
-- Generated from schema analysis on 2026-02-03.


-- AI & Analytics Tables

-- Table: ai_analytics_daily (1 column)
ALTER TABLE public.ai_analytics_daily
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: ai_escalation_queue (4 columns)
ALTER TABLE public.ai_escalation_queue
  ALTER COLUMN assigned_at TYPE TIMESTAMPTZ USING assigned_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN resolved_at TYPE TIMESTAMPTZ USING resolved_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: ai_query_audit (1 column)
ALTER TABLE public.ai_query_audit
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: ai_tenant_config (2 columns)
ALTER TABLE public.ai_tenant_config
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: audit_logs (1 column)
ALTER TABLE public.audit_logs
  ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'UTC';

-- Compensation & Benefits Tables

-- Table: bonus_allocations (4 columns)
ALTER TABLE public.bonus_allocations
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN paid_at TYPE TIMESTAMPTZ USING paid_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: bonus_plans (2 columns)
ALTER TABLE public.bonus_plans
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: salary_band_assignments (1 column)
ALTER TABLE public.salary_band_assignments
  ALTER COLUMN assigned_at TYPE TIMESTAMPTZ USING assigned_at AT TIME ZONE 'UTC';

-- Table: salary_bands (2 columns)
ALTER TABLE public.salary_bands
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: market_salary_data (2 columns)
ALTER TABLE public.market_salary_data
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: merit_cycles (2 columns)
ALTER TABLE public.merit_cycles
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: merit_recommendations (4 columns)
ALTER TABLE public.merit_recommendations
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Performance Management Tables

-- Table: calibration_discussions (1 column)
ALTER TABLE public.calibration_discussions
  ALTER COLUMN discussed_at TYPE TIMESTAMPTZ USING discussed_at AT TIME ZONE 'UTC';

-- Table: calibration_participants (1 column)
ALTER TABLE public.calibration_participants
  ALTER COLUMN joined_at TYPE TIMESTAMPTZ USING joined_at AT TIME ZONE 'UTC';

-- Table: calibration_sessions (3 columns)
ALTER TABLE public.calibration_sessions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN scheduled_date TYPE TIMESTAMPTZ USING scheduled_date AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: feedback_360 (2 columns)
ALTER TABLE public.feedback_360
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: goals (3 columns)
ALTER TABLE public.goals
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: performance_reviews (4 columns)
ALTER TABLE public.performance_reviews
  ALTER COLUMN acknowledged_at TYPE TIMESTAMPTZ USING acknowledged_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Career & Talent Tables

-- Table: career_path_levels (1 column)
ALTER TABLE public.career_path_levels
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: career_paths (2 columns)
ALTER TABLE public.career_paths
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: critical_roles (2 columns)
ALTER TABLE public.critical_roles
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: succession_candidates (2 columns)
ALTER TABLE public.succession_candidates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: skill_development_paths (2 columns)
ALTER TABLE public.skill_development_paths
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Contracts & Legal Tables

-- Table: ccnl_contracts (2 columns)
ALTER TABLE public.ccnl_contracts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: contract_amendments (2 columns)
ALTER TABLE public.contract_amendments
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: contracts (2 columns)
ALTER TABLE public.contracts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Social & Engagement Tables

-- Table: club_events (3 columns)
ALTER TABLE public.club_events
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date AT TIME ZONE 'UTC',
  ALTER COLUMN event_date TYPE TIMESTAMPTZ USING event_date AT TIME ZONE 'UTC';

-- Table: club_memberships (1 column)
ALTER TABLE public.club_memberships
  ALTER COLUMN joined_at TYPE TIMESTAMPTZ USING joined_at AT TIME ZONE 'UTC';

-- Table: continuous_feedback (1 column)
ALTER TABLE public.continuous_feedback
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: recognition (1 column)
ALTER TABLE public.recognition
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: social_comments (2 columns)
ALTER TABLE public.social_comments
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: social_likes (1 column)
ALTER TABLE public.social_likes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: social_posts (4 columns)
ALTER TABLE public.social_posts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN pinned_until TYPE TIMESTAMPTZ USING pinned_until AT TIME ZONE 'UTC',
  ALTER COLUMN published_at TYPE TIMESTAMPTZ USING published_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: surveys (2 columns)
ALTER TABLE public.surveys
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: survey_responses (1 column)
ALTER TABLE public.survey_responses
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Core HR / Employee Tables

-- Table: employees (3 columns)
ALTER TABLE public.employees
  ALTER COLUMN auth_last_login TYPE TIMESTAMPTZ USING auth_last_login AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: users (3 columns)
ALTER TABLE public.users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_login TYPE TIMESTAMPTZ USING last_login AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: tenants (3 columns)
ALTER TABLE public.tenants
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN setup_completed_at TYPE TIMESTAMPTZ USING setup_completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: cost_centers (1 column)
ALTER TABLE public.cost_centers
  ALTER COLUMN sap_sync_date TYPE TIMESTAMPTZ USING sap_sync_date AT TIME ZONE 'UTC';

-- Table: departments (1 column)
ALTER TABLE public.departments
  ALTER COLUMN sap_sync_date TYPE TIMESTAMPTZ USING sap_sync_date AT TIME ZONE 'UTC';

-- Table: locations (1 column)
ALTER TABLE public.locations
  ALTER COLUMN sap_sync_date TYPE TIMESTAMPTZ USING sap_sync_date AT TIME ZONE 'UTC';

-- Table: org_units (1 column)
ALTER TABLE public.org_units
  ALTER COLUMN sap_sync_date TYPE TIMESTAMPTZ USING sap_sync_date AT TIME ZONE 'UTC';

-- Table: job_templates (1 column)
ALTER TABLE public.job_templates
  ALTER COLUMN sap_sync_date TYPE TIMESTAMPTZ USING sap_sync_date AT TIME ZONE 'UTC';

-- Employee Sub-tables

-- Table: employee_attendance (3 columns)
ALTER TABLE public.employee_attendance
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN validated_at TYPE TIMESTAMPTZ USING validated_at AT TIME ZONE 'UTC';

-- Table: employee_benefit_enrollments (1 column)
ALTER TABLE public.employee_benefit_enrollments
  ALTER COLUMN enrolled_at TYPE TIMESTAMPTZ USING enrolled_at AT TIME ZONE 'UTC';

-- Table: employee_benefits (1 column)
ALTER TABLE public.employee_benefits
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: employee_career_paths (3 columns)
ALTER TABLE public.employee_career_paths
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: employee_clubs (2 columns)
ALTER TABLE public.employee_clubs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: employee_documents (5 columns)
ALTER TABLE public.employee_documents
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN signed_at TYPE TIMESTAMPTZ USING signed_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ USING uploaded_at AT TIME ZONE 'UTC',
  ALTER COLUMN verified_at TYPE TIMESTAMPTZ USING verified_at AT TIME ZONE 'UTC';

-- Table: employee_occupations (1 column)
ALTER TABLE public.employee_occupations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: employee_overtime (5 columns)
ALTER TABLE public.employee_overtime
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN exported_at TYPE TIMESTAMPTZ USING exported_at AT TIME ZONE 'UTC',
  ALTER COLUMN requested_at TYPE TIMESTAMPTZ USING requested_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: employee_pay_stubs (1 column)
ALTER TABLE public.employee_pay_stubs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: employee_requests (3 columns)
ALTER TABLE public.employee_requests
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN resolved_at TYPE TIMESTAMPTZ USING resolved_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: employee_time_off_balances (2 columns)
ALTER TABLE public.employee_time_off_balances
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: employee_time_off_requests (4 columns)
ALTER TABLE public.employee_time_off_requests
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- GDPR & Compliance Tables

-- Table: data_retention_policies (2 columns)
ALTER TABLE public.data_retention_policies
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: data_subject_requests (2 columns)
ALTER TABLE public.data_subject_requests
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN requested_at TYPE TIMESTAMPTZ USING requested_at AT TIME ZONE 'UTC';

-- Table: whistleblowing_attachments (1 column)
ALTER TABLE public.whistleblowing_attachments
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: whistleblowing_audit_log (1 column)
ALTER TABLE public.whistleblowing_audit_log
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: whistleblowing_handlers (2 columns)
ALTER TABLE public.whistleblowing_handlers
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: whistleblowing_messages (1 column)
ALTER TABLE public.whistleblowing_messages
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: whistleblowing_reports (4 columns)
ALTER TABLE public.whistleblowing_reports
  ALTER COLUMN acknowledgement_date TYPE TIMESTAMPTZ USING acknowledgement_date AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN feedback_date TYPE TIMESTAMPTZ USING feedback_date AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: whistleblowing_settings (2 columns)
ALTER TABLE public.whistleblowing_settings
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Document Management Tables

-- Table: document_acknowledgments (1 column)
ALTER TABLE public.document_acknowledgments
  ALTER COLUMN acknowledged_at TYPE TIMESTAMPTZ USING acknowledged_at AT TIME ZONE 'UTC';

-- Table: document_requests (4 columns)
ALTER TABLE public.document_requests
  ALTER COLUMN assigned_at TYPE TIMESTAMPTZ USING assigned_at AT TIME ZONE 'UTC',
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: signature_recipients (5 columns)
ALTER TABLE public.signature_recipients
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN declined_at TYPE TIMESTAMPTZ USING declined_at AT TIME ZONE 'UTC',
  ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC',
  ALTER COLUMN signed_at TYPE TIMESTAMPTZ USING signed_at AT TIME ZONE 'UTC',
  ALTER COLUMN viewed_at TYPE TIMESTAMPTZ USING viewed_at AT TIME ZONE 'UTC';

-- Table: signature_requests (4 columns)
ALTER TABLE public.signature_requests
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Leave Management Tables

-- Table: leave_accrual_rules (2 columns)
ALTER TABLE public.leave_accrual_rules
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: leave_approval_steps (2 columns)
ALTER TABLE public.leave_approval_steps
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN decision_at TYPE TIMESTAMPTZ USING decision_at AT TIME ZONE 'UTC';

-- Table: leave_balance_transactions (1 column)
ALTER TABLE public.leave_balance_transactions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: medical_certificates (3 columns)
ALTER TABLE public.medical_certificates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN verified_at TYPE TIMESTAMPTZ USING verified_at AT TIME ZONE 'UTC';

-- Table: holidays (1 column)
ALTER TABLE public.holidays
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Mentorship Tables

-- Table: mentorship_programs (2 columns)
ALTER TABLE public.mentorship_programs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: mentorship_sessions (2 columns)
ALTER TABLE public.mentorship_sessions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN session_date TYPE TIMESTAMPTZ USING session_date AT TIME ZONE 'UTC';

-- Table: mentorships (2 columns)
ALTER TABLE public.mentorships
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Notifications Tables

-- Table: notification_preferences (2 columns)
ALTER TABLE public.notification_preferences
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: notifications (3 columns)
ALTER TABLE public.notifications
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN read_at TYPE TIMESTAMPTZ USING read_at AT TIME ZONE 'UTC';

-- Onboarding & Preboarding Tables

-- Table: onboarding_checklist (2 columns)
ALTER TABLE public.onboarding_checklist
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: onboarding_documents (2 columns)
ALTER TABLE public.onboarding_documents
  ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ USING uploaded_at AT TIME ZONE 'UTC',
  ALTER COLUMN verified_at TYPE TIMESTAMPTZ USING verified_at AT TIME ZONE 'UTC';

-- Table: onboarding_instances (2 columns)
ALTER TABLE public.onboarding_instances
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: onboarding_tasks (3 columns)
ALTER TABLE public.onboarding_tasks
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: onboarding_template_tasks (1 column)
ALTER TABLE public.onboarding_template_tasks
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: onboarding_templates (2 columns)
ALTER TABLE public.onboarding_templates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: preboarding_equipment (3 columns)
ALTER TABLE public.preboarding_equipment
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: preboarding_notifications (1 column)
ALTER TABLE public.preboarding_notifications
  ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC';

-- Table: preboarding_sessions (3 columns)
ALTER TABLE public.preboarding_sessions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN token_expires_at TYPE TIMESTAMPTZ USING token_expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: preboarding_tasks (3 columns)
ALTER TABLE public.preboarding_tasks
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: preboarding_templates (2 columns)
ALTER TABLE public.preboarding_templates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: preboarding_welcome_content (2 columns)
ALTER TABLE public.preboarding_welcome_content
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Payroll Integration Tables

-- Table: payroll_anomaly_patterns (2 columns)
ALTER TABLE public.payroll_anomaly_patterns
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: payroll_export_employees (3 columns)
ALTER TABLE public.payroll_export_employees
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN processed_at TYPE TIMESTAMPTZ USING processed_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: payroll_export_files (4 columns)
ALTER TABLE public.payroll_export_files
  ALTER COLUMN archived_at TYPE TIMESTAMPTZ USING archived_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_downloaded_at TYPE TIMESTAMPTZ USING last_downloaded_at AT TIME ZONE 'UTC';

-- Table: payroll_export_jobs (12 columns)
ALTER TABLE public.payroll_export_jobs
  ALTER COLUMN acknowledged_at TYPE TIMESTAMPTZ USING acknowledged_at AT TIME ZONE 'UTC',
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN export_completed_at TYPE TIMESTAMPTZ USING export_completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN export_started_at TYPE TIMESTAMPTZ USING export_started_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_retry_at TYPE TIMESTAMPTZ USING last_retry_at AT TIME ZONE 'UTC',
  ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE 'UTC',
  ALTER COLUMN transmission_completed_at TYPE TIMESTAMPTZ USING transmission_completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN transmission_started_at TYPE TIMESTAMPTZ USING transmission_started_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN validation_completed_at TYPE TIMESTAMPTZ USING validation_completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN validation_started_at TYPE TIMESTAMPTZ USING validation_started_at AT TIME ZONE 'UTC';

-- Table: payroll_field_mappings (2 columns)
ALTER TABLE public.payroll_field_mappings
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: payroll_integrations (3 columns)
ALTER TABLE public.payroll_integrations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_connection_test TYPE TIMESTAMPTZ USING last_connection_test AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: payroll_transmission_log (3 columns)
ALTER TABLE public.payroll_transmission_log
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN request_timestamp TYPE TIMESTAMPTZ USING request_timestamp AT TIME ZONE 'UTC',
  ALTER COLUMN response_timestamp TYPE TIMESTAMPTZ USING response_timestamp AT TIME ZONE 'UTC';

-- Table: payroll_validation_rules (2 columns)
ALTER TABLE public.payroll_validation_rules
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- RAG / AI Assistant Tables

-- Table: rag_document_chunks (1 column)
ALTER TABLE public.rag_document_chunks
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: rag_documents (2 columns)
ALTER TABLE public.rag_documents
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN processed_at TYPE TIMESTAMPTZ USING processed_at AT TIME ZONE 'UTC';

-- Table: rag_knowledge_bases (2 columns)
ALTER TABLE public.rag_knowledge_bases
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: rag_messages (3 columns)
ALTER TABLE public.rag_messages
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN escalated_at TYPE TIMESTAMPTZ USING escalated_at AT TIME ZONE 'UTC',
  ALTER COLUMN human_responded_at TYPE TIMESTAMPTZ USING human_responded_at AT TIME ZONE 'UTC';

-- Table: rag_provider_keys (3 columns)
ALTER TABLE public.rag_provider_keys
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_validated TYPE TIMESTAMPTZ USING last_validated AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: rag_sessions (2 columns)
ALTER TABLE public.rag_sessions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Recruiting Tables

-- Table: recruiting_candidate_history (1 column)
ALTER TABLE public.recruiting_candidate_history
  ALTER COLUMN changed_at TYPE TIMESTAMPTZ USING changed_at AT TIME ZONE 'UTC';

-- Table: recruiting_candidates (4 columns)
ALTER TABLE public.recruiting_candidates
  ALTER COLUMN applied_at TYPE TIMESTAMPTZ USING applied_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_activity TYPE TIMESTAMPTZ USING last_activity AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: recruiting_interview_participants (1 column)
ALTER TABLE public.recruiting_interview_participants
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: recruiting_interview_templates (2 columns)
ALTER TABLE public.recruiting_interview_templates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: recruiting_interviewer_availability (1 column)
ALTER TABLE public.recruiting_interviewer_availability
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: recruiting_interviews (4 columns)
ALTER TABLE public.recruiting_interviews
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN reminder_at TYPE TIMESTAMPTZ USING reminder_at AT TIME ZONE 'UTC',
  ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: recruiting_offers (5 columns)
ALTER TABLE public.recruiting_offers
  ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN responded_at TYPE TIMESTAMPTZ USING responded_at AT TIME ZONE 'UTC',
  ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: recruiting_requisitions (3 columns)
ALTER TABLE public.recruiting_requisitions
  ALTER COLUMN closed_at TYPE TIMESTAMPTZ USING closed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Internal Mobility Tables

-- Table: internal_applications (7 columns)
ALTER TABLE public.internal_applications
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN decided_at TYPE TIMESTAMPTZ USING decided_at AT TIME ZONE 'UTC',
  ALTER COLUMN interview_date TYPE TIMESTAMPTZ USING interview_date AT TIME ZONE 'UTC',
  ALTER COLUMN manager_approval_date TYPE TIMESTAMPTZ USING manager_approval_date AT TIME ZONE 'UTC',
  ALTER COLUMN reviewed_at TYPE TIMESTAMPTZ USING reviewed_at AT TIME ZONE 'UTC',
  ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: internal_job_alerts (2 columns)
ALTER TABLE public.internal_job_alerts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: internal_job_bookmarks (1 column)
ALTER TABLE public.internal_job_bookmarks
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: internal_job_postings (4 columns)
ALTER TABLE public.internal_job_postings
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN posted_at TYPE TIMESTAMPTZ USING posted_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: internal_job_views (1 column)
ALTER TABLE public.internal_job_views
  ALTER COLUMN viewed_at TYPE TIMESTAMPTZ USING viewed_at AT TIME ZONE 'UTC';

-- Table: saved_jobs (1 column)
ALTER TABLE public.saved_jobs
  ALTER COLUMN saved_at TYPE TIMESTAMPTZ USING saved_at AT TIME ZONE 'UTC';

-- SAP Integration Tables (not SAP infotype tables)

-- Table: heuresys_sap_mapping (2 columns)
ALTER TABLE public.heuresys_sap_mapping
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: sap_config (1 column)
ALTER TABLE public.sap_config
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: sap_delta_sync_log (3 columns)
ALTER TABLE public.sap_delta_sync_log
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN local_timestamp TYPE TIMESTAMPTZ USING local_timestamp AT TIME ZONE 'UTC',
  ALTER COLUMN source_timestamp TYPE TIMESTAMPTZ USING source_timestamp AT TIME ZONE 'UTC';

-- Table: sap_employee_mapping (3 columns)
ALTER TABLE public.sap_employee_mapping
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_synced_at TYPE TIMESTAMPTZ USING last_synced_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: sap_infotype_mappings (2 columns)
ALTER TABLE public.sap_infotype_mappings
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: sap_migration_jobs (5 columns)
ALTER TABLE public.sap_migration_jobs
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN estimated_completion TYPE TIMESTAMPTZ USING estimated_completion AT TIME ZONE 'UTC',
  ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: sap_migration_rollback_log (2 columns)
ALTER TABLE public.sap_migration_rollback_log
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN rolled_back_at TYPE TIMESTAMPTZ USING rolled_back_at AT TIME ZONE 'UTC';

-- Table: sap_staged_data (2 columns)
ALTER TABLE public.sap_staged_data
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN processed_at TYPE TIMESTAMPTZ USING processed_at AT TIME ZONE 'UTC';

-- Table: tenant_sap_mapping (1 column)
ALTER TABLE public.tenant_sap_mapping
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: user_pernr_mapping (2 columns)
ALTER TABLE public.user_pernr_mapping
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_sync_at TYPE TIMESTAMPTZ USING last_sync_at AT TIME ZONE 'UTC';

-- Table: sync_log (2 columns)
ALTER TABLE public.sync_log
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC';

-- Table: sync_queue (2 columns)
ALTER TABLE public.sync_queue
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN processed_at TYPE TIMESTAMPTZ USING processed_at AT TIME ZONE 'UTC';

-- ESCO Taxonomy Tables

-- Table: esco_isco_groups (1 column)
ALTER TABLE public.esco_isco_groups
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_occupation_skills (1 column)
ALTER TABLE public.esco_occupation_skills
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_occupations (1 column)
ALTER TABLE public.esco_occupations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_occupations_backup (1 column)
ALTER TABLE public.esco_occupations_backup
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_skill_groups (1 column)
ALTER TABLE public.esco_skill_groups
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_skill_relations (1 column)
ALTER TABLE public.esco_skill_relations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_skills (1 column)
ALTER TABLE public.esco_skills
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: esco_skills_backup (1 column)
ALTER TABLE public.esco_skills_backup
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Platform & Feature Tables

-- Table: feature_categories (2 columns)
ALTER TABLE public.feature_categories
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: features (2 columns)
ALTER TABLE public.features
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: platform_features (3 columns)
ALTER TABLE public.platform_features
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN implemented_at TYPE TIMESTAMPTZ USING implemented_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: roadmap_phases (1 column)
ALTER TABLE public.roadmap_phases
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Table: service_config (2 columns)
ALTER TABLE public.service_config
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: table_usage_rules (1 column)
ALTER TABLE public.table_usage_rules
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- SSO & Authentication Tables

-- Table: sso_configurations (2 columns)
ALTER TABLE public.sso_configurations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Table: sso_login_attempts (1 column)
ALTER TABLE public.sso_login_attempts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Industry & Prototype Tables

-- Table: industry_prototypes (2 columns)
ALTER TABLE public.industry_prototypes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- ============================================================================
-- PHASE 3: RECREATE ALL VIEWS (in dependency order)
-- ============================================================================

CREATE OR REPLACE VIEW analytics.v_candidate_detail AS
SELECT c.id AS candidate_id,
    c.tenant_id,
    c.requisition_id,
    r.title AS job_title,
    c.first_name,
    c.last_name,
    (c.first_name::text || ' '::text) || c.last_name::text AS full_name,
    c.email,
    c.phone,
    c.source,
    c.stage AS current_stage,
    c.rating,
    c.resume_url,
    c.linkedin_url,
    c.notes,
    c.created_at AS applied_at,
    c.updated_at AS last_updated,
    EXTRACT(day FROM CURRENT_TIMESTAMP - c.updated_at::timestamp with time zone) AS days_in_current_stage,
    EXTRACT(day FROM CURRENT_TIMESTAMP - c.created_at::timestamp with time zone) AS total_days_in_pipeline,
    ( SELECT count(*) AS count
           FROM recruiting_candidate_history h
          WHERE h.candidate_id = c.id) AS stage_transitions
   FROM recruiting_candidates c
     LEFT JOIN recruiting_requisitions r ON r.id = c.requisition_id;


CREATE OR REPLACE VIEW analytics.v_candidate_summary AS
SELECT c.id AS candidate_id,
    c.tenant_id,
    c.requisition_id,
    r.title AS job_title,
    c.first_name,
    c.last_name,
    (c.first_name::text || ' '::text) || c.last_name::text AS full_name,
    c.email,
    c.phone,
    c.source,
    c.stage AS current_stage,
    c.rating,
    c.resume_url,
    c.linkedin_url,
    c.notes,
    c.created_at AS applied_at,
    c.updated_at AS last_updated,
    EXTRACT(day FROM CURRENT_TIMESTAMP - c.updated_at::timestamp with time zone) AS days_in_current_stage,
    EXTRACT(day FROM CURRENT_TIMESTAMP - c.created_at::timestamp with time zone) AS total_days_in_pipeline,
    ( SELECT count(*) AS count
           FROM recruiting_candidate_history h
          WHERE h.candidate_id = c.id) AS stage_transitions,
    ( SELECT json_build_object('from_stage', h.from_stage, 'to_stage', h.to_stage, 'changed_at', h.changed_at, 'changed_by', (e.first_name::text || ' '::text) || e.last_name::text) AS json_build_object
           FROM recruiting_candidate_history h
             LEFT JOIN employees e ON e.id = h.changed_by
          WHERE h.candidate_id = c.id
          ORDER BY h.changed_at DESC
         LIMIT 1) AS last_transition
   FROM recruiting_candidates c
     LEFT JOIN recruiting_requisitions r ON r.id = c.requisition_id;


CREATE OR REPLACE VIEW analytics.v_compliance_dashboard AS
SELECT id AS tenant_id,
    name AS tenant_name,
    ( SELECT count(*) AS count
           FROM data_subject_requests dsr
          WHERE dsr.tenant_id = t.id) AS total_dsr_requests,
    ( SELECT count(*) AS count
           FROM data_subject_requests dsr
          WHERE dsr.tenant_id = t.id AND dsr.status::text = 'pending'::text) AS pending_dsr_requests,
    ( SELECT count(*) AS count
           FROM data_subject_requests dsr
          WHERE dsr.tenant_id = t.id AND dsr.status::text = 'completed'::text) AS completed_dsr_requests,
    ( SELECT count(*) AS count
           FROM employee_time_off_requests tor
             JOIN employees e ON e.id = tor.employee_id
          WHERE e.tenant_id = t.id AND tor.status::text = 'pending'::text) AS pending_time_requests,
    ( SELECT count(*) AS count
           FROM whistleblowing_reports wr
          WHERE wr.tenant_id = t.id) AS total_whistleblowing,
    ( SELECT count(*) AS count
           FROM whistleblowing_reports wr
          WHERE wr.tenant_id = t.id AND (wr.status::text = ANY (ARRAY['submitted'::character varying::text, 'investigating'::character varying::text, 'open'::character varying::text]))) AS open_whistleblowing,
    ( SELECT count(*) AS count
           FROM whistleblowing_reports wr
          WHERE wr.tenant_id = t.id AND wr.status::text = 'resolved'::text) AS resolved_whistleblowing,
    ( SELECT count(*) AS count
           FROM audit_logs al
          WHERE al.tenant_id = t.id AND al."timestamp" > (CURRENT_DATE - '7 days'::interval)) AS audit_entries_7d,
    ( SELECT count(*) AS count
           FROM audit_logs al
          WHERE al.tenant_id = t.id AND al."timestamp" > (CURRENT_DATE - '30 days'::interval)) AS audit_entries_30d,
    ( SELECT count(DISTINCT al.user_id) AS count
           FROM audit_logs al
          WHERE al.tenant_id = t.id AND al."timestamp" > (CURRENT_DATE - '7 days'::interval)) AS active_users_7d,
    round((
        CASE
            WHEN (( SELECT count(*) AS count
               FROM data_subject_requests dsr
              WHERE dsr.tenant_id = t.id AND dsr.status::text = 'pending'::text)) = 0 THEN 30::bigint
            ELSE 30 - LEAST((( SELECT count(*) AS count
               FROM data_subject_requests dsr
              WHERE dsr.tenant_id = t.id AND dsr.status::text = 'pending'::text)) * 5, 30::bigint)
        END +
        CASE
            WHEN (( SELECT count(*) AS count
               FROM whistleblowing_reports wr
              WHERE wr.tenant_id = t.id AND (wr.status::text = ANY (ARRAY['submitted'::character varying::text, 'investigating'::character varying::text, 'open'::character varying::text])))) = 0 THEN 30::bigint
            ELSE 30 - LEAST((( SELECT count(*) AS count
               FROM whistleblowing_reports wr
              WHERE wr.tenant_id = t.id AND (wr.status::text = ANY (ARRAY['submitted'::character varying::text, 'investigating'::character varying::text, 'open'::character varying::text])))) * 10, 30::bigint)
        END +
        CASE
            WHEN (( SELECT count(*) AS count
               FROM audit_logs al
              WHERE al.tenant_id = t.id AND al."timestamp" > (CURRENT_DATE - '7 days'::interval))) > 0 THEN 40
            ELSE 20
        END)::numeric, 0) AS compliance_score
   FROM tenants t;


CREATE OR REPLACE VIEW analytics.v_employee_experience_score AS
SELECT id AS employee_id,
    tenant_id,
    (first_name::text || ' '::text) || last_name::text AS employee_name,
    department,
    job_title,
    hire_date,
    COALESCE(( SELECT count(*) AS count
           FROM social_posts sp
          WHERE sp.author_id = e.id AND sp.created_at > (CURRENT_DATE - '30 days'::interval)), 0::bigint) AS posts_30d,
    COALESCE(( SELECT count(*) AS count
           FROM recognition r
          WHERE (r.giver_id = e.id OR r.from_employee_id = e.id) AND r.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) AS recognitions_given_90d,
    COALESCE(( SELECT count(*) AS count
           FROM recognition r
          WHERE (r.receiver_id = e.id OR r.to_employee_id = e.id) AND r.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) AS recognitions_received_90d,
    COALESCE(( SELECT count(*) AS count
           FROM club_memberships cm
          WHERE cm.employee_id = e.id), 0::bigint) AS clubs_joined,
    COALESCE(( SELECT count(*) AS count
           FROM check_ins ci
          WHERE ci.employee_id = e.id AND ci.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) AS checkins_90d,
    COALESCE(( SELECT count(*) AS count
           FROM continuous_feedback cf
          WHERE cf.from_employee_id = e.id AND cf.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) AS feedback_given_90d,
    round(LEAST(COALESCE(( SELECT count(*) AS count
           FROM recognition r
          WHERE (r.receiver_id = e.id OR r.to_employee_id = e.id) AND r.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) * 10, 100::bigint)::numeric * 0.25 +
        CASE
            WHEN COALESCE(( SELECT count(*) AS count
               FROM social_posts sp
              WHERE sp.author_id = e.id), 0::bigint) > 0 THEN 70
            ELSE 30
        END::numeric * 0.20 +
        CASE
            WHEN COALESCE(( SELECT count(*) AS count
               FROM club_memberships cm
              WHERE cm.employee_id = e.id), 0::bigint) > 0 THEN 80
            ELSE 40
        END::numeric * 0.15 +
        CASE
            WHEN COALESCE(( SELECT count(*) AS count
               FROM check_ins ci
              WHERE ci.employee_id = e.id AND ci.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) >= 3 THEN 90
            ELSE 50
        END::numeric * 0.20 +
        CASE
            WHEN COALESCE(( SELECT count(*) AS count
               FROM continuous_feedback cf
              WHERE cf.from_employee_id = e.id AND cf.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) > 0 THEN 80
            ELSE 40
        END::numeric * 0.20, 2) AS composite_ex_score,
        CASE
            WHEN (LEAST(COALESCE(( SELECT count(*) AS count
               FROM recognition r
              WHERE (r.receiver_id = e.id OR r.to_employee_id = e.id) AND r.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) * 10, 100::bigint)::numeric * 0.25 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM social_posts sp
                  WHERE sp.author_id = e.id), 0::bigint) > 0 THEN 70
                ELSE 30
            END::numeric * 0.20 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM club_memberships cm
                  WHERE cm.employee_id = e.id), 0::bigint) > 0 THEN 80
                ELSE 40
            END::numeric * 0.15 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM check_ins ci
                  WHERE ci.employee_id = e.id AND ci.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) >= 3 THEN 90
                ELSE 50
            END::numeric * 0.20 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM continuous_feedback cf
                  WHERE cf.from_employee_id = e.id AND cf.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) > 0 THEN 80
                ELSE 40
            END::numeric * 0.20) >= 70::numeric THEN 'Highly Engaged'::text
            WHEN (LEAST(COALESCE(( SELECT count(*) AS count
               FROM recognition r
              WHERE (r.receiver_id = e.id OR r.to_employee_id = e.id) AND r.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) * 10, 100::bigint)::numeric * 0.25 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM social_posts sp
                  WHERE sp.author_id = e.id), 0::bigint) > 0 THEN 70
                ELSE 30
            END::numeric * 0.20 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM club_memberships cm
                  WHERE cm.employee_id = e.id), 0::bigint) > 0 THEN 80
                ELSE 40
            END::numeric * 0.15 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM check_ins ci
                  WHERE ci.employee_id = e.id AND ci.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) >= 3 THEN 90
                ELSE 50
            END::numeric * 0.20 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM continuous_feedback cf
                  WHERE cf.from_employee_id = e.id AND cf.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) > 0 THEN 80
                ELSE 40
            END::numeric * 0.20) >= 50::numeric THEN 'Engaged'::text
            WHEN (LEAST(COALESCE(( SELECT count(*) AS count
               FROM recognition r
              WHERE (r.receiver_id = e.id OR r.to_employee_id = e.id) AND r.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) * 10, 100::bigint)::numeric * 0.25 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM social_posts sp
                  WHERE sp.author_id = e.id), 0::bigint) > 0 THEN 70
                ELSE 30
            END::numeric * 0.20 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM club_memberships cm
                  WHERE cm.employee_id = e.id), 0::bigint) > 0 THEN 80
                ELSE 40
            END::numeric * 0.15 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM check_ins ci
                  WHERE ci.employee_id = e.id AND ci.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) >= 3 THEN 90
                ELSE 50
            END::numeric * 0.20 +
            CASE
                WHEN COALESCE(( SELECT count(*) AS count
                   FROM continuous_feedback cf
                  WHERE cf.from_employee_id = e.id AND cf.created_at > (CURRENT_DATE - '90 days'::interval)), 0::bigint) > 0 THEN 80
                ELSE 40
            END::numeric * 0.20) >= 35::numeric THEN 'Neutral'::text
            ELSE 'At Risk'::text
        END AS ex_category
   FROM employees e
  WHERE employment_status::text = 'active'::text OR is_active = true;


CREATE OR REPLACE VIEW analytics.v_employee_lifecycle AS
SELECT e.id,
    e.tenant_id,
    e.pernr AS employee_number,
    e.first_name,
    e.last_name,
    (e.first_name::text || ' '::text) || e.last_name::text AS full_name,
    e.email,
    e.hire_date,
    e.termination_date,
    e.termination_reason,
    e.employment_status,
    e.job_title,
    e.department,
    e.location,
    e.manager_id,
    (mgr.first_name::text || ' '::text) || mgr.last_name::text AS manager_name,
    oi.id AS onboarding_instance_id,
    oi.status AS onboarding_status,
    oi.progress_percent AS onboarding_progress,
    oi.start_date AS onboarding_start,
    oi.actual_completion_date AS onboarding_completed,
    EXTRACT(year FROM age(COALESCE(e.termination_date, CURRENT_DATE)::timestamp without time zone, e.hire_date::timestamp without time zone)) AS tenure_years,
    CURRENT_DATE - e.hire_date AS days_since_hire,
        CASE
            WHEN oi.status::text = ANY (ARRAY['in_progress'::character varying::text, 'pending'::character varying::text, 'not_started'::character varying::text]) THEN 'ONBOARDING'::text
            WHEN e.termination_date IS NOT NULL THEN 'OFFBOARDED'::text
            WHEN (CURRENT_DATE - e.hire_date) < 90 THEN 'NEW_HIRE'::text
            WHEN (CURRENT_DATE - e.hire_date) < 365 THEN 'RAMPING'::text
            WHEN EXTRACT(year FROM age(CURRENT_DATE::timestamp without time zone, e.hire_date::timestamp without time zone)) > 10::numeric THEN 'VETERAN'::text
            WHEN EXTRACT(year FROM age(CURRENT_DATE::timestamp without time zone, e.hire_date::timestamp without time zone)) > 5::numeric THEN 'EXPERIENCED'::text
            ELSE 'ESTABLISHED'::text
        END AS lifecycle_stage,
    l.name AS location_name,
    l.city AS location_city,
    l.country AS location_country,
    t.name AS tenant_name,
    e.created_at,
    e.updated_at
   FROM employees e
     LEFT JOIN employees mgr ON mgr.id = e.manager_id
     LEFT JOIN onboarding_instances oi ON oi.employee_id = e.id AND (oi.status::text <> ALL (ARRAY['completed'::character varying::text, 'cancelled'::character varying::text]))
     LEFT JOIN locations l ON l.id = e.location_id
     LEFT JOIN tenants t ON t.id = e.tenant_id;


CREATE OR REPLACE VIEW public.v_flight_risk_features AS
WITH avg_salaries AS (
         SELECT employees.department,
            avg(employees.salary) AS avg_dept_salary
           FROM employees
          WHERE employees.salary > 0::numeric AND employees.is_active = true
          GROUP BY employees.department
        ), manager_tenures AS (
         SELECT m.id AS manager_id,
            EXTRACT(month FROM age(m.hire_date::timestamp with time zone)) AS manager_tenure_months
           FROM employees m
        )
 SELECT e.id AS employee_id,
    e.pernr AS sap_pernr,
    e.tenant_id,
    t.code AS tenant_code,
    t.name AS tenant_name,
    e.first_name,
    e.last_name,
    concat(e.first_name, ' ', e.last_name) AS full_name,
    e.job_title,
    e.department,
    e.hire_date,
    round(EXTRACT(epoch FROM age(e.hire_date::timestamp with time zone)) / (365.25 * 24::numeric * 3600::numeric), 1) AS tenure_years,
    COALESCE(e.salary, 0::numeric) AS salary,
        CASE
            WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric THEN round(e.salary / avs.avg_dept_salary, 2)
            ELSE 1.0
        END AS market_ratio,
    e.performance_rating,
    e.potential,
    round(random() * 3::double precision + 1::double precision)::numeric AS last_promotion_years,
    COALESCE(mt.manager_tenure_months, 24::numeric)::integer AS manager_tenure_months,
    round((random() * 40::double precision + 5::double precision)::numeric, 1) AS commute_distance_km,
    round(GREATEST(0::double precision, LEAST(100::double precision, (50 +
        CASE
            WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 1::numeric THEN 20
            WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 2::numeric THEN 10
            WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) > 7::numeric THEN '-15'::integer
            ELSE 0
        END +
        CASE
            WHEN e.performance_rating <= 2::numeric THEN 15
            WHEN e.performance_rating >= 4::numeric AND e.potential::text = 'High'::text THEN 10
            WHEN e.performance_rating >= 4::numeric THEN '-10'::integer
            ELSE 0
        END +
        CASE
            WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) < 0.85 THEN 20
            WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) > 1.1 THEN '-10'::integer
            ELSE 0
        END)::double precision + (random() * 20::double precision - 10::double precision)))::numeric) AS risk_score,
        CASE
            WHEN round(GREATEST(0::double precision, LEAST(100::double precision, (50 +
            CASE
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 1::numeric THEN 20
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 2::numeric THEN 10
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) > 7::numeric THEN '-15'::integer
                ELSE 0
            END +
            CASE
                WHEN e.performance_rating <= 2::numeric THEN 15
                WHEN e.performance_rating >= 4::numeric AND e.potential::text = 'High'::text THEN 10
                WHEN e.performance_rating >= 4::numeric THEN '-10'::integer
                ELSE 0
            END +
            CASE
                WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) < 0.85 THEN 20
                WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) > 1.1 THEN '-10'::integer
                ELSE 0
            END)::double precision + (random() * 20::double precision - 10::double precision)))::numeric) >= 75::numeric THEN 'Critical'::text
            WHEN round(GREATEST(0::double precision, LEAST(100::double precision, (50 +
            CASE
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 1::numeric THEN 20
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 2::numeric THEN 10
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) > 7::numeric THEN '-15'::integer
                ELSE 0
            END +
            CASE
                WHEN e.performance_rating <= 2::numeric THEN 15
                WHEN e.performance_rating >= 4::numeric AND e.potential::text = 'High'::text THEN 10
                WHEN e.performance_rating >= 4::numeric THEN '-10'::integer
                ELSE 0
            END +
            CASE
                WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) < 0.85 THEN 20
                WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) > 1.1 THEN '-10'::integer
                ELSE 0
            END)::double precision + (random() * 20::double precision - 10::double precision)))::numeric) >= 50::numeric THEN 'High'::text
            WHEN round(GREATEST(0::double precision, LEAST(100::double precision, (50 +
            CASE
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 1::numeric THEN 20
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 2::numeric THEN 10
                WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) > 7::numeric THEN '-15'::integer
                ELSE 0
            END +
            CASE
                WHEN e.performance_rating <= 2::numeric THEN 15
                WHEN e.performance_rating >= 4::numeric AND e.potential::text = 'High'::text THEN 10
                WHEN e.performance_rating >= 4::numeric THEN '-10'::integer
                ELSE 0
            END +
            CASE
                WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) < 0.85 THEN 20
                WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) > 1.1 THEN '-10'::integer
                ELSE 0
            END)::double precision + (random() * 20::double precision - 10::double precision)))::numeric) >= 25::numeric THEN 'Medium'::text
            ELSE 'Low'::text
        END AS risk_level,
    array_remove(ARRAY[
        CASE
            WHEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone)) < 2::numeric THEN 'New hire risk'::text
            ELSE NULL::text
        END,
        CASE
            WHEN e.performance_rating <= 2::numeric THEN 'Low performance'::text
            ELSE NULL::text
        END,
        CASE
            WHEN e.performance_rating >= 4::numeric AND e.potential::text = 'High'::text THEN 'High performer may leave'::text
            ELSE NULL::text
        END,
        CASE
            WHEN e.salary > 0::numeric AND avs.avg_dept_salary > 0::numeric AND (e.salary / avs.avg_dept_salary) < 0.85 THEN 'Below market salary'::text
            ELSE NULL::text
        END,
        CASE
            WHEN e.potential::text = 'High'::text AND e.performance_rating < 3::numeric THEN 'Underutilized potential'::text
            ELSE NULL::text
        END], NULL::text) AS risk_factors
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
     LEFT JOIN avg_salaries avs ON avs.department::text = e.department::text
     LEFT JOIN manager_tenures mt ON mt.manager_id = e.manager_id
  WHERE e.is_active = true;


CREATE OR REPLACE VIEW public.v_nine_box_grid AS
SELECT e.id AS employee_id,
    e.pernr AS sap_pernr,
    e.tenant_id,
    t.code AS tenant_code,
    t.name AS tenant_name,
    e.first_name,
    e.last_name,
    concat(e.first_name, ' ', e.last_name) AS full_name,
    e.email,
    e.job_title,
    e.department,
    e.performance_rating,
    e.potential,
        CASE
            WHEN e.potential::text = 'High'::text AND e.performance_rating >= 4::numeric THEN 'Star'::text
            WHEN e.potential::text = 'High'::text AND e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 'High Potential'::text
            WHEN e.potential::text = 'High'::text AND e.performance_rating < 2.5 THEN 'Inconsistent Player'::text
            WHEN e.potential::text = 'Medium'::text AND e.performance_rating >= 4::numeric THEN 'High Performer'::text
            WHEN e.potential::text = 'Medium'::text AND e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 'Core Player'::text
            WHEN e.potential::text = 'Medium'::text AND e.performance_rating < 2.5 THEN 'Underperformer'::text
            WHEN e.potential::text = 'Low'::text AND e.performance_rating >= 4::numeric THEN 'Solid Performer'::text
            WHEN e.potential::text = 'Low'::text AND e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 'Average Performer'::text
            WHEN e.potential::text = 'Low'::text AND e.performance_rating < 2.5 THEN 'Risk'::text
            ELSE 'Not Rated'::text
        END AS box_label,
        CASE
            WHEN e.potential::text = 'High'::text AND e.performance_rating >= 4::numeric THEN 9
            WHEN e.potential::text = 'High'::text AND e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 8
            WHEN e.potential::text = 'High'::text AND e.performance_rating < 2.5 THEN 7
            WHEN e.potential::text = 'Medium'::text AND e.performance_rating >= 4::numeric THEN 6
            WHEN e.potential::text = 'Medium'::text AND e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 5
            WHEN e.potential::text = 'Medium'::text AND e.performance_rating < 2.5 THEN 4
            WHEN e.potential::text = 'Low'::text AND e.performance_rating >= 4::numeric THEN 3
            WHEN e.potential::text = 'Low'::text AND e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 2
            WHEN e.potential::text = 'Low'::text AND e.performance_rating < 2.5 THEN 1
            ELSE 0
        END AS box_number,
        CASE
            WHEN e.potential::text = 'High'::text THEN 3
            WHEN e.potential::text = 'Medium'::text THEN 2
            WHEN e.potential::text = 'Low'::text THEN 1
            ELSE 0
        END AS potential_score,
        CASE
            WHEN e.performance_rating >= 4::numeric THEN 3
            WHEN e.performance_rating >= 2.5 AND e.performance_rating <= 3.99 THEN 2
            WHEN e.performance_rating < 2.5 THEN 1
            ELSE 0
        END AS performance_score
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
  WHERE e.is_active = true;


CREATE OR REPLACE VIEW analytics.v_executive_dashboard AS
SELECT t.id AS tenant_id,
    t.name AS tenant_name,
    t.industry_type,
    count(DISTINCT e.id) AS total_employees,
    count(DISTINCT e.id) FILTER (WHERE e.employment_status::text = 'active'::text OR e.is_active = true) AS active_employees,
    round(count(DISTINCT e.id) FILTER (WHERE e.termination_date > (CURRENT_DATE - '1 year'::interval))::numeric / NULLIF(count(DISTINCT e.id), 0)::numeric * 100::numeric, 2) AS turnover_rate_annual,
    count(DISTINCT e.id) FILTER (WHERE e.termination_date > (CURRENT_DATE - '90 days'::interval)) AS terminations_90d,
    count(DISTINCT e.id) FILTER (WHERE e.hire_date > (CURRENT_DATE - '30 days'::interval)) AS new_hires_30d,
    count(DISTINCT e.id) FILTER (WHERE e.hire_date > (CURRENT_DATE - '90 days'::interval)) AS new_hires_90d,
    count(DISTINCT e.id) FILTER (WHERE e.hire_date > (CURRENT_DATE - '365 days'::interval)) AS new_hires_1y,
    round(avg(EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone))), 2) AS avg_tenure_years,
    count(DISTINCT e.id) FILTER (WHERE e.gender::text = 'male'::text OR e.gender::text = 'M'::text) AS male_count,
    count(DISTINCT e.id) FILTER (WHERE e.gender::text = 'female'::text OR e.gender::text = 'F'::text) AS female_count,
    round(count(DISTINCT e.id) FILTER (WHERE e.gender::text = 'female'::text OR e.gender::text = 'F'::text)::numeric / NULLIF(count(DISTINCT e.id), 0)::numeric * 100::numeric, 2) AS female_percentage,
    round(avg(e.salary), 2) AS avg_salary,
    sum(e.salary) AS total_salary_cost,
    round(avg(pr.overall_rating), 2) AS avg_performance_rating,
    count(DISTINCT e.id) FILTER (WHERE pr.overall_rating >= 4::numeric) AS high_performers,
    count(DISTINCT e.id) FILTER (WHERE pr.overall_rating < 2.5) AS low_performers,
    count(DISTINCT e.id) FILTER (WHERE fr.risk_level = 'high'::text) AS high_risk_employees,
    count(DISTINCT e.id) FILTER (WHERE fr.risk_level = 'medium'::text) AS medium_risk_employees,
    round(count(DISTINCT e.id) FILTER (WHERE fr.risk_level = 'high'::text)::numeric / NULLIF(count(DISTINCT e.id), 0)::numeric * 100::numeric, 2) AS high_risk_percentage,
    count(DISTINCT e.id) FILTER (WHERE nb.box_label = ANY (ARRAY['Star'::text, 'High Performer'::text, 'Future Star'::text])) AS top_talent,
    count(DISTINCT e.id) FILTER (WHERE nb.box_label = ANY (ARRAY['Core Player'::text, 'Solid Performer'::text])) AS solid_talent,
    count(DISTINCT e.id) FILTER (WHERE nb.box_label = ANY (ARRAY['Underperformer'::text, 'Bad Hire'::text, 'Talent Risk'::text])) AS action_needed,
    ( SELECT count(*) AS count
           FROM critical_roles cr
          WHERE cr.tenant_id = t.id) AS critical_roles,
    ( SELECT count(*) AS count
           FROM critical_roles cr
          WHERE cr.tenant_id = t.id AND (EXISTS ( SELECT 1
                   FROM succession_candidates sc
                  WHERE sc.critical_role_id = cr.id AND sc.readiness_level::text = 'ready_now'::text))) AS succession_ready,
    ( SELECT count(*) AS count
           FROM recruiting_requisitions rr
          WHERE rr.tenant_id = t.id AND rr.status::text = 'open'::text) AS open_requisitions,
    ( SELECT count(*) AS count
           FROM recruiting_candidates rc
             JOIN recruiting_requisitions rr ON rr.id = rc.requisition_id
          WHERE rr.tenant_id = t.id AND (rc.stage::text <> ALL (ARRAY['hired'::character varying::text, 'rejected'::character varying::text, 'withdrawn'::character varying::text]))) AS active_candidates
   FROM tenants t
     LEFT JOIN employees e ON e.tenant_id = t.id
     LEFT JOIN performance_reviews pr ON pr.employee_id = e.id AND pr.submitted_at = (( SELECT max(performance_reviews.submitted_at) AS max
           FROM performance_reviews
          WHERE performance_reviews.employee_id = e.id))
     LEFT JOIN v_flight_risk_features fr ON fr.employee_id = e.id
     LEFT JOIN v_nine_box_grid nb ON nb.employee_id = e.id
  GROUP BY t.id, t.name, t.industry_type;


CREATE OR REPLACE VIEW analytics.v_performance_snapshot AS
SELECT e.id AS employee_id,
    e.tenant_id,
    e.pernr AS employee_number,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    e.department,
    e.manager_id,
    (mgr.first_name::text || ' '::text) || mgr.last_name::text AS manager_name,
    count(DISTINCT g.id) AS total_goals,
    count(DISTINCT g.id) FILTER (WHERE g.status::text = 'completed'::text) AS goals_completed,
    count(DISTINCT g.id) FILTER (WHERE g.status::text = ANY (ARRAY['in_progress'::character varying::text, 'on_track'::character varying::text])) AS goals_active,
    count(DISTINCT g.id) FILTER (WHERE g.status::text = 'at_risk'::text) AS goals_at_risk,
    round(avg(g.progress_percent), 2) AS avg_goal_progress,
    count(DISTINCT o.id) AS total_okrs,
    round(avg(o.overall_progress), 2) AS avg_okr_progress,
    count(DISTINCT kr.id) AS total_key_results,
    round(avg(
        CASE
            WHEN kr.target_value > 0::numeric THEN kr.current_value / kr.target_value * 100::numeric
            ELSE 0::numeric
        END), 2) AS avg_kr_completion,
    count(DISTINCT cf.id) FILTER (WHERE cf.created_at > (CURRENT_DATE - '90 days'::interval)) AS feedback_received_90d,
    count(DISTINCT rec.id) AS total_recognitions,
    count(DISTINCT rec.id) FILTER (WHERE rec.created_at > (CURRENT_DATE - '90 days'::interval)) AS recognitions_90d,
    count(DISTINCT ci.id) FILTER (WHERE ci.created_at > (CURRENT_DATE - '90 days'::interval)) AS checkins_90d,
    pr.id AS last_review_id,
    pr.review_type AS last_review_type,
    pr.overall_rating AS last_overall_rating,
    pr.potential_rating AS last_potential_rating,
    pr.submitted_at AS last_review_date,
    nb.performance_score,
    nb.potential_score,
    nb.box_label AS box_position,
    count(DISTINCT sa.id) AS skill_assessments,
    round(avg(sa.assessed_level), 2) AS avg_skill_level
   FROM employees e
     LEFT JOIN employees mgr ON mgr.id = e.manager_id
     LEFT JOIN goals g ON g.employee_id = e.id
     LEFT JOIN okrs o ON o.owner_id = e.id
     LEFT JOIN key_results kr ON kr.okr_id = o.id
     LEFT JOIN continuous_feedback cf ON cf.to_employee_id = e.id
     LEFT JOIN recognition rec ON rec.receiver_id = e.id OR rec.to_employee_id = e.id
     LEFT JOIN check_ins ci ON ci.employee_id = e.id
     LEFT JOIN performance_reviews pr ON pr.employee_id = e.id AND pr.submitted_at = (( SELECT max(performance_reviews.submitted_at) AS max
           FROM performance_reviews
          WHERE performance_reviews.employee_id = e.id))
     LEFT JOIN v_nine_box_grid nb ON nb.employee_id = e.id
     LEFT JOIN employee_skill_assessments sa ON sa.employee_id = e.id
  WHERE e.employment_status::text = 'active'::text OR e.is_active = true
  GROUP BY e.id, e.tenant_id, e.pernr, e.first_name, e.last_name, e.job_title, e.department, e.manager_id, mgr.first_name, mgr.last_name, pr.id, pr.review_type, pr.overall_rating, pr.potential_rating, pr.submitted_at, nb.performance_score, nb.potential_score, nb.box_label;


CREATE OR REPLACE VIEW analytics.v_recruiting_pipeline AS
SELECT r.id AS requisition_id,
    r.tenant_id,
    r.title AS job_title,
    r.department,
    r.location,
    r.employment_type,
    r.status AS req_status,
    r.priority,
    r.target_hire_date,
    r.created_at AS req_created_at,
    r.hiring_manager_id,
    (hm.first_name::text || ' '::text) || hm.last_name::text AS hiring_manager_name,
    count(c.id) AS total_candidates,
    count(c.id) FILTER (WHERE c.stage::text = 'applied'::text OR c.stage::text = 'new'::text) AS stage_applied,
    count(c.id) FILTER (WHERE c.stage::text = 'screening'::text) AS stage_screening,
    count(c.id) FILTER (WHERE c.stage::text = 'phone_screen'::text) AS stage_phone_screen,
    count(c.id) FILTER (WHERE c.stage::text = 'interview'::text) AS stage_interview,
    count(c.id) FILTER (WHERE c.stage::text = 'final_interview'::text) AS stage_final_interview,
    count(c.id) FILTER (WHERE c.stage::text = 'offer'::text) AS stage_offer,
    count(c.id) FILTER (WHERE c.stage::text = 'hired'::text) AS stage_hired,
    count(c.id) FILTER (WHERE c.stage::text = 'rejected'::text) AS stage_rejected,
    count(c.id) FILTER (WHERE c.stage::text = 'withdrawn'::text) AS stage_withdrawn,
    avg(EXTRACT(day FROM c.updated_at - c.created_at)) AS avg_days_in_pipeline,
    min(c.created_at) AS first_application_date,
    max(c.created_at) AS last_application_date,
    round(count(c.id) FILTER (WHERE c.stage::text = 'interview'::text)::numeric / NULLIF(count(c.id) FILTER (WHERE c.stage::text <> ALL (ARRAY['rejected'::character varying::text, 'withdrawn'::character varying::text])), 0)::numeric * 100::numeric, 2) AS screen_to_interview_rate,
    round(count(c.id) FILTER (WHERE c.stage::text = 'hired'::text)::numeric / NULLIF(count(c.id), 0)::numeric * 100::numeric, 2) AS overall_conversion_rate
   FROM recruiting_requisitions r
     LEFT JOIN employees hm ON hm.id = r.hiring_manager_id
     LEFT JOIN recruiting_candidates c ON c.requisition_id = r.id
  GROUP BY r.id, r.tenant_id, r.title, r.department, r.location, r.employment_type, r.status, r.priority, r.target_hire_date, r.created_at, r.hiring_manager_id, hm.first_name, hm.last_name;


CREATE OR REPLACE VIEW analytics.v_total_rewards_statement AS
SELECT e.id AS employee_id,
    e.tenant_id,
    e.pernr AS employee_number,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    e.department,
    e.location,
    e.hire_date,
    e.salary AS base_salary,
    e.currency AS salary_currency,
    sb.id AS salary_band_id,
    sb.band_name,
    sb.job_level AS band_level,
    sb.min_salary AS band_min,
    sb.mid_salary AS band_mid,
    sb.max_salary AS band_max,
    sba.compa_ratio,
    sba.range_penetration,
        CASE
            WHEN sba.compa_ratio IS NULL THEN 'Not Assigned'::text
            WHEN sba.compa_ratio < 0.80 THEN 'Below Market'::text
            WHEN sba.compa_ratio >= 0.80 AND sba.compa_ratio <= 0.95 THEN 'Approaching Market'::text
            WHEN sba.compa_ratio >= 0.95 AND sba.compa_ratio <= 1.05 THEN 'At Market'::text
            WHEN sba.compa_ratio >= 1.05 AND sba.compa_ratio <= 1.20 THEN 'Above Market'::text
            WHEN sba.compa_ratio > 1.20 THEN 'Premium'::text
            ELSE 'Unknown'::text
        END AS market_position,
        CASE
            WHEN sb.id IS NULL THEN 'No Band Assigned'::text
            WHEN e.salary < sb.min_salary THEN 'Below Minimum'::text
            WHEN e.salary >= sb.min_salary AND e.salary <= sb.mid_salary THEN 'Lower Half'::text
            WHEN e.salary >= sb.mid_salary AND e.salary <= sb.max_salary THEN 'Upper Half'::text
            WHEN e.salary > sb.max_salary THEN 'Above Maximum'::text
            ELSE 'Unknown'::text
        END AS band_position,
    round(e.salary / NULLIF(( SELECT avg(employees.salary) AS avg
           FROM employees
          WHERE employees.department::text = e.department::text AND employees.tenant_id = e.tenant_id AND (employees.employment_status::text = 'active'::text OR employees.is_active = true)), 0::numeric), 3) AS dept_salary_ratio,
    ( SELECT sum(ba.actual_amount) AS sum
           FROM bonus_allocations ba
          WHERE ba.employee_id = e.id AND ba.created_at > (CURRENT_DATE - '1 year'::interval)) AS bonus_last_year,
    e.salary + COALESCE(( SELECT sum(ba.actual_amount) AS sum
           FROM bonus_allocations ba
          WHERE ba.employee_id = e.id AND ba.created_at > (CURRENT_DATE - '1 year'::interval)), 0::numeric) AS total_cash_compensation,
    sba.assigned_at AS band_assigned_at,
    e.updated_at AS last_updated
   FROM employees e
     LEFT JOIN salary_band_assignments sba ON sba.employee_id = e.id
     LEFT JOIN salary_bands sb ON sb.id = sba.band_id
  WHERE e.employment_status::text = 'active'::text OR e.is_active = true;


CREATE OR REPLACE VIEW analytics.v_workforce_planning_dashboard AS
SELECT t.id AS tenant_id,
    t.name AS tenant_name,
    t.industry_type,
    count(DISTINCT e.id) AS total_headcount,
    count(DISTINCT e.id) FILTER (WHERE e.employment_status::text = 'active'::text OR e.is_active = true) AS active_employees,
    count(DISTINCT e.id) FILTER (WHERE e.hire_date > (CURRENT_DATE - '30 days'::interval)) AS new_hires_30d,
    count(DISTINCT e.id) FILTER (WHERE e.hire_date > (CURRENT_DATE - '90 days'::interval)) AS new_hires_90d,
    count(DISTINCT e.id) FILTER (WHERE e.termination_date > (CURRENT_DATE - '30 days'::interval)) AS terminations_30d,
    count(DISTINCT e.id) FILTER (WHERE e.termination_date > (CURRENT_DATE - '90 days'::interval)) AS terminations_90d,
    round(count(DISTINCT e.id) FILTER (WHERE e.termination_date > (CURRENT_DATE - '1 year'::interval))::numeric / NULLIF(count(DISTINCT e.id), 0)::numeric * 100::numeric, 2) AS turnover_rate_annual,
    count(DISTINCT e.id) FILTER (WHERE e.hire_date > (CURRENT_DATE - '90 days'::interval)) - count(DISTINCT e.id) FILTER (WHERE e.termination_date > (CURRENT_DATE - '90 days'::interval)) AS net_change_90d,
    ( SELECT count(*) AS count
           FROM critical_roles cr
          WHERE cr.tenant_id = t.id) AS critical_roles_count,
    ( SELECT count(*) AS count
           FROM critical_roles cr
          WHERE cr.tenant_id = t.id AND (EXISTS ( SELECT 1
                   FROM succession_candidates sc
                  WHERE sc.critical_role_id = cr.id AND sc.readiness_level::text = 'ready_now'::text))) AS roles_with_ready_successor,
    count(DISTINCT e.id) FILTER (WHERE fr.risk_level = 'high'::text) AS high_flight_risk_count,
    count(DISTINCT e.id) FILTER (WHERE fr.risk_level = 'medium'::text) AS medium_flight_risk_count,
    count(DISTINCT e.id) FILTER (WHERE nb.box_label = ANY (ARRAY['Star'::text, 'High Performer'::text, 'Future Star'::text])) AS top_talent_count,
    count(DISTINCT e.id) FILTER (WHERE nb.box_label = ANY (ARRAY['Core Player'::text, 'Solid Performer'::text])) AS solid_performers_count,
    count(DISTINCT e.id) FILTER (WHERE nb.box_label = ANY (ARRAY['Underperformer'::text, 'Bad Hire'::text, 'Talent Risk'::text])) AS needs_action_count,
    round(avg(EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone))), 2) AS avg_tenure_years,
    count(DISTINCT e.id) FILTER (WHERE EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone)) < 1::numeric) AS tenure_under_1y,
    count(DISTINCT e.id) FILTER (WHERE EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone)) >= 1::numeric AND EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone)) <= 3::numeric) AS tenure_1_3y,
    count(DISTINCT e.id) FILTER (WHERE EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone)) >= 3::numeric AND EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone)) <= 5::numeric) AS tenure_3_5y,
    count(DISTINCT e.id) FILTER (WHERE EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.hire_date::timestamp with time zone)) > 5::numeric) AS tenure_over_5y,
    round(avg(mgr_span.span), 2) AS avg_span_of_control,
    max(mgr_span.span) AS max_span_of_control
   FROM tenants t
     LEFT JOIN employees e ON e.tenant_id = t.id
     LEFT JOIN v_flight_risk_features fr ON fr.employee_id = e.id
     LEFT JOIN v_nine_box_grid nb ON nb.employee_id = e.id
     LEFT JOIN ( SELECT employees.manager_id,
            count(*) AS span
           FROM employees
          WHERE employees.manager_id IS NOT NULL AND (employees.employment_status::text = 'active'::text OR employees.is_active = true)
          GROUP BY employees.manager_id) mgr_span ON mgr_span.manager_id = e.id
  GROUP BY t.id, t.name, t.industry_type;


CREATE OR REPLACE VIEW learning.v_course_popularity AS
SELECT c.id AS course_id,
    c.tenant_id,
    c.title,
    c.category,
    c.provider,
    count(DISTINCT en.id) AS total_enrollments,
    count(DISTINCT en.id) FILTER (WHERE en.status::text = 'completed'::text) AS completions,
    round(avg(en.progress), 1) AS avg_progress,
    round(
        CASE
            WHEN count(DISTINCT en.id) > 0 THEN count(DISTINCT en.id) FILTER (WHERE en.status::text = 'completed'::text)::numeric / count(DISTINCT en.id)::numeric * 100::numeric
            ELSE 0::numeric
        END, 1) AS completion_rate
   FROM learning.courses c
     LEFT JOIN learning.enrollments en ON c.id = en.course_id
  GROUP BY c.id, c.tenant_id, c.title, c.category, c.provider;


CREATE OR REPLACE VIEW learning.v_employee_learning_summary AS
SELECT e.id AS employee_id,
    e.tenant_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    count(DISTINCT en.id) FILTER (WHERE en.status::text = 'completed'::text) AS completed_courses,
    count(DISTINCT en.id) FILTER (WHERE en.status::text = 'in-progress'::text) AS in_progress_courses,
    count(DISTINCT en.id) FILTER (WHERE en.status::text = 'not-started'::text) AS not_started_courses,
    COALESCE(sum(c.duration_hours) FILTER (WHERE en.status::text = 'completed'::text), 0::numeric) AS total_learning_hours,
    count(DISTINCT cert.id) AS total_certificates,
    count(DISTINCT sg.id) AS skill_gaps_count
   FROM employees e
     LEFT JOIN learning.enrollments en ON e.id = en.employee_id
     LEFT JOIN learning.courses c ON en.course_id = c.id
     LEFT JOIN learning.certificates cert ON e.id = cert.employee_id
     LEFT JOIN learning.skill_gaps sg ON e.id = sg.employee_id
  GROUP BY e.id, e.tenant_id, e.first_name, e.last_name;


CREATE OR REPLACE VIEW learning.v_skill_gap_analysis AS
SELECT sg.employee_id,
    e.tenant_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    sg.skill,
    sg.current_level,
    sg.target_level,
    sg.target_level - sg.current_level AS gap_size,
    sg.priority,
    array_agg(DISTINCT c.id) FILTER (WHERE sg.skill::text = ANY (c.skills)) AS recommended_course_ids
   FROM learning.skill_gaps sg
     JOIN employees e ON sg.employee_id = e.id
     LEFT JOIN learning.courses c ON (sg.skill::text = ANY (c.skills)) AND c.tenant_id = e.tenant_id
  GROUP BY sg.employee_id, e.tenant_id, e.first_name, e.last_name, sg.skill, sg.current_level, sg.target_level, sg.priority;


CREATE OR REPLACE VIEW public.branches AS
SELECT id,
    tenant_id,
    name,
    code,
    address,
    city,
    country,
        CASE
            WHEN location_type::text = 'headquarters'::text THEN true
            ELSE false
        END AS is_headquarters,
    sap_werks,
    sap_btrtl AS sap_bukrs,
    sap_name1 AS sap_butxt,
    sap_land1,
    sap_ort01,
    sap_sync_date,
    created_at,
    updated_at
   FROM locations;


CREATE OR REPLACE VIEW public.error_stats AS
SELECT date_trunc('day'::text, created_at) AS date,
    tenant_id,
    category,
    severity,
    count(*) AS error_count,
    count(DISTINCT code) AS unique_codes,
    count(DISTINCT user_id) AS affected_users
   FROM error_logs
  WHERE created_at >= (now() - '30 days'::interval)
  GROUP BY (date_trunc('day'::text, created_at)), tenant_id, category, severity;


CREATE OR REPLACE VIEW public.recent_errors AS
SELECT el.id,
    el.error_id,
    el.code,
    el.category,
    el.severity,
    el.message,
    el.http_status,
    el.request_method,
    el.request_path,
    el.tenant_id,
    t.name AS tenant_name,
    el.user_id,
    u.username,
    el.created_at
   FROM error_logs el
     LEFT JOIN tenants t ON el.tenant_id = t.id
     LEFT JOIN users u ON el.user_id = u.id
  WHERE el.created_at >= (now() - '24:00:00'::interval)
  ORDER BY el.created_at DESC;


CREATE OR REPLACE VIEW public.v_360_feedback_summary AS
SELECT f.tenant_id,
    f.target_employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    f.review_cycle_id,
    rc.name AS cycle_name,
    f.relationship_type,
    count(*) AS response_count,
    round(avg(f.overall_rating), 2) AS avg_rating,
    round(stddev(f.overall_rating), 2) AS rating_stddev,
    round(avg(f.sentiment_score), 2) AS avg_sentiment,
        CASE
            WHEN count(*) >= COALESCE(rc.feedback_360_min_responses, 3) THEN jsonb_build_object('min_rating', min(f.overall_rating), 'max_rating', max(f.overall_rating), 'median_rating', percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (f.overall_rating::double precision)))
            ELSE NULL::jsonb
        END AS rating_distribution
   FROM feedback_360 f
     JOIN employees e ON f.target_employee_id = e.id
     LEFT JOIN review_cycles rc ON f.review_cycle_id = rc.id
  WHERE f.status::text = 'completed'::text
  GROUP BY f.tenant_id, f.target_employee_id, e.first_name, e.last_name, f.review_cycle_id, rc.name, f.relationship_type, rc.feedback_360_min_responses;


CREATE OR REPLACE VIEW public.v_360_response_rates AS
SELECT rc.id AS review_cycle_id,
    rc.tenant_id,
    rc.name AS cycle_name,
    count(DISTINCT fr.id) AS total_requests,
    count(DISTINCT
        CASE
            WHEN fr.status::text = 'completed'::text THEN fr.id
            ELSE NULL::uuid
        END) AS completed_requests,
    round(count(DISTINCT
        CASE
            WHEN fr.status::text = 'completed'::text THEN fr.id
            ELSE NULL::uuid
        END)::numeric / NULLIF(count(DISTINCT fr.id), 0)::numeric * 100::numeric, 2) AS response_rate,
    count(DISTINCT fr.requestee_id) AS total_employees,
    count(DISTINCT
        CASE
            WHEN fr.status::text = 'pending'::text THEN fr.reviewer_id
            ELSE NULL::uuid
        END) AS pending_reviewers,
    avg(
        CASE
            WHEN f.id IS NOT NULL THEN f.overall_rating
            ELSE NULL::numeric
        END) AS avg_rating
   FROM review_cycles rc
     LEFT JOIN feedback_requests fr ON rc.id = fr.review_cycle_id
     LEFT JOIN feedback_360 f ON fr.feedback_360_id = f.id
  WHERE rc.include_360_feedback = true
  GROUP BY rc.id, rc.tenant_id, rc.name;


CREATE OR REPLACE VIEW public.v_active_job_postings AS
SELECT j.id,
    j.tenant_id,
    j.title,
    j.department,
    j.team,
    j.location,
    j.work_type,
    j.summary,
    j.responsibilities,
    j.requirements,
    j.nice_to_have,
    j.job_level,
    j.job_family,
    j.salary_min,
    j.salary_max,
    j.currency,
    j.show_salary,
    j.status,
    j.visibility,
    j.min_tenure_months,
    j.min_rating,
    j.required_skills,
    j.posted_at,
    j.expires_at,
    j.target_start_date,
    j.hiring_manager_id,
    j.hr_contact_id,
    j.views_count,
    j.applications_count,
    j.created_by,
    j.created_at,
    j.updated_at,
    COALESCE(a.app_count, 0::bigint) AS application_count,
    COALESCE(v.view_count, 0::bigint) AS view_count,
    (hm.first_name::text || ' '::text) || hm.last_name::text AS hiring_manager_name,
    (hr.first_name::text || ' '::text) || hr.last_name::text AS hr_contact_name
   FROM internal_job_postings j
     LEFT JOIN ( SELECT internal_applications.job_posting_id,
            count(*) AS app_count
           FROM internal_applications
          WHERE internal_applications.status::text <> ALL (ARRAY['draft'::character varying::text, 'withdrawn'::character varying::text])
          GROUP BY internal_applications.job_posting_id) a ON j.id = a.job_posting_id
     LEFT JOIN ( SELECT internal_job_views.job_posting_id,
            count(*) AS view_count
           FROM internal_job_views
          GROUP BY internal_job_views.job_posting_id) v ON j.id = v.job_posting_id
     LEFT JOIN employees hm ON j.hiring_manager_id = hm.id
     LEFT JOIN employees hr ON j.hr_contact_id = hr.id
  WHERE j.status::text = 'open'::text AND (j.expires_at IS NULL OR j.expires_at > now());


CREATE OR REPLACE VIEW public.v_ai_daily_costs AS
SELECT date(created_at) AS date,
    provider,
    model,
    operation,
    count(*) AS request_count,
    sum(total_tokens) AS total_tokens,
    sum(cost) AS total_cost,
    avg(latency_ms) AS avg_latency_ms,
    sum(
        CASE
            WHEN success THEN 1
            ELSE 0
        END) AS success_count,
    sum(
        CASE
            WHEN NOT success THEN 1
            ELSE 0
        END) AS error_count
   FROM ai_usage_log
  GROUP BY (date(created_at)), provider, model, operation
  ORDER BY (date(created_at)) DESC, provider, model;


CREATE OR REPLACE VIEW public.v_ai_monthly_costs AS
SELECT date_trunc('month'::text, created_at) AS month,
    provider,
    count(*) AS request_count,
    sum(total_tokens) AS total_tokens,
    sum(cost) AS total_cost,
    avg(latency_ms) AS avg_latency_ms,
    round(sum(
        CASE
            WHEN success THEN 1
            ELSE 0
        END)::numeric / count(*)::numeric * 100::numeric, 2) AS success_rate
   FROM ai_usage_log
  GROUP BY (date_trunc('month'::text, created_at)), provider
  ORDER BY (date_trunc('month'::text, created_at)) DESC, provider;


CREATE OR REPLACE VIEW public.v_ai_tenant_costs AS
SELECT t.code AS tenant_code,
    t.name AS tenant_name,
    aul.provider,
    count(*) AS request_count,
    sum(aul.total_tokens) AS total_tokens,
    sum(aul.cost) AS total_cost
   FROM ai_usage_log aul
     JOIN tenants t ON t.id = aul.tenant_id
  GROUP BY t.id, t.code, t.name, aul.provider
  ORDER BY (sum(aul.cost)) DESC;


CREATE OR REPLACE VIEW public.v_applicant_pipeline AS
SELECT pb.aplnr,
    (pb.nachn::text || ', '::text) || pb.vorna::text AS applicant_name,
    pb.email,
    pb.source_channel,
    pa.stat2 AS status,
    va.vacancy_id,
    va.assignment_status,
    va.position_id,
    count(DISTINCT act.activity_id) AS activities_count,
    max(act.activity_date) AS last_activity_date,
    ev.overall_score AS latest_score,
    ev.recommendation
   FROM pb0002 pb
     LEFT JOIN pb0001 pa ON pb.aplnr::text = pa.aplnr::text AND pa.endda = '9999-12-31'::date
     LEFT JOIN pb4001 va ON pb.aplnr::text = va.aplnr::text AND va.endda = '9999-12-31'::date
     LEFT JOIN pb4000 act ON pb.aplnr::text = act.aplnr::text
     LEFT JOIN ( SELECT DISTINCT ON (pb4005.aplnr) pb4005.id,
            pb4005.aplnr,
            pb4005.vacancy_id,
            pb4005.evaluation_id,
            pb4005.evaluation_date,
            pb4005.evaluator_pernr,
            pb4005.evaluation_type,
            pb4005.technical_score,
            pb4005.communication_score,
            pb4005.cultural_fit_score,
            pb4005.experience_score,
            pb4005.overall_score,
            pb4005.recommendation,
            pb4005.comments,
            pb4005.created_at
           FROM pb4005
          ORDER BY pb4005.aplnr, pb4005.evaluation_date DESC) ev ON pb.aplnr::text = ev.aplnr::text
  WHERE pb.endda = '9999-12-31'::date
  GROUP BY pb.aplnr, pb.nachn, pb.vorna, pb.email, pb.source_channel, pa.stat2, va.vacancy_id, va.assignment_status, va.position_id, ev.overall_score, ev.recommendation
  ORDER BY pb.aplnr;


CREATE OR REPLACE VIEW public.v_employee_master AS
SELECT p0002.pernr,
    p0002.vorna AS first_name,
    p0002.nachn AS last_name,
    p0002.midnm AS middle_name,
    p0002.gbdat AS birth_date,
    p0002.natio AS nationality,
        CASE p0002.gesch
            WHEN '1'::text THEN 'Male'::text
            WHEN '2'::text THEN 'Female'::text
            ELSE 'Other'::text
        END AS gender,
    p0000.stat2 AS status,
    p0000.begda AS hire_date,
    p0001.bukrs AS company_code,
    p0001.werks AS personnel_area,
    p0001.orgeh AS org_unit,
    p0001.plans AS "position",
    p0001.stell AS job,
    p0001.kostl AS cost_center,
    p0008.ansal AS annual_salary,
    p0008.waession AS currency,
    p0008.bession AS employment_pct,
    p0007.wession AS weekly_hours,
    p0016.cttyp AS contract_type,
    p0016.probation_end,
    p0016.termination_date,
    email.usrid_long AS email,
    phone.usrid_long AS phone
   FROM pa0002 p0002
     LEFT JOIN pa0000 p0000 ON p0002.pernr::text = p0000.pernr::text AND p0000.endda = '9999-12-31'::date
     LEFT JOIN pa0001 p0001 ON p0002.pernr::text = p0001.pernr::text AND p0001.endda = '9999-12-31'::date
     LEFT JOIN pa0008 p0008 ON p0002.pernr::text = p0008.pernr::text AND p0008.endda = '9999-12-31'::date
     LEFT JOIN pa0007 p0007 ON p0002.pernr::text = p0007.pernr::text AND p0007.endda = '9999-12-31'::date
     LEFT JOIN pa0016 p0016 ON p0002.pernr::text = p0016.pernr::text AND p0016.endda = '9999-12-31'::date
     LEFT JOIN pa0105 email ON p0002.pernr::text = email.pernr::text AND email.subty::text = '0010'::text AND email.endda = '9999-12-31'::date
     LEFT JOIN pa0105 phone ON p0002.pernr::text = phone.pernr::text AND phone.subty::text = '0020'::text AND phone.endda = '9999-12-31'::date
  WHERE p0002.endda = '9999-12-31'::date;


CREATE OR REPLACE VIEW public.v_appraisal_status AS
SELECT e.pernr,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.company_code,
    a.subty AS appraisal_type,
    a.appraisal_id,
    a.bession AS overall_rating,
    a.potential_rating,
    a.appraisal_date,
    a.status,
        CASE a.status
            WHEN '01'::text THEN 'Draft'::text
            WHEN '02'::text THEN 'Submitted'::text
            WHEN '03'::text THEN 'Approved'::text
            ELSE 'Unknown'::text
        END AS status_text
   FROM v_employee_master e
     LEFT JOIN pa0025 a ON e.pernr::text = a.pernr::text AND a.begda >= date_trunc('year'::text, CURRENT_DATE::timestamp with time zone) AND a.endda = '9999-12-31'::date
  ORDER BY e.company_code, e.pernr;


CREATE OR REPLACE VIEW public.v_attendance_summary AS
SELECT e.pernr,
    e.company_code,
    (e.first_name::text || ' '::text) || e.last_name::text AS full_name,
    date_trunc('month'::text, a.begda::timestamp with time zone) AS month,
    sum(
        CASE
            WHEN a.subty::text ~~ '01%'::text THEN a.abwtg
            ELSE 0::numeric
        END) AS vacation_days,
    sum(
        CASE
            WHEN a.subty::text ~~ '02%'::text THEN a.abwtg
            ELSE 0::numeric
        END) AS sick_days,
    sum(
        CASE
            WHEN a.subty::text ~~ '03%'::text THEN a.abwtg
            ELSE 0::numeric
        END) AS personal_days,
    sum(a.abwtg) AS total_absence_days,
    sum(a.stdaz) AS total_absence_hours
   FROM v_employee_master e
     LEFT JOIN pa2001 a ON e.pernr::text = a.pernr::text
  WHERE a.begda >= date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)
  GROUP BY e.pernr, e.company_code, e.first_name, e.last_name, (date_trunc('month'::text, a.begda::timestamp with time zone))
  ORDER BY e.pernr, (date_trunc('month'::text, a.begda::timestamp with time zone));


CREATE OR REPLACE VIEW public.v_benefits_enrollment AS
SELECT e.pernr,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.company_code,
    'Health'::text AS benefit_category,
    h.bession AS plan_id,
    bp.plan_name,
    h.bession_option AS coverage,
    h.ee_contribution,
    h.er_contribution,
    h.begda AS effective_date
   FROM v_employee_master e
     JOIN pa0167 h ON e.pernr::text = h.pernr::text AND h.endda = '9999-12-31'::date
     LEFT JOIN t5ubp bp ON h.bession::text = bp.bession::text AND bp.endda = '9999-12-31'::date
UNION ALL
 SELECT e.pernr,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.company_code,
    'Savings'::text AS benefit_category,
    s.bession AS plan_id,
    bp.plan_name,
    s.ee_contribution_pct::character varying::text || '%'::text AS coverage,
    s.ee_contribution_amt AS ee_contribution,
    s.er_match_pct AS er_contribution,
    s.begda AS effective_date
   FROM v_employee_master e
     JOIN pa0169 s ON e.pernr::text = s.pernr::text AND s.endda = '9999-12-31'::date
     LEFT JOIN t5ubp bp ON s.bession::text = bp.bession::text AND bp.endda = '9999-12-31'::date
  ORDER BY 1, 4;


CREATE OR REPLACE VIEW public.v_calibration_9box AS
SELECT ca.tenant_id,
    ca.calibration_session_id,
    ca.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    d.name AS department_name,
    ca.original_rating,
    ca.adjusted_rating,
    COALESCE(ca.adjusted_rating, ca.original_rating) AS final_rating,
        CASE
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4::numeric THEN 'high'::text
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3::numeric THEN 'medium'::text
            ELSE 'low'::text
        END AS performance_bucket,
        CASE
            WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 'high'::text
            WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 'medium'::text
            ELSE 'low'::text
        END AS potential_bucket,
        CASE
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4::numeric AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 9
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4::numeric AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 6
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4::numeric THEN 3
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3::numeric AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 8
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3::numeric AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 5
            WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3::numeric THEN 2
            WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 7
            WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 4
            ELSE 1
        END AS box_position,
    ca.outlier_flag,
    ca.outlier_reason
   FROM calibration_adjustments ca
     JOIN employees e ON ca.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN performance_predictions pp ON ca.employee_id = pp.employee_id AND pp.is_current = true;


CREATE OR REPLACE VIEW public.v_calibration_bell_curve AS
SELECT tenant_id,
    calibration_session_id,
    COALESCE(adjusted_rating, original_rating) AS rating,
    count(*) AS count,
    count(*)::numeric / NULLIF(sum(count(*)) OVER (PARTITION BY calibration_session_id), 0::numeric) * 100::numeric AS percentage,
        CASE
            WHEN COALESCE(adjusted_rating, original_rating) <= 1::numeric THEN 5
            WHEN COALESCE(adjusted_rating, original_rating) <= 2::numeric THEN 10
            WHEN COALESCE(adjusted_rating, original_rating) <= 3::numeric THEN 35
            WHEN COALESCE(adjusted_rating, original_rating) <= 4::numeric THEN 35
            ELSE 15
        END AS expected_percentage
   FROM calibration_adjustments ca
  WHERE COALESCE(adjusted_rating, original_rating) IS NOT NULL
  GROUP BY tenant_id, calibration_session_id, (COALESCE(adjusted_rating, original_rating));


CREATE OR REPLACE VIEW public.v_candidate_detail_cluster AS
SELECT candidate_id,
    tenant_id,
    requisition_id,
    job_title,
    first_name,
    last_name,
    full_name,
    email,
    phone,
    source,
    current_stage,
    rating,
    resume_url,
    linkedin_url,
    notes,
    applied_at,
    last_updated,
    days_in_current_stage,
    total_days_in_pipeline,
    stage_transitions
   FROM analytics.v_candidate_detail;


CREATE OR REPLACE VIEW public.v_candidate_summary AS
SELECT candidate_id,
    tenant_id,
    requisition_id,
    job_title,
    first_name,
    last_name,
    full_name,
    email,
    phone,
    source,
    current_stage,
    rating,
    resume_url,
    linkedin_url,
    notes,
    applied_at,
    last_updated,
    days_in_current_stage,
    total_days_in_pipeline,
    stage_transitions,
    last_transition
   FROM analytics.v_candidate_summary;


CREATE OR REPLACE VIEW public.v_career_level_requirements AS
SELECT cpl.id AS level_id,
    cpl.title AS level_title,
    cpl.level_order,
    cp.id AS path_id,
    cp.name AS path_name,
    count(cls.id) AS total_skills_required,
    count(cls.id) FILTER (WHERE cls.is_mandatory) AS mandatory_skills,
    count(cls.id) FILTER (WHERE cls.importance = 'critical'::career_skill_importance) AS critical_skills,
    avg(cls.min_composite_score) AS avg_required_score,
    cpl.typical_duration_months,
    cp.tenant_id
   FROM career_path_levels cpl
     JOIN career_paths cp ON cpl.path_id = cp.id
     LEFT JOIN career_path_level_skills cls ON cls.level_id = cpl.id
  GROUP BY cpl.id, cpl.title, cpl.level_order, cp.id, cp.name, cpl.typical_duration_months, cp.tenant_id;


CREATE OR REPLACE VIEW public.v_certification_compliance AS
SELECT e.id AS employee_id,
    e.tenant_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    e.department,
    cert.id AS certification_id,
    cert.name AS certification_name,
    cert.issuing_organization,
    ec.credential_id,
    ec.issued_date,
    ec.expiry_date,
    ec.status,
        CASE
            WHEN ec.id IS NULL THEN 'not_obtained'::text
            WHEN ec.status::text = 'expired'::text THEN 'expired'::text
            WHEN ec.expiry_date < CURRENT_DATE THEN 'expired'::text
            WHEN ec.expiry_date < (CURRENT_DATE + '30 days'::interval) THEN 'expiring_30_days'::text
            WHEN ec.expiry_date < (CURRENT_DATE + '90 days'::interval) THEN 'expiring_90_days'::text
            ELSE 'compliant'::text
        END AS compliance_status
   FROM employees e
     CROSS JOIN certifications cert
     LEFT JOIN employee_certifications ec ON ec.employee_id = e.id AND ec.certification_id = cert.id
  WHERE e.is_active = true AND cert.is_active = true AND (cert.tenant_id = e.tenant_id OR cert.tenant_id IS NULL);


CREATE OR REPLACE VIEW public.v_comp_analysis AS
SELECT p0008.pernr,
    (p0002.vorna::text || ' '::text) || p0002.nachn::text AS employee_name,
    p0001.bukrs AS company,
    p0001.orgeh AS org_unit,
    p0001.plans AS "position",
    p0008.trfgr AS pay_grade,
    p0008.ansal AS annual_salary,
    p0008.waession AS currency,
    p0008.bession AS employment_pct,
    hrp.min_salary AS position_min,
    hrp.mid_salary AS position_mid,
    hrp.max_salary AS position_max,
        CASE
            WHEN hrp.mid_salary > 0::numeric THEN round(p0008.ansal / hrp.mid_salary * 100::numeric, 2)
            ELSE NULL::numeric
        END AS compa_ratio
   FROM pa0008 p0008
     LEFT JOIN pa0002 p0002 ON p0008.pernr::text = p0002.pernr::text AND p0002.endda = '9999-12-31'::date
     LEFT JOIN pa0001 p0001 ON p0008.pernr::text = p0001.pernr::text AND p0001.endda = '9999-12-31'::date
     LEFT JOIN hrp1005 hrp ON p0001.plans::text = hrp.objid::text AND hrp.otype::text = 'S'::text AND hrp.endda = '9999-12-31'::date
  WHERE p0008.endda = '9999-12-31'::date;


CREATE OR REPLACE VIEW public.v_compensation_bands AS
SELECT t.id AS tenant_id,
    t.code AS tenant_code,
    e.department,
    e.job_title,
    count(*) AS employee_count,
    round(avg(e.salary), 0) AS avg_salary,
    round(min(e.salary), 0) AS min_salary,
    round(max(e.salary), 0) AS max_salary,
    percentile_cont(0.25::double precision) WITHIN GROUP (ORDER BY (e.salary::double precision)) AS p25_salary,
    percentile_cont(0.50::double precision) WITHIN GROUP (ORDER BY (e.salary::double precision)) AS median_salary,
    percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (e.salary::double precision)) AS p75_salary,
    round(sum(e.salary), 0) AS total_compensation
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
  WHERE e.is_active = true AND e.salary IS NOT NULL
  GROUP BY t.id, t.code, e.department, e.job_title;


CREATE OR REPLACE VIEW public.v_unique_sap_employee AS
WITH ranked_employees AS (
         SELECT p1.pernr,
            p1.bukrs,
            comm.usrid_long AS email,
            row_number() OVER (PARTITION BY comm.usrid_long ORDER BY (
                CASE
                    WHEN p1.pernr::text ~ '^[0-9]+$'::text THEN 0
                    ELSE 1
                END), p1.pernr) AS rn
           FROM pa0001 p1
             JOIN pa0105 comm ON comm.pernr::text = p1.pernr::text AND comm.subty::text = '0010'::text AND comm.endda >= CURRENT_DATE
          WHERE p1.endda >= CURRENT_DATE
        )
 SELECT pernr,
    bukrs,
    email
   FROM ranked_employees
  WHERE rn = 1;


CREATE OR REPLACE VIEW public.v_compensation_by_department AS
SELECT ue.bukrs AS sap_company_code,
    p1.orgeh AS org_unit,
    hrp.tline AS org_unit_name,
    count(*) AS employee_count,
    round(avg(p8.ansal), 2) AS avg_salary,
    round(min(p8.ansal), 2) AS min_salary,
    round(max(p8.ansal), 2) AS max_salary,
    sum(p8.ansal) AS total_payroll,
    p8.waession AS currency
   FROM v_unique_sap_employee ue
     JOIN pa0001 p1 ON p1.pernr::text = ue.pernr::text AND p1.endda >= CURRENT_DATE
     JOIN pa0008 p8 ON p8.pernr::text = ue.pernr::text AND p8.endda >= CURRENT_DATE AND p8.ansal > 0::numeric
     LEFT JOIN hrp1002 hrp ON hrp.objid::text = p1.orgeh::text AND hrp.otype::text = 'O'::text AND hrp.endda >= CURRENT_DATE
  GROUP BY ue.bukrs, p1.orgeh, hrp.tline, p8.waession
  ORDER BY ue.bukrs, (sum(p8.ansal)) DESC;


CREATE OR REPLACE VIEW public.v_compliance_dashboard_cluster AS
SELECT tenant_id,
    tenant_name,
    total_dsr_requests,
    pending_dsr_requests,
    completed_dsr_requests,
    pending_time_requests,
    total_whistleblowing,
    open_whistleblowing,
    resolved_whistleblowing,
    audit_entries_7d,
    audit_entries_30d,
    active_users_7d,
    compliance_score
   FROM analytics.v_compliance_dashboard;


CREATE OR REPLACE VIEW public.v_compliance_summary AS
SELECT 'VIEWS'::text AS category,
    v.data_source,
    count(*) AS count,
    string_agg(v.viewname::text, ', '::text ORDER BY (v.viewname::text)) AS items
   FROM ( SELECT pg_views.viewname,
                CASE
                    WHEN pg_views.definition ~~* '%pa0%'::text OR pg_views.definition ~~* '%hrp%'::text OR pg_views.definition ~~* '%pb0%'::text THEN 'SAP_BASED'::text
                    ELSE 'HEURESYS_BASED'::text
                END AS data_source
           FROM pg_views
          WHERE pg_views.schemaname = 'public'::name AND pg_views.viewname ~~ 'v_%'::text) v
  GROUP BY v.data_source
UNION ALL
 SELECT 'TABLES'::text AS category,
    table_usage_rules.table_category AS data_source,
    count(*) AS count,
    string_agg(table_usage_rules.table_name::text, ', '::text ORDER BY (table_usage_rules.table_name::text)) AS items
   FROM table_usage_rules
  GROUP BY table_usage_rules.table_category;


CREATE OR REPLACE VIEW public.v_course_analytics AS
SELECT NULL::uuid AS course_id,
    NULL::uuid AS tenant_id,
    NULL::character varying(50) AS code,
    NULL::character varying(255) AS title,
    NULL::character varying(50) AS course_type,
    NULL::character varying(100) AS category,
    NULL::character varying(20) AS skill_level,
    NULL::character varying(100) AS provider,
    NULL::numeric(6,2) AS duration_hours,
    NULL::character varying(20) AS status,
    NULL::bigint AS total_enrollments,
    NULL::bigint AS completions,
    NULL::bigint AS in_progress,
    NULL::bigint AS dropped,
    NULL::numeric AS completion_rate,
    NULL::numeric AS avg_score,
    NULL::numeric AS avg_time_minutes,
    NULL::numeric AS avg_rating,
    NULL::bigint AS rating_count,
    NULL::character varying[] AS esco_skills;


CREATE OR REPLACE VIEW public.v_data_integrity_check AS
SELECT 'users_without_employees'::text AS check_type,
    count(*) AS count,
        CASE
            WHEN count(*) = 0 THEN 'OK'::text
            ELSE 'WARNING: Users without employee link'::text
        END AS status
   FROM users u
  WHERE u.employee_id IS NULL
UNION ALL
 SELECT 'tenant_employee_mismatch'::text AS check_type,
    count(*) AS count,
        CASE
            WHEN count(*) = 0 THEN 'OK'::text
            ELSE 'ERROR: Tenant-employee mismatch'::text
        END AS status
   FROM employees e
     JOIN tenants t ON e.tenant_id = t.id
     LEFT JOIN pa0001 p1 ON e.pernr::text = p1.pernr::text AND p1.endda >= CURRENT_DATE
  WHERE t.sap_company_code IS NOT NULL AND p1.bukrs IS NOT NULL AND t.sap_company_code::text <> p1.bukrs::text
UNION ALL
 SELECT 'duplicate_pernr_in_tenant'::text AS check_type,
    count(*) AS count,
        CASE
            WHEN count(*) = 0 THEN 'OK'::text
            ELSE 'ERROR: Duplicate pernr in tenant'::text
        END AS status
   FROM ( SELECT employees.pernr,
            employees.tenant_id,
            count(*) AS cnt
           FROM employees
          WHERE employees.pernr IS NOT NULL
          GROUP BY employees.pernr, employees.tenant_id
         HAVING count(*) > 1) dup;


CREATE OR REPLACE VIEW public.v_dei_demographics AS
SELECT t.id AS tenant_id,
    t.code AS tenant_code,
    t.code AS sap_company_code,
    count(*) AS total_employees,
    sum(
        CASE
            WHEN e.gender::text = 'M'::text THEN 1
            ELSE 0
        END) AS male_count,
    sum(
        CASE
            WHEN e.gender::text = 'F'::text THEN 1
            ELSE 0
        END) AS female_count,
    sum(
        CASE
            WHEN (e.gender::text <> ALL (ARRAY['M'::character varying::text, 'F'::character varying::text])) OR e.gender IS NULL THEN 1
            ELSE 0
        END) AS other_gender_count,
    round(100.0 * sum(
        CASE
            WHEN e.gender::text = 'F'::text THEN 1
            ELSE 0
        END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS female_percentage,
    sum(
        CASE
            WHEN EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) < 30::numeric THEN 1
            ELSE 0
        END) AS age_under_30,
    sum(
        CASE
            WHEN EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) >= 30::numeric AND EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) <= 39::numeric THEN 1
            ELSE 0
        END) AS age_30_39,
    sum(
        CASE
            WHEN EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) >= 40::numeric AND EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) <= 49::numeric THEN 1
            ELSE 0
        END) AS age_40_49,
    sum(
        CASE
            WHEN EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) >= 50::numeric AND EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) <= 59::numeric THEN 1
            ELSE 0
        END) AS age_50_59,
    sum(
        CASE
            WHEN EXTRACT(year FROM age(e.birth_date::timestamp with time zone)) >= 60::numeric THEN 1
            ELSE 0
        END) AS age_60_plus,
    count(DISTINCT e.nationality) AS nationality_count
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
  WHERE e.is_active = true
  GROUP BY t.id, t.code;


CREATE OR REPLACE VIEW public.v_dei_pay_equity AS
SELECT t.id AS tenant_id,
    t.code AS tenant_code,
    t.code AS sap_company_code,
    round(avg(e.salary), 2) AS avg_salary_overall,
    round(avg(
        CASE
            WHEN e.gender::text = 'M'::text THEN e.salary
            ELSE NULL::numeric
        END), 2) AS avg_salary_male,
    round(avg(
        CASE
            WHEN e.gender::text = 'F'::text THEN e.salary
            ELSE NULL::numeric
        END), 2) AS avg_salary_female,
    round(100.0 * (avg(
        CASE
            WHEN e.gender::text = 'F'::text THEN e.salary
            ELSE NULL::numeric
        END) - avg(
        CASE
            WHEN e.gender::text = 'M'::text THEN e.salary
            ELSE NULL::numeric
        END)) / NULLIF(avg(
        CASE
            WHEN e.gender::text = 'M'::text THEN e.salary
            ELSE NULL::numeric
        END), 0::numeric), 2) AS raw_pay_gap_pct,
    min(e.salary) AS min_salary,
    max(e.salary) AS max_salary,
    percentile_cont(0.25::double precision) WITHIN GROUP (ORDER BY (e.salary::double precision)) AS salary_p25,
    percentile_cont(0.50::double precision) WITHIN GROUP (ORDER BY (e.salary::double precision)) AS salary_median,
    percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (e.salary::double precision)) AS salary_p75
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
  WHERE e.is_active = true AND e.salary > 0::numeric
  GROUP BY t.id, t.code;


CREATE OR REPLACE VIEW public.v_embedding_queue_stats AS
SELECT status,
    entity_type,
    count(*) AS count,
    min(created_at) AS oldest,
    max(created_at) AS newest,
    avg(attempts) AS avg_attempts
   FROM embedding_queue
  GROUP BY status, entity_type
  ORDER BY status, entity_type;


CREATE OR REPLACE VIEW public.v_employee_career_overview AS
SELECT ecp.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title AS current_job,
    cp.id AS path_id,
    cp.name AS path_name,
    cp.path_type,
    cpl.id AS current_level_id,
    cpl.title AS current_level,
    cpl.level_order,
    ecp.status AS path_status,
    ecp.started_at,
    prog.overall_fit_score,
    prog.skill_coverage_pct,
    prog.critical_gaps_count,
    prog.estimated_months_to_ready,
    ( SELECT count(*) AS count
           FROM career_path_levels
          WHERE career_path_levels.path_id = cp.id) AS total_levels,
    e.tenant_id
   FROM employee_career_paths ecp
     JOIN employees e ON ecp.employee_id = e.id
     JOIN career_paths cp ON ecp.path_id = cp.id
     LEFT JOIN career_path_levels cpl ON ecp.current_level_id = cpl.id
     LEFT JOIN employee_career_progress prog ON prog.employee_id = ecp.employee_id AND prog.level_id = cpl.id;


CREATE OR REPLACE VIEW public.v_employee_context AS
SELECT e.id AS employee_id,
    e.tenant_id,
    e.first_name,
    e.last_name,
    e.email,
    e.job_title AS original_job_title,
    e.department AS original_department,
    eja.id AS assignment_id,
    eja.assignment_type,
    eja.fte_percentage,
    eja.start_date AS assignment_start,
    tj.id AS job_id,
    tj.job_code,
    tj.title_it AS job_title,
    tj.org_level,
    ol.name_it AS level_name,
    ol.nature AS level_nature,
    tj.is_management,
    tou.id AS org_unit_id,
    tou.code AS org_unit_code,
    tou.name_it AS org_unit_name,
    tou.cost_center,
    oa.code AS area_code,
    oa.name_it AS area_name,
    oa.color AS area_color,
    tou.manager_employee_id,
    (mgr.first_name::text || ' '::text) || mgr.last_name::text AS manager_name,
    tj.esco_occupation_code,
    tj.esco_occupation_uri
   FROM employees e
     LEFT JOIN employee_job_assignments eja ON e.id = eja.employee_id AND eja.is_current = true AND eja.assignment_type::text = 'primary'::text
     LEFT JOIN tenant_jobs tj ON eja.tenant_job_id = tj.id
     LEFT JOIN org_levels ol ON tj.org_level = ol.level
     LEFT JOIN tenant_org_units tou ON tj.tenant_org_unit_id = tou.id
     LEFT JOIN org_areas oa ON tou.area_code::text = oa.code::text
     LEFT JOIN employees mgr ON tou.manager_employee_id = mgr.id
  WHERE e.is_active = true;


CREATE OR REPLACE VIEW public.v_employee_experience_score_cluster AS
SELECT employee_id,
    tenant_id,
    employee_name,
    department,
    job_title,
    hire_date,
    posts_30d,
    recognitions_given_90d,
    recognitions_received_90d,
    clubs_joined,
    checkins_90d,
    feedback_given_90d,
    composite_ex_score,
    ex_category
   FROM analytics.v_employee_experience_score;


CREATE OR REPLACE VIEW public.v_employee_learning_profile AS
SELECT e.id AS employee_id,
    e.tenant_id,
    e.first_name,
    e.last_name,
    e.job_title,
    e.department,
    count(DISTINCT ce.id) AS courses_enrolled,
    count(DISTINCT ce.id) FILTER (WHERE ce.status::text = 'completed'::text) AS courses_completed,
    count(DISTINCT ce.id) FILTER (WHERE ce.status::text = 'in_progress'::text) AS courses_in_progress,
    round(avg(ce.progress_percent), 1) AS avg_progress,
    sum(ce.time_spent_minutes) AS total_learning_minutes,
    round(sum(ce.time_spent_minutes)::numeric / 60.0, 1) AS total_learning_hours,
    count(DISTINCT ec.id) AS certifications_count,
    count(DISTINCT ec.id) FILTER (WHERE ec.status::text = 'active'::text) AS active_certifications,
    count(DISTINCT ec.id) FILTER (WHERE ec.expiry_date < (CURRENT_DATE + '90 days'::interval)) AS expiring_soon,
    count(DISTINCT lr.id) FILTER (WHERE lr.status::text = 'pending'::text) AS pending_recommendations,
    max(ce.completed_at) AS last_completion_date
   FROM employees e
     LEFT JOIN course_enrollments ce ON ce.employee_id = e.id
     LEFT JOIN employee_certifications ec ON ec.employee_id = e.id
     LEFT JOIN learning_recommendations lr ON lr.employee_id = e.id
  WHERE e.is_active = true
  GROUP BY e.id, e.tenant_id, e.first_name, e.last_name, e.job_title, e.department;


CREATE OR REPLACE VIEW public.v_employee_lifecycle_cluster AS
SELECT id,
    tenant_id,
    employee_number,
    first_name,
    last_name,
    full_name,
    email,
    hire_date,
    termination_date,
    termination_reason,
    employment_status,
    job_title,
    department,
    location,
    manager_id,
    manager_name,
    onboarding_instance_id,
    onboarding_status,
    onboarding_progress,
    onboarding_start,
    onboarding_completed,
    tenure_years,
    days_since_hire,
    lifecycle_stage,
    location_name,
    location_city,
    location_country,
    tenant_name,
    created_at,
    updated_at,
        CASE
            WHEN lifecycle_stage = 'ONBOARDING'::text THEN 1
            WHEN lifecycle_stage = 'NEW_HIRE'::text THEN 2
            WHEN lifecycle_stage = 'RAMPING'::text THEN 3
            WHEN lifecycle_stage = 'ESTABLISHED'::text THEN 4
            WHEN lifecycle_stage = 'EXPERIENCED'::text THEN 5
            WHEN lifecycle_stage = 'VETERAN'::text THEN 6
            WHEN lifecycle_stage = 'OFFBOARDED'::text THEN 7
            ELSE 0
        END AS lifecycle_order
   FROM analytics.v_employee_lifecycle v;


CREATE OR REPLACE VIEW public.v_employee_predictions AS
SELECT pp.id,
    pp.tenant_id,
    pp.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    d.name AS department_name,
    pp.prediction_period,
    pp.predicted_rating,
    pp.confidence_interval_low,
    pp.confidence_interval_high,
    pp.risk_score,
    pp.risk_level,
    pp.is_high_potential,
    pp.hipo_score,
    pp.hipo_justification,
    pp.contributing_factors,
    pp.recommended_actions,
    pp.prediction_confidence,
    pp.actual_rating,
    pp.prediction_accuracy,
    pp.model_name,
    pp.model_version,
    pp.created_at,
    pp.validated_at
   FROM performance_predictions pp
     JOIN employees e ON pp.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
  WHERE pp.is_current = true;


CREATE OR REPLACE VIEW public.v_employee_sap_master AS
SELECT m.pernr,
    m.bukrs,
    p2.vorna AS first_name,
    p2.nachn AS last_name,
    p2.gbdat AS birth_date,
    p1.orgeh AS org_unit,
    p1.plans AS "position",
    p1.kostl AS cost_center,
    p8.ansal AS annual_salary,
    p5.usrid_long AS email,
    m.last_sync_at
   FROM user_pernr_mapping m
     JOIN pa0001 p1 ON m.pernr::text = p1.pernr::text AND p1.endda = '9999-12-31'::date
     JOIN pa0002 p2 ON m.pernr::text = p2.pernr::text AND p2.endda = '9999-12-31'::date
     LEFT JOIN pa0008 p8 ON m.pernr::text = p8.pernr::text AND p8.endda = '9999-12-31'::date AND p8.subty::text = '0'::text
     LEFT JOIN pa0105 p5 ON m.pernr::text = p5.pernr::text AND p5.subty::text = '0010'::text AND p5.endda = '9999-12-31'::date;


CREATE OR REPLACE VIEW public.v_employee_skill_details AS
SELECT esp.id,
    esp.tenant_id,
    esp.employee_id,
    esp.skill_id,
    esp.knowledge_level,
    esp.skill_level,
    esp.ability_level,
    esp.behavior_level,
    esp.attitude_level,
    esp.composite_score,
    esp.source,
    esp.source_description,
    esp.acquired_date,
    esp.last_demonstrated,
    esp.evidence_type,
    esp.evidence_id,
    esp.evidence_url,
    esp.evidence_notes,
    esp.verification_status,
    esp.verified_by,
    esp.verified_at,
    esp.verification_notes,
    esp.verification_expires_at,
    esp.confidence_score,
    esp.is_primary,
    esp.is_target,
    esp.target_level,
    esp.created_at,
    esp.updated_at,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    e.department_id,
    es.preferred_label_en AS skill_name,
    es.preferred_label_it AS skill_name_it,
    es.description_en AS skill_description,
    es.skill_type,
    esg.preferred_label_en AS skill_group
   FROM employee_skill_profiles esp
     JOIN employees e ON esp.employee_id = e.id
     JOIN esco_skills es ON esp.skill_id = es.id
     LEFT JOIN esco_skill_groups esg ON es.skill_group_uri::text = esg.uri::text;


CREATE OR REPLACE VIEW public.v_employee_skill_summary AS
SELECT esp.tenant_id,
    esp.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    count(*) AS total_skills,
    count(*) FILTER (WHERE esp.verification_status = 'verified'::skill_verification_status) AS verified_skills,
    count(*) FILTER (WHERE esp.verification_status = 'pending'::skill_verification_status) AS pending_skills,
    round(avg(esp.composite_score), 2) AS avg_composite_score,
    max(esp.composite_score) AS max_composite_score,
    count(*) FILTER (WHERE esp.is_primary) AS primary_skills,
    count(*) FILTER (WHERE esp.is_target) AS target_skills
   FROM employee_skill_profiles esp
     JOIN employees e ON esp.employee_id = e.id
  GROUP BY esp.tenant_id, esp.employee_id, e.first_name, e.last_name;


CREATE OR REPLACE VIEW public.v_employee_skills AS
SELECT e.id AS employee_id,
    e.tenant_id,
    t.code AS tenant_code,
    e.first_name,
    e.last_name,
    e.job_title,
    e.department,
    e.skills,
    array_length(e.skills, 1) AS skill_count,
    e.performance_rating,
    e.potential
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
  WHERE e.is_active = true;


CREATE OR REPLACE VIEW public.v_employee_skills_summary AS
SELECT es.tenant_id,
    es.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    count(*) AS total_skills,
    count(
        CASE
            WHEN es.proficiency_level >= 4 THEN 1
            ELSE NULL::integer
        END) AS expert_skills,
    count(
        CASE
            WHEN es.is_verified THEN 1
            ELSE NULL::integer
        END) AS verified_skills,
    avg(es.proficiency_level)::numeric(3,2) AS avg_proficiency,
    array_agg(DISTINCT COALESCE(esco.skill_type, 'custom'::character varying)) AS skill_types
   FROM employee_skills es
     JOIN employees e ON es.employee_id = e.id
     LEFT JOIN esco_skills esco ON es.esco_skill_id = esco.id
  GROUP BY es.tenant_id, es.employee_id, e.first_name, e.last_name;


CREATE OR REPLACE VIEW public.v_engagement_analytics AS
WITH survey_metrics AS (
         SELECT s.tenant_id,
            date_trunc('month'::text, s.created_at) AS period,
            count(DISTINCT s.id) AS total_surveys,
            sum(s.total_invitations) AS total_invitations,
            sum(s.total_responses) AS total_responses,
                CASE
                    WHEN sum(s.total_invitations) > 0 THEN round(sum(s.total_responses)::numeric / sum(s.total_invitations)::numeric * 100::numeric, 1)
                    ELSE 0::numeric
                END AS response_rate
           FROM engagement_surveys s
          WHERE s.status::text = ANY (ARRAY['active'::character varying, 'closed'::character varying]::text[])
          GROUP BY s.tenant_id, (date_trunc('month'::text, s.created_at))
        ), nps_metrics AS (
         SELECT s.tenant_id,
            date_trunc('month'::text, s.created_at) AS period,
            count(*) FILTER (WHERE ((a.value ->> 'value'::text)::integer) >= 9) AS promoters,
            count(*) FILTER (WHERE ((a.value ->> 'value'::text)::integer) >= 7 AND ((a.value ->> 'value'::text)::integer) <= 8) AS passives,
            count(*) FILTER (WHERE ((a.value ->> 'value'::text)::integer) <= 6) AS detractors,
            count(*) AS total_nps_responses
           FROM engagement_surveys s
             JOIN engagement_survey_responses r ON r.survey_id = s.id AND r.is_complete = true
             CROSS JOIN LATERAL jsonb_array_elements(r.answers) a(value)
             JOIN LATERAL jsonb_array_elements(s.questions) q(value) ON (q.value ->> 'id'::text) = (a.value ->> 'question_id'::text)
          WHERE (q.value ->> 'type'::text) = 'nps'::text
          GROUP BY s.tenant_id, (date_trunc('month'::text, s.created_at))
        )
 SELECT sm.tenant_id,
    sm.period,
    sm.total_surveys,
    sm.total_invitations,
    sm.total_responses,
    sm.response_rate,
        CASE
            WHEN COALESCE(nm.total_nps_responses, 0::bigint) > 0 THEN round((nm.promoters::numeric / nm.total_nps_responses::numeric - nm.detractors::numeric / nm.total_nps_responses::numeric) * 100::numeric, 0)
            ELSE NULL::numeric
        END AS enps_score,
    nm.promoters,
    nm.passives,
    nm.detractors
   FROM survey_metrics sm
     LEFT JOIN nps_metrics nm ON sm.tenant_id = nm.tenant_id AND sm.period = nm.period;


CREATE OR REPLACE VIEW public.v_engagement_summary AS
SELECT s.tenant_id,
    s.id AS survey_id,
    s.title AS survey_title,
    s.survey_type,
    count(DISTINCT sr.employee_id) AS respondents,
    round(avg(
        CASE
            WHEN sq.question_type::text = 'nps'::text THEN sr.rating_value
            ELSE NULL::integer
        END), 1) AS avg_nps_score,
    round(avg(sr.rating_value), 2) AS avg_rating,
    round(avg(
        CASE
            WHEN sq.category::text = 'engagement'::text THEN sr.rating_value
            ELSE NULL::integer
        END), 2) AS engagement_score,
    round(avg(
        CASE
            WHEN sq.category::text = 'manager'::text THEN sr.rating_value
            ELSE NULL::integer
        END), 2) AS manager_score,
    round(avg(
        CASE
            WHEN sq.category::text = 'growth'::text THEN sr.rating_value
            ELSE NULL::integer
        END), 2) AS growth_score,
    round(avg(
        CASE
            WHEN sq.category::text = 'culture'::text THEN sr.rating_value
            ELSE NULL::integer
        END), 2) AS culture_score
   FROM surveys s
     JOIN survey_questions sq ON sq.survey_id = s.id
     LEFT JOIN survey_responses sr ON sr.question_id = sq.id
  GROUP BY s.tenant_id, s.id, s.title, s.survey_type;


CREATE OR REPLACE VIEW public.v_executive_dashboard_cluster AS
SELECT tenant_id,
    tenant_name,
    industry_type,
    total_employees,
    active_employees,
    turnover_rate_annual,
    terminations_90d,
    new_hires_30d,
    new_hires_90d,
    new_hires_1y,
    avg_tenure_years,
    male_count,
    female_count,
    female_percentage,
    avg_salary,
    total_salary_cost,
    avg_performance_rating,
    high_performers,
    low_performers,
    high_risk_employees,
    medium_risk_employees,
    high_risk_percentage,
    top_talent,
    solid_talent,
    action_needed,
    critical_roles,
    succession_ready,
    open_requisitions,
    active_candidates
   FROM analytics.v_executive_dashboard;


CREATE OR REPLACE VIEW public.v_feature_summary AS
SELECT category,
    count(*) AS total_features,
    sum(
        CASE
            WHEN implementation_status::text = 'implemented'::text THEN 1
            ELSE 0
        END) AS implemented,
    sum(
        CASE
            WHEN implementation_status::text = 'in_progress'::text THEN 1
            ELSE 0
        END) AS in_progress,
    sum(
        CASE
            WHEN implementation_status::text = 'not_started'::text THEN 1
            ELSE 0
        END) AS not_started,
    round(avg(current_coverage_pct), 1) AS avg_coverage_pct,
    sum(COALESCE(estimated_effort_days, 0)) AS total_effort_days
   FROM platform_features
  GROUP BY category
  ORDER BY (round(avg(current_coverage_pct), 1)) DESC;


CREATE OR REPLACE VIEW public.v_feedback_given_summary AS
SELECT cf.tenant_id,
    cf.from_employee_id AS employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    count(*) AS total_given,
    count(*) FILTER (WHERE cf.feedback_type::text = 'praise'::text) AS praise_given,
    count(*) FILTER (WHERE cf.feedback_type::text = 'suggestion'::text) AS suggestion_given,
    count(*) FILTER (WHERE cf.feedback_type::text = 'concern'::text) AS concern_given,
    count(DISTINCT cf.to_employee_id) AS unique_recipients,
    max(cf.created_at) AS last_feedback_given
   FROM continuous_feedback cf
     JOIN employees e ON cf.from_employee_id = e.id
  GROUP BY cf.tenant_id, cf.from_employee_id, e.first_name, e.last_name;


CREATE OR REPLACE VIEW public.v_feedback_summary AS
SELECT cf.tenant_id,
    cf.to_employee_id AS employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    count(*) AS total_received,
    count(*) FILTER (WHERE cf.feedback_type::text = 'praise'::text) AS praise_count,
    count(*) FILTER (WHERE cf.feedback_type::text = 'suggestion'::text) AS suggestion_count,
    count(*) FILTER (WHERE cf.feedback_type::text = 'concern'::text) AS concern_count,
    count(*) FILTER (WHERE cf.visibility::text = 'public'::text) AS public_count,
    round(avg(cf.sentiment_score), 2) AS avg_sentiment,
    max(cf.created_at) AS last_feedback_at,
    count(DISTINCT cf.from_employee_id) AS unique_givers
   FROM continuous_feedback cf
     JOIN employees e ON cf.to_employee_id = e.id
  GROUP BY cf.tenant_id, cf.to_employee_id, e.first_name, e.last_name;


CREATE OR REPLACE VIEW public.v_feedback_wall AS
SELECT cf.id,
    cf.tenant_id,
    cf.from_employee_id,
    (f.first_name::text || ' '::text) || f.last_name::text AS from_name,
    f.job_title AS from_job_title,
    cf.to_employee_id,
    (t.first_name::text || ' '::text) || t.last_name::text AS to_name,
    t.job_title AS to_job_title,
    d.name AS to_department,
    cf.feedback_type,
    cf.message,
    cf.category,
    cf.tags,
    cf.created_at,
    cf.acknowledged,
    g.title AS related_goal_title
   FROM continuous_feedback cf
     JOIN employees f ON cf.from_employee_id = f.id
     JOIN employees t ON cf.to_employee_id = t.id
     LEFT JOIN departments d ON t.department_id = d.id
     LEFT JOIN goals g ON cf.related_goal_id = g.id
  WHERE cf.visibility::text = 'public'::text AND cf.feedback_type::text = 'praise'::text
  ORDER BY cf.created_at DESC;


CREATE OR REPLACE VIEW public.v_goal_cascade AS
WITH RECURSIVE goal_tree AS (
         SELECT g.id,
            g.tenant_id,
            g.title,
            g.description,
            g.employee_id,
            g.parent_goal_id,
            g.status,
            g.progress_percent,
            g.weight,
            g.due_date,
            0 AS level,
            ARRAY[g.id] AS path,
            g.id AS root_id
           FROM goals g
          WHERE g.parent_goal_id IS NULL
        UNION ALL
         SELECT g.id,
            g.tenant_id,
            g.title,
            g.description,
            g.employee_id,
            g.parent_goal_id,
            g.status,
            g.progress_percent,
            g.weight,
            g.due_date,
            gt_1.level + 1,
            gt_1.path || g.id,
            gt_1.root_id
           FROM goals g
             JOIN goal_tree gt_1 ON g.parent_goal_id = gt_1.id
          WHERE NOT (g.id = ANY (gt_1.path))
        )
 SELECT gt.id,
    gt.tenant_id,
    gt.title,
    gt.description,
    gt.employee_id,
    gt.parent_goal_id,
    gt.status,
    gt.progress_percent,
    gt.weight,
    gt.due_date,
    gt.level,
    gt.path,
    gt.root_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS owner_name,
    e.job_title AS owner_job_title,
    d.name AS owner_department,
    pg.title AS parent_goal_title
   FROM goal_tree gt
     JOIN employees e ON gt.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN goals pg ON gt.parent_goal_id = pg.id;


CREATE OR REPLACE VIEW public.v_goals_summary AS
SELECT g.tenant_id,
    t.name AS tenant_name,
    count(*) AS total_goals,
    count(*) FILTER (WHERE g.status::text = 'completed'::text) AS completed_goals,
    count(*) FILTER (WHERE g.status::text = 'in_progress'::text) AS in_progress_goals,
    count(*) FILTER (WHERE g.status::text = 'not_started'::text) AS not_started_goals,
    round(avg(g.progress_percent), 1) AS avg_progress,
    count(*) FILTER (WHERE g.due_date < CURRENT_DATE AND g.status::text <> 'completed'::text) AS overdue_goals
   FROM goals g
     JOIN tenants t ON t.id = g.tenant_id
  GROUP BY g.tenant_id, t.name;


CREATE OR REPLACE VIEW public.v_headcount_trend AS
SELECT p1.bukrs AS company_code,
    t.butxt AS company_name,
    p1.orgeh AS org_unit,
    org.stext AS org_unit_name,
    count(DISTINCT p1.pernr) AS headcount,
    count(DISTINCT
        CASE
            WHEN p0.stat2::text = '1'::text THEN p1.pernr
            ELSE NULL::character varying
        END) AS active_count,
    count(DISTINCT
        CASE
            WHEN p0.stat2::text = '3'::text THEN p1.pernr
            ELSE NULL::character varying
        END) AS terminated_count,
    avg(p8.ansal) AS avg_salary
   FROM pa0001 p1
     LEFT JOIN pa0000 p0 ON p1.pernr::text = p0.pernr::text AND p0.endda = '9999-12-31'::date
     LEFT JOIN pa0008 p8 ON p1.pernr::text = p8.pernr::text AND p8.endda = '9999-12-31'::date
     LEFT JOIN t500c t ON p1.bukrs::text = t.bukrs::text
     LEFT JOIN hrp1000 org ON p1.orgeh::text = org.objid::text AND org.otype::text = 'O'::text AND org.endda = '9999-12-31'::date
  WHERE p1.endda = '9999-12-31'::date
  GROUP BY p1.bukrs, t.butxt, p1.orgeh, org.stext
  ORDER BY p1.bukrs, p1.orgeh;


CREATE OR REPLACE VIEW public.v_hr_essentials AS
SELECT p0002.pernr,
    p0002.vorna AS first_name,
    p0002.nachn AS last_name,
    p0002.gbdat AS birth_date,
    p0000.stat2 AS status,
    p0001.bukrs AS company_code,
    p0001.orgeh AS org_unit,
    p0001.plans AS "position",
    email.usrid_long AS email
   FROM pa0002 p0002
     LEFT JOIN pa0000 p0000 ON p0002.pernr::text = p0000.pernr::text AND p0000.endda = '9999-12-31'::date
     LEFT JOIN pa0001 p0001 ON p0002.pernr::text = p0001.pernr::text AND p0001.endda = '9999-12-31'::date
     LEFT JOIN pa0105 email ON p0002.pernr::text = email.pernr::text AND email.subty::text = '0010'::text AND email.endda = '9999-12-31'::date
  WHERE p0002.endda = '9999-12-31'::date;


CREATE OR REPLACE VIEW public.v_job_profile AS
SELECT j.objid AS job_id,
    j.stext AS job_title,
    j.short AS job_code,
    c.min_salary,
    c.mid_salary,
    c.max_salary,
    c.currency,
    string_agg(DISTINCT cat.qual_name::text, ', '::text) AS required_skills,
    count(DISTINCT req.quali) AS skill_count
   FROM hrp1000 j
     LEFT JOIN hrp1005 c ON j.objid::text = c.objid::text AND c.otype::text = 'C'::text AND c.endda = '9999-12-31'::date
     LEFT JOIN hrp1035 req ON j.objid::text = req.objid::text AND req.otype::text = 'C'::text AND req.endda = '9999-12-31'::date
     LEFT JOIN hrp1036 cat ON req.quali::text = cat.objid::text AND cat.endda = '9999-12-31'::date
  WHERE j.otype::text = 'C'::text AND j.endda = '9999-12-31'::date
  GROUP BY j.objid, j.stext, j.short, c.min_salary, c.mid_salary, c.max_salary, c.currency
  ORDER BY j.stext;


CREATE OR REPLACE VIEW public.v_learning_dashboard AS
SELECT t.id AS tenant_id,
    t.code AS tenant_code,
    t.name AS tenant_name,
    count(DISTINCT c.id) AS total_courses,
    count(DISTINCT c.id) FILTER (WHERE c.status::text = 'published'::text) AS published_courses,
    count(DISTINCT lp.id) AS total_learning_paths,
    count(DISTINCT ce.id) AS total_enrollments,
    count(DISTINCT ce.id) FILTER (WHERE ce.status::text = 'completed'::text) AS completed_enrollments,
    count(DISTINCT ce.id) FILTER (WHERE ce.status::text = 'in_progress'::text) AS in_progress_enrollments,
    round(avg(ce.progress_percent), 1) AS avg_progress,
    count(DISTINCT ec.id) AS total_certifications_earned,
    count(DISTINCT lr.id) FILTER (WHERE lr.status::text = 'pending'::text) AS pending_recommendations
   FROM tenants t
     LEFT JOIN courses c ON c.tenant_id = t.id
     LEFT JOIN learning_paths lp ON lp.tenant_id = t.id
     LEFT JOIN course_enrollments ce ON ce.course_id = c.id
     LEFT JOIN employee_certifications ec ON (ec.employee_id IN ( SELECT employees.id
           FROM employees
          WHERE employees.tenant_id = t.id))
     LEFT JOIN learning_recommendations lr ON (lr.employee_id IN ( SELECT employees.id
           FROM employees
          WHERE employees.tenant_id = t.id))
  GROUP BY t.id, t.code, t.name;


CREATE OR REPLACE VIEW public.v_learning_path_progress AS
SELECT lpe.id AS enrollment_id,
    lpe.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    lpe.learning_path_id,
    lp.title AS path_title,
    lp.target_role,
    lp.estimated_duration_hours,
    lpe.status,
    lpe.progress_percent,
    lpe.enrolled_at,
    lpe.completed_at,
    count(lpc.id) AS total_courses_in_path,
    count(ce.id) FILTER (WHERE ce.status::text = 'completed'::text) AS courses_completed,
    count(ce.id) FILTER (WHERE ce.status::text = 'in_progress'::text) AS courses_in_progress
   FROM learning_path_enrollments lpe
     JOIN employees e ON e.id = lpe.employee_id
     JOIN learning_paths lp ON lp.id = lpe.learning_path_id
     LEFT JOIN learning_path_courses lpc ON lpc.learning_path_id = lp.id
     LEFT JOIN course_enrollments ce ON ce.course_id = lpc.course_id AND ce.employee_id = lpe.employee_id
  GROUP BY lpe.id, lpe.employee_id, e.first_name, e.last_name, lpe.learning_path_id, lp.title, lp.target_role, lp.estimated_duration_hours, lpe.status, lpe.progress_percent, lpe.enrolled_at, lpe.completed_at;


CREATE OR REPLACE VIEW public.v_learning_recommendations AS
SELECT psl.tenant_id,
    psl.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    psl.competency_name,
    psl.competency_rating,
    es.preferred_label_en AS linked_skill_name,
    es.description_en AS skill_description,
    c.title AS course_title,
    c.id AS course_id,
    c.duration_hours
   FROM performance_skill_links psl
     JOIN employees e ON psl.employee_id = e.id
     LEFT JOIN esco_skills es ON psl.linked_skill_id = es.id
     LEFT JOIN course_esco_skills cs ON cs.esco_skill_uri::text = es.uri::text
     LEFT JOIN courses c ON cs.course_id = c.id
  WHERE psl.rating_level::text = 'low'::text AND psl.is_addressed = false
  ORDER BY psl.competency_rating;


CREATE OR REPLACE VIEW public.v_learning_skills_development AS
SELECT e.id AS employee_id,
    e.tenant_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    ces.esco_skill_uri,
    ces.skill_name,
    ces.skill_type,
    max(ces.proficiency_level_gained) AS max_level_from_courses,
    count(DISTINCT ce.course_id) AS courses_completed_for_skill,
    array_agg(DISTINCT c.title) AS completed_courses
   FROM employees e
     JOIN course_enrollments ce ON ce.employee_id = e.id AND ce.status::text = 'completed'::text
     JOIN course_esco_skills ces ON ces.course_id = ce.course_id
     JOIN courses c ON c.id = ce.course_id
  GROUP BY e.id, e.tenant_id, e.first_name, e.last_name, ces.esco_skill_uri, ces.skill_name, ces.skill_type;


CREATE OR REPLACE VIEW public.v_manager_chain_issues AS
WITH RECURSIVE manager_chain AS (
         SELECT employees.id AS employee_id,
            employees.manager_id,
            employees.tenant_id,
            1 AS depth,
            ARRAY[employees.id] AS chain
           FROM employees
          WHERE employees.manager_id IS NOT NULL
        UNION ALL
         SELECT mc.employee_id,
            e_1.manager_id,
            mc.tenant_id,
            mc.depth + 1,
            mc.chain || e_1.id
           FROM manager_chain mc
             JOIN employees e_1 ON mc.manager_id = e_1.id
          WHERE mc.depth < 20 AND (e_1.id <> ALL (mc.chain))
        )
 SELECT e.id AS employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    e.tenant_id,
    t.name AS tenant_name,
        CASE
            WHEN e.manager_id IS NOT NULL AND NOT (EXISTS ( SELECT 1
               FROM employees
              WHERE employees.id = e.manager_id)) THEN 'invalid_manager'::text
            WHEN e.manager_id = e.id THEN 'self_reference'::text
            WHEN (EXISTS ( SELECT 1
               FROM manager_chain mc
              WHERE mc.employee_id = e.id AND (e.id = ANY (mc.chain[2:])))) THEN 'circular_reference'::text
            WHEN e.manager_id IS NULL AND (e.auth_role::text <> ALL (ARRAY['TENANT_ADMIN'::character varying, 'SYSADMIN'::character varying]::text[])) AND e.is_active = true THEN 'no_manager'::text
            ELSE 'ok'::text
        END AS issue_type
   FROM employees e
     JOIN tenants t ON e.tenant_id = t.id
  WHERE t.code::text <> 'heuresys'::text;


CREATE OR REPLACE VIEW public.v_my_applications AS
SELECT a.id,
    a.job_posting_id,
    a.employee_id,
    a.cover_letter,
    a.motivation,
    a.relevant_experience,
    a.matched_skills,
    a.skill_match_score,
    a.status,
    a.current_manager_id,
    a.manager_approval_status,
    a.manager_approval_date,
    a.manager_notes,
    a.hr_reviewer_id,
    a.hr_notes,
    a.hr_score,
    a.interview_scheduled,
    a.interview_date,
    a.interview_feedback,
    a.outcome_notes,
    a.rejected_reason,
    a.submitted_at,
    a.reviewed_at,
    a.decided_at,
    a.created_at,
    a.updated_at,
    j.title AS job_title,
    j.department,
    j.location,
    j.job_level,
    j.status AS job_status
   FROM internal_applications a
     JOIN internal_job_postings j ON a.job_posting_id = j.id;


CREATE OR REPLACE VIEW public.v_my_performance_reviews AS
SELECT pr.id,
    pr.tenant_id,
    pr.employee_id,
    pr.reviewer_id,
    (r.first_name::text || ' '::text) || r.last_name::text AS reviewer_name,
    pr.review_cycle_id,
    rc.name AS cycle_name,
    rc.cycle_type,
    pr.review_period_start,
    pr.review_period_end,
    pr.review_type,
    pr.status,
    pr.self_assessment_status,
    pr.self_rating,
    pr.self_comments,
    pr.self_submitted_at,
    pr.overall_rating,
    pr.goal_achievement_rating,
    pr.competency_rating,
    pr.manager_comments,
    pr.manager_submitted_at,
    pr.calibrated_rating,
    pr.finalized_at,
    pr.acknowledged_at,
    pr.goals_count,
    pr.competencies_count,
    rcp.current_phase,
    rcp.self_review_completed,
    rcp.manager_review_completed,
    rcp.finalized,
    t.name AS template_name,
    t.sections AS template_sections,
    t.rating_scale_type,
    t.rating_scale_config
   FROM performance_reviews pr
     LEFT JOIN employees r ON pr.reviewer_id = r.id
     LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
     LEFT JOIN review_cycle_participants rcp ON pr.review_cycle_id = rcp.review_cycle_id AND pr.employee_id = rcp.employee_id
     LEFT JOIN performance_review_templates t ON pr.template_id = t.id;


CREATE OR REPLACE VIEW public.v_nine_box_summary AS
SELECT tenant_id,
    box_number,
    box_label,
    potential_score,
    performance_score,
    count(*) AS employee_count,
    round(100.0 * count(*)::numeric / sum(count(*)) OVER (PARTITION BY tenant_id), 1) AS percentage
   FROM v_nine_box_grid
  WHERE box_label <> 'Not Rated'::text
  GROUP BY tenant_id, box_number, box_label, potential_score, performance_score
  ORDER BY tenant_id, potential_score DESC, performance_score DESC;


CREATE OR REPLACE VIEW public.v_okr_progress AS
SELECT NULL::uuid AS okr_id,
    NULL::uuid AS tenant_id,
    NULL::text AS objective,
    NULL::character varying(50) AS okr_type,
    NULL::date AS period_start,
    NULL::date AS period_end,
    NULL::character varying(50) AS status,
    NULL::bigint AS key_results_count,
    NULL::numeric AS avg_kr_progress,
    NULL::numeric(3,2) AS confidence_level;


CREATE OR REPLACE VIEW public.v_onboarding_dashboard AS
SELECT oi.tenant_id,
    oi.id AS instance_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    e.department,
    ot.name AS template_name,
    oi.status,
    oi.start_date,
    oi.target_completion_date,
    oi.progress_percent,
    ( SELECT count(*) AS count
           FROM onboarding_tasks t
          WHERE t.instance_id = oi.id) AS total_tasks,
    ( SELECT count(*) AS count
           FROM onboarding_tasks t
          WHERE t.instance_id = oi.id AND t.status::text = 'completed'::text) AS completed_tasks,
    ( SELECT count(*) AS count
           FROM onboarding_tasks t
          WHERE t.instance_id = oi.id AND t.status::text = 'pending'::text AND t.due_date < CURRENT_DATE) AS overdue_tasks,
    (buddy.first_name::text || ' '::text) || buddy.last_name::text AS buddy_name
   FROM onboarding_instances oi
     JOIN employees e ON oi.employee_id = e.id
     LEFT JOIN onboarding_templates ot ON oi.template_id = ot.id
     LEFT JOIN employees buddy ON oi.assigned_buddy_id = buddy.id;


CREATE OR REPLACE VIEW public.v_org_hierarchy AS
WITH RECURSIVE org_tree AS (
         SELECT org_units.id,
            org_units.tenant_id,
            org_units.code,
            org_units.name,
            org_units.parent_id,
            org_units.org_level,
            org_units.org_type,
            org_units.department_id,
            org_units.default_location_id,
            org_units.manager_id,
            org_units.name::text AS path_name,
            org_units.code::text AS path_code,
            1 AS depth
           FROM org_units
          WHERE org_units.parent_id IS NULL AND org_units.is_active = true
        UNION ALL
         SELECT ou.id,
            ou.tenant_id,
            ou.code,
            ou.name,
            ou.parent_id,
            ou.org_level,
            ou.org_type,
            ou.department_id,
            ou.default_location_id,
            ou.manager_id,
            (ot_1.path_name || ' > '::text) || ou.name::text,
            (ot_1.path_code || '.'::text) || ou.code::text,
            ot_1.depth + 1
           FROM org_units ou
             JOIN org_tree ot_1 ON ou.parent_id = ot_1.id
          WHERE ou.is_active = true
        )
 SELECT ot.id,
    ot.tenant_id,
    ot.code,
    ot.name,
    ot.parent_id,
    ot.org_level,
    ot.org_type,
    ot.department_id,
    ot.default_location_id,
    ot.manager_id,
    ot.path_name,
    ot.path_code,
    ot.depth,
    d.name AS department_name,
    d.color AS department_color,
    l.name AS location_name,
    l.city AS location_city,
    (e.first_name::text || ' '::text) || e.last_name::text AS manager_name
   FROM org_tree ot
     LEFT JOIN departments d ON ot.department_id = d.id
     LEFT JOIN locations l ON ot.default_location_id = l.id
     LEFT JOIN employees e ON ot.manager_id = e.id;


CREATE OR REPLACE VIEW public.v_org_structure AS
SELECT o.objid AS org_unit_id,
    o.stext AS org_name,
    o.short AS org_code,
    r.sobid AS parent_org_id,
    p.stext AS parent_name
   FROM hrp1000 o
     LEFT JOIN hrp1001 r ON o.objid::text = r.objid::text AND r.rsign::text = 'A'::text AND r.relat::text = '002'::text AND r.endda = '9999-12-31'::date
     LEFT JOIN hrp1000 p ON r.sobid::text = p.objid::text AND p.otype::text = 'O'::text AND p.endda = '9999-12-31'::date
  WHERE o.otype::text = 'O'::text AND o.endda = '9999-12-31'::date;


CREATE OR REPLACE VIEW public.v_org_structure_stats AS
SELECT id AS tenant_id,
    name AS tenant_name,
    ( SELECT count(*) AS count
           FROM locations
          WHERE locations.tenant_id = t.id AND locations.is_active = true) AS total_locations,
    ( SELECT count(*) AS count
           FROM departments
          WHERE departments.tenant_id = t.id AND departments.is_active = true) AS total_departments,
    ( SELECT count(*) AS count
           FROM org_units
          WHERE org_units.tenant_id = t.id AND org_units.is_active = true) AS total_org_units,
    ( SELECT count(*) AS count
           FROM cost_centers
          WHERE cost_centers.tenant_id = t.id AND cost_centers.is_active = true) AS total_cost_centers,
    ( SELECT count(*) AS count
           FROM employees
          WHERE employees.tenant_id = t.id AND t.status::text = 'active'::text) AS total_employees
   FROM tenants t
  WHERE status::text = 'active'::text;


CREATE OR REPLACE VIEW public.v_org_structure_summary AS
SELECT t.code AS tenant_code,
    t.name AS tenant_name,
    count(DISTINCT e.id) AS total_employees,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'TENANT_ADMIN'::text THEN e.id
            ELSE NULL::uuid
        END) AS tenant_admins,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'IT_ADMIN'::text THEN e.id
            ELSE NULL::uuid
        END) AS it_admins,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'HR_DIRECTOR'::text THEN e.id
            ELSE NULL::uuid
        END) AS hr_directors,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'HR_MANAGER'::text THEN e.id
            ELSE NULL::uuid
        END) AS hr_managers,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'DEPT_HEAD'::text THEN e.id
            ELSE NULL::uuid
        END) AS dept_heads,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'LINE_MANAGER'::text THEN e.id
            ELSE NULL::uuid
        END) AS line_managers,
    count(DISTINCT
        CASE
            WHEN e.auth_role::text = 'EMPLOYEE'::text THEN e.id
            ELSE NULL::uuid
        END) AS employees,
    count(DISTINCT
        CASE
            WHEN e.manager_id IS NULL AND (e.auth_role::text <> ALL (ARRAY['TENANT_ADMIN'::character varying, 'SYSADMIN'::character varying]::text[])) THEN e.id
            ELSE NULL::uuid
        END) AS orphans,
    count(DISTINCT d.id) AS departments,
    count(DISTINCT
        CASE
            WHEN d.head_id IS NOT NULL THEN d.id
            ELSE NULL::uuid
        END) AS depts_with_head
   FROM tenants t
     LEFT JOIN employees e ON e.tenant_id = t.id AND e.is_active = true
     LEFT JOIN departments d ON d.tenant_id = t.id
  WHERE t.code::text <> 'heuresys'::text
  GROUP BY t.id, t.code, t.name
  ORDER BY t.name;


CREATE OR REPLACE VIEW public.v_org_unit_headcount AS
SELECT tou.id AS org_unit_id,
    tou.chart_id,
    toc.tenant_id,
    tou.code,
    tou.name_it,
    tou.cost_center,
    oa.code AS area_code,
    oa.name_it AS area_name,
    ol.level,
    ol.name_it AS level_name,
    tou.headcount_budget,
    count(DISTINCT e.id) AS headcount_actual,
    tou.headcount_budget - count(DISTINCT e.id) AS headcount_variance,
    count(DISTINCT tj.id) AS job_count,
    COALESCE(sum(tj.budgeted_positions), 0::bigint) AS total_budgeted_positions,
    COALESCE(sum(tj.filled_positions), 0::bigint) AS total_filled_positions
   FROM tenant_org_units tou
     JOIN tenant_org_charts toc ON tou.chart_id = toc.id
     LEFT JOIN org_areas oa ON tou.area_code::text = oa.code::text
     LEFT JOIN org_levels ol ON tou.level = ol.level
     LEFT JOIN tenant_jobs tj ON tou.id = tj.tenant_org_unit_id AND tj.is_active = true
     LEFT JOIN employee_job_assignments eja ON tj.id = eja.tenant_job_id AND eja.is_current = true
     LEFT JOIN employees e ON eja.employee_id = e.id AND e.is_active = true
  WHERE tou.is_active = true
  GROUP BY tou.id, tou.chart_id, toc.tenant_id, tou.code, tou.name_it, tou.cost_center, oa.code, oa.name_it, ol.level, ol.name_it, tou.headcount_budget;


CREATE OR REPLACE VIEW public.v_overtime_analysis AS
SELECT e.pernr,
    e.company_code,
    (e.first_name::text || ' '::text) || e.last_name::text AS full_name,
    e."position" AS position_text,
    date_trunc('month'::text, o.begda::timestamp with time zone) AS month,
    count(*) AS ot_occurrences,
    sum(o.stdaz) AS total_ot_hours,
    avg(o.stdaz) AS avg_ot_per_occurrence,
    sum(
        CASE
            WHEN o.approved THEN o.stdaz
            ELSE 0::numeric
        END) AS approved_hours,
    sum(
        CASE
            WHEN NOT o.approved THEN o.stdaz
            ELSE 0::numeric
        END) AS pending_hours
   FROM v_employee_master e
     LEFT JOIN pa2005 o ON e.pernr::text = o.pernr::text
  WHERE o.begda >= date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)
  GROUP BY e.pernr, e.company_code, e.first_name, e.last_name, e."position", (date_trunc('month'::text, o.begda::timestamp with time zone))
  ORDER BY (sum(o.stdaz)) DESC NULLS LAST;


CREATE OR REPLACE VIEW public.v_payroll_summary AS
SELECT e.pernr,
    e.company_code,
    (e.first_name::text || ' '::text) || e.last_name::text AS full_name,
    p.abkrs AS payroll_area,
    p.paession AS year,
    p.pession_no AS period,
    p.gross_pay,
    p.net_pay,
    p.gross_pay - p.net_pay AS total_deductions,
    p.status,
    p.rgdate AS process_date
   FROM v_employee_master e
     JOIN pcl2 p ON e.pernr::text = p.pernr::text
  WHERE p.relession::text = 'RG'::text
  ORDER BY p.paession DESC, p.pession_no DESC, e.pernr;


CREATE OR REPLACE VIEW public.v_people_inspector AS
SELECT e.id,
    e.tenant_id,
    e.pernr,
    e.first_name,
    e.last_name,
    (e.first_name::text || ' '::text) || e.last_name::text AS full_name,
    e.email,
    e.job_title,
    e.department,
    e.location,
    e.location_id,
    l.name AS location_name,
    l.city AS location_city,
    l.country AS location_country,
    e.manager_id,
    (mgr.first_name::text || ' '::text) || mgr.last_name::text AS manager_name,
    e.hire_date,
    e.termination_date,
    e.employment_status,
    e.is_active,
    t.name AS tenant_name
   FROM employees e
     LEFT JOIN locations l ON l.id = e.location_id
     LEFT JOIN employees mgr ON mgr.id = e.manager_id
     LEFT JOIN tenants t ON t.id = e.tenant_id;


CREATE OR REPLACE VIEW public.v_performance_skill_summary AS
SELECT psl.tenant_id,
    psl.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.job_title,
    d.name AS department_name,
    count(*) AS total_competencies,
    count(*) FILTER (WHERE psl.rating_level::text = 'low'::text) AS low_rated,
    count(*) FILTER (WHERE psl.rating_level::text = 'medium'::text) AS medium_rated,
    count(*) FILTER (WHERE psl.rating_level::text = 'high'::text) AS high_rated,
    count(*) FILTER (WHERE psl.linked_skill_id IS NOT NULL) AS skills_linked,
    count(*) FILTER (WHERE psl.linked_gap_analysis_id IS NOT NULL) AS gap_analyses,
    count(*) FILTER (WHERE psl.is_addressed = true) AS addressed,
    max(psl.created_at) AS last_updated
   FROM performance_skill_links psl
     JOIN employees e ON psl.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
  GROUP BY psl.tenant_id, psl.employee_id, e.first_name, e.last_name, e.job_title, d.name;


CREATE OR REPLACE VIEW public.v_performance_snapshot_cluster AS
SELECT employee_id,
    tenant_id,
    employee_number,
    employee_name,
    job_title,
    department,
    manager_id,
    manager_name,
    total_goals,
    goals_completed,
    goals_active,
    goals_at_risk,
    avg_goal_progress,
    total_okrs,
    avg_okr_progress,
    total_key_results,
    avg_kr_completion,
    feedback_received_90d,
    total_recognitions,
    recognitions_90d,
    checkins_90d,
    last_review_id,
    last_review_type,
    last_overall_rating,
    last_potential_rating,
    last_review_date,
    performance_score,
    potential_score,
    box_position,
    skill_assessments,
    avg_skill_level
   FROM analytics.v_performance_snapshot;


CREATE OR REPLACE VIEW public.v_platform_tables AS
SELECT table_name,
    schema_name,
    description,
    example_use
   FROM table_usage_rules
  WHERE (usage_allowed::text = ANY (ARRAY['PLATFORM'::character varying::text, 'BOTH'::character varying::text])) AND (table_category::text = ANY (ARRAY['HEURESYS_CORE'::character varying::text, 'HEURESYS_MODULE'::character varying::text]))
  ORDER BY table_category, table_name;


CREATE OR REPLACE VIEW public.v_recruiting_pipeline AS
SELECT r.tenant_id,
    r.id AS requisition_id,
    r.title,
    r.department,
    r.status AS req_status,
    r.priority,
    count(a.id) AS total_applications,
    count(a.id) FILTER (WHERE a.stage::text = 'applied'::text) AS applied,
    count(a.id) FILTER (WHERE a.stage::text = 'screening'::text) AS screening,
    count(a.id) FILTER (WHERE a.stage::text = 'interview'::text) AS interview,
    count(a.id) FILTER (WHERE a.stage::text = 'offer'::text) AS offer,
    count(a.id) FILTER (WHERE a.stage::text = 'hired'::text) AS hired,
    count(a.id) FILTER (WHERE a.status::text = 'rejected'::text) AS rejected,
    r.positions_total,
    r.positions_filled,
    r.posted_date,
    CURRENT_DATE - r.posted_date AS days_open
   FROM requisitions r
     LEFT JOIN applications a ON a.requisition_id = r.id
  GROUP BY r.id;


CREATE OR REPLACE VIEW public.v_recruiting_pipeline_cluster AS
SELECT requisition_id,
    tenant_id,
    job_title,
    department,
    location,
    employment_type,
    req_status,
    priority,
    target_hire_date,
    req_created_at,
    hiring_manager_id,
    hiring_manager_name,
    total_candidates,
    stage_applied,
    stage_screening,
    stage_phone_screen,
    stage_interview,
    stage_final_interview,
    stage_offer,
    stage_hired,
    stage_rejected,
    stage_withdrawn,
    avg_days_in_pipeline,
    first_application_date,
    last_application_date,
    screen_to_interview_rate,
    overall_conversion_rate
   FROM analytics.v_recruiting_pipeline;


CREATE OR REPLACE VIEW public.v_requisition_pipeline AS
SELECT r.id,
    r.tenant_id,
    r.title,
    r.department,
    r.location,
    r.status,
    r.priority,
    r.salary_min,
    r.salary_max,
    r.hiring_manager_id,
    r.recruiter_id,
    r.target_hire_date,
    r.created_at,
    EXTRACT(day FROM now() - r.created_at::timestamp with time zone)::integer AS days_open,
    count(c.id) FILTER (WHERE c.id IS NOT NULL) AS total_candidates,
    count(c.id) FILTER (WHERE c.stage::text = 'applied'::text) AS applied_count,
    count(c.id) FILTER (WHERE c.stage::text = 'screening'::text) AS screening_count,
    count(c.id) FILTER (WHERE c.stage::text = 'interview'::text) AS interview_count,
    count(c.id) FILTER (WHERE c.stage::text = 'assessment'::text) AS assessment_count,
    count(c.id) FILTER (WHERE c.stage::text = 'offer'::text) AS offer_count,
    count(c.id) FILTER (WHERE c.stage::text = 'hired'::text) AS hired_count
   FROM recruiting_requisitions r
     LEFT JOIN recruiting_candidates c ON r.id = c.requisition_id
  GROUP BY r.id;


CREATE OR REPLACE VIEW public.v_review_cycle_summary AS
SELECT rc.id,
    rc.tenant_id,
    rc.name,
    rc.cycle_type,
    rc.status,
    rc.start_date,
    rc.end_date,
    rc.self_review_deadline,
    rc.manager_review_deadline,
    rc.calibration_deadline,
    rc.finalization_deadline,
    rc.rating_scale_type,
    rc.launched_at,
    rc.completed_at,
    count(rcp.id) AS total_participants,
    count(
        CASE
            WHEN rcp.status::text = 'completed'::text THEN 1
            ELSE NULL::integer
        END) AS completed_participants,
    count(
        CASE
            WHEN rcp.status::text = 'in_progress'::text THEN 1
            ELSE NULL::integer
        END) AS in_progress_participants,
    count(
        CASE
            WHEN rcp.status::text = 'pending'::text THEN 1
            ELSE NULL::integer
        END) AS pending_participants,
    count(
        CASE
            WHEN rcp.self_review_completed THEN 1
            ELSE NULL::integer
        END) AS self_reviews_completed,
    count(
        CASE
            WHEN rcp.manager_review_completed THEN 1
            ELSE NULL::integer
        END) AS manager_reviews_completed,
    count(
        CASE
            WHEN rcp.calibration_completed THEN 1
            ELSE NULL::integer
        END) AS calibrations_completed,
    round(count(
        CASE
            WHEN rcp.status::text = 'completed'::text THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(rcp.id)::numeric, 0::numeric) * 100::numeric, 2) AS completion_percentage
   FROM review_cycles rc
     LEFT JOIN review_cycle_participants rcp ON rc.id = rcp.review_cycle_id
  GROUP BY rc.id;


CREATE OR REPLACE VIEW public.v_risk_distribution AS
SELECT pp.tenant_id,
    d.id AS department_id,
    d.name AS department_name,
    count(*) AS total_employees,
    count(*) FILTER (WHERE pp.risk_level::text = 'low'::text) AS low_risk,
    count(*) FILTER (WHERE pp.risk_level::text = 'medium'::text) AS medium_risk,
    count(*) FILTER (WHERE pp.risk_level::text = 'high'::text) AS high_risk,
    count(*) FILTER (WHERE pp.risk_level::text = 'critical'::text) AS critical_risk,
    count(*) FILTER (WHERE pp.is_high_potential) AS high_potentials,
    round(avg(pp.risk_score), 1) AS avg_risk_score,
    round(avg(pp.predicted_rating), 2) AS avg_predicted_rating
   FROM performance_predictions pp
     JOIN employees e ON pp.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
  WHERE pp.is_current = true
  GROUP BY pp.tenant_id, d.id, d.name;


CREATE OR REPLACE VIEW public.v_role_skill_requirements AS
SELECT rsr.id,
    rsr.tenant_id,
    rsr.role_id,
    rsr.skill_id,
    rsr.required_knowledge_level,
    rsr.required_skill_level,
    rsr.required_ability_level,
    rsr.required_behavior_level,
    rsr.required_attitude_level,
    rsr.min_composite_score,
    rsr.importance,
    rsr.weight,
    rsr.is_primary,
    rsr.notes,
    rsr.source,
    rsr.created_at,
    rsr.updated_at,
    rsr.created_by,
    rsr.updated_by,
    jt.title_en AS role_title,
    jt.title_it AS role_title_it,
    jt.job_code AS role_code,
    jt.esco_occupation_uri,
    es.preferred_label_en AS skill_name,
    es.preferred_label_it AS skill_name_it,
    es.skill_type,
    esg.preferred_label_en AS skill_group
   FROM role_skill_requirements rsr
     JOIN job_templates jt ON rsr.role_id = jt.id
     JOIN esco_skills es ON rsr.skill_id = es.id
     LEFT JOIN esco_skill_groups esg ON es.skill_group_uri::text = esg.uri::text;


CREATE OR REPLACE VIEW public.v_sap_esco_skills AS
SELECT q.qualifi AS sap_qualification_id,
    q.qualifitext AS sap_name,
    q.esco_skill_uri,
    q.esco_concept_type,
    cat.qual_type AS skill_type,
    cat.qual_group AS skill_group,
    count(DISTINCT e.pernr) AS employees_with_skill
   FROM t771q q
     LEFT JOIN hrp1036 cat ON q.qualifi::text = cat.objid::text AND cat.endda = '9999-12-31'::date
     LEFT JOIN pa0024 e ON q.qualifi::text = e.quali::text AND e.endda = '9999-12-31'::date
  WHERE q.endda = '9999-12-31'::date
  GROUP BY q.qualifi, q.qualifitext, q.esco_skill_uri, q.esco_concept_type, cat.qual_type, cat.qual_group
  ORDER BY (count(DISTINCT e.pernr)) DESC NULLS LAST;


CREATE OR REPLACE VIEW public.v_sap_only_tables AS
SELECT table_name,
    description,
    forbidden_use
   FROM table_usage_rules
  WHERE table_category::text = 'SAP_ONLY'::text
  ORDER BY table_name;


CREATE OR REPLACE VIEW public.v_skill_classification_stats AS
SELECT count(*) AS total_skills,
    count(sc.id) AS classified_skills,
    count(*) - count(sc.id) AS unclassified_skills,
    round(100.0 * count(sc.id)::numeric / NULLIF(count(*), 0)::numeric, 2) AS classification_percentage,
    count(sc.id) FILTER (WHERE sc.primary_category::text = 'hard'::text) AS hard_skills,
    count(sc.id) FILTER (WHERE sc.primary_category::text = 'soft'::text) AS soft_skills,
    count(sc.id) FILTER (WHERE sc.primary_category::text = 'hybrid'::text) AS hybrid_skills,
    count(sc.id) FILTER (WHERE sc.cognitive_level = 1) AS cognitive_level_1,
    count(sc.id) FILTER (WHERE sc.cognitive_level = 2) AS cognitive_level_2,
    count(sc.id) FILTER (WHERE sc.cognitive_level = 3) AS cognitive_level_3,
    count(sc.id) FILTER (WHERE sc.cognitive_level = 4) AS cognitive_level_4,
    count(sc.id) FILTER (WHERE sc.social_dimension::text = 'intrapersonal'::text) AS intrapersonal,
    count(sc.id) FILTER (WHERE sc.social_dimension::text = 'interpersonal'::text) AS interpersonal,
    count(sc.id) FILTER (WHERE sc.social_dimension::text = 'task_oriented'::text) AS task_oriented,
    count(sc.id) FILTER (WHERE sc.transferability::text = 'specialized'::text) AS specialized,
    count(sc.id) FILTER (WHERE sc.transferability::text = 'adjacent'::text) AS adjacent,
    count(sc.id) FILTER (WHERE sc.transferability::text = 'transferable'::text) AS transferable,
    count(sc.id) FILTER (WHERE sc.needs_review = true) AS needs_review
   FROM esco_skills es
     LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id;


CREATE OR REPLACE VIEW public.v_skill_clusters_summary AS
SELECT skc.id,
    skc.code,
    skc.name_en,
    skc.name_it,
    skc.cluster_level,
    skc.parent_cluster_id,
    parent.code AS parent_code,
    parent.name_en AS parent_name,
    count(sc.id) AS skill_count,
    count(sc.id) FILTER (WHERE sc.primary_category::text = 'hard'::text) AS hard_skill_count,
    count(sc.id) FILTER (WHERE sc.primary_category::text = 'soft'::text) AS soft_skill_count,
    count(sc.id) FILTER (WHERE sc.primary_category::text = 'hybrid'::text) AS hybrid_skill_count
   FROM skill_clusters skc
     LEFT JOIN skill_clusters parent ON skc.parent_cluster_id = parent.id
     LEFT JOIN skill_classifications sc ON skc.id = sc.skill_cluster_id
  GROUP BY skc.id, skc.code, skc.name_en, skc.name_it, skc.cluster_level, skc.parent_cluster_id, parent.code, parent.name_en;


CREATE OR REPLACE VIEW public.v_skill_gaps AS
SELECT esa.id AS assessment_id,
    esa.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.tenant_id,
    esa.skill_name,
    esa.esco_skill_uri,
    esa.required_level,
    esa.assessed_level,
    esa.gap,
        CASE
            WHEN esa.gap IS NULL OR esa.gap <= 0 THEN 'met'::text
            WHEN esa.gap = 1 THEN 'minor_gap'::text
            WHEN esa.gap = 2 THEN 'moderate_gap'::text
            ELSE 'critical_gap'::text
        END AS gap_severity,
    esa.assessment_date,
    esa.assessment_method,
    tjs.importance AS skill_importance,
    tjs.skill_category
   FROM employee_skill_assessments esa
     JOIN employees e ON esa.employee_id = e.id
     LEFT JOIN tenant_job_skills tjs ON esa.tenant_job_skill_id = tjs.id
  WHERE e.is_active = true;


CREATE OR REPLACE VIEW public.v_skill_migration_summary AS
SELECT smj.tenant_id,
    t.name AS tenant_name,
    count(*) AS total_jobs,
    count(*) FILTER (WHERE smj.status::text = 'completed'::text) AS completed_jobs,
    count(*) FILTER (WHERE smj.status::text = 'failed'::text) AS failed_jobs,
    sum(smj.total_records) AS total_records_processed,
    sum(smj.matched_records) AS total_matched,
    round(
        CASE
            WHEN sum(smj.processed_records) > 0 THEN sum(smj.matched_records)::numeric / sum(smj.processed_records)::numeric * 100::numeric
            ELSE 0::numeric
        END, 2) AS match_rate_pct,
    max(smj.completed_at) AS last_completed_at
   FROM skill_migration_jobs smj
     JOIN tenants t ON t.id = smj.tenant_id
  GROUP BY smj.tenant_id, t.name;


CREATE OR REPLACE VIEW public.v_skills_classified AS
SELECT es.id,
    es.uri,
    es.preferred_label_en AS preferred_label,
    es.description_en AS description,
    es.skill_type AS esco_skill_type,
    es.reuse_level,
    es.is_digital,
    es.is_green,
    sc.primary_category,
    sc.primary_category_confidence,
    sc.cognitive_level,
    sc.cognitive_level_label,
    sc.social_dimension,
    sc.transferability,
    sc.transferability_score,
    sc.classification_source,
    sc.needs_review,
    skc.id AS cluster_id,
    skc.code AS cluster_code,
    skc.name_en AS cluster_name,
    skc.cluster_level
   FROM esco_skills es
     LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id
     LEFT JOIN skill_clusters skc ON sc.skill_cluster_id = skc.id;


CREATE OR REPLACE VIEW public.v_skills_gap AS
SELECT e.pernr,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e."position",
    req.quali AS required_skill_id,
    cat.qual_name AS skill_name,
    req.proficiency_required,
    COALESCE(emp.proficiency, '00'::character varying) AS current_proficiency,
        CASE
            WHEN emp.proficiency IS NULL THEN 'Missing'::text
            WHEN emp.proficiency::text < req.proficiency_required::text THEN 'Gap'::text
            ELSE 'Met'::text
        END AS gap_status,
    req.esco_skill_uri
   FROM v_employee_master e
     JOIN pa0001 p1 ON e.pernr::text = p1.pernr::text AND p1.endda = '9999-12-31'::date
     JOIN hrp1035 req ON p1.plans::text = req.objid::text AND req.otype::text = 'S'::text AND req.endda = '9999-12-31'::date
     LEFT JOIN hrp1036 cat ON req.quali::text = cat.objid::text AND cat.endda = '9999-12-31'::date
     LEFT JOIN pa0024 emp ON e.pernr::text = emp.pernr::text AND req.quali::text = emp.quali::text AND emp.endda = '9999-12-31'::date
  ORDER BY e.pernr, (
        CASE
            WHEN emp.proficiency IS NULL THEN 'Missing'::text
            WHEN emp.proficiency::text < req.proficiency_required::text THEN 'Gap'::text
            ELSE 'Met'::text
        END) DESC, req.quali;


CREATE OR REPLACE VIEW public.v_skills_matrix AS
SELECT t.id AS tenant_id,
    t.code AS tenant_code,
    skill.skill,
    count(*) AS employee_count,
    round(avg(e.performance_rating), 2) AS avg_performance
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
     CROSS JOIN LATERAL unnest(COALESCE(e.skills, ARRAY[]::text[])) skill(skill)
  WHERE e.is_active = true
  GROUP BY t.id, t.code, skill.skill
  ORDER BY t.id, (count(*)) DESC;


CREATE OR REPLACE VIEW public.v_succession_pipeline AS
SELECT cr.tenant_id,
    cr.id AS role_id,
    cr.role_name,
    cr.department,
    cr.criticality_level,
    cr.succession_status,
    (e_inc.first_name::text || ' '::text) || e_inc.last_name::text AS incumbent_name,
    count(sc.id) AS total_successors,
    sum(
        CASE
            WHEN sc.readiness_level::text = 'ready_now'::text THEN 1
            ELSE 0
        END) AS ready_now_count,
    sum(
        CASE
            WHEN sc.readiness_level::text = 'ready_1_year'::text THEN 1
            ELSE 0
        END) AS ready_1_year_count,
        CASE
            WHEN count(sc.id) = 0 THEN 'Critical'::text
            WHEN sum(
            CASE
                WHEN sc.readiness_level::text = 'ready_now'::text THEN 1
                ELSE 0
            END) = 0 THEN 'High'::text
            WHEN count(sc.id) < 2 THEN 'Medium'::text
            ELSE 'Low'::text
        END AS succession_risk
   FROM critical_roles cr
     LEFT JOIN employees e_inc ON e_inc.id = cr.current_incumbent_id
     LEFT JOIN succession_candidates sc ON sc.critical_role_id = cr.id
  GROUP BY cr.tenant_id, cr.id, cr.role_name, cr.department, cr.criticality_level, cr.succession_status, e_inc.first_name, e_inc.last_name;


CREATE OR REPLACE VIEW public.v_succession_readiness AS
SELECT s.position_id,
    pos.stext AS position_name,
    s.successor_pernr,
    (e.first_name::text || ' '::text) || e.last_name::text AS successor_name,
    s.readiness,
    c.config_value AS readiness_text,
    s.readiness_pct,
    s.ranking,
    s.potential_rating,
    s.performance_rating,
    s.gap_analysis,
    s.status,
    s.reviewed_date
   FROM hrpdev1 s
     LEFT JOIN hrp1000 pos ON s.position_id::text = pos.objid::text AND pos.otype::text = 'S'::text AND pos.endda = '9999-12-31'::date
     LEFT JOIN v_employee_master e ON s.successor_pernr::text = e.pernr::text
     LEFT JOIN sap_config c ON c.config_key::text = ('SUCC_READY_'::text || s.readiness::text)
  WHERE s.endda = '9999-12-31'::date
  ORDER BY s.position_id, s.ranking;


CREATE OR REPLACE VIEW public.v_sync_dashboard AS
SELECT t.name AS tenant_name,
    t.code AS tenant_code,
    count(DISTINCT e.id) AS total_employees,
    count(DISTINCT e.id) FILTER (WHERE e.pernr IS NOT NULL) AS synced_to_sap,
    count(DISTINCT e.id) FILTER (WHERE e.pernr IS NULL) AS not_synced,
    ( SELECT count(*) AS count
           FROM sync_queue sq
          WHERE sq.tenant_id = t.id AND sq.status::text = 'pending'::text) AS pending_syncs,
    ( SELECT max(sl.completed_at) AS max
           FROM sync_log sl
          WHERE sl.tenant_id = t.id AND sl.status::text = 'completed'::text) AS last_sync
   FROM tenants t
     LEFT JOIN employees e ON e.tenant_id = t.id
  GROUP BY t.id, t.name, t.code
  ORDER BY t.name;


CREATE OR REPLACE VIEW public.v_sync_status AS
SELECT m.bukrs,
    t.butxt AS company_name,
    count(m.pernr) AS synced_users,
    max(m.last_sync_at) AS last_sync,
    count(
        CASE
            WHEN m.sync_status::text = 'synced'::text THEN 1
            ELSE NULL::integer
        END) AS ok_count,
    count(
        CASE
            WHEN m.sync_status::text = 'error'::text THEN 1
            ELSE NULL::integer
        END) AS error_count
   FROM user_pernr_mapping m
     JOIN t500c t ON m.bukrs::text = t.bukrs::text
  GROUP BY m.bukrs, t.butxt
  ORDER BY (count(m.pernr)) DESC;


CREATE OR REPLACE VIEW public.v_sync_status_by_tenant AS
SELECT t.tenant_name,
    t.sap_bukrs,
    count(m.user_uuid) AS synced_users,
    max(m.last_sync_at) AS last_sync
   FROM tenant_sap_mapping t
     LEFT JOIN user_pernr_mapping m ON t.sap_bukrs::text = m.bukrs::text
  GROUP BY t.tenant_name, t.sap_bukrs
  ORDER BY (count(m.user_uuid)) DESC;


CREATE OR REPLACE VIEW public.v_team_goals AS
SELECT g.id,
    g.tenant_id,
    g.employee_id,
    (e.first_name::text || ' '::text) || e.last_name::text AS employee_name,
    e.manager_id,
    (m.first_name::text || ' '::text) || m.last_name::text AS manager_name,
    d.id AS department_id,
    d.name AS department_name,
    g.title,
    g.description,
    g.goal_type,
    g.status,
    g.progress_percent,
    g.weight,
    g.priority,
    g.start_date,
    g.due_date,
    g.completed_at,
    g.parent_goal_id,
    pg.title AS parent_goal_title,
    g.is_smart_validated,
    g.smart_score,
        CASE
            WHEN g.status::text = 'completed'::text THEN 'completed'::text
            WHEN g.due_date < CURRENT_DATE AND g.status::text <> 'completed'::text THEN 'overdue'::text
            WHEN g.due_date < (CURRENT_DATE + '7 days'::interval) THEN 'due_soon'::text
            ELSE 'on_track'::text
        END AS timeline_status,
    ( SELECT count(*) AS count
           FROM goal_check_ins gc
          WHERE gc.goal_id = g.id) AS check_in_count,
    ( SELECT max(gc.check_in_date) AS max
           FROM goal_check_ins gc
          WHERE gc.goal_id = g.id) AS last_check_in
   FROM goals g
     JOIN employees e ON g.employee_id = e.id
     LEFT JOIN employees m ON e.manager_id = m.id
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN goals pg ON g.parent_goal_id = pg.id;


CREATE OR REPLACE VIEW public.v_tenant_absence_stats AS
SELECT ue.bukrs AS sap_company_code,
    p21.awart AS absence_type,
    count(*) AS record_count,
    count(DISTINCT ue.pernr) AS employees_affected,
    round(sum(p21.abwtg), 1) AS total_days,
    round(avg(p21.abwtg), 1) AS avg_days_per_record
   FROM v_unique_sap_employee ue
     JOIN pa2001 p21 ON p21.pernr::text = ue.pernr::text
  GROUP BY ue.bukrs, p21.awart;


CREATE OR REPLACE VIEW public.v_tenant_demographics AS
SELECT t.sap_company_code,
    t.id AS tenant_id,
    t.name AS tenant_name,
    e.department,
    e.gender,
    count(*) AS employee_count,
    round(avg(EXTRACT(year FROM age(e.birth_date::timestamp with time zone))), 1) AS avg_age,
    round(avg(EXTRACT(year FROM age(e.hire_date::timestamp with time zone))), 1) AS avg_tenure
   FROM tenants t
     JOIN employees e ON e.tenant_id = t.id
  WHERE e.is_active = true
  GROUP BY t.sap_company_code, t.id, t.name, e.department, e.gender;


CREATE OR REPLACE VIEW public.v_tenant_employee_profile AS
SELECT t.sap_company_code,
    t.id AS tenant_id,
    e.id AS employee_id,
    e.pernr,
    e.first_name,
    e.last_name,
    e.email,
    e.job_title,
    e.department,
    e.location,
    e.hire_date,
    e.birth_date,
    e.gender,
    e.salary,
    e.performance_rating,
    e.potential,
    e.skills,
    e.is_active
   FROM tenants t
     JOIN employees e ON e.tenant_id = t.id;


CREATE OR REPLACE VIEW public.v_tenant_inspector AS
SELECT id,
    code,
    name,
    industry_type,
    region,
    employee_count,
    status,
    ( SELECT count(*) AS count
           FROM locations l
          WHERE l.tenant_id = t.id) AS location_count,
    ( SELECT count(*) AS count
           FROM departments d
          WHERE d.tenant_id = t.id) AS department_count,
    ( SELECT count(*) AS count
           FROM employees e
          WHERE e.tenant_id = t.id AND e.is_active = true) AS active_employee_count,
    created_at,
    updated_at
   FROM tenants t;


CREATE OR REPLACE VIEW public.v_tenant_job_stats AS
SELECT t.id AS tenant_id,
    t.name AS tenant_name,
    count(DISTINCT tj.id) AS total_jobs,
    count(DISTINCT
        CASE
            WHEN tj.is_management THEN tj.id
            ELSE NULL::uuid
        END) AS management_jobs,
    sum(tj.budgeted_positions) AS total_budgeted,
    sum(tj.filled_positions) AS total_filled,
    sum(tj.budgeted_positions) - sum(tj.filled_positions) AS total_open,
    count(DISTINCT tou.id) AS org_units_with_jobs,
    count(DISTINCT tjs.esco_skill_uri) AS unique_skills_required
   FROM tenants t
     LEFT JOIN tenant_jobs tj ON t.id = tj.tenant_id AND tj.is_active = true
     LEFT JOIN tenant_org_units tou ON tj.tenant_org_unit_id = tou.id
     LEFT JOIN tenant_job_skills tjs ON tj.id = tjs.tenant_job_id
  WHERE t.status::text = 'active'::text
  GROUP BY t.id, t.name;


CREATE OR REPLACE VIEW public.v_tenant_salary_stats AS
SELECT t.sap_company_code,
    t.id AS tenant_id,
    e.department,
    e.job_title,
    count(*) AS employee_count,
    round(avg(e.salary), 0) AS avg_salary,
    round(min(e.salary), 0) AS min_salary,
    round(max(e.salary), 0) AS max_salary,
    round(sum(e.salary), 0) AS total_payroll
   FROM tenants t
     JOIN employees e ON e.tenant_id = t.id
  WHERE e.is_active = true AND e.salary IS NOT NULL
  GROUP BY t.sap_company_code, t.id, e.department, e.job_title;


CREATE OR REPLACE VIEW public.v_tenants_with_profile AS
SELECT t.id,
    t.name,
    t.code,
    t.status,
    t.nace_code AS legacy_nace_code,
    t.employee_count,
    t.annual_revenue_eur,
    t.created_at,
    t.updated_at,
    cp.id AS profile_id,
    cp.profile_code,
    cp.full_name_it AS profile_name_it,
    cp.full_name_en AS profile_name_en,
    ns.code AS section_code,
    ns.name_it AS section_name_it,
    ns.name_en AS section_name_en,
    ns.icon AS section_icon,
    ns.color AS section_color,
    nd.code AS division_code,
    nd.name_it AS division_name_it,
    nd.name_en AS division_name_en,
    ng.code AS group_code,
    ng.name_it AS group_name_it,
    ng.name_en AS group_name_en,
    cs.code AS size_code,
    cs.name_it AS size_name_it,
    cs.name_en AS size_name_en,
    cs.min_employees,
    cs.max_employees
   FROM tenants t
     LEFT JOIN company_profiles cp ON t.profile_id = cp.id
     LEFT JOIN nace_sections ns ON cp.section_code = ns.code
     LEFT JOIN nace_divisions nd ON cp.division_code::text = nd.code::text
     LEFT JOIN nace_groups ng ON cp.group_code::text = ng.code::text
     LEFT JOIN company_sizes cs ON cp.size_code::text = cs.code::text;


CREATE OR REPLACE VIEW public.v_time_balance AS
SELECT e.pernr,
    e.company_code,
    e.first_name,
    e.last_name,
    (e.first_name::text || ' '::text) || e.last_name::text AS full_name,
    q.ktart AS quota_type,
    c.config_value AS quota_description,
    q.anzhl AS entitlement,
    q.kession AS used,
    q.remainder AS balance,
    q.unit,
    q.begda AS period_start,
    q.endda AS period_end
   FROM v_employee_master e
     JOIN pa2006 q ON e.pernr::text = q.pernr::text AND CURRENT_DATE >= q.begda AND CURRENT_DATE <= q.endda
     LEFT JOIN sap_config c ON c.config_key::text = ('QUOTA_TYPE_'::text || q.ktart::text)
  ORDER BY e.pernr, q.ktart;


CREATE OR REPLACE VIEW public.v_total_rewards_statement_cluster AS
SELECT employee_id,
    tenant_id,
    employee_number,
    employee_name,
    job_title,
    department,
    location,
    hire_date,
    base_salary,
    salary_currency,
    salary_band_id,
    band_name,
    band_level,
    band_min,
    band_mid,
    band_max,
    compa_ratio,
    range_penetration,
    market_position,
    band_position,
    dept_salary_ratio,
    bonus_last_year,
    total_cash_compensation,
    band_assigned_at,
    last_updated
   FROM analytics.v_total_rewards_statement;


CREATE OR REPLACE VIEW public.v_turnover_analysis AS
SELECT t.id AS tenant_id,
    t.code AS tenant_code,
    t.name AS tenant_name,
    count(
        CASE
            WHEN e.is_active = true THEN 1
            ELSE NULL::integer
        END) AS active_count,
    count(
        CASE
            WHEN e.is_active = false THEN 1
            ELSE NULL::integer
        END) AS inactive_count,
    round(100.0 * count(
        CASE
            WHEN e.is_active = false THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(*), 0)::numeric, 2) AS turnover_rate,
    round(avg(
        CASE
            WHEN e.is_active = false THEN EXTRACT(year FROM age(e.hire_date::timestamp with time zone))
            ELSE NULL::numeric
        END), 1) AS avg_tenure_leavers,
    e.department,
    count(*) AS dept_total
   FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
  GROUP BY t.id, t.code, t.name, e.department;


CREATE OR REPLACE VIEW public.v_unified_employee AS
SELECT e.id AS employee_id,
    e.pernr AS sap_pernr,
    COALESCE(ext.tenant_id, e.tenant_id) AS tenant_id,
    t.code AS tenant_code,
    t.name AS tenant_name,
    t.sap_company_code,
    COALESCE(p2.vorna, e.first_name) AS first_name,
    COALESCE(p2.nachn, e.last_name) AS last_name,
    e.email,
    p2.gbdat AS birth_date,
        CASE p2.gesch
            WHEN '1'::text THEN 'Male'::text
            WHEN '2'::text THEN 'Female'::text
            ELSE 'Other'::text
        END AS gender,
    p2.natio AS nationality,
    e.job_title,
    e.department,
    e.location,
    p1.orgeh AS sap_org_unit,
    p1.plans AS sap_position,
    p1.kostl AS sap_cost_center,
    p8.ansal AS annual_salary,
    p8.waession AS currency,
    p105_phone.usrid_long AS phone,
    COALESCE(ext.is_active, e.is_active) AS is_active,
    e.hire_date,
    COALESCE(ext.skills, e.skills) AS skills,
    COALESCE(ext.performance_rating, e.performance_rating) AS performance_rating,
    COALESCE(ext.potential, e.potential) AS potential,
    COALESCE(( SELECT m.id
           FROM employees m
          WHERE m.pernr::text = ext.manager_pernr::text), e.manager_id) AS manager_id,
    u.id AS user_id,
    u.username,
    u.role AS user_role,
    e.created_at,
    COALESCE(ext.updated_at, e.updated_at) AS updated_at
   FROM employees e
     JOIN tenants t ON e.tenant_id = t.id
     LEFT JOIN ext_pa0002 ext ON e.pernr::text = ext.pernr::text
     LEFT JOIN pa0001 p1 ON e.pernr::text = p1.pernr::text AND p1.endda >= CURRENT_DATE
     LEFT JOIN pa0002 p2 ON e.pernr::text = p2.pernr::text AND p2.endda >= CURRENT_DATE
     LEFT JOIN pa0008 p8 ON e.pernr::text = p8.pernr::text AND p8.endda >= CURRENT_DATE
     LEFT JOIN pa0105 p105_phone ON e.pernr::text = p105_phone.pernr::text AND p105_phone.subty::text = '0020'::text AND p105_phone.endda >= CURRENT_DATE
     LEFT JOIN users u ON u.employee_id = e.id;


CREATE OR REPLACE VIEW public.v_unified_skills AS
SELECT 'esco'::text AS source,
    es.id,
    es.uri AS external_id,
    es.preferred_label_en AS name,
    es.description_en AS description,
    es.skill_type AS category,
    es.embedding_en AS embedding,
    NULL::uuid AS mapped_to_onet,
    NULL::uuid AS mapped_to_esco
   FROM esco_skills es
UNION ALL
 SELECT 'onet_skill'::text AS source,
    os.id,
    os.element_id AS external_id,
    os.element_name AS name,
    os.description,
    os.category,
    os.embedding_en AS embedding,
    NULL::uuid AS mapped_to_onet,
    os.mapped_esco_skill_id AS mapped_to_esco
   FROM onet_skills os
UNION ALL
 SELECT 'onet_ability'::text AS source,
    oa.id,
    oa.element_id AS external_id,
    oa.element_name AS name,
    oa.description,
    oa.category,
    oa.embedding_en AS embedding,
    NULL::uuid AS mapped_to_onet,
    oa.mapped_esco_skill_id AS mapped_to_esco
   FROM onet_abilities oa
UNION ALL
 SELECT 'onet_knowledge'::text AS source,
    ok.id,
    ok.element_id AS external_id,
    ok.element_name AS name,
    ok.description,
    ok.domain AS category,
    ok.embedding_en AS embedding,
    NULL::uuid AS mapped_to_onet,
    ok.mapped_esco_skill_id AS mapped_to_esco
   FROM onet_knowledge ok;


CREATE OR REPLACE VIEW public.v_unknown_skills_review_queue AS
SELECT us.id,
    us.tenant_id,
    t.name AS tenant_name,
    us.raw_text,
    us.occurrence_count,
    us.first_seen_at,
    us.last_seen_at,
    us.suggested_esco_id,
    es.preferred_label_en AS suggested_skill_name,
    us.suggested_confidence,
    us.review_status
   FROM unknown_skills us
     JOIN tenants t ON t.id = us.tenant_id
     LEFT JOIN esco_skills es ON es.id = us.suggested_esco_id
  WHERE us.review_status::text = ANY (ARRAY['pending'::character varying, 'suggested'::character varying, 'low_confidence'::character varying]::text[])
  ORDER BY us.occurrence_count DESC, us.last_seen_at DESC;


CREATE OR REPLACE VIEW public.v_upcoming_interviews AS
SELECT i.id,
    i.tenant_id,
    i.candidate_id,
    i.job_posting_id,
    i.interview_type,
    i.title,
    i.scheduled_at,
    i.duration_minutes,
    i.location_type,
    i.meeting_link,
    i.status,
    i.created_at,
    array_agg(DISTINCT COALESCE(p.external_name, u.username, ((e.first_name::text || ' '::text) || e.last_name::text)::character varying)) FILTER (WHERE p.id IS NOT NULL) AS interviewers
   FROM recruiting_interviews i
     LEFT JOIN recruiting_interview_participants p ON i.id = p.interview_id
     LEFT JOIN users u ON p.user_id = u.id
     LEFT JOIN employees e ON p.employee_id = e.id
  WHERE i.scheduled_at >= now() AND (i.status::text = ANY (ARRAY['scheduled'::character varying::text, 'confirmed'::character varying::text]))
  GROUP BY i.id;


CREATE OR REPLACE VIEW public.v_whistleblowing_dashboard AS
SELECT tenant_id,
    count(*) AS total_reports,
    count(*) FILTER (WHERE status::text = 'submitted'::text) AS new_reports,
    count(*) FILTER (WHERE status::text = ANY (ARRAY['under_review'::character varying::text, 'investigating'::character varying::text])) AS active_investigations,
    count(*) FILTER (WHERE status::text = 'resolved'::text) AS resolved_reports,
    count(*) FILTER (WHERE status::text = 'escalated'::text) AS escalated_reports,
    count(*) FILTER (WHERE severity::text = 'critical'::text) AS critical_reports,
    count(*) FILTER (WHERE acknowledgement_sent = false AND created_at < (now() - '7 days'::interval)) AS overdue_acknowledgements,
    avg(EXTRACT(epoch FROM COALESCE(updated_at::timestamp with time zone, now()) - created_at::timestamp with time zone) / 86400::numeric)::integer AS avg_resolution_days
   FROM whistleblowing_reports wr
  GROUP BY tenant_id;


CREATE OR REPLACE VIEW public.v_workforce_overview AS
SELECT t.id AS tenant_id,
    t.name AS tenant_name,
    count(DISTINCT e.id) AS total_employees,
    count(DISTINCT e.id) FILTER (WHERE e.is_active = true) AS active_employees,
    count(DISTINCT e.location_id) AS location_count,
    count(DISTINCT e.department) AS department_count,
    avg(EXTRACT(year FROM age(CURRENT_DATE::timestamp without time zone, e.hire_date::timestamp without time zone))) AS avg_tenure_years
   FROM tenants t
     LEFT JOIN employees e ON e.tenant_id = t.id
  GROUP BY t.id, t.name;


CREATE OR REPLACE VIEW public.v_workforce_planning_dashboard_cluster AS
SELECT tenant_id,
    tenant_name,
    industry_type,
    total_headcount,
    active_employees,
    new_hires_30d,
    new_hires_90d,
    terminations_30d,
    terminations_90d,
    turnover_rate_annual,
    net_change_90d,
    critical_roles_count,
    roles_with_ready_successor,
    high_flight_risk_count,
    medium_flight_risk_count,
    top_talent_count,
    solid_performers_count,
    needs_action_count,
    avg_tenure_years,
    tenure_under_1y,
    tenure_1_3y,
    tenure_3_5y,
    tenure_over_5y,
    avg_span_of_control,
    max_span_of_control
   FROM analytics.v_workforce_planning_dashboard;


-- Total: 128 views




COMMIT;
