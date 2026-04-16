-- Migration 036: Calibration Sessions Enhanced
-- Sprint 2025-05: S-PERF-01-05 Calibration Sessions
-- Created: 2025-12-26

-- ============================================================================
-- 1. ADD DISCUSSION NOTES TO ADJUSTMENTS
-- ============================================================================

ALTER TABLE calibration_adjustments
ADD COLUMN IF NOT EXISTS discussion_notes TEXT,
ADD COLUMN IF NOT EXISTS outlier_flag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outlier_reason VARCHAR(100),
ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS applied_by UUID REFERENCES employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN calibration_adjustments.discussion_notes IS 'Notes from calibration discussion about this employee';
COMMENT ON COLUMN calibration_adjustments.outlier_flag IS 'Whether this rating was flagged as an outlier';
COMMENT ON COLUMN calibration_adjustments.outlier_reason IS 'Reason for outlier flag: high_variance, extreme_rating, etc.';

-- ============================================================================
-- 2. CALIBRATION AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS calibration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  calibration_session_id UUID NOT NULL REFERENCES calibration_sessions(id) ON DELETE CASCADE,
  adjustment_id UUID REFERENCES calibration_adjustments(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL, -- session_created, session_started, rating_changed, notes_added, session_completed, adjustment_applied
  action_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  action_at TIMESTAMPTZ DEFAULT NOW(),
  old_value JSONB,
  new_value JSONB,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_calibration_audit_session ON calibration_audit_log(calibration_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_audit_adjustment ON calibration_audit_log(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_calibration_audit_action ON calibration_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_calibration_audit_tenant ON calibration_audit_log(tenant_id);

COMMENT ON TABLE calibration_audit_log IS 'Immutable audit trail for all calibration actions';

-- ============================================================================
-- 3. FUNCTION: Log Calibration Action
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_log_calibration_action(
  p_tenant_id UUID,
  p_session_id UUID,
  p_adjustment_id UUID,
  p_action_type VARCHAR,
  p_action_by UUID,
  p_old_value JSONB,
  p_new_value JSONB,
  p_description TEXT
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO calibration_audit_log (
    tenant_id, calibration_session_id, adjustment_id, action_type, action_by,
    old_value, new_value, description
  ) VALUES (
    p_tenant_id, p_session_id, p_adjustment_id, p_action_type, p_action_by,
    p_old_value, p_new_value, p_description
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. VIEW: 9-BOX GRID PLACEMENT
-- ============================================================================

CREATE OR REPLACE VIEW v_calibration_9box AS
SELECT
  ca.tenant_id,
  ca.calibration_session_id,
  ca.employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  d.name as department_name,
  ca.original_rating,
  ca.adjusted_rating,
  COALESCE(ca.adjusted_rating, ca.original_rating) as final_rating,
  -- Performance bucket (1-3 = Low, 3-4 = Medium, 4-5 = High)
  CASE
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4 THEN 'high'
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3 THEN 'medium'
    ELSE 'low'
  END as performance_bucket,
  -- Potential bucket (based on predicted_rating normalized to 0-1 scale)
  CASE
    WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 'high'
    WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 'medium'
    ELSE 'low'
  END as potential_bucket,
  -- 9-box position (1-9)
  CASE
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4 AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 9 -- Star
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4 AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 6 -- Strong Performer
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 4 THEN 3 -- Solid Performer
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3 AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 8 -- High Potential
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3 AND COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 5 -- Core Player
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) >= 3 THEN 2 -- Effective
    WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.7 THEN 7 -- Inconsistent
    WHEN COALESCE(pp.predicted_rating / 5.0, 0.5) >= 0.4 THEN 4 -- Development
    ELSE 1 -- Underperformer
  END as box_position,
  ca.outlier_flag,
  ca.outlier_reason
FROM calibration_adjustments ca
JOIN employees e ON ca.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN performance_predictions pp ON ca.employee_id = pp.employee_id AND pp.is_current = true;

COMMENT ON VIEW v_calibration_9box IS '9-box grid placement for calibration visualization';

-- ============================================================================
-- 5. VIEW: BELL CURVE DISTRIBUTION
-- ============================================================================

CREATE OR REPLACE VIEW v_calibration_bell_curve AS
SELECT
  ca.tenant_id,
  ca.calibration_session_id,
  COALESCE(ca.adjusted_rating, ca.original_rating) as rating,
  COUNT(*) as count,
  COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY ca.calibration_session_id), 0) * 100 as percentage,
  -- Expected percentage for forced distribution
  CASE
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) <= 1 THEN 5
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) <= 2 THEN 10
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) <= 3 THEN 35
    WHEN COALESCE(ca.adjusted_rating, ca.original_rating) <= 4 THEN 35
    ELSE 15
  END as expected_percentage
