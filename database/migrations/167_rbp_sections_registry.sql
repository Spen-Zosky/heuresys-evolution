-- ============================================================================
-- Migration 167: RBP Sections Registry
-- ============================================================================
-- P9 reinforcement: sidebar section order, label and icon MUST come from DB,
-- not hardcoded TypeScript arrays. This table is the single source of truth
-- for section metadata used by rbp_dashboard_nav_items.section.
--
-- Supports multi-level scope (P10): NULL tenant_id = platform default,
-- specific tenant_id = tenant override.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rbp_sections (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code        VARCHAR(50)  NOT NULL,
    label_it    VARCHAR(100) NOT NULL,
    label_en    VARCHAR(100),
    sort_order  INTEGER      NOT NULL,
    icon        VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

COMMENT ON TABLE rbp_sections IS
  'Data-driven registry of sidebar navigation sections. Platform defaults (tenant_id NULL) with optional tenant overrides.';

CREATE INDEX IF NOT EXISTS idx_rbp_sections_tenant
  ON rbp_sections (tenant_id, sort_order);

-- ----------------------------------------------------------------------------
-- Seed platform defaults (tenant_id = NULL)
-- Sort order reflects the mockup: portal sections first, then admin/platform
-- ----------------------------------------------------------------------------
INSERT INTO rbp_sections (tenant_id, code, label_it, label_en, sort_order, icon) VALUES
    -- Portal sections
    (NULL, 'main',         'Principale',     'Main',          10, 'Home'),
    (NULL, 'career',       'Carriera',       'Career',        20, 'Briefcase'),
    (NULL, 'docs',         'Documenti',      'Documents',     30, 'FileText'),
    (NULL, 'actions',      'Azioni',         'Actions',       40, 'CheckSquare'),
    (NULL, 'explore',      'Esplora',        'Explore',       50, 'Compass'),
    (NULL, 'perspectives', 'Prospettive',    'Perspectives',  60, 'Eye'),
    (NULL, 'tools',        'Strumenti',      'Tools',         70, 'Wrench'),
    (NULL, 'self',         'Profilo',        'Profile',       80, 'User'),
    -- Admin / platform sections
    (NULL, 'overview',     'Panoramica',     'Overview',     100, 'LayoutDashboard'),
    (NULL, 'hr',           'Risorse Umane',  'Human Resources', 110, 'Users'),
    (NULL, 'talent',       'Talento',        'Talent',       120, 'Star'),
    (NULL, 'performance',  'Prestazioni',    'Performance',  130, 'TrendingUp'),
    (NULL, 'learning',     'Formazione',     'Learning',     140, 'GraduationCap'),
    (NULL, 'operations',   'Operazioni',     'Operations',   150, 'Cog'),
    (NULL, 'management',   'Gestione',       'Management',   160, 'Shield'),
    (NULL, 'analytics',    'Analisi',        'Analytics',    170, 'BarChart3'),
    (NULL, 'intelligence', 'Intelligence',   'Intelligence', 180, 'Brain'),
    (NULL, 'dashboards',   'Dashboard',      'Dashboards',   190, 'Grid3x3'),
    (NULL, 'config',       'Configurazione', 'Configuration', 200, 'Settings'),
    (NULL, 'platform',     'Piattaforma',    'Platform',     210, 'Server'),
    (NULL, 'portal',       'Portale',        'Portal',       220, 'Globe'),
    (NULL, 'general',      'Generale',       'General',      999, 'Folder')
ON CONFLICT (tenant_id, code) DO UPDATE SET
    label_it   = EXCLUDED.label_it,
    label_en   = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    icon       = EXCLUDED.icon,
    updated_at = NOW();

COMMIT;
