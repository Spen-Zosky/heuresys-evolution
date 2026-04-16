-- ============================================================================
-- Migration: 008_hr_intelligence.sql
-- Epic 8: HR Intelligence
--
-- Tables for ESCO taxonomy, job market crawling, skill extraction, and benchmarking
-- ============================================================================

-- ============================================================================
-- ESCO Taxonomy Tables
-- ============================================================================

-- ESCO Skills cache (from EU ESCO API)
CREATE TABLE IF NOT EXISTS esco_skills (
    uri VARCHAR(500) PRIMARY KEY,
    preferred_label TEXT NOT NULL,
    alt_labels JSONB DEFAULT '[]',
    description TEXT,
    skill_type VARCHAR(50), -- skill/knowledge/competence
    broader_uri VARCHAR(500),
    narrower_uris JSONB DEFAULT '[]',
    related_uris JSONB DEFAULT '[]',
    isco_groups JSONB DEFAULT '[]', -- Related occupations
    reuse_level VARCHAR(20), -- transversal/cross-sector/sector-specific
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_esco_skills_label ON esco_skills USING gin(to_tsvector('english', preferred_label));
CREATE INDEX idx_esco_skills_type ON esco_skills(skill_type);
CREATE INDEX idx_esco_skills_broader ON esco_skills(broader_uri);

-- ESCO Occupations cache
CREATE TABLE IF NOT EXISTS esco_occupations (
    uri VARCHAR(500) PRIMARY KEY,
    preferred_label TEXT NOT NULL,
    alt_labels JSONB DEFAULT '[]',
    description TEXT,
    isco_code VARCHAR(10),
    broader_uri VARCHAR(500),
    narrower_uris JSONB DEFAULT '[]',
    essential_skills JSONB DEFAULT '[]',
    optional_skills JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_esco_occupations_label ON esco_occupations USING gin(to_tsvector('english', preferred_label));
CREATE INDEX idx_esco_occupations_isco ON esco_occupations(isco_code);

-- Employee skill mappings to ESCO
CREATE TABLE IF NOT EXISTS employee_skill_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    esco_uri VARCHAR(500) REFERENCES esco_skills(uri),
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

CREATE INDEX idx_employee_skill_mappings_tenant ON employee_skill_mappings(tenant_id);
CREATE INDEX idx_employee_skill_mappings_employee ON employee_skill_mappings(employee_id);
CREATE INDEX idx_employee_skill_mappings_esco ON employee_skill_mappings(esco_uri);

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
    -- search_criteria: {
    --   keywords: [],
    --   locations: [],
    --   industries: [], -- ATECO codes
    --   job_categories: [],
    --   experience_levels: [],
    --   salary_range: { min, max }
    -- }
    rate_limit_delay_ms INTEGER DEFAULT 5000,
    max_pages_per_run INTEGER DEFAULT 50,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),
    last_run_stats JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crawler_configs_tenant ON crawler_configs(tenant_id);
CREATE INDEX idx_crawler_configs_source ON crawler_configs(source);

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

CREATE INDEX idx_crawl_runs_tenant ON crawl_runs(tenant_id);
CREATE INDEX idx_crawl_runs_config ON crawl_runs(config_id);
CREATE INDEX idx_crawl_runs_status ON crawl_runs(status);

-- Job postings (raw crawled data)
CREATE TABLE IF NOT EXISTS job_postings_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    source_url TEXT NOT NULL,
    source_id VARCHAR(255), -- External ID from source
    job_title TEXT NOT NULL,
    company_name TEXT, -- Will be anonymized in aggregations
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
    salary_period VARCHAR(20) DEFAULT 'year', -- year/month/hour
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

CREATE INDEX idx_job_postings_raw_tenant ON job_postings_raw(tenant_id);
CREATE INDEX idx_job_postings_raw_run ON job_postings_raw(crawl_run_id);
CREATE INDEX idx_job_postings_raw_source ON job_postings_raw(source);
CREATE INDEX idx_job_postings_raw_ateco ON job_postings_raw(ateco_code);
CREATE INDEX idx_job_postings_raw_location ON job_postings_raw(location_city, location_region);
CREATE INDEX idx_job_postings_raw_title ON job_postings_raw USING gin(to_tsvector('english', job_title));

-- ============================================================================
-- Skill Extraction Tables
-- ============================================================================

-- Extracted skills (normalized)
CREATE TABLE IF NOT EXISTS extracted_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES job_postings_raw(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    esco_uri VARCHAR(500) REFERENCES esco_skills(uri),
    mapping_confidence DECIMAL(3,2),
    is_required BOOLEAN DEFAULT true, -- vs preferred
    mention_count INTEGER DEFAULT 1,
    context_snippet TEXT, -- Surrounding text
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extracted_skills_tenant ON extracted_skills(tenant_id);
CREATE INDEX idx_extracted_skills_posting ON extracted_skills(job_posting_id);
CREATE INDEX idx_extracted_skills_esco ON extracted_skills(esco_uri);

-- Skill synonyms and variations (for extraction)
CREATE TABLE IF NOT EXISTS skill_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_uri VARCHAR(500) NOT NULL REFERENCES esco_skills(uri),
    synonym TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    source VARCHAR(50), -- manual/ai/esco
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(esco_uri, synonym, language)
);

CREATE INDEX idx_skill_synonyms_esco ON skill_synonyms(esco_uri);
CREATE INDEX idx_skill_synonyms_text ON skill_synonyms USING gin(to_tsvector('english', synonym));

-- Unknown skills (for review)
CREATE TABLE IF NOT EXISTS unknown_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    suggested_esco_uri VARCHAR(500),
    suggested_confidence DECIMAL(3,2),
    review_status VARCHAR(50) DEFAULT 'pending', -- pending/mapped/ignored
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    mapped_to_esco_uri VARCHAR(500) REFERENCES esco_skills(uri),
    UNIQUE(tenant_id, raw_text)
);

