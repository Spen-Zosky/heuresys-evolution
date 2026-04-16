-- =============================================================================
-- Migration: 002_tenant_settings.sql
-- Description: Add settings JSONB column to tenants for wizard configuration
-- Epic: 2 - User Management & Tenant Configuration
-- Story: 2.1 - Tenant Setup Wizard
-- =============================================================================

-- Add settings column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add tax_id (Partita IVA) column
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(20);

-- Add contact columns
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);

-- Add address columns
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS address_street VARCHAR(255);

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS address_postal_code VARCHAR(20);

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS address_country VARCHAR(3) DEFAULT 'ITA';

-- Add setup wizard tracking
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP;

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS setup_step INTEGER DEFAULT 0;

-- Create index on settings for JSON queries
CREATE INDEX IF NOT EXISTS idx_tenants_settings ON tenants USING GIN (settings);

-- Comment on columns
COMMENT ON COLUMN tenants.settings IS 'JSONB configuration including CCNL, fiscal year, leave rules, SSO settings';
COMMENT ON COLUMN tenants.tax_id IS 'Italian Partita IVA (VAT number)';
COMMENT ON COLUMN tenants.setup_completed IS 'Whether the tenant has completed the setup wizard';
COMMENT ON COLUMN tenants.setup_step IS 'Current step in setup wizard (0=not started, 1=company info, 2=ccnl, 3=fiscal)';

-- =============================================================================
-- Default settings template
-- =============================================================================
-- Settings structure:
-- {
--   "ccnl": {
--     "type": "metalmeccanico_industria",
--     "customRules": false
--   },
--   "leaveRules": {
--     "ferie": 26,
--     "rol": 104,
--     "exFestivita": 32
--   },
--   "fiscalYear": {
--     "startMonth": 1,
--     "payPeriod": "monthly"
--   },
--   "holidays": {
--     "calendar": "italian_default",
--     "customHolidays": []
--   },
--   "sso": {
--     "provider": null,
--     "azureAd": null,
--     "google": null
--   },
--   "auditLog": {
--     "retentionYears": 5,
--     "exportSchedule": "manual"
--   }
-- }
-- =============================================================================
