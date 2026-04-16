-- =============================================================================
-- AI Provider Metrics Migration
-- Epic: E-ONTO-02 (AI Integration)
-- Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
-- Created: 2025-12-22
--
-- Tracks usage, costs, and performance metrics for AI providers
-- =============================================================================

-- AI Provider Metrics Table
-- Stores periodic snapshots of provider usage
CREATE TABLE IF NOT EXISTS ai_provider_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count BIGINT NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    avg_latency_ms DECIMAL(10, 2) NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'available',
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_provider_metrics_provider_check
        CHECK (provider IN ('openai', 'gemini', 'anthropic'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_metrics_provider
    ON ai_provider_metrics(provider);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_recorded_at
    ON ai_provider_metrics(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_provider_date
    ON ai_provider_metrics(provider, recorded_at DESC);

-- AI Provider Configuration Table
-- Stores provider settings and API key references
CREATE TABLE IF NOT EXISTS ai_provider_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL UNIQUE,
    model VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 10,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
    cost_per_1k_tokens DECIMAL(10, 6) NOT NULL DEFAULT 0.0001,
    max_batch_size INTEGER NOT NULL DEFAULT 100,
    api_key_env_var VARCHAR(100), -- Name of env var holding API key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT ai_provider_config_provider_check
        CHECK (provider IN ('openai', 'gemini', 'anthropic'))
);

-- AI Usage Log Table
-- Detailed log of each API call for auditing
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- 'embedding', 'completion', 'extraction'
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER NOT NULL,
    cost DECIMAL(10, 8) NOT NULL,
    latency_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID,
    request_metadata JSONB, -- Additional context like batch_size, source
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT ai_usage_log_provider_check
        CHECK (provider IN ('openai', 'gemini', 'anthropic'))
);

-- Indexes for usage log
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider
    ON ai_usage_log(provider);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created
    ON ai_usage_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant
    ON ai_usage_log(tenant_id)
    WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_operation
    ON ai_usage_log(operation);

-- Daily Cost Aggregation View
CREATE OR REPLACE VIEW v_ai_daily_costs AS
SELECT
    DATE(created_at) as date,
    provider,
    model,
    operation,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(cost) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as error_count
FROM ai_usage_log
GROUP BY DATE(created_at), provider, model, operation
ORDER BY date DESC, provider, model;

-- Monthly Cost Summary View
CREATE OR REPLACE VIEW v_ai_monthly_costs AS
SELECT
    DATE_TRUNC('month', created_at) as month,
    provider,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(cost) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100, 2) as success_rate
FROM ai_usage_log
GROUP BY DATE_TRUNC('month', created_at), provider
ORDER BY month DESC, provider;

-- Provider Cost by Tenant View
CREATE OR REPLACE VIEW v_ai_tenant_costs AS
SELECT
    t.code as tenant_code,
    t.name as tenant_name,
    aul.provider,
    COUNT(*) as request_count,
    SUM(aul.total_tokens) as total_tokens,
    SUM(aul.cost) as total_cost
FROM ai_usage_log aul
JOIN tenants t ON t.id = aul.tenant_id
GROUP BY t.id, t.code, t.name, aul.provider
ORDER BY total_cost DESC;

-- Insert default provider configurations
INSERT INTO ai_provider_config (provider, model, is_enabled, priority, rate_limit_per_minute, cost_per_1k_tokens, api_key_env_var)
VALUES
    ('openai', 'text-embedding-3-small', true, 1, 3000, 0.00002, 'OPENAI_API_KEY'),
    ('gemini', 'text-embedding-004', true, 2, 1500, 0.000025, 'GEMINI_API_KEY')
ON CONFLICT (provider) DO NOTHING;

-- Function to log AI usage
CREATE OR REPLACE FUNCTION log_ai_usage(
    p_provider VARCHAR(50),
    p_model VARCHAR(100),
    p_operation VARCHAR(50),
    p_total_tokens INTEGER,
    p_cost DECIMAL(10, 8),
    p_latency_ms INTEGER,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO ai_usage_log (
        provider, model, operation, total_tokens, cost, latency_ms,
        success, error_message, tenant_id, user_id, request_metadata
    ) VALUES (
        p_provider, p_model, p_operation, p_total_tokens, p_cost, p_latency_ms,
        p_success, p_error_message, p_tenant_id, p_user_id, p_metadata
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get provider cost summary
CREATE OR REPLACE FUNCTION get_ai_cost_summary(
    p_provider VARCHAR(50) DEFAULT NULL,
    p_since TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days'
) RETURNS TABLE (
    provider VARCHAR(50),
    total_requests BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL(10, 6),
    avg_latency_ms DECIMAL(10, 2),
    success_rate DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        aul.provider,
        COUNT(*)::BIGINT as total_requests,
        COALESCE(SUM(aul.total_tokens), 0)::BIGINT as total_tokens,
        COALESCE(SUM(aul.cost), 0)::DECIMAL(10, 6) as total_cost,
        COALESCE(AVG(aul.latency_ms), 0)::DECIMAL(10, 2) as avg_latency_ms,
        COALESCE(
            ROUND(SUM(CASE WHEN aul.success THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2),
            0
        )::DECIMAL(5, 2) as success_rate
    FROM ai_usage_log aul
    WHERE aul.created_at >= p_since
      AND (p_provider IS NULL OR aul.provider = p_provider)
    GROUP BY aul.provider
    ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE ai_provider_metrics IS 'Periodic snapshots of AI provider metrics for monitoring';
COMMENT ON TABLE ai_provider_config IS 'Configuration for AI embedding providers';
COMMENT ON TABLE ai_usage_log IS 'Detailed log of all AI API calls for auditing and cost tracking';
COMMENT ON VIEW v_ai_daily_costs IS 'Daily aggregation of AI usage costs';
COMMENT ON VIEW v_ai_monthly_costs IS 'Monthly summary of AI usage costs';
COMMENT ON VIEW v_ai_tenant_costs IS 'AI costs broken down by tenant';
