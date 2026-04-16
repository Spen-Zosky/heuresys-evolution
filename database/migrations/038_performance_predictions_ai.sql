-- Migration 038: Performance Predictions AI Enhancement
-- Sprint 2025-05: S-PERF-01-08 Performance Predictions (AI)
-- Created: 2025-12-26

-- ============================================================================
-- 1. ENHANCE PERFORMANCE_PREDICTIONS TABLE
-- ============================================================================

ALTER TABLE performance_predictions
ADD COLUMN IF NOT EXISTS risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20), -- low, medium, high, critical
ADD COLUMN IF NOT EXISTS is_high_potential BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hipo_score NUMERIC(3,2), -- 0.00 to 5.00
ADD COLUMN IF NOT EXISTS hipo_justification TEXT,
ADD COLUMN IF NOT EXISTS contributing_factors JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS recommended_actions JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS prediction_confidence NUMERIC(5,4), -- 0.0000 to 1.0000
ADD COLUMN IF NOT EXISTS actual_rating NUMERIC(3,2), -- For accuracy tracking
ADD COLUMN IF NOT EXISTS prediction_accuracy NUMERIC(5,4), -- Calculated after actual
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS model_name VARCHAR(100) DEFAULT 'heuresys-perf-v1',
ADD COLUMN IF NOT EXISTS feature_weights JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN performance_predictions.risk_score IS 'Performance risk score 0-100 (higher = more at risk)';
COMMENT ON COLUMN performance_predictions.risk_level IS 'Risk category: low (0-25), medium (26-50), high (51-75), critical (76-100)';
COMMENT ON COLUMN performance_predictions.is_high_potential IS 'Flag indicating high potential employee';
COMMENT ON COLUMN performance_predictions.hipo_score IS 'High potential score (0-5)';
COMMENT ON COLUMN performance_predictions.hipo_justification IS 'Explanation of HiPo classification';
COMMENT ON COLUMN performance_predictions.contributing_factors IS 'Detailed breakdown of factors affecting prediction';
COMMENT ON COLUMN performance_predictions.recommended_actions IS 'Suggested interventions with priority and impact';
COMMENT ON COLUMN performance_predictions.prediction_confidence IS 'Model confidence in prediction (0-1)';
COMMENT ON COLUMN performance_predictions.actual_rating IS 'Actual rating after review period (for accuracy calc)';
COMMENT ON COLUMN performance_predictions.prediction_accuracy IS 'How accurate prediction was vs actual';

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_perf_predictions_risk ON performance_predictions(risk_score DESC) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_perf_predictions_hipo ON performance_predictions(is_high_potential) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_perf_predictions_model ON performance_predictions(model_name, model_version);

-- ============================================================================
-- 2. CREATE PREDICTION FACTORS REFERENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_code VARCHAR(50) NOT NULL UNIQUE,
  factor_name VARCHAR(200) NOT NULL,
  factor_category VARCHAR(50) NOT NULL, -- performance, engagement, growth, external
  description TEXT,
  weight_default NUMERIC(4,3) DEFAULT 0.100,
  data_source VARCHAR(100), -- table/view name
  is_positive BOOLEAN DEFAULT true, -- true = higher is better
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default prediction factors
INSERT INTO prediction_factors (factor_code, factor_name, factor_category, description, weight_default, data_source, is_positive) VALUES
  -- Performance factors
  ('perf_history', 'Historical Performance', 'performance', 'Average rating over last 3 review cycles', 0.200, 'performance_reviews', true),
  ('goal_completion', 'Goal Completion Rate', 'performance', 'Percentage of goals completed on time', 0.150, 'goals', true),
  ('calibration_trend', 'Calibration Trend', 'performance', 'Direction of calibrated ratings over time', 0.100, 'calibration_adjustments', true),
  ('peer_feedback', '360 Feedback Score', 'performance', 'Average score from peer reviews', 0.100, 'feedback_360', true),

  -- Engagement factors
  ('feedback_given', 'Feedback Activity', 'engagement', 'Frequency of giving continuous feedback', 0.050, 'continuous_feedback', true),
  ('feedback_sentiment', 'Feedback Sentiment', 'engagement', 'Average sentiment of received feedback', 0.050, 'continuous_feedback', true),
  ('self_assess_delta', 'Self-Assessment Accuracy', 'engagement', 'Difference between self and manager ratings', 0.075, 'performance_reviews', false),
  ('checkin_frequency', 'Check-in Frequency', 'engagement', 'Regular goal check-ins and updates', 0.050, 'check_ins', true),

  -- Growth factors
  ('skill_growth', 'Skill Development', 'growth', 'Number of skills acquired/improved', 0.100, 'employee_skill_profiles', true),
  ('training_completion', 'Training Completion', 'growth', 'Percentage of assigned training completed', 0.075, 'enrollments', true),
  ('career_progression', 'Career Progression', 'growth', 'Time since last promotion/role change', 0.025, 'employees', true),

  -- External factors
  ('tenure', 'Tenure', 'external', 'Time with organization (non-linear impact)', 0.025, 'employees', true),
  ('dept_avg', 'Department Average', 'external', 'Performance relative to department average', 0.050, 'performance_reviews', true)
