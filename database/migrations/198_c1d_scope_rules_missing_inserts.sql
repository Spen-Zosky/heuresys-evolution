-- Migration 198: C.1d — insert missing role×area scope records
-- (REVIEW-FINAL Blocco A §2.2 + PROMPT C.1d Task 2)
--
-- 5 record mancanti confermati via query live Cowork (survey 2026-04-14T17:00).
-- Valori can_*: can_view=true, altri false (pattern read-only minimo coerente con DB esistente).
-- DB è source of truth (P9). SUPERUSER bypass resta via override codice in rbac.ts.

BEGIN;

-- IT_ADMIN + PERFORMANCE = TEAM
INSERT INTO rbp_role_permissions (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, can_export, scope_type)
SELECT r.id, fa.id, true, false, false, false, false, false, 'TEAM'
FROM rbp_roles r, rbp_functional_areas fa
WHERE r.code = 'IT_ADMIN' AND fa.code = 'PERFORMANCE'
ON CONFLICT (role_id, functional_area_id) DO NOTHING;

-- IT_ADMIN + COMPENSATION = SELF
INSERT INTO rbp_role_permissions (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, can_export, scope_type)
SELECT r.id, fa.id, true, false, false, false, false, false, 'SELF'
FROM rbp_roles r, rbp_functional_areas fa
WHERE r.code = 'IT_ADMIN' AND fa.code = 'COMPENSATION'
ON CONFLICT (role_id, functional_area_id) DO NOTHING;

-- LINE_MANAGER + COMPENSATION = SELF
INSERT INTO rbp_role_permissions (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, can_export, scope_type)
SELECT r.id, fa.id, true, false, false, false, false, false, 'SELF'
FROM rbp_roles r, rbp_functional_areas fa
WHERE r.code = 'LINE_MANAGER' AND fa.code = 'COMPENSATION'
ON CONFLICT (role_id, functional_area_id) DO NOTHING;

-- EMPLOYEE + ANALYTICS = SELF
INSERT INTO rbp_role_permissions (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, can_export, scope_type)
SELECT r.id, fa.id, true, false, false, false, false, false, 'SELF'
FROM rbp_roles r, rbp_functional_areas fa
WHERE r.code = 'EMPLOYEE' AND fa.code = 'ANALYTICS'
ON CONFLICT (role_id, functional_area_id) DO NOTHING;

-- EMPLOYEE + COMPENSATION = SELF
INSERT INTO rbp_role_permissions (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, can_export, scope_type)
SELECT r.id, fa.id, true, false, false, false, false, false, 'SELF'
FROM rbp_roles r, rbp_functional_areas fa
WHERE r.code = 'EMPLOYEE' AND fa.code = 'COMPENSATION'
ON CONFLICT (role_id, functional_area_id) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('198') ON CONFLICT DO NOTHING;

COMMIT;
