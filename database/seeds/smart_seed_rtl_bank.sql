-- =============================================================================
-- SMART SEED: RTL Bank (Retail Banking)
-- =============================================================================
-- Generato con AI-assisted research il 2025-12-19
-- Basato su: ACAMS, GARP FRM, ABA, ricerca corsi banking reali
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

INSERT INTO courses (id, tenant_id, title, description, category, provider, duration_hours, skill_level, is_mandatory, status, created_at)
VALUES
-- AML/KYC (basato su ACAMS CAMS)
(uuid_generate_v4(), v_tenant_id,
 'CAMS - Certified Anti-Money Laundering Specialist Prep',
 'Preparazione alla certificazione CAMS di ACAMS. Copre identificazione transazioni sospette, due diligence clienti, reporting SAR/STR, sanzioni internazionali.',
 'compliance', 'ACAMS', 40, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'KYC Foundations - Know Your Customer',
 'Fondamenti di Customer Due Diligence (CDD), Enhanced Due Diligence (EDD), identificazione PEP, screening liste sanzioni, verifica documentale.',
 'compliance', 'ACAMS', 16, 'intermediate', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'AML Transaction Monitoring',
 'Tecniche di monitoraggio transazioni, red flags, pattern sospetti, uso di AI/ML nel transaction monitoring, case studies reali.',
 'compliance', 'internal', 12, 'intermediate', true, 'published', NOW()),

-- Basel III/IV
(uuid_generate_v4(), v_tenant_id,
 'Basel III Framework - Capital Requirements',
 'Requisiti patrimoniali Basilea III: CET1, Tier 1, Tier 2, buffer di capitale, leverage ratio, LCR, NSFR. Impatto su strategia bancaria.',
 'compliance', 'Eureka Financial', 24, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Basel IV - New Advances in Banking Regulation',
 'Evoluzioni regolamentari: output floor, revisione approcci IRB, rischio operativo, CVA risk, FRTB. Implementazione 2025.',
 'compliance', 'Eureka Financial', 20, 'advanced', false, 'published', NOW()),

-- MiFID II
(uuid_generate_v4(), v_tenant_id,
 'MiFID II Compliance for Investment Services',
 'Direttiva MiFID II: product governance, best execution, inducements, recording, reporting EMIR/MiFIR. Obblighi per consulenti.',
 'compliance', 'internal', 16, 'intermediate', true, 'published', NOW()),

-- GDPR Banking
(uuid_generate_v4(), v_tenant_id,
 'GDPR per Operatori Bancari',
 'Privacy nel settore bancario: consenso, data retention, diritti DSAR, breach notification, trasferimenti extra-UE, sanzioni.',
 'compliance', 'internal', 8, 'beginner', true, 'published', NOW()),

