-- =============================================================================
-- SMART SEED: RTL Bank (Retail Banking) - VERSIONE CORRETTA
-- =============================================================================
-- Generato con AI-assisted research il 2025-12-19
-- Basato su: ACAMS, GARP FRM, ABA, ricerca corsi banking reali
-- CORRETTO: Aggiunto code e course_type (colonne NOT NULL)
-- =============================================================================

-- Tenant ID RTL Bank
DO $$
DECLARE
    v_tenant_id UUID := '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    v_course_id UUID;
    v_path_id UUID;
BEGIN

-- =============================================================================
-- PARTE 1: CORSI SPECIFICI PER BANKING (public.courses schema)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 CORSI COMPLIANCE & REGULATORY
-- -----------------------------------------------------------------------------

INSERT INTO courses (id, tenant_id, code, title, description, course_type, category, provider, duration_hours, skill_level, is_mandatory, status, created_at)
VALUES
-- AML/KYC (basato su ACAMS CAMS)
(uuid_generate_v4(), v_tenant_id, 'CAMS-001',
 'CAMS - Certified Anti-Money Laundering Specialist Prep',
 'Preparazione alla certificazione CAMS di ACAMS. Copre identificazione transazioni sospette, due diligence clienti, reporting SAR/STR, sanzioni internazionali.',
 'online', 'compliance', 'ACAMS', 40, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'KYC-101',
 'KYC Foundations - Know Your Customer',
 'Fondamenti di Customer Due Diligence (CDD), Enhanced Due Diligence (EDD), identificazione PEP, screening liste sanzioni, verifica documentale.',
 'blended', 'compliance', 'ACAMS', 16, 'intermediate', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'AML-102',
 'AML Transaction Monitoring',
 'Tecniche di monitoraggio transazioni, red flags, pattern sospetti, uso di AI/ML nel transaction monitoring, case studies reali.',
 'online', 'compliance', 'internal', 12, 'intermediate', true, 'published', NOW()),

-- Basel III/IV
(uuid_generate_v4(), v_tenant_id, 'BASEL3-001',
 'Basel III Framework - Capital Requirements',
 'Requisiti patrimoniali Basilea III: CET1, Tier 1, Tier 2, buffer di capitale, leverage ratio, LCR, NSFR. Impatto su strategia bancaria.',
 'classroom', 'compliance', 'Eureka Financial', 24, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'BASEL4-001',
 'Basel IV - New Advances in Banking Regulation',
 'Evoluzioni regolamentari: output floor, revisione approcci IRB, rischio operativo, CVA risk, FRTB. Implementazione 2025.',
 'classroom', 'compliance', 'Eureka Financial', 20, 'advanced', false, 'published', NOW()),

-- MiFID II
(uuid_generate_v4(), v_tenant_id, 'MIFID2-001',
 'MiFID II Compliance for Investment Services',
 'Direttiva MiFID II: product governance, best execution, inducements, recording, reporting EMIR/MiFIR. Obblighi per consulenti.',
 'blended', 'compliance', 'internal', 16, 'intermediate', true, 'published', NOW()),

-- GDPR Banking
(uuid_generate_v4(), v_tenant_id, 'GDPR-BANK-001',
 'GDPR per Operatori Bancari',
 'Privacy nel settore bancario: consenso, data retention, diritti DSAR, breach notification, trasferimenti extra-UE, sanzioni.',
 'online', 'compliance', 'internal', 8, 'beginner', true, 'published', NOW()),

