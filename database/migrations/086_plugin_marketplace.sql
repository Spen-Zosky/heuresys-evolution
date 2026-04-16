-- =============================================================================
-- Migration: 086_plugin_marketplace.sql
-- Description: Plugin Marketplace schema for Heuresys AI-Platform.
--              Creates tables for plugin catalog, versioning, per-tenant
--              installations, configuration, and user reviews.
-- Date: 2026-02-05
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. plugin_categories
--    Top-level categories for organizing plugins.
--    System-wide (no tenant_id) — shared across all tenants.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  parent_id UUID REFERENCES plugin_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_categories_slug ON plugin_categories(slug);
CREATE INDEX IF NOT EXISTS idx_plugin_categories_parent ON plugin_categories(parent_id);

-- ============================================================
-- 2. plugins
--    The marketplace catalog of available plugins.
--    System-wide — visible to all tenants.
--    publisher_tenant_id references the tenant that published it
--    (NULL for platform-provided plugins).
-- ============================================================

CREATE TABLE IF NOT EXISTS plugins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  short_description VARCHAR(500),
  description TEXT,
  category_id UUID REFERENCES plugin_categories(id),
  publisher_tenant_id UUID REFERENCES tenants(id),
  publisher_name VARCHAR(200),
  icon_url VARCHAR(500),
  homepage_url VARCHAR(500),
  repository_url VARCHAR(500),
  license VARCHAR(100) DEFAULT 'proprietary',
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'published', 'suspended', 'deprecated')),
  visibility VARCHAR(50) DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'unlisted')),
  pricing_model VARCHAR(50) DEFAULT 'free'
    CHECK (pricing_model IN ('free', 'freemium', 'paid', 'subscription', 'contact')),
  price_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  tags TEXT[] DEFAULT '{}',
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  total_installations INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugins_slug ON plugins(slug);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category_id);
CREATE INDEX IF NOT EXISTS idx_plugins_publisher_tenant ON plugins(publisher_tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_visibility ON plugins(visibility);
CREATE INDEX IF NOT EXISTS idx_plugins_featured ON plugins(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_plugins_tags ON plugins USING GIN(tags);

-- ============================================================
-- 3. plugin_versions
--    Version history for each plugin. Each plugin can have
--    multiple versions; only one is marked as latest.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  release_notes TEXT,
  changelog TEXT,
  min_platform_version VARCHAR(50),
  max_platform_version VARCHAR(50),
  config_schema JSONB DEFAULT '{}',
  permissions_required TEXT[] DEFAULT '{}',
  entry_point VARCHAR(500),
  package_url VARCHAR(500),
  package_size_bytes BIGINT,
  checksum VARCHAR(128),
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'yanked')),
  is_latest BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, version)
);

CREATE INDEX IF NOT EXISTS idx_plugin_versions_plugin ON plugin_versions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_latest ON plugin_versions(plugin_id) WHERE is_latest = TRUE;

-- ============================================================
-- 4. plugin_installations
--    Per-tenant plugin installations. Tracks which tenants
--    have installed which plugins and which version.
--    tenant_id is NOT NULL — strict tenant isolation.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_installations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  plugin_version_id UUID NOT NULL REFERENCES plugin_versions(id),
  installed_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'pending_update', 'error', 'uninstalling')),
  auto_update BOOLEAN DEFAULT TRUE,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT,
  UNIQUE(tenant_id, plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_plugin_installations_tenant ON plugin_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installations_plugin ON plugin_installations(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installations_status ON plugin_installations(status);

-- Enable RLS for tenant isolation
ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plugin_installations;
CREATE POLICY tenant_isolation ON plugin_installations
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- 5. plugin_configurations
--    Per-tenant plugin configuration. Stores tenant-specific
--    settings for each installed plugin as JSONB.
--    tenant_id is NOT NULL — strict tenant isolation.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plugin_installation_id UUID NOT NULL REFERENCES plugin_installations(id) ON DELETE CASCADE,
  config_data JSONB DEFAULT '{}',
  config_version INTEGER DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, plugin_installation_id)
);

