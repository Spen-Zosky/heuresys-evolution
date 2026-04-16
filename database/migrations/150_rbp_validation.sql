-- ============================================================================
-- Validation Queries for Migration 150 + 151
-- Run after migration to verify data integrity
-- ============================================================================

-- 1. Verify all 8 roles exist
SELECT '1. Roles' AS check_name,
       CASE WHEN COUNT(*) = 8 THEN '✅ PASS' ELSE '❌ FAIL: expected 8, got ' || COUNT(*) END AS result
FROM rbp_roles;

-- 2. Verify all 20 functional areas exist
SELECT '2. Functional Areas' AS check_name,
       CASE WHEN COUNT(*) = 20 THEN '✅ PASS' ELSE '❌ FAIL: expected 20, got ' || COUNT(*) END AS result
FROM rbp_functional_areas WHERE is_active = true;

-- 3. Verify all 10 dashboards exist
SELECT '3. Dashboards' AS check_name,
       CASE WHEN COUNT(*) = 10 THEN '✅ PASS' ELSE '❌ FAIL: expected 10, got ' || COUNT(*) END AS result
FROM rbp_dashboards;

-- 4. Verify role_dashboards mapping (15 expected)
SELECT '4. Role-Dashboard mappings' AS check_name,
       CASE WHEN COUNT(*) = 15 THEN '✅ PASS' ELSE '❌ FAIL: expected 15, got ' || COUNT(*) END AS result
FROM rbp_role_dashboards;

-- 5. Verify every role has exactly one default dashboard
SELECT '5. Default dashboards' AS check_name,
       CASE WHEN COUNT(*) = 8 THEN '✅ PASS' ELSE '❌ FAIL: not all roles have default dashboard' END AS result
FROM rbp_role_dashboards WHERE is_default = true;

-- 6. Verify permission matrix row count
SELECT '6. Permission matrix' AS check_name,
       CASE WHEN COUNT(*) >= 75 THEN '✅ PASS (' || COUNT(*) || ' rows)' ELSE '❌ FAIL: too few permission rows: ' || COUNT(*) END AS result
FROM rbp_role_permissions;

-- 7. Verify scope rules (8 expected, one per role)
SELECT '7. Scope rules' AS check_name,
       CASE WHEN COUNT(*) = 8 THEN '✅ PASS' ELSE '❌ FAIL: expected 8, got ' || COUNT(*) END AS result
FROM rbp_scope_rules;

-- 8. Verify field policies (40 expected: 8 roles × 5 classifications)
SELECT '8. Field policies' AS check_name,
       CASE WHEN COUNT(*) = 40 THEN '✅ PASS' ELSE '❌ FAIL: expected 40, got ' || COUNT(*) END AS result
FROM rbp_field_policies;

-- 9. Verify data classifications (5 expected)
SELECT '9. Data classifications' AS check_name,
       CASE WHEN COUNT(*) = 5 THEN '✅ PASS' ELSE '❌ FAIL: expected 5, got ' || COUNT(*) END AS result
FROM rbp_data_classifications;

-- 10. Verify pages seed
SELECT '10. Pages' AS check_name,
       CASE WHEN COUNT(*) >= 60 THEN '✅ PASS (' || COUNT(*) || ' pages)' ELSE '❌ FAIL: too few pages: ' || COUNT(*) END AS result
FROM rbp_pages WHERE status = 'ACTIVE';

-- 11. Verify inheritance chain works
SELECT '11. Inheritance (HR_DIRECTOR inherits EMPLOYEE)' AS check_name,
       CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS result
FROM rbp_get_user_effective_permissions('HR_DIRECTOR')
WHERE functional_area_code = 'SELF_SERVICE';

-- 12. Verify legacy role migration (no USER/HR/DEMO left)
SELECT '12. Legacy roles migrated' AS check_name,
       CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL: ' || COUNT(*) || ' legacy roles remain' END AS result
FROM users WHERE role IN ('USER', 'HR', 'DEMO', 'ADMIN', 'TENANT_ADMIN');

-- 13. Verify HR_DIRECTOR vs HR_MANAGER split
SELECT '13. HR_DIRECTOR has WORKFORCE_INTELLIGENCE' AS check_name,
       CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS result
FROM rbp_role_permissions rp
JOIN rbp_roles r ON r.id = rp.role_id
JOIN rbp_functional_areas fa ON fa.id = rp.functional_area_id
WHERE r.code = 'HR_DIRECTOR' AND fa.code = 'WORKFORCE_INTELLIGENCE';

SELECT '14. HR_MANAGER has NO WORKFORCE_INTELLIGENCE' AS check_name,
       CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS result
FROM rbp_role_permissions rp
JOIN rbp_roles r ON r.id = rp.role_id
JOIN rbp_functional_areas fa ON fa.id = rp.functional_area_id
WHERE r.code = 'HR_MANAGER' AND fa.code = 'WORKFORCE_INTELLIGENCE';

-- Summary: role distribution after migration
SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC;
