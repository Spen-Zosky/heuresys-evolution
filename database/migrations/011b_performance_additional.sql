-- Migration 011b: Additional Performance Management Tables
-- Adds missing auxiliary tables for Epic 9

-- ============================================================================
-- GOAL MANAGEMENT EXTENSIONS
-- ============================================================================

-- Goal alignment - link goals to strategic objectives
CREATE TABLE IF NOT EXISTS goal_alignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    aligned_goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    alignment_type VARCHAR(50) DEFAULT 'supports' CHECK (alignment_type IN ('supports', 'contributes_to', 'derived_from', 'depends_on')),
    alignment_weight NUMERIC(5,2) DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT no_self_alignment CHECK (goal_id != aligned_goal_id),
    CONSTRAINT unique_goal_alignment UNIQUE (goal_id, aligned_goal_id)
);

-- Goal updates - progress tracking history
CREATE TABLE IF NOT EXISTS goal_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    author_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    update_type VARCHAR(30) DEFAULT 'progress' CHECK (update_type IN ('progress', 'status_change', 'milestone', 'blocker', 'note')),
    previous_progress NUMERIC(5,2),
    new_progress NUMERIC(5,2),
    previous_status VARCHAR(30),
    new_status VARCHAR(30),

    content TEXT,
    attachments JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal comments - discussion threads
CREATE TABLE IF NOT EXISTS goal_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    author_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    parent_comment_id UUID REFERENCES goal_comments(id) ON DELETE CASCADE,

    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal milestones - key checkpoints
CREATE TABLE IF NOT EXISTS goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'cancelled')),
    weight NUMERIC(5,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OKR EXTENSIONS
-- ============================================================================

-- OKR Check-ins - regular progress updates
CREATE TABLE IF NOT EXISTS okr_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
    author_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Progress snapshot
    overall_progress NUMERIC(5,2),
    confidence_level NUMERIC(5,2),

    -- Status
    status_update TEXT,
    blockers TEXT,
    next_steps TEXT,

    -- Key result updates
    key_result_updates JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REVIEW CYCLE EXTENSIONS
-- ============================================================================

-- Review cycle participants
CREATE TABLE IF NOT EXISTS review_cycle_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    review_cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Status tracking
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'self_review', 'manager_review', 'in_calibration', 'feedback', 'acknowledged', 'completed', 'excluded')),

    -- Progress flags
    self_review_completed BOOLEAN DEFAULT FALSE,
    self_review_completed_at TIMESTAMPTZ,
    manager_review_completed BOOLEAN DEFAULT FALSE,
    manager_review_completed_at TIMESTAMPTZ,
    calibrated BOOLEAN DEFAULT FALSE,
    calibrated_at TIMESTAMPTZ,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,

    -- Exclusion
    excluded_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_cycle_employee UNIQUE (review_cycle_id, employee_id)
);

-- ============================================================================
-- CALIBRATION EXTENSIONS
-- ============================================================================

-- Calibration rating adjustments
CREATE TABLE IF NOT EXISTS calibration_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calibration_session_id UUID NOT NULL REFERENCES calibration_sessions(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Ratings
    original_rating NUMERIC(3,1) NOT NULL,
    adjusted_rating NUMERIC(3,1) NOT NULL,
    rating_category VARCHAR(50),

    -- Justification
    adjustment_reason TEXT NOT NULL,
    supporting_evidence TEXT,

    -- Approval
    proposed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE REVIEW EXTENSIONS
-- ============================================================================

-- Self reviews - employee's self assessment
CREATE TABLE IF NOT EXISTS self_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Self ratings
    self_overall_rating NUMERIC(3,1),
    self_goal_rating NUMERIC(3,1),
    self_competency_rating NUMERIC(3,1),

    -- Self assessment content
    achievements TEXT,
    challenges TEXT,
    learnings TEXT,
    goals_for_next_period TEXT,
    feedback_for_manager TEXT,

    -- Competency self-ratings
    competency_self_ratings JSONB DEFAULT '[]',

    -- Goal self-assessments
    goal_self_assessments JSONB DEFAULT '[]',

    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_self_review UNIQUE (performance_review_id)
);

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Rating scales - configurable rating scales
CREATE TABLE IF NOT EXISTS rating_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    scale_type VARCHAR(30) DEFAULT 'numeric' CHECK (scale_type IN ('numeric', 'letter', 'text', 'emoji')),
    min_value NUMERIC(3,1) DEFAULT 1,
    max_value NUMERIC(3,1) DEFAULT 5,

    -- Scale definitions
    scale_points JSONB NOT NULL DEFAULT '[
        {"value": 1, "label": "Needs Improvement", "description": "Performance consistently below expectations"},
        {"value": 2, "label": "Developing", "description": "Performance sometimes meets expectations"},
        {"value": 3, "label": "Meets Expectations", "description": "Performance consistently meets expectations"},
        {"value": 4, "label": "Exceeds Expectations", "description": "Performance frequently exceeds expectations"},
        {"value": 5, "label": "Outstanding", "description": "Performance consistently exceeds expectations"}
    ]',

    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competency frameworks