CREATE INDEX IF NOT EXISTS idx_plugin_configurations_tenant ON plugin_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_installation ON plugin_configurations(plugin_installation_id);

-- Enable RLS for tenant isolation
ALTER TABLE plugin_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plugin_configurations;
CREATE POLICY tenant_isolation ON plugin_configurations
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- 6. plugin_reviews
--    User reviews and ratings for plugins.
--    tenant_id is NOT NULL — strict tenant isolation.
--    One review per user per plugin.
-- ============================================================

CREATE TABLE IF NOT EXISTS plugin_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(200),
  review_text TEXT,
  is_verified_install BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_plugin_reviews_tenant ON plugin_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_plugin ON plugin_reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_user ON plugin_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_rating ON plugin_reviews(plugin_id, rating);

-- Enable RLS for tenant isolation
ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plugin_reviews;
CREATE POLICY tenant_isolation ON plugin_reviews
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================
-- 7. Seed default plugin categories
-- ============================================================

INSERT INTO plugin_categories (name, slug, description, icon, sort_order) VALUES
  ('HR & People',       'hr-people',       'Human resources and people management plugins',  'users',          1),
  ('Analytics',         'analytics',       'Data analytics and reporting plugins',            'bar-chart-2',   2),
  ('AI & Automation',   'ai-automation',   'Artificial intelligence and workflow automation',  'brain',          3),
  ('Compliance',        'compliance',      'Regulatory compliance and audit tools',            'shield-check',  4),
  ('Integrations',      'integrations',    'Third-party system integrations',                  'plug',           5),
  ('Payroll & Finance', 'payroll-finance', 'Payroll processing and financial management',      'wallet',         6),
  ('Recruitment',       'recruitment',     'Hiring and talent acquisition tools',              'user-plus',      7),
  ('Learning',          'learning',        'Training and learning management plugins',         'graduation-cap', 8),
  ('Communication',     'communication',   'Internal communication and collaboration tools',   'message-circle', 9),
  ('Productivity',      'productivity',    'Productivity and workflow enhancement tools',       'zap',           10)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 8. Seed sample plugins (platform-provided)
-- ============================================================

