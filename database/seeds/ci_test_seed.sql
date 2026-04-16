-- =============================================================================
-- CI Test Seed Data
-- =============================================================================
-- Minimum fixtures required by the 3 governance E2E tests:
--   - tests/governance/navigation-integrity.mjs
--   - tests/e2e/portal-all-pages.mjs
--   - tests/e2e/multi-role-dashboards.mjs
--
-- All users share password 'password'. The hash is generated at seed time via
-- pgcrypto's crypt() so there is no literal secret in this file. Node.js
-- bcrypt.compare() accepts both $2a$ and $2b$ prefixes emitted by gen_salt.
--
-- This file is idempotent (ON CONFLICT DO UPDATE) and is applied by
-- .github/workflows/governance.yml after migrations on a fresh Postgres.
--
-- Historical: earlier revisions of this file contained ~10 fake fixture rows
-- (departments, org_units, locations, goals, courses) whose INSERT statements
-- all referenced columns that do not exist in the current schema; they have
-- been removed. The governance E2E tests only need tenants, employees, users.
--
-- Updated: 2026-04-11 (TASK-A1 expansion + schema realignment)
--
-- NOTE (2026-04-15 canonical dedupe):
-- Questo seed usa UUID sintetici e2000002..e2000007 per i 6 employee canonical
-- non-SUPERUSER. In PRODUZIONE, dopo la dedupe del 2026-04-15, quegli stessi
-- nominativi (Marco De Santis, Valentina Conti, Maria Colombo, Alice Esposito,
-- Giuseppe Ferri, Pietro Barbieri) esistono con UUID differenti (record OLD
-- preservati perché contengono dati storici: contratti, enrollment, goal, doc).
-- Quindi prod ≠ CI sugli UUID canonical. Il codice runtime NON hardcoda UUID
-- (tutto data-driven), quindi la divergenza è acceptable. Se un giorno CI dovesse
-- essere allineato a prod, rigenerare questi UUID con quelli reali da
-- SELECT id FROM employees WHERE email LIKE '%@rtl-bank.org' AND first_name IN
-- ('Marco','Valentina','Maria','Alice','Giuseppe','Pietro');
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Tenants
-- -----------------------------------------------------------------------------

INSERT INTO tenants (id, code, name, status, created_at, updated_at)
VALUES
    ('d5855519-3ed1-4427-865f-fe75f1e42c4c', 'heuresys', 'Heuresys System', 'active', NOW(), NOW()),
    ('0c54b84a-1234-5678-9abc-def012345678', 'rtl-bank', 'RTL Bank',       'active', NOW(), NOW())
ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 2. Employees (one per test user role)
-- -----------------------------------------------------------------------------
-- UUIDs are hand-picked so the seed is deterministic and humans can correlate
-- rows across the users INSERT below.

INSERT INTO employees (id, tenant_id, first_name, last_name, email, department, job_title, is_active, hire_date, created_at, updated_at)
SELECT e.id::uuid, t.id, e.first_name, e.last_name, e.email, e.department, e.job_title, true, e.hire_date::date, NOW(), NOW()
  FROM (VALUES
    ('e1000001-0000-0000-0000-000000000001', 'heuresys', 'Platform',  'Admin',    'platform.admin@heuresys.test', 'Platform',  'Tenant Owner',       '2024-01-01'),
    ('e2000002-0000-0000-0000-000000000002', 'rtl-bank', 'Marco',     'De Santis','marco.desantis@rtlbank.test',  'IT',        'IT Administrator',   '2022-03-01'),
    ('e2000003-0000-0000-0000-000000000003', 'rtl-bank', 'Valentina', 'Conti',    'valentina.conti@rtlbank.test', 'HR',        'HR Director',        '2021-06-15'),
    ('e2000004-0000-0000-0000-000000000004', 'rtl-bank', 'Maria',     'Colombo',  'maria.colombo@rtlbank.test',   'HR',        'HR Manager',         '2023-02-10'),
    ('e2000005-0000-0000-0000-000000000005', 'rtl-bank', 'Alice',     'Esposito', 'alice.esposito@rtlbank.test',  'IT',        'IT Department Head', '2022-09-01'),
    ('e2000006-0000-0000-0000-000000000006', 'rtl-bank', 'Giuseppe',  'Ferri',    'giuseppe.ferri@rtlbank.test',  'Operations','Line Manager',       '2023-05-01'),
    ('e2000007-0000-0000-0000-000000000007', 'rtl-bank', 'Pietro',    'Barbieri', 'pietro.barbieri@rtlbank.test', 'Operations','Risk Analyst',       '2024-01-10')
  ) AS e(id, tenant_code, first_name, last_name, email, department, job_title, hire_date)
  JOIN tenants t ON t.code = e.tenant_code
