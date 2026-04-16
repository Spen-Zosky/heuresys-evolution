-- Migration 039: Performance-Skill Integration
-- Sprint 2025-05: S-PERF-01-10 Performance-Skill Integration
-- Created: 2025-12-26

-- ============================================================================
-- 1. CREATE PERFORMANCE-SKILL LINKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_skill_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  competency_name VARCHAR(200) NOT NULL,
  competency_rating NUMERIC(3,2),
  rating_level VARCHAR(20), -- low, medium, high
  linked_skill_id UUID REFERENCES esco_skills(id) ON DELETE SET NULL,
  linked_gap_analysis_id UUID REFERENCES skill_gap_analyses(id) ON DELETE SET NULL,
  recommended_actions JSONB DEFAULT '[]'::JSONB,
  learning_path_id UUID,
  mentor_recommendation_id UUID,
  is_addressed BOOLEAN DEFAULT false,
  addressed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(performance_review_id, competency_name)
);

CREATE INDEX IF NOT EXISTS idx_perf_skill_links_tenant ON performance_skill_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_skill_links_employee ON performance_skill_links(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_skill_links_rating ON performance_skill_links(rating_level) WHERE rating_level = 'low';

COMMENT ON TABLE performance_skill_links IS 'Links between performance review competencies and skill development actions';

-- ============================================================================
-- 2. CREATE MENTOR MATCH SCORES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mentor_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES esco_skills(id) ON DELETE SET NULL,
  skill_name VARCHAR(200),
  mentee_level NUMERIC(3,2),
  mentor_level NUMERIC(3,2),
  match_score NUMERIC(5,4), -- 0 to 1
  match_factors JSONB DEFAULT '{}'::JSONB,
  is_recommended BOOLEAN DEFAULT false,
  recommendation_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  UNIQUE(mentee_id, mentor_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_match_mentee ON mentor_match_scores(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentor_match_skill ON mentor_match_scores(skill_id);
CREATE INDEX IF NOT EXISTS idx_mentor_match_score ON mentor_match_scores(match_score DESC);

COMMENT ON TABLE mentor_match_scores IS 'AI-calculated mentor match scores based on skill gap and strengths';

-- ============================================================================
-- 3. FUNCTION: AUTO-LINK PERFORMANCE TO SKILLS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_link_performance_to_skills(
  p_tenant_id UUID,
  p_performance_review_id UUID
) RETURNS TABLE (
  competencies_processed INTEGER,
  low_ratings_found INTEGER,
  skills_linked INTEGER,
  gap_analyses_triggered INTEGER
) AS $$
DECLARE
  v_employee_id UUID;
  v_section JSONB;
  v_competency JSONB;
  v_processed INTEGER := 0;
  v_low INTEGER := 0;
  v_linked INTEGER := 0;
  v_gaps INTEGER := 0;
  v_skill_id UUID;
  v_rating NUMERIC;
  v_rating_level VARCHAR(20);
BEGIN
  -- Get employee ID from the review
  SELECT employee_id INTO v_employee_id
  FROM performance_reviews
  WHERE id = p_performance_review_id AND tenant_id = p_tenant_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Performance review not found';
  END IF;

  -- Process section_ratings JSONB (competencies are typically stored here)
  FOR v_section IN
    SELECT jsonb_array_elements(section_ratings)
    FROM performance_reviews
    WHERE id = p_performance_review_id
  LOOP
    v_processed := v_processed + 1;

    -- Extract rating and name
    v_rating := (v_section->>'rating')::NUMERIC;

    -- Determine rating level
    v_rating_level := CASE
      WHEN v_rating <= 2 THEN 'low'
      WHEN v_rating <= 3.5 THEN 'medium'
      ELSE 'high'
    END;

    -- Try to find matching skill in ESCO
    SELECT id INTO v_skill_id
    FROM esco_skills
    WHERE LOWER(preferred_label_en) = LOWER(v_section->>'name')
      OR LOWER(preferred_label_en) LIKE '%' || LOWER(v_section->>'name') || '%'
    LIMIT 1;

    -- Insert link
    INSERT INTO performance_skill_links (
      tenant_id,
      performance_review_id,
      employee_id,
      competency_name,
      competency_rating,
      rating_level,
      linked_skill_id,
      recommended_actions
    ) VALUES (
      p_tenant_id,
      p_performance_review_id,
      v_employee_id,
      v_section->>'name',
      v_rating,
      v_rating_level,
      v_skill_id,
      CASE WHEN v_rating_level = 'low' THEN
        jsonb_build_array(
          jsonb_build_object(
            'type', 'training',
            'priority', 'high',
            'description', 'Enroll in training for ' || (v_section->>'name')
          ),
          jsonb_build_object(
            'type', 'mentoring',
            'priority', 'medium',
            'description', 'Find mentor with expertise in ' || (v_section->>'name')
          )
        )
      ELSE '[]'::JSONB END
    )
    ON CONFLICT (performance_review_id, competency_name) DO UPDATE SET
      competency_rating = EXCLUDED.competency_rating,
      rating_level = EXCLUDED.rating_level,
      linked_skill_id = EXCLUDED.linked_skill_id,
      recommended_actions = EXCLUDED.recommended_actions;

    IF v_skill_id IS NOT NULL THEN
      v_linked := v_linked + 1;
    END IF;

    IF v_rating_level = 'low' THEN
      v_low := v_low + 1;
    END IF;
  END LOOP;

  competencies_processed := v_processed;
  low_ratings_found := v_low;
  skills_linked := v_linked;
  gap_analyses_triggered := v_gaps;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. FUNCTION: TRIGGER GAP ANALYSIS FOR LOW COMPETENCIES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_trigger_gap_analysis_for_low_ratings(
  p_tenant_id UUID,
  p_employee_id UUID
) RETURNS TABLE (
  gap_analysis_id UUID,
  skill_gaps_count INTEGER,
  priority_skills JSONB
) AS $$
DECLARE
  v_gap_id UUID;
  v_gaps JSONB := '[]'::JSONB;
  v_priority JSONB := '[]'::JSONB;
  v_gap_count INTEGER := 0;
  v_link RECORD;
BEGIN
  -- Get all low-rated competencies for this employee
  FOR v_link IN
    SELECT
      psl.competency_name,
      psl.competency_rating,
      psl.linked_skill_id,
      es.preferred_label_en as skill_name,
      esp.composite_score as current_level
    FROM performance_skill_links psl
    LEFT JOIN esco_skills es ON psl.linked_skill_id = es.id
    LEFT JOIN employee_skill_profiles esp ON esp.employee_id = psl.employee_id AND esp.skill_id = psl.linked_skill_id
    WHERE psl.tenant_id = p_tenant_id
      AND psl.employee_id = p_employee_id
      AND psl.rating_level = 'low'
      AND psl.is_addressed = false
  LOOP
    v_gap_count := v_gap_count + 1;

    v_gaps := v_gaps || jsonb_build_object(
      'skill_name', COALESCE(v_link.skill_name, v_link.competency_name),
      'skill_id', v_link.linked_skill_id,
      'current_level', COALESCE(v_link.current_level, v_link.competency_rating),
      'target_level', 3.5,
      'gap_size', 3.5 - COALESCE(v_link.current_level, v_link.competency_rating),
      'priority', 'high',
      'source', 'performance_review'
    );

    v_priority := v_priority || jsonb_build_object(
      'skill_name', COALESCE(v_link.skill_name, v_link.competency_name),
      'urgency', 'immediate',
      'development_time', '3-6 months'
    );
  END LOOP;

  IF v_gap_count > 0 THEN
    -- Create gap analysis record
    INSERT INTO skill_gap_analyses (
      tenant_id,
      analysis_name,
      analysis_type,
      target_entity_type,
      target_entity_id,
      analysis_date,
      skill_gaps,
      priority_skills,
      recommendations,
      created_by
    ) VALUES (
      p_tenant_id,
      'Performance-Based Gap Analysis - ' || to_char(NOW(), 'YYYY-MM-DD'),
      'performance_triggered',
      'employee',
      p_employee_id,
      CURRENT_DATE,
      v_gaps,
      v_priority,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'training',
          'description', 'Complete identified training within 3 months'
        ),
        jsonb_build_object(
          'type', 'mentoring',
          'description', 'Establish mentorship relationship within 2 weeks'
        ),
        jsonb_build_object(
          'type', 'project',
          'description', 'Apply skills in stretch assignment'
        )
      ),
      NULL  -- created_by is NULL since function runs without user context
    )
    RETURNING id INTO v_gap_id;

    -- Update the links with the gap analysis ID
    UPDATE performance_skill_links
    SET linked_gap_analysis_id = v_gap_id
    WHERE tenant_id = p_tenant_id
      AND employee_id = p_employee_id
      AND rating_level = 'low'
      AND is_addressed = false;
  END IF;

  gap_analysis_id := v_gap_id;
  skill_gaps_count := v_gap_count;
  priority_skills := v_priority;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCTION: FIND MENTOR MATCHES BASED ON SKILL STRENGTH
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_find_mentor_matches(
  p_tenant_id UUID,
  p_mentee_id UUID,
  p_skill_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  mentor_id UUID,
  mentor_name TEXT,
  mentor_title TEXT,
  mentor_department TEXT,
  skill_name TEXT,
  mentee_level NUMERIC,
  mentor_level NUMERIC,
  match_score NUMERIC,
  match_factors JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH mentee_gaps AS (
    -- Get skills where mentee needs improvement
    SELECT
      psl.linked_skill_id as skill_id,
      es.preferred_label_en as skill_name,
      COALESCE(esp.composite_score, psl.competency_rating) as current_level
    FROM performance_skill_links psl
    LEFT JOIN esco_skills es ON psl.linked_skill_id = es.id
    LEFT JOIN employee_skill_profiles esp ON esp.employee_id = psl.employee_id AND esp.skill_id = psl.linked_skill_id
    WHERE psl.tenant_id = p_tenant_id
      AND psl.employee_id = p_mentee_id
      AND psl.rating_level = 'low'
      AND psl.linked_skill_id IS NOT NULL
      AND (p_skill_id IS NULL OR psl.linked_skill_id = p_skill_id)
  ),
  potential_mentors AS (
    -- Find employees with strong skills in those areas
    SELECT
      esp.employee_id as mentor_id,
      esp.skill_id,
      esp.composite_score as mentor_level,
      (e.first_name || ' ' || e.last_name)::TEXT as mentor_name,
      e.job_title::TEXT as mentor_title,
      d.name::TEXT as mentor_department
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    JOIN mentee_gaps mg ON esp.skill_id = mg.skill_id
    WHERE esp.tenant_id = p_tenant_id
      AND esp.employee_id <> p_mentee_id
      AND esp.composite_score >= 4.0  -- Must be highly proficient
      AND e.employment_status = 'active'
      AND esp.composite_score > mg.current_level + 1.0  -- At least 1 level higher
  )
  SELECT
    pm.mentor_id,
    pm.mentor_name,
    pm.mentor_title,
    pm.mentor_department,
    es.preferred_label_en::TEXT as skill_name,
    mg.current_level as mentee_level,
    pm.mentor_level,
    -- Calculate match score based on multiple factors
    (
      (pm.mentor_level - mg.current_level) / 4.0 * 0.4 +  -- Skill gap weight
      0.3 +  -- Base match score
      CASE WHEN pm.mentor_department = (SELECT name FROM departments d2 JOIN employees e2 ON d2.id = e2.department_id WHERE e2.id = p_mentee_id)
           THEN 0.15 ELSE 0 END +  -- Same department bonus
      0.15  -- Availability factor (simplified)
    )::NUMERIC as match_score,
    jsonb_build_object(
      'skill_gap', pm.mentor_level - mg.current_level,
      'same_department', pm.mentor_department = (SELECT name FROM departments d2 JOIN employees e2 ON d2.id = e2.department_id WHERE e2.id = p_mentee_id),
      'mentor_proficiency', pm.mentor_level
    ) as match_factors
  FROM potential_mentors pm
  JOIN esco_skills es ON pm.skill_id = es.id
  JOIN mentee_gaps mg ON pm.skill_id = mg.skill_id
  ORDER BY match_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. VIEW: PERFORMANCE-SKILL LINKS SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW v_performance_skill_summary AS
SELECT
  psl.tenant_id,
  psl.employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  e.job_title,
  d.name as department_name,
  COUNT(*) as total_competencies,
  COUNT(*) FILTER (WHERE psl.rating_level = 'low') as low_rated,
  COUNT(*) FILTER (WHERE psl.rating_level = 'medium') as medium_rated,
  COUNT(*) FILTER (WHERE psl.rating_level = 'high') as high_rated,
  COUNT(*) FILTER (WHERE psl.linked_skill_id IS NOT NULL) as skills_linked,
  COUNT(*) FILTER (WHERE psl.linked_gap_analysis_id IS NOT NULL) as gap_analyses,
  COUNT(*) FILTER (WHERE psl.is_addressed = true) as addressed,
  MAX(psl.created_at) as last_updated
FROM performance_skill_links psl
JOIN employees e ON psl.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
GROUP BY psl.tenant_id, psl.employee_id, e.first_name, e.last_name, e.job_title, d.name;

COMMENT ON VIEW v_performance_skill_summary IS 'Summary of performance-to-skill links by employee';

-- ============================================================================
-- 7. VIEW: LEARNING RECOMMENDATIONS FROM PERFORMANCE
-- ============================================================================

CREATE OR REPLACE VIEW v_learning_recommendations AS
SELECT
  psl.tenant_id,
  psl.employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  psl.competency_name,
  psl.competency_rating,
  es.preferred_label_en as linked_skill_name,
  es.description_en as skill_description,
  c.name as course_name,
  c.id as course_id,
  c.duration_hours,
  c.difficulty_level,
  lp.name as learning_path_name,
  lp.id as learning_path_id
FROM performance_skill_links psl
JOIN employees e ON psl.employee_id = e.id
LEFT JOIN esco_skills es ON psl.linked_skill_id = es.id
LEFT JOIN course_skills cs ON cs.skill_id = es.id
LEFT JOIN courses c ON cs.course_id = c.id
LEFT JOIN learning_path_items lpi ON lpi.item_id = c.id AND lpi.item_type = 'course'
LEFT JOIN learning_paths lp ON lpi.learning_path_id = lp.id
WHERE psl.rating_level = 'low'
  AND psl.is_addressed = false
ORDER BY psl.competency_rating ASC, c.duration_hours ASC;

COMMENT ON VIEW v_learning_recommendations IS 'Learning recommendations based on low performance ratings';

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE performance_skill_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_match_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_skill_links ON performance_skill_links
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_mentor_matches ON mentor_match_scores
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
