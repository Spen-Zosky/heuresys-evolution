-- ============================================================================
-- Migration 179: Semantic Enrichment Engine (SEE) — Control Plane
-- ============================================================================
-- Creates the control-plane schema for the new Semantic Enrichment Engine
-- described in docs/plans/SEMANTIC_ENRICHMENT_ENGINE.md.
--
-- This migration is pure DDL + reference-data seed. No application code yet.
-- The engine itself lives in a new microservice (services/enrichment-engine/)
-- added in a later commit.
--
-- Scope:
--   - 11 control-plane tables under prefix `enrichment_*`
--   - Governance tables (descriptors, extraction schemas, merge policies,
--     trust rules, LLM provider routing)
--   - RLS policies for multi-tenant isolation on the 8 tables that carry
--     tenant_id (the 3 lookup/registry tables are platform-scope)
--   - Future-proof flag `employees.enrichment_consent` (unused in MVP;
--     avoids a breaking migration when GDPR signoff arrives)
--   - Seed: 2 MVP entity descriptors (tenant_profile,
--     industry_classification_enrichment), 2 extraction schemas, 2 merge
--     policies, 3 LLM providers (anthropic default, openai fallback,
--     gemini inactive), base trust rules
--
-- Idempotency: all INSERTs use ON CONFLICT DO NOTHING/UPDATE so this
-- migration is safely re-runnable on an already-initialized DB.
--
-- Related plan sections: §4 (schema), §6 (descriptors), §7 (modes), §13
-- (pre-work decisions finalized 2026-04-11)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Governance tables (platform-scope lookups)
-- ----------------------------------------------------------------------------

