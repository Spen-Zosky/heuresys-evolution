-- Migration 115: Add critical FK constraints on columns missing them
-- Only adds FKs where data integrity has been verified (zero orphaned records)
-- Date: 2026-03-18

BEGIN;

-- =============================================================================
-- tenant_id -> tenants(id) — 14 tables
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_records_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE calibration_participants ADD CONSTRAINT fk_calibration_participants_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE course_enrollments ADD CONSTRAINT fk_course_enrollments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE embedding_queue ADD CONSTRAINT fk_embedding_queue_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE internal_mobility_requests ADD CONSTRAINT fk_internal_mobility_requests_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE job_postings ADD CONSTRAINT fk_job_postings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE learning_path_enrollments ADD CONSTRAINT fk_learning_path_enrollments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE performance_trends ADD CONSTRAINT fk_performance_trends_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE semantic_entity_index ADD CONSTRAINT fk_semantic_entity_index_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE succession_plans ADD CONSTRAINT fk_succession_plans_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE talent_pool_members ADD CONSTRAINT fk_talent_pool_members_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE talent_pools ADD CONSTRAINT fk_talent_pools_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- employee_id -> employees(id) — 14 tables (only where zero orphans)
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_records_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bonus_allocations ADD CONSTRAINT fk_bonus_allocations_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE employee_career_paths ADD CONSTRAINT fk_employee_career_paths_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE employee_job_assignments ADD CONSTRAINT fk_employee_job_assignments_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE employee_kpi_targets ADD CONSTRAINT fk_employee_kpi_targets_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE employee_time_off_balances ADD CONSTRAINT fk_employee_time_off_balances_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE employee_time_off_requests ADD CONSTRAINT fk_employee_time_off_requests_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE merit_recommendations ADD CONSTRAINT fk_merit_recommendations_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE onboarding_instances ADD CONSTRAINT fk_onboarding_instances_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE performance_trends ADD CONSTRAINT fk_performance_trends_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE salary_band_assignments ADD CONSTRAINT fk_salary_band_assignments_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE survey_responses ADD CONSTRAINT fk_survey_responses_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- user_id -> users(id) — 3 tables
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- department_id -> departments(id) — 1 table
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE org_units ADD CONSTRAINT fk_org_units_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Record migration
-- =============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (115, '115_add_critical_fk_constraints', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
