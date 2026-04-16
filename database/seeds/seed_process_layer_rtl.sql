-- =============================================================================
-- Seed: Process Layer data for RTL Bank (8 business processes)
-- Target tables: process_phases, process_roles, process_skill_requirements, process_kpis, blueprint_templates
-- All esco_skill_id references via subquery on preferred_label (no hardcoded UUIDs)
-- Idempotent: ON CONFLICT DO NOTHING on all INSERTs
-- =============================================================================

-- Verified ESCO skill preferred_labels (26 exact matches confirmed):
-- Financial Analysis, think analytically, manage accounts, risk management,
-- Negotiation Skills, apply technical communication skills,
-- ensure compliance with company regulations, solve problems, Time management,
-- Data analysis, implement sales strategies, Problem Solving, supplier management,
-- personnel management, leadership principles, Project Management,
-- apply change management, customer service, data visualisation software,
-- prepare financial auditing reports, manage budgets, Compliance Management,
-- GDPR Compliance, internal auditing, cyber security, SQL Database Management

-- =============================================================================
-- SECTION 1: process_phases (26 total)
-- =============================================================================

-- BP-001 Erogazione Credito (4 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', 'BP-001-PH-01', 'Istruttoria', 1, 'Raccolta documentazione e analisi preliminare del richiedente', 5),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', 'BP-001-PH-02', 'Valutazione Merito', 2, 'Analisi merito creditizio, scoring e valutazione garanzie', 3),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', 'BP-001-PH-03', 'Delibera', 3, 'Decisione di approvazione/rifiuto da parte degli organi deliberanti', 2),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', 'BP-001-PH-04', 'Erogazione', 4, 'Perfezionamento contrattuale e disbursement fondi', 3)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-002 Gestione Incassi e Pagamenti (3 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', 'BP-002-PH-01', 'Ricezione', 1, 'Acquisizione ordini di pagamento e disposizioni di incasso', 1),
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', 'BP-002-PH-02', 'Elaborazione', 2, 'Esecuzione operazioni di pagamento e verifica fondi', 1),
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', 'BP-002-PH-03', 'Riconciliazione', 3, 'Riconciliazione contabile e quadratura saldi', 2)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-003 Antiriciclaggio e Compliance (3 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', 'BP-003-PH-01', 'Monitoraggio', 1, 'Monitoraggio continuo delle transazioni e delle posizioni clienti', NULL),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', 'BP-003-PH-02', 'Segnalazione', 2, 'Analisi operazioni sospette e invio segnalazioni STR', 3),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', 'BP-003-PH-03', 'Reporting', 3, 'Produzione reportistica periodica per organi di vigilanza', 5)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-004 Gestione Risorse Umane (3 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', 'BP-004-PH-01', 'Recruiting', 1, 'Identificazione fabbisogno, pubblicazione annunci, screening candidati', 15),
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', 'BP-004-PH-02', 'Onboarding', 2, 'Inserimento nuovo dipendente, formazione iniziale, assegnazione ruolo', 10),
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', 'BP-004-PH-03', 'Sviluppo', 3, 'Percorsi di crescita, valutazione performance, piani di carriera', 30)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-005 Contabilita e Bilancio (3 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', 'BP-005-PH-01', 'Registrazione', 1, 'Contabilizzazione movimenti, prima nota, partitario', 1),
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', 'BP-005-PH-02', 'Chiusura Periodica', 2, 'Chiusura mensile/trimestrale con quadratura conti e ratei', 5),
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', 'BP-005-PH-03', 'Reporting', 3, 'Produzione bilancio, nota integrativa e segnalazioni Banca d''Italia', 10)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-006 Risk Management (4 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('16522f52-9824-480f-8944-112ef1a2e485', 'BP-006-PH-01', 'Identificazione', 1, 'Mappatura rischi di credito, mercato, operativi e reputazionali', 5),
  ('16522f52-9824-480f-8944-112ef1a2e485', 'BP-006-PH-02', 'Valutazione', 2, 'Quantificazione rischi tramite modelli VaR, stress test, scenario analysis', 5),
  ('16522f52-9824-480f-8944-112ef1a2e485', 'BP-006-PH-03', 'Mitigazione', 3, 'Definizione strategie di copertura, limiti operativi e azioni correttive', 10),
  ('16522f52-9824-480f-8944-112ef1a2e485', 'BP-006-PH-04', 'Monitoraggio', 4, 'Monitoraggio continuo indicatori di rischio e reporting direzionale', NULL)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-007 Consulenza Investimenti (3 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', 'BP-007-PH-01', 'Analisi Profilo', 1, 'Profilatura MiFID II, analisi obiettivi e tolleranza al rischio', 3),
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', 'BP-007-PH-02', 'Proposta Portafoglio', 2, 'Costruzione proposta di investimento e asset allocation', 5),
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', 'BP-007-PH-03', 'Monitoraggio', 3, 'Monitoraggio performance portafoglio e ribilanciamento periodico', NULL)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- BP-008 IT Service Management (3 fasi)
INSERT INTO process_phases (process_id, phase_code, phase_name, phase_order, description, estimated_duration_days)
VALUES
  ('81b08010-271b-40db-befd-bcaddabe9265', 'BP-008-PH-01', 'Incident Management', 1, 'Ricezione, classificazione e risoluzione incidenti IT', 1),
  ('81b08010-271b-40db-befd-bcaddabe9265', 'BP-008-PH-02', 'Change Management', 2, 'Gestione richieste di cambiamento infrastrutturale e applicativo', 5),
  ('81b08010-271b-40db-befd-bcaddabe9265', 'BP-008-PH-03', 'Problem Management', 3, 'Analisi root cause e prevenzione incidenti ricorrenti', 10)
ON CONFLICT (process_id, phase_code) DO NOTHING;

-- =============================================================================
-- SECTION 2: process_roles (24 total, phase_id = NULL, esco_occupation_id = NULL)
-- =============================================================================

-- BP-001 Erogazione Credito (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'Analista Crediti', 'executor', NULL, 'Esegue istruttoria e valutazione merito creditizio'),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'Responsabile Crediti', 'approver', NULL, 'Approva o rigetta le proposte di finanziamento'),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'Direttore Filiale', 'reviewer', NULL, 'Supervisione processo di erogazione e limiti di firma')
ON CONFLICT DO NOTHING;

