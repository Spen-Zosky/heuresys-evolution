-- Migration: 075_076_succession_planning_seed.sql
-- Description: Seed succession plans and candidates for critical positions
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- 075: SUCCESSION PLANS - Critical Positions
-- ============================================================================

-- RTL BANK - Banking/Finance Critical Positions
INSERT INTO succession_plans (tenant_id, position_name, incumbent_employee_id, criticality_level, risk_level, notes, target_date, status)
SELECT
    t.id,
    pos.position_name,
    (SELECT e.id FROM employees e WHERE e.tenant_id = t.id AND e.job_title ILIKE '%' || pos.title_pattern || '%' AND e.is_active = true LIMIT 1),
    pos.criticality,
    pos.risk,
    pos.notes,
    NOW() + (pos.target_months || ' months')::interval,
    'active'
FROM tenants t
CROSS JOIN (VALUES
    ('CEO / Amministratore Delegato', 'Direttore%', 'critical', 'high', 'Posizione apicale con competenze strategiche uniche', 24),
    ('CFO / Direttore Finanziario', 'Finanz%', 'critical', 'high', 'Conoscenza profonda regolamentazione bancaria', 18),
    ('CRO / Chief Risk Officer', 'Risk%', 'critical', 'high', 'Competenze specialistiche in risk management', 18),
    ('CTO / Chief Technology Officer', 'IT%Director%', 'critical', 'medium', 'Trasformazione digitale in corso', 12),
    ('Head of Retail Banking', 'Retail%', 'high', 'medium', 'Gestione rete filiali nazionale', 12),
    ('Head of Corporate Banking', 'Corporate%', 'high', 'medium', 'Relazioni clientela large corporate', 12),
    ('Head of Compliance', 'Compliance%', 'critical', 'high', 'Requisiti regolamentari stringenti', 18),
    ('Head of Operations', 'Operation%', 'high', 'medium', 'Continuità operativa critica', 12),
    ('Head of HR', 'HR%Director%', 'high', 'low', 'Gestione talent pipeline interna', 12),
    ('Branch Director Milano', 'Direttore%Filiale%', 'medium', 'low', 'Principale hub territoriale', 6)
) AS pos(position_name, title_pattern, criticality, risk, notes, target_months)
WHERE t.code = 'rtl-bank'
ON CONFLICT DO NOTHING;

-- SMARTFOOD - Food Industry Critical Positions
INSERT INTO succession_plans (tenant_id, position_name, incumbent_employee_id, criticality_level, risk_level, notes, target_date, status)
SELECT
    t.id,
    pos.position_name,
    (SELECT e.id FROM employees e WHERE e.tenant_id = t.id AND e.job_title ILIKE '%' || pos.title_pattern || '%' AND e.is_active = true LIMIT 1),
    pos.criticality,
    pos.risk,
    pos.notes,
    NOW() + (pos.target_months || ' months')::interval,
    'active'
FROM tenants t
CROSS JOIN (VALUES
    ('Amministratore Delegato', 'Direttore%Generale%', 'critical', 'high', 'Leadership strategica settore alimentare', 24),
    ('Direttore Generale', 'Direttore%', 'critical', 'high', 'Coordinamento tutte le funzioni aziendali', 18),
    ('Direttore Produzione', 'Produzione%', 'critical', 'high', 'Gestione impianti e linee produttive', 12),
    ('Direttore Qualità', 'Qualità%', 'critical', 'critical', 'Certificazioni HACCP/BRC/IFS critiche', 12),
    ('Responsabile R&D', 'R&D%', 'high', 'medium', 'Sviluppo nuovi prodotti e innovazione', 12),
    ('Responsabile Supply Chain', 'Supply%Chain%', 'high', 'high', 'Continuità approvvigionamenti critici', 12),
    ('Plant Manager Stabilimento 1', 'Plant%Manager%', 'high', 'medium', 'Principale sito produttivo', 6),
    ('QA Manager', 'QA%', 'high', 'high', 'Conformità standard sicurezza alimentare', 6),
    ('Head of Logistics', 'Logistic%', 'medium', 'medium', 'Gestione catena distributiva', 12),
    ('HR Manager', 'HR%', 'medium', 'low', 'Gestione personale produzione', 6)
) AS pos(position_name, title_pattern, criticality, risk, notes, target_months)
WHERE t.code = 'smartfood'
ON CONFLICT DO NOTHING;

-- ECONOVA - Sustainability Consulting Critical Positions
INSERT INTO succession_plans (tenant_id, position_name, incumbent_employee_id, criticality_level, risk_level, notes, target_date, status)
SELECT
    t.id,
    pos.position_name,
    (SELECT e.id FROM employees e WHERE e.tenant_id = t.id AND e.job_title ILIKE '%' || pos.title_pattern || '%' AND e.is_active = true LIMIT 1),
    pos.criticality,
    pos.risk,
    pos.notes,
    NOW() + (pos.target_months || ' months')::interval,
    'active'
FROM tenants t
CROSS JOIN (VALUES
    ('CEO / Managing Partner', 'Managing%Partner%', 'critical', 'high', 'Visione strategica e relazioni istituzionali', 24),
    ('COO / Partner Operations', 'Partner%', 'critical', 'high', 'Gestione operativa practice', 18),
    ('Head of Engineering', 'Engineer%Director%', 'critical', 'high', 'Competenze tecniche specialistiche', 12),
    ('Head of ESG Advisory', 'ESG%', 'critical', 'high', 'Crescita mercato ESG consulting', 12),
    ('Head of Certification', 'Certificat%', 'high', 'medium', 'Accreditamenti ISO/EMAS', 12),
    ('Senior Consultant Lead', 'Senior%Consultant%', 'high', 'medium', 'Delivery progetti chiave', 6),
    ('Carbon Strategy Director', 'Carbon%', 'high', 'high', 'Expertise carbon accounting unica', 12),
    ('LCA Practice Lead', 'LCA%', 'medium', 'medium', 'Life Cycle Assessment expertise', 12)
) AS pos(position_name, title_pattern, criticality, risk, notes, target_months)
WHERE t.code = 'econova'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 076: SUCCESSION CANDIDATES
-- ============================================================================

