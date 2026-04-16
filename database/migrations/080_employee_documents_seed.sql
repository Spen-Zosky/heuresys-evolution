-- Migration: 080_employee_documents_seed.sql
-- Description: Seed employee documents (contracts, payslips, certificates, etc.)
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- EMPLOYMENT CONTRACTS (1 per employee)
-- ============================================================================

INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, visibility, status, is_verified, uploaded_at)
SELECT
    e.tenant_id,
    e.id,
    'Contratto di Lavoro - ' || e.first_name || ' ' || e.last_name,
    'Contratto di lavoro subordinato a tempo ' ||
        CASE WHEN random() < 0.85 THEN 'indeterminato' ELSE 'determinato' END,
    'contract',
    'employment',
    'contract_' || REPLACE(e.id::text, '-', '') || '.pdf',
    'Contratto_' || UPPER(SUBSTRING(e.last_name, 1, 3)) || '_' || TO_CHAR(e.hire_date, 'YYYYMMDD') || '.pdf',
    'application/pdf',
    floor(random() * 200000 + 100000)::int,
    '/documents/' || t.code || '/contracts/' || TO_CHAR(e.hire_date, 'YYYY') || '/',
    e.hire_date,
    'private',
    'active',
    true,
    e.hire_date + (random() * INTERVAL '7 days')
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RECENT PAYSLIPS (last 12 months for each employee)
-- ============================================================================

INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, reference_number, visibility, status, is_verified, uploaded_at)
SELECT
    e.tenant_id,
    e.id,
    'Cedolino ' || TO_CHAR(month_date, 'TMMonth YYYY'),
    'Busta paga mensile',
    'payslip',
    'compensation',
    'payslip_' || REPLACE(e.id::text, '-', '') || '_' || TO_CHAR(month_date, 'YYYYMM') || '.pdf',
    'Cedolino_' || UPPER(SUBSTRING(e.last_name, 1, 3)) || '_' || TO_CHAR(month_date, 'YYYYMM') || '.pdf',
    'application/pdf',
    floor(random() * 50000 + 30000)::int,
    '/documents/' || t.code || '/payslips/' || TO_CHAR(month_date, 'YYYY') || '/',
    month_date,
    'PAY-' || TO_CHAR(month_date, 'YYYYMM') || '-' || LPAD((ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY month_date))::text, 4, '0'),
    'private',
    'active',
    true,
    month_date + INTERVAL '5 days'
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
CROSS JOIN generate_series(
    DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
    DATE_TRUNC('month', NOW()),
    '1 month'::interval
) AS month_date
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND e.hire_date < month_date
ON CONFLICT DO NOTHING;

-- ============================================================================
-- IDENTITY DOCUMENTS (1-2 per employee)
-- ============================================================================

INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, expiry_date, reference_number, visibility, status, is_verified, uploaded_at)
SELECT
    e.tenant_id,
    e.id,
    'Carta d''Identita',
    'Documento di identita personale',
    'id_document',
    'personal',
    'id_' || REPLACE(e.id::text, '-', '') || '_ci.pdf',
    'CI_' || UPPER(SUBSTRING(e.last_name, 1, 3)) || '.pdf',
    'application/pdf',
    floor(random() * 100000 + 50000)::int,
    '/documents/' || t.code || '/identity/',
    NOW() - (random() * INTERVAL '5 years'),
    NOW() + (random() * INTERVAL '5 years'),
    'CA' || LPAD(floor(random() * 10000000)::text, 7, '0') || UPPER(SUBSTRING(e.last_name, 1, 2)),
    'restricted',
    'active',
    true,
    e.hire_date + INTERVAL '1 day'
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
ON CONFLICT DO NOTHING;

-- Codice Fiscale/Tax ID
INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, reference_number, visibility, status, is_verified, uploaded_at)
SELECT
    e.tenant_id,
    e.id,
    'Codice Fiscale',
    'Tessera sanitaria / Codice Fiscale',
    'id_document',
    'personal',
    'cf_' || REPLACE(e.id::text, '-', '') || '.pdf',
    'CF_' || UPPER(SUBSTRING(e.last_name, 1, 3)) || '.pdf',
    'application/pdf',
    floor(random() * 30000 + 20000)::int,
    '/documents/' || t.code || '/identity/',
    e.hire_date,
    e.fiscal_code,
    'restricted',
    'active',
    true,
    e.hire_date + INTERVAL '1 day'
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
AND e.fiscal_code IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CERTIFICATION DOCUMENTS (linked to employee_certifications)
-- ============================================================================

INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, expiry_date, reference_number, visibility, status, is_verified, uploaded_at)
SELECT DISTINCT ON (ec.id)
    e.tenant_id,
    e.id,
    'Certificato: ' || c.name,
    'Attestato di certificazione rilasciato da ' || c.issuing_organization,
    'certificate',
    'certification',
    'cert_' || REPLACE(ec.id::text, '-', '') || '.pdf',
    'Certificato_' || REPLACE(c.code, '-', '_') || '_' || UPPER(SUBSTRING(e.last_name, 1, 3)) || '.pdf',
    'application/pdf',
    floor(random() * 150000 + 80000)::int,
    '/documents/' || t.code || '/certifications/',
    ec.issue_date,
    ec.expiry_date,
    ec.credential_number,
    'internal',
    CASE WHEN ec.status = 'active' THEN 'active' ELSE 'archived' END,
    ec.verified,
    ec.created_at
FROM employee_certifications ec
JOIN employees e ON ec.employee_id = e.id
JOIN certifications c ON ec.certification_id = c.id
JOIN tenants t ON e.tenant_id = t.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- POLICY ACKNOWLEDGMENTS (3 per employee)
-- ============================================================================

INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, visibility, requires_signature, signed_at, signed_by, status, is_verified, uploaded_at)
SELECT
    e.tenant_id,
    e.id,
    policy.title,
    policy.description,
    'policy',
    'compliance',
    'policy_' || policy.code || '_' || REPLACE(e.id::text, '-', '') || '.pdf',
    policy.filename,
    'application/pdf',
    floor(random() * 80000 + 40000)::int,
    '/documents/' || t.code || '/policies/',
    GREATEST(e.hire_date, policy.date),
    'internal',
    true,
    GREATEST(e.hire_date, policy.date) + (random() * INTERVAL '7 days'),
    e.id,
    'active',
    true,
    GREATEST(e.hire_date, policy.date)
FROM employees e
JOIN tenants t ON e.tenant_id = t.id
CROSS JOIN (VALUES
    ('privacy', 'Informativa Privacy GDPR', 'Consenso al trattamento dei dati personali ai sensi del GDPR', 'Informativa_Privacy_GDPR.pdf', '2024-01-01'::date),
    ('sicurezza', 'Policy Sicurezza Informatica', 'Norme e procedure per la sicurezza informatica aziendale', 'Policy_Sicurezza_IT.pdf', '2024-03-01'::date),
    ('condotta', 'Codice Etico e di Condotta', 'Principi e valori aziendali, regole di comportamento', 'Codice_Etico_Condotta.pdf', '2024-01-01'::date)
) AS policy(code, title, description, filename, date)
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND e.is_active = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TRAINING CERTIFICATES (from course completions)
-- ============================================================================

INSERT INTO employee_documents (tenant_id, employee_id, title, description, document_type, category, filename, original_name, mime_type, file_size, file_path, document_date, visibility, status, is_verified, uploaded_at)
SELECT DISTINCT ON (ce.id)
    e.tenant_id,
    e.id,
    'Attestato Corso: ' || c.title,
    'Certificato di completamento corso formativo',
    'certificate',
    'training',
    'training_' || REPLACE(ce.id::text, '-', '') || '.pdf',
    'Attestato_' || REPLACE(c.code, '-', '_') || '_' || UPPER(SUBSTRING(e.last_name, 1, 3)) || '.pdf',
    'application/pdf',
    floor(random() * 100000 + 50000)::int,
    '/documents/' || t.code || '/training/',
    ce.completed_at::date,
    'internal',
    'active',
    true,
    ce.completed_at
FROM course_enrollments ce
JOIN employees e ON ce.employee_id = e.id
JOIN courses c ON ce.course_id = c.id
JOIN tenants t ON e.tenant_id = t.id
WHERE t.code IN ('rtl-bank', 'smartfood', 'econova')
AND ce.status = 'completed'
AND ce.completed_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_total INTEGER;
    v_by_type TEXT;
BEGIN
    SELECT COUNT(*) INTO v_total FROM employee_documents;
    SELECT string_agg(document_type || ': ' || cnt::text, ', ' ORDER BY cnt DESC)
    INTO v_by_type
    FROM (
        SELECT document_type, COUNT(*) as cnt
        FROM employee_documents
        GROUP BY document_type
    ) t;

    RAISE NOTICE '=== Migration 080 Verification ===';
    RAISE NOTICE 'Total documents: %', v_total;
    RAISE NOTICE 'By type: %', v_by_type;
END $$;
