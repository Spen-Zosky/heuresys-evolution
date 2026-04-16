-- =============================================================================
-- Migration: 010_hr_intelligence.sql
-- Epic 8: HR Intelligence
-- Stories: 8.1-8.5
-- =============================================================================

-- =============================================================================
-- STORY 8.1: ESCO SKILL TAXONOMY INTEGRATION
-- =============================================================================

-- ESCO Skills Taxonomy Cache
CREATE TABLE IF NOT EXISTS esco_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_uri VARCHAR(500) UNIQUE NOT NULL,
    concept_type VARCHAR(50) NOT NULL, -- skill, knowledge, competence
    preferred_label VARCHAR(500) NOT NULL,
    alt_labels JSONB DEFAULT '[]',
    description TEXT,
    skill_type VARCHAR(100), -- skill/competence, knowledge, language, transversal
    reuse_level VARCHAR(50), -- sector-specific, occupation-specific, cross-sector, transversal
    isco_groups JSONB DEFAULT '[]', -- Related ISCO occupation groups
    broader_skills JSONB DEFAULT '[]', -- Parent skills URIs
    narrower_skills JSONB DEFAULT '[]', -- Child skills URIs
    essential_for_occupations JSONB DEFAULT '[]',
    optional_for_occupations JSONB DEFAULT '[]',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_esco_skills_type ON esco_skills(skill_type);
CREATE INDEX idx_esco_skills_concept ON esco_skills(concept_type);
CREATE INDEX idx_esco_skills_label ON esco_skills USING gin(to_tsvector('english', preferred_label));
CREATE INDEX idx_esco_skills_alt_labels ON esco_skills USING gin(alt_labels);

-- ESCO Occupations Cache
CREATE TABLE IF NOT EXISTS esco_occupations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_uri VARCHAR(500) UNIQUE NOT NULL,
    preferred_label VARCHAR(500) NOT NULL,
    alt_labels JSONB DEFAULT '[]',
    description TEXT,
    isco_group VARCHAR(20),
    isco_code VARCHAR(10),
    broader_occupations JSONB DEFAULT '[]',
    narrower_occupations JSONB DEFAULT '[]',
    essential_skills JSONB DEFAULT '[]', -- URIs of essential skills
    optional_skills JSONB DEFAULT '[]', -- URIs of optional skills
    regulated_profession_note TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_esco_occupations_isco ON esco_occupations(isco_code);
CREATE INDEX idx_esco_occupations_label ON esco_occupations USING gin(to_tsvector('english', preferred_label));

-- Employee Skills (mapped to ESCO)
CREATE TABLE IF NOT EXISTS employee_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    esco_skill_id UUID REFERENCES esco_skills(id),
    custom_skill_name VARCHAR(255), -- For non-ESCO skills
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5), -- 1=Basic, 5=Expert
    proficiency_label VARCHAR(50), -- beginner, intermediate, advanced, expert, master
    years_experience DECIMAL(4,1),
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50) DEFAULT 'self_assessment', -- self_assessment, manager_assessment, certification, ai_inferred
    confidence_score DECIMAL(3,2), -- AI confidence for inferred skills
    last_used_at DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_skill_source CHECK (esco_skill_id IS NOT NULL OR custom_skill_name IS NOT NULL)
);

CREATE INDEX idx_employee_skills_tenant ON employee_skills(tenant_id);
CREATE INDEX idx_employee_skills_employee ON employee_skills(employee_id);
CREATE INDEX idx_employee_skills_esco ON employee_skills(esco_skill_id);
CREATE INDEX idx_employee_skills_proficiency ON employee_skills(proficiency_level);

