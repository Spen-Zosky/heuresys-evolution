-- Migration: 071_employee_skills_seed.sql
-- Description: Populate employee_skills with industry-relevant ESCO skills
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- STRATEGY:
-- 1. Select relevant ESCO skills for each tenant's industry
-- 2. Assign 8-15 skills per employee
-- 3. Proficiency based on tenure: 0-2yr=2, 2-5yr=3, 5-10yr=4, 10+yr=5
-- ============================================================================

-- Clear existing employee_skills to avoid duplicates
TRUNCATE employee_skills CASCADE;

-- ============================================================================
-- RTL BANK - FINANCE/BANKING SKILLS
-- ============================================================================

WITH banking_skills AS (
    SELECT id, preferred_label_en, skill_type,
           ROW_NUMBER() OVER (ORDER BY random()) as rn
    FROM esco_skills
    WHERE preferred_label_en ~* '(financ|bank|credit|risk|invest|audit|compliance|account|budget|tax|insurance|loan|portfolio|treasury|wealth|asset|capital|liquidity|regulatory|payment|transaction|fraud|money launder|KYC|customer|client|service|sales|adviso|consult|analy|report|present|communicat|negoti|team|lead|manage|project|strateg|plan|decision|problem|critical)'
    AND skill_type = 'skill'
    LIMIT 100
),
rtl_employees AS (
    SELECT e.id as employee_id, e.tenant_id, e.hire_date,
           EXTRACT(YEAR FROM AGE(NOW(), e.hire_date)) as tenure_years,
           d.name as dept_name,
           ROW_NUMBER() OVER (ORDER BY e.id) as emp_num
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'rtl-bank'
    AND e.is_active = true
)
INSERT INTO employee_skills (tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, years_experience, is_primary, is_verified, source, confidence_score, primary_category, created_at)
SELECT
    re.tenant_id,
    re.employee_id,
    bs.id,
    CASE
        WHEN re.tenure_years < 2 THEN 2
        WHEN re.tenure_years < 5 THEN 3
        WHEN re.tenure_years < 10 THEN 4
        ELSE 5
    END as proficiency_level,
    CASE
        WHEN re.tenure_years < 2 THEN 'intermediate'
        WHEN re.tenure_years < 5 THEN 'advanced'
        WHEN re.tenure_years < 10 THEN 'expert'
        ELSE 'master'
    END as proficiency_label,
    LEAST(re.tenure_years, 15)::numeric(4,1) as years_experience,
    (bs.rn <= 3) as is_primary,
    (random() > 0.3) as is_verified,
    CASE WHEN random() > 0.5 THEN 'self_assessment' ELSE 'manager_assessment' END,
    (0.7 + random() * 0.3)::numeric(3,2) as confidence_score,
    CASE
        WHEN bs.preferred_label_en ~* '(financ|account|audit|tax|budget)' THEN 'hard'
        WHEN bs.preferred_label_en ~* '(communicat|team|lead|negoti)' THEN 'soft'
        ELSE 'hybrid'
    END,
    NOW() - (random() * INTERVAL '365 days')
