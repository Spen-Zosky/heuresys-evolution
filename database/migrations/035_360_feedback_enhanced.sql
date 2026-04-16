-- Migration 035: 360 Feedback Enhanced
-- Sprint 2025-05: S-PERF-01-04 360 Feedback Collection
-- Created: 2025-12-26

-- ============================================================================
-- 1. ADD ANONYMITY CONFIG TO REVIEW CYCLES
-- ============================================================================

ALTER TABLE review_cycles
ADD COLUMN IF NOT EXISTS feedback_360_anonymous BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS feedback_360_min_responses INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS feedback_360_deadline DATE;

COMMENT ON COLUMN review_cycles.feedback_360_anonymous IS 'Whether 360 feedback is anonymous for this cycle';
COMMENT ON COLUMN review_cycles.feedback_360_min_responses IS 'Minimum responses before showing aggregated results';

-- ============================================================================
-- 2. FEEDBACK QUESTIONNAIRE TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_360_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  relationship_types TEXT[] DEFAULT ARRAY['manager', 'peer', 'direct_report', 'self'],
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_360_questionnaires_tenant ON feedback_360_questionnaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_questionnaires_active ON feedback_360_questionnaires(is_active);

COMMENT ON TABLE feedback_360_questionnaires IS 'Customizable questionnaire templates for 360 feedback';

-- ============================================================================
-- 3. FEEDBACK QUESTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_360_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES feedback_360_questionnaires(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) DEFAULT 'rating', -- rating, text, multiple_choice
  category VARCHAR(100), -- leadership, teamwork, communication, etc.
  ksaba_dimension VARCHAR(20), -- knowledge, skills, abilities, behaviors, attitudes
  competency_id UUID, -- optional link to competency
  options JSONB, -- for multiple choice: ["option1", "option2", ...]
  rating_scale_min INTEGER DEFAULT 1,
  rating_scale_max INTEGER DEFAULT 5,
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  relationship_types TEXT[], -- which relationship types see this question
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_360_questions_questionnaire ON feedback_360_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_questions_category ON feedback_360_questions(category);

COMMENT ON TABLE feedback_360_questions IS 'Individual questions within a 360 questionnaire';

-- ============================================================================
-- 4. ENHANCE FEEDBACK_360 TABLE
-- ============================================================================