-- Enable RLS
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_skills_tenant_isolation ON employee_skills
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Job Position Skills Requirements
CREATE TABLE IF NOT EXISTS position_skill_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    position_id UUID NOT NULL, -- References job_positions or similar
    position_name VARCHAR(255) NOT NULL,
    esco_skill_id UUID REFERENCES esco_skills(id),
    custom_skill_name VARCHAR(255),
    requirement_type VARCHAR(20) DEFAULT 'essential', -- essential, optional, nice_to_have
    minimum_proficiency INTEGER CHECK (minimum_proficiency BETWEEN 1 AND 5),
    weight DECIMAL(3,2) DEFAULT 1.0, -- Importance weight for matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_position_skill_source CHECK (esco_skill_id IS NOT NULL OR custom_skill_name IS NOT NULL)
);

CREATE INDEX idx_position_skills_tenant ON position_skill_requirements(tenant_id);
CREATE INDEX idx_position_skills_position ON position_skill_requirements(position_id);

ALTER TABLE position_skill_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY position_skills_tenant_isolation ON position_skill_requirements
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- STORY 8.2: JOB MARKET DATA CRAWLER
-- =============================================================================

-- Job Market Data Sources
CREATE TABLE IF NOT EXISTS job_market_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- api, scraper, manual
    source_url VARCHAR(500),
    api_config JSONB,
    scraper_config JSONB,
    is_active BOOLEAN DEFAULT true,
    crawl_frequency_hours INTEGER DEFAULT 24,
    last_crawl_at TIMESTAMP WITH TIME ZONE,
    next_crawl_at TIMESTAMP WITH TIME ZONE,
    total_jobs_collected INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Market Postings (crawled data)
CREATE TABLE IF NOT EXISTS job_market_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES job_market_sources(id),
    external_id VARCHAR(255),
    job_title VARCHAR(500) NOT NULL,
    company_name VARCHAR(255),
    company_size VARCHAR(50), -- startup, small, medium, large, enterprise
    location VARCHAR(255),
    location_type VARCHAR(50), -- remote, hybrid, onsite
    country_code VARCHAR(3),
    region VARCHAR(100),
    job_description TEXT,
    salary_min DECIMAL(12,2),
    salary_max DECIMAL(12,2),
    salary_currency VARCHAR(3) DEFAULT 'EUR',
    salary_period VARCHAR(20) DEFAULT 'yearly', -- yearly, monthly, hourly
    employment_type VARCHAR(50), -- full_time, part_time, contract, internship
    experience_level VARCHAR(50), -- entry, junior, mid, senior, lead, executive
    experience_years_min INTEGER,
    experience_years_max INTEGER,
    education_level VARCHAR(100),
    industry VARCHAR(100),
    nace_code VARCHAR(10),
    isco_code VARCHAR(10),
    extracted_skills JSONB DEFAULT '[]', -- Raw skills extracted
    mapped_esco_skills JSONB DEFAULT '[]', -- Mapped to ESCO URIs
    posting_date DATE,
    expiry_date DATE,
    source_url VARCHAR(1000),
    is_active BOOLEAN DEFAULT true,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_id, external_id)
);

CREATE INDEX idx_job_postings_title ON job_market_postings USING gin(to_tsvector('english', job_title));
CREATE INDEX idx_job_postings_location ON job_market_postings(country_code, region);
CREATE INDEX idx_job_postings_salary ON job_market_postings(salary_min, salary_max);
CREATE INDEX idx_job_postings_date ON job_market_postings(posting_date);
CREATE INDEX idx_job_postings_industry ON job_market_postings(industry);
CREATE INDEX idx_job_postings_isco ON job_market_postings(isco_code);
CREATE INDEX idx_job_postings_skills ON job_market_postings USING gin(mapped_esco_skills);

