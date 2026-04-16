-- Company News Portal Schema
-- Migration: 053_company_news.sql
-- Date: 2025-12-27

-- News Categories
CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES news_categories(id) ON DELETE SET NULL,
  icon VARCHAR(50) DEFAULT 'folder',
  color VARCHAR(20) DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_category_slug UNIQUE (tenant_id, slug)
);

-- News Tags
CREATE TABLE IF NOT EXISTS news_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tag_slug UNIQUE (tenant_id, slug)
);

-- News Articles
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES news_categories(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  allow_comments BOOLEAN NOT NULL DEFAULT true,
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
  audience_type VARCHAR(20) NOT NULL DEFAULT 'all',
  audience_ids JSONB DEFAULT '[]',
  publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  CONSTRAINT valid_audience CHECK (audience_type IN ('all', 'department', 'location', 'org_unit')),
  CONSTRAINT unique_article_slug UNIQUE (tenant_id, slug)
);

-- News Article Tags (many-to-many)
CREATE TABLE IF NOT EXISTS news_article_tags (
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES news_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- News Reactions
CREATE TABLE IF NOT EXISTS news_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_reaction_type CHECK (type IN ('like', 'celebrate', 'support', 'insightful')),
  CONSTRAINT unique_user_reaction UNIQUE (article_id, user_id)
);

-- News Comments
CREATE TABLE IF NOT EXISTS news_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES news_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- News Reads (tracking who read what)
CREATE TABLE IF NOT EXISTS news_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  reading_time_seconds INTEGER DEFAULT 0,
  CONSTRAINT unique_user_read UNIQUE (article_id, user_id)
);

-- News Bookmarks
CREATE TABLE IF NOT EXISTS news_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_bookmark UNIQUE (article_id, user_id)
);

-- Indexes
CREATE INDEX idx_news_categories_tenant ON news_categories(tenant_id);
CREATE INDEX idx_news_categories_parent ON news_categories(parent_id);
CREATE INDEX idx_news_tags_tenant ON news_tags(tenant_id);
CREATE INDEX idx_news_articles_tenant ON news_articles(tenant_id);
CREATE INDEX idx_news_articles_category ON news_articles(category_id);
CREATE INDEX idx_news_articles_author ON news_articles(author_id);
CREATE INDEX idx_news_articles_status ON news_articles(tenant_id, status);
CREATE INDEX idx_news_articles_published ON news_articles(tenant_id, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_news_articles_featured ON news_articles(tenant_id, is_featured) WHERE status = 'published';
CREATE INDEX idx_news_reactions_article ON news_reactions(article_id);
CREATE INDEX idx_news_comments_article ON news_comments(article_id);
CREATE INDEX idx_news_reads_article ON news_reads(article_id);
CREATE INDEX idx_news_reads_user ON news_reads(user_id);
CREATE INDEX idx_news_bookmarks_user ON news_bookmarks(user_id);

-- Function to auto-update views count
CREATE OR REPLACE FUNCTION update_article_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE news_articles
  SET views_count = views_count + 1
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_views ON news_reads;
CREATE TRIGGER trg_update_views
AFTER INSERT ON news_reads
FOR EACH ROW EXECUTE FUNCTION update_article_views();

-- Function to auto-publish scheduled articles
CREATE OR REPLACE FUNCTION publish_scheduled_articles()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE news_articles
  SET
    status = 'published',
    published_at = NOW(),
    updated_at = NOW()
  WHERE status = 'scheduled' AND publish_at <= NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Seed default categories for all tenants
INSERT INTO news_categories (tenant_id, name, slug, description, icon, color, sort_order)
SELECT
  t.id,
  'Company Updates',
  'company-updates',
  'Official company announcements and updates',
  'building-2',
  '#3b82f6',
  1
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM news_categories nc
  WHERE nc.tenant_id = t.id AND nc.slug = 'company-updates'
);

INSERT INTO news_categories (tenant_id, name, slug, description, icon, color, sort_order)
SELECT
  t.id,
  'HR & Benefits',
  'hr-benefits',
  'Human resources policies and employee benefits',
  'heart',
  '#ec4899',
  2
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM news_categories nc
  WHERE nc.tenant_id = t.id AND nc.slug = 'hr-benefits'
);

INSERT INTO news_categories (tenant_id, name, slug, description, icon, color, sort_order)
SELECT
  t.id,
  'Events',
  'events',
  'Company events, celebrations, and team activities',
  'calendar',
  '#8b5cf6',
  3
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM news_categories nc
  WHERE nc.tenant_id = t.id AND nc.slug = 'events'
);

INSERT INTO news_categories (tenant_id, name, slug, description, icon, color, sort_order)
SELECT
  t.id,
  'Learning & Development',
  'learning-development',
  'Training opportunities and professional development',
  'graduation-cap',
  '#22c55e',
  4
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM news_categories nc
  WHERE nc.tenant_id = t.id AND nc.slug = 'learning-development'
);

INSERT INTO news_categories (tenant_id, name, slug, description, icon, color, sort_order)
SELECT
  t.id,
  'Spotlight',
  'spotlight',
  'Employee recognition and success stories',
  'star',
  '#f59e0b',
  5
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM news_categories nc
  WHERE nc.tenant_id = t.id AND nc.slug = 'spotlight'
);