INSERT INTO plugins (name, slug, short_description, description, category_id, publisher_name, license, status, visibility, pricing_model, featured, tags) VALUES
  (
    'Advanced Analytics Dashboard',
    'advanced-analytics-dashboard',
    'Enterprise-grade analytics with custom KPIs and drill-down reports',
    'Provides advanced analytics capabilities including custom KPI tracking, interactive drill-down reports, predictive analytics, and scheduled report delivery. Supports multiple visualization types and data export formats.',
    (SELECT id FROM plugin_categories WHERE slug = 'analytics'),
    'Heuresys',
    'proprietary',
    'published',
    'public',
    'free',
    TRUE,
    ARRAY['analytics', 'dashboard', 'kpi', 'reports']
  ),
  (
    'AI Talent Matcher',
    'ai-talent-matcher',
    'AI-powered talent matching and succession planning',
    'Uses machine learning to match employees to open positions, identify succession candidates, and recommend career development paths based on skills, experience, and organizational needs.',
    (SELECT id FROM plugin_categories WHERE slug = 'ai-automation'),
    'Heuresys',
    'proprietary',
    'published',
    'public',
    'freemium',
    TRUE,
    ARRAY['ai', 'talent', 'succession', 'matching']
  ),
  (
    'GDPR Compliance Toolkit',
    'gdpr-compliance-toolkit',
    'Automated GDPR compliance monitoring and data protection tools',
    'Comprehensive GDPR compliance solution including data mapping, consent management, breach notification workflows, data subject request handling, and automated compliance reporting.',
    (SELECT id FROM plugin_categories WHERE slug = 'compliance'),
    'Heuresys',
    'proprietary',
    'published',
    'public',
    'paid',
    FALSE,
    ARRAY['gdpr', 'compliance', 'privacy', 'data-protection']
  ),
  (
    'SAP SuccessFactors Connector',
    'sap-successfactors-connector',
    'Bidirectional sync with SAP SuccessFactors HCM suite',
    'Enables bidirectional data synchronization between Heuresys and SAP SuccessFactors, including employee records, organizational structure, time management, and payroll data.',
    (SELECT id FROM plugin_categories WHERE slug = 'integrations'),
    'Heuresys',
    'proprietary',
    'published',
    'public',
    'subscription',
    TRUE,
    ARRAY['sap', 'integration', 'sync', 'successfactors']
  ),
  (
    'Smart Onboarding Workflow',
    'smart-onboarding-workflow',
    'Automated onboarding checklists and task management',
    'Streamlines the employee onboarding process with customizable checklists, automated task assignments, progress tracking, and integration with IT provisioning and document management systems.',
    (SELECT id FROM plugin_categories WHERE slug = 'hr-people'),
    'Heuresys',
    'proprietary',
    'published',
    'public',
    'free',
    FALSE,
    ARRAY['onboarding', 'workflow', 'automation', 'checklists']
  ),
  (
    'Payroll Integration Hub',
    'payroll-integration-hub',
    'Multi-provider payroll processing and reconciliation',
    'Connects to multiple payroll providers for seamless payroll processing, automatic reconciliation, tax compliance, and financial reporting across different regions and currencies.',
    (SELECT id FROM plugin_categories WHERE slug = 'payroll-finance'),
    'Heuresys',
    'proprietary',
    'published',
    'public',
    'subscription',
    FALSE,
    ARRAY['payroll', 'finance', 'integration', 'reconciliation']
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 9. Seed initial versions for sample plugins
-- ============================================================

INSERT INTO plugin_versions (plugin_id, version, release_notes, config_schema, status, is_latest, published_at)
SELECT
  p.id,
  '1.0.0',
  'Initial release',
  '{"type": "object", "properties": {}}',
  'published',
  TRUE,
  NOW()
FROM plugins p
WHERE p.slug IN (
  'advanced-analytics-dashboard',
  'ai-talent-matcher',
  'gdpr-compliance-toolkit',
  'sap-successfactors-connector',
  'smart-onboarding-workflow',
  'payroll-integration-hub'
)
ON CONFLICT (plugin_id, version) DO NOTHING;

-- ============================================================
-- 10. Summary view: marketplace plugin listing
-- ============================================================

CREATE OR REPLACE VIEW v_marketplace_plugins AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.short_description,
  p.icon_url,
  pc.name AS category_name,
  pc.slug AS category_slug,
  pc.icon AS category_icon,
  p.publisher_name,
  p.status,
  p.visibility,
  p.pricing_model,
  p.price_cents,
  p.currency,
  p.tags,
  p.avg_rating,
  p.total_ratings,
  p.total_installations,
  p.featured,
  pv.version AS latest_version,
  pv.published_at AS latest_version_date,
  p.created_at,
  p.updated_at
FROM plugins p
LEFT JOIN plugin_categories pc ON pc.id = p.category_id
LEFT JOIN plugin_versions pv ON pv.plugin_id = p.id AND pv.is_latest = TRUE
WHERE p.status = 'published'
  AND p.visibility = 'public';

-- ============================================================
-- 11. Summary view: tenant plugin installations
-- ============================================================

CREATE OR REPLACE VIEW v_tenant_plugin_installations AS
SELECT
  pi.id AS installation_id,
  pi.tenant_id,
  pi.status AS installation_status,
  pi.auto_update,
  pi.installed_at,
  p.id AS plugin_id,
  p.name AS plugin_name,
  p.slug AS plugin_slug,
  p.short_description,
  p.icon_url,
  pc.name AS category_name,
  pc.slug AS category_slug,
  pv.version AS installed_version,
  pv.published_at AS version_date,
  latest_pv.version AS latest_available_version,
  CASE WHEN pv.id != latest_pv.id THEN TRUE ELSE FALSE END AS update_available
FROM plugin_installations pi
JOIN plugins p ON p.id = pi.plugin_id
LEFT JOIN plugin_categories pc ON pc.id = p.category_id
JOIN plugin_versions pv ON pv.id = pi.plugin_version_id
LEFT JOIN plugin_versions latest_pv ON latest_pv.plugin_id = p.id AND latest_pv.is_latest = TRUE;

COMMIT;