-- Job Market Statistics (aggregated)
CREATE TABLE IF NOT EXISTS job_market_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL,
    stat_period VARCHAR(20) DEFAULT 'daily', -- daily, weekly, monthly
    country_code VARCHAR(3),
    region VARCHAR(100),
    industry VARCHAR(100),
    isco_code VARCHAR(10),
    total_postings INTEGER DEFAULT 0,
    avg_salary_min DECIMAL(12,2),
    avg_salary_max DECIMAL(12,2),
    median_salary DECIMAL(12,2),
    top_skills JSONB DEFAULT '[]', -- [{skill_uri, count, percentage}]
    top_companies JSONB DEFAULT '[]',
    experience_distribution JSONB DEFAULT '{}', -- {entry: 10, junior: 20, ...}
    employment_type_distribution JSONB DEFAULT '{}',
    remote_percentage DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stat_date, stat_period, country_code, region, industry, isco_code)
);

CREATE INDEX idx_job_stats_date ON job_market_statistics(stat_date);
CREATE INDEX idx_job_stats_location ON job_market_statistics(country_code, region);

-- =============================================================================
-- STORY 8.3: SKILL EXTRACTION & NORMALIZATION
-- =============================================================================

-- Skill Synonyms & Aliases
CREATE TABLE IF NOT EXISTS skill_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esco_skill_id UUID REFERENCES esco_skills(id),
    alias_text VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50) DEFAULT 'synonym', -- synonym, abbreviation, variation, translation
    language_code VARCHAR(5) DEFAULT 'en',
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    source VARCHAR(50) DEFAULT 'manual', -- manual, ai_generated, community
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_skill_aliases_text ON skill_aliases USING gin(to_tsvector('english', alias_text));
CREATE INDEX idx_skill_aliases_esco ON skill_aliases(esco_skill_id);

-- Skill Extraction Jobs
CREATE TABLE IF NOT EXISTS skill_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- resume, job_description, profile, document
    source_type VARCHAR(50) NOT NULL, -- file, text, url
    source_reference VARCHAR(500), -- File path or URL
    source_text TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    extracted_skills JSONB DEFAULT '[]', -- Raw extracted skills
    mapped_skills JSONB DEFAULT '[]', -- Mapped to ESCO
    unmapped_skills JSONB DEFAULT '[]', -- Skills that couldn't be mapped
    extraction_model VARCHAR(100),
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_skill_extraction_tenant ON skill_extraction_jobs(tenant_id);
CREATE INDEX idx_skill_extraction_status ON skill_extraction_jobs(status);

ALTER TABLE skill_extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY skill_extraction_tenant_isolation ON skill_extraction_jobs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- STORY 8.4: SKILL GAP ANALYSIS
-- =============================================================================

-- Skill Gap Analysis Reports
CREATE TABLE IF NOT EXISTS skill_gap_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    analysis_name VARCHAR(255) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL, -- individual, team, department, organization
    target_entity_type VARCHAR(50), -- employee, team, department
    target_entity_id UUID,
    target_position_id UUID,
    target_position_name VARCHAR(255),
    comparison_type VARCHAR(50), -- position_requirements, market_benchmark, custom
    analysis_date DATE DEFAULT CURRENT_DATE,

    -- Results
    overall_match_score DECIMAL(5,2), -- 0-100
    coverage_score DECIMAL(5,2), -- % of required skills covered
    proficiency_score DECIMAL(5,2), -- Avg proficiency vs required

    skill_matches JSONB DEFAULT '[]', -- Skills that match requirements
    skill_gaps JSONB DEFAULT '[]', -- Missing or below-required skills
    skill_surplus JSONB DEFAULT '[]', -- Skills above requirements

    recommendations JSONB DEFAULT '[]', -- Training/development recommendations
    priority_skills JSONB DEFAULT '[]', -- Top priority skills to develop

    -- Benchmarks
    market_comparison JSONB, -- How this compares to market
    internal_comparison JSONB, -- How this compares internally

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_skill_gap_tenant ON skill_gap_analyses(tenant_id);
CREATE INDEX idx_skill_gap_entity ON skill_gap_analyses(target_entity_type, target_entity_id);
CREATE INDEX idx_skill_gap_date ON skill_gap_analyses(analysis_date);

