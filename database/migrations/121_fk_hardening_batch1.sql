-- Migration 121: FK Hardening Batch 1 — employee_id, user_id, manager_id + Policy Corrections
-- Fase 1b del piano unificato gestione relazioni
-- Prerequisito: Migration 120 (cleanup) completata con successo

BEGIN;

-- ============================================
-- PART A: ADD FK — employee_id (37 tabelle fisiche)
-- ============================================
-- Decision matrix:
--   Junction/child tables (employee_*, *_enrollments, *_assignments) → CASCADE
--   Storico/log/audit → SET NULL
--   Remaining → SET NULL (safe default for master data ref)

-- CASCADE: tabelle junction/child la cui vita dipende dall'employee
ALTER TABLE employee_benefit_enrollments ADD CONSTRAINT fk_ebe_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_career_paths ADD CONSTRAINT fk_ecp_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_job_assignments ADD CONSTRAINT fk_eja_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_kpi_targets ADD CONSTRAINT fk_ekt_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_occupations ADD CONSTRAINT fk_eo_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_pay_stubs ADD CONSTRAINT fk_eps_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_requests ADD CONSTRAINT fk_er_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_skill_assessments ADD CONSTRAINT fk_esa_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_time_off_balances ADD CONSTRAINT fk_etob_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_time_off_requests ADD CONSTRAINT fk_etor_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE salary_band_assignments ADD CONSTRAINT fk_sba_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE talent_pool_members ADD CONSTRAINT fk_tpm_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE course_enrollments_semantic ADD CONSTRAINT fk_ces_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE wellbeing_checkins ADD CONSTRAINT fk_wc_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE wellbeing_goals ADD CONSTRAINT fk_wg_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE wellbeing_program_enrollments ADD CONSTRAINT fk_wpe_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE onboarding_instances ADD CONSTRAINT fk_oi_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE skill_development_paths ADD CONSTRAINT fk_sdp_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE club_memberships ADD CONSTRAINT fk_cm_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- SET NULL: tabelle dove employee è referenza soft o storico
ALTER TABLE bonus_allocations ADD CONSTRAINT fk_ba_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE burnout_assessments ADD CONSTRAINT fk_bua_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE internal_applications ADD CONSTRAINT fk_ia_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE internal_job_alerts ADD CONSTRAINT fk_ija_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE internal_job_bookmarks ADD CONSTRAINT fk_ijb_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE internal_job_views ADD CONSTRAINT fk_ijv_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE internal_mobility_requests ADD CONSTRAINT fk_imr_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE learning_bookmarks ADD CONSTRAINT fk_lb_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE learning_ratings ADD CONSTRAINT fk_lra_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE learning_recommendations ADD CONSTRAINT fk_lrec_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE merit_recommendations ADD CONSTRAINT fk_mr_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE performance_trends ADD CONSTRAINT fk_pt_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE pulse_checks ADD CONSTRAINT fk_pc_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE recruiting_interview_participants ADD CONSTRAINT fk_rip_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE saved_jobs ADD CONSTRAINT fk_sj_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE signature_recipients ADD CONSTRAINT fk_sr_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE social_likes ADD CONSTRAINT fk_sl_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE survey_responses ADD CONSTRAINT fk_svr_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================
-- PART B: ADD FK — user_id (14 tabelle fisiche)
-- ============================================
-- All SET NULL: users are master data, preserve audit trail

ALTER TABLE ai_usage_log ADD CONSTRAINT fk_aul_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE analytics_events ADD CONSTRAINT fk_ae_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cross_entity_searches ADD CONSTRAINT fk_ces_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE document_comments ADD CONSTRAINT fk_dc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notification_preferences ADD CONSTRAINT fk_np_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT fk_n_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE plugin_reviews ADD CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rag_sessions ADD CONSTRAINT fk_rs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE recruiting_interview_participants ADD CONSTRAINT fk_rip_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE recruiting_interviewer_availability ADD CONSTRAINT fk_ria_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE semantic_search_log ADD CONSTRAINT fk_ssl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE whistleblowing_audit_log ADD CONSTRAINT fk_wal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE whistleblowing_handlers ADD CONSTRAINT fk_wh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- PART C: ADD FK — manager_id (4 tabelle fisiche)
-- ============================================
-- All SET NULL: manager can change