CREATE TABLE IF NOT EXISTS competency_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0',

    -- Framework type
    framework_type VARCHAR(30) DEFAULT 'core' CHECK (framework_type IN ('core', 'leadership', 'technical', 'functional', 'custom')),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competencies within frameworks
CREATE TABLE IF NOT EXISTS competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    framework_id UUID NOT NULL REFERENCES competency_frameworks(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),

    -- Behavioral indicators per level
    behavioral_indicators JSONB DEFAULT '[]',

    -- Weight in overall assessment
    weight NUMERIC(5,2) DEFAULT 100,

    -- Display order
    sort_order INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Goal alignments
CREATE INDEX IF NOT EXISTS idx_goal_alignments_goal ON goal_alignments(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_alignments_aligned ON goal_alignments(aligned_goal_id);

-- Goal updates
CREATE INDEX IF NOT EXISTS idx_goal_updates_goal ON goal_updates(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_created ON goal_updates(created_at DESC);

-- Goal comments
CREATE INDEX IF NOT EXISTS idx_goal_comments_goal ON goal_comments(goal_id);

-- Goal milestones
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON goal_milestones(goal_id);

-- OKR Check-ins
CREATE INDEX IF NOT EXISTS idx_okr_checkins_okr ON okr_checkins(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_date ON okr_checkins(checkin_date DESC);

-- Review Cycle Participants
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_cycle ON review_cycle_participants(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_employee ON review_cycle_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_status ON review_cycle_participants(status);

-- Calibration Adjustments
CREATE INDEX IF NOT EXISTS idx_calibration_adjustments_session ON calibration_adjustments(calibration_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_adjustments_employee ON calibration_adjustments(employee_id);

-- Self Reviews
CREATE INDEX IF NOT EXISTS idx_self_reviews_performance ON self_reviews(performance_review_id);
CREATE INDEX IF NOT EXISTS idx_self_reviews_employee ON self_reviews(employee_id);

-- Rating Scales
CREATE INDEX IF NOT EXISTS idx_rating_scales_tenant ON rating_scales(tenant_id);

-- Competency Frameworks
CREATE INDEX IF NOT EXISTS idx_competency_frameworks_tenant ON competency_frameworks(tenant_id);

-- Competencies
CREATE INDEX IF NOT EXISTS idx_competencies_framework ON competencies(framework_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE goal_alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE competencies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default rating scale for each tenant
INSERT INTO rating_scales (tenant_id, name, description, is_default, is_active)
SELECT
    t.id,
    'Standard 5-Point Scale',
    'Default performance rating scale from 1 (Needs Improvement) to 5 (Outstanding)',
    TRUE,
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM rating_scales rs WHERE rs.tenant_id = t.id AND rs.is_default = TRUE
);

-- Insert default competency framework for each tenant
INSERT INTO competency_frameworks (tenant_id, name, description, framework_type, is_active)
SELECT
    t.id,
    'Core Competencies',
    'Organization-wide core competencies applicable to all employees',
    'core',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM competency_frameworks cf WHERE cf.tenant_id = t.id AND cf.framework_type = 'core'
);

-- Insert default competencies for each framework
INSERT INTO competencies (tenant_id, framework_id, name, description, category, sort_order)
SELECT
    cf.tenant_id,
    cf.id,
    comp.name,
    comp.description,
    comp.category,
    comp.sort_order
FROM competency_frameworks cf
CROSS JOIN (VALUES
    ('Communication', 'Effectively conveys information and ideas through various channels', 'Interpersonal', 1),
    ('Collaboration', 'Works effectively with others to achieve shared goals', 'Interpersonal', 2),
    ('Problem Solving', 'Identifies issues and develops effective solutions', 'Cognitive', 3),
    ('Adaptability', 'Adjusts effectively to changing circumstances and priorities', 'Personal', 4),
    ('Results Orientation', 'Focuses on achieving objectives and delivering outcomes', 'Performance', 5),
    ('Customer Focus', 'Prioritizes customer needs and delivers value', 'External', 6),
    ('Innovation', 'Generates creative ideas and implements improvements', 'Cognitive', 7),
    ('Leadership', 'Inspires and guides others toward achieving goals', 'Leadership', 8)
) AS comp(name, description, category, sort_order)
WHERE cf.framework_type = 'core'
AND NOT EXISTS (
    SELECT 1 FROM competencies c WHERE c.framework_id = cf.id AND c.name = comp.name
);

-- ============================================================================
-- ADDITIONAL COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add missing columns to goals if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'goals' AND column_name = 'tags') THEN
        ALTER TABLE goals ADD COLUMN tags JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'goals' AND column_name = 'custom_fields') THEN
        ALTER TABLE goals ADD COLUMN custom_fields JSONB DEFAULT '{}';
    END IF;
END
$$;

-- Add missing columns to okrs if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'description') THEN
        ALTER TABLE okrs ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'parent_okr_id') THEN
        ALTER TABLE okrs ADD COLUMN parent_okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'tags') THEN
        ALTER TABLE okrs ADD COLUMN tags JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'fiscal_year') THEN
        ALTER TABLE okrs ADD COLUMN fiscal_year INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'fiscal_quarter') THEN
        ALTER TABLE okrs ADD COLUMN fiscal_quarter INTEGER;
    END IF;