-- BP-002 Gestione Incassi e Pagamenti (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', NULL, 'Addetto Back Office', 'executor', NULL, 'Elabora operazioni di incasso e pagamento'),
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', NULL, 'Supervisore Pagamenti', 'approver', NULL, 'Approva operazioni sopra soglia e gestisce eccezioni'),
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', NULL, 'Responsabile Operations', 'informed', NULL, 'Monitora volumi e SLA del processo pagamenti')
ON CONFLICT DO NOTHING;

-- BP-003 Antiriciclaggio e Compliance (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'Compliance Officer', 'executor', NULL, 'Gestisce verifiche di conformita normativa'),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'AML Analyst', 'executor', NULL, 'Analizza operazioni sospette e prepara segnalazioni STR'),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'Responsabile Compliance', 'owner', NULL, 'Responsabile della funzione compliance e AML')
ON CONFLICT DO NOTHING;

-- BP-004 Gestione Risorse Umane (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', NULL, 'HR Manager', 'owner', NULL, 'Responsabile gestione risorse umane e politiche HR'),
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', NULL, 'HR Specialist', 'executor', NULL, 'Esegue attivita operative di recruiting e onboarding'),
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', NULL, 'Hiring Manager', 'reviewer', NULL, 'Revisiona candidature e partecipa al processo di selezione')
ON CONFLICT DO NOTHING;

-- BP-005 Contabilita e Bilancio (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', NULL, 'Contabile', 'executor', NULL, 'Registra movimenti contabili e gestisce partitario'),
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', NULL, 'Controller', 'reviewer', NULL, 'Verifica quadratura conti e analisi scostamenti'),
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', NULL, 'CFO', 'approver', NULL, 'Approva bilancio e reporting direzionale')
ON CONFLICT DO NOTHING;

-- BP-006 Risk Management (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'Risk Analyst', 'executor', NULL, 'Analizza e quantifica i rischi tramite modelli quantitativi'),
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'Risk Manager', 'owner', NULL, 'Responsabile della funzione risk management'),
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'CRO', 'approver', NULL, 'Chief Risk Officer, approva limiti e strategie di mitigazione')
ON CONFLICT DO NOTHING;