ALTER TABLE feedback_360
ADD COLUMN IF NOT EXISTS questionnaire_id UUID REFERENCES feedback_360_questionnaires(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS performance_review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES feedback_requests(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS question_responses JSONB,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS submission_time_seconds INTEGER;

COMMENT ON COLUMN feedback_360.question_responses IS 'JSONB with question_id -> response pairs';
COMMENT ON COLUMN feedback_360.sentiment_score IS 'AI-calculated sentiment (-1 to 1)';

-- ============================================================================
-- 5. UPDATE FEEDBACK_REQUESTS TABLE
-- ============================================================================

ALTER TABLE feedback_requests
ADD COLUMN IF NOT EXISTS review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS performance_review_id UUID REFERENCES performance_reviews(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS questionnaire_id UUID REFERENCES feedback_360_questionnaires(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS feedback_360_id UUID REFERENCES feedback_360(id) ON DELETE SET NULL;

COMMENT ON COLUMN feedback_requests.relationship_type IS 'Type: manager, peer, direct_report, self';

-- ============================================================================
-- 6. PEER SUGGESTION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_360_peer_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  suggested_peer_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE SET NULL,
  suggestion_source VARCHAR(50) DEFAULT 'algorithm', -- algorithm, self, manager
  relationship_type VARCHAR(50), -- peer, cross_functional, project_based
  confidence_score NUMERIC(3,2), -- 0-1 confidence in suggestion
  reason TEXT,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, target_employee_id, suggested_peer_id, review_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_suggestions_target ON feedback_360_peer_suggestions(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_peer_suggestions_cycle ON feedback_360_peer_suggestions(review_cycle_id);

COMMENT ON TABLE feedback_360_peer_suggestions IS 'Algorithm-suggested and selected peers for 360 feedback';

-- ============================================================================
-- 7. VIEW: RESPONSE RATES BY CYCLE
-- ============================================================================

CREATE OR REPLACE VIEW v_360_response_rates AS
SELECT
  rc.id as review_cycle_id,
  rc.tenant_id,
  rc.name as cycle_name,
  COUNT(DISTINCT fr.id) as total_requests,
  COUNT(DISTINCT CASE WHEN fr.status = 'completed' THEN fr.id END) as completed_requests,
  ROUND(
    COUNT(DISTINCT CASE WHEN fr.status = 'completed' THEN fr.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT fr.id), 0) * 100,
    2
  ) as response_rate,
  COUNT(DISTINCT fr.requestee_id) as total_employees,
  COUNT(DISTINCT CASE WHEN fr.status = 'pending' THEN fr.reviewer_id END) as pending_reviewers,
  AVG(CASE WHEN f.id IS NOT NULL THEN f.overall_rating END) as avg_rating
FROM review_cycles rc
LEFT JOIN feedback_requests fr ON rc.id = fr.review_cycle_id
LEFT JOIN feedback_360 f ON fr.feedback_360_id = f.id
WHERE rc.include_360_feedback = true
GROUP BY rc.id, rc.tenant_id, rc.name;

COMMENT ON VIEW v_360_response_rates IS 'Response rates for 360 feedback by review cycle';

-- ============================================================================
-- 8. VIEW: EMPLOYEE FEEDBACK SUMMARY (Anonymized)
-- ============================================================================

CREATE OR REPLACE VIEW v_360_feedback_summary AS
SELECT
  f.tenant_id,
  f.target_employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  f.review_cycle_id,
  rc.name as cycle_name,
  f.relationship_type,
  COUNT(*) as response_count,
  ROUND(AVG(f.overall_rating), 2) as avg_rating,
  ROUND(STDDEV(f.overall_rating), 2) as rating_stddev,
  ROUND(AVG(f.sentiment_score), 2) as avg_sentiment,
  -- Only show detailed breakdown if enough responses (anonymity protection)
  CASE
    WHEN COUNT(*) >= COALESCE(rc.feedback_360_min_responses, 3) THEN
      jsonb_build_object(
        'min_rating', MIN(f.overall_rating),
        'max_rating', MAX(f.overall_rating),
        'median_rating', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY f.overall_rating)
      )
    ELSE NULL
  END as rating_distribution
FROM feedback_360 f
JOIN employees e ON f.target_employee_id = e.id
LEFT JOIN review_cycles rc ON f.review_cycle_id = rc.id
WHERE f.status = 'completed'
GROUP BY f.tenant_id, f.target_employee_id, e.first_name, e.last_name,
         f.review_cycle_id, rc.name, f.relationship_type, rc.feedback_360_min_responses;

COMMENT ON VIEW v_360_feedback_summary IS 'Aggregated 360 feedback summary with anonymity protection';

-- ============================================================================
-- 9. FUNCTION: IDENTIFY SUGGESTED PEERS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_identify_360_peers(
  p_tenant_id UUID,
  p_employee_id UUID,
  p_review_cycle_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  peer_id UUID,
  peer_name TEXT,
  peer_department TEXT,
  relationship_type VARCHAR,
  confidence_score NUMERIC,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH employee_info AS (
    SELECT department_id, manager_id, job_title FROM employees WHERE id = p_employee_id
  ),
  -- Direct reports
  direct_reports AS (
    SELECT
      e.id as peer_id,
      e.first_name || ' ' || e.last_name as peer_name,
      d.name as department_name,
      'direct_report'::VARCHAR as rel_type,
      0.95::NUMERIC as score,
      'Direct report'::TEXT as reason
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.manager_id = p_employee_id AND e.tenant_id = p_tenant_id AND e.is_active = true
    LIMIT 5
  ),
  -- Same department peers
  department_peers AS (
    SELECT
      e.id as peer_id,
      e.first_name || ' ' || e.last_name as peer_name,
      d.name as department_name,
      'peer'::VARCHAR as rel_type,
      0.80::NUMERIC as score,
      'Same department'::TEXT as reason
    FROM employees e
    JOIN employee_info ei ON e.department_id = ei.department_id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.id != p_employee_id AND e.tenant_id = p_tenant_id AND e.is_active = true
    LIMIT 5
  ),
  -- Project collaborators (from goals with same parent)
  project_peers AS (
    SELECT DISTINCT
      g2.employee_id as peer_id,
      e.first_name || ' ' || e.last_name as peer_name,
      d.name as department_name,
      'cross_functional'::VARCHAR as rel_type,
      0.70::NUMERIC as score,
      'Goal collaboration'::TEXT as reason
    FROM goals g1
    JOIN goals g2 ON g1.parent_goal_id = g2.parent_goal_id AND g1.employee_id != g2.employee_id
    JOIN employees e ON g2.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE g1.employee_id = p_employee_id
      AND g1.tenant_id = p_tenant_id
      AND e.is_active = true
    LIMIT 5
  ),
  -- Manager
  manager AS (
    SELECT
      ei.manager_id as peer_id,
      e.first_name || ' ' || e.last_name as peer_name,
      d.name as department_name,
      'manager'::VARCHAR as rel_type,
      1.0::NUMERIC as score,
      'Direct manager'::TEXT as reason
    FROM employee_info ei
    JOIN employees e ON ei.manager_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE ei.manager_id IS NOT NULL
  )
  SELECT * FROM manager
  UNION ALL
  SELECT * FROM direct_reports
  UNION ALL
  SELECT * FROM department_peers
  UNION ALL
  SELECT * FROM project_peers
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_identify_360_peers IS 'Automatically identifies suggested peers for 360 feedback based on org structure and collaboration';

-- ============================================================================
-- 10. INSERT DEFAULT QUESTIONNAIRE
-- ============================================================================

INSERT INTO feedback_360_questionnaires (tenant_id, name, description, is_default, relationship_types)
SELECT
  t.id,
  'Standard 360 Feedback',
  'Default questionnaire for comprehensive 360 feedback covering core competencies',
  true,
  ARRAY['manager', 'peer', 'direct_report', 'self']
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM feedback_360_questionnaires q WHERE q.tenant_id = t.id AND q.is_default = true
);

-- Insert default questions for each tenant's default questionnaire
INSERT INTO feedback_360_questions (tenant_id, questionnaire_id, question_text, question_type, category, display_order, relationship_types)
SELECT
  q.tenant_id,
  q.id,
  question.text,
  question.type,
  question.category,
  question.display_order,
  ARRAY['manager', 'peer', 'direct_report', 'self']
FROM feedback_360_questionnaires q
CROSS JOIN (VALUES
  ('How effectively does this person communicate ideas and information?', 'rating', 'Communication', 1),
  ('How well does this person collaborate with team members?', 'rating', 'Teamwork', 2),
  ('How effectively does this person demonstrate leadership qualities?', 'rating', 'Leadership', 3),
  ('How well does this person handle challenges and solve problems?', 'rating', 'Problem Solving', 4),
  ('How reliable and consistent is this person in delivering results?', 'rating', 'Reliability', 5),
  ('What are this person''s key strengths?', 'text', 'Strengths', 6),
  ('What areas could this person improve upon?', 'text', 'Development', 7)
) AS question(text, type, category, display_order)
WHERE q.is_default = true
AND NOT EXISTS (
  SELECT 1 FROM feedback_360_questions fq WHERE fq.questionnaire_id = q.id
);

-- ============================================================================
-- 11. RLS POLICIES
-- ============================================================================

ALTER TABLE feedback_360_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_peer_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON feedback_360_questionnaires
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON feedback_360_questions
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON feedback_360_peer_suggestions
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
