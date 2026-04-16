-- Migration: 040_error_analytics.sql
-- Description: Error analytics infrastructure for centralized error tracking
-- Created: 2025-12-27

BEGIN;

-- =====================================================
-- ERROR LOGS TABLE
-- Main table for storing all application errors
-- =====================================================
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL,
    category VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    http_status INTEGER NOT NULL,

    -- Context
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Request info
    request_method VARCHAR(10),
    request_path TEXT,
    request_ip VARCHAR(45),
    request_id VARCHAR(100),
    user_agent TEXT,

    -- Additional data
    details JSONB,
    database_context JSONB,
    stack_trace TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT error_logs_severity_check CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING', 'INFO')),
    CONSTRAINT error_logs_category_check CHECK (category IN ('API', 'AUTH', 'DB', 'VALIDATION', 'BUSINESS', 'INTEGRATION', 'SYSTEM', 'PERMISSION', 'TENANT', 'AI'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_id ON error_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_code ON error_logs(code);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_http_status ON error_logs(http_status);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_created ON error_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_error_logs_details ON error_logs USING GIN (details);

-- =====================================================
-- HOURLY ERROR AGGREGATION TABLE
-- For performance dashboards and trend analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS error_analytics_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hour_start TIMESTAMPTZ NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,

    -- Metrics
    error_count INTEGER NOT NULL DEFAULT 0,
    unique_errors INTEGER NOT NULL DEFAULT 0,
    affected_users INTEGER NOT NULL DEFAULT 0,
    top_error_codes TEXT[],

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint for upsert
    UNIQUE(hour_start, tenant_id, category, severity)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_analytics_hourly_hour ON error_analytics_hourly(hour_start DESC);
CREATE INDEX IF NOT EXISTS idx_error_analytics_hourly_tenant ON error_analytics_hourly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_analytics_hourly_category ON error_analytics_hourly(category);

-- GIN index for array containment queries
CREATE INDEX IF NOT EXISTS idx_error_analytics_hourly_codes ON error_analytics_hourly USING GIN (top_error_codes);

-- =====================================================
-- ERROR PATTERNS TABLE
-- For detecting recurring issues and anomalies
-- =====================================================
CREATE TABLE IF NOT EXISTS error_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    error_code VARCHAR(50),
    category VARCHAR(30),

    -- Tracking
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    affected_tenants UUID[],

    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT error_patterns_type_check CHECK (pattern_type IN ('SPIKE', 'RECURRING', 'NEW_ERROR', 'REGRESSION', 'CLUSTER'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_patterns_type ON error_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_error_patterns_code ON error_patterns(error_code);
CREATE INDEX IF NOT EXISTS idx_error_patterns_resolved ON error_patterns(is_resolved);
CREATE INDEX IF NOT EXISTS idx_error_patterns_last_seen ON error_patterns(last_seen DESC);

-- =====================================================
-- AGGREGATION FUNCTION
-- Aggregates errors into hourly buckets
-- =====================================================
CREATE OR REPLACE FUNCTION aggregate_errors_hourly(
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER AS $$
DECLARE
    v_inserted INTEGER := 0;
BEGIN
    INSERT INTO error_analytics_hourly (
        hour_start,
        tenant_id,
        category,
        severity,
        error_count,
        unique_errors,
        affected_users,
        top_error_codes
    )
    SELECT
        date_trunc('hour', created_at) AS hour_start,
        tenant_id,
        category,
        severity,
        COUNT(*) AS error_count,
        COUNT(DISTINCT code) AS unique_errors,
        COUNT(DISTINCT user_id) AS affected_users,
        (SELECT ARRAY_AGG(code ORDER BY cnt DESC)
         FROM (
             SELECT code, COUNT(*) as cnt
             FROM error_logs el2
             WHERE el2.tenant_id IS NOT DISTINCT FROM el.tenant_id
               AND el2.category = el.category
               AND el2.severity = el.severity
               AND date_trunc('hour', el2.created_at) = date_trunc('hour', el.created_at)
             GROUP BY code
             ORDER BY cnt DESC
             LIMIT 5
         ) top_codes
        ) AS top_error_codes
    FROM error_logs el
    WHERE created_at >= p_start_time
      AND created_at < p_end_time
    GROUP BY
        date_trunc('hour', created_at),
        tenant_id,
        category,
        severity
    ON CONFLICT (hour_start, tenant_id, category, severity)
    DO UPDATE SET
        error_count = EXCLUDED.error_count,
        unique_errors = EXCLUDED.unique_errors,
        affected_users = EXCLUDED.affected_users,
        top_error_codes = EXCLUDED.top_error_codes;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SPIKE DETECTION FUNCTION
-- Detects unusual error spikes
-- =====================================================
CREATE OR REPLACE FUNCTION detect_error_spike(
    p_threshold_multiplier DECIMAL DEFAULT 2.0,
    p_min_errors INTEGER DEFAULT 10
)
RETURNS TABLE (
    category VARCHAR(30),
    severity VARCHAR(20),
    tenant_id UUID,
    current_hour_count BIGINT,
    avg_hourly_count DECIMAL,
    spike_ratio DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH current_hour AS (
        SELECT
            el.category,
            el.severity,
            el.tenant_id,
            COUNT(*) AS error_count
        FROM error_logs el
        WHERE el.created_at >= date_trunc('hour', NOW())
        GROUP BY el.category, el.severity, el.tenant_id
        HAVING COUNT(*) >= p_min_errors
    ),
    historical_avg AS (
        SELECT
            eah.category,
            eah.severity,
            eah.tenant_id,
            AVG(eah.error_count) AS avg_count
        FROM error_analytics_hourly eah
        WHERE eah.hour_start >= NOW() - INTERVAL '7 days'
          AND eah.hour_start < date_trunc('hour', NOW())
        GROUP BY eah.category, eah.severity, eah.tenant_id
    )
    SELECT
        c.category,
        c.severity,
        c.tenant_id,
        c.error_count AS current_hour_count,
        COALESCE(h.avg_count, 1) AS avg_hourly_count,
        (c.error_count::DECIMAL / GREATEST(COALESCE(h.avg_count, 1), 1)) AS spike_ratio
    FROM current_hour c
    LEFT JOIN historical_avg h
        ON c.category = h.category
        AND c.severity = h.severity
        AND c.tenant_id IS NOT DISTINCT FROM h.tenant_id
    WHERE (c.error_count::DECIMAL / GREATEST(COALESCE(h.avg_count, 1), 1)) >= p_threshold_multiplier;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ERROR STATS VIEW
-- Quick overview of error statistics
-- =====================================================
CREATE OR REPLACE VIEW error_stats AS
SELECT
    date_trunc('day', created_at) AS date,
    tenant_id,
    category,
    severity,
    COUNT(*) AS error_count,
    COUNT(DISTINCT code) AS unique_codes,
    COUNT(DISTINCT user_id) AS affected_users
FROM error_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY
    date_trunc('day', created_at),
    tenant_id,
    category,
    severity;

-- =====================================================
-- RECENT ERRORS VIEW
-- Latest errors for monitoring
-- =====================================================
CREATE OR REPLACE VIEW recent_errors AS
SELECT
    el.id,
    el.error_id,
    el.code,
    el.category,
    el.severity,
    el.message,
    el.http_status,
    el.request_method,
    el.request_path,
    el.tenant_id,
    t.name AS tenant_name,
    el.user_id,
    u.username,
    el.created_at
FROM error_logs el
LEFT JOIN tenants t ON el.tenant_id = t.id
LEFT JOIN users u ON el.user_id = u.id
WHERE el.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY el.created_at DESC;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE error_logs IS 'Centralized error logging for all application errors';
COMMENT ON TABLE error_analytics_hourly IS 'Hourly aggregated error metrics for dashboards';
COMMENT ON TABLE error_patterns IS 'Detected error patterns and anomalies';
COMMENT ON FUNCTION aggregate_errors_hourly IS 'Aggregates raw error logs into hourly buckets';
COMMENT ON FUNCTION detect_error_spike IS 'Detects unusual error spikes compared to historical average';

COMMIT;