-- BP-007 Consulenza Investimenti (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', NULL, 'Consulente Finanziario', 'executor', NULL, 'Gestisce relazione cliente e propone soluzioni di investimento'),
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', NULL, 'Portfolio Manager', 'owner', NULL, 'Definisce asset allocation e strategie di portafoglio'),
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', NULL, 'Compliance', 'reviewer', NULL, 'Verifica conformita MiFID II delle proposte di investimento')
ON CONFLICT DO NOTHING;

-- BP-008 IT Service Management (3 ruoli)
INSERT INTO process_roles (process_id, phase_id, role_name, role_type, esco_occupation_id, description)
VALUES
  ('81b08010-271b-40db-befd-bcaddabe9265', NULL, 'IT Support', 'executor', NULL, 'Prima linea di supporto per incidenti e richieste utenti'),
  ('81b08010-271b-40db-befd-bcaddabe9265', NULL, 'System Admin', 'executor', NULL, 'Gestisce infrastruttura, change e problem management'),
  ('81b08010-271b-40db-befd-bcaddabe9265', NULL, 'IT Manager', 'owner', NULL, 'Responsabile dei servizi IT e della roadmap tecnologica')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECTION 3: process_skill_requirements (37 total, phase_id = NULL)
-- All esco_skill_id via subquery on esco_skills.preferred_label
-- =============================================================================

-- BP-001 Erogazione Credito (5 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'ababbb0b-b9a9-4e8a-9da7-ad74e86f3713'::uuid, NULL, id, 5, true, 'Core skill for credit evaluation and financial assessment'
FROM esco_skills WHERE preferred_label = 'Financial Analysis' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'ababbb0b-b9a9-4e8a-9da7-ad74e86f3713'::uuid, NULL, id, 4, true, 'Risk assessment for credit decisions'
FROM esco_skills WHERE preferred_label = 'risk management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'ababbb0b-b9a9-4e8a-9da7-ad74e86f3713'::uuid, NULL, id, 4, true, 'Account management for credit portfolio'
FROM esco_skills WHERE preferred_label = 'manage accounts' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'ababbb0b-b9a9-4e8a-9da7-ad74e86f3713'::uuid, NULL, id, 3, true, 'Regulatory compliance in credit operations'
FROM esco_skills WHERE preferred_label = 'ensure compliance with company regulations' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'ababbb0b-b9a9-4e8a-9da7-ad74e86f3713'::uuid, NULL, id, 3, false, 'Negotiation with clients on credit terms'
FROM esco_skills WHERE preferred_label = 'Negotiation Skills' ON CONFLICT DO NOTHING;

-- BP-002 Gestione Incassi e Pagamenti (4 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '5e1ebdc4-2c71-4732-9f41-1fa919a793a6'::uuid, NULL, id, 4, true, 'Account management for payment processing'
FROM esco_skills WHERE preferred_label = 'manage accounts' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '5e1ebdc4-2c71-4732-9f41-1fa919a793a6'::uuid, NULL, id, 3, true, 'Data analysis for reconciliation and reporting'
FROM esco_skills WHERE preferred_label = 'Data analysis' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '5e1ebdc4-2c71-4732-9f41-1fa919a793a6'::uuid, NULL, id, 3, true, 'Time management for SLA compliance'
FROM esco_skills WHERE preferred_label = 'Time management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '5e1ebdc4-2c71-4732-9f41-1fa919a793a6'::uuid, NULL, id, 3, false, 'Technical communication for operations reporting'
FROM esco_skills WHERE preferred_label = 'apply technical communication skills' ON CONFLICT DO NOTHING;

-- BP-003 Antiriciclaggio e Compliance (5 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '82a343b4-7f71-4021-9668-1f9e14f8b90c'::uuid, NULL, id, 5, true, 'Core compliance management competency'
FROM esco_skills WHERE preferred_label = 'Compliance Management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '82a343b4-7f71-4021-9668-1f9e14f8b90c'::uuid, NULL, id, 4, true, 'GDPR and data protection compliance'
FROM esco_skills WHERE preferred_label = 'GDPR Compliance' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '82a343b4-7f71-4021-9668-1f9e14f8b90c'::uuid, NULL, id, 5, true, 'Regulatory compliance enforcement'
FROM esco_skills WHERE preferred_label = 'ensure compliance with company regulations' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '82a343b4-7f71-4021-9668-1f9e14f8b90c'::uuid, NULL, id, 4, true, 'Internal audit for AML verification'
FROM esco_skills WHERE preferred_label = 'internal auditing' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '82a343b4-7f71-4021-9668-1f9e14f8b90c'::uuid, NULL, id, 4, true, 'Risk assessment for compliance monitoring'
FROM esco_skills WHERE preferred_label = 'risk management' ON CONFLICT DO NOTHING;

-- BP-004 Gestione Risorse Umane (4 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'b8353e3b-0290-46c9-9acb-6e00b98f7340'::uuid, NULL, id, 5, true, 'Core HR management competency'
FROM esco_skills WHERE preferred_label = 'personnel management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'b8353e3b-0290-46c9-9acb-6e00b98f7340'::uuid, NULL, id, 4, true, 'Change management for organizational development'
FROM esco_skills WHERE preferred_label = 'apply change management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'b8353e3b-0290-46c9-9acb-6e00b98f7340'::uuid, NULL, id, 3, false, 'Leadership for team development and coaching'
FROM esco_skills WHERE preferred_label = 'leadership principles' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'b8353e3b-0290-46c9-9acb-6e00b98f7340'::uuid, NULL, id, 3, false, 'Negotiation for recruitment and labor relations'
FROM esco_skills WHERE preferred_label = 'Negotiation Skills' ON CONFLICT DO NOTHING;

-- BP-005 Contabilita e Bilancio (4 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'd6584475-c9f5-4e2b-9e3a-b7c728968624'::uuid, NULL, id, 5, true, 'Financial analysis for accounting and reporting'
FROM esco_skills WHERE preferred_label = 'Financial Analysis' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'd6584475-c9f5-4e2b-9e3a-b7c728968624'::uuid, NULL, id, 5, true, 'Audit report preparation for financial statements'
FROM esco_skills WHERE preferred_label = 'prepare financial auditing reports' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'd6584475-c9f5-4e2b-9e3a-b7c728968624'::uuid, NULL, id, 4, true, 'Budget management and cost control'
FROM esco_skills WHERE preferred_label = 'manage budgets' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT 'd6584475-c9f5-4e2b-9e3a-b7c728968624'::uuid, NULL, id, 4, true, 'Data analysis for financial reporting'
FROM esco_skills WHERE preferred_label = 'Data analysis' ON CONFLICT DO NOTHING;

-- BP-006 Risk Management (5 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '16522f52-9824-480f-8944-112ef1a2e485'::uuid, NULL, id, 5, true, 'Core risk management competency'
FROM esco_skills WHERE preferred_label = 'risk management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '16522f52-9824-480f-8944-112ef1a2e485'::uuid, NULL, id, 5, true, 'Analytical thinking for risk modeling'
FROM esco_skills WHERE preferred_label = 'think analytically' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '16522f52-9824-480f-8944-112ef1a2e485'::uuid, NULL, id, 4, true, 'Financial analysis for risk quantification'
FROM esco_skills WHERE preferred_label = 'Financial Analysis' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '16522f52-9824-480f-8944-112ef1a2e485'::uuid, NULL, id, 4, true, 'Data analysis for risk monitoring and reporting'
FROM esco_skills WHERE preferred_label = 'Data analysis' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '16522f52-9824-480f-8944-112ef1a2e485'::uuid, NULL, id, 4, true, 'Problem solving for risk mitigation strategies'
FROM esco_skills WHERE preferred_label = 'solve problems' ON CONFLICT DO NOTHING;

-- BP-007 Consulenza Investimenti (5 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '8a770ae0-9d80-4e03-afbd-ea18f1b624c9'::uuid, NULL, id, 5, true, 'Financial analysis for investment advisory'
FROM esco_skills WHERE preferred_label = 'Financial Analysis' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '8a770ae0-9d80-4e03-afbd-ea18f1b624c9'::uuid, NULL, id, 4, true, 'Negotiation for client relationship management'
FROM esco_skills WHERE preferred_label = 'Negotiation Skills' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '8a770ae0-9d80-4e03-afbd-ea18f1b624c9'::uuid, NULL, id, 4, true, 'Sales strategies for investment products'
FROM esco_skills WHERE preferred_label = 'implement sales strategies' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '8a770ae0-9d80-4e03-afbd-ea18f1b624c9'::uuid, NULL, id, 4, true, 'Customer service for wealth management'
FROM esco_skills WHERE preferred_label = 'customer service' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '8a770ae0-9d80-4e03-afbd-ea18f1b624c9'::uuid, NULL, id, 4, true, 'Account management for investment portfolios'
FROM esco_skills WHERE preferred_label = 'manage accounts' ON CONFLICT DO NOTHING;

-- BP-008 IT Service Management (4 skill)
INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '81b08010-271b-40db-befd-bcaddabe9265'::uuid, NULL, id, 5, true, 'Cybersecurity for IT infrastructure protection'
FROM esco_skills WHERE preferred_label = 'cyber security' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '81b08010-271b-40db-befd-bcaddabe9265'::uuid, NULL, id, 4, true, 'Database management for system administration'
FROM esco_skills WHERE preferred_label = 'SQL Database Management' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '81b08010-271b-40db-befd-bcaddabe9265'::uuid, NULL, id, 4, true, 'Problem solving for incident and problem management'
FROM esco_skills WHERE preferred_label = 'solve problems' ON CONFLICT DO NOTHING;

INSERT INTO process_skill_requirements (process_id, phase_id, esco_skill_id, proficiency_level, is_mandatory, description)
SELECT '81b08010-271b-40db-befd-bcaddabe9265'::uuid, NULL, id, 4, true, 'Project management for change management'
FROM esco_skills WHERE preferred_label = 'Project Management' ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECTION 4: process_kpis (27 total)
-- =============================================================================

-- BP-001 Erogazione Credito (4 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'BP-001-KPI-01', 'Tempo medio erogazione', 'giorni', 'lower_better', 15, 'Tempo medio dalla richiesta all''erogazione del credito'),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'BP-001-KPI-02', 'Tasso default', 'percentuale', 'lower_better', 2.5, 'Percentuale di crediti in default sul portafoglio erogato'),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'BP-001-KPI-03', 'NPL ratio', 'percentuale', 'lower_better', 4.0, 'Non-Performing Loans ratio sul totale crediti'),
  ('ababbb0b-b9a9-4e8a-9da7-ad74e86f3713', NULL, 'BP-001-KPI-04', 'Volume erogato', 'EUR milioni', 'higher_better', 50, 'Volume totale di crediti erogati nel periodo')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-002 Gestione Incassi e Pagamenti (3 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', NULL, 'BP-002-KPI-01', 'Tempo elaborazione', 'ore', 'lower_better', 4, 'Tempo medio di elaborazione di un ordine di pagamento'),
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', NULL, 'BP-002-KPI-02', 'Tasso errori', 'percentuale', 'lower_better', 0.5, 'Percentuale di operazioni con errori di riconciliazione'),
  ('5e1ebdc4-2c71-4732-9f41-1fa919a793a6', NULL, 'BP-002-KPI-03', 'Volume transazioni', 'numero/mese', 'higher_better', 50000, 'Numero di transazioni elaborate mensilmente')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-003 Antiriciclaggio e Compliance (4 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'BP-003-KPI-01', 'Segnalazioni STR', 'numero/trimestre', 'target_range', 10, 'Numero di Segnalazioni di Transazioni Sospette inviate'),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'BP-003-KPI-02', 'Tempo risposta audit', 'giorni', 'lower_better', 5, 'Tempo medio di risposta a richieste audit interni/esterni'),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'BP-003-KPI-03', 'Compliance rate', 'percentuale', 'higher_better', 98, 'Percentuale di conformita alle normative vigenti'),
  ('82a343b4-7f71-4021-9668-1f9e14f8b90c', NULL, 'BP-003-KPI-04', 'Formazione completata', 'percentuale', 'higher_better', 95, 'Percentuale di personale che ha completato formazione AML')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-004 Gestione Risorse Umane (3 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', NULL, 'BP-004-KPI-01', 'Time-to-hire', 'giorni', 'lower_better', 30, 'Tempo medio dalla pubblicazione annuncio all''assunzione'),
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', NULL, 'BP-004-KPI-02', 'Retention rate', 'percentuale', 'higher_better', 90, 'Percentuale di dipendenti rimasti dopo 12 mesi'),
  ('b8353e3b-0290-46c9-9acb-6e00b98f7340', NULL, 'BP-004-KPI-03', 'Engagement score', 'punteggio 1-10', 'higher_better', 7.5, 'Indice di coinvolgimento e soddisfazione dei dipendenti')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-005 Contabilita e Bilancio (3 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', NULL, 'BP-005-KPI-01', 'Giorni chiusura', 'giorni', 'lower_better', 10, 'Giorni lavorativi per chiusura mensile'),
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', NULL, 'BP-005-KPI-02', 'Accuracy rate', 'percentuale', 'higher_better', 99.5, 'Percentuale di registrazioni contabili corrette'),
  ('d6584475-c9f5-4e2b-9e3a-b7c728968624', NULL, 'BP-005-KPI-03', 'Costo per transazione', 'EUR', 'lower_better', 2.50, 'Costo medio di elaborazione per singola transazione contabile')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-006 Risk Management (4 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'BP-006-KPI-01', 'VaR', 'EUR milioni', 'lower_better', 5, 'Value at Risk giornaliero al 99% di confidenza'),
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'BP-006-KPI-02', 'Expected Loss', 'EUR milioni', 'lower_better', 2, 'Perdita attesa annualizzata sul portafoglio crediti'),
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'BP-006-KPI-03', 'Risk-weighted assets', 'EUR milioni', 'lower_better', 500, 'Totale attivita ponderate per il rischio (RWA)'),
  ('16522f52-9824-480f-8944-112ef1a2e485', NULL, 'BP-006-KPI-04', 'Stress test coverage', 'percentuale', 'higher_better', 100, 'Percentuale di portafoglio coperta da stress test periodici')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-007 Consulenza Investimenti (3 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', NULL, 'BP-007-KPI-01', 'AUM growth', 'percentuale', 'higher_better', 10, 'Crescita annuale degli Asset Under Management'),
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', NULL, 'BP-007-KPI-02', 'Client satisfaction', 'punteggio 1-10', 'higher_better', 8.0, 'Indice di soddisfazione clienti wealth management'),
  ('8a770ae0-9d80-4e03-afbd-ea18f1b624c9', NULL, 'BP-007-KPI-03', 'Revenue per advisor', 'EUR migliaia', 'higher_better', 200, 'Ricavi generati per consulente finanziario')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- BP-008 IT Service Management (3 KPI)
INSERT INTO process_kpis (process_id, phase_id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, description)
VALUES
  ('81b08010-271b-40db-befd-bcaddabe9265', NULL, 'BP-008-KPI-01', 'Uptime', 'percentuale', 'higher_better', 99.9, 'Disponibilita dei sistemi IT critici'),
  ('81b08010-271b-40db-befd-bcaddabe9265', NULL, 'BP-008-KPI-02', 'Mean time to resolve', 'ore', 'lower_better', 4, 'Tempo medio di risoluzione incidenti'),
  ('81b08010-271b-40db-befd-bcaddabe9265', NULL, 'BP-008-KPI-03', 'Change success rate', 'percentuale', 'higher_better', 95, 'Percentuale di change implementati senza incidenti')
ON CONFLICT (process_id, kpi_code) DO NOTHING;

-- =============================================================================
-- SECTION 5: blueprint_templates (1 record)
-- =============================================================================

INSERT INTO blueprint_templates (profile_id, template_name, template_version, description, template_config, is_active)
SELECT
  t.industry_profile_id,
  'Retail Banking - Medium Blueprint',
  '1.0',
  'Blueprint template for medium-sized retail banking institutions (100-300 employees)',
  '{
    "target_employee_range": [100, 300],
    "expected_processes": 8,
    "expected_org_depth": 4,
    "modes": ["greenfield", "overlay"],
    "validation_rules": {
      "min_skill_coverage": 0.7,
      "min_process_coverage": 1.0,
      "max_span_of_control": 10
    }
  }'::jsonb,
  true
FROM tenants t WHERE t.name = 'RTL Bank'
ON CONFLICT (profile_id, template_name, template_version) DO NOTHING;
