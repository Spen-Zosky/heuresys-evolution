-- Migration 118: Platform Pages Registry
-- Stores the page map for the SUPERUSER Panoramica dashboard.
-- Each row represents a navigable page in the platform.

CREATE TABLE IF NOT EXISTS platform_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key VARCHAR(50) NOT NULL,
  section_title VARCHAR(100) NOT NULL,
  section_desc TEXT,
  section_color VARCHAR(60) DEFAULT 'bg-gray-500/10 text-gray-600',
  section_icon VARCHAR(30) DEFAULT 'Compass',
  section_order INT NOT NULL DEFAULT 0,
  path VARCHAR(200) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redirect', 'legacy', 'experimental')),
  redirect_to VARCHAR(200),
  page_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_pages_section ON platform_pages(section_key);
CREATE INDEX idx_platform_pages_status ON platform_pages(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_platform_pages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_platform_pages_updated
  BEFORE UPDATE ON platform_pages
  FOR EACH ROW EXECUTE FUNCTION update_platform_pages_timestamp();

-- ============================================================================
-- SEED DATA: All platform pages (19 sections, 114 pages)
-- ============================================================================

INSERT INTO platform_pages (section_key, section_title, section_desc, section_color, section_icon, section_order, path, name, description, tags, status, redirect_to, page_order) VALUES
-- Section 1: Platform Dashboard
('platform', 'Platform Dashboard', 'Gestione piattaforma globale — tenant, utenti, database, sicurezza', 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform', 'Platform Dashboard', 'KPI piattaforma, lista tenant, stato DB', '{tenants,users,employees}', 'active', NULL, 1),
('platform', 'Platform Dashboard', NULL, 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform/tenants', 'Tenants', 'Gestione tenant', '{tenants}', 'active', NULL, 2),
('platform', 'Platform Dashboard', NULL, 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform/users', 'Users', 'Utenti piattaforma', '{users,role_permissions,permissions}', 'active', NULL, 3),
('platform', 'Platform Dashboard', NULL, 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform/database', 'Database', 'Stato e metriche database', '{audit_logs,error_logs}', 'active', NULL, 4),
('platform', 'Platform Dashboard', NULL, 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform/security', 'Security', 'Sicurezza piattaforma', '{audit_logs,login_attempts,sso}', 'active', NULL, 5),
('platform', 'Platform Dashboard', NULL, 'bg-blue-500/10 text-blue-600', 'LayoutDashboard', 1, '/platform/settings', 'Settings', 'Impostazioni piattaforma', '{service_config,platform_features,feature_modules}', 'active', NULL, 6),

-- Section 2: Company PET Analytics
('company-pet', 'Company PET Analytics', 'Hub analitico organizzativo — struttura, costi, workforce, scenari', 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet', 'Company PET Hub', 'Hub centrale (7 sezioni)', '{departments,org_units,employees,cost_centers,locations}', 'active', NULL, 1),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/breakdowns', 'Cost Breakdowns', 'Analisi costi HR, dipartimenti, centri di costo', '{cost_centers,departments,salary_bands,salary_history}', 'active', NULL, 2),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/hierarchy', 'Organization Hierarchy', 'Struttura organizzativa ad albero', '{org_units,org_levels,org_areas}', 'active', NULL, 3),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/org-chart', 'Org Chart', 'Organigramma interattivo — duplicato di /admin/org-chart', '{org_units,employees}', 'legacy', NULL, 4),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/organization', 'Organization Overview', 'Hub analytics, performance, talent pool', '{departments,employees}', 'active', NULL, 5),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/organization/analytics', 'Org Analytics', 'KPI organizzazione e trend', '{analytics_aggregations}', 'active', NULL, 6),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/organization/performance', 'Org Performance', 'Performance aggregata, obiettivi, valutazioni', '{performance_reviews,goals}', 'active', NULL, 7),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/organization/talent', 'Org Talent', 'Pool talenti, gap competenze, piani successione', '{employee_skills,succession_plans}', 'active', NULL, 8),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/workforce', 'Workforce Analytics', 'Hub analytics forza lavoro', '{employees,departments}', 'active', NULL, 9),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/workforce/demographics', 'Demographics', 'Eta, genere, seniority, contratti', '{employees,employee_contracts}', 'active', NULL, 10),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/workforce/locations', 'Locations', 'Distribuzione geografica', '{locations,employees}', 'active', NULL, 11),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/sessions', 'Analysis Sessions', 'Sessioni di analisi PET e storico', '{pet_sessions}', 'experimental', NULL, 12),
('company-pet', 'Company PET Analytics', NULL, 'bg-purple-500/10 text-purple-600', 'Building2', 2, '/company-pet/staging-comparison', 'Staging Comparison', 'Confronto side-by-side scenari organizzativi', '{pet_scenarios}', 'experimental', NULL, 13),

-- Section 3: Dashboards Hub
('dashboards', 'Dashboards Hub', 'Prototipazione dashboard e esplorazione tassonomie ESCO/NACE', 'bg-teal-500/10 text-teal-600', 'Globe', 3, '/dashboards', 'Dashboards Hub', 'Hub con link alle sotto-dashboard', '{dashboards}', 'active', NULL, 1),
('dashboards', 'Dashboards Hub', NULL, 'bg-teal-500/10 text-teal-600', 'Globe', 3, '/dashboards/taxonomies', 'Taxonomy Explorer', 'Ricerca ESCO (skills, occupazioni) + NACE (attivita economiche)', '{esco_skills,esco_occupations}', 'active', NULL, 2),
('dashboards', 'Dashboards Hub', NULL, 'bg-teal-500/10 text-teal-600', 'Globe', 3, '/dashboards/prototyping', 'Dashboard Prototyping', 'Prototipazione dashboard con widget configurabili', '{dashboards}', 'experimental', NULL, 3),

-- Section 4: HR Core Management
('hr-core', 'HR Core Management', 'Gestione CRUD — le sotto-pagine sono redirect alle pagine admin standalone', 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/hr-core', 'HR Core Hub', 'Hub navigazione HR core — pagina indice', '{employees,departments,org_units}', 'active', NULL, 1),
('hr-core', 'HR Core Management', NULL, 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/hr-core/employees', 'Employees', 'Redirect a /admin/employees', '{employees}', 'redirect', '/admin/employees', 2),
('hr-core', 'HR Core Management', NULL, 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/hr-core/departments', 'Departments', 'Redirect a /admin/departments', '{departments}', 'redirect', '/admin/departments', 3),
('hr-core', 'HR Core Management', NULL, 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/hr-core/org-units', 'Org Units', 'Redirect a /admin/org-units', '{org_units}', 'redirect', '/admin/org-units', 4),
('hr-core', 'HR Core Management', NULL, 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/hr-core/locations', 'Locations', 'Redirect a /admin/locations', '{locations}', 'redirect', '/admin/locations', 5),
('hr-core', 'HR Core Management', NULL, 'bg-blue-500/10 text-blue-600', 'Users', 4, '/admin/hr-core/cost-centers', 'Cost Centers', 'Redirect a /admin/cost-centers', '{cost_centers}', 'redirect', '/admin/cost-centers', 6),

-- Section 5: Talent Management
('talent', 'Talent Management', 'Skills, ESCO explorer, profili competenza, career paths, succession planning', 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent', 'Talent Hub', 'Hub talent management (9 sezioni)', '{employee_skills,esco_skills}', 'active', NULL, 1),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/skills', 'Skills', 'Redirect a /admin/skills', '{employee_skills}', 'redirect', '/admin/skills', 2),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/esco-explorer', 'ESCO Explorer', 'Browser ESCO — skills, competenze, occupazioni', '{esco_skills,esco_occupations}', 'active', NULL, 3),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/skill-profiles', 'Skill Profiles', 'Profili competenza per ruolo', '{skill_profiles}', 'active', NULL, 4),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/gap-analysis', 'Gap Analysis', 'Gap analysis tra competenze attuali e richieste', '{skill_gap_analyses}', 'active', NULL, 5),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/career-paths', 'Career Paths', 'Percorsi di carriera e progressioni', '{career_paths}', 'active', NULL, 6),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/assessments', 'Assessments', 'Valutazioni competenze', '{skill_assessments}', 'active', NULL, 7),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/succession', 'Succession', 'Piani di successione e leadership pipeline', '{succession_plans}', 'active', NULL, 8),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/mobility', 'Internal Mobility', 'Opportunita mobilita interna', '{internal_mobility}', 'active', NULL, 9),
('talent', 'Talent Management', NULL, 'bg-indigo-500/10 text-indigo-600', 'Sparkles', 5, '/admin/talent/pay-stubs', 'Pay Stubs', 'Cedolini e buste paga', '{pay_stubs}', 'active', NULL, 10),

-- Section 6: Admin Standalone
('admin-standalone', 'Pagine Admin Standalone', 'Pagine CRUD principali — le pagine effettive a cui puntano i redirect', 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/skills', 'Skills', 'Tassonomia skills e livelli proficiency — pagina primaria', '{employee_skills,esco_skills,onet_skills}', 'active', NULL, 1),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/positions', 'Positions', 'Posizioni lavorative', '{recruiting_requisitions}', 'active', NULL, 2),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/org-chart', 'Org Chart', 'Organigramma interattivo — pagina primaria', '{org_units,employees}', 'active', NULL, 3),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/departments', 'Departments', 'Dipartimenti — CRUD con detail/edit/stats', '{departments}', 'active', NULL, 4),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/org-units', 'Org Units', 'Unita organizzative — CRUD con detail/edit', '{org_units}', 'active', NULL, 5),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/locations', 'Locations', 'Sedi — CRUD con detail/edit', '{locations}', 'active', NULL, 6),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/cost-centers', 'Cost Centers', 'Centri di costo — CRUD con detail/edit', '{cost_centers}', 'active', NULL, 7),
('admin-standalone', 'Pagine Admin Standalone', NULL, 'bg-slate-500/10 text-slate-600', 'LayoutDashboard', 6, '/admin/employees', 'Employees', 'Dipendenti — CRUD con profilo multi-tab (10 tab)', '{employees,employee_contracts,employee_documents,employee_skills}', 'active', NULL, 8),

-- Section 7: Admin Dashboard
('admin-dashboard', 'Admin Dashboard', 'Dashboard HR principale con KPI, trend e metriche aggregate', 'bg-indigo-500/10 text-indigo-600', 'LayoutDashboard', 7, '/admin', 'Admin Dashboard', 'Dashboard HR con KPI, trend, metriche', '{employees,goals,performance_reviews}', 'active', NULL, 1),

-- Section 8: Analytics
('analytics', 'Analytics', 'Centro analisi dati — workforce, compensation, presenze, AI, previsioni', 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics', 'Analytics Hub', 'Centro analisi dati HR', '{analytics_aggregations}', 'active', NULL, 1),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/workforce', 'Workforce Analytics', 'Trend headcount, previsioni, attrition', '{employees,departments}', 'active', NULL, 2),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/compensation', 'Compensation Analytics', 'Analisi retribuzioni e salary band', '{salary_bands,salary_history,employee_contracts}', 'active', NULL, 3),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/attendance', 'Attendance Analytics', 'Analisi presenze e assenze', '{employee_time_off_requests,attendance_records}', 'active', NULL, 4),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/ai', 'AI Analytics', 'Analisi uso AI e modelli', '{ai_conversations,ai_messages}', 'active', NULL, 5),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/hr-intelligence', 'HR Intelligence', 'Insights avanzati HR', '{analytics_aggregations}', 'active', NULL, 6),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/predictions', 'Predictions', 'Previsioni workforce e turnover', '{employees}', 'active', NULL, 7),
('analytics', 'Analytics', NULL, 'bg-cyan-500/10 text-cyan-600', 'Compass', 8, '/admin/analytics/export', 'Export', 'Esportazione report e dati', '{report_subscriptions,exports}', 'active', NULL, 8),