-- PSD2
(uuid_generate_v4(), v_tenant_id, 'PSD2-001',
 'PSD2 e Open Banking',
 'Payment Services Directive 2: SCA, API banking, TPP, AISP/PISP, sicurezza pagamenti, screen scraping, RTS.',
 'online', 'compliance', 'internal', 12, 'intermediate', false, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.2 CORSI RISK MANAGEMENT
-- -----------------------------------------------------------------------------

-- FRM (basato su GARP)
(uuid_generate_v4(), v_tenant_id, 'FRM-P1-001',
 'FRM Part I - Financial Risk Manager Foundations',
 'Preparazione FRM GARP Part I: quantitative analysis, financial markets, valuation models, market risk measurement.',
 'blended', 'risk_management', 'GARP', 60, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'FRM-P2-001',
 'FRM Part II - Advanced Risk Management',
 'Preparazione FRM GARP Part II: market risk, credit risk, operational risk, liquidity risk, investment management, current issues.',
 'blended', 'risk_management', 'GARP', 60, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'CRISK-101',
 'Credit Risk Analysis Fundamentals',
 'Analisi merito creditizio: rating interni, PD/LGD/EAD, scoring models, financial statement analysis, settore corporate e retail.',
 'classroom', 'risk_management', 'ABA', 24, 'intermediate', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'MRISK-101',
 'Market Risk Management',
 'VaR, Expected Shortfall, stress testing, scenario analysis, backtesting, hedging strategies, Greeks.',
 'online', 'risk_management', 'internal', 20, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'OPRISK-101',
 'Operational Risk Management',
 'Framework OpRisk: identificazione, assessment, mitigazione, KRI, loss data collection, RCSA, incident management.',
 'blended', 'risk_management', 'internal', 16, 'intermediate', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'LRISK-101',
 'Liquidity Risk Management',
 'ALM, liquidity gap, LCR/NSFR, contingency funding plan, stress test liquidita, early warning indicators.',
 'classroom', 'risk_management', 'internal', 16, 'advanced', false, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.3 CORSI OPERATIONS & TELLER
-- -----------------------------------------------------------------------------

-- Bank Teller (basato su ABA)
(uuid_generate_v4(), v_tenant_id, 'ABA-TELL-001',
 'ABA Bank Teller Certificate - Foundations',
 'Fondamenti operativita di cassa: gestione contante, riconoscimento banconote, apertura/chiusura giornata, riconciliazione.',
 'blended', 'operations', 'ABA', 16, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'CASH-101',
 'Cash Handling & Counterfeit Detection',
 'Best practices gestione contante, riconoscimento banconote contraffatte, tecniche di verifica, procedure anti-frode.',
 'classroom', 'operations', 'ABA', 8, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'TXN-101',
 'Transaction Processing Excellence',
 'Depositi, prelievi, bonifici, pagamenti utenze, cambi valuta, assegni, procedure e controlli operativi.',
 'blended', 'operations', 'ABA', 12, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'FRAUD-FRONT-001',
 'Fraud Prevention for Frontline Staff',
 'Riconoscimento tentativi di frode: social engineering, identity theft, phishing, vishing. Procedure di escalation.',
 'online', 'operations', 'internal', 8, 'beginner', true, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.4 CORSI INVESTMENT & WEALTH
-- -----------------------------------------------------------------------------

(uuid_generate_v4(), v_tenant_id, 'INV-ADV-101',
 'Investment Advisory Fundamentals',
 'Principi consulenza finanziaria: asset allocation, profilo rischio cliente, suitability, reporting performance.',
 'blended', 'investment', 'CFA Institute', 24, 'intermediate', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'SEC-MKT-101',
 'Securities Markets & Trading',
 'Mercati finanziari: equity, fixed income, derivatives, forex. Order types, execution, settlement, custody.',
 'online', 'investment', 'internal', 20, 'intermediate', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'PORT-MGT-101',
 'Portfolio Management Essentials',
 'Costruzione portafoglio: Modern Portfolio Theory, CAPM, diversificazione, rebalancing, benchmark.',
 'classroom', 'investment', 'CFA Institute', 32, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'ESG-101',
 'ESG Investing & Sustainable Finance',
 'Investimenti ESG: rating ESG, green bonds, impact investing, EU Taxonomy, SFDR disclosure.',
 'online', 'investment', 'internal', 12, 'intermediate', false, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.5 CORSI CUSTOMER SERVICE & SOFT SKILLS BANKING
-- -----------------------------------------------------------------------------

(uuid_generate_v4(), v_tenant_id, 'CS-BANK-001',
 'Customer Service Excellence in Banking',
 'Tecniche di customer service specifiche per il settore bancario: gestione reclami, cross-selling etico, fidelizzazione.',
 'blended', 'soft_skills', 'internal', 8, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'FINLIT-001',
 'Financial Literacy for Customer Education',
 'Come educare i clienti: risparmio, budgeting, credito responsabile, protezione frodi online.',
 'self_paced', 'soft_skills', 'internal', 6, 'beginner', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'ETHSALES-001',
 'Ethical Sales in Banking',
 'Vendita etica prodotti bancari: needs-based selling, trasparenza, conflitto interessi, best interest duty.',
 'classroom', 'soft_skills', 'internal', 8, 'intermediate', true, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.6 CORSI TECHNICAL/IT BANKING
-- -----------------------------------------------------------------------------

(uuid_generate_v4(), v_tenant_id, 'COREBANK-101',
 'Core Banking Systems Overview',
 'Architettura sistemi core banking, integrazioni, canali digitali, API, cybersecurity bancaria.',
 'online', 'technical', 'internal', 16, 'intermediate', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'CYBER-FIN-001',
 'Cybersecurity in Financial Services',
 'Minacce cyber specifiche banking: APT, ransomware, insider threat, SWIFT security, incident response.',
 'blended', 'technical', 'internal', 20, 'advanced', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id, 'BANK-DATA-001',
 'Data Analytics for Banking',
 'Analytics nel banking: customer analytics, credit scoring, fraud detection, regulatory reporting automation.',
 'online', 'technical', 'Coursera', 24, 'intermediate', false, 'published', NOW());

RAISE NOTICE 'Inseriti 28 corsi specifici per RTL Bank';

-- =============================================================================
-- PARTE 2: LEARNING PATHS PER RUOLI
-- =============================================================================

-- Learning Path: Risk Analyst
INSERT INTO learning_paths (id, tenant_id, name, description, total_hours, is_active, created_at)
VALUES (uuid_generate_v4(), v_tenant_id,
        'Risk Analyst Career Path',
        'Percorso formativo completo per Risk Analyst: dalla certificazione FRM alla gestione rischi avanzata.',
        180, true, NOW());

-- Learning Path: Compliance Officer
INSERT INTO learning_paths (id, tenant_id, name, description, total_hours, is_active, created_at)
VALUES (uuid_generate_v4(), v_tenant_id,
        'Compliance Officer Certification Path',
        'Da KYC Analyst a Compliance Officer: AML, Basel, MiFID II, GDPR.',
        120, true, NOW());

-- Learning Path: Bank Teller
INSERT INTO learning_paths (id, tenant_id, name, description, total_hours, is_active, created_at)
VALUES (uuid_generate_v4(), v_tenant_id,
        'Bank Teller Excellence Program',
        'Programma certificazione ABA per teller: operations, customer service, fraud prevention.',
        50, true, NOW());

-- Learning Path: Investment Advisor
INSERT INTO learning_paths (id, tenant_id, name, description, total_hours, is_active, created_at)
VALUES (uuid_generate_v4(), v_tenant_id,
        'Investment Advisory Professional',
        'Percorso per consulenti finanziari: securities, portfolio management, ESG.',
        88, true, NOW());

-- Learning Path: Financial Analyst
INSERT INTO learning_paths (id, tenant_id, name, description, total_hours, is_active, created_at)
VALUES (uuid_generate_v4(), v_tenant_id,
        'Financial Analyst Development',
        'Analisi finanziaria, credit risk, data analytics per analisti.',
        80, true, NOW());

RAISE NOTICE 'Inseriti 5 Learning Paths per ruoli RTL Bank';

-- =============================================================================
-- PARTE 3: ENROLLMENTS per ruoli specifici
-- =============================================================================

-- Risk Analysts -> FRM courses, Credit Risk, Market Risk
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_date, status, created_at)
SELECT DISTINCT
    uuid_generate_v4(),
    c.id,
    e.id,
    NOW() - (random() * interval '60 days'),
    CASE WHEN random() < 0.6 THEN 'completed' ELSE 'in_progress' END,
    NOW()
FROM employees e
INNER JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Risk analyst'
  AND c.category IN ('risk_management', 'compliance')
  AND c.code IN ('FRM-P1-001', 'FRM-P2-001', 'CRISK-101', 'MRISK-101', 'OPRISK-101', 'BASEL3-001');

-- Compliance Officers -> AML, KYC, Basel, MiFID II
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_date, status, created_at)
SELECT DISTINCT
    uuid_generate_v4(),
    c.id,
    e.id,
    NOW() - (random() * interval '90 days'),
    CASE WHEN random() < 0.5 THEN 'completed' ELSE 'in_progress' END,
    NOW()
FROM employees e
INNER JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Compliance officer'
  AND c.code IN ('CAMS-001', 'KYC-101', 'AML-102', 'BASEL3-001', 'MIFID2-001', 'GDPR-BANK-001', 'PSD2-001');

-- Bank Tellers -> Operations, Customer Service
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_date, status, created_at)
SELECT DISTINCT
    uuid_generate_v4(),
    c.id,
    e.id,
    NOW() - (random() * interval '30 days'),
    CASE WHEN random() < 0.7 THEN 'completed' ELSE 'in_progress' END,
    NOW()
FROM employees e
INNER JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Bank teller'
  AND c.code IN ('ABA-TELL-001', 'CASH-101', 'TXN-101', 'FRAUD-FRONT-001', 'CS-BANK-001', 'GDPR-BANK-001');

-- Investment Advisors -> Investment, Securities, ESG
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_date, status, created_at)
SELECT DISTINCT
    uuid_generate_v4(),
    c.id,
    e.id,
    NOW() - (random() * interval '45 days'),
    CASE WHEN random() < 0.4 THEN 'completed' ELSE 'in_progress' END,
    NOW()
FROM employees e
INNER JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Investment advisor'
  AND c.code IN ('INV-ADV-101', 'SEC-MKT-101', 'PORT-MGT-101', 'ESG-101', 'MIFID2-001', 'ETHSALES-001');

-- Financial Analysts -> Credit Risk, Data Analytics
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_date, status, created_at)
SELECT DISTINCT
    uuid_generate_v4(),
    c.id,
    e.id,
    NOW() - (random() * interval '50 days'),
    CASE WHEN random() < 0.5 THEN 'completed' ELSE 'in_progress' END,
    NOW()