ON CONFLICT (factor_code) DO NOTHING;

-- ============================================================================
-- 3. CREATE PREDICTION ACTIONS REFERENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code VARCHAR(50) NOT NULL UNIQUE,
  action_name VARCHAR(200) NOT NULL,
  action_category VARCHAR(50) NOT NULL, -- training, mentoring, coaching, project, recognition
  description TEXT,
  applicable_risk_levels TEXT[] DEFAULT ARRAY['medium', 'high'],
  applicable_hipo BOOLEAN DEFAULT false, -- Applies to high potentials
  estimated_impact VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  typical_duration VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default actions
INSERT INTO prediction_actions (action_code, action_name, action_category, description, applicable_risk_levels, applicable_hipo, estimated_impact, typical_duration) VALUES
  -- Training actions
  ('skill_training', 'Targeted Skill Training', 'training', 'Enroll in specific skill development courses', ARRAY['medium', 'high'], false, 'medium', '1-3 months'),
  ('leadership_program', 'Leadership Development Program', 'training', 'Enroll in leadership track', ARRAY['low'], true, 'high', '6-12 months'),
  ('certification', 'Professional Certification', 'training', 'Support for industry certification', ARRAY['low', 'medium'], true, 'high', '3-6 months'),

  -- Mentoring actions
  ('mentor_assign', 'Mentor Assignment', 'mentoring', 'Pair with senior mentor for guidance', ARRAY['medium', 'high'], false, 'medium', '6-12 months'),
  ('reverse_mentor', 'Reverse Mentoring', 'mentoring', 'Pair as mentor to leverage strengths', ARRAY['low'], true, 'medium', '6 months'),
  ('peer_coaching', 'Peer Coaching Circle', 'mentoring', 'Join peer coaching group', ARRAY['medium'], false, 'medium', '3-6 months'),

  -- Coaching actions
  ('exec_coaching', 'Executive Coaching', 'coaching', 'One-on-one executive coaching sessions', ARRAY['low'], true, 'high', '6-12 months'),
  ('performance_coaching', 'Performance Coaching', 'coaching', 'Regular coaching sessions with manager', ARRAY['high', 'critical'], false, 'high', '3-6 months'),
  ('pip', 'Performance Improvement Plan', 'coaching', 'Structured improvement plan with milestones', ARRAY['critical'], false, 'high', '90 days'),

  -- Project actions
  ('stretch_assignment', 'Stretch Assignment', 'project', 'High-visibility project opportunity', ARRAY['low'], true, 'high', '3-6 months'),
  ('cross_functional', 'Cross-Functional Project', 'project', 'Lead or participate in cross-dept initiative', ARRAY['low', 'medium'], true, 'medium', '3-6 months'),
  ('rotation', 'Job Rotation', 'project', 'Temporary assignment in different area', ARRAY['low', 'medium'], true, 'high', '3-6 months'),

  -- Recognition actions
  ('spot_recognition', 'Spot Recognition', 'recognition', 'Immediate recognition for achievements', ARRAY['low', 'medium'], false, 'low', 'Immediate'),
  ('talent_pool', 'Talent Pool Inclusion', 'recognition', 'Add to high-potential talent pool', ARRAY['low'], true, 'medium', 'Ongoing'),
  ('succession_track', 'Succession Planning Track', 'recognition', 'Include in succession planning', ARRAY['low'], true, 'high', 'Ongoing')