ALTER TABLE calibration_participants ADD CONSTRAINT fk_cp_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees_staging ADD CONSTRAINT fk_es_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE org_units ADD CONSTRAINT fk_ou_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE preboarding_sessions ADD CONSTRAINT fk_ps_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================
-- PART D: FIX POLICY — esco_skills CASCADE → NO ACTION (15 FK)
-- Reference data esterna immutabile: mai cascadare delete
-- ============================================

ALTER TABLE employee_skill_profiles DROP CONSTRAINT employee_skill_profiles_skill_id_fkey;
ALTER TABLE employee_skill_profiles ADD CONSTRAINT employee_skill_profiles_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE esco_occupation_skills DROP CONSTRAINT esco_occupation_skills_skill_id_fkey;
ALTER TABLE esco_occupation_skills ADD CONSTRAINT esco_occupation_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE esco_skill_relations DROP CONSTRAINT esco_skill_relations_target_skill_id_fkey;
ALTER TABLE esco_skill_relations ADD CONSTRAINT esco_skill_relations_target_skill_id_fkey FOREIGN KEY (target_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE esco_skill_relations DROP CONSTRAINT esco_skill_relations_source_skill_id_fkey;
ALTER TABLE esco_skill_relations ADD CONSTRAINT esco_skill_relations_source_skill_id_fkey FOREIGN KEY (source_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE ontology_skill_dimensions DROP CONSTRAINT ontology_skill_dimensions_esco_skill_id_fkey;
ALTER TABLE ontology_skill_dimensions ADD CONSTRAINT ontology_skill_dimensions_esco_skill_id_fkey FOREIGN KEY (esco_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE ontology_skill_relations DROP CONSTRAINT ontology_skill_relations_target_skill_id_fkey;
ALTER TABLE ontology_skill_relations ADD CONSTRAINT ontology_skill_relations_target_skill_id_fkey FOREIGN KEY (target_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE ontology_skill_relations DROP CONSTRAINT ontology_skill_relations_source_skill_id_fkey;
ALTER TABLE ontology_skill_relations ADD CONSTRAINT ontology_skill_relations_source_skill_id_fkey FOREIGN KEY (source_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE role_skill_requirements DROP CONSTRAINT role_skill_requirements_skill_id_fkey;
ALTER TABLE role_skill_requirements ADD CONSTRAINT role_skill_requirements_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_adjacencies DROP CONSTRAINT skill_adjacencies_adjacent_skill_id_fkey;
ALTER TABLE skill_adjacencies ADD CONSTRAINT skill_adjacencies_adjacent_skill_id_fkey FOREIGN KEY (adjacent_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_adjacencies DROP CONSTRAINT skill_adjacencies_skill_id_fkey;
ALTER TABLE skill_adjacencies ADD CONSTRAINT skill_adjacencies_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_classifications DROP CONSTRAINT skill_classifications_esco_skill_id_fkey;
ALTER TABLE skill_classifications ADD CONSTRAINT skill_classifications_esco_skill_id_fkey FOREIGN KEY (esco_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_pair_usage DROP CONSTRAINT skill_pair_usage_skill_id_2_fkey;
ALTER TABLE skill_pair_usage ADD CONSTRAINT skill_pair_usage_skill_id_2_fkey FOREIGN KEY (skill_id_2) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_pair_usage DROP CONSTRAINT skill_pair_usage_skill_id_1_fkey;
ALTER TABLE skill_pair_usage ADD CONSTRAINT skill_pair_usage_skill_id_1_fkey FOREIGN KEY (skill_id_1) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_relationships DROP CONSTRAINT skill_relationships_target_skill_id_fkey;
ALTER TABLE skill_relationships ADD CONSTRAINT skill_relationships_target_skill_id_fkey FOREIGN KEY (target_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

ALTER TABLE skill_relationships DROP CONSTRAINT skill_relationships_source_skill_id_fkey;
ALTER TABLE skill_relationships ADD CONSTRAINT skill_relationships_source_skill_id_fkey FOREIGN KEY (source_skill_id) REFERENCES esco_skills(id) ON DELETE NO ACTION;

-- ============================================
-- PART E: FIX POLICY — contract_amendments CASCADE → NO ACTION (storico)
-- ============================================

ALTER TABLE contract_amendments DROP CONSTRAINT contract_amendments_contract_id_fkey;
ALTER TABLE contract_amendments ADD CONSTRAINT contract_amendments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE NO ACTION;

-- ============================================
-- PART F: FIX POLICY — news_* CASCADE → SET NULL (5 FK)
-- Preservare contenuto anche se autore eliminato
-- ============================================

ALTER TABLE news_articles DROP CONSTRAINT news_articles_author_id_fkey;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE news_bookmarks DROP CONSTRAINT news_bookmarks_user_id_fkey;
ALTER TABLE news_bookmarks ADD CONSTRAINT news_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE news_comments DROP CONSTRAINT news_comments_user_id_fkey;
ALTER TABLE news_comments ADD CONSTRAINT news_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE news_reactions DROP CONSTRAINT news_reactions_user_id_fkey;
ALTER TABLE news_reactions ADD CONSTRAINT news_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE news_reads DROP CONSTRAINT news_reads_user_id_fkey;
ALTER TABLE news_reads ADD CONSTRAINT news_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- PART G: FIX POLICY — employees junction FK NO ACTION → CASCADE
-- Rule: tables matching employee_* pattern with employee_id column → CASCADE
-- Only primary employee_id FK, NOT *_by_employee_id (actor references stay NO ACTION)
-- ============================================

ALTER TABLE employee_addresses DROP CONSTRAINT employee_addresses_employee_id_fkey;
ALTER TABLE employee_addresses ADD CONSTRAINT employee_addresses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_bank_details DROP CONSTRAINT employee_bank_details_employee_id_fkey;
ALTER TABLE employee_bank_details ADD CONSTRAINT employee_bank_details_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_emergency_contacts DROP CONSTRAINT employee_emergency_contacts_employee_id_fkey;
ALTER TABLE employee_emergency_contacts ADD CONSTRAINT employee_emergency_contacts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_training_records DROP CONSTRAINT employee_training_records_employee_id_fkey;
ALTER TABLE employee_training_records ADD CONSTRAINT employee_training_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- employee_contracts stays NO ACTION (historical/compliance data)
-- All *_by_employee_id, verified_by, uploaded_by, signed_by, etc. stay NO ACTION (actor references)

-- ============================================
-- LOG
-- ============================================

INSERT INTO _migration_cleanup_log (phase, operation, details) VALUES
  ('1b', 'add_fk_employee_id', '{"tables": 37, "cascade": 19, "set_null": 18}'::jsonb),
  ('1b', 'add_fk_user_id', '{"tables": 14, "policy": "SET NULL"}'::jsonb),
  ('1b', 'add_fk_manager_id', '{"tables": 4, "policy": "SET NULL"}'::jsonb),
  ('1b', 'fix_esco_skills_cascade', '{"constraints_fixed": 15, "from": "CASCADE", "to": "NO ACTION"}'::jsonb),
  ('1b', 'fix_contract_amendments', '{"from": "CASCADE", "to": "NO ACTION"}'::jsonb),
  ('1b', 'fix_news_cascade', '{"constraints_fixed": 5, "from": "CASCADE", "to": "SET NULL"}'::jsonb),
  ('1b', 'fix_employee_junction_noaction', '{"constraints_fixed": 4, "from": "NO ACTION", "to": "CASCADE"}'::jsonb);

-- Track migration
INSERT INTO schema_migrations (version) VALUES ('121_fk_hardening_batch1');

COMMIT;
