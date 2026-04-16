-- Migration 122: FK Hardening Batch 2 — course_id, department_id, skill_id, approver_id, job_posting_id, position_id
-- Fase 1c del piano unificato gestione relazioni

BEGIN;

-- ============================================
-- course_id → courses (8 tabelle)
-- CASCADE per enrollments/modules, SET NULL per ratings/bookmarks
-- ============================================

ALTER TABLE course_modules ADD CONSTRAINT fk_cm_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE course_esco_skills ADD CONSTRAINT fk_ces_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE compliance_training_requirements ADD CONSTRAINT fk_ctr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE course_enrollments_semantic ADD CONSTRAINT fk_cese_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE learning_path_courses ADD CONSTRAINT fk_lpc_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE learning_ratings ADD CONSTRAINT fk_lra_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE learning_bookmarks ADD CONSTRAINT fk_lb_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE learning_recommendations ADD CONSTRAINT fk_lrec_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

-- ============================================
-- department_id → departments (3 tabelle)
-- SET NULL: department can be restructured
-- ============================================

ALTER TABLE employees_staging ADD CONSTRAINT fk_es_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE job_postings ADD CONSTRAINT fk_jp_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
-- org_units.department_id: SET NULL (org unit can exist without specific department)
ALTER TABLE org_units ADD CONSTRAINT fk_ou_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================
-- skill_id → esco_skills (1 tabella)
-- NO ACTION: reference data
-- ============================================

ALTER TABLE career_skills ADD CONSTRAINT fk_cs_skill FOREIGN KEY (skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

-- ============================================
-- approver_id → employees (3 tabelle)
-- SET NULL: approver can change
-- ============================================

ALTER TABLE employee_requests ADD CONSTRAINT fk_er_approver FOREIGN KEY (approver_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employee_time_off_requests ADD CONSTRAINT fk_etor_approver FOREIGN KEY (approver_id) REFERENCES employees(id) ON DELETE SET NULL;
-- leave_requests is a VIEW (not a table), skip FK

-- ============================================
-- job_posting_id → internal_job_postings (5 tabelle)
-- CASCADE for views/bookmarks (transient), SET NULL for applications (historical)
-- ============================================

ALTER TABLE internal_applications ADD CONSTRAINT fk_ia_posting FOREIGN KEY (job_posting_id) REFERENCES internal_job_postings(id) ON DELETE SET NULL;
ALTER TABLE internal_job_views ADD CONSTRAINT fk_ijv_posting FOREIGN KEY (job_posting_id) REFERENCES internal_job_postings(id) ON DELETE CASCADE;
ALTER TABLE internal_job_bookmarks ADD CONSTRAINT fk_ijb_posting FOREIGN KEY (job_posting_id) REFERENCES internal_job_postings(id) ON DELETE CASCADE;
ALTER TABLE saved_jobs ADD CONSTRAINT fk_sj_posting FOREIGN KEY (job_posting_id) REFERENCES internal_job_postings(id) ON DELETE CASCADE;
ALTER TABLE recruiting_interviews ADD CONSTRAINT fk_ri_posting FOREIGN KEY (job_posting_id) REFERENCES internal_job_postings(id) ON DELETE SET NULL;

-- ============================================
-- position_id → job_templates (1 tabella, UUID)
-- SET NULL: template can be recreated
-- ============================================

ALTER TABLE position_skill_requirements ADD CONSTRAINT fk_psr_position FOREIGN KEY (position_id) REFERENCES job_templates(id) ON DELETE SET NULL;

-- ============================================
-- LOG
-- ============================================

INSERT INTO _migration_cleanup_log (phase, operation, details) VALUES
  ('1c', 'add_fk_course_id', '{"tables": 8, "cascade": 5, "set_null": 3}'::jsonb),
  ('1c', 'add_fk_department_id', '{"tables": 3, "policy": "SET NULL"}'::jsonb),
  ('1c', 'add_fk_skill_id', '{"tables": 1, "policy": "NO ACTION"}'::jsonb),
  ('1c', 'add_fk_approver_id', '{"tables": 3, "policy": "SET NULL"}'::jsonb),
  ('1c', 'add_fk_job_posting_id', '{"tables": 5}'::jsonb),
  ('1c', 'add_fk_position_id', '{"tables": 1, "policy": "SET NULL"}'::jsonb);

INSERT INTO schema_migrations (version) VALUES ('122_fk_hardening_batch2');

COMMIT;
