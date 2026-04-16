-- ============================================================================
-- Migration 150: RBP Framework — Core Tables + Seed Data
-- ARCH-2026-002 v1.2 — Role-Based Permissions & Security Framework
--
-- Creates 10 core tables + 3 team tables with rbp_ prefix
-- Populates seed data: 8 roles, 10 dashboards, 20 functional areas,
-- 5 data classifications, full permission matrix, scope rules, field policies
--
-- Feature flag: USE_RBP_FRAMEWORK=true (in .env) to activate
-- Rollback: 150_rbp_framework_tables_rollback.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. rbp_roles — Source of Truth dei Ruoli
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_roles (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    hierarchy_level INTEGER NOT NULL,
    is_system_role  BOOLEAN NOT NULL DEFAULT true,
    is_assignable   BOOLEAN NOT NULL DEFAULT true,
    inherits_from   VARCHAR(50) REFERENCES rbp_roles(code),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rbp_roles ADD CONSTRAINT rbp_roles_hierarchy_level_unique UNIQUE (hierarchy_level);

-- ============================================================================
-- 2. rbp_functional_areas — Aree Funzionali (Workday-style)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_functional_areas (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    category    VARCHAR(50) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rbp_functional_areas ADD CONSTRAINT rbp_fa_category_check
    CHECK (category IN ('SYSTEM', 'HR', 'BUSINESS', 'PORTAL'));

-- ============================================================================
-- 3. rbp_dashboards — Configurazioni di Esperienza
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_dashboards (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    layout_path     VARCHAR(100) NOT NULL,
    icon            VARCHAR(50),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    theme_config    JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. rbp_pages — Registro Pagine
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_pages (
    id                  SERIAL PRIMARY KEY,
    code                VARCHAR(80) NOT NULL UNIQUE,
    name                VARCHAR(150) NOT NULL,
    description         TEXT,
    route_path          VARCHAR(200) NOT NULL,
    functional_area_code VARCHAR(50) NOT NULL REFERENCES rbp_functional_areas(code),
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    redirect_to         VARCHAR(200),
    icon                VARCHAR(50),
    component_path      VARCHAR(200),
    requires_auth       BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rbp_pages ADD CONSTRAINT rbp_pages_status_check
    CHECK (status IN ('ACTIVE', 'REDIRECT', 'EXPERIMENTAL', 'DEPRECATED'));

-- redirect_to obbligatorio se status = REDIRECT
ALTER TABLE rbp_pages ADD CONSTRAINT rbp_pages_redirect_check
    CHECK (status != 'REDIRECT' OR redirect_to IS NOT NULL);

-- ============================================================================
-- 5. rbp_data_classifications — Classi di Sensibilità
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_data_classifications (
    id                SERIAL PRIMARY KEY,
    code              VARCHAR(30) NOT NULL UNIQUE,
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    sensitivity_level INTEGER NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. rbp_role_dashboards — Ruolo ↔ Dashboard (M:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_role_dashboards (
    id            SERIAL PRIMARY KEY,
    role_id       INTEGER NOT NULL REFERENCES rbp_roles(id) ON DELETE CASCADE,
    dashboard_id  INTEGER NOT NULL REFERENCES rbp_dashboards(id) ON DELETE CASCADE,
    is_default    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, dashboard_id)
);

-- Ogni ruolo ha esattamente una dashboard di default
CREATE UNIQUE INDEX idx_rbp_role_dashboards_default
    ON rbp_role_dashboards (role_id) WHERE is_default = true;

-- ============================================================================
-- 7. rbp_dashboard_nav_items — Navigazione Polimorfica
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_dashboard_nav_items (
    id                    SERIAL PRIMARY KEY,
    dashboard_id          INTEGER NOT NULL REFERENCES rbp_dashboards(id) ON DELETE CASCADE,
    item_type             VARCHAR(20) NOT NULL,
    target_page_id        INTEGER REFERENCES rbp_pages(id) ON DELETE CASCADE,
    target_dashboard_id   INTEGER REFERENCES rbp_dashboards(id) ON DELETE SET NULL,
    external_url          VARCHAR(500),
    section               VARCHAR(50) NOT NULL DEFAULT 'main',
    label_override        VARCHAR(150),
    icon_override         VARCHAR(50),
    sort_order            INTEGER NOT NULL DEFAULT 0,
    is_visible            BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rbp_dashboard_nav_items ADD CONSTRAINT rbp_nav_items_type_check
    CHECK (item_type IN ('page', 'dashboard', 'section_header', 'external_link'));

ALTER TABLE rbp_dashboard_nav_items ADD CONSTRAINT rbp_nav_items_target_check
    CHECK (
        (item_type = 'page' AND target_page_id IS NOT NULL AND target_dashboard_id IS NULL AND external_url IS NULL)
        OR (item_type = 'dashboard' AND target_dashboard_id IS NOT NULL AND target_page_id IS NULL AND external_url IS NULL)
        OR (item_type = 'section_header' AND target_page_id IS NULL AND target_dashboard_id IS NULL AND external_url IS NULL)
        OR (item_type = 'external_link' AND external_url IS NOT NULL AND target_page_id IS NULL AND target_dashboard_id IS NULL)
    );

ALTER TABLE rbp_dashboard_nav_items ADD CONSTRAINT rbp_nav_items_no_self_ref
    CHECK (item_type != 'dashboard' OR target_dashboard_id != dashboard_id);

-- ============================================================================
-- 8. rbp_role_permissions — Ruolo × Area Funzionale = Permessi
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_role_permissions (
    id                   SERIAL PRIMARY KEY,
    role_id              INTEGER NOT NULL REFERENCES rbp_roles(id) ON DELETE CASCADE,
    functional_area_id   INTEGER NOT NULL REFERENCES rbp_functional_areas(id) ON DELETE CASCADE,
    can_view             BOOLEAN NOT NULL DEFAULT false,
    can_create           BOOLEAN NOT NULL DEFAULT false,
    can_edit             BOOLEAN NOT NULL DEFAULT false,
    can_delete           BOOLEAN NOT NULL DEFAULT false,
    can_approve          BOOLEAN NOT NULL DEFAULT false,
    can_export           BOOLEAN NOT NULL DEFAULT false,
    scope_type           VARCHAR(30) NOT NULL DEFAULT 'SELF',
    conditions           JSONB DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, functional_area_id)
);

ALTER TABLE rbp_role_permissions ADD CONSTRAINT rbp_rp_scope_check
    CHECK (scope_type IN ('PLATFORM', 'TENANT', 'DEPARTMENT', 'HIERARCHY', 'SELF', 'TEAM'));

-- ============================================================================
-- 9. rbp_scope_rules — Regole di Scope con SQL Template
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_scope_rules (
    id              SERIAL PRIMARY KEY,
    role_id         INTEGER NOT NULL REFERENCES rbp_roles(id) ON DELETE CASCADE,
    scope_type      VARCHAR(30) NOT NULL,
    description     TEXT,
    sql_template    TEXT NOT NULL,
    parameters      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, scope_type)
);

ALTER TABLE rbp_scope_rules ADD CONSTRAINT rbp_scope_rules_type_check
    CHECK (scope_type IN ('PLATFORM', 'TENANT', 'DEPARTMENT', 'HIERARCHY', 'SELF', 'TEAM'));

-- ============================================================================
-- 10. rbp_field_policies — Policy di Masking per Classificazione
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_field_policies (
    id                       SERIAL PRIMARY KEY,
    role_id                  INTEGER NOT NULL REFERENCES rbp_roles(id) ON DELETE CASCADE,
    data_classification_id   INTEGER NOT NULL REFERENCES rbp_data_classifications(id) ON DELETE CASCADE,
    action                   VARCHAR(20) NOT NULL DEFAULT 'MASK',
    field_list               JSONB DEFAULT '[]',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, data_classification_id)
);

ALTER TABLE rbp_field_policies ADD CONSTRAINT rbp_field_policies_action_check
    CHECK (action IN ('SHOW', 'MASK', 'HIDE'));

-- ============================================================================
-- 11-13. Team Tables (Fase 3, ma creiamo struttura ora)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbp_teams (
    id              SERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    purpose         TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS rbp_team_members (
    id          SERIAL PRIMARY KEY,
    team_id     INTEGER NOT NULL REFERENCES rbp_teams(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    role_in_team VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at     TIMESTAMPTZ,
    UNIQUE(team_id, employee_id)
);

CREATE TABLE IF NOT EXISTS rbp_team_leaders (
    id          SERIAL PRIMARY KEY,
    team_id     INTEGER NOT NULL REFERENCES rbp_teams(id) ON DELETE CASCADE,
    leader_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ,
    UNIQUE(team_id, leader_id)
);

-- ============================================================================
-- SQL Functions
-- ============================================================================

-- Recursive reports chain for HIERARCHY scope
-- Note: employees table uses manager_id (not reports_to) for hierarchy
CREATE OR REPLACE FUNCTION rbp_get_recursive_reports(manager_employee_id UUID)
RETURNS TABLE(id UUID) AS $$
    WITH RECURSIVE subordinates AS (
        SELECT e.id
        FROM employees e
        WHERE e.manager_id = manager_employee_id
          AND e.deleted_at IS NULL
        UNION ALL
        SELECT e.id
        FROM employees e
        INNER JOIN subordinates s ON e.manager_id = s.id
        WHERE e.deleted_at IS NULL
    )
    SELECT id FROM subordinates;
$$ LANGUAGE SQL STABLE;

-- Get effective permissions for a user (resolves inheritance)
CREATE OR REPLACE FUNCTION rbp_get_user_effective_permissions(user_role_code VARCHAR)
RETURNS TABLE(
    functional_area_code VARCHAR,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_approve BOOLEAN,
    can_export BOOLEAN,
    scope_type VARCHAR
) AS $$
    WITH RECURSIVE role_chain AS (
        -- Base: direct role
        SELECT r.code, r.inherits_from, r.id
        FROM rbp_roles r
        WHERE r.code = user_role_code
        UNION ALL
        -- Recursive: inherited roles
        SELECT r.code, r.inherits_from, r.id
        FROM rbp_roles r
        INNER JOIN role_chain rc ON r.code = rc.inherits_from
    )
    SELECT
        fa.code AS functional_area_code,
        -- For each permission, take the most permissive across the chain (OR logic)
        bool_or(rp.can_view) AS can_view,
        bool_or(rp.can_create) AS can_create,
        bool_or(rp.can_edit) AS can_edit,
        bool_or(rp.can_delete) AS can_delete,
        bool_or(rp.can_approve) AS can_approve,
        bool_or(rp.can_export) AS can_export,
        -- For scope, take the widest (lowest ordinal: PLATFORM < TENANT < DEPARTMENT < HIERARCHY < SELF)
        MIN(rp.scope_type) AS scope_type
    FROM role_chain rc
    JOIN rbp_role_permissions rp ON rp.role_id = rc.id
    JOIN rbp_functional_areas fa ON fa.id = rp.functional_area_id
    GROUP BY fa.code;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- ---------- rbp_roles ----------
INSERT INTO rbp_roles (code, name, hierarchy_level, is_system_role, is_assignable, inherits_from, description, metadata) VALUES
('SUPERUSER',    'Platform Owner',      -1, true, false, NULL,       'Proprietario della piattaforma. Solo aggregati cross-tenant, mai dati personali. Accesso emergenza via break-glass.', '{"mfa_required": true, "max_sessions": 3}'),
('SYSADMIN',     'System Administrator', 0, true, true,  NULL,       'Amministratore tecnico del tenant. Full read per diagnostica. Configura SSO, integrazioni, API keys.', '{"mfa_required": true}'),
('IT_ADMIN',     'IT Administrator',     1, true, true,  NULL,       'Gestione IT del tenant: sicurezza, integrazioni, log tecnici. Nessun accesso a dati HR.', '{}'),
('HR_DIRECTOR',  'HR Director',          2, true, true,  'EMPLOYEE', 'HR strategico: succession, calibration, compensation, workforce analytics. Scope: intero tenant.', '{}'),
('HR_MANAGER',   'HR Manager',           3, true, true,  'EMPLOYEE', 'HR operativo: recruiting, formazione, performance, presenze. Scope: intero tenant.', '{}'),
('DEPT_HEAD',    'Department Head',      4, true, true,  'LINE_MANAGER', 'Full HR view scoped al proprio dipartimento. Vede budget, analytics, performance del dipartimento.', '{}'),
('LINE_MANAGER', 'Line Manager',         5, true, true,  'EMPLOYEE', 'Gestione linea gerarchica: approvazioni, valutazioni, obiettivi. Scope: catena ricorsiva.', '{}'),
('EMPLOYEE',     'Employee',             6, true, true,  NULL,       'Self-service: profilo, obiettivi, formazione, ferie. Vede solo se stesso + organigramma read-only.', '{}');

-- Add default_dashboard_code FK after dashboards are seeded (deferred below)

-- ---------- rbp_functional_areas ----------
INSERT INTO rbp_functional_areas (code, name, description, category, sort_order) VALUES
('PLATFORM',               'Platform Management',     'Gestione piattaforma: tenant, licenze, system health',                              'SYSTEM',   1),
('SECURITY',               'Security & Access',       'Utenti, ruoli, SSO, API keys, audit log, tenant config',                            'SYSTEM',   2),
('CORE_HR',                'Core HR',                 'Anagrafiche, contratti, onboarding, documenti, sedi, centri costo',                  'HR',       3),
('TALENT',                 'Talent & Skills',         'Skills, ESCO explorer, skill profiles, gap analysis, career paths, succession',      'HR',       4),
('PERFORMANCE',            'Performance Management',  'Review cycles, goals, OKR, check-in, feedback, calibration',                        'HR',       5),
('COMPENSATION',           'Compensation & Benefits', 'Stipendi, salary bands, bonus plans, merit cycles, equity, benefits',                'HR',       6),
('TIME_ATTENDANCE',        'Time & Attendance',       'Presenze, ferie, straordinari, turni',                                              'HR',       7),
('LEARNING',               'Learning & Development',  'Formazione, corsi, certificazioni, percorsi formativi, knowledge base',              'HR',       8),
('RECRUITMENT',            'Recruitment',             'Requisizioni, job posting, candidati, pipeline selezione',                           'HR',       9),
('CAREER',                 'Career Management',       'Obiettivi carriera, competenze, percorsi, mentoring, career coach AI',               'HR',      10),
('ANALYTICS',              'Analytics & Reporting',   'Workforce analytics, compensation analytics, HR intelligence, predictions, export',  'BUSINESS', 11),
('COMPANY_ANALYTICS',      'Company PET Analytics',   'Hub analitico organizzativo: struttura, costi, workforce, demographics, scenari',    'BUSINESS', 12),
('WORKFORCE_INTELLIGENCE', 'Workforce Intelligence',  'Career simulator, skill galaxy, what-if scenarios, org dashboard',                   'BUSINESS', 13),
('ORGANIZATION',           'Organization',            'Dipartimenti, posizioni, unità organizzative, organigramma',                        'BUSINESS', 14),
('TEAMS',                  'Teams',                   'Team trasversali, composizione, obiettivi team',                                    'BUSINESS', 15),
('ENGAGEMENT',             'Engagement',              'Wellbeing, social recognition, mentorship, survey, pulse',                          'HR',       16),
('COMPLIANCE',             'Compliance',              'Audit trail, policy violations, whistleblowing',                                    'HR',       17),
('AI_SERVICES',            'AI Services',             'Chat AI, analisi documenti, sessioni AI',                                           'SYSTEM',   18),
('MARKETPLACE',            'Marketplace',             'Plugin, integrazioni, developer tools, API keys, webhooks',                         'SYSTEM',   19),
('SELF_SERVICE',           'Self-Service',            'Profilo, obiettivi, formazione, documenti, buste paga, ferie',                      'PORTAL',   20);

-- ---------- rbp_dashboards ----------
INSERT INTO rbp_dashboards (code, name, description, layout_path, icon, sort_order) VALUES
('platform_console',       'Platform Console',          'Tenant management, system health, billing',                      '/platform',     'server',        1),
('tech_admin',             'Tech Administration',       'Configurazione, SSO, integrazioni, log, utenti, marketplace',    '/admin',        'settings',      2),
('hr_strategic',           'HR Strategic',              'Succession, calibration, compensation modeling, analytics',       '/admin',        'briefcase',     3),
('hr_operations',          'HR Operations',             'Recruiting, formazione, performance, presenze',                  '/admin',        'users',         4),
('department_console',     'Department Console',        'HR-like scoped al dipartimento: team, performance, budget',      '/admin',        'building',      5),
('company_pet',            'Company PET Analytics',     'Hub analitico organizzativo: struttura, costi, workforce',       '/company-pet',  'bar-chart-2',   6),
('workforce_intelligence', 'Workforce Intelligence',    'Career simulator, skill galaxy, what-if, org dashboard',         '/admin',        'brain',         7),
('dashboards_hub',         'Dashboards Hub',            'Taxonomy explorer (ESCO/NACE), dashboard prototyping',           '/dashboards',   'layout-grid',   8),
('manager_hub',            'Manager Hub',               'Portal arricchito: catena gerarchica, approvazioni, valutazioni','/portal',       'user-check',    9),
('employee_portal',        'Employee Self-Service',     'Self-service: profilo, obiettivi, formazione, ferie, documenti', '/portal',       'user',         10);

-- Now add default_dashboard_code to rbp_roles
ALTER TABLE rbp_roles ADD COLUMN default_dashboard_code VARCHAR(50) REFERENCES rbp_dashboards(code);
UPDATE rbp_roles SET default_dashboard_code = 'platform_console'       WHERE code = 'SUPERUSER';
UPDATE rbp_roles SET default_dashboard_code = 'tech_admin'             WHERE code = 'SYSADMIN';
UPDATE rbp_roles SET default_dashboard_code = 'tech_admin'             WHERE code = 'IT_ADMIN';
UPDATE rbp_roles SET default_dashboard_code = 'hr_strategic'           WHERE code = 'HR_DIRECTOR';
UPDATE rbp_roles SET default_dashboard_code = 'hr_operations'          WHERE code = 'HR_MANAGER';
UPDATE rbp_roles SET default_dashboard_code = 'department_console'     WHERE code = 'DEPT_HEAD';
UPDATE rbp_roles SET default_dashboard_code = 'manager_hub'            WHERE code = 'LINE_MANAGER';
UPDATE rbp_roles SET default_dashboard_code = 'employee_portal'        WHERE code = 'EMPLOYEE';

-- ---------- rbp_data_classifications ----------
INSERT INTO rbp_data_classifications (code, name, description, sensitivity_level) VALUES
('PUBLIC',       'Public',       'Nome, ruolo, dipartimento, foto profilo. Visibili nell''organigramma.',        0),
('INTERNAL',     'Internal',     'Email, telefono, sede, manager diretto. Visibili internamente.',               1),
('CONFIDENTIAL', 'Confidential', 'Valutazioni, feedback, obiettivi, skill assessment.',                          2),
('RESTRICTED',   'Restricted',   'Stipendio, compensation, equity, benefit details.',                            3),
('SENSITIVE',    'Sensitive',    'Dati medici, disabilità, note disciplinari, procedimenti.',                     4);

-- ---------- rbp_role_dashboards ----------
INSERT INTO rbp_role_dashboards (role_id, dashboard_id, is_default)
SELECT r.id, d.id, v.is_default
FROM (VALUES
    ('SUPERUSER',    'platform_console',       true),
    ('SYSADMIN',     'tech_admin',             true),
    ('SYSADMIN',     'dashboards_hub',         false),
    ('IT_ADMIN',     'tech_admin',             true),
    ('HR_DIRECTOR',  'hr_strategic',           true),
    ('HR_DIRECTOR',  'company_pet',            false),
    ('HR_DIRECTOR',  'workforce_intelligence', false),
    ('HR_DIRECTOR',  'dashboards_hub',         false),
    ('HR_MANAGER',   'hr_operations',          true),
    ('HR_MANAGER',   'company_pet',            false),
    ('HR_MANAGER',   'dashboards_hub',         false),
    ('DEPT_HEAD',    'department_console',      true),
    ('DEPT_HEAD',    'company_pet',            false),
    ('LINE_MANAGER', 'manager_hub',            true),
    ('EMPLOYEE',     'employee_portal',        true)
) AS v(role_code, dashboard_code, is_default)
JOIN rbp_roles r ON r.code = v.role_code
JOIN rbp_dashboards d ON d.code = v.dashboard_code;

-- ---------- rbp_role_permissions ----------
-- Full permission matrix from ARCH-2026-002 v1.2 §4.3

INSERT INTO rbp_role_permissions (role_id, functional_area_id, can_view, can_create, can_edit, can_delete, can_approve, can_export, scope_type)
SELECT r.id, fa.id, v.cv, v.cc, v.ce, v.cd, v.ca, v.cx, v.scope
FROM (VALUES
    -- SUPERUSER
    ('SUPERUSER', 'PLATFORM',      true,true,true,true,true,true,   'PLATFORM'),
    ('SUPERUSER', 'SECURITY',      true,true,true,false,true,true,  'PLATFORM'),
    ('SUPERUSER', 'AI_SERVICES',   true,false,false,false,false,true,'PLATFORM'),
    ('SUPERUSER', 'MARKETPLACE',   true,true,true,true,true,true,   'PLATFORM'),
    -- SYSADMIN
    ('SYSADMIN', 'SECURITY',       true,true,true,false,true,true,  'TENANT'),
    ('SYSADMIN', 'CORE_HR',        true,false,false,false,false,true,'TENANT'),
    ('SYSADMIN', 'TALENT',         true,false,false,false,false,true,'TENANT'),
    ('SYSADMIN', 'PERFORMANCE',    true,false,false,false,false,true,'TENANT'),
    ('SYSADMIN', 'COMPENSATION',   true,false,false,false,false,false,'TENANT'),
    ('SYSADMIN', 'ORGANIZATION',   true,true,true,false,false,true, 'TENANT'),
    ('SYSADMIN', 'AI_SERVICES',    true,false,true,false,false,true, 'TENANT'),
    ('SYSADMIN', 'MARKETPLACE',    true,true,true,true,true,true,   'TENANT'),
    ('SYSADMIN', 'COMPLIANCE',     true,false,false,false,false,true,'TENANT'),
    -- IT_ADMIN
    ('IT_ADMIN', 'SECURITY',       true,false,true,false,false,true, 'TENANT'),
    ('IT_ADMIN', 'AI_SERVICES',    true,false,true,false,false,true, 'TENANT'),
    ('IT_ADMIN', 'MARKETPLACE',    true,true,true,false,false,true,  'TENANT'),
    -- HR_DIRECTOR (strategic — full HR + analytics + compliance approval)
    ('HR_DIRECTOR', 'CORE_HR',                true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'TALENT',                 true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'PERFORMANCE',            true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'COMPENSATION',           true,true,true,false,true,true,  'TENANT'),
    ('HR_DIRECTOR', 'TIME_ATTENDANCE',        true,true,true,false,true,true,  'TENANT'),
    ('HR_DIRECTOR', 'LEARNING',               true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'RECRUITMENT',            true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'CAREER',                 true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'ANALYTICS',              true,true,false,false,false,true, 'TENANT'),
    ('HR_DIRECTOR', 'COMPANY_ANALYTICS',      true,true,false,false,false,true, 'TENANT'),
    ('HR_DIRECTOR', 'WORKFORCE_INTELLIGENCE', true,true,true,false,false,true,  'TENANT'),
    ('HR_DIRECTOR', 'ORGANIZATION',           true,true,true,false,true,true,  'TENANT'),
    ('HR_DIRECTOR', 'TEAMS',                  true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'ENGAGEMENT',             true,true,true,true,true,true,   'TENANT'),
    ('HR_DIRECTOR', 'COMPLIANCE',             true,true,true,false,true,true,  'TENANT'),
    ('HR_DIRECTOR', 'AI_SERVICES',            true,true,false,false,false,true, 'TENANT'),
    ('HR_DIRECTOR', 'SELF_SERVICE',           true,false,true,false,false,false,'SELF'),
    -- HR_MANAGER (operational — day-to-day HR, no strategic actions)
    ('HR_MANAGER', 'CORE_HR',            true,true,true,true,true,true,   'TENANT'),
    ('HR_MANAGER', 'TALENT',             true,true,true,false,false,true, 'TENANT'),
    ('HR_MANAGER', 'PERFORMANCE',        true,true,true,false,true,true,  'TENANT'),
    ('HR_MANAGER', 'COMPENSATION',       true,false,false,false,false,false,'TENANT'),
    ('HR_MANAGER', 'TIME_ATTENDANCE',    true,true,true,false,true,true,  'TENANT'),
    ('HR_MANAGER', 'LEARNING',           true,true,true,true,true,true,   'TENANT'),
    ('HR_MANAGER', 'RECRUITMENT',        true,true,true,false,true,true,  'TENANT'),
    ('HR_MANAGER', 'CAREER',             true,true,true,false,true,true,  'TENANT'),
    ('HR_MANAGER', 'ANALYTICS',          true,false,false,false,false,true,'TENANT'),
    ('HR_MANAGER', 'COMPANY_ANALYTICS',  true,false,false,false,false,true,'TENANT'),
    ('HR_MANAGER', 'ORGANIZATION',       true,false,false,false,false,true,'TENANT'),
    ('HR_MANAGER', 'TEAMS',              true,true,true,false,true,true,  'TENANT'),
    ('HR_MANAGER', 'ENGAGEMENT',         true,true,true,false,true,true,  'TENANT'),
    ('HR_MANAGER', 'COMPLIANCE',         true,true,true,false,false,true, 'TENANT'),
    ('HR_MANAGER', 'AI_SERVICES',        true,true,false,false,false,true, 'TENANT'),
    ('HR_MANAGER', 'SELF_SERVICE',       true,false,true,false,false,false,'SELF'),
    -- DEPT_HEAD (department-scoped HR)
    ('DEPT_HEAD', 'CORE_HR',             true,false,true,false,true,true,  'DEPARTMENT'),
    ('DEPT_HEAD', 'TALENT',              true,false,true,false,true,true,  'DEPARTMENT'),
    ('DEPT_HEAD', 'PERFORMANCE',         true,true,true,false,true,true,   'DEPARTMENT'),
    ('DEPT_HEAD', 'COMPENSATION',        true,false,false,false,false,false,'DEPARTMENT'),
    ('DEPT_HEAD', 'TIME_ATTENDANCE',     true,false,true,false,true,true,  'DEPARTMENT'),
    ('DEPT_HEAD', 'LEARNING',            true,false,true,false,true,true,  'DEPARTMENT'),
    ('DEPT_HEAD', 'CAREER',              true,false,true,false,true,true,  'DEPARTMENT'),
    ('DEPT_HEAD', 'ANALYTICS',           true,false,false,false,false,true, 'DEPARTMENT'),
    ('DEPT_HEAD', 'COMPANY_ANALYTICS',   true,false,false,false,false,true, 'DEPARTMENT'),
    ('DEPT_HEAD', 'ORGANIZATION',        true,false,false,false,false,true, 'DEPARTMENT'),
    ('DEPT_HEAD', 'TEAMS',               true,false,true,false,true,true,  'DEPARTMENT'),
    ('DEPT_HEAD', 'ENGAGEMENT',          true,false,false,false,false,true, 'DEPARTMENT'),
    ('DEPT_HEAD', 'COMPLIANCE',          true,false,false,false,false,true, 'DEPARTMENT'),
    ('DEPT_HEAD', 'SELF_SERVICE',        true,false,true,false,false,false, 'SELF'),
    -- LINE_MANAGER (hierarchy-scoped)
    ('LINE_MANAGER', 'PERFORMANCE',      true,true,true,false,true,false,  'HIERARCHY'),
    ('LINE_MANAGER', 'TIME_ATTENDANCE',  true,false,false,false,true,false, 'HIERARCHY'),
    ('LINE_MANAGER', 'TALENT',           true,false,false,false,false,false,'HIERARCHY'),
    ('LINE_MANAGER', 'CAREER',           true,false,false,false,false,false,'HIERARCHY'),
    ('LINE_MANAGER', 'ORGANIZATION',     true,false,false,false,false,false,'TENANT'),
    ('LINE_MANAGER', 'TEAMS',            true,false,false,false,false,false,'TENANT'),
    ('LINE_MANAGER', 'ENGAGEMENT',       true,false,false,false,false,false,'HIERARCHY'),
    ('LINE_MANAGER', 'SELF_SERVICE',     true,true,true,false,false,true,  'SELF'),
    -- EMPLOYEE (self only)
    ('EMPLOYEE', 'ORGANIZATION',         true,false,false,false,false,false,'TENANT'),
    ('EMPLOYEE', 'TEAMS',               true,false,false,false,false,false,'TENANT'),
    ('EMPLOYEE', 'ENGAGEMENT',          true,false,false,false,false,false,'SELF'),
    ('EMPLOYEE', 'CAREER',              true,false,true,false,false,false, 'SELF'),
    ('EMPLOYEE', 'AI_SERVICES',         true,true,false,false,false,false, 'SELF'),
    ('EMPLOYEE', 'SELF_SERVICE',        true,true,true,false,false,true,   'SELF')
) AS v(role_code, fa_code, cv, cc, ce, cd, ca, cx, scope)
JOIN rbp_roles r ON r.code = v.role_code
JOIN rbp_functional_areas fa ON fa.code = v.fa_code;

-- ---------- rbp_scope_rules ----------
INSERT INTO rbp_scope_rules (role_id, scope_type, description, sql_template, parameters)
SELECT r.id, v.scope_type, v.description, v.sql_template, v.parameters::jsonb
FROM (VALUES
    ('SUPERUSER',    'PLATFORM',    'Nessun filtro (solo aggregati)',                      '1=1',                                                                                    '{}'),
    ('SYSADMIN',     'TENANT',      'Filtra per tenant corrente',                          'tenant_id = :tenantId',                                                                   '{"tenantId": "session.tenant_id"}'),
    ('IT_ADMIN',     'TENANT',      'Filtra per tenant corrente',                          'tenant_id = :tenantId',                                                                   '{"tenantId": "session.tenant_id"}'),
    ('HR_DIRECTOR',  'TENANT',      'Tutti i dipendenti del tenant',                       'tenant_id = :tenantId',                                                                   '{"tenantId": "session.tenant_id"}'),
    ('HR_MANAGER',   'TENANT',      'Tutti i dipendenti del tenant',                       'tenant_id = :tenantId',                                                                   '{"tenantId": "session.tenant_id"}'),
    ('DEPT_HEAD',    'DEPARTMENT',  'Filtra per dipartimento',                             'tenant_id = :tenantId AND department_id = :departmentId',                                  '{"tenantId": "session.tenant_id", "departmentId": "session.department_id"}'),
    ('LINE_MANAGER', 'HIERARCHY',   'Catena gerarchica ricorsiva',                         'tenant_id = :tenantId AND employee_id IN (SELECT id FROM rbp_get_recursive_reports(:employeeId))', '{"tenantId": "session.tenant_id", "employeeId": "session.employee_id"}'),
    ('EMPLOYEE',     'SELF',        'Solo se stesso',                                      'tenant_id = :tenantId AND employee_id = :employeeId',                                     '{"tenantId": "session.tenant_id", "employeeId": "session.employee_id"}')
) AS v(role_code, scope_type, description, sql_template, parameters)
JOIN rbp_roles r ON r.code = v.role_code;

-- ---------- rbp_field_policies ----------
INSERT INTO rbp_field_policies (role_id, data_classification_id, action)
SELECT r.id, dc.id, v.action
FROM (VALUES
    -- SUPERUSER: HIDE everything (vede solo aggregati, mai dati personali)
    ('SUPERUSER', 'PUBLIC', 'HIDE'), ('SUPERUSER', 'INTERNAL', 'HIDE'), ('SUPERUSER', 'CONFIDENTIAL', 'HIDE'), ('SUPERUSER', 'RESTRICTED', 'HIDE'), ('SUPERUSER', 'SENSITIVE', 'HIDE'),
    -- SYSADMIN: vede quasi tutto tranne SENSITIVE
    ('SYSADMIN', 'PUBLIC', 'SHOW'), ('SYSADMIN', 'INTERNAL', 'SHOW'), ('SYSADMIN', 'CONFIDENTIAL', 'SHOW'), ('SYSADMIN', 'RESTRICTED', 'MASK'), ('SYSADMIN', 'SENSITIVE', 'HIDE'),
    -- IT_ADMIN: solo PUBLIC e INTERNAL
    ('IT_ADMIN', 'PUBLIC', 'SHOW'), ('IT_ADMIN', 'INTERNAL', 'SHOW'), ('IT_ADMIN', 'CONFIDENTIAL', 'HIDE'), ('IT_ADMIN', 'RESTRICTED', 'HIDE'), ('IT_ADMIN', 'SENSITIVE', 'HIDE'),
    -- HR_DIRECTOR: full access
    ('HR_DIRECTOR', 'PUBLIC', 'SHOW'), ('HR_DIRECTOR', 'INTERNAL', 'SHOW'), ('HR_DIRECTOR', 'CONFIDENTIAL', 'SHOW'), ('HR_DIRECTOR', 'RESTRICTED', 'SHOW'), ('HR_DIRECTOR', 'SENSITIVE', 'SHOW'),
    -- HR_MANAGER: full access
    ('HR_MANAGER', 'PUBLIC', 'SHOW'), ('HR_MANAGER', 'INTERNAL', 'SHOW'), ('HR_MANAGER', 'CONFIDENTIAL', 'SHOW'), ('HR_MANAGER', 'RESTRICTED', 'SHOW'), ('HR_MANAGER', 'SENSITIVE', 'SHOW'),
    -- DEPT_HEAD: full access (scoped)
    ('DEPT_HEAD', 'PUBLIC', 'SHOW'), ('DEPT_HEAD', 'INTERNAL', 'SHOW'), ('DEPT_HEAD', 'CONFIDENTIAL', 'SHOW'), ('DEPT_HEAD', 'RESTRICTED', 'SHOW'), ('DEPT_HEAD', 'SENSITIVE', 'SHOW'),
    -- LINE_MANAGER: no salary details, no medical
    ('LINE_MANAGER', 'PUBLIC', 'SHOW'), ('LINE_MANAGER', 'INTERNAL', 'SHOW'), ('LINE_MANAGER', 'CONFIDENTIAL', 'SHOW'), ('LINE_MANAGER', 'RESTRICTED', 'MASK'), ('LINE_MANAGER', 'SENSITIVE', 'HIDE'),
    -- EMPLOYEE: sees own data (enforcement via scope SELF, not field policy)
    ('EMPLOYEE', 'PUBLIC', 'SHOW'), ('EMPLOYEE', 'INTERNAL', 'SHOW'), ('EMPLOYEE', 'CONFIDENTIAL', 'SHOW'), ('EMPLOYEE', 'RESTRICTED', 'SHOW'), ('EMPLOYEE', 'SENSITIVE', 'SHOW')
) AS v(role_code, dc_code, action)
JOIN rbp_roles r ON r.code = v.role_code
JOIN rbp_data_classifications dc ON dc.code = v.dc_code;

-- ============================================================================
-- Seed: Sample pages (core set — will be expanded incrementally)
-- ============================================================================

INSERT INTO rbp_pages (code, name, route_path, functional_area_code, status, icon, description) VALUES
-- Platform
('platform_overview',       'Platform Overview',        '/platform/panoramica',             'PLATFORM',      'ACTIVE', 'layout-dashboard', 'Dashboard aggregati piattaforma'),
('tenant_management',       'Tenant Management',        '/platform/tenants',                'PLATFORM',      'ACTIVE', 'building-2',       'CRUD tenant, licenze, piani'),
('system_health',           'System Health',            '/platform/system-health',          'PLATFORM',      'ACTIVE', 'activity',         'Monitoring, uptime, error rates'),
('platform_security',       'Platform Security',        '/platform/security',               'SECURITY',      'ACTIVE', 'shield',           'Sicurezza piattaforma'),
('platform_users',          'User Management',          '/platform/users',                  'SECURITY',      'ACTIVE', 'users',            'Gestione utenti piattaforma'),
-- Admin: Core HR
('employee_directory',      'Employee Directory',       '/admin/dipendenti',                'CORE_HR',       'ACTIVE', 'users',            'Lista dipendenti con filtri'),
('employee_profile',        'Employee Profile',         '/admin/dipendenti/[id]',           'CORE_HR',       'ACTIVE', 'user',             'Dettaglio dipendente'),
('org_chart',               'Organization Chart',       '/admin/organigramma',              'ORGANIZATION',  'ACTIVE', 'git-branch',       'Organigramma interattivo'),
('departments',             'Departments',              '/admin/dipartimenti',              'ORGANIZATION',  'ACTIVE', 'building',         'Gestione dipartimenti'),
('positions',               'Positions',                '/admin/posizioni',                 'ORGANIZATION',  'ACTIVE', 'briefcase',        'Gestione posizioni'),
('org_units',               'Org Units',                '/admin/unita-organizzative',       'ORGANIZATION',  'ACTIVE', 'layers',           'Unità organizzative'),
('cost_centers',            'Cost Centers',             '/admin/centri-costo',              'ORGANIZATION',  'ACTIVE', 'calculator',       'Centri di costo'),
('locations',               'Locations',                '/admin/sedi',                      'ORGANIZATION',  'ACTIVE', 'map-pin',          'Sedi aziendali'),
-- Admin: Performance
('performance_reviews',     'Performance Reviews',      '/admin/performance/review-cycles', 'PERFORMANCE',   'ACTIVE', 'clipboard-check',  'Cicli di valutazione'),
('goals_management',        'Goals & OKR',              '/admin/performance/goals',         'PERFORMANCE',   'ACTIVE', 'target',           'Gestione obiettivi'),
('calibration',             'Calibration Sessions',     '/admin/performance/calibration',   'PERFORMANCE',   'ACTIVE', 'scale',            'Normalizzazione valutazioni'),
('feedback_management',     'Feedback',                 '/admin/performance/feedback',      'PERFORMANCE',   'ACTIVE', 'message-circle',   'Gestione feedback'),
('check_ins',               'Check-ins',                '/admin/performance/check-ins',     'PERFORMANCE',   'ACTIVE', 'check-circle',     'Incontri 1:1'),
-- Admin: Talent
('succession_planning',     'Succession Planning',      '/admin/talent/succession',         'TALENT',        'ACTIVE', 'crown',            'Piani di successione'),
('skill_profiles',          'Skill Profiles',           '/admin/skills',                    'TALENT',        'ACTIVE', 'star',             'Profili competenze'),
('gap_analysis',            'Gap Analysis',             '/admin/talent/gap-analysis',       'TALENT',        'ACTIVE', 'bar-chart',        'Analisi gap competenze'),
('career_paths',            'Career Paths',             '/admin/talent/career-paths',       'TALENT',        'ACTIVE', 'trending-up',      'Percorsi di carriera'),
('esco_explorer',           'ESCO Explorer',            '/admin/talent/esco-explorer',      'TALENT',        'ACTIVE', 'search',           'Esplorazione tassonomia ESCO'),
('internal_mobility',       'Internal Mobility',        '/admin/talent/mobility',           'TALENT',        'ACTIVE', 'shuffle',          'Mobilità interna'),
-- Admin: Compensation
('compensation_modeling',   'Compensation Modeling',    '/admin/compensation',              'COMPENSATION',  'ACTIVE', 'dollar-sign',      'Salary bands, equity modeling'),
('salary_bands',            'Salary Bands',             '/admin/compensation/salary-bands', 'COMPENSATION',  'ACTIVE', 'bar-chart-2',      'Fasce retributive'),
('bonus_plans',             'Bonus Plans',              '/admin/compensation/bonus-plans',  'COMPENSATION',  'ACTIVE', 'gift',             'Piani bonus'),
('benefits',                'Benefits',                 '/admin/compensation/benefits',     'COMPENSATION',  'ACTIVE', 'heart',            'Gestione benefit'),
-- Admin: Recruitment
('recruiting',              'Recruiting',               '/admin/recruiting',                'RECRUITMENT',   'ACTIVE', 'user-plus',        'Pipeline candidati'),
('requisitions',            'Requisitions',             '/admin/recruiting/requisitions',   'RECRUITMENT',   'ACTIVE', 'file-text',        'Requisizioni di personale'),
-- Admin: Learning
('training_catalog',        'Training Catalog',         '/admin/formazione',                'LEARNING',      'ACTIVE', 'book-open',        'Catalogo corsi'),
('knowledge_base',          'Knowledge Base',           '/admin/formazione/knowledge-base', 'LEARNING',      'ACTIVE', 'library',          'Base di conoscenza'),
-- Admin: Analytics
('analytics_dashboard',     'Analytics Dashboard',      '/admin/analytics',                 'ANALYTICS',     'ACTIVE', 'pie-chart',        'Report e analytics'),
('hr_intelligence',         'HR Intelligence',          '/admin/analytics/hr-intelligence', 'ANALYTICS',     'ACTIVE', 'brain',            'AI-powered HR insights'),
('predictions',             'Predictions',              '/admin/analytics/predictions',     'ANALYTICS',     'ACTIVE', 'trending-up',      'Modelli predittivi'),
-- Admin: Workforce Intelligence
('career_simulator',        'Career Simulator',         '/admin/analytics/workforce/career-simulator', 'WORKFORCE_INTELLIGENCE', 'ACTIVE', 'navigation', 'Simulatore carriera'),
('skill_galaxy',            'Skill Galaxy',             '/admin/analytics/workforce/skill-galaxy',     'WORKFORCE_INTELLIGENCE', 'ACTIVE', 'globe',      'Mappa interattiva competenze'),
('what_if',                 'What-If Scenarios',        '/admin/analytics/workforce/what-if',          'WORKFORCE_INTELLIGENCE', 'ACTIVE', 'git-merge',  'Scenari what-if'),
('org_dashboard_wi',        'Org Dashboard',            '/admin/analytics/workforce/org-dashboard',    'WORKFORCE_INTELLIGENCE', 'ACTIVE', 'layout',     'Dashboard organizzativa'),
-- Admin: Engagement
('engagement_surveys',      'Surveys',                  '/admin/engagement/surveys',        'ENGAGEMENT',    'ACTIVE', 'clipboard',        'Sondaggi engagement'),
('recognition_admin',       'Recognition',              '/admin/engagement/recognition',    'ENGAGEMENT',    'ACTIVE', 'award',            'Gestione riconoscimenti'),
-- Admin: Compliance
('audit_log',               'Audit Log',                '/admin/audit',                     'COMPLIANCE',    'ACTIVE', 'file-search',      'Log di audit'),
('compliance_dashboard',    'Compliance Dashboard',     '/admin/compliance',                'COMPLIANCE',    'ACTIVE', 'shield-check',     'Dashboard compliance'),
-- Admin: Settings/Security
('tenant_config',           'Tenant Configuration',     '/admin/impostazioni',              'SECURITY',      'ACTIVE', 'settings',         'SSO, API keys, integrazioni'),
('user_management',         'User Management',          '/admin/impostazioni/users',        'SECURITY',      'ACTIVE', 'user-cog',         'CRUD utenti, assegnazione ruoli'),
-- Admin: Teams
('team_management',         'Team Management',          '/admin/teams',                     'TEAMS',         'ACTIVE', 'users',            'Gestione team trasversali'),
-- Admin: AI
('ai_chat',                 'AI Chat',                  '/admin/ai/chat',                   'AI_SERVICES',   'ACTIVE', 'message-square',   'Assistente AI'),
-- Admin: Marketplace
('marketplace',             'Marketplace',              '/admin/marketplace',               'MARKETPLACE',   'ACTIVE', 'shopping-bag',     'Plugin e integrazioni'),
-- Company PET
('company_pet_overview',    'Company PET Overview',     '/company-pet',                     'COMPANY_ANALYTICS', 'ACTIVE', 'bar-chart-2', 'Hub analitico organizzativo'),
('company_pet_hierarchy',   'Organization Hierarchy',   '/company-pet/hierarchy',           'COMPANY_ANALYTICS', 'ACTIVE', 'git-branch',  'Gerarchia organizzativa'),
('company_pet_workforce',   'Workforce Analytics',      '/company-pet/workforce',           'COMPANY_ANALYTICS', 'ACTIVE', 'users',       'Analytics workforce'),
('company_pet_staging',     'Staging Comparison',       '/company-pet/staging-comparison',  'COMPANY_ANALYTICS', 'ACTIVE', 'columns',     'Confronto staging'),
-- Portal
('my_profile',              'My Profile',               '/portal/profilo',                  'SELF_SERVICE',  'ACTIVE', 'user',             'Profilo personale'),
('my_goals',                'My Goals',                 '/portal/obiettivi',                'SELF_SERVICE',  'ACTIVE', 'target',           'Obiettivi personali'),
('my_reviews',              'My Reviews',               '/portal/valutazioni',              'SELF_SERVICE',  'ACTIVE', 'clipboard-check',  'Valutazioni ricevute'),
('my_learning',             'My Learning',              '/portal/formazione',               'SELF_SERVICE',  'ACTIVE', 'book-open',        'Percorso formativo'),
('my_leave',                'My Time & Leave',          '/portal/presenze',                 'SELF_SERVICE',  'ACTIVE', 'calendar',         'Ferie e presenze'),
('my_documents',            'My Documents',             '/portal/documenti',                'SELF_SERVICE',  'ACTIVE', 'file',             'Documenti personali'),
('my_payslips',             'My Payslips',              '/portal/buste-paga',               'SELF_SERVICE',  'ACTIVE', 'credit-card',      'Buste paga'),
('my_line',                 'My Line',                  '/portal/la-mia-linea',             'SELF_SERVICE',  'ACTIVE', 'git-commit',       'Catena gerarchica (LINE_MANAGER)'),
('approvals',               'Approvals',                '/portal/approvazioni',             'SELF_SERVICE',  'ACTIVE', 'check-square',     'Approvazioni pending'),
('recognition_portal',      'Recognition',              '/portal/riconoscimenti',           'ENGAGEMENT',    'ACTIVE', 'award',            'Dare/ricevere riconoscimenti'),
('org_chart_readonly',      'Org Chart',                '/portal/organigramma',             'ORGANIZATION',  'ACTIVE', 'git-branch',       'Organigramma read-only'),
('team_map',                'Team Map',                 '/portal/team-map',                 'TEAMS',         'ACTIVE', 'map',              'Mappa team read-only');

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX idx_rbp_role_permissions_role    ON rbp_role_permissions(role_id);
CREATE INDEX idx_rbp_role_permissions_area    ON rbp_role_permissions(functional_area_id);
CREATE INDEX idx_rbp_nav_items_dashboard      ON rbp_dashboard_nav_items(dashboard_id, sort_order);
CREATE INDEX idx_rbp_pages_area              ON rbp_pages(functional_area_code);
CREATE INDEX idx_rbp_pages_status            ON rbp_pages(status);
CREATE INDEX idx_rbp_scope_rules_role        ON rbp_scope_rules(role_id);
CREATE INDEX idx_rbp_field_policies_role     ON rbp_field_policies(role_id);
CREATE INDEX idx_rbp_teams_tenant            ON rbp_teams(tenant_id);
CREATE INDEX idx_rbp_team_members_team       ON rbp_team_members(team_id);
CREATE INDEX idx_rbp_team_leaders_team       ON rbp_team_leaders(team_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION rbp_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rbp_roles_updated_at BEFORE UPDATE ON rbp_roles FOR EACH ROW EXECUTE FUNCTION rbp_set_updated_at();
CREATE TRIGGER trg_rbp_dashboards_updated_at BEFORE UPDATE ON rbp_dashboards FOR EACH ROW EXECUTE FUNCTION rbp_set_updated_at();
CREATE TRIGGER trg_rbp_pages_updated_at BEFORE UPDATE ON rbp_pages FOR EACH ROW EXECUTE FUNCTION rbp_set_updated_at();
CREATE TRIGGER trg_rbp_fa_updated_at BEFORE UPDATE ON rbp_functional_areas FOR EACH ROW EXECUTE FUNCTION rbp_set_updated_at();
CREATE TRIGGER trg_rbp_rp_updated_at BEFORE UPDATE ON rbp_role_permissions FOR EACH ROW EXECUTE FUNCTION rbp_set_updated_at();
CREATE TRIGGER trg_rbp_fp_updated_at BEFORE UPDATE ON rbp_field_policies FOR EACH ROW EXECUTE FUNCTION rbp_set_updated_at();

COMMIT;