END
$$;

-- Add missing columns to performance_reviews if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'review_cycle_id') THEN
        ALTER TABLE performance_reviews ADD COLUMN review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'competency_ratings') THEN
        ALTER TABLE performance_reviews ADD COLUMN competency_ratings JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'goal_ratings') THEN
        ALTER TABLE performance_reviews ADD COLUMN goal_ratings JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'development_plan') THEN
        ALTER TABLE performance_reviews ADD COLUMN development_plan TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'career_aspirations') THEN
        ALTER TABLE performance_reviews ADD COLUMN career_aspirations TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'recommended_actions') THEN
        ALTER TABLE performance_reviews ADD COLUMN recommended_actions JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'performance_box') THEN
        ALTER TABLE performance_reviews ADD COLUMN performance_box INTEGER CHECK (performance_box >= 1 AND performance_box <= 3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'potential_box') THEN
        ALTER TABLE performance_reviews ADD COLUMN potential_box INTEGER CHECK (potential_box >= 1 AND potential_box <= 3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'pre_calibration_rating') THEN
        ALTER TABLE performance_reviews ADD COLUMN pre_calibration_rating NUMERIC(3,1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'calibration_notes') THEN
        ALTER TABLE performance_reviews ADD COLUMN calibration_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'self_review_completed_at') THEN
        ALTER TABLE performance_reviews ADD COLUMN self_review_completed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'calibrated_at') THEN
        ALTER TABLE performance_reviews ADD COLUMN calibrated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_reviews' AND column_name = 'shared_at') THEN
        ALTER TABLE performance_reviews ADD COLUMN shared_at TIMESTAMPTZ;
    END IF;
END
$$;

-- Add missing columns to review_cycles if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'self_review_deadline') THEN
        ALTER TABLE review_cycles ADD COLUMN self_review_deadline DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'manager_review_deadline') THEN
        ALTER TABLE review_cycles ADD COLUMN manager_review_deadline DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'calibration_deadline') THEN
        ALTER TABLE review_cycles ADD COLUMN calibration_deadline DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'feedback_deadline') THEN
        ALTER TABLE review_cycles ADD COLUMN feedback_deadline DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'acknowledgment_deadline') THEN
        ALTER TABLE review_cycles ADD COLUMN acknowledgment_deadline DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'include_self_review') THEN
        ALTER TABLE review_cycles ADD COLUMN include_self_review BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'include_peer_review') THEN
        ALTER TABLE review_cycles ADD COLUMN include_peer_review BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'include_upward_review') THEN
        ALTER TABLE review_cycles ADD COLUMN include_upward_review BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'include_360_feedback') THEN
        ALTER TABLE review_cycles ADD COLUMN include_360_feedback BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'require_goal_assessment') THEN
        ALTER TABLE review_cycles ADD COLUMN require_goal_assessment BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'require_competency_rating') THEN
        ALTER TABLE review_cycles ADD COLUMN require_competency_rating BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'review_template_id') THEN
        ALTER TABLE review_cycles ADD COLUMN review_template_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'competency_framework_id') THEN
        ALTER TABLE review_cycles ADD COLUMN competency_framework_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'rating_scale_id') THEN
        ALTER TABLE review_cycles ADD COLUMN rating_scale_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'review_cycles' AND column_name = 'eligible_employees_filter') THEN
        ALTER TABLE review_cycles ADD COLUMN eligible_employees_filter JSONB DEFAULT '{}';
    END IF;