FROM rtl_employees re
CROSS JOIN banking_skills bs
WHERE bs.rn <= 8 + floor(random() * 7)::int  -- 8-15 skills per employee
AND (
    -- Skill-department matching logic
    (re.dept_name ~* '(risk|compliance)' AND bs.preferred_label_en ~* '(risk|compliance|regulatory|audit)')
    OR (re.dept_name ~* '(credit|loan)' AND bs.preferred_label_en ~* '(credit|loan|assess|analy)')
    OR (re.dept_name ~* '(retail|branch)' AND bs.preferred_label_en ~* '(customer|client|sales|service)')
    OR (re.dept_name ~* '(IT|tech)' AND bs.preferred_label_en ~* '(data|analy|system|digital)')
    OR (re.dept_name ~* '(HR|human)' AND bs.preferred_label_en ~* '(team|communicat|manage|develop)')
    OR (re.dept_name ~* '(finance|account)' AND bs.preferred_label_en ~* '(financ|account|budget|report)')
    OR bs.rn <= 5  -- Everyone gets some core skills
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SMARTFOOD - FOOD INDUSTRY SKILLS
-- ============================================================================

WITH food_skills AS (
    SELECT id, preferred_label_en, skill_type,
           ROW_NUMBER() OVER (ORDER BY random()) as rn
    FROM esco_skills
    WHERE preferred_label_en ~* '(food|HACCP|quality|safety|hygiene|production|manufactur|supply chain|logistics|inventory|procure|laborator|test|analys|microb|nutri|sensory|organic|certif|audit|inspect|standard|ISO|packag|stor|refriger|clean|sanit|machine|equipment|process|batch|recipe|ingredient|allergen|trace|recall|shelf life|preserv|team|lead|manage|supervis|train|document|report|SOP|GMP)'
    AND skill_type = 'skill'
    LIMIT 100
),
smartfood_employees AS (
    SELECT e.id as employee_id, e.tenant_id, e.hire_date,
           EXTRACT(YEAR FROM AGE(NOW(), e.hire_date)) as tenure_years,
           d.name as dept_name,
           ROW_NUMBER() OVER (ORDER BY e.id) as emp_num
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'smartfood'
    AND e.is_active = true
)
INSERT INTO employee_skills (tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, years_experience, is_primary, is_verified, source, confidence_score, primary_category, created_at)
SELECT
    se.tenant_id,
    se.employee_id,
    fs.id,
    CASE
        WHEN se.tenure_years < 2 THEN 2
        WHEN se.tenure_years < 5 THEN 3
        WHEN se.tenure_years < 10 THEN 4
        ELSE 5
    END,
    CASE
        WHEN se.tenure_years < 2 THEN 'intermediate'
        WHEN se.tenure_years < 5 THEN 'advanced'
        WHEN se.tenure_years < 10 THEN 'expert'
        ELSE 'master'
    END,
    LEAST(se.tenure_years, 15)::numeric(4,1),
    (fs.rn <= 3),
    (random() > 0.3),
    CASE WHEN random() > 0.5 THEN 'self_assessment' ELSE 'manager_assessment' END,
    (0.7 + random() * 0.3)::numeric(3,2),
    CASE
        WHEN fs.preferred_label_en ~* '(HACCP|quality|laborator|test|analys|microb)' THEN 'hard'
        WHEN fs.preferred_label_en ~* '(team|lead|communicat|train)' THEN 'soft'
        ELSE 'hybrid'
    END,
    NOW() - (random() * INTERVAL '365 days')
FROM smartfood_employees se
CROSS JOIN food_skills fs
WHERE fs.rn <= 8 + floor(random() * 7)::int
AND (
    (se.dept_name ~* '(quality|QA|QC)' AND fs.preferred_label_en ~* '(quality|HACCP|audit|inspect|test)')
    OR (se.dept_name ~* '(produc|manufactur)' AND fs.preferred_label_en ~* '(produc|manufactur|machine|process|batch)')
    OR (se.dept_name ~* '(R&D|research|develop)' AND fs.preferred_label_en ~* '(laborator|test|analys|nutri|recipe)')
    OR (se.dept_name ~* '(logistic|supply|warehouse)' AND fs.preferred_label_en ~* '(supply|logistics|inventory|stor)')
    OR (se.dept_name ~* '(HR|human)' AND fs.preferred_label_en ~* '(team|train|document|manage)')
    OR fs.rn <= 5
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ECONOVA - SUSTAINABILITY/GREEN SKILLS
-- ============================================================================

WITH green_skills AS (
    SELECT id, preferred_label_en, skill_type,
           ROW_NUMBER() OVER (ORDER BY random()) as rn
    FROM esco_skills
    WHERE preferred_label_en ~* '(environment|sustain|green|carbon|emission|climate|energy|renewable|solar|wind|waste|recycl|circular|ESG|CSR|GRI|report|audit|certif|ISO 14|EMAS|LCA|life cycle|impact|footprint|water|pollution|biodiversity|ecosystem|conservation|efficiency|resource|consult|adviso|analy|assess|strateg|plan|project|manage|stakeholder|communicat|present|data|model|research)'
    AND skill_type = 'skill'
    LIMIT 100
),
econova_employees AS (
    SELECT e.id as employee_id, e.tenant_id, e.hire_date,
           EXTRACT(YEAR FROM AGE(NOW(), e.hire_date)) as tenure_years,
           d.name as dept_name,
           ROW_NUMBER() OVER (ORDER BY e.id) as emp_num
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code = 'econova'
    AND e.is_active = true
)
INSERT INTO employee_skills (tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, years_experience, is_primary, is_verified, source, confidence_score, primary_category, created_at)
SELECT
    ee.tenant_id,
    ee.employee_id,
    gs.id,
    CASE
        WHEN ee.tenure_years < 2 THEN 2
        WHEN ee.tenure_years < 5 THEN 3
        WHEN ee.tenure_years < 10 THEN 4
        ELSE 5
    END,
    CASE
        WHEN ee.tenure_years < 2 THEN 'intermediate'
        WHEN ee.tenure_years < 5 THEN 'advanced'
        WHEN ee.tenure_years < 10 THEN 'expert'
        ELSE 'master'
    END,
    LEAST(ee.tenure_years, 15)::numeric(4,1),
    (gs.rn <= 3),
    (random() > 0.3),
    CASE WHEN random() > 0.5 THEN 'self_assessment' ELSE 'manager_assessment' END,
    (0.7 + random() * 0.3)::numeric(3,2),
    CASE
        WHEN gs.preferred_label_en ~* '(environment|carbon|LCA|ISO|audit|data|model)' THEN 'hard'
        WHEN gs.preferred_label_en ~* '(communicat|stakeholder|present|consult)' THEN 'soft'
        ELSE 'hybrid'
    END,
    NOW() - (random() * INTERVAL '365 days')
FROM econova_employees ee
CROSS JOIN green_skills gs
WHERE gs.rn <= 8 + floor(random() * 7)::int
AND (
    (ee.dept_name ~* '(engineer|technical)' AND gs.preferred_label_en ~* '(energy|engineer|technical|design|model)')
    OR (ee.dept_name ~* '(consult|advisory)' AND gs.preferred_label_en ~* '(consult|adviso|strateg|stakeholder)')
    OR (ee.dept_name ~* '(audit|certif|compliance)' AND gs.preferred_label_en ~* '(audit|certif|ISO|EMAS|assess)')
    OR (ee.dept_name ~* '(research|R&D)' AND gs.preferred_label_en ~* '(research|analy|data|LCA|impact)')
    OR gs.rn <= 5
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADD UNIVERSAL SOFT SKILLS TO ALL EMPLOYEES
-- ============================================================================

WITH soft_skills AS (
    SELECT id, preferred_label_en
    FROM esco_skills
    WHERE preferred_label_en ~* '^(work in team|communicate|adapt to change|manage time|solve problem|think critical|make decision|show initiative|manage stress|negotiate|present information)'
    AND skill_type = 'skill'
    LIMIT 15
),
all_employees AS (
    SELECT e.id as employee_id, e.tenant_id,
           EXTRACT(YEAR FROM AGE(NOW(), e.hire_date)) as tenure_years
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
    AND e.is_active = true
)
INSERT INTO employee_skills (tenant_id, employee_id, esco_skill_id, proficiency_level, proficiency_label, years_experience, is_primary, is_verified, source, confidence_score, primary_category, created_at)
SELECT
    ae.tenant_id,
    ae.employee_id,
    ss.id,
    CASE
        WHEN ae.tenure_years < 2 THEN 2
        WHEN ae.tenure_years < 5 THEN 3
        WHEN ae.tenure_years < 10 THEN 4
        ELSE 5
    END,
    CASE
        WHEN ae.tenure_years < 2 THEN 'intermediate'
        WHEN ae.tenure_years < 5 THEN 'advanced'
        WHEN ae.tenure_years < 10 THEN 'expert'
        ELSE 'master'
    END,
    LEAST(ae.tenure_years, 12)::numeric(4,1),
    false,
    true,
    'self_assessment',
    0.85,
    'soft',
    NOW() - (random() * INTERVAL '180 days')
FROM all_employees ae
CROSS JOIN soft_skills ss
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ASSIGN EMPLOYEE CERTIFICATIONS
-- ============================================================================

-- Assign 1-3 certifications per employee based on role
INSERT INTO employee_certifications (tenant_id, employee_id, certification_id, issue_date, expiry_date, credential_number, status, verified, created_at)
SELECT
    e.tenant_id,
    e.id,
    c.id,
    NOW() - (random() * INTERVAL '3 years') as issue_date,
    CASE WHEN c.validity_months IS NOT NULL
         THEN NOW() + ((c.validity_months || ' months')::interval) - (random() * INTERVAL '1 year')
         ELSE NULL
    END as expiry_date,
    UPPER(SUBSTRING(t.code, 1, 2)) || '-' || LPAD((floor(random() * 100000)::int)::text, 6, '0') as credential_number,
    CASE WHEN random() > 0.1 THEN 'active' ELSE 'expired' END,
    true,
    NOW()
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN certifications c ON c.tenant_id = t.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND random() < 0.4  -- ~40% of employees get each certification
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_total_skills INTEGER;
    v_rtl_skills INTEGER;
    v_smartfood_skills INTEGER;
    v_econova_skills INTEGER;
    v_total_certs INTEGER;
    v_employees_with_skills INTEGER;
    v_avg_skills_per_employee NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_skills FROM employee_skills;
    SELECT COUNT(*) INTO v_rtl_skills FROM employee_skills es JOIN tenants t ON es.tenant_id = t.id WHERE t.code = 'rtl-bank';
    SELECT COUNT(*) INTO v_smartfood_skills FROM employee_skills es JOIN tenants t ON es.tenant_id = t.id WHERE t.code = 'smartfood';
    SELECT COUNT(*) INTO v_econova_skills FROM employee_skills es JOIN tenants t ON es.tenant_id = t.id WHERE t.code = 'econova';
    SELECT COUNT(*) INTO v_total_certs FROM employee_certifications;
    SELECT COUNT(DISTINCT employee_id) INTO v_employees_with_skills FROM employee_skills;
    SELECT ROUND(v_total_skills::numeric / NULLIF(v_employees_with_skills, 0), 1) INTO v_avg_skills_per_employee;

    RAISE NOTICE '=== Migration 071 Verification ===';
    RAISE NOTICE 'Total employee skills: %', v_total_skills;
    RAISE NOTICE '  RTL Bank: %', v_rtl_skills;
    RAISE NOTICE '  SmartFood: %', v_smartfood_skills;
    RAISE NOTICE '  EcoNova: %', v_econova_skills;
    RAISE NOTICE 'Employees with skills: %', v_employees_with_skills;
    RAISE NOTICE 'Avg skills per employee: %', v_avg_skills_per_employee;
    RAISE NOTICE 'Total certifications assigned: %', v_total_certs;
END $$;