ON CONFLICT (action_code) DO NOTHING;

-- ============================================================================
-- 4. MODEL ACCURACY TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_model_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  model_version INTEGER NOT NULL,
  prediction_period VARCHAR(20) NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  validated_predictions INTEGER DEFAULT 0,
  mean_absolute_error NUMERIC(5,4),
  root_mean_square_error NUMERIC(5,4),
  accuracy_within_05 NUMERIC(5,4), -- % within 0.5 rating
  accuracy_within_10 NUMERIC(5,4), -- % within 1.0 rating
  hipo_precision NUMERIC(5,4), -- True positive rate for HiPo
  hipo_recall NUMERIC(5,4),
  risk_precision NUMERIC(5,4), -- True positive rate for risk flags
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, model_name, model_version, prediction_period)
);

CREATE INDEX IF NOT EXISTS idx_model_accuracy_tenant ON prediction_model_accuracy(tenant_id);

-- ============================================================================
-- 5. FUNCTION: CALCULATE PERFORMANCE RISK SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calculate_risk_score(
  p_tenant_id UUID,
  p_employee_id UUID
) RETURNS TABLE (
  risk_score INTEGER,
  risk_level VARCHAR,
  contributing_factors JSONB,
  recommended_actions JSONB,
  prediction_confidence NUMERIC
) AS $$
DECLARE
  v_perf_avg NUMERIC;
  v_goal_rate NUMERIC;
  v_feedback_sentiment NUMERIC;
  v_checkin_freq NUMERIC;
  v_dept_avg NUMERIC;
  v_risk_score INTEGER;
  v_factors JSONB := '[]'::JSONB;
  v_actions JSONB := '[]'::JSONB;
  v_confidence NUMERIC := 0.75;
  v_data_points INTEGER := 0;