FROM calibration_adjustments ca
WHERE COALESCE(ca.adjusted_rating, ca.original_rating) IS NOT NULL
GROUP BY ca.tenant_id, ca.calibration_session_id, COALESCE(ca.adjusted_rating, ca.original_rating);

COMMENT ON VIEW v_calibration_bell_curve IS 'Bell curve distribution analysis for calibration';

-- ============================================================================
-- 6. FUNCTION: Detect Outliers
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_detect_calibration_outliers(
  p_tenant_id UUID,
  p_session_id UUID,
  p_std_dev_threshold NUMERIC DEFAULT 2.0
) RETURNS TABLE (
  adjustment_id UUID,
  employee_id UUID,
  employee_name TEXT,
  rating NUMERIC,
  department_avg NUMERIC,
  session_avg NUMERIC,
  deviation NUMERIC,
  outlier_reason VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH session_stats AS (
    SELECT
      AVG(COALESCE(adjusted_rating, original_rating)) as avg_rating,
      STDDEV(COALESCE(adjusted_rating, original_rating)) as stddev_rating
    FROM calibration_adjustments
    WHERE calibration_session_id = p_session_id AND tenant_id = p_tenant_id
  ),
  dept_stats AS (
    SELECT
      e.department_id,
      AVG(COALESCE(ca.adjusted_rating, ca.original_rating)) as dept_avg
    FROM calibration_adjustments ca
    JOIN employees e ON ca.employee_id = e.id
    WHERE ca.calibration_session_id = p_session_id AND ca.tenant_id = p_tenant_id
    GROUP BY e.department_id
  )
  SELECT
    ca.id as adjustment_id,
    ca.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    COALESCE(ca.adjusted_rating, ca.original_rating) as rating,
    ds.dept_avg as department_avg,
    ss.avg_rating as session_avg,
    ABS(COALESCE(ca.adjusted_rating, ca.original_rating) - ss.avg_rating) / NULLIF(ss.stddev_rating, 0) as deviation,
    (CASE
      WHEN ABS(COALESCE(ca.adjusted_rating, ca.original_rating) - ss.avg_rating) / NULLIF(ss.stddev_rating, 0) > p_std_dev_threshold THEN 'high_variance'
      WHEN COALESCE(ca.adjusted_rating, ca.original_rating) <= 1 OR COALESCE(ca.adjusted_rating, ca.original_rating) >= 5 THEN 'extreme_rating'
      WHEN ABS(COALESCE(ca.adjusted_rating, ca.original_rating) - ds.dept_avg) > 1 THEN 'dept_deviation'
      ELSE NULL
    END)::VARCHAR as outlier_reason
  FROM calibration_adjustments ca
  JOIN employees e ON ca.employee_id = e.id
  CROSS JOIN session_stats ss
  LEFT JOIN dept_stats ds ON e.department_id = ds.department_id
  WHERE ca.calibration_session_id = p_session_id
    AND ca.tenant_id = p_tenant_id
    AND (
      ABS(COALESCE(ca.adjusted_rating, ca.original_rating) - ss.avg_rating) / NULLIF(ss.stddev_rating, 0) > p_std_dev_threshold
      OR COALESCE(ca.adjusted_rating, ca.original_rating) <= 1
      OR COALESCE(ca.adjusted_rating, ca.original_rating) >= 5
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_detect_calibration_outliers IS 'Detects rating outliers based on standard deviation and department comparison';

-- ============================================================================
-- 7. ADD DEPARTMENT_ID TO CALIBRATION SESSIONS
-- ============================================================================

ALTER TABLE calibration_sessions
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE calibration_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON calibration_audit_log
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
