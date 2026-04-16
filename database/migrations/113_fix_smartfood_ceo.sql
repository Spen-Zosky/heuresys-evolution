-- Migration 113: Fix SmartFood CEO circular reference
-- Date: 2026-03-18
-- Sprint: R2 (Data Integrity)
--
-- PROBLEM: SmartFood org hierarchy has a circular reference:
--   Giuliani (General Manager) -> Bruno -> Caruso -> Fabbri -> Giuliani
--   No root node (manager_id IS NULL) exists for SmartFood tenant.
--
-- FIX: Set Stefano Giuliani (General Manager) as root node.
--   Also update his job_title to 'Direttore Generale' to better reflect CEO role.

-- Set Giuliani as root node (remove circular reference)
UPDATE employees
SET manager_id = NULL,
    job_title = 'Direttore Generale'
WHERE id = 'a2640b85-8020-416c-bbc5-bf26c1be74e4'
  AND tenant_id = '1d7bf448-ceac-4215-917d-45ff13678104';

-- Track migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('113_fix_smartfood_ceo', NOW())
ON CONFLICT DO NOTHING;
