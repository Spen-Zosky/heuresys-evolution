-- Migration 034: Goal & OKR Enhanced
-- Sprint 2025-05: S-PERF-01-07 Goal & OKR Management
-- Created: 2025-12-26

-- ============================================================================
-- 1. GOAL TEMPLATES (Goal Library)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- development, performance, project, learning, career
  goal_type VARCHAR(50) DEFAULT 'objective', -- objective, key_result, initiative
  suggested_metrics TEXT[], -- suggested measurement criteria
  suggested_duration_days INTEGER, -- typical duration
  suggested_weight NUMERIC(3,2) DEFAULT 1.0,
  difficulty_level VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard, stretch
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL, -- department-specific templates
  role_id UUID, -- role-specific templates
  is_company_wide BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_templates_tenant ON goal_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goal_templates_category ON goal_templates(category);
CREATE INDEX IF NOT EXISTS idx_goal_templates_active ON goal_templates(is_active);

COMMENT ON TABLE goal_templates IS 'Goal library with reusable goal templates for quick goal creation';

-- ============================================================================
-- 2. GOAL CHECK-INS (Progress Updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_progress INTEGER, -- progress before this check-in
  new_progress INTEGER NOT NULL, -- progress after this check-in
  status_update VARCHAR(50), -- on_track, at_risk, blocked, completed
  notes TEXT,
  blockers TEXT,
  next_steps TEXT,
  confidence_level INTEGER, -- 1-5 confidence in achieving goal
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_check_ins_goal ON goal_check_ins(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_check_ins_employee ON goal_check_ins(employee_id);
CREATE INDEX IF NOT EXISTS idx_goal_check_ins_date ON goal_check_ins(check_in_date);
CREATE INDEX IF NOT EXISTS idx_goal_check_ins_tenant ON goal_check_ins(tenant_id);

COMMENT ON TABLE goal_check_ins IS 'Progress check-ins for goals tracking progress over time';

-- ============================================================================
-- 3. OKR CHECK-INS (Key Result Progress Updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS okr_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  key_result_id UUID REFERENCES key_results(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_value NUMERIC(15,2),
  new_value NUMERIC(15,2) NOT NULL,
  previous_progress NUMERIC(5,2),
  new_progress NUMERIC(5,2),
  confidence_level INTEGER, -- 1-5
  notes TEXT,
  blockers TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_check_ins_okr ON okr_check_ins(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_kr ON okr_check_ins(key_result_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_employee ON okr_check_ins(employee_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_date ON okr_check_ins(check_in_date);

COMMENT ON TABLE okr_check_ins IS 'Check-ins for OKR key results tracking value changes over time';

-- ============================================================================
-- 4. GOAL SMART CRITERIA (Validation)
-- ============================================================================

ALTER TABLE goals
ADD COLUMN IF NOT EXISTS smart_criteria JSONB,
ADD COLUMN IF NOT EXISTS is_smart_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS smart_score INTEGER, -- 0-100 SMART score
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES goal_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN goals.smart_criteria IS 'SMART criteria: {specific, measurable, achievable, relevant, time_bound}';
COMMENT ON COLUMN goals.smart_score IS 'Calculated SMART compliance score 0-100';

-- ============================================================================
-- 5. KEY RESULTS ENHANCEMENT
-- ============================================================================

ALTER TABLE key_results
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS last_check_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confidence_level INTEGER DEFAULT 3;

-- Update existing key_results with tenant from parent OKR
UPDATE key_results kr
SET tenant_id = o.tenant_id
FROM okrs o
WHERE kr.okr_id = o.id AND kr.tenant_id IS NULL;

-- ============================================================================
-- 6. GOAL CASCADE VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_goal_cascade AS
WITH RECURSIVE goal_tree AS (
  -- Root goals (no parent)
  SELECT
    g.id,
    g.tenant_id,
    g.title,
    g.description,
    g.employee_id,
    g.parent_goal_id,
    g.status,
    g.progress_percent,
    g.weight,
    g.due_date,
    0 as level,
    ARRAY[g.id] as path,
    g.id as root_id
  FROM goals g
  WHERE g.parent_goal_id IS NULL

  UNION ALL

  -- Child goals
  SELECT
    g.id,
    g.tenant_id,
    g.title,
    g.description,
    g.employee_id,
    g.parent_goal_id,
    g.status,
    g.progress_percent,
    g.weight,
    g.due_date,
    gt.level + 1,
    gt.path || g.id,
    gt.root_id
  FROM goals g
  JOIN goal_tree gt ON g.parent_goal_id = gt.id
  WHERE NOT g.id = ANY(gt.path) -- prevent cycles
)
SELECT
  gt.*,
  e.first_name || ' ' || e.last_name as owner_name,
  e.job_title as owner_job_title,
  d.name as owner_department,
  pg.title as parent_goal_title
FROM goal_tree gt
JOIN employees e ON gt.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN goals pg ON gt.parent_goal_id = pg.id;

COMMENT ON VIEW v_goal_cascade IS 'Hierarchical view of goals with cascade levels and paths';

-- ============================================================================
-- 7. FUNCTION: Auto-calculate Goal Progress from Children
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calculate_cascaded_progress(p_goal_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_child_progress NUMERIC;
BEGIN
  -- Calculate weighted average of child goals
  SELECT
    CASE
      WHEN SUM(weight) > 0 THEN
        SUM(progress_percent * weight) / SUM(weight)
      ELSE 0
    END
  INTO v_child_progress
  FROM goals
  WHERE parent_goal_id = p_goal_id;

  RETURN COALESCE(v_child_progress, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_calculate_cascaded_progress IS 'Calculates weighted progress from child goals';

-- ============================================================================
-- 8. FUNCTION: Calculate OKR Progress from Key Results
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calculate_okr_progress(p_okr_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_progress NUMERIC;
BEGIN
  -- Calculate weighted average of key result progress
  SELECT
    CASE
      WHEN SUM(weight) > 0 THEN
        ROUND(SUM(progress_percent * weight) / SUM(weight), 2)
      ELSE 0
    END
  INTO v_progress
  FROM key_results
  WHERE okr_id = p_okr_id;

  -- Update the OKR
  UPDATE okrs
  SET overall_progress = COALESCE(v_progress, 0),
      updated_at = NOW()
  WHERE id = p_okr_id;

  RETURN COALESCE(v_progress, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_calculate_okr_progress IS 'Calculates and updates OKR progress from key results';

-- ============================================================================
-- 9. TRIGGER: Auto-update OKR progress on key result change
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_trigger_okr_progress()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM fn_calculate_okr_progress(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.okr_id ELSE NEW.okr_id END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_key_result_progress ON key_results;
CREATE TRIGGER trg_key_result_progress
AFTER INSERT OR UPDATE OF progress_percent, current_value, weight OR DELETE
ON key_results
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_okr_progress();

-- ============================================================================
-- 10. TEAM GOALS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_team_goals AS
SELECT
  g.id,
  g.tenant_id,
  g.employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  e.manager_id,
  m.first_name || ' ' || m.last_name as manager_name,
  d.id as department_id,
  d.name as department_name,
  g.title,
  g.description,
  g.goal_type,
  g.status,
  g.progress_percent,
  g.weight,
  g.priority,
  g.start_date,
  g.due_date,
  g.completed_at,
  g.parent_goal_id,
  pg.title as parent_goal_title,
  g.is_smart_validated,
  g.smart_score,
  CASE
    WHEN g.status = 'completed' THEN 'completed'
    WHEN g.due_date < CURRENT_DATE AND g.status != 'completed' THEN 'overdue'
    WHEN g.due_date < CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'on_track'
  END as timeline_status,
  (SELECT COUNT(*) FROM goal_check_ins gc WHERE gc.goal_id = g.id) as check_in_count,
  (SELECT MAX(check_in_date) FROM goal_check_ins gc WHERE gc.goal_id = g.id) as last_check_in
FROM goals g
JOIN employees e ON g.employee_id = e.id
LEFT JOIN employees m ON e.manager_id = m.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN goals pg ON g.parent_goal_id = pg.id;

COMMENT ON VIEW v_team_goals IS 'Manager view of team goals with status and check-in info';

-- ============================================================================
-- 11. INSERT DEFAULT GOAL TEMPLATES
-- ============================================================================

INSERT INTO goal_templates (
  tenant_id, name, description, category, goal_type,
  suggested_metrics, suggested_duration_days, difficulty_level, is_company_wide
)
SELECT
  t.id,
  template.name,
  template.description,
  template.category,
  template.goal_type,
  template.suggested_metrics,
  template.suggested_duration_days,
  template.difficulty_level,
  true
FROM tenants t
CROSS JOIN (
  VALUES
    ('Improve Customer Satisfaction', 'Increase customer satisfaction scores through service improvements', 'performance', 'objective', ARRAY['NPS score', 'CSAT rating', 'Response time'], 90, 'medium'),
    ('Complete Professional Certification', 'Obtain industry-recognized certification', 'learning', 'objective', ARRAY['Exam passed', 'Course completion', 'Study hours'], 180, 'hard'),
    ('Reduce Process Cycle Time', 'Optimize workflow to reduce processing time', 'performance', 'objective', ARRAY['Cycle time reduction %', 'Tasks completed per day'], 60, 'medium'),
    ('Mentor Team Members', 'Provide mentorship to junior team members', 'development', 'objective', ARRAY['Mentee count', 'Sessions held', 'Mentee progress'], 90, 'easy'),
    ('Launch New Project Feature', 'Successfully deliver a new product feature', 'project', 'objective', ARRAY['Feature delivered', 'User adoption %', 'Bug count'], 60, 'hard'),
    ('Improve Technical Skills', 'Enhance technical capabilities in key area', 'learning', 'objective', ARRAY['Courses completed', 'Skills demonstrated', 'Projects applied'], 90, 'medium'),
    ('Increase Team Collaboration', 'Foster better cross-functional collaboration', 'development', 'objective', ARRAY['Joint projects', 'Knowledge sharing sessions', 'Team feedback'], 60, 'easy'),
    ('Achieve Revenue Target', 'Meet or exceed revenue goals', 'performance', 'objective', ARRAY['Revenue amount', 'Deals closed', 'Pipeline value'], 90, 'stretch'),
    ('Reduce Operational Costs', 'Identify and implement cost-saving measures', 'performance', 'objective', ARRAY['Cost reduction %', 'Savings amount', 'Efficiency metrics'], 120, 'hard'),
    ('Develop Leadership Skills', 'Grow leadership capabilities', 'career', 'objective', ARRAY['Leadership training', 'Team initiatives led', '360 feedback scores'], 180, 'medium')
) AS template(name, description, category, goal_type, suggested_metrics, suggested_duration_days, difficulty_level)
WHERE NOT EXISTS (
  SELECT 1 FROM goal_templates gt
  WHERE gt.tenant_id = t.id AND gt.name = template.name
);

-- ============================================================================
-- 12. RLS POLICIES
-- ============================================================================

ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON goal_templates
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON goal_check_ins
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON okr_check_ins
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
