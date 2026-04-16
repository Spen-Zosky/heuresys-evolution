-- Migration: 070_industry_certifications_seed.sql
-- Description: Seed industry-specific certifications for RTL Bank, SmartFood, EcoNova
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- RTL BANK - BANKING/FINANCE CERTIFICATIONS
-- ============================================================================

INSERT INTO certifications (tenant_id, code, name, name_en, issuing_organization, description, validity_months, is_internal, is_active)
SELECT
    t.id,
    cert.code,
    cert.name,
    cert.name_en,
    cert.issuing_org,
    cert.description,
    cert.validity_months,
    false,
    true
FROM tenants t
CROSS JOIN (VALUES
    ('EFPA-EFA', 'European Financial Advisor', 'European Financial Advisor', 'EFPA Italia', 'Certificazione per consulenti finanziari che operano nel settore bancario e assicurativo', 24),
    ('EFPA-EFP', 'European Financial Planner', 'European Financial Planner', 'EFPA Italia', 'Certificazione avanzata per pianificatori finanziari con competenze di wealth management', 24),
    ('IVASS-A', 'Intermediario Assicurativo Sezione A', 'Insurance Intermediary Section A', 'IVASS', 'Abilitazione per agenti di assicurazione con mandato diretto delle compagnie', 36),
    ('IVASS-E', 'Intermediario Assicurativo Sezione E', 'Insurance Intermediary Section E', 'IVASS', 'Abilitazione per collaboratori di intermediari assicurativi', 36),
    ('OCF-BASE', 'Consulente Finanziario OCF', 'OCF Financial Consultant', 'OCF - Organismo Consulenti Finanziari', 'Iscrizione albo consulenti finanziari abilitati all''offerta fuori sede', NULL),
    ('OCF-AUT', 'Consulente Finanziario Autonomo', 'Independent Financial Advisor', 'OCF - Organismo Consulenti Finanziari', 'Iscrizione albo consulenti finanziari autonomi fee-only', NULL),
    ('CFA-L1', 'CFA Level I', 'Chartered Financial Analyst Level I', 'CFA Institute', 'Primo livello della certificazione CFA - fondamenti di analisi finanziaria', NULL),
    ('CFA-L2', 'CFA Level II', 'Chartered Financial Analyst Level II', 'CFA Institute', 'Secondo livello CFA - valutazione degli asset e analisi avanzata', NULL),
    ('CFA-L3', 'CFA Level III', 'Chartered Financial Analyst Level III', 'CFA Institute', 'Terzo livello CFA - portfolio management e wealth planning', NULL),
    ('AML-SPEC', 'Specialista Antiriciclaggio', 'Anti-Money Laundering Specialist', 'AICOM - Associazione Italiana Compliance', 'Certificazione per professionisti della compliance AML/CFT', 24),
    ('MIFID-II', 'Operatore MiFID II', 'MiFID II Certified Professional', 'CONSOB / Enti Accreditati', 'Certificazione di conformità alla direttiva MiFID II per consulenza investimenti', 24),
    ('RISK-MGR', 'Risk Manager Certificato', 'Certified Risk Manager', 'AIFIRM - Associazione Italiana Financial Risk Management', 'Certificazione per gestori del rischio finanziario', 36)
) AS cert(code, name, name_en, issuing_org, description, validity_months)
WHERE t.code = 'rtl-bank'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SMARTFOOD - FOOD INDUSTRY CERTIFICATIONS
-- ============================================================================

INSERT INTO certifications (tenant_id, code, name, name_en, issuing_organization, description, validity_months, is_internal, is_active)
SELECT
    t.id,
    cert.code,
    cert.name,
    cert.name_en,
    cert.issuing_org,
    cert.description,
    cert.validity_months,
    false,
    true
FROM tenants t
CROSS JOIN (VALUES
    ('HACCP-BASE', 'Addetto HACCP Alimentarista', 'HACCP Food Handler Certificate', 'ASL / Regione Lombardia', 'Attestato di formazione per addetti alla manipolazione alimenti', 60),
    ('HACCP-RESP', 'Responsabile HACCP', 'HACCP Manager Certificate', 'ASL / Regione Lombardia', 'Attestato per responsabili del sistema di autocontrollo HACCP', 36),
    ('ISO22000-LA', 'Lead Auditor ISO 22000', 'ISO 22000 Lead Auditor', 'DNV GL / TUV Italia', 'Qualifica per condurre audit di sistemi di gestione sicurezza alimentare', 36),
    ('BRC-FOOD', 'BRC Food Safety Practitioner', 'BRC Global Standard for Food Safety', 'BRC Global Standards', 'Certificazione per implementazione standard BRC sicurezza alimentare', 36),
    ('IFS-FOOD', 'IFS Food Auditor', 'IFS Food Standard Auditor', 'IFS Management GmbH', 'Qualifica per audit secondo standard IFS Food', 36),
    ('FSSC22000', 'FSSC 22000 Implementer', 'FSSC 22000 Implementation Specialist', 'FSSC Foundation', 'Competenze per implementazione schema FSSC 22000', 36),
    ('ICEA-BIO', 'Operatore Biologico ICEA', 'ICEA Organic Operator', 'ICEA - Istituto Certificazione Etica Ambientale', 'Certificazione per operatori del settore biologico', 12),
    ('GMP-FOOD', 'Good Manufacturing Practice', 'GMP Food Manufacturing', 'TUV Italia / CERTIQUALITY', 'Certificazione buone pratiche di fabbricazione alimentare', 36),
    ('ISO17025', 'Tecnico Laboratorio Accreditato', 'ISO 17025 Laboratory Technician', 'Accredia', 'Qualifica per personale di laboratori di prova accreditati', 24),
    ('SENSORY', 'Analista Sensoriale', 'Sensory Evaluation Analyst', 'SISS - Societa'' Italiana Scienze Sensoriali', 'Certificazione per analisi sensoriale degli alimenti', 24)
) AS cert(code, name, name_en, issuing_org, description, validity_months)
WHERE t.code = 'smartfood'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ECONOVA - SUSTAINABILITY/GREEN CERTIFICATIONS
-- ============================================================================