ALTER TABLE skill_gap_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY skill_gap_tenant_isolation ON skill_gap_analyses
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Team/Department Skill Matrices
CREATE TABLE IF NOT EXISTS skill_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    matrix_name VARCHAR(255) NOT NULL,
    matrix_type VARCHAR(50) NOT NULL, -- team, department, organization
    entity_type VARCHAR(50),
    entity_id UUID,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Aggregated data
    total_employees INTEGER,
    total_skills INTEGER,
    skill_coverage JSONB DEFAULT '{}', -- {skill_uri: {count, avg_proficiency, max_proficiency}}
    skill_distribution JSONB DEFAULT '{}', -- Distribution by proficiency level
    skill_trends JSONB DEFAULT '[]', -- Changes over time

    top_skills JSONB DEFAULT '[]', -- Most common skills
    rare_skills JSONB DEFAULT '[]', -- Unique/rare skills
    critical_gaps JSONB DEFAULT '[]', -- Skills needed but missing

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_skill_matrix_tenant ON skill_matrices(tenant_id);
CREATE INDEX idx_skill_matrix_entity ON skill_matrices(entity_type, entity_id);

ALTER TABLE skill_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY skill_matrix_tenant_isolation ON skill_matrices
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- STORY 8.5: MARKET BENCHMARK DASHBOARD
-- =============================================================================

-- Benchmark Configurations
CREATE TABLE IF NOT EXISTS benchmark_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL,
    benchmark_type VARCHAR(50) NOT NULL, -- salary, skills, demand

    -- Filters
    industries JSONB DEFAULT '[]',
    countries JSONB DEFAULT '[]',
    regions JSONB DEFAULT '[]',
    company_sizes JSONB DEFAULT '[]',
    experience_levels JSONB DEFAULT '[]',
    isco_codes JSONB DEFAULT '[]',

    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_benchmark_config_tenant ON benchmark_configs(tenant_id);

ALTER TABLE benchmark_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY benchmark_config_tenant_isolation ON benchmark_configs
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Benchmark Reports
CREATE TABLE IF NOT EXISTS benchmark_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_id UUID REFERENCES benchmark_configs(id),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- salary_benchmark, skill_demand, talent_availability
    report_date DATE DEFAULT CURRENT_DATE,

    -- Salary Benchmarks
    salary_benchmarks JSONB DEFAULT '{}', -- By role/level
    salary_percentiles JSONB DEFAULT '{}', -- p25, p50, p75, p90
    salary_trends JSONB DEFAULT '[]', -- Historical trend

    -- Skill Demand
    trending_skills JSONB DEFAULT '[]', -- Skills with increasing demand
    declining_skills JSONB DEFAULT '[]', -- Skills with decreasing demand
    emerging_skills JSONB DEFAULT '[]', -- New skills appearing
    skill_demand_scores JSONB DEFAULT '{}', -- Demand score by skill

    -- Talent Availability
    talent_supply JSONB DEFAULT '{}', -- Available talent by skill
    competition_index JSONB DEFAULT '{}', -- Competition for skills
    time_to_hire_estimates JSONB DEFAULT '{}',

    -- Comparisons
    internal_vs_market JSONB DEFAULT '{}', -- How tenant compares
    recommendations JSONB DEFAULT '[]',

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_benchmark_report_tenant ON benchmark_reports(tenant_id);
CREATE INDEX idx_benchmark_report_date ON benchmark_reports(report_date);
CREATE INDEX idx_benchmark_report_type ON benchmark_reports(report_type);

ALTER TABLE benchmark_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY benchmark_report_tenant_isolation ON benchmark_reports
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- INITIAL DATA: Job Market Sources
-- =============================================================================

