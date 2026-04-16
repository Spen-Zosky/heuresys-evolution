-- Migration 184: register ENRICHMENT functional area in RBP (SEE Fase 8)
--
-- Creates the ENRICHMENT functional area so api-gateway proxy routes can
-- gate on requirePermission('ENRICHMENT', 'VIEW'|'CREATE'|'APPROVE'|'DELETE').
--
-- Role matrix (tenant-scoped):
--   SUPERUSER     — PLATFORM scope, all actions
--   TENANT_OWNER  — TENANT scope, all actions
--   HR_DIRECTOR   — TENANT scope, VIEW + CREATE (approval stays with owner)
--   IT_ADMIN      — TENANT scope, VIEW only (observability)
-- Other roles have no access by default.

INSERT INTO rbp_functional_areas (code, name, description, category, sort_order, is_active)
VALUES (
  'ENRICHMENT',
  'Semantic Enrichment',
  'Automated extraction and merge of structured facts from external sources into platform entities. Gates POST /api/v1/enrichment/* proxy routes.',
  'SYSTEM',
  50,
  true
)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      updated_at = NOW();

-- Role permissions
INSERT INTO rbp_role_permissions
  (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, scope_type)
SELECT
  r.id,
  a.id,
  p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_approve,
  p.scope_type::varchar
FROM (VALUES
  ('SUPERUSER',    true, true,  true,  true,  true,  'PLATFORM'),
  ('TENANT_OWNER', true, true,  true,  true,  true,  'TENANT'),
  ('HR_DIRECTOR',  true, true,  false, false, false, 'TENANT'),
  ('IT_ADMIN',     true, false, false, false, false, 'TENANT')
) AS p(role_code, can_view, can_create, can_edit, can_delete, can_approve, scope_type)
JOIN rbp_roles r ON r.code = p.role_code
JOIN rbp_functional_areas a ON a.code = 'ENRICHMENT'
ON CONFLICT (role_id, functional_area_id) DO UPDATE
  SET can_view   = EXCLUDED.can_view,
      can_create = EXCLUDED.can_create,
      can_edit   = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete,
      can_approve= EXCLUDED.can_approve,
      scope_type = EXCLUDED.scope_type,
      updated_at = NOW();