INSERT INTO certifications (tenant_id, code, name, name_en, issuing_organization, description, validity_months, is_internal, is_active)
SELECT
    t.id,
    cert.code,
    cert.name,
    cert.name_en,
    cert.issuing_org,
    cert.description,
    cert.validity_months,
    false,
    true
FROM tenants t
CROSS JOIN (VALUES
    ('ISO14001-LA', 'Lead Auditor ISO 14001', 'ISO 14001 Lead Auditor', 'DNV GL / Bureau Veritas', 'Qualifica per condurre audit di sistemi di gestione ambientale', 36),
    ('EMAS-VER', 'Verificatore EMAS', 'EMAS Verifier', 'ISPRA / Comitato Ecolabel-Ecoaudit', 'Abilitazione alla verifica ambientale EMAS', 36),
    ('GRI-REP', 'GRI Certified Sustainability Professional', 'GRI Standards Reporter', 'Global Reporting Initiative', 'Certificazione per reporting di sostenibilità secondo standard GRI', NULL),
    ('LEED-AP', 'LEED Accredited Professional', 'LEED AP Building Design + Construction', 'USGBC - U.S. Green Building Council', 'Accreditamento professionale per edifici sostenibili LEED', 24),
    ('BREEAM-ASS', 'BREEAM Assessor', 'BREEAM International Assessor', 'BRE Global', 'Qualifica per valutazione sostenibilità edifici BREEAM', 24),
    ('CDP-DISC', 'CDP Disclosure Specialist', 'CDP Climate Disclosure Specialist', 'CDP - Carbon Disclosure Project', 'Competenze per disclosure climatica e ambientale CDP', 12),
    ('ESG-ANAL', 'ESG Analyst Certificato', 'Certified ESG Analyst', 'CFA Institute / EFFAS', 'Certificazione per analisi ESG e investimenti sostenibili', 24),
    ('CARBON-AUD', 'Carbon Footprint Auditor', 'Carbon Footprint Verification Auditor', 'TUV Italia / ISO', 'Qualifica per verifica impronta carbonica', 36),
    ('BCORP-ASS', 'B Corp Assessment Specialist', 'Certified B Corp Assessor', 'B Lab', 'Competenze per valutazione e certificazione B Corp', 36),
    ('SDG-INT', 'SDG Integration Specialist', 'UN SDG Integration Specialist', 'UN Global Compact Network Italia', 'Specializzazione integrazione Obiettivi Sviluppo Sostenibile', 24),
    ('CIRC-ECON', 'Esperto Economia Circolare', 'Circular Economy Specialist', 'Ellen MacArthur Foundation / ENEA', 'Certificazione strategie economia circolare', 24),
    ('LCA-EXP', 'LCA Expert', 'Life Cycle Assessment Expert', 'ISO / SETAC', 'Qualifica per analisi del ciclo di vita dei prodotti', 36)
) AS cert(code, name, name_en, issuing_org, description, validity_months)
WHERE t.code = 'econova'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_rtl_count INTEGER;
    v_smartfood_count INTEGER;
    v_econova_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_rtl_count FROM certifications c JOIN tenants t ON c.tenant_id = t.id WHERE t.code = 'rtl-bank';
    SELECT COUNT(*) INTO v_smartfood_count FROM certifications c JOIN tenants t ON c.tenant_id = t.id WHERE t.code = 'smartfood';
    SELECT COUNT(*) INTO v_econova_count FROM certifications c JOIN tenants t ON c.tenant_id = t.id WHERE t.code = 'econova';

    RAISE NOTICE '=== Migration 070 Verification ===';
    RAISE NOTICE 'RTL Bank certifications: %', v_rtl_count;
    RAISE NOTICE 'SmartFood certifications: %', v_smartfood_count;
    RAISE NOTICE 'EcoNova certifications: %', v_econova_count;
    RAISE NOTICE 'Total: %', v_rtl_count + v_smartfood_count + v_econova_count;
END $$;
