-- Migration: 072_073_074_contract_talent_seed.sql
-- Description: Seed contract amendments, talent pools, and talent pool members
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- 072: CONTRACT AMENDMENTS (Promotions, Salary Adjustments, Role Changes)
-- ============================================================================

INSERT INTO contract_amendments (contract_id, tenant_id, amendment_type, effective_date, description, previous_values, new_values, created_at)
SELECT
    c.id,
    c.tenant_id,
    amendment_type,
    c.start_date + (random() * (NOW() - c.start_date))::interval,
    amendment_desc,
    jsonb_build_object(
        'job_title', CASE WHEN amendment_type = 'promotion' THEN 'Junior ' || e.job_title ELSE e.job_title END,
        'gross_annual_salary', c.gross_annual_salary * 0.9
    ),
    jsonb_build_object(
        'job_title', e.job_title,
        'gross_annual_salary', c.gross_annual_salary
    ),
    NOW() - (random() * INTERVAL '2 years')
FROM contracts c
JOIN employees e ON c.employee_id = e.id
JOIN tenants t ON c.tenant_id = t.id
CROSS JOIN (
    SELECT 'promotion' as amendment_type, 'Promozione a nuovo ruolo' as amendment_desc
    UNION ALL SELECT 'salary_adjustment', 'Adeguamento retributivo annuale'
    UNION ALL SELECT 'role_change', 'Cambio mansione/dipartimento'
) amendments
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND c.status = 'active'
AND random() < 0.35  -- ~35% get each type of amendment
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 073: TALENT POOLS
-- ============================================================================

INSERT INTO talent_pools (tenant_id, name, description, pool_type, criteria, is_active, created_at)
SELECT
    t.id,
    pool.name,
    pool.description,
    pool.pool_type,
    pool.criteria::jsonb,
    true,
    NOW() - (random() * INTERVAL '1 year')
FROM tenants t
CROSS JOIN (VALUES
    -- High Potentials
    ('High Potentials', 'Dipendenti ad alto potenziale identificati per crescita accelerata', 'high_potential',
     '{"min_performance": 4.0, "min_tenure_months": 12, "max_age": 40}'),
    -- Leadership Pipeline
    ('Leadership Pipeline', 'Candidati per ruoli di leadership futuri', 'leadership',
     '{"current_level": "manager", "min_tenure_months": 36, "leadership_assessment": "positive"}'),
    -- Technical Experts
    ('Technical Experts', 'Esperti tecnici riconosciuti nel loro dominio', 'expertise',
     '{"proficiency_level": 5, "certifications_count": 2}'),
    -- Rising Stars
    ('Rising Stars', 'Giovani talenti emergenti sotto i 35 anni', 'emerging',
     '{"max_age": 35, "min_performance": 3.5, "growth_trajectory": "positive"}'),
    -- Critical Skills
    ('Critical Skills Pool', 'Dipendenti con competenze critiche per il business', 'critical',
     '{"skill_category": "critical", "is_verified": true}'),
    -- Succession Ready
    ('Succession Ready', 'Candidati pronti per successione a ruoli chiave', 'succession',
     '{"readiness_level": "now", "in_succession_plan": true}'),
    -- International Mobility
    ('International Mobility', 'Dipendenti disponibili a trasferimento internazionale', 'mobility',
     '{"languages_count": 2, "mobility_willing": true}'),
    -- Innovation Champions
    ('Innovation Champions', 'Promotori dell''innovazione e del cambiamento', 'innovation',
     '{"innovation_projects": 1, "idea_submissions": 3}')
) AS pool(name, description, pool_type, criteria)
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
ON CONFLICT ON CONSTRAINT uk_talent_pool_name DO NOTHING;

-- ============================================================================
-- 074: TALENT POOL MEMBERS
-- ============================================================================

-- High Potentials: Top performers with good tenure
INSERT INTO talent_pool_members (tenant_id, talent_pool_id, employee_id, status, added_reason, added_at)
SELECT DISTINCT
    e.tenant_id,
    tp.id,
    e.id,
    'active',
    'Performance rating >= 4.0, tenure > 1 year',
    NOW() - (random() * INTERVAL '6 months')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN talent_pools tp ON tp.tenant_id = t.id AND tp.pool_type = 'high_potential'