ON CONFLICT (id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        department = EXCLUDED.department,
        job_title = EXCLUDED.job_title,
        is_active = true,
        updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 3. Users (governance E2E fixtures — one per canonical RBP role)
-- -----------------------------------------------------------------------------
-- SUPERUSER is the only role allowed to have NULL employee_id per the
-- users_business_must_have_employee check constraint. All others link to a
-- tenant employee above.

INSERT INTO users (id, username, password_hash, role, permissions, is_active, employee_id, created_at, updated_at)
SELECT
    u.id::uuid,
    u.username,
    crypt('password', gen_salt('bf', 10)),
    u.role,
    u.permissions,
    true,
    u.employee_id::uuid,
    NOW(),
    NOW()
  FROM (VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'sysadmin',                 'SUPERUSER',    ARRAY['VIEW_PLATFORM','MANAGE_TENANTS','MANAGE_USERS','EDIT_CONFIG','VIEW_SENSITIVE_DATA','DEBUG_TOOLS']::text[], NULL),
    ('00000001-0000-0000-0000-000000000001', 'admin',                    'TENANT_OWNER', ARRAY[]::text[], 'e1000001-0000-0000-0000-000000000001'),
    ('00000002-0000-0000-0000-000000000002', 'rtl-bank.marco.desantis',  'IT_ADMIN',     ARRAY[]::text[], 'e2000002-0000-0000-0000-000000000002'),
    ('00000003-0000-0000-0000-000000000003', 'rtl-hr',                   'HR_DIRECTOR',  ARRAY[]::text[], 'e2000003-0000-0000-0000-000000000003'),
    ('00000004-0000-0000-0000-000000000004', 'rtl-bank.maria.colombo',   'HR_MANAGER',   ARRAY[]::text[], 'e2000004-0000-0000-0000-000000000004'),
    ('00000005-0000-0000-0000-000000000005', 'rtl-bank.alice.esposito',  'DEPT_HEAD',    ARRAY[]::text[], 'e2000005-0000-0000-0000-000000000005'),
    ('00000006-0000-0000-0000-000000000006', 'rtl-bank.giuseppe.ferri',  'LINE_MANAGER', ARRAY[]::text[], 'e2000006-0000-0000-0000-000000000006'),
    ('00000007-0000-0000-0000-000000000007', 'rtl-bank.pietro.barbieri', 'EMPLOYEE',     ARRAY[]::text[], 'e2000007-0000-0000-0000-000000000007')
  ) AS u(id, username, role, permissions, employee_id)
ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        employee_id = EXCLUDED.employee_id,
        is_active = true,
        updated_at = NOW()
    -- Guard: never overwrite the canonical demo users (see docs/DEMO_CREDENTIALS.md).
    -- The username list lives in .env and is materialized in the
    -- canonical_demo_users table by scripts/apply-canonical-users.sh — no hardcoding.
    -- If the table does not exist yet (fresh DB), the subquery returns no rows and
    -- the guard degenerates to a no-op, which is correct: no canonical users yet.
    WHERE users.username NOT IN (
        SELECT username FROM canonical_demo_users
    );