FROM employees e
INNER JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Financial analyst'
  AND c.code IN ('CRISK-101', 'MRISK-101', 'BANK-DATA-001', 'FRM-P1-001', 'BASEL3-001');

-- Bank Managers -> Leadership mix
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_date, status, created_at)
SELECT DISTINCT
    uuid_generate_v4(),
    c.id,
    e.id,
    NOW() - (random() * interval '100 days'),
    CASE WHEN random() < 0.8 THEN 'completed' ELSE 'in_progress' END,
    NOW()
FROM employees e
INNER JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Bank manager'
  AND c.code IN ('BASEL3-001', 'OPRISK-101', 'CS-BANK-001', 'CYBER-FIN-001', 'COREBANK-101');

RAISE NOTICE 'Enrollments creati per ruoli RTL Bank';

END $$;

-- =============================================================================
-- PARTE 4: SKILL MAPPING PER JOB TITLE
-- =============================================================================

-- Prima eliminiamo le skill generiche esistenti per RTL Bank
DELETE FROM employee_skills
WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

-- Ora inseriamo skill specifiche per ruolo
-- Risk Analyst -> Credit Risk, Risk Management, Financial Analysis, Compliance
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Risk Management', 'Credit Risk Management') THEN 4
        WHEN es.preferred_label IN ('Financial Analysis', 'Compliance Management') THEN 3
        ELSE 2
    END,
    CASE
        WHEN es.preferred_label IN ('Risk Management', 'Credit Risk Management') THEN 'Expert'
        WHEN es.preferred_label IN ('Financial Analysis', 'Compliance Management') THEN 'Advanced'
        ELSE 'Intermediate'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Risk analyst'
  AND es.preferred_label IN (
      'Risk Management', 'Credit Risk Management', 'Financial Analysis',
      'Credit assessment', 'Compliance Management', 'Banking Regulations',
      'Auditing'
  );