-- Section 9: AI Services
('ai', 'AI Services', 'Servizi di intelligenza artificiale — chat, analisi documenti, sessioni', 'bg-violet-500/10 text-violet-600', 'Sparkles', 9, '/admin/ai', 'AI Hub', 'Hub servizi AI', '{ai_conversations}', 'active', NULL, 1),
('ai', 'AI Services', NULL, 'bg-violet-500/10 text-violet-600', 'Sparkles', 9, '/admin/ai/chat', 'AI Chat', 'Chat assistente AI', '{ai_conversations,ai_messages}', 'active', NULL, 2),
('ai', 'AI Services', NULL, 'bg-violet-500/10 text-violet-600', 'Sparkles', 9, '/admin/ai/documents', 'AI Documents', 'Analisi documenti con AI', '{ai_document_analyses}', 'active', NULL, 3),
('ai', 'AI Services', NULL, 'bg-violet-500/10 text-violet-600', 'Sparkles', 9, '/admin/ai/sessions', 'AI Sessions', 'Storico sessioni AI', '{ai_conversations}', 'active', NULL, 4),

-- Section 10: Career Hub
('career', 'Career Hub', 'Gestione carriere — obiettivi, competenze, percorsi, mentoring, career coach', 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career', 'Career Hub', 'Hub gestione carriere', '{career_paths,goals}', 'active', NULL, 1),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/goals', 'Goals', 'Obiettivi di carriera', '{goals}', 'active', NULL, 2),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/skills', 'Career Skills', 'Competenze per carriera', '{employee_skills,esco_skills}', 'active', NULL, 3),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/paths', 'Career Paths', 'Percorsi di carriera', '{career_paths}', 'active', NULL, 4),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/learning', 'Career Learning', 'Formazione per carriera', '{courses,learning_paths}', 'active', NULL, 5),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/mentors', 'Mentors', 'Programma mentoring', '{mentoring_relationships}', 'active', NULL, 6),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/reports', 'Career Reports', 'Report carriera', '{career_paths}', 'active', NULL, 7),
('career', 'Career Hub', NULL, 'bg-amber-500/10 text-amber-600', 'Compass', 10, '/admin/career/chat', 'Career Chat', 'Chat career coach AI', '{ai_conversations}', 'active', NULL, 8),