BEGIN
  -- Get historical performance average (last 3 years)
  SELECT COALESCE(AVG(COALESCE(pr.calibrated_rating, pr.overall_rating)), 3.0)
  INTO v_perf_avg
  FROM performance_reviews pr
  WHERE pr.tenant_id = p_tenant_id
    AND pr.employee_id = p_employee_id
    AND pr.status = 'completed'
    AND pr.review_period >= (NOW() - INTERVAL '3 years');

  IF v_perf_avg IS NOT NULL THEN
    v_data_points := v_data_points + 1;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'perf_history',
      'name', 'Historical Performance',
      'value', ROUND(v_perf_avg, 2),
      'weight', 0.30,
      'impact', CASE WHEN v_perf_avg < 3 THEN 'negative' WHEN v_perf_avg > 4 THEN 'positive' ELSE 'neutral' END
    );
  END IF;

  -- Get goal completion rate
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    50
  )
  INTO v_goal_rate
  FROM goals
  WHERE tenant_id = p_tenant_id
    AND employee_id = p_employee_id
    AND created_at >= (NOW() - INTERVAL '1 year');

  IF v_goal_rate IS NOT NULL THEN
    v_data_points := v_data_points + 1;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'goal_completion',
      'name', 'Goal Completion Rate',
      'value', ROUND(v_goal_rate, 1),
      'weight', 0.20,
      'impact', CASE WHEN v_goal_rate < 50 THEN 'negative' WHEN v_goal_rate > 80 THEN 'positive' ELSE 'neutral' END
    );
  END IF;

  -- Get feedback sentiment (from continuous feedback)
  SELECT COALESCE(AVG(sentiment_score), 0)
  INTO v_feedback_sentiment
  FROM continuous_feedback
  WHERE tenant_id = p_tenant_id
    AND to_employee_id = p_employee_id
    AND created_at >= (NOW() - INTERVAL '6 months');

  IF v_feedback_sentiment IS NOT NULL THEN
    v_data_points := v_data_points + 1;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'feedback_sentiment',
      'name', 'Feedback Sentiment',
      'value', ROUND(v_feedback_sentiment, 2),
      'weight', 0.15,
      'impact', CASE WHEN v_feedback_sentiment < -0.2 THEN 'negative' WHEN v_feedback_sentiment > 0.3 THEN 'positive' ELSE 'neutral' END
    );
  END IF;

  -- Get check-in frequency (per month, normalized)
  SELECT COALESCE(
    COUNT(*)::NUMERIC / GREATEST(EXTRACT(MONTH FROM AGE(NOW(), MIN(created_at))), 1),
    0
  )
  INTO v_checkin_freq
  FROM check_ins
  WHERE tenant_id = p_tenant_id
    AND employee_id = p_employee_id
    AND created_at >= (NOW() - INTERVAL '6 months');

  IF v_checkin_freq > 0 THEN
    v_data_points := v_data_points + 1;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'checkin_frequency',
      'name', 'Check-in Activity',
      'value', ROUND(v_checkin_freq, 1),
      'weight', 0.10,
      'impact', CASE WHEN v_checkin_freq < 1 THEN 'negative' WHEN v_checkin_freq > 4 THEN 'positive' ELSE 'neutral' END
    );
  END IF;

  -- Get department average for comparison
  SELECT AVG(COALESCE(pr.calibrated_rating, pr.overall_rating))
  INTO v_dept_avg
  FROM performance_reviews pr
  JOIN employees e ON pr.employee_id = e.id
  WHERE pr.tenant_id = p_tenant_id
    AND e.department_id = (SELECT department_id FROM employees WHERE id = p_employee_id)
    AND pr.status = 'completed'
    AND pr.review_period >= (NOW() - INTERVAL '1 year');

  -- Calculate risk score (0-100, higher = more risk)
  v_risk_score := GREATEST(0, LEAST(100,
    -- Base score (inverted from 5-point scale)
    ((5 - COALESCE(v_perf_avg, 3)) / 5 * 40)::INTEGER +
    -- Goal completion (inverted)
    ((100 - COALESCE(v_goal_rate, 50)) / 100 * 25)::INTEGER +
    -- Feedback sentiment (inverted, scaled from -1 to 1)
    ((1 - COALESCE(v_feedback_sentiment, 0)) / 2 * 15)::INTEGER +
    -- Check-in activity (inverted, max 8/month)
    ((8 - LEAST(COALESCE(v_checkin_freq, 0), 8)) / 8 * 10)::INTEGER +
    -- Below department average penalty
    (CASE WHEN COALESCE(v_perf_avg, 3) < COALESCE(v_dept_avg, 3) - 0.5 THEN 10 ELSE 0 END)
  ));

  -- Determine risk level
  risk_level := CASE
    WHEN v_risk_score <= 25 THEN 'low'
    WHEN v_risk_score <= 50 THEN 'medium'
    WHEN v_risk_score <= 75 THEN 'high'
    ELSE 'critical'
  END;

  -- Calculate confidence based on data points
  v_confidence := LEAST(0.95, 0.50 + (v_data_points * 0.10));

  -- Generate recommended actions based on risk level
  SELECT jsonb_agg(jsonb_build_object(
    'action_code', pa.action_code,
    'action_name', pa.action_name,
    'category', pa.action_category,
    'description', pa.description,
    'estimated_impact', pa.estimated_impact,
    'typical_duration', pa.typical_duration,
    'priority', ROW_NUMBER() OVER (ORDER BY
      CASE pa.estimated_impact WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    )
  ))
  INTO v_actions
  FROM prediction_actions pa
  WHERE risk_level = ANY(pa.applicable_risk_levels)
  LIMIT 5;

  risk_score := v_risk_score;
  contributing_factors := v_factors;
  recommended_actions := COALESCE(v_actions, '[]'::JSONB);
  prediction_confidence := v_confidence;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCTION: CALCULATE HIPO SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calculate_hipo_score(
  p_tenant_id UUID,
  p_employee_id UUID
) RETURNS TABLE (
  is_high_potential BOOLEAN,
  hipo_score NUMERIC,
  hipo_justification TEXT,
  potential_factors JSONB
) AS $$
DECLARE
  v_perf_trend NUMERIC;
  v_skill_growth INTEGER;
  v_leadership_feedback NUMERIC;
  v_stretch_success NUMERIC;
  v_tenure_years NUMERIC;
  v_age_factor NUMERIC;
  v_hipo_score NUMERIC := 0;
  v_factors JSONB := '[]'::JSONB;
  v_justification TEXT := '';
  v_strengths TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Performance trend (improvement over time)
  SELECT COALESCE(
    (SELECT AVG(COALESCE(calibrated_rating, overall_rating))
     FROM performance_reviews
     WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id
       AND created_at >= (NOW() - INTERVAL '1 year')) -
    (SELECT AVG(COALESCE(calibrated_rating, overall_rating))
     FROM performance_reviews
     WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id
       AND created_at < (NOW() - INTERVAL '1 year')
       AND created_at >= (NOW() - INTERVAL '2 years')),
    0
  ) INTO v_perf_trend;

  IF v_perf_trend > 0.3 THEN
    v_hipo_score := v_hipo_score + 1.0;
    v_strengths := array_append(v_strengths, 'Strong performance improvement trend');
    v_factors := v_factors || jsonb_build_object(
      'factor', 'performance_trend',
      'value', ROUND(v_perf_trend, 2),
      'contribution', 1.0,
      'interpretation', 'Consistently improving performance'
    );
  ELSIF v_perf_trend > 0 THEN
    v_hipo_score := v_hipo_score + 0.5;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'performance_trend',
      'value', ROUND(v_perf_trend, 2),
      'contribution', 0.5,
      'interpretation', 'Positive performance trajectory'
    );
  END IF;

  -- Skill acquisition rate
  SELECT COUNT(*)
  INTO v_skill_growth
  FROM employee_skill_profiles esp
  WHERE esp.tenant_id = p_tenant_id
    AND esp.employee_id = p_employee_id
    AND esp.created_at >= (NOW() - INTERVAL '1 year');

  IF v_skill_growth >= 5 THEN
    v_hipo_score := v_hipo_score + 1.0;
    v_strengths := array_append(v_strengths, 'Rapid skill acquisition');
    v_factors := v_factors || jsonb_build_object(
      'factor', 'skill_growth',
      'value', v_skill_growth,
      'contribution', 1.0,
      'interpretation', 'Exceptional learning agility'
    );
  ELSIF v_skill_growth >= 3 THEN
    v_hipo_score := v_hipo_score + 0.5;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'skill_growth',
      'value', v_skill_growth,
      'contribution', 0.5,
      'interpretation', 'Active skill development'
    );
  END IF;

  -- Leadership-related feedback
  SELECT COALESCE(AVG(
    CASE feedback_type WHEN 'praise' THEN 1 WHEN 'suggestion' THEN 0.5 ELSE 0 END
  ), 0)
  INTO v_leadership_feedback
  FROM continuous_feedback
  WHERE tenant_id = p_tenant_id
    AND to_employee_id = p_employee_id
    AND category IN ('leadership', 'collaboration')
    AND created_at >= (NOW() - INTERVAL '1 year');

  IF v_leadership_feedback > 0.7 THEN
    v_hipo_score := v_hipo_score + 1.0;
    v_strengths := array_append(v_strengths, 'Strong leadership recognition');
    v_factors := v_factors || jsonb_build_object(
      'factor', 'leadership_feedback',
      'value', ROUND(v_leadership_feedback, 2),
      'contribution', 1.0,
      'interpretation', 'Recognized for leadership qualities'
    );
  ELSIF v_leadership_feedback > 0.4 THEN
    v_hipo_score := v_hipo_score + 0.5;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'leadership_feedback',
      'value', ROUND(v_leadership_feedback, 2),
      'contribution', 0.5,
      'interpretation', 'Emerging leadership potential'
    );
  END IF;

  -- Tenure factor (optimal: 2-5 years)
  SELECT EXTRACT(YEAR FROM AGE(NOW(), hire_date))
  INTO v_tenure_years
  FROM employees
  WHERE id = p_employee_id;

  IF v_tenure_years BETWEEN 2 AND 5 THEN
    v_hipo_score := v_hipo_score + 0.5;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'tenure',
      'value', ROUND(v_tenure_years, 1),
      'contribution', 0.5,
      'interpretation', 'Optimal tenure for advancement'
    );
  ELSIF v_tenure_years BETWEEN 1 AND 7 THEN
    v_hipo_score := v_hipo_score + 0.25;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'tenure',
      'value', ROUND(v_tenure_years, 1),
      'contribution', 0.25,
      'interpretation', 'Good tenure range'
    );
  END IF;

  -- High goal achievement
  SELECT COALESCE(
    AVG(CASE WHEN status = 'completed' THEN 1.0 WHEN status = 'in_progress' THEN 0.5 ELSE 0 END),
    0
  )
  INTO v_stretch_success
  FROM goals
  WHERE tenant_id = p_tenant_id
    AND employee_id = p_employee_id
    AND goal_type = 'stretch'
    AND created_at >= (NOW() - INTERVAL '2 years');

  IF v_stretch_success > 0.7 THEN
    v_hipo_score := v_hipo_score + 1.0;
    v_strengths := array_append(v_strengths, 'Successfully completes stretch goals');
    v_factors := v_factors || jsonb_build_object(
      'factor', 'stretch_goals',
      'value', ROUND(v_stretch_success, 2),
      'contribution', 1.0,
      'interpretation', 'Excels at challenging assignments'
    );
  END IF;

  -- Normalize to 0-5 scale
  hipo_score := LEAST(5.0, v_hipo_score);

  -- Determine HiPo status (threshold: 3.0)
  is_high_potential := (hipo_score >= 3.0);

  -- Generate justification
  IF is_high_potential THEN
    v_justification := 'High Potential designation based on: ' ||
      array_to_string(v_strengths, '; ') ||
      '. HiPo Score: ' || ROUND(hipo_score, 2)::TEXT || '/5.0';
  ELSE
    v_justification := 'Employee shows promise but does not yet meet HiPo threshold (3.0). Current score: ' ||
      ROUND(hipo_score, 2)::TEXT || '/5.0. Focus areas for development are available.';
  END IF;

  hipo_justification := v_justification;
  potential_factors := v_factors;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VIEW: EMPLOYEE PREDICTIONS SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW v_employee_predictions AS