-- 1.1 LLM provider routing (multi-provider decision #2)
CREATE TABLE IF NOT EXISTS enrichment_llm_providers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    api_key_env_ref VARCHAR(100) NOT NULL,
    base_url VARCHAR(500),
    default_model VARCHAR(100) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    cost_per_1k_input_tokens NUMERIC(10,6) NOT NULL DEFAULT 0,
    cost_per_1k_output_tokens NUMERIC(10,6) NOT NULL DEFAULT 0,
    supports_structured_output BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_llm_providers_active
    ON enrichment_llm_providers (is_active, priority);

-- 1.2 Trust rules for source scoring (platform-scope by default, tenant
-- override possible via tenant_id nullable)
CREATE TABLE IF NOT EXISTS enrichment_trust_rules (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    domain_pattern VARCHAR(255),
    trust_score NUMERIC(3,2) NOT NULL CHECK (trust_score BETWEEN 0 AND 1),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT enrichment_trust_rules_unique
        UNIQUE (tenant_id, source_type, domain_pattern)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_trust_rules_lookup
    ON enrichment_trust_rules (source_type, tenant_id NULLS FIRST);

-- 1.3 Extraction schemas (Zod-like JSON schemas, versioned)
CREATE TABLE IF NOT EXISTS enrichment_extraction_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    schema_jsonb JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT enrichment_extraction_schemas_unique
        UNIQUE (tenant_id, code, version)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_extraction_schemas_code
    ON enrichment_extraction_schemas (code, tenant_id NULLS FIRST);

-- 1.4 Merge policies (per-field rules, versioned)
CREATE TABLE IF NOT EXISTS enrichment_merge_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    rules_jsonb JSONB NOT NULL,
    budget_cap_eur NUMERIC(10,2) NOT NULL DEFAULT 10.00,
    current_usage_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
    budget_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT enrichment_merge_policies_unique
        UNIQUE (tenant_id, code, version),
    CONSTRAINT enrichment_merge_policies_budget_nonneg
        CHECK (budget_cap_eur >= 0 AND current_usage_eur >= 0)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_merge_policies_code
    ON enrichment_merge_policies (code, tenant_id NULLS FIRST);

-- 1.5 Entity descriptors (governance §6)
CREATE TABLE IF NOT EXISTS enrichment_entity_descriptors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    entity_name VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    pk_field VARCHAR(100) NOT NULL DEFAULT 'id',
    match_keys TEXT[] NOT NULL DEFAULT '{}',
    source_strategy_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_schema_id UUID REFERENCES enrichment_extraction_schemas(id) ON DELETE RESTRICT,
    default_merge_policy_id UUID REFERENCES enrichment_merge_policies(id) ON DELETE RESTRICT,
    default_mode VARCHAR(20) NOT NULL DEFAULT 'suggest'
        CHECK (default_mode IN ('suggest', 'merge', 'observe')),
    scope_level VARCHAR(20) NOT NULL DEFAULT 'platform'
        CHECK (scope_level IN ('platform', 'tenant')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT enrichment_entity_descriptors_unique
        UNIQUE (tenant_id, entity_name)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_entity_descriptors_target
    ON enrichment_entity_descriptors (target_table, is_active);

-- ----------------------------------------------------------------------------
-- 2. Job lifecycle tables (tenant-scoped)
-- ----------------------------------------------------------------------------

-- 2.1 enrichment_jobs
CREATE TABLE IF NOT EXISTS enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    descriptor_id UUID NOT NULL REFERENCES enrichment_entity_descriptors(id) ON DELETE RESTRICT,
    target_table VARCHAR(100) NOT NULL,
    target_pk_field VARCHAR(100) NOT NULL,
    target_record_id TEXT NOT NULL,
    semantic_scope_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_id UUID REFERENCES enrichment_merge_policies(id) ON DELETE RESTRICT,
    mode VARCHAR(20) NOT NULL DEFAULT 'suggest'
        CHECK (mode IN ('suggest', 'merge', 'observe')),
    idempotency_key VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','discovering','crawling','extracting',
                          'resolving','previewing','committed','failed',
                          'cached','rolled_back')),
    requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    freshness_days INTEGER NOT NULL DEFAULT 7,
    llm_cost_eur NUMERIC(10,4) NOT NULL DEFAULT 0,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT enrichment_jobs_idempotency_unique
        UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_tenant_status
    ON enrichment_jobs (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_target
    ON enrichment_jobs (target_table, target_record_id);

-- 2.2 enrichment_job_events — audit trail
CREATE TABLE IF NOT EXISTS enrichment_job_events (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload_jsonb JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_job_events_job
    ON enrichment_job_events (job_id, created_at);

-- ----------------------------------------------------------------------------
-- 3. Acquisition tables
-- ----------------------------------------------------------------------------

-- 3.1 enrichment_sources — canonical URLs discovered
CREATE TABLE IF NOT EXISTS enrichment_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    canonical_url VARCHAR(2048) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    discovered_via VARCHAR(50) NOT NULL,
    trust_score NUMERIC(3,2) NOT NULL DEFAULT 0,
    relevance_score NUMERIC(3,2) NOT NULL DEFAULT 0,
    language VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_sources_job
    ON enrichment_sources (job_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_sources_canonical
    ON enrichment_sources (tenant_id, canonical_url);

-- 3.2 enrichment_source_snapshots — fingerprinted content
CREATE TABLE IF NOT EXISTS enrichment_source_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES enrichment_sources(id) ON DELETE CASCADE,
    content_hash CHAR(64) NOT NULL,
    content_text TEXT,
    content_markdown TEXT,
    content_metadata_jsonb JSONB,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    crawler_used VARCHAR(50) NOT NULL,
    http_status INTEGER,
    bytes_size INTEGER,
    CONSTRAINT enrichment_source_snapshots_unique
        UNIQUE (tenant_id, source_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_source_snapshots_hash
    ON enrichment_source_snapshots (content_hash);
CREATE INDEX IF NOT EXISTS idx_enrichment_source_snapshots_retrieval
    ON enrichment_source_snapshots (retrieved_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Extraction + resolution tables
-- ----------------------------------------------------------------------------

-- 4.1 enrichment_candidates — single extracted facts
CREATE TABLE IF NOT EXISTS enrichment_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
    source_snapshot_id UUID REFERENCES enrichment_source_snapshots(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_anchor VARCHAR(500),
    field_name VARCHAR(100) NOT NULL,
    candidate_value JSONB NOT NULL,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0
        CHECK (confidence BETWEEN 0 AND 1),
    extraction_method VARCHAR(50) NOT NULL,
    llm_provider_code VARCHAR(50) REFERENCES enrichment_llm_providers(code),
    fact_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT enrichment_candidates_fact_hash_unique
        UNIQUE (tenant_id, fact_hash)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_candidates_job
    ON enrichment_candidates (job_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_candidates_field
    ON enrichment_candidates (entity_type, field_name, confidence DESC);

-- 4.2 enrichment_matches — resolved candidates to target records
CREATE TABLE IF NOT EXISTS enrichment_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES enrichment_candidates(id) ON DELETE CASCADE,
    target_table VARCHAR(100) NOT NULL,
    target_pk_field VARCHAR(100) NOT NULL,
    target_record_id TEXT NOT NULL,
    match_score NUMERIC(3,2) NOT NULL DEFAULT 0
        CHECK (match_score BETWEEN 0 AND 1),
    match_reason JSONB,
    accepted BOOLEAN NOT NULL DEFAULT false,
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_matches_target
    ON enrichment_matches (target_table, target_record_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_matches_job
    ON enrichment_matches (job_id, accepted);

-- ----------------------------------------------------------------------------
-- 5. Persistence tables
-- ----------------------------------------------------------------------------

-- 5.1 enrichment_merges — committed writes
CREATE TABLE IF NOT EXISTS enrichment_merges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE RESTRICT,
    match_id UUID NOT NULL REFERENCES enrichment_matches(id) ON DELETE RESTRICT,
    target_table VARCHAR(100) NOT NULL,
    target_pk_field VARCHAR(100) NOT NULL,
    target_record_id TEXT NOT NULL,
    target_column VARCHAR(100) NOT NULL,
    previous_value JSONB,
    new_value JSONB NOT NULL,
    merge_rule VARCHAR(100) NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    committed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rolled_back_at TIMESTAMPTZ,
    rolled_back_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT enrichment_merges_idempotent
        UNIQUE (tenant_id, target_table, target_record_id, target_column, match_id)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_merges_target
    ON enrichment_merges (target_table, target_record_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_merges_job
    ON enrichment_merges (job_id, committed_at DESC);

-- 5.2 enrichment_observations — time-series facts (observe mode)
CREATE TABLE IF NOT EXISTS enrichment_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
    target_table VARCHAR(100) NOT NULL,
    target_record_id TEXT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    observed_value JSONB NOT NULL,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
    source_snapshot_id UUID REFERENCES enrichment_source_snapshots(id) ON DELETE SET NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_observations_target_time
    ON enrichment_observations (target_table, target_record_id, field_name, observed_at DESC);

-- 5.3 enrichment_lineage — DAG candidate → match → merge
CREATE TABLE IF NOT EXISTS enrichment_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES enrichment_candidates(id) ON DELETE SET NULL,
    match_id UUID REFERENCES enrichment_matches(id) ON DELETE SET NULL,
    merge_id UUID REFERENCES enrichment_merges(id) ON DELETE SET NULL,
    observation_id UUID REFERENCES enrichment_observations(id) ON DELETE SET NULL,
    lineage_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_lineage_merge
    ON enrichment_lineage (merge_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_lineage_job
    ON enrichment_lineage (job_id);

-- ----------------------------------------------------------------------------
-- 6. Row-Level Security (P10 multi-tenant isolation)
-- ----------------------------------------------------------------------------
-- All tables carrying tenant_id get RLS enabled with a policy that reads the
-- session variable `app.current_tenant_id`, the same pattern used by other
-- RLS-protected tables in this schema (e.g. widget_catalog, user_workspaces).

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'enrichment_trust_rules',
        'enrichment_extraction_schemas',
        'enrichment_merge_policies',
        'enrichment_entity_descriptors',
        'enrichment_jobs',
        'enrichment_job_events',
        'enrichment_sources',
        'enrichment_source_snapshots',
        'enrichment_candidates',
        'enrichment_matches',
        'enrichment_merges',
        'enrichment_observations',
        'enrichment_lineage'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', t, t);
        EXECUTE format($f$
            CREATE POLICY %I_tenant_isolation ON %I
            USING (
                tenant_id IS NULL
                OR tenant_id = COALESCE(
                    NULLIF(current_setting('app.current_tenant_id', true), '')::uuid,
                    tenant_id
                )
            )
        $f$, t, t);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Future-proof flag: employees.enrichment_consent
-- ----------------------------------------------------------------------------
-- Unused in MVP (GDPR decision #6: employees enrichment excluded). Adding
-- the column now prevents a breaking migration when legal signoff arrives.

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS enrichment_consent BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN employees.enrichment_consent IS
    'GDPR opt-in flag for public-data web enrichment. Unused until legal signoff. See docs/plans/SEMANTIC_ENRICHMENT_ENGINE.md §13.';

-- ============================================================================
-- 8. Reference-data seed
-- ============================================================================

-- 8.1 LLM providers (decision #2 — multi-provider)
INSERT INTO enrichment_llm_providers
    (code, display_name, api_key_env_ref, default_model, priority,
     is_active, cost_per_1k_input_tokens, cost_per_1k_output_tokens,
     supports_structured_output, notes)
VALUES
    ('anthropic', 'Anthropic Claude',
        'ANTHROPIC_API_KEY', 'claude-sonnet-4-6', 1, true,
        0.003, 0.015, true,
        'Primary provider. Native tool use and structured output.'),
    ('openai', 'OpenAI',
        'OPENAI_API_KEY', 'gpt-4o-mini', 2, true,
        0.00015, 0.0006, true,
        'Fallback provider. Cheaper but lower extraction quality on complex pages.'),
    ('gemini', 'Google Gemini',
        'GOOGLE_API_KEY', 'gemini-2.0-flash', 3, false,
        0.0001, 0.0004, true,
        'Inactive by default. Enable once integration tests are green.')
ON CONFLICT (code) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        default_model = EXCLUDED.default_model,
        priority = EXCLUDED.priority,
        cost_per_1k_input_tokens = EXCLUDED.cost_per_1k_input_tokens,
        cost_per_1k_output_tokens = EXCLUDED.cost_per_1k_output_tokens,
        updated_at = NOW();

-- 8.2 Base trust rules (platform-scope, tenant_id NULL)
INSERT INTO enrichment_trust_rules
    (tenant_id, source_type, domain_pattern, trust_score, notes)
VALUES
    (NULL, 'official_website',     NULL, 1.00, 'Entity own website (must match match_keys domain)'),
    (NULL, 'regulator',             NULL, 0.95, 'Government regulator / supervisory authority'),
    (NULL, 'chamber_of_commerce',   NULL, 0.90, 'Chamber of commerce / business registry'),
    (NULL, 'industry_association',  NULL, 0.80, 'Recognized industry association'),
    (NULL, 'directory',             NULL, 0.70, 'Curated business directory'),
    (NULL, 'wikipedia',             NULL, 0.65, 'Wikipedia article (use with verification)'),
    (NULL, 'news_outlet',           NULL, 0.55, 'Established news outlet'),
    (NULL, 'blog',                  NULL, 0.30, 'Generic blog content'),
    (NULL, 'social_media',          NULL, 0.25, 'Social media post'),
    (NULL, 'unknown',               NULL, 0.10, 'Unclassified source')
ON CONFLICT (tenant_id, source_type, domain_pattern) DO UPDATE
    SET trust_score = EXCLUDED.trust_score,
        notes = EXCLUDED.notes,
        updated_at = NOW();

-- 8.3 MVP extraction schemas (TenantProfileV1, IndustryClassificationEnrichmentV1)

INSERT INTO enrichment_extraction_schemas (id, tenant_id, code, version, schema_jsonb, description)
VALUES (
    '11111111-0000-4000-8000-000000000001', NULL,
    'TenantProfileV1', 1,
    $json${
      "type": "object",
      "required": ["legal_name"],
      "properties": {
        "legal_name":       {"type": "string", "minLength": 2},
        "website":          {"type": "string", "format": "uri"},
        "description":      {"type": "string", "maxLength": 1000},
        "country_code":     {"type": "string", "pattern": "^[A-Z]{2}$"},
        "industry_hint":    {"type": "string"},
        "headquarters_city":{"type": "string"},
        "vat_id":           {"type": "string"}
      }
    }$json$::jsonb,
    'MVP tenant profile extraction — public company profile fields only.'
),
(
    '11111111-0000-4000-8000-000000000002', NULL,
    'IndustryClassificationEnrichmentV1', 1,
    $json${
      "type": "object",
      "required": ["code"],
      "properties": {
        "code":               {"type": "string"},
        "name_it":            {"type": "string"},
        "name_en":            {"type": "string"},
        "description_it":     {"type": "string", "maxLength": 2000},
        "description_en":     {"type": "string", "maxLength": 2000},
        "sample_activities":  {"type": "array", "items": {"type": "string"}}
      }
    }$json$::jsonb,
    'MVP industry classification enrichment — NACE/ATECO description fields.'
)
ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET schema_jsonb = EXCLUDED.schema_jsonb,
        description = EXCLUDED.description,
        updated_at = NOW();

-- 8.4 MVP merge policies (both suggest-only per decision #3)

INSERT INTO enrichment_merge_policies
    (id, tenant_id, code, version, rules_jsonb, budget_cap_eur, description)
VALUES (
    '22222222-0000-4000-8000-000000000001', NULL,
    'TenantProfileSuggestV1', 1,
    $json${
      "mode": "suggest",
      "rules": {
        "legal_name":        "authoritative_only",
        "website":           "update_if_empty_or_verified",
        "description":       "prefer_latest_high_confidence",
        "country_code":      "update_if_empty",
        "industry_hint":     "suggest_only",
        "headquarters_city": "update_if_empty",
        "vat_id":            "authoritative_only"
      }
    }$json$::jsonb,
    10.00,
    'MVP suggest-only policy for tenant_profile. Human review required before commit.'
),
(
    '22222222-0000-4000-8000-000000000002', NULL,
    'IndustryClassificationSuggestV1', 1,
    $json${
      "mode": "suggest",
      "rules": {
        "name_it":           "prefer_authoritative",
        "name_en":           "prefer_authoritative",
        "description_it":    "prefer_latest_high_confidence",
        "description_en":    "prefer_latest_high_confidence",
        "sample_activities": "append_observation_not_overwrite"
      }
    }$json$::jsonb,
    10.00,
    'MVP suggest-only policy for industry classifications. Descriptions come from public sources.'
)
ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET rules_jsonb = EXCLUDED.rules_jsonb,
        budget_cap_eur = EXCLUDED.budget_cap_eur,
        description = EXCLUDED.description,
        updated_at = NOW();

-- 8.5 MVP entity descriptors (2 descriptors per decision #5)

INSERT INTO enrichment_entity_descriptors
    (id, tenant_id, entity_name, target_table, pk_field, match_keys,
     source_strategy_jsonb, extraction_schema_id, default_merge_policy_id,
     default_mode, scope_level, description)
VALUES (
    '33333333-0000-4000-8000-000000000001', NULL,
    'tenant_profile', 'public.tenants', 'id',
    ARRAY['vat_id','website_domain','legal_name'],
    $json${
      "discovery_mode": "semantic",
      "preferred_source_types": ["official_website","chamber_of_commerce","regulator","directory"],
      "allowed_tlds": [".it",".eu",".com"],
      "exclude_domains": [],
      "max_depth": 2,
      "max_pages": 30,
      "languages": ["it","en"]
    }$json$::jsonb,
    '11111111-0000-4000-8000-000000000001',
    '22222222-0000-4000-8000-000000000001',
    'suggest', 'platform',
    'MVP descriptor for tenant public profile enrichment. Suggest-only.'
),
(
    '33333333-0000-4000-8000-000000000002', NULL,
    'industry_classification_enrichment', 'public.industry_classifications', 'id',
    ARRAY['code'],
    $json${
      "discovery_mode": "semantic",
      "preferred_source_types": ["regulator","industry_association","wikipedia","official_website"],
      "allowed_tlds": [".it",".eu",".int"],
      "exclude_domains": [],
      "max_depth": 1,
      "max_pages": 20,
      "languages": ["it","en"]
    }$json$::jsonb,
    '11111111-0000-4000-8000-000000000002',
    '22222222-0000-4000-8000-000000000002',
    'suggest', 'platform',
    'MVP descriptor for NACE/ATECO description enrichment. Suggest-only.'
)
ON CONFLICT (tenant_id, entity_name) DO UPDATE
    SET target_table = EXCLUDED.target_table,
        match_keys = EXCLUDED.match_keys,
        source_strategy_jsonb = EXCLUDED.source_strategy_jsonb,
        extraction_schema_id = EXCLUDED.extraction_schema_id,
        default_merge_policy_id = EXCLUDED.default_merge_policy_id,
        description = EXCLUDED.description,
        updated_at = NOW();

-- ============================================================================
-- 9. Verify block
-- ============================================================================
DO $$
DECLARE
    v_tables INTEGER;
    v_providers INTEGER;
    v_trust_rules INTEGER;
    v_schemas INTEGER;
    v_policies INTEGER;
    v_descriptors INTEGER;
    v_consent_col INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_tables
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name LIKE 'enrichment_%';

    SELECT COUNT(*) INTO v_providers FROM enrichment_llm_providers;
    SELECT COUNT(*) INTO v_trust_rules FROM enrichment_trust_rules;
    SELECT COUNT(*) INTO v_schemas FROM enrichment_extraction_schemas;
    SELECT COUNT(*) INTO v_policies FROM enrichment_merge_policies;
    SELECT COUNT(*) INTO v_descriptors FROM enrichment_entity_descriptors;

    SELECT COUNT(*) INTO v_consent_col
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'employees'
       AND column_name = 'enrichment_consent';

    RAISE NOTICE '[migration 179] tables=% providers=% trust=% schemas=% policies=% descriptors=% consent_col=%',
        v_tables, v_providers, v_trust_rules, v_schemas, v_policies, v_descriptors, v_consent_col;

    IF v_tables < 13 THEN
        RAISE EXCEPTION '[migration 179] expected >=13 enrichment_* tables, got %', v_tables;
    END IF;
    IF v_providers < 3 THEN
        RAISE EXCEPTION '[migration 179] expected 3 LLM providers, got %', v_providers;
    END IF;
    IF v_trust_rules < 10 THEN
        RAISE EXCEPTION '[migration 179] expected >=10 trust rules, got %', v_trust_rules;
    END IF;
    IF v_schemas < 2 THEN
        RAISE EXCEPTION '[migration 179] expected 2 extraction schemas, got %', v_schemas;
    END IF;
    IF v_policies < 2 THEN
        RAISE EXCEPTION '[migration 179] expected 2 merge policies, got %', v_policies;
    END IF;
    IF v_descriptors < 2 THEN
        RAISE EXCEPTION '[migration 179] expected 2 entity descriptors, got %', v_descriptors;
    END IF;
    IF v_consent_col = 0 THEN
        RAISE EXCEPTION '[migration 179] employees.enrichment_consent column missing';
    END IF;
END $$;

COMMIT;
