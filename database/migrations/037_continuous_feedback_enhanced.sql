-- Migration 037: Continuous Feedback Enhanced
-- Sprint 2025-05: S-PERF-01-06 Continuous Feedback
-- Created: 2025-12-26

-- ============================================================================
-- 1. ENHANCE CONTINUOUS_FEEDBACK TABLE
-- ============================================================================

ALTER TABLE continuous_feedback
ADD COLUMN IF NOT EXISTS competency_id UUID,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private', -- private, team, public
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS performance_review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL;

COMMENT ON COLUMN continuous_feedback.competency_id IS 'Optional link to a competency being praised/improved';
COMMENT ON COLUMN continuous_feedback.sentiment_score IS 'AI-calculated sentiment (-1 to 1)';
COMMENT ON COLUMN continuous_feedback.visibility IS 'Visibility level: private (only recipient), team (team members), public (everyone)';
COMMENT ON COLUMN continuous_feedback.category IS 'Category: collaboration, leadership, technical, communication, etc.';

-- Add index for visibility (for public wall queries)
CREATE INDEX IF NOT EXISTS idx_continuous_feedback_visibility ON continuous_feedback(visibility);
CREATE INDEX IF NOT EXISTS idx_continuous_feedback_type ON continuous_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_continuous_feedback_created ON continuous_feedback(created_at DESC);

-- ============================================================================
-- 2. VIEW: PUBLIC PRAISE WALL
-- ============================================================================

CREATE OR REPLACE VIEW v_feedback_wall AS
SELECT
  cf.id,
  cf.tenant_id,
  cf.from_employee_id,
  f.first_name || ' ' || f.last_name as from_name,
  f.job_title as from_job_title,
  cf.to_employee_id,
  t.first_name || ' ' || t.last_name as to_name,
  t.job_title as to_job_title,
  d.name as to_department,
  cf.feedback_type,
  cf.message,
  cf.category,
  cf.tags,
  cf.created_at,
  cf.acknowledged,
  g.title as related_goal_title
FROM continuous_feedback cf
JOIN employees f ON cf.from_employee_id = f.id
JOIN employees t ON cf.to_employee_id = t.id
LEFT JOIN departments d ON t.department_id = d.id
LEFT JOIN goals g ON cf.related_goal_id = g.id
WHERE cf.visibility = 'public'
  AND cf.feedback_type = 'praise'
ORDER BY cf.created_at DESC;

COMMENT ON VIEW v_feedback_wall IS 'Public praise wall showing kudos and recognition';

-- ============================================================================
-- 3. VIEW: FEEDBACK SUMMARY BY EMPLOYEE
-- ============================================================================

CREATE OR REPLACE VIEW v_feedback_summary AS
SELECT
  cf.tenant_id,
  cf.to_employee_id as employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  COUNT(*) as total_received,
  COUNT(*) FILTER (WHERE cf.feedback_type = 'praise') as praise_count,
  COUNT(*) FILTER (WHERE cf.feedback_type = 'suggestion') as suggestion_count,
  COUNT(*) FILTER (WHERE cf.feedback_type = 'concern') as concern_count,
  COUNT(*) FILTER (WHERE cf.visibility = 'public') as public_count,
  ROUND(AVG(cf.sentiment_score), 2) as avg_sentiment,
  MAX(cf.created_at) as last_feedback_at,
  COUNT(DISTINCT cf.from_employee_id) as unique_givers
FROM continuous_feedback cf
JOIN employees e ON cf.to_employee_id = e.id
GROUP BY cf.tenant_id, cf.to_employee_id, e.first_name, e.last_name;

COMMENT ON VIEW v_feedback_summary IS 'Summary of feedback received by each employee';

-- ============================================================================
-- 4. VIEW: FEEDBACK GIVEN SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW v_feedback_given_summary AS
SELECT
  cf.tenant_id,
  cf.from_employee_id as employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  COUNT(*) as total_given,
  COUNT(*) FILTER (WHERE cf.feedback_type = 'praise') as praise_given,
  COUNT(*) FILTER (WHERE cf.feedback_type = 'suggestion') as suggestion_given,
  COUNT(*) FILTER (WHERE cf.feedback_type = 'concern') as concern_given,
  COUNT(DISTINCT cf.to_employee_id) as unique_recipients,
  MAX(cf.created_at) as last_feedback_given
FROM continuous_feedback cf
JOIN employees e ON cf.from_employee_id = e.id
GROUP BY cf.tenant_id, cf.from_employee_id, e.first_name, e.last_name;

COMMENT ON VIEW v_feedback_given_summary IS 'Summary of feedback given by each employee';

-- ============================================================================
-- 5. FUNCTION: GET FEEDBACK FOR PERFORMANCE REVIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_get_feedback_for_review(
  p_tenant_id UUID,
  p_employee_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
  feedback_id UUID,
  from_employee_name TEXT,
  feedback_type VARCHAR,
  message TEXT,
  category VARCHAR,
  related_goal_title TEXT,
  created_at TIMESTAMPTZ,
  sentiment_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cf.id as feedback_id,
    (f.first_name || ' ' || f.last_name)::TEXT as from_employee_name,
    cf.feedback_type,
    cf.message,
    cf.category,
    g.title::TEXT as related_goal_title,
    cf.created_at::TIMESTAMPTZ,
    cf.sentiment_score
  FROM continuous_feedback cf
  JOIN employees f ON cf.from_employee_id = f.id
  LEFT JOIN goals g ON cf.related_goal_id = g.id
  WHERE cf.tenant_id = p_tenant_id
    AND cf.to_employee_id = p_employee_id
    AND (p_start_date IS NULL OR cf.created_at >= p_start_date)
    AND (p_end_date IS NULL OR cf.created_at <= p_end_date)
  ORDER BY cf.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_get_feedback_for_review IS 'Get all continuous feedback for an employee within a date range (for performance review aggregation)';

-- ============================================================================
-- 6. FEEDBACK CATEGORIES REFERENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_categories_tenant ON feedback_categories(tenant_id);

COMMENT ON TABLE feedback_categories IS 'Configurable categories for continuous feedback';

-- Insert default categories
INSERT INTO feedback_categories (tenant_id, name, description, icon, display_order)
SELECT
  t.id,
  category.name,
  category.description,
  category.icon,
  category.display_order
FROM tenants t
CROSS JOIN (VALUES
  ('Collaboration', 'Teamwork and cross-functional collaboration', 'users', 1),
  ('Leadership', 'Leadership and mentoring', 'crown', 2),
  ('Technical', 'Technical skills and problem solving', 'code', 3),
  ('Communication', 'Written and verbal communication', 'message-circle', 4),
  ('Innovation', 'Creative thinking and new ideas', 'lightbulb', 5),
  ('Customer Focus', 'Customer service and satisfaction', 'heart', 6),
  ('Results', 'Achieving goals and delivering results', 'target', 7),
  ('Growth', 'Learning and professional development', 'trending-up', 8)
) AS category(name, description, icon, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM feedback_categories fc WHERE fc.tenant_id = t.id
);

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

ALTER TABLE feedback_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON feedback_categories
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