SELECT
  pp.id,
  pp.tenant_id,
  pp.employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  e.job_title,
  d.name as department_name,
  pp.prediction_period,
  pp.predicted_rating,
  pp.confidence_interval_low,
  pp.confidence_interval_high,
  pp.risk_score,
  pp.risk_level,
  pp.is_high_potential,
  pp.hipo_score,
  pp.hipo_justification,
  pp.contributing_factors,
  pp.recommended_actions,
  pp.prediction_confidence,
  pp.actual_rating,
  pp.prediction_accuracy,
  pp.model_name,
  pp.model_version,
  pp.created_at,
  pp.validated_at
FROM performance_predictions pp
JOIN employees e ON pp.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE pp.is_current = true;

COMMENT ON VIEW v_employee_predictions IS 'Current predictions with employee details';

-- ============================================================================
-- 8. VIEW: RISK DISTRIBUTION BY DEPARTMENT
-- ============================================================================

CREATE OR REPLACE VIEW v_risk_distribution AS
SELECT
  pp.tenant_id,
  d.id as department_id,
  d.name as department_name,
  COUNT(*) as total_employees,
  COUNT(*) FILTER (WHERE pp.risk_level = 'low') as low_risk,
  COUNT(*) FILTER (WHERE pp.risk_level = 'medium') as medium_risk,
  COUNT(*) FILTER (WHERE pp.risk_level = 'high') as high_risk,
  COUNT(*) FILTER (WHERE pp.risk_level = 'critical') as critical_risk,
  COUNT(*) FILTER (WHERE pp.is_high_potential) as high_potentials,
  ROUND(AVG(pp.risk_score), 1) as avg_risk_score,
  ROUND(AVG(pp.predicted_rating), 2) as avg_predicted_rating