-- Section 11: Performance
('performance', 'Performance', 'Gestione performance — valutazioni, OKR, check-in, feedback, calibrazione', 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance', 'Performance Hub', 'Hub gestione performance', '{performance_reviews,review_cycles}', 'active', NULL, 1),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/reviews', 'Reviews', 'Valutazioni performance', '{performance_reviews}', 'active', NULL, 2),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/goals', 'Performance Goals', 'Obiettivi performance', '{goals}', 'active', NULL, 3),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/okrs', 'OKRs', 'Objectives & Key Results', '{okr_objectives,okr_key_results}', 'active', NULL, 4),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/check-ins', 'Check-ins', 'Conversazioni 1:1', '{check_ins}', 'active', NULL, 5),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/feedback', 'Continuous Feedback', 'Feedback continuo', '{continuous_feedback}', 'active', NULL, 6),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/calibration', 'Calibration', 'Sessioni calibrazione', '{calibration_sessions}', 'active', NULL, 7),
('performance', 'Performance', NULL, 'bg-rose-500/10 text-rose-600', 'Compass', 11, '/admin/performance/review-cycles', 'Review Cycles', 'Cicli di valutazione', '{review_cycles}', 'active', NULL, 8),

-- Section 12: Compensation
('compensation', 'Compensation & Benefits', 'Retribuzioni, fasce salariali, bonus, cicli merito', 'bg-emerald-500/10 text-emerald-600', 'Compass', 12, '/admin/compensation', 'Compensation Hub', 'Hub compensation & benefits', '{salary_bands,bonus_plans}', 'active', NULL, 1),
('compensation', 'Compensation & Benefits', NULL, 'bg-emerald-500/10 text-emerald-600', 'Compass', 12, '/admin/compensation/salary-bands', 'Salary Bands', 'Fasce retributive', '{salary_bands}', 'active', NULL, 2),
('compensation', 'Compensation & Benefits', NULL, 'bg-emerald-500/10 text-emerald-600', 'Compass', 12, '/admin/compensation/bonus-plans', 'Bonus Plans', 'Piani bonus', '{bonus_plans,bonus_allocations}', 'active', NULL, 3),
('compensation', 'Compensation & Benefits', NULL, 'bg-emerald-500/10 text-emerald-600', 'Compass', 12, '/admin/compensation/merit-cycles', 'Merit Cycles', 'Cicli merito', '{merit_cycles,merit_recommendations}', 'active', NULL, 4),

