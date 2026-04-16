-- ============================================================================
-- Migration: 008_hr_intelligence_fix.sql
-- Epic 8: HR Intelligence (Fixed version)
--
-- Tables for job market crawling, skill extraction, and benchmarking
-- Uses existing esco_skills table
-- ============================================================================

-- ============================================================================
-- Add missing columns to existing esco_skills table
-- ============================================================================

ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS alt_labels JSONB DEFAULT '[]';
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS broader_uri VARCHAR(500);
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS narrower_uris JSONB DEFAULT '[]';
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS related_uris JSONB DEFAULT '[]';
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS isco_groups JSONB DEFAULT '[]';
ALTER TABLE esco_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint on uri if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esco_skills_uri_key') THEN
        ALTER TABLE esco_skills ADD CONSTRAINT esco_skills_uri_key UNIQUE (uri);
    END IF;
END $$;

-- Create index on broader_uri
CREATE INDEX IF NOT EXISTS idx_esco_skills_broader ON esco_skills(broader_uri);

-- ============================================================================
-- Employee skill mappings to ESCO
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_skill_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    esco_skill_id UUID REFERENCES esco_skills(id),
    mapping_confidence DECIMAL(3,2), -- 0.00-1.00
    mapping_method VARCHAR(50), -- auto/manual/ai
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    years_experience DECIMAL(4,1),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, employee_id, original_text)
);

CREATE INDEX IF NOT EXISTS idx_employee_skill_mappings_tenant ON employee_skill_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_skill_mappings_employee ON employee_skill_mappings(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skill_mappings_esco ON employee_skill_mappings(esco_skill_id);

-- ============================================================================
-- Job Market Crawler Tables
-- ============================================================================

-- Crawler configurations
CREATE TABLE IF NOT EXISTS crawler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(100) NOT NULL, -- linkedin/indeed/glassdoor/other
    is_active BOOLEAN DEFAULT true,
    schedule_cron VARCHAR(100) DEFAULT '0 0 * * 0', -- Weekly by default
    search_criteria JSONB NOT NULL DEFAULT '{}',
    rate_limit_delay_ms INTEGER DEFAULT 5000,
    max_pages_per_run INTEGER DEFAULT 50,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),
    last_run_stats JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_configs_tenant ON crawler_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crawler_configs_source ON crawler_configs(source);

-- Crawl runs history
CREATE TABLE IF NOT EXISTS crawl_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_id UUID NOT NULL REFERENCES crawler_configs(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending/running/completed/failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    postings_found INTEGER DEFAULT 0,
    postings_saved INTEGER DEFAULT 0,
    skills_extracted INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_tenant ON crawl_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_config ON crawl_runs(config_id);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_status ON crawl_runs(status);

-- Job postings (raw crawled data)
CREATE TABLE IF NOT EXISTS job_postings_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    source_url TEXT NOT NULL,
    source_id VARCHAR(255),
    job_title TEXT NOT NULL,
    company_name TEXT,
    company_industry VARCHAR(100),
    ateco_code VARCHAR(20),
    location_city VARCHAR(255),
    location_region VARCHAR(255),
    location_country VARCHAR(100) DEFAULT 'IT',
    remote_type VARCHAR(50), -- onsite/hybrid/remote
    job_type VARCHAR(50), -- full-time/part-time/contract/internship
    experience_level VARCHAR(50), -- entry/mid/senior/executive
    salary_min DECIMAL(12,2),
    salary_max DECIMAL(12,2),
    salary_currency VARCHAR(10) DEFAULT 'EUR',
    salary_period VARCHAR(20) DEFAULT 'year',
    description_raw TEXT,
    requirements_raw TEXT,
    benefits_raw TEXT,
    skills_required JSONB DEFAULT '[]',
    skills_preferred JSONB DEFAULT '[]',
    posted_at DATE,
    expires_at DATE,
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, source, source_url)
);