FROM performance_predictions pp
JOIN employees e ON pp.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE pp.is_current = true
GROUP BY pp.tenant_id, d.id, d.name;

COMMENT ON VIEW v_risk_distribution IS 'Risk and HiPo distribution by department';

-- ============================================================================
-- 9. FUNCTION: GENERATE PREDICTIONS FOR TENANT
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_generate_predictions(
  p_tenant_id UUID,
  p_prediction_period VARCHAR(20) DEFAULT NULL
) RETURNS TABLE (
  employees_processed INTEGER,
  predictions_created INTEGER,
  hipos_identified INTEGER,
  high_risk_count INTEGER
) AS $$
DECLARE
  v_period VARCHAR(20);
  v_model_version INTEGER;
  v_processed INTEGER := 0;
  v_created INTEGER := 0;
  v_hipos INTEGER := 0;
  v_high_risk INTEGER := 0;
  v_emp RECORD;
  v_risk RECORD;
  v_hipo RECORD;
BEGIN
  -- Default period to current quarter
  v_period := COALESCE(p_prediction_period, 'Q' || EXTRACT(QUARTER FROM NOW())::TEXT || '-' || EXTRACT(YEAR FROM NOW())::TEXT);

  -- Get next model version
  SELECT COALESCE(MAX(model_version), 0) + 1
  INTO v_model_version
  FROM performance_predictions
  WHERE tenant_id = p_tenant_id;

  -- Mark previous predictions as not current
  UPDATE performance_predictions
  SET is_current = false
  WHERE tenant_id = p_tenant_id
    AND is_current = true;

  -- Process each employee
  FOR v_emp IN
    SELECT id FROM employees
    WHERE tenant_id = p_tenant_id
      AND status = 'active'
  LOOP
    v_processed := v_processed + 1;

    -- Calculate risk score
    SELECT * INTO v_risk FROM fn_calculate_risk_score(p_tenant_id, v_emp.id);

    -- Calculate HiPo score
    SELECT * INTO v_hipo FROM fn_calculate_hipo_score(p_tenant_id, v_emp.id);

    -- Insert prediction
    INSERT INTO performance_predictions (
      tenant_id,
      employee_id,
      prediction_period,
      predicted_rating,
      confidence_interval_low,
      confidence_interval_high,
      risk_score,
      risk_level,
      is_high_potential,
      hipo_score,
      hipo_justification,
      contributing_factors,
      recommended_actions,
      prediction_confidence,
      model_version,
      model_name,
      is_current
    ) VALUES (
      p_tenant_id,
      v_emp.id,
      v_period,
      5.0 - (v_risk.risk_score::NUMERIC / 25), -- Convert risk to predicted rating
      GREATEST(1.0, 5.0 - (v_risk.risk_score::NUMERIC / 25) - 0.5),
      LEAST(5.0, 5.0 - (v_risk.risk_score::NUMERIC / 25) + 0.5),
      v_risk.risk_score,
      v_risk.risk_level,
      v_hipo.is_high_potential,
      v_hipo.hipo_score,
      v_hipo.hipo_justification,
      v_risk.contributing_factors || v_hipo.potential_factors,
      v_risk.recommended_actions,
      v_risk.prediction_confidence,
      v_model_version,
      'heuresys-perf-v1',
      true
    );

    v_created := v_created + 1;

    IF v_hipo.is_high_potential THEN
      v_hipos := v_hipos + 1;
    END IF;

    IF v_risk.risk_level IN ('high', 'critical') THEN
      v_high_risk := v_high_risk + 1;
    END IF;
  END LOOP;

  employees_processed := v_processed;
  predictions_created := v_created;
  hipos_identified := v_hipos;
  high_risk_count := v_high_risk;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. FUNCTION: VALIDATE PREDICTIONS (For Accuracy Tracking)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_validate_predictions(
  p_tenant_id UUID,
  p_prediction_period VARCHAR(20)
) RETURNS TABLE (
  predictions_validated INTEGER,
  mean_absolute_error NUMERIC,
  accuracy_within_05 NUMERIC,
  accuracy_within_10 NUMERIC
) AS $$
DECLARE
  v_validated INTEGER := 0;
  v_mae NUMERIC;
  v_acc_05 NUMERIC;
  v_acc_10 NUMERIC;