LEFT JOIN performance_reviews pr ON pr.employee_id = e.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND e.hire_date < NOW() - INTERVAL '1 year'
AND (pr.overall_rating >= 4.0 OR random() < 0.2)
AND random() < 0.15  -- ~15% in high potential
ON CONFLICT DO NOTHING;

-- Leadership Pipeline: Managers with significant tenure
INSERT INTO talent_pool_members (tenant_id, talent_pool_id, employee_id, status, added_reason, added_at)
SELECT DISTINCT
    e.tenant_id,
    tp.id,
    e.id,
    'active',
    'Current manager with 3+ years tenure',
    NOW() - (random() * INTERVAL '6 months')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN talent_pools tp ON tp.tenant_id = t.id AND tp.pool_type = 'leadership'
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND e.auth_role IN ('LINE_MANAGER', 'DEPT_HEAD', 'HR_MANAGER')
AND e.hire_date < NOW() - INTERVAL '3 years'
ON CONFLICT DO NOTHING;

-- Technical Experts: High skill proficiency
INSERT INTO talent_pool_members (tenant_id, talent_pool_id, employee_id, status, added_reason, added_at)
SELECT DISTINCT
    e.tenant_id,
    tp.id,
    e.id,
    'active',
    'Expert-level proficiency (level 5) in multiple skills',
    NOW() - (random() * INTERVAL '6 months')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN talent_pools tp ON tp.tenant_id = t.id AND tp.pool_type = 'expertise'
JOIN employee_skills es ON es.employee_id = e.id AND es.proficiency_level = 5
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
GROUP BY e.id, e.tenant_id, tp.id
HAVING COUNT(es.id) >= 3
ON CONFLICT DO NOTHING;

-- Rising Stars: Young high performers
INSERT INTO talent_pool_members (tenant_id, talent_pool_id, employee_id, status, added_reason, added_at)
SELECT DISTINCT
    e.tenant_id,
    tp.id,
    e.id,
    'active',
    'Age under 35, strong performance trajectory',
    NOW() - (random() * INTERVAL '6 months')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN talent_pools tp ON tp.tenant_id = t.id AND tp.pool_type = 'emerging'
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND e.birth_date > NOW() - INTERVAL '35 years'
AND random() < 0.25
ON CONFLICT DO NOTHING;

-- Critical Skills: Verified skills in critical areas
INSERT INTO talent_pool_members (tenant_id, talent_pool_id, employee_id, status, added_reason, added_at)
SELECT DISTINCT
    e.tenant_id,
    tp.id,
    e.id,
    'active',
    'Verified skills in critical domain areas',
    NOW() - (random() * INTERVAL '6 months')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN talent_pools tp ON tp.tenant_id = t.id AND tp.pool_type = 'critical'
JOIN employee_skills es ON es.employee_id = e.id AND es.is_verified = true AND es.is_primary = true
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
GROUP BY e.id, e.tenant_id, tp.id
HAVING COUNT(es.id) >= 2
ON CONFLICT DO NOTHING;

-- Innovation Champions: Random selection (simulating innovation contributions)
INSERT INTO talent_pool_members (tenant_id, talent_pool_id, employee_id, status, added_reason, added_at)
SELECT DISTINCT
    e.tenant_id,
    tp.id,
    e.id,
    'active',
    'Active innovation contributor with project leadership',
    NOW() - (random() * INTERVAL '6 months')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
JOIN talent_pools tp ON tp.tenant_id = t.id AND tp.pool_type = 'innovation'
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND random() < 0.1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_amendments INTEGER;
    v_pools INTEGER;
    v_members INTEGER;
    v_distinct_employees INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_amendments FROM contract_amendments;
    SELECT COUNT(*) INTO v_pools FROM talent_pools;
    SELECT COUNT(*) INTO v_members FROM talent_pool_members;
    SELECT COUNT(DISTINCT employee_id) INTO v_distinct_employees FROM talent_pool_members;

    RAISE NOTICE '=== Migration 072-074 Verification ===';
    RAISE NOTICE 'Contract amendments: %', v_amendments;
    RAISE NOTICE 'Talent pools: %', v_pools;
    RAISE NOTICE 'Talent pool members: %', v_members;
    RAISE NOTICE 'Distinct employees in pools: %', v_distinct_employees;
END $$;
