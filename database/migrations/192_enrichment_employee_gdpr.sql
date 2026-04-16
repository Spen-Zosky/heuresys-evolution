-- Migration 192: Employee enrichment GDPR consent + employee_profile descriptor
-- P3-17: Employees Descriptor + GDPR Consent
BEGIN;

-- Add consent tracking columns to employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS enrichment_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_consent_scope TEXT[];

COMMENT ON COLUMN employees.enrichment_consent_at IS 'When enrichment consent was granted (NULL = not consented)';
COMMENT ON COLUMN employees.enrichment_consent_scope IS 'Array of consented enrichment scopes';

-- Add employees descriptor to enrichment_entity_descriptors
-- Uses the existing schema columns from migration 179
INSERT INTO enrichment_entity_descriptors (
  entity_name, target_table, pk_field, match_keys,
  source_strategy_jsonb, default_mode, scope_level, is_active, description
) VALUES (
  'employee_profile',
  'employees',
  'id',
  ARRAY['email', 'tax_id'],
  '{"type": "internal", "source": "employees"}'::jsonb,
  'suggest',
  'tenant',
  false,
  'Employee Profile Enrichment — disabled by default, requires explicit GDPR consent per employee'
) ON CONFLICT (tenant_id, entity_name) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at = NOW();

COMMIT;