-- Assign candidates to succession plans based on talent pool membership and performance
INSERT INTO succession_candidates (critical_role_id, candidate_employee_id, readiness_level, strengths, development_needs, development_plan, rank_order)
SELECT
    sp.id,
    tpm.employee_id,
    CASE
        WHEN random() < 0.2 THEN 'ready_now'
        WHEN random() < 0.5 THEN 'ready_1_year'
        WHEN random() < 0.8 THEN 'ready_2_years'
        ELSE 'ready_3_years'
    END,
    CASE floor(random() * 5)::int
        WHEN 0 THEN 'Forte leadership e capacità di gestione team. Eccellenti risultati nel ruolo attuale.'
        WHEN 1 THEN 'Solide competenze tecniche e visione strategica. Ottima capacità di problem solving.'
        WHEN 2 THEN 'Esperienza cross-funzionale significativa. Ottime capacità relazionali e di networking.'
        WHEN 3 THEN 'Track record di successi nei progetti. Alta motivazione e ambizione di crescita.'
        ELSE 'Profonda conoscenza del business. Riconosciuto come riferimento dai colleghi.'
    END,
    CASE floor(random() * 5)::int
        WHEN 0 THEN 'Sviluppare competenze di financial management e budget planning.'
        WHEN 1 THEN 'Ampliare esperienza in contesti internazionali e multicultural.'
        WHEN 2 THEN 'Rafforzare capacità di public speaking e comunicazione executive.'
        WHEN 3 THEN 'Acquisire certificazioni specifiche di settore richieste per il ruolo.'
        ELSE 'Maturare esperienza nella gestione di team più ampi e diversificati.'
    END,
    CASE floor(random() * 4)::int
        WHEN 0 THEN 'Executive coaching 12 mesi + Job rotation in funzione correlata + MBA executive sponsorship'
        WHEN 1 THEN 'Mentoring con incumbent + Progetto strategico cross-funzionale + Leadership development program'
        WHEN 2 THEN 'Stretch assignment su progetto critico + Certificazione professionale + International exposure'
        ELSE 'Action learning su business case + Executive education program + Shadowing dirigente senior'
    END,
    ROW_NUMBER() OVER (PARTITION BY sp.id ORDER BY random())
FROM succession_plans sp
JOIN talent_pool_members tpm ON tpm.tenant_id = sp.tenant_id
JOIN talent_pools tp ON tp.id = tpm.talent_pool_id
WHERE tp.pool_type IN ('high_potential', 'leadership', 'succession')
AND tpm.removed_at IS NULL
AND NOT EXISTS (
    SELECT 1 FROM succession_candidates sc
    WHERE sc.critical_role_id = sp.id
    AND sc.candidate_employee_id = tpm.employee_id
)
ORDER BY sp.id, random()
ON CONFLICT DO NOTHING;

-- Ensure each plan has at least 2-4 candidates
INSERT INTO succession_candidates (critical_role_id, candidate_employee_id, readiness_level, strengths, development_needs, development_plan, rank_order)
SELECT DISTINCT ON (sp.id, e.id)
    sp.id,
    e.id,
    CASE
        WHEN random() < 0.3 THEN 'ready_1_year'
        WHEN random() < 0.6 THEN 'ready_2_years'
        ELSE 'ready_3_years'
    END,
    'Potenziale identificato. Performance consistente nel ruolo attuale.',
    'Necessità di esposizione a responsabilità più ampie.',
    'Piano di sviluppo individualizzato da definire con HR.',
    (SELECT COALESCE(MAX(rank_order), 0) + 1 FROM succession_candidates WHERE critical_role_id = sp.id)
FROM succession_plans sp
CROSS JOIN LATERAL (
    SELECT e.id
    FROM employees e
    WHERE e.tenant_id = sp.tenant_id
    AND e.is_active = true
    AND e.hire_date < NOW() - INTERVAL '2 years'
    AND e.id != sp.incumbent_employee_id
    AND NOT EXISTS (
        SELECT 1 FROM succession_candidates sc
        WHERE sc.critical_role_id = sp.id
        AND sc.candidate_employee_id = e.id
    )
    ORDER BY random()
    LIMIT 2
) e
WHERE (SELECT COUNT(*) FROM succession_candidates WHERE critical_role_id = sp.id) < 2
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_plans INTEGER;
    v_candidates INTEGER;
    v_avg_candidates NUMERIC;
    v_plans_with_candidates INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_plans FROM succession_plans;
    SELECT COUNT(*) INTO v_candidates FROM succession_candidates;
    SELECT COUNT(DISTINCT critical_role_id) INTO v_plans_with_candidates FROM succession_candidates;
    SELECT ROUND(v_candidates::numeric / NULLIF(v_plans_with_candidates, 0), 1) INTO v_avg_candidates;

    RAISE NOTICE '=== Migration 075-076 Verification ===';
    RAISE NOTICE 'Total succession plans: %', v_plans;
    RAISE NOTICE 'Total candidates: %', v_candidates;
    RAISE NOTICE 'Plans with candidates: %', v_plans_with_candidates;
    RAISE NOTICE 'Avg candidates per plan: %', v_avg_candidates;
END $$;
