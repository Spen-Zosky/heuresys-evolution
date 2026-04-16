-- Migration 199: Industry → CCNL mapping (data-driven, P9)
-- Assigns correct CCNL to each tenant based on its NACE industry classification
-- and realigns all employee_contracts.ccnl_code accordingly.

BEGIN;

-- 0. Widen employee_contracts.ccnl_code to match catalog codes (CCNL_*_YYYY = up to ~20 chars)
ALTER TABLE employee_contracts ALTER COLUMN ccnl_code TYPE VARCHAR(50);

-- 1. Add missing CCNLs to the catalog (Alimentare, Energia)
INSERT INTO ccnl_contracts (code, name, name_en, sector, effective_date, annual_leave_days, is_active)
VALUES
  ('CCNL_ALIM_2024', 'CCNL Industria Alimentare 2024', 'Food Industry CLA 2024', 'alimentare', '2024-01-01', 26, true),
  ('CCNL_ENERGIA_2024', 'CCNL Elettrico Energia e Petrolio 2024', 'Energy and Utilities CLA 2024', 'energia', '2024-01-01', 26, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Industry → CCNL mapping table (single source of truth)
CREATE TABLE IF NOT EXISTS industry_ccnl_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_code VARCHAR(10) NOT NULL,
  ccnl_code VARCHAR(50) NOT NULL REFERENCES ccnl_contracts(code) ON UPDATE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_industry_ccnl_primary
  ON industry_ccnl_mapping (industry_code) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_industry_ccnl_code ON industry_ccnl_mapping (ccnl_code);

COMMENT ON TABLE industry_ccnl_mapping IS
  'Maps NACE industry classification codes to the primary CCNL that applies to employees of tenants in that sector. Data-driven per P9.';

-- 3. Seed canonical mappings for active tenants
-- NACE codes cover multiple levels: we seed at the specificity needed by active tenants.
INSERT INTO industry_ccnl_mapping (industry_code, ccnl_code, is_primary, notes) VALUES
  -- Banking / financial intermediation (RTL Bank)
  ('64',    'CCNL_CRED_2024', true, 'Financial services — banks'),
  ('64.19', 'CCNL_CRED_2024', true, 'Other monetary intermediation'),
  ('65',    'CCNL_CRED_2024', true, 'Insurance and pension funding (default to credito)'),
  -- Consulting / services (Heuresys System)
  ('70',    'CCNL_COMM_2024', true, 'Head offices and management consultancy'),
  ('70.20', 'CCNL_COMM_2024', true, 'Management consultancy — Terziario'),
  -- Energy (EcoNova)
  ('35',    'CCNL_ENERGIA_2024', true, 'Electricity, gas, steam and air conditioning supply'),
  ('35.11', 'CCNL_ENERGIA_2024', true, 'Production of electricity'),
  -- Food industry (SmartFood)
  ('10',    'CCNL_ALIM_2024', true, 'Manufacture of food products'),
  ('10.89', 'CCNL_ALIM_2024', true, 'Manufacture of other food products n.e.c.'),
  -- Telecom / Tourism / Metal (future-ready)
  ('61',    'CCNL_TLC_2024',    true, 'Telecommunications'),
  ('55',    'CCNL_TUR_2024',    true, 'Accommodation'),
  ('56',    'CCNL_TUR_2024',    true, 'Food and beverage service activities'),
  ('25',    'CCNL_METMEC_2024', true, 'Manufacture of fabricated metal products'),
  ('28',    'CCNL_METMEC_2024', true, 'Manufacture of machinery and equipment')
ON CONFLICT (industry_code) WHERE is_primary = true DO UPDATE
  SET ccnl_code = EXCLUDED.ccnl_code,
      notes = EXCLUDED.notes,
      updated_at = now();

-- 4. Backfill employee_contracts.ccnl_code based on tenant industry
-- Resolve CCNL per tenant: prefer most-specific (L4) mapping, fallback to L2.
WITH tenant_ccnl AS (
  SELECT
    t.id AS tenant_id,
    COALESCE(
      (SELECT m.ccnl_code
         FROM industry_ccnl_mapping m
         JOIN tenant_industry_classifications tic
           ON tic.classification_code = m.industry_code
          AND tic.tenant_id = t.id
          AND tic.classification_role = 'PRIMARY'
          AND tic.is_active = true
        WHERE m.is_primary = true
        ORDER BY LENGTH(m.industry_code) DESC
        LIMIT 1),
      (SELECT m.ccnl_code
         FROM industry_ccnl_mapping m
         JOIN tenant_industry_classifications tic
           ON SUBSTRING(tic.classification_code FROM 1 FOR 2) = m.industry_code
          AND tic.tenant_id = t.id
          AND tic.classification_role = 'PRIMARY'
          AND tic.is_active = true
        WHERE m.is_primary = true
        ORDER BY LENGTH(m.industry_code) DESC
        LIMIT 1)
    ) AS ccnl_code
  FROM tenants t
)
UPDATE employee_contracts ec
SET ccnl_code = tc.ccnl_code,
    updated_at = now()
FROM employees e
JOIN tenant_ccnl tc ON tc.tenant_id = e.tenant_id
WHERE ec.employee_id = e.id
  AND ec.tenant_id = e.tenant_id
  AND tc.ccnl_code IS NOT NULL
  AND (ec.ccnl_code IS DISTINCT FROM tc.ccnl_code);

COMMIT;