BEGIN
  -- Update predictions with actual ratings
  UPDATE performance_predictions pp
  SET
    actual_rating = pr.calibrated_rating,
    prediction_accuracy = 1 - ABS(pp.predicted_rating - pr.calibrated_rating) / 4,
    validated_at = NOW()
  FROM (
    SELECT DISTINCT ON (employee_id)
      employee_id,
      COALESCE(calibrated_rating, overall_rating) as calibrated_rating
    FROM performance_reviews
    WHERE tenant_id = p_tenant_id
      AND status = 'completed'
      AND review_period = p_prediction_period
    ORDER BY employee_id, created_at DESC
  ) pr
  WHERE pp.tenant_id = p_tenant_id
    AND pp.prediction_period = p_prediction_period
    AND pp.employee_id = pr.employee_id
    AND pp.actual_rating IS NULL;

  GET DIAGNOSTICS v_validated = ROW_COUNT;

  -- Calculate accuracy metrics
  SELECT
    ROUND(AVG(ABS(predicted_rating - actual_rating)), 4),
    ROUND(COUNT(*) FILTER (WHERE ABS(predicted_rating - actual_rating) <= 0.5)::NUMERIC / NULLIF(COUNT(*), 0), 4),
    ROUND(COUNT(*) FILTER (WHERE ABS(predicted_rating - actual_rating) <= 1.0)::NUMERIC / NULLIF(COUNT(*), 0), 4)
  INTO v_mae, v_acc_05, v_acc_10
  FROM performance_predictions
  WHERE tenant_id = p_tenant_id
    AND prediction_period = p_prediction_period
    AND actual_rating IS NOT NULL;

  -- Store in accuracy tracking table
  INSERT INTO prediction_model_accuracy (
    tenant_id, model_name, model_version, prediction_period,
    total_predictions, validated_predictions,
    mean_absolute_error, accuracy_within_05, accuracy_within_10
  )
  SELECT
    p_tenant_id,
    model_name,
    model_version,
    p_prediction_period,
    COUNT(*),
    COUNT(*) FILTER (WHERE actual_rating IS NOT NULL),
    v_mae,
    v_acc_05,
    v_acc_10
  FROM performance_predictions
  WHERE tenant_id = p_tenant_id
    AND prediction_period = p_prediction_period
  GROUP BY model_name, model_version
  ON CONFLICT (tenant_id, model_name, model_version, prediction_period)
  DO UPDATE SET
    validated_predictions = EXCLUDED.validated_predictions,
    mean_absolute_error = EXCLUDED.mean_absolute_error,
    accuracy_within_05 = EXCLUDED.accuracy_within_05,
    accuracy_within_10 = EXCLUDED.accuracy_within_10,
    calculated_at = NOW();

  predictions_validated := v_validated;
  mean_absolute_error := v_mae;
  accuracy_within_05 := v_acc_05;
  accuracy_within_10 := v_acc_10;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