CREATE INDEX IF NOT EXISTS idx_job_postings_raw_tenant ON job_postings_raw(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_raw_run ON job_postings_raw(crawl_run_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_raw_source ON job_postings_raw(source);
CREATE INDEX IF NOT EXISTS idx_job_postings_raw_ateco ON job_postings_raw(ateco_code);
CREATE INDEX IF NOT EXISTS idx_job_postings_raw_location ON job_postings_raw(location_city, location_region);
CREATE INDEX IF NOT EXISTS idx_job_postings_raw_title ON job_postings_raw USING gin(to_tsvector('english', job_title));

-- ============================================================================
-- Skill Extraction Tables
-- ============================================================================

-- Extracted skills (normalized)
CREATE TABLE IF NOT EXISTS extracted_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES job_postings_raw(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    esco_skill_id UUID REFERENCES esco_skills(id),
    mapping_confidence DECIMAL(3,2),
    is_required BOOLEAN DEFAULT true,
    mention_count INTEGER DEFAULT 1,
    context_snippet TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_skills_tenant ON extracted_skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extracted_skills_posting ON extracted_skills(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_extracted_skills_esco ON extracted_skills(esco_skill_id);

-- Skill synonyms and variations
CREATE TABLE IF NOT EXISTS skill_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_skill_id UUID NOT NULL REFERENCES esco_skills(id),
    synonym TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    source VARCHAR(50), -- manual/ai/esco
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(esco_skill_id, synonym, language)
);

CREATE INDEX IF NOT EXISTS idx_skill_synonyms_esco ON skill_synonyms(esco_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_synonyms_text ON skill_synonyms USING gin(to_tsvector('english', synonym));

-- Unknown skills for review
CREATE TABLE IF NOT EXISTS unknown_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    suggested_esco_id UUID REFERENCES esco_skills(id),
    suggested_confidence DECIMAL(3,2),
    review_status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    mapped_to_esco_id UUID REFERENCES esco_skills(id),
    UNIQUE(tenant_id, raw_text)
);

CREATE INDEX IF NOT EXISTS idx_unknown_skills_tenant ON unknown_skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unknown_skills_status ON unknown_skills(review_status);

-- ============================================================================
-- Analytics & Benchmarking Tables
-- ============================================================================

-- Skill demand aggregations
CREATE TABLE IF NOT EXISTS skill_demand_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    esco_skill_id UUID NOT NULL REFERENCES esco_skills(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_postings INTEGER DEFAULT 0,
    postings_required INTEGER DEFAULT 0,
    postings_preferred INTEGER DEFAULT 0,
    avg_salary_min DECIMAL(12,2),
    avg_salary_max DECIMAL(12,2),
    by_experience_level JSONB DEFAULT '{}',
    by_location JSONB DEFAULT '{}',
    by_industry JSONB DEFAULT '{}',
    trend_vs_previous DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, esco_skill_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_skill_demand_tenant ON skill_demand_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_demand_esco ON skill_demand_metrics(esco_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_demand_period ON skill_demand_metrics(period_start, period_end);

-- Internal skill supply
CREATE TABLE IF NOT EXISTS skill_supply_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    esco_skill_id UUID NOT NULL REFERENCES esco_skills(id),
    calculated_date DATE DEFAULT CURRENT_DATE,
    employee_count INTEGER DEFAULT 0,
    avg_proficiency DECIMAL(3,2),
    proficiency_distribution JSONB DEFAULT '{}',
    by_department JSONB DEFAULT '{}',
    by_tenure JSONB DEFAULT '{}',
    trend_vs_previous DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, esco_skill_id, calculated_date)
);

CREATE INDEX IF NOT EXISTS idx_skill_supply_tenant ON skill_supply_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_supply_esco ON skill_supply_metrics(esco_skill_id);

-- Skill gap analysis snapshots
CREATE TABLE IF NOT EXISTS skill_gap_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scope JSONB DEFAULT '{}',
    gap_metrics JSONB NOT NULL DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_gap_tenant ON skill_gap_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_gap_date ON skill_gap_snapshots(analysis_date);

-- Market benchmarks
CREATE TABLE IF NOT EXISTS market_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    benchmark_type VARCHAR(50) NOT NULL,
    segment JSONB NOT NULL DEFAULT '{}',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    sample_size INTEGER DEFAULT 0,
    confidence_level DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_benchmarks_tenant ON market_benchmarks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_market_benchmarks_type ON market_benchmarks(benchmark_type);
CREATE INDEX IF NOT EXISTS idx_market_benchmarks_period ON market_benchmarks(period_start, period_end);

-- ATECO industry classifications (Italian NACE)
CREATE TABLE IF NOT EXISTS ateco_codes (
    code VARCHAR(20) PRIMARY KEY,
    description_it TEXT NOT NULL,
    description_en TEXT,
    parent_code VARCHAR(20),
    level INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ateco_parent ON ateco_codes(parent_code);
CREATE INDEX IF NOT EXISTS idx_ateco_level ON ateco_codes(level);

-- ============================================================================
-- Enable Row-Level Security
-- ============================================================================

ALTER TABLE employee_skill_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE unknown_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_demand_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_supply_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gap_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_benchmarks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE employee_skill_mappings IS 'Employee skills mapped to ESCO taxonomy';
COMMENT ON TABLE crawler_configs IS 'Job market crawler configurations per tenant';
COMMENT ON TABLE crawl_runs IS 'History of crawler executions';
COMMENT ON TABLE job_postings_raw IS 'Raw job posting data from crawlers';
COMMENT ON TABLE extracted_skills IS 'Skills extracted from job postings';
COMMENT ON TABLE skill_synonyms IS 'Skill variations for extraction matching';
COMMENT ON TABLE unknown_skills IS 'Unrecognized skills pending review';
COMMENT ON TABLE skill_demand_metrics IS 'Aggregated market skill demand';
COMMENT ON TABLE skill_supply_metrics IS 'Aggregated internal skill supply';
COMMENT ON TABLE skill_gap_snapshots IS 'Skill gap analysis snapshots';
COMMENT ON TABLE market_benchmarks IS 'Market benchmark data';
COMMENT ON TABLE ateco_codes IS 'Italian ATECO industry classifications';