-- Section 13: Engagement
('engagement', 'Engagement', 'Employee engagement — wellbeing, social recognition, mentorship', 'bg-pink-500/10 text-pink-600', 'Compass', 13, '/admin/engagement', 'Engagement Hub', 'Hub employee engagement', '{wellbeing_checkins,recognition}', 'active', NULL, 1),
('engagement', 'Engagement', NULL, 'bg-pink-500/10 text-pink-600', 'Compass', 13, '/admin/engagement/wellbeing', 'Wellbeing', 'Benessere dipendenti', '{wellbeing_checkins}', 'active', NULL, 2),
('engagement', 'Engagement', NULL, 'bg-pink-500/10 text-pink-600', 'Compass', 13, '/admin/engagement/social', 'Social Recognition', 'Riconoscimenti e social', '{recognition}', 'active', NULL, 3),
('engagement', 'Engagement', NULL, 'bg-pink-500/10 text-pink-600', 'Compass', 13, '/admin/engagement/mentorship', 'Mentorship', 'Programma mentoring', '{mentoring_relationships}', 'active', NULL, 4),

-- Section 14: Compliance
('compliance', 'Compliance', 'Compliance, audit trail, policy violations, whistleblowing', 'bg-red-500/10 text-red-600', 'Compass', 14, '/admin/compliance', 'Compliance Hub', 'Hub compliance e audit', '{audit_logs,compliance_audits}', 'active', NULL, 1),
('compliance', 'Compliance', NULL, 'bg-red-500/10 text-red-600', 'Compass', 14, '/admin/compliance/audits', 'Audits', 'Audit compliance', '{compliance_audits}', 'active', NULL, 2),
('compliance', 'Compliance', NULL, 'bg-red-500/10 text-red-600', 'Compass', 14, '/admin/compliance/policy-violations', 'Policy Violations', 'Violazioni policy', '{policy_violations}', 'active', NULL, 3),
('compliance', 'Compliance', NULL, 'bg-red-500/10 text-red-600', 'Compass', 14, '/admin/compliance/whistleblowing', 'Whistleblowing', 'Segnalazioni anonime', '{whistleblowing_reports}', 'active', NULL, 4),