CREATE INDEX idx_unknown_skills_tenant ON unknown_skills(tenant_id);
CREATE INDEX idx_unknown_skills_status ON unknown_skills(review_status);

-- ============================================================================
-- Analytics & Benchmarking Tables
-- ============================================================================

-- Skill demand aggregations (per-tenant, refreshed regularly)
CREATE TABLE IF NOT EXISTS skill_demand_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    esco_uri VARCHAR(500) NOT NULL REFERENCES esco_skills(uri),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_postings INTEGER DEFAULT 0,
    postings_required INTEGER DEFAULT 0, -- Where skill is required
    postings_preferred INTEGER DEFAULT 0, -- Where skill is preferred
    avg_salary_min DECIMAL(12,2),
    avg_salary_max DECIMAL(12,2),
    by_experience_level JSONB DEFAULT '{}', -- { entry: 10, mid: 25, senior: 15 }
    by_location JSONB DEFAULT '{}', -- { Milano: 30, Roma: 20, ... }
    by_industry JSONB DEFAULT '{}', -- { ateco_code: count, ... }
    trend_vs_previous DECIMAL(5,2), -- % change vs previous period
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, esco_uri, period_start, period_end)
);

CREATE INDEX idx_skill_demand_tenant ON skill_demand_metrics(tenant_id);
CREATE INDEX idx_skill_demand_esco ON skill_demand_metrics(esco_uri);
CREATE INDEX idx_skill_demand_period ON skill_demand_metrics(period_start, period_end);

-- Internal skill supply (employee skills aggregated)
CREATE TABLE IF NOT EXISTS skill_supply_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    esco_uri VARCHAR(500) NOT NULL REFERENCES esco_skills(uri),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    employee_count INTEGER DEFAULT 0,
    avg_proficiency DECIMAL(3,2),
    proficiency_distribution JSONB DEFAULT '{}', -- { 1: 5, 2: 10, 3: 15, 4: 8, 5: 2 }
    by_department JSONB DEFAULT '{}', -- { dept_id: count, ... }
    by_tenure JSONB DEFAULT '{}', -- { '<1yr': 5, '1-3yr': 10, ... }
    trend_vs_previous DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, esco_uri, calculated_at::date)
);

CREATE INDEX idx_skill_supply_tenant ON skill_supply_metrics(tenant_id);
CREATE INDEX idx_skill_supply_esco ON skill_supply_metrics(esco_uri);

-- Skill gap analysis snapshots
CREATE TABLE IF NOT EXISTS skill_gap_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scope JSONB DEFAULT '{}', -- { departments: [], job_families: [] }
    gap_metrics JSONB NOT NULL DEFAULT '{}',
    -- gap_metrics: {
    --   critical_gaps: [{ esco_uri, demand, supply, gap_score }],
    --   emerging_skills: [{ esco_uri, growth_rate, demand }],
    --   declining_skills: [{ esco_uri, decline_rate }],
    --   well_covered: [{ esco_uri, supply, demand }]
    -- }
    recommendations JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skill_gap_tenant ON skill_gap_snapshots(tenant_id);
CREATE INDEX idx_skill_gap_date ON skill_gap_snapshots(analysis_date);

-- Market benchmarks (aggregated, anonymized)
CREATE TABLE IF NOT EXISTS market_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    benchmark_type VARCHAR(50) NOT NULL, -- salary/skill/workforce
    segment JSONB NOT NULL DEFAULT '{}', -- { industry, location, job_family }
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    -- For salary: { p25, p50, p75, avg, sample_size }
    -- For skill: { coverage_pct, depth_score, demand_trend }
    -- For workforce: { avg_headcount, turnover_rate, hiring_velocity }
    sample_size INTEGER DEFAULT 0,
    confidence_level DECIMAL(3,2), -- Statistical confidence
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, benchmark_type, segment::text, period_start, period_end)
);

CREATE INDEX idx_market_benchmarks_tenant ON market_benchmarks(tenant_id);
CREATE INDEX idx_market_benchmarks_type ON market_benchmarks(benchmark_type);
CREATE INDEX idx_market_benchmarks_period ON market_benchmarks(period_start, period_end);

-- ATECO industry classifications (Italian NACE equivalent)
CREATE TABLE IF NOT EXISTS ateco_codes (
    code VARCHAR(20) PRIMARY KEY,
    description_it TEXT NOT NULL,
    description_en TEXT,
    parent_code VARCHAR(20),
    level INTEGER NOT NULL, -- 1-6 (section to class)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ateco_parent ON ateco_codes(parent_code);
CREATE INDEX idx_ateco_level ON ateco_codes(level);

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

COMMENT ON TABLE esco_skills IS 'Cache of ESCO skills taxonomy from EU API';
COMMENT ON TABLE esco_occupations IS 'Cache of ESCO occupations from EU API';
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