-- Bank Teller -> Customer Success, Account Management, Payment systems
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Customer Success', 'Account Management') THEN 3
        ELSE 2
    END,
    CASE
        WHEN es.preferred_label IN ('Customer Success', 'Account Management') THEN 'Advanced'
        ELSE 'Intermediate'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Bank teller'
  AND es.preferred_label IN (
      'Customer Success', 'Account Management', 'Handle cash',
      'Fraud detection', 'Maintain customer relationships'
  );

-- Compliance Officer -> AML, Compliance, Regulatory
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Compliance Management', 'Anti-Money Laundering') THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label IN ('Compliance Management', 'Anti-Money Laundering') THEN 'Expert'
        ELSE 'Advanced'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Compliance officer'
  AND es.preferred_label IN (
      'Compliance Management', 'Anti-Money Laundering', 'Banking Regulations',
      'Risk Management', 'Auditing', 'Legal compliance'
  );

-- Financial Analyst
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Financial Analysis', 'Financial modeling') THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label IN ('Financial Analysis', 'Financial modeling') THEN 'Expert'
        ELSE 'Advanced'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Financial analyst'
  AND es.preferred_label IN (
      'Financial Analysis', 'Financial modeling', 'Credit assessment',
      'Data Analytics', 'Statistical analysis', 'Reporting'
  );