-- PSD2
(uuid_generate_v4(), v_tenant_id,
 'PSD2 e Open Banking',
 'Payment Services Directive 2: SCA, API banking, TPP, AISP/PISP, sicurezza pagamenti, screen scraping, RTS.',
 'compliance', 'internal', 12, 'intermediate', false, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.2 CORSI RISK MANAGEMENT
-- -----------------------------------------------------------------------------

-- FRM (basato su GARP)
(uuid_generate_v4(), v_tenant_id,
 'FRM Part I - Financial Risk Manager Foundations',
 'Preparazione FRM GARP Part I: quantitative analysis, financial markets, valuation models, market risk measurement.',
 'risk_management', 'GARP', 60, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'FRM Part II - Advanced Risk Management',
 'Preparazione FRM GARP Part II: market risk, credit risk, operational risk, liquidity risk, investment management, current issues.',
 'risk_management', 'GARP', 60, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Credit Risk Analysis Fundamentals',
 'Analisi merito creditizio: rating interni, PD/LGD/EAD, scoring models, financial statement analysis, settore corporate e retail.',
 'risk_management', 'ABA', 24, 'intermediate', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Market Risk Management',
 'VaR, Expected Shortfall, stress testing, scenario analysis, backtesting, hedging strategies, Greeks.',
 'risk_management', 'internal', 20, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Operational Risk Management',
 'Framework OpRisk: identificazione, assessment, mitigazione, KRI, loss data collection, RCSA, incident management.',
 'risk_management', 'internal', 16, 'intermediate', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Liquidity Risk Management',
 'ALM, liquidity gap, LCR/NSFR, contingency funding plan, stress test liquidita, early warning indicators.',
 'risk_management', 'internal', 16, 'advanced', false, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.3 CORSI OPERATIONS & TELLER
-- -----------------------------------------------------------------------------

-- Bank Teller (basato su ABA)
(uuid_generate_v4(), v_tenant_id,
 'ABA Bank Teller Certificate - Foundations',
 'Fondamenti operativita di cassa: gestione contante, riconoscimento banconote, apertura/chiusura giornata, riconciliazione.',
 'operations', 'ABA', 16, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Cash Handling & Counterfeit Detection',
 'Best practices gestione contante, riconoscimento banconote contraffatte, tecniche di verifica, procedure anti-frode.',
 'operations', 'ABA', 8, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Transaction Processing Excellence',
 'Depositi, prelievi, bonifici, pagamenti utenze, cambi valuta, assegni, procedure e controlli operativi.',
 'operations', 'ABA', 12, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Fraud Prevention for Frontline Staff',
 'Riconoscimento tentativi di frode: social engineering, identity theft, phishing, vishing. Procedure di escalation.',
 'operations', 'internal', 8, 'beginner', true, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.4 CORSI INVESTMENT & WEALTH
-- -----------------------------------------------------------------------------

(uuid_generate_v4(), v_tenant_id,
 'Investment Advisory Fundamentals',
 'Principi consulenza finanziaria: asset allocation, profilo rischio cliente, suitability, reporting performance.',
 'investment', 'CFA Institute', 24, 'intermediate', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Securities Markets & Trading',
 'Mercati finanziari: equity, fixed income, derivatives, forex. Order types, execution, settlement, custody.',
 'investment', 'internal', 20, 'intermediate', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Portfolio Management Essentials',
 'Costruzione portafoglio: Modern Portfolio Theory, CAPM, diversificazione, rebalancing, benchmark.',
 'investment', 'CFA Institute', 32, 'advanced', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'ESG Investing & Sustainable Finance',
 'Investimenti ESG: rating ESG, green bonds, impact investing, EU Taxonomy, SFDR disclosure.',
 'investment', 'internal', 12, 'intermediate', false, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.5 CORSI CUSTOMER SERVICE & SOFT SKILLS BANKING
-- -----------------------------------------------------------------------------

(uuid_generate_v4(), v_tenant_id,
 'Customer Service Excellence in Banking',
 'Tecniche di customer service specifiche per il settore bancario: gestione reclami, cross-selling etico, fidelizzazione.',
 'soft_skills', 'internal', 8, 'beginner', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Financial Literacy for Customer Education',
 'Come educare i clienti: risparmio, budgeting, credito responsabile, protezione frodi online.',
 'soft_skills', 'internal', 6, 'beginner', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Ethical Sales in Banking',
 'Vendita etica prodotti bancari: needs-based selling, trasparenza, conflitto interessi, best interest duty.',
 'soft_skills', 'internal', 8, 'intermediate', true, 'published', NOW()),

-- -----------------------------------------------------------------------------
-- 1.6 CORSI TECHNICAL/IT BANKING
-- -----------------------------------------------------------------------------

(uuid_generate_v4(), v_tenant_id,
 'Core Banking Systems Overview',
 'Architettura sistemi core banking, integrazioni, canali digitali, API, cybersecurity bancaria.',
 'technical', 'internal', 16, 'intermediate', false, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Cybersecurity in Financial Services',
 'Minacce cyber specifiche banking: APT, ransomware, insider threat, SWIFT security, incident response.',
 'technical', 'internal', 20, 'advanced', true, 'published', NOW()),

(uuid_generate_v4(), v_tenant_id,
 'Data Analytics for Banking',
 'Analytics nel banking: customer analytics, credit scoring, fraud detection, regulatory reporting automation.',
 'technical', 'Coursera', 24, 'intermediate', false, 'published', NOW());

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

END $$;

-- =============================================================================
-- PARTE 3: SKILL MAPPING PER JOB TITLE
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
      'Customer Success', 'Account Management', 'Payment systems',
      'Cybersecurity'
  );

-- Compliance Officer -> AML, Compliance, Regulations, Auditing
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label ILIKE '%money%' OR es.preferred_label = 'Compliance Management' THEN 5
        WHEN es.preferred_label IN ('Banking Regulations', 'Regulatory compliance') THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label ILIKE '%money%' OR es.preferred_label = 'Compliance Management' THEN 'Expert'
        WHEN es.preferred_label IN ('Banking Regulations', 'Regulatory compliance') THEN 'Expert'
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
      'Anti Money Laundering', 'Anti-money laundering', 'Compliance Management',
      'Banking Regulations', 'Regulatory compliance', 'Auditing', 'GDPR Compliance'
  );

-- Financial Analyst -> Financial Analysis, Credit, Risk
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label ILIKE '%financial%' THEN 4
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label ILIKE '%financial%' THEN 'Expert'
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
      'Financial Analysis', 'Financial Reporting', 'Financial analysis',
      'Credit Risk Management', 'Credit assessment', 'Cost Accounting'
  );

-- Investment Advisor -> Investment, Securities, Customer
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    CASE
        WHEN es.preferred_label ILIKE '%invest%' THEN 5
        ELSE 3
    END,
    CASE
        WHEN es.preferred_label ILIKE '%invest%' THEN 'Expert'
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
      'Investment strategies', 'Investor Relations', 'Financial Analysis',
      'Customer Success', 'Compliance Management'
  );