-- -----------------------------------------------------------------------------
-- 4. Governance fixture rows (leave_requests, performance_reviews, goals)
-- -----------------------------------------------------------------------------
-- These are the minimum rows the E2E governance suite needs to render
-- dashboards and smoke approval workflows for the RTL bank tenant. They are
-- scoped to RTL-bank employees and are idempotent via ON CONFLICT.
--
-- leave_requests is a view over the underlying table; inserts must target the
-- base table. We locate it dynamically so this seed survives schema renames.

DO $ci_seed_extras$
DECLARE
    rtl_tenant uuid;
    v_tbl text;
    pietro uuid := 'e2000007-0000-0000-0000-000000000007';
    maria  uuid := 'e2000004-0000-0000-0000-000000000004';
    alice  uuid := 'e2000005-0000-0000-0000-000000000005';
BEGIN
    SELECT id INTO rtl_tenant FROM tenants WHERE code = 'rtl-bank';

    SELECT c.relname INTO v_tbl
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname LIKE 'leave_requests%'
       AND c.relkind = 'r'
     ORDER BY CASE WHEN c.relname = 'leave_requests' THEN 0 ELSE 1 END, c.relname
     LIMIT 1;

    IF v_tbl IS NOT NULL THEN
        EXECUTE format($sql$
            INSERT INTO %I (id, tenant_id, employee_id, leave_type, start_date, end_date, days_requested, reason, status, created_at, updated_at)
            VALUES
                ('a1000001-0000-0000-0000-000000000001', $1, $2, 'annual', CURRENT_DATE + 7, CURRENT_DATE + 12, 5, 'CI fixture: vacation', 'pending', NOW(), NOW()),
                ('a1000002-0000-0000-0000-000000000002', $1, $3, 'sick',   CURRENT_DATE - 3, CURRENT_DATE - 1,  3, 'CI fixture: sick leave', 'approved', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        $sql$, v_tbl) USING rtl_tenant, pietro, maria;
    END IF;

    -- performance_reviews
    INSERT INTO performance_reviews
        (id, tenant_id, employee_id, reviewer_id, review_period_start, review_period_end,
         review_type, overall_rating, status, created_at, updated_at)
    VALUES
        ('b2000001-0000-0000-0000-000000000001', rtl_tenant, pietro, maria,
         DATE_TRUNC('year', CURRENT_DATE)::date, (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::date,
         'annual', 4.0, 'completed', NOW(), NOW()),
        ('b2000002-0000-0000-0000-000000000002', rtl_tenant, pietro, alice,
         (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year')::date, (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 day')::date,
         'annual', 3.8, 'completed', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- goals
    INSERT INTO goals
        (id, tenant_id, employee_id, title, description, goal_type, start_date, due_date,
         status, progress_percent, created_at, updated_at)
    VALUES
        ('c3000001-0000-0000-0000-000000000001', rtl_tenant, pietro,
         'Complete RBP compliance training', 'CI fixture goal', 'objective',
         CURRENT_DATE - 60, CURRENT_DATE + 30, 'in_progress', 60, NOW(), NOW()),
        ('c3000002-0000-0000-0000-000000000002', rtl_tenant, maria,
         'Improve HR onboarding TTD by 20%', 'CI fixture goal', 'objective',
         CURRENT_DATE - 90, CURRENT_DATE + 90, 'in_progress', 40, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
END
$ci_seed_extras$;

-- =============================================================================
-- 5. Widget fixtures for workspace/composer E2E tests
-- =============================================================================

INSERT INTO widget_catalog (code, name, description, widget_type, is_active, default_size, created_at, updated_at)
VALUES
  ('ci_headcount_kpi', 'Headcount KPI (CI)', 'CI test widget', 'KPI_CARD', true, '{"w":4,"h":2}'::jsonb, NOW(), NOW()),
  ('ci_engagement_score', 'Engagement Score (CI)', 'CI test widget', 'KPI_CARD', true, '{"w":4,"h":2}'::jsonb, NOW(), NOW()),
  ('ci_notifications_feed', 'Notifications (CI)', 'CI test widget', 'FEED', true, '{"w":8,"h":3}'::jsonb, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- END OF CI TEST SEED
-- =============================================================================