-- Section 15: Recruiting
('recruiting', 'Recruiting', 'Selezione personale — requisizioni, annunci, candidati', 'bg-teal-500/10 text-teal-600', 'Users', 15, '/admin/recruiting', 'Recruiting Hub', 'Hub selezione personale', '{recruiting_requisitions,recruiting_candidates}', 'active', NULL, 1),
('recruiting', 'Recruiting', NULL, 'bg-teal-500/10 text-teal-600', 'Users', 15, '/admin/recruiting/requisitions', 'Requisitions', 'Richieste assunzione', '{recruiting_requisitions}', 'active', NULL, 2),
('recruiting', 'Recruiting', NULL, 'bg-teal-500/10 text-teal-600', 'Users', 15, '/admin/recruiting/postings', 'Job Postings', 'Annunci lavoro', '{recruiting_postings}', 'active', NULL, 3),
('recruiting', 'Recruiting', NULL, 'bg-teal-500/10 text-teal-600', 'Users', 15, '/admin/recruiting/candidates', 'Candidates', 'Gestione candidati', '{recruiting_candidates}', 'active', NULL, 4),

-- Section 16: Learning
('learning', 'Learning & Development', 'Formazione — corsi, percorsi formativi, certificazioni', 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/learning', 'Learning Hub', 'Hub formazione', '{courses,learning_paths}', 'active', NULL, 1),
('learning', 'Learning & Development', NULL, 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/learning/courses', 'Courses', 'Catalogo corsi', '{courses,course_enrollments}', 'active', NULL, 2),
('learning', 'Learning & Development', NULL, 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/learning/paths', 'Learning Paths', 'Percorsi formativi', '{learning_paths,learning_path_enrollments}', 'active', NULL, 3),
('learning', 'Learning & Development', NULL, 'bg-sky-500/10 text-sky-600', 'GraduationCap', 16, '/admin/learning/certifications', 'Certifications', 'Certificazioni', '{certifications,employee_certifications}', 'active', NULL, 4),

-- Section 17: Marketplace
('marketplace', 'Marketplace', 'Plugin, integrazioni, API keys, webhooks, developer tools', 'bg-orange-500/10 text-orange-600', 'Compass', 17, '/admin/marketplace', 'Marketplace Hub', 'Plugin e integrazioni', '{marketplace_plugins}', 'active', NULL, 1),
('marketplace', 'Marketplace', NULL, 'bg-orange-500/10 text-orange-600', 'Compass', 17, '/admin/marketplace/installed', 'Installed Plugins', 'Plugin installati', '{marketplace_plugins}', 'active', NULL, 2),
('marketplace', 'Marketplace', NULL, 'bg-orange-500/10 text-orange-600', 'Compass', 17, '/admin/marketplace/developer', 'Developer Tools', 'Strumenti sviluppatore plugin', '{marketplace_plugins}', 'active', NULL, 3),
('marketplace', 'Marketplace', NULL, 'bg-orange-500/10 text-orange-600', 'Compass', 17, '/admin/marketplace/api-keys', 'API Keys', 'Gestione chiavi API', '{marketplace_api_keys}', 'active', NULL, 4),
('marketplace', 'Marketplace', NULL, 'bg-orange-500/10 text-orange-600', 'Compass', 17, '/admin/marketplace/webhooks', 'Webhooks', 'Configurazione webhooks', '{marketplace_webhooks}', 'active', NULL, 5),

-- Section 18: Settings
('settings', 'Settings', 'Impostazioni tenant — utenti, notifiche, SSO, setup, migrazione SAP', 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings', 'Settings Hub', 'Hub impostazioni tenant', '{service_config}', 'active', NULL, 1),
('settings', 'Settings', NULL, 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings/users', 'User Management', 'Gestione utenti tenant', '{users,role_permissions}', 'active', NULL, 2),
('settings', 'Settings', NULL, 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings/tenants', 'Tenant Config', 'Configurazione tenant', '{tenants}', 'active', NULL, 3),
('settings', 'Settings', NULL, 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings/notifications', 'Notifications', 'Impostazioni notifiche', '{notification_preferences}', 'active', NULL, 4),
('settings', 'Settings', NULL, 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings/sso', 'SSO', 'Single Sign-On', '{sso}', 'active', NULL, 5),
('settings', 'Settings', NULL, 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings/tenant-setup', 'Tenant Setup', 'Setup iniziale tenant', '{tenants}', 'active', NULL, 6),
('settings', 'Settings', NULL, 'bg-gray-500/10 text-gray-600', 'Compass', 18, '/admin/settings/sap-migration', 'SAP Migration', 'Migrazione dati SAP', '{pa0001,pa0002}', 'active', NULL, 7),

-- Section 19: Employee Portal
('portal', 'Employee Portal', 'Self-service dipendente — profilo, obiettivi, formazione, documenti, ferie', 'bg-green-500/10 text-green-600', 'Users', 19, '/portal', 'Portal Home', 'Self-service dipendente', '{employees}', 'active', NULL, 1),
('portal', 'Employee Portal', NULL, 'bg-green-500/10 text-green-600', 'Users', 19, '/portal/profile', 'My Profile', 'Profilo personale', '{employees,employee_contracts}', 'active', NULL, 2),
('portal', 'Employee Portal', NULL, 'bg-green-500/10 text-green-600', 'Users', 19, '/portal/goals', 'My Goals', 'Obiettivi personali', '{goals}', 'active', NULL, 3),
('portal', 'Employee Portal', NULL, 'bg-green-500/10 text-green-600', 'Users', 19, '/portal/learning', 'My Learning', 'Formazione personale', '{course_enrollments,learning_path_enrollments}', 'active', NULL, 4),
('portal', 'Employee Portal', NULL, 'bg-green-500/10 text-green-600', 'Users', 19, '/portal/documents', 'My Documents', 'Documenti personali', '{employee_documents}', 'active', NULL, 5),
('portal', 'Employee Portal', NULL, 'bg-green-500/10 text-green-600', 'Users', 19, '/portal/payroll', 'My Payroll', 'Cedolini e buste paga', '{payroll_runs,pay_stubs}', 'active', NULL, 6),
('portal', 'Employee Portal', NULL, 'bg-green-500/10 text-green-600', 'Users', 19, '/portal/time-off', 'Time Off', 'Ferie e permessi', '{employee_time_off_requests,time_off_balances}', 'active', NULL, 7);

-- Track migration
INSERT INTO schema_migrations (version, name) VALUES (118, 'platform_pages') ON CONFLICT DO NOTHING;