-- Securities Dealer -> Investment, Risk, Compliance
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    4,
    'Expert',
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Securities dealer'
  AND es.preferred_label IN (
      'Investment strategies', 'Risk Management', 'Compliance Management',
      'Financial Analysis'
  );

-- Bank Manager -> tutte le competenze manageriali
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    4,
    'Expert',
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Bank manager'
  AND es.preferred_label IN (
      'Risk Management', 'Compliance Management', 'Financial Analysis',
      'Customer Success', 'Account Management', 'Auditing'
  );

-- IT/Tech roles -> Cybersecurity, Information Security
INSERT INTO employee_skills (id, tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, source, is_verified, created_at)
SELECT
    uuid_generate_v4(),
    e.tenant_id,
    e.id,
    es.id,
    4,
    'Expert',
    'smart_seeding',
    false,
    NOW()
FROM employees e
CROSS JOIN esco_skills es
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title IN ('Software Developer', 'System Administrator', 'IT Director')
  AND es.preferred_label IN (
      'Cybersecurity', 'Information Security', 'Network Security'
  );

-- =============================================================================
-- PARTE 4: COURSE ENROLLMENTS REALISTICI
-- =============================================================================

-- Enrollment automatico corsi mandatory per tutti (senza tenant_id che non esiste)
INSERT INTO course_enrollments (id, employee_id, course_id, status, progress_percent, enrolled_at, created_at)
SELECT
    uuid_generate_v4(),
    e.id,
    c.id,
    CASE WHEN random() > 0.3 THEN 'completed' ELSE 'in_progress' END,
    CASE WHEN random() > 0.3 THEN 100 ELSE floor(random() * 80 + 10)::integer END,
    NOW() - (random() * interval '180 days'),
    NOW()
FROM employees e
JOIN courses c ON c.tenant_id = e.tenant_id AND c.is_mandatory = true
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
ON CONFLICT DO NOTHING;

-- Enrollment specifici per ruolo (esempio: Risk Analyst in corsi FRM)
INSERT INTO course_enrollments (id, employee_id, course_id, status, progress_percent, enrolled_at, created_at)
SELECT
    uuid_generate_v4(),
    e.id,
    c.id,
    CASE WHEN random() > 0.5 THEN 'completed' ELSE 'in_progress' END,
    CASE WHEN random() > 0.5 THEN 100 ELSE floor(random() * 70 + 20)::integer END,
    NOW() - (random() * interval '365 days'),
    NOW()
FROM employees e
JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Risk analyst'
  AND c.category = 'risk_management'
ON CONFLICT DO NOTHING;

-- Compliance officers in corsi AML/KYC
INSERT INTO course_enrollments (id, employee_id, course_id, status, progress_percent, enrolled_at, created_at)
SELECT
    uuid_generate_v4(),
    e.id,
    c.id,
    CASE WHEN random() > 0.4 THEN 'completed' ELSE 'in_progress' END,
    CASE WHEN random() > 0.4 THEN 100 ELSE floor(random() * 60 + 30)::integer END,
    NOW() - (random() * interval '300 days'),
    NOW()
FROM employees e
JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Compliance officer'
  AND (c.title ILIKE '%AML%' OR c.title ILIKE '%KYC%' OR c.title ILIKE '%compliance%')
ON CONFLICT DO NOTHING;

-- Bank tellers in corsi operations
INSERT INTO course_enrollments (id, employee_id, course_id, status, progress_percent, enrolled_at, created_at)
SELECT
    uuid_generate_v4(),
    e.id,
    c.id,
    CASE WHEN random() > 0.2 THEN 'completed' ELSE 'in_progress' END,
    CASE WHEN random() > 0.2 THEN 100 ELSE floor(random() * 50 + 40)::integer END,
    NOW() - (random() * interval '200 days'),
    NOW()
FROM employees e
JOIN courses c ON c.tenant_id = e.tenant_id
WHERE e.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e'
  AND e.job_title = 'Bank teller'
  AND c.category = 'operations'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICA FINALE
-- =============================================================================

DO $$
DECLARE
    v_courses INTEGER;
    v_skills INTEGER;
    v_enrollments INTEGER;
    v_paths INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_courses FROM courses WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    SELECT COUNT(*) INTO v_skills FROM employee_skills WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    SELECT COUNT(*) INTO v_enrollments
    FROM course_enrollments ce
    JOIN courses c ON ce.course_id = c.id
    WHERE c.tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';
    SELECT COUNT(*) INTO v_paths FROM learning_paths WHERE tenant_id = '0c54b84a-db6e-4da4-bc91-af5d480d524e';

    RAISE NOTICE '=== RTL BANK SMART SEEDING COMPLETATO ===';
    RAISE NOTICE 'Corsi totali: %', v_courses;
    RAISE NOTICE 'Skills assegnate: %', v_skills;
    RAISE NOTICE 'Enrollments: %', v_enrollments;
    RAISE NOTICE 'Learning Paths: %', v_paths;
END $$;