END
$$;

-- Add missing columns to check_ins if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'check_ins' AND column_name = 'topics_discussed') THEN
        ALTER TABLE check_ins ADD COLUMN topics_discussed JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'check_ins' AND column_name = 'employee_engagement') THEN
        ALTER TABLE check_ins ADD COLUMN employee_engagement INTEGER CHECK (employee_engagement >= 1 AND employee_engagement <= 5);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'check_ins' AND column_name = 'goals_discussed') THEN
        ALTER TABLE check_ins ADD COLUMN goals_discussed JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'check_ins' AND column_name = 'follow_up_items') THEN
        ALTER TABLE check_ins ADD COLUMN follow_up_items JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'check_ins' AND column_name = 'next_checkin_date') THEN
        ALTER TABLE check_ins ADD COLUMN next_checkin_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'check_ins' AND column_name = 'private_notes') THEN
        ALTER TABLE check_ins ADD COLUMN private_notes TEXT;
    END IF;
END
$$;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Performance review summary view
CREATE OR REPLACE VIEW performance_review_summary AS
SELECT
    pr.tenant_id,
    pr.review_cycle_id,
    rc.name AS cycle_name,
    COUNT(*) AS total_reviews,
    COUNT(*) FILTER (WHERE pr.status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE pr.status IN ('draft', 'pending', 'submitted')) AS in_progress,
    ROUND(AVG(pr.overall_rating), 2) AS avg_overall_rating,
    ROUND(AVG(pr.goal_achievement_rating), 2) AS avg_goal_rating,
    ROUND(AVG(pr.competency_rating), 2) AS avg_competency_rating,
    ROUND(AVG(pr.potential_rating), 2) AS avg_potential_rating
FROM performance_reviews pr
LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
GROUP BY pr.tenant_id, pr.review_cycle_id, rc.name;

-- 9-box grid placement view
CREATE OR REPLACE VIEW nine_box_grid AS
SELECT
    pr.tenant_id,
    pr.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title,
    d.name AS department,
    pr.overall_rating,
    pr.potential_rating,
    pr.performance_box,
    pr.potential_box,
    CASE
        WHEN pr.performance_box = 3 AND pr.potential_box = 3 THEN 'Star'
        WHEN pr.performance_box = 3 AND pr.potential_box = 2 THEN 'High Performer'
        WHEN pr.performance_box = 3 AND pr.potential_box = 1 THEN 'Consistent Performer'
        WHEN pr.performance_box = 2 AND pr.potential_box = 3 THEN 'High Potential'
        WHEN pr.performance_box = 2 AND pr.potential_box = 2 THEN 'Core Player'
        WHEN pr.performance_box = 2 AND pr.potential_box = 1 THEN 'Solid Performer'
        WHEN pr.performance_box = 1 AND pr.potential_box = 3 THEN 'Rough Diamond'
        WHEN pr.performance_box = 1 AND pr.potential_box = 2 THEN 'Inconsistent'
        WHEN pr.performance_box = 1 AND pr.potential_box = 1 THEN 'Risk'
        ELSE 'Not Rated'
    END AS nine_box_category,
    pr.review_cycle_id
FROM performance_reviews pr
JOIN employees e ON pr.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE pr.status = 'completed'
AND pr.performance_box IS NOT NULL
AND pr.potential_box IS NOT NULL;

COMMENT ON TABLE goal_alignments IS 'Links between goals for strategic alignment tracking';
COMMENT ON TABLE goal_updates IS 'History of goal progress and status updates';
COMMENT ON TABLE goal_comments IS 'Discussion threads on goals';
COMMENT ON TABLE goal_milestones IS 'Key checkpoints for goal completion';
COMMENT ON TABLE okr_checkins IS 'Regular progress updates for OKRs';
COMMENT ON TABLE review_cycle_participants IS 'Employees participating in review cycles';
COMMENT ON TABLE calibration_adjustments IS 'Rating adjustments from calibration sessions';
COMMENT ON TABLE self_reviews IS 'Employee self-assessments for performance reviews';
COMMENT ON TABLE rating_scales IS 'Configurable rating scales for performance assessment';
COMMENT ON TABLE competency_frameworks IS 'Competency frameworks for employee assessment';
COMMENT ON TABLE competencies IS 'Individual competencies within frameworks';