INSERT INTO job_market_sources (source_name, source_type, source_url, is_active, crawl_frequency_hours) VALUES
('LinkedIn Jobs API', 'api', 'https://api.linkedin.com/v2/jobs', false, 24),
('Indeed Scraper', 'scraper', 'https://it.indeed.com', false, 12),
('InfoJobs API', 'api', 'https://api.infojobs.it', false, 24),
('Monster Scraper', 'scraper', 'https://www.monster.it', false, 24),
('Glassdoor Scraper', 'scraper', 'https://www.glassdoor.it', false, 48),
('Manual Import', 'manual', NULL, true, NULL);

-- =============================================================================
-- INITIAL DATA: Default Benchmark Configs
-- =============================================================================

INSERT INTO benchmark_configs (tenant_id, config_name, benchmark_type, industries, countries, is_default) VALUES
(NULL, 'Italy Tech Sector', 'salary', '["J - Information and communication"]', '["IT"]', true),
(NULL, 'Italy Finance Sector', 'salary', '["K - Financial and insurance activities"]', '["IT"]', false),
(NULL, 'EU Tech Skills', 'skills', '["J - Information and communication"]', '["IT", "DE", "FR", "ES", "NL"]', true),
(NULL, 'Global Remote Tech', 'demand', '["J - Information and communication"]', '[]', false);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to calculate skill match score
CREATE OR REPLACE FUNCTION calculate_skill_match_score(
    p_employee_id UUID,
    p_position_id UUID,
    p_tenant_id UUID
) RETURNS TABLE (
    overall_score DECIMAL(5,2),
    coverage_score DECIMAL(5,2),
    proficiency_score DECIMAL(5,2),
    matched_skills JSONB,
    gap_skills JSONB
) AS $$
DECLARE
    v_required_skills JSONB;
    v_employee_skills JSONB;
    v_matched JSONB := '[]';
    v_gaps JSONB := '[]';
    v_total_required INTEGER;
    v_total_matched INTEGER := 0;
    v_proficiency_sum DECIMAL := 0;
    v_proficiency_count INTEGER := 0;
BEGIN
    -- Get required skills for position
    SELECT jsonb_agg(jsonb_build_object(
        'skill_id', COALESCE(esco_skill_id::text, custom_skill_name),
        'min_proficiency', minimum_proficiency,
        'requirement_type', requirement_type,
        'weight', weight
    ))
    INTO v_required_skills
    FROM position_skill_requirements
    WHERE position_id = p_position_id AND tenant_id = p_tenant_id;

    -- Get employee skills
    SELECT jsonb_agg(jsonb_build_object(
        'skill_id', COALESCE(esco_skill_id::text, custom_skill_name),
        'proficiency', proficiency_level
    ))
    INTO v_employee_skills
    FROM employee_skills
    WHERE employee_id = p_employee_id AND tenant_id = p_tenant_id;

    v_total_required := jsonb_array_length(COALESCE(v_required_skills, '[]'));

    IF v_total_required = 0 THEN
        RETURN QUERY SELECT 100.0::DECIMAL(5,2), 100.0::DECIMAL(5,2), 100.0::DECIMAL(5,2), '[]'::JSONB, '[]'::JSONB;
        RETURN;
    END IF;

    -- Calculate matches and gaps
    -- (Simplified - full implementation would iterate through skills)

    overall_score := 75.0; -- Placeholder
    coverage_score := 80.0;
    proficiency_score := 70.0;
    matched_skills := v_matched;
    gap_skills := v_gaps;

    RETURN QUERY SELECT overall_score, coverage_score, proficiency_score, matched_skills, gap_skills;
END;
$$ LANGUAGE plpgsql;

