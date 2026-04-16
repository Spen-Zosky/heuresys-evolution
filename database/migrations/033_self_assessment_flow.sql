-- Migration 033: Self-Assessment Flow Enhancement
-- Sprint 2025-05: S-PERF-01-02 Self-Assessment Flow
-- Created: 2025-12-26

-- ============================================================================
-- 1. SELF-ASSESSMENT EVIDENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_assessment_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50) NOT NULL, -- document, link, certification, project, achievement
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(500),
  external_link VARCHAR(500),
  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  related_competency VARCHAR(100), -- links to KSABA dimension
  date_achieved DATE,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_assessment_evidence_review ON self_assessment_evidence(performance_review_id);
CREATE INDEX IF NOT EXISTS idx_self_assessment_evidence_employee ON self_assessment_evidence(employee_id);
CREATE INDEX IF NOT EXISTS idx_self_assessment_evidence_tenant ON self_assessment_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_self_assessment_evidence_goal ON self_assessment_evidence(related_goal_id);

COMMENT ON TABLE self_assessment_evidence IS 'Evidence attachments for self-assessment: documents, links, certifications, achievements';

-- ============================================================================
-- 2. ENHANCE SELF_REVIEWS TABLE (if exists)
-- ============================================================================

-- Check if self_reviews table exists and add columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'self_reviews') THEN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'self_reviews' AND column_name = 'goal_ratings') THEN
      ALTER TABLE self_reviews ADD COLUMN goal_ratings JSONB;
      COMMENT ON COLUMN self_reviews.goal_ratings IS 'JSON array of {goal_id, rating, self_comment, achievement_description}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'self_reviews' AND column_name = 'ksaba_ratings') THEN
      ALTER TABLE self_reviews ADD COLUMN ksaba_ratings JSONB;
      COMMENT ON COLUMN self_reviews.ksaba_ratings IS 'JSON with KSABA dimension ratings: {knowledge, skills, abilities, behaviors, attitudes}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'self_reviews' AND column_name = 'evidence_count') THEN
      ALTER TABLE self_reviews ADD COLUMN evidence_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'self_reviews' AND column_name = 'last_saved_at') THEN
      ALTER TABLE self_reviews ADD COLUMN last_saved_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. GOAL REVIEW RATINGS TABLE (for detailed goal-by-goal rating)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_review_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  self_rating NUMERIC(3,2),
  self_comment TEXT,
  achievement_description TEXT,
  manager_rating NUMERIC(3,2),
  manager_comment TEXT,
  weight NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(performance_review_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_review_ratings_review ON goal_review_ratings(performance_review_id);
CREATE INDEX IF NOT EXISTS idx_goal_review_ratings_goal ON goal_review_ratings(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_review_ratings_employee ON goal_review_ratings(employee_id);

COMMENT ON TABLE goal_review_ratings IS 'Individual goal ratings during performance review for both self and manager assessment';

-- ============================================================================
-- 4. COMPETENCY REVIEW RATINGS TABLE (KSABA dimensions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS competency_review_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  competency_id UUID, -- references competencies table if exists
  ksaba_dimension VARCHAR(20), -- knowledge, skills, abilities, behaviors, attitudes
  competency_name VARCHAR(100) NOT NULL,
  self_rating NUMERIC(3,2),
  self_comment TEXT,
  self_evidence TEXT[],
  manager_rating NUMERIC(3,2),
  manager_comment TEXT,
  weight NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(performance_review_id, competency_name)
);

CREATE INDEX IF NOT EXISTS idx_competency_review_ratings_review ON competency_review_ratings(performance_review_id);
CREATE INDEX IF NOT EXISTS idx_competency_review_ratings_dimension ON competency_review_ratings(ksaba_dimension);
CREATE INDEX IF NOT EXISTS idx_competency_review_ratings_employee ON competency_review_ratings(employee_id);

COMMENT ON TABLE competency_review_ratings IS 'Competency ratings by KSABA dimension for self and manager assessment';

-- ============================================================================
-- 5. UPDATE PERFORMANCE_REVIEWS FOR SELF-ASSESSMENT TRACKING
-- ============================================================================

ALTER TABLE performance_reviews
ADD COLUMN IF NOT EXISTS self_assessment_status VARCHAR(20) DEFAULT 'not_started', -- not_started, in_progress, submitted
ADD COLUMN IF NOT EXISTS self_assessment_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS goals_auto_populated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS goals_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS competencies_count INTEGER DEFAULT 0;

-- ============================================================================
-- 6. VIEW FOR MY REVIEWS (EMPLOYEE SELF-SERVICE)
-- ============================================================================

CREATE OR REPLACE VIEW v_my_performance_reviews AS
SELECT
  pr.id,
  pr.tenant_id,
  pr.employee_id,
  pr.reviewer_id,
  r.first_name || ' ' || r.last_name as reviewer_name,
  pr.review_cycle_id,
  rc.name as cycle_name,
  rc.cycle_type,
  pr.review_period_start,
  pr.review_period_end,
  pr.review_type,
  pr.status,
  pr.self_assessment_status,
  pr.self_rating,
  pr.self_comments,
  pr.self_submitted_at,
  pr.overall_rating,
  pr.goal_achievement_rating,
  pr.competency_rating,
  pr.manager_comments,
  pr.manager_submitted_at,
  pr.calibrated_rating,
  pr.finalized_at,
  pr.acknowledged_at,
  pr.goals_count,
  pr.competencies_count,
  rcp.current_phase,
  rcp.self_review_completed,
  rcp.manager_review_completed,
  rcp.finalized,
  t.name as template_name,
  t.sections as template_sections,
  t.rating_scale_type,
  t.rating_scale_config
FROM performance_reviews pr
LEFT JOIN employees r ON pr.reviewer_id = r.id
LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
LEFT JOIN review_cycle_participants rcp ON pr.review_cycle_id = rcp.review_cycle_id AND pr.employee_id = rcp.employee_id
LEFT JOIN performance_review_templates t ON pr.template_id = t.id;

COMMENT ON VIEW v_my_performance_reviews IS 'Employee-centric view of performance reviews for self-service portal';

-- ============================================================================
-- 7. FUNCTION TO GET EMPLOYEE GOALS FOR REVIEW PERIOD
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_get_review_period_goals(
  p_tenant_id UUID,
  p_employee_id UUID,
  p_period_start DATE,
  p_period_end DATE
) RETURNS TABLE (
  goal_id UUID,
  title VARCHAR,
  description TEXT,
  goal_type VARCHAR,
  start_date DATE,
  due_date DATE,
  status VARCHAR,
  progress_percent INTEGER,
  weight NUMERIC,
  category VARCHAR,
  parent_goal_id UUID,
  parent_goal_title VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id as goal_id,
    g.title,
    g.description,
    g.goal_type,
    g.start_date,
    g.due_date,
    g.status,
    g.progress_percent,
    g.weight,
    g.category,
    g.parent_goal_id,
    pg.title as parent_goal_title
  FROM goals g
  LEFT JOIN goals pg ON g.parent_goal_id = pg.id
  WHERE g.tenant_id = p_tenant_id
    AND g.employee_id = p_employee_id
    AND (
      -- Goals that overlap with the review period
      (g.start_date <= p_period_end AND COALESCE(g.due_date, p_period_end) >= p_period_start)
      OR
      -- Goals due within the review period
      (g.due_date BETWEEN p_period_start AND p_period_end)
    )
  ORDER BY g.due_date, g.weight DESC, g.title;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_get_review_period_goals IS 'Returns all goals for an employee that fall within a performance review period';

-- ============================================================================
-- 8. FUNCTION TO AUTO-POPULATE GOAL RATINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_populate_goal_ratings(
  p_tenant_id UUID,
  p_review_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_employee_id UUID;
  v_period_start DATE;
  v_period_end DATE;
  v_count INTEGER := 0;
BEGIN
  -- Get review details
  SELECT employee_id, review_period_start, review_period_end
  INTO v_employee_id, v_period_start, v_period_end
  FROM performance_reviews
  WHERE id = p_review_id AND tenant_id = p_tenant_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Performance review not found';
  END IF;

  -- Insert goal ratings for all period goals
  INSERT INTO goal_review_ratings (tenant_id, performance_review_id, goal_id, employee_id, weight)
  SELECT
    p_tenant_id,
    p_review_id,
    g.goal_id,
    v_employee_id,
    g.weight
  FROM fn_get_review_period_goals(p_tenant_id, v_employee_id, v_period_start, v_period_end) g
  WHERE NOT EXISTS (
    SELECT 1 FROM goal_review_ratings grr
    WHERE grr.performance_review_id = p_review_id AND grr.goal_id = g.goal_id
  )
  ON CONFLICT (performance_review_id, goal_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update performance review with goal count
  UPDATE performance_reviews
  SET goals_auto_populated = true,
      goals_count = (SELECT COUNT(*) FROM goal_review_ratings WHERE performance_review_id = p_review_id),
      updated_at = NOW()
  WHERE id = p_review_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_auto_populate_goal_ratings IS 'Auto-populates goal ratings for a performance review from the employee goals table';

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

ALTER TABLE self_assessment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_review_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_review_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON self_assessment_evidence
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON goal_review_ratings
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON competency_review_ratings
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
