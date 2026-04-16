-- ============================================================================
-- Migration 166: Retirement Rules & Expected Retirement Date
-- ============================================================================
-- A permanent contract has no explicit end_date; it ends naturally when the
-- employee reaches statutory retirement requirements (country- and time-
-- dependent). This migration introduces tenant-configurable retirement rules
-- and a SQL function that computes the expected retirement date for a given
-- employee based on birth_date and hire_date.
--
-- Default Italian rules (2026):
--   - pensione di vecchiaia: 67 years of age + 20 years of contributions
--   - pensione anticipata:   42 years 10 months of contributions (any age)
-- The function returns the earliest of the two.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Tenant-configurable retirement rules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_retirement_rules (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    country_code               VARCHAR(3) NOT NULL DEFAULT 'IT',
    old_age_retirement_years   INTEGER NOT NULL DEFAULT 67,
    old_age_min_contribution_years INTEGER NOT NULL DEFAULT 20,
    early_retirement_contribution_years NUMERIC(5,2) NOT NULL DEFAULT 42.83, -- 42y 10m
    effective_from             DATE NOT NULL DEFAULT CURRENT_DATE,
    notes                      TEXT,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, country_code, effective_from)
);

COMMENT ON TABLE tenant_retirement_rules IS
  'Tenant/country specific retirement rules used to compute expected end-date for permanent contracts.';

CREATE INDEX IF NOT EXISTS idx_retirement_rules_tenant
  ON tenant_retirement_rules (tenant_id, effective_from DESC);

-- Seed Italian rules for all existing tenants
INSERT INTO tenant_retirement_rules (
    tenant_id, country_code,
    old_age_retirement_years, old_age_min_contribution_years,
    early_retirement_contribution_years, effective_from, notes
)
SELECT id, 'IT', 67, 20, 42.83, '2026-01-01',
       'Default IT rules: pensione di vecchiaia 67y+20y contrib, pensione anticipata 42y10m contrib'
FROM tenants
ON CONFLICT (tenant_id, country_code, effective_from) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Function: calculate_expected_retirement_date
-- Returns NULL if birth_date is missing. Uses tenant rules if available,
-- otherwise falls back to Italian defaults.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_expected_retirement_date(
    p_birth_date DATE,
    p_hire_date  DATE,
    p_tenant_id  UUID
) RETURNS DATE AS $$
DECLARE
    v_old_age_years   INTEGER;
    v_early_years     NUMERIC;
    v_old_age_date    DATE;
    v_early_date      DATE;
BEGIN
    IF p_birth_date IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT old_age_retirement_years,
           early_retirement_contribution_years
      INTO v_old_age_years, v_early_years
      FROM tenant_retirement_rules
     WHERE tenant_id = p_tenant_id
       AND effective_from <= CURRENT_DATE
     ORDER BY effective_from DESC
     LIMIT 1;

    v_old_age_years := COALESCE(v_old_age_years, 67);
    v_early_years   := COALESCE(v_early_years, 42.83);

    v_old_age_date := p_birth_date + (v_old_age_years || ' years')::INTERVAL;

    IF p_hire_date IS NOT NULL THEN
        v_early_date := p_hire_date + (v_early_years || ' years')::INTERVAL;
        RETURN LEAST(v_old_age_date, v_early_date);
    END IF;

    RETURN v_old_age_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_expected_retirement_date IS
  'Computes the earliest expected retirement date for an employee using tenant-specific rules.';

COMMIT;