-- Function to get trending skills
CREATE OR REPLACE FUNCTION get_trending_skills(
    p_country_code VARCHAR(3) DEFAULT NULL,
    p_industry VARCHAR(100) DEFAULT NULL,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    skill_uri VARCHAR(500),
    skill_name VARCHAR(500),
    current_demand INTEGER,
    previous_demand INTEGER,
    growth_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT
            unnest(mapped_esco_skills::text[]) as skill,
            COUNT(*) as cnt
        FROM job_market_postings
        WHERE posting_date >= CURRENT_DATE - p_days
          AND (p_country_code IS NULL OR country_code = p_country_code)
          AND (p_industry IS NULL OR industry = p_industry)
        GROUP BY skill
    ),
    previous_period AS (
        SELECT
            unnest(mapped_esco_skills::text[]) as skill,
            COUNT(*) as cnt
        FROM job_market_postings
        WHERE posting_date >= CURRENT_DATE - (p_days * 2)
          AND posting_date < CURRENT_DATE - p_days
          AND (p_country_code IS NULL OR country_code = p_country_code)
          AND (p_industry IS NULL OR industry = p_industry)
        GROUP BY skill
    )
    SELECT
        c.skill::VARCHAR(500),
        COALESCE(es.preferred_label, c.skill)::VARCHAR(500),
        c.cnt::INTEGER,
        COALESCE(p.cnt, 0)::INTEGER,
        CASE
            WHEN COALESCE(p.cnt, 0) = 0 THEN 100.0
            ELSE ((c.cnt - COALESCE(p.cnt, 0))::DECIMAL / p.cnt * 100)
        END::DECIMAL(5,2)
    FROM current_period c
    LEFT JOIN previous_period p ON c.skill = p.skill
    LEFT JOIN esco_skills es ON es.esco_uri = c.skill
    ORDER BY
        CASE
            WHEN COALESCE(p.cnt, 0) = 0 THEN 100.0
            ELSE ((c.cnt - COALESCE(p.cnt, 0))::DECIMAL / p.cnt * 100)
        END DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Employee Skills Summary
CREATE OR REPLACE VIEW v_employee_skills_summary AS
SELECT
    es.tenant_id,
    es.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    COUNT(*) as total_skills,
    COUNT(CASE WHEN es.proficiency_level >= 4 THEN 1 END) as expert_skills,
    COUNT(CASE WHEN es.is_verified THEN 1 END) as verified_skills,
    AVG(es.proficiency_level)::DECIMAL(3,2) as avg_proficiency,
    array_agg(DISTINCT COALESCE(esco.skill_type, 'custom')) as skill_types
FROM employee_skills es
JOIN employees e ON es.employee_id = e.id
LEFT JOIN esco_skills esco ON es.esco_skill_id = esco.id
GROUP BY es.tenant_id, es.employee_id, e.first_name, e.last_name;

-- View: Market Skill Demand
CREATE OR REPLACE VIEW v_market_skill_demand AS
SELECT
    es.esco_uri,
    es.preferred_label as skill_name,
    es.skill_type,
    COUNT(DISTINCT jmp.id) as job_postings_count,
    AVG(jmp.salary_min) as avg_salary_min,
    AVG(jmp.salary_max) as avg_salary_max,
    mode() WITHIN GROUP (ORDER BY jmp.experience_level) as typical_experience_level
FROM esco_skills es
JOIN job_market_postings jmp ON jmp.mapped_esco_skills ? es.esco_uri
WHERE jmp.is_active = true
  AND jmp.posting_date >= CURRENT_DATE - 30
GROUP BY es.esco_uri, es.preferred_label, es.skill_type
ORDER BY job_postings_count DESC;

COMMENT ON TABLE esco_skills IS 'ESCO taxonomy skills cache - Story 8.1';
COMMENT ON TABLE esco_occupations IS 'ESCO taxonomy occupations cache - Story 8.1';
COMMENT ON TABLE employee_skills IS 'Employee skills mapped to ESCO - Story 8.1';
COMMENT ON TABLE job_market_postings IS 'Crawled job market data - Story 8.2';
COMMENT ON TABLE skill_extraction_jobs IS 'Skill extraction processing - Story 8.3';
COMMENT ON TABLE skill_gap_analyses IS 'Skill gap analysis reports - Story 8.4';
COMMENT ON TABLE benchmark_reports IS 'Market benchmark reports - Story 8.5';