-- Investment Advisor
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Investment Management', 'Portfolio Management') THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label IN ('Investment Management', 'Portfolio Management') THEN 'Expert'
        ELSE 'Advanced'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Investment advisor'
  AND es.preferred_label IN (
      'Investment Management', 'Portfolio Management', 'Customer Success',
      'Financial Planning', 'Securities Trading'
  );

-- Bank Manager
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Team Leadership', 'Management') THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label IN ('Team Leadership', 'Management') THEN 'Expert'
        ELSE 'Advanced'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Bank manager'
  AND es.preferred_label IN (
      'Team Leadership', 'Management', 'Risk Management',
      'Strategic Planning', 'Business development'
  );

-- Securities Dealer
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label IN ('Securities Trading', 'Market analysis') THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label IN ('Securities Trading', 'Market analysis') THEN 'Expert'
        ELSE 'Advanced'
    END,
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Securities dealer'
  AND es.preferred_label IN (
      'Securities Trading', 'Market analysis', 'Financial Analysis',
      'Risk Management', 'Compliance Management'
  );

-- =============================================================================
-- VERIFICA FINALE
-- =============================================================================

DO $$
DECLARE
    v_courses_count INTEGER;
    v_skills_count INTEGER;
    v_enrollments_count INTEGER;
    v_paths_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_courses_count FROM courses WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    SELECT COUNT(*) INTO v_skills_count FROM employee_skills WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    SELECT COUNT(*) INTO v_enrollments_count FROM course_enrollments ce
        INNER JOIN courses c ON ce.course_id = c.id
        WHERE c.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    SELECT COUNT(*) INTO v_paths_count FROM learning_paths WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

    RAISE NOTICE '';
    RAISE NOTICE '=== RTL BANK SMART SEEDING COMPLETATO ===';
    RAISE NOTICE 'Corsi totali: %', v_courses_count;
    RAISE NOTICE 'Skills assegnate: %', v_skills_count;
    RAISE NOTICE 'Enrollments: %', v_enrollments_count;
    RAISE NOTICE 'Learning Paths: %', v_paths_count;
    RAISE NOTICE '==========================================';
END $$;
