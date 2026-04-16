-- Migration 146: Enforce NOT NULL on tenant_id columns
-- Generated from live schema analysis: 90 tables
-- Backfills NULL rows with the single existing tenant, then sets NOT NULL

BEGIN;

-- Backfill 441 NULL rows in job_templates
UPDATE job_templates SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Backfill 46 NULL rows in payroll_field_mappings
UPDATE payroll_field_mappings SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Backfill 11 NULL rows in payroll_validation_rules
UPDATE payroll_validation_rules SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Set NOT NULL on all tenant_id columns
ALTER TABLE ai_usage_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE analytics_aggregations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE analytics_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE benchmark_configs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE bonus_plans ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE calibration_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE career_paths ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE certifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE compliance_training_requirements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE continuous_feedback ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE courses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE critical_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE cross_entity_searches ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE dashboard_widgets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE dashboards ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE data_subject_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE embedding_queue ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_benefits ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_clubs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_time_off_balances ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_time_off_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE error_analytics_hourly ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE error_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE export_configurations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE export_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ext_hrp1007 ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ext_pa0002 ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ext_pb0002 ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE feedback_360 ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE goals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE holidays ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE internal_job_postings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE job_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE key_results ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE learning_content_providers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE learning_paths ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE market_salary_data ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE merit_cycles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE model_predictions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE onboarding_instances ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE onboarding_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ontology_embedding_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ontology_inference_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payroll_anomaly_patterns ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payroll_field_mappings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payroll_validation_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE performance_predictions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE performance_reviews ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE preboarding_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE preboarding_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE preboarding_welcome_content ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE prediction_model_accuracy ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE predictive_models ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag_documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag_knowledge_bases ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag_provider_keys ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag_usage_stats ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recognition ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recruiting_candidates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recruiting_interview_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recruiting_interviewer_availability ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recruiting_interviews ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recruiting_offers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recruiting_requisitions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_definitions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_delivery_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_subscriptions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE role_permissions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE role_skill_requirements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE salary_bands ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sap_infotype_mappings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE semantic_search_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE signature_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skill_extraction_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skill_pair_usage ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE social_posts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sso_configurations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE survey_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE surveys ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sync_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sync_queue ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE turnover_risk_scores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE wellbeing_resources ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE whistleblowing_handlers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE whistleblowing_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE whistleblowing_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE widget_templates ALTER COLUMN tenant_id SET NOT NULL;

COMMIT;
