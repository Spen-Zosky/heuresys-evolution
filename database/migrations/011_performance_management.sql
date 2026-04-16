-- Migration 011: Performance Management System
-- Epic 9: Complete Performance Management feature set
-- Includes: Goals, OKRs, Key Results, Review Cycles, Performance Reviews,
--           Calibration Sessions, Check-ins, 360 Feedback

-- ============================================================================
-- STORY 9.1: Goal Management System
-- ============================================================================

-- Goals table - comprehensive goal tracking
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Goal details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) DEFAULT 'individual' CHECK (goal_type IN ('individual', 'team', 'department', 'company', 'stretch')),
    category VARCHAR(100),

    -- Hierarchy
    parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

    -- Timeline
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,

    -- Status and progress
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'cancelled', 'at_risk')),
    progress_percent NUMERIC(5,2) DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

    -- Priority and weight
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    weight NUMERIC(5,2) DEFAULT 100 CHECK (weight >= 0 AND weight <= 100),

    -- Metadata
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- STORY 9.2: OKR Tracking System
-- ============================================================================

-- OKRs - Objectives
CREATE TABLE IF NOT EXISTS okrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Objective details
    objective TEXT NOT NULL,
    description TEXT,
    okr_type VARCHAR(30) DEFAULT 'individual' CHECK (okr_type IN ('company', 'department', 'team', 'individual')),
    department VARCHAR(100),

    -- Period
    period_type VARCHAR(20) DEFAULT 'quarterly' CHECK (period_type IN ('annual', 'quarterly', 'monthly', 'custom')),
    period_start DATE,
    period_end DATE,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,

    -- Status and progress
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    overall_progress NUMERIC(5,2) DEFAULT 0 CHECK (overall_progress >= 0 AND overall_progress <= 100),
    confidence_level NUMERIC(5,2) CHECK (confidence_level >= 0 AND confidence_level <= 100),

    -- Alignment
    parent_okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL,

    -- Metadata
    tags JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key Results - measurable outcomes for OKRs
CREATE TABLE IF NOT EXISTS key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Key Result details
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Measurement
    metric_type VARCHAR(30) DEFAULT 'number' CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean', 'milestone')),
    start_value NUMERIC(15,2) DEFAULT 0,
    target_value NUMERIC(15,2) NOT NULL,
    current_value NUMERIC(15,2) DEFAULT 0,
    unit VARCHAR(50),

    -- Progress
    progress_percent NUMERIC(5,2) DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    confidence_level NUMERIC(5,2),

    -- Weight within OKR
    weight NUMERIC(5,2) DEFAULT 100 CHECK (weight >= 0 AND weight <= 100),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'at_risk', 'behind', 'on_track', 'completed', 'cancelled')),

    -- Timeline
    due_date DATE,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- STORY 9.3: Performance Review Cycles
-- ============================================================================

-- Review Cycles - define review periods
CREATE TABLE IF NOT EXISTS review_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Cycle details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cycle_type VARCHAR(30) DEFAULT 'annual' CHECK (cycle_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'adhoc')),

    -- Timeline
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Phases with deadlines
    self_review_deadline DATE,
    manager_review_deadline DATE,
    calibration_deadline DATE,
    feedback_deadline DATE,
    acknowledgment_deadline DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'in_calibration', 'completed', 'cancelled')),

    -- Configuration
    include_self_review BOOLEAN DEFAULT TRUE,
    include_peer_review BOOLEAN DEFAULT FALSE,
    include_upward_review BOOLEAN DEFAULT FALSE,
    include_360_feedback BOOLEAN DEFAULT FALSE,
    require_goal_assessment BOOLEAN DEFAULT TRUE,
    require_competency_rating BOOLEAN DEFAULT TRUE,

    -- Templates
    review_template_id UUID,
    competency_framework_id UUID,
    rating_scale_id UUID,

    -- Metadata
    eligible_employees_filter JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- STORY 9.4: Calibration Sessions
-- ============================================================================

-- Calibration Sessions - group calibration for rating consistency
CREATE TABLE IF NOT EXISTS calibration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE SET NULL,

    -- Session details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    session_type VARCHAR(30) DEFAULT 'department' CHECK (session_type IN ('company', 'division', 'department', 'team', 'custom')),

    -- Scope
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    scope_filter JSONB DEFAULT '{}',

    -- Schedule
    scheduled_date TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 120,
    location VARCHAR(255),
    meeting_link VARCHAR(500),

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Facilitator
    facilitator_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Results
    notes TEXT,
    decisions JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calibration participants
CREATE TABLE IF NOT EXISTS calibration_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calibration_session_id UUID NOT NULL REFERENCES calibration_sessions(id) ON DELETE CASCADE,

    -- Participant types
    participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('facilitator', 'calibrator', 'observer', 'subject')),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- For subjects being calibrated
    pre_calibration_rating NUMERIC(3,1),
    post_calibration_rating NUMERIC(3,1),
    rating_changed BOOLEAN DEFAULT FALSE,
    calibration_notes TEXT,

    -- Attendance
    attended BOOLEAN DEFAULT FALSE,
    attendance_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_session_participant UNIQUE (calibration_session_id, employee_id, participant_type)
);

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
-- STORY 9.5: Performance Reviews
-- ============================================================================

-- Performance Reviews - individual review records
CREATE TABLE IF NOT EXISTS performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE SET NULL,

    -- Participants
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Review period
    review_period_start DATE,
    review_period_end DATE,

    -- Review type
    review_type VARCHAR(30) DEFAULT 'annual' CHECK (review_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'adhoc', 'project')),

    -- Ratings
    overall_rating NUMERIC(3,1) CHECK (overall_rating >= 1 AND overall_rating <= 5),
    goal_achievement_rating NUMERIC(3,1) CHECK (goal_achievement_rating >= 1 AND goal_achievement_rating <= 5),
    competency_rating NUMERIC(3,1) CHECK (competency_rating >= 1 AND competency_rating <= 5),
    potential_rating NUMERIC(3,1) CHECK (potential_rating >= 1 AND potential_rating <= 5),

    -- Ratings breakdown (JSON for flexibility)
    competency_ratings JSONB DEFAULT '[]',
    goal_ratings JSONB DEFAULT '[]',

    -- Qualitative feedback
    strengths TEXT,
    areas_for_improvement TEXT,
    manager_comments TEXT,
    employee_comments TEXT,

    -- Development
    development_plan TEXT,
    career_aspirations TEXT,
    recommended_actions JSONB DEFAULT '[]',

    -- 9-box placement
    performance_box INTEGER CHECK (performance_box >= 1 AND performance_box <= 3),
    potential_box INTEGER CHECK (potential_box >= 1 AND potential_box <= 3),

    -- Status workflow
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'self_review', 'pending', 'submitted', 'in_calibration', 'calibrated', 'shared', 'acknowledged', 'completed', 'cancelled')),

    -- Timestamps
    self_review_completed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    calibrated_at TIMESTAMPTZ,
    shared_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,

    -- Calibration
    pre_calibration_rating NUMERIC(3,1),
    calibration_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 360 Feedback - multi-rater feedback
CREATE TABLE IF NOT EXISTS feedback_360 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    review_cycle_id UUID REFERENCES review_cycles(id) ON DELETE SET NULL,

    -- Subject (person being reviewed)
    subject_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Rater
    rater_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    rater_type VARCHAR(30) NOT NULL CHECK (rater_type IN ('self', 'manager', 'peer', 'direct_report', 'stakeholder', 'external')),
    is_anonymous BOOLEAN DEFAULT TRUE,

    -- Feedback content
    overall_rating NUMERIC(3,1),
    competency_ratings JSONB DEFAULT '[]',

    strengths TEXT,
    development_areas TEXT,
    additional_comments TEXT,

    -- Specific questions/answers
    responses JSONB DEFAULT '[]',

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'declined')),
    declined_reason TEXT,

    -- Timestamps
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE,
    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check-ins - 1:1 meetings
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Participants
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Schedule
    scheduled_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,

    -- Meeting type
    meeting_type VARCHAR(30) DEFAULT 'one_on_one' CHECK (meeting_type IN ('one_on_one', 'career', 'performance', 'project', 'feedback')),

    -- Content
    agenda TEXT,
    employee_notes TEXT,
    manager_notes TEXT,
    action_items JSONB DEFAULT '[]',

    -- Talking points / topics discussed
    topics_discussed JSONB DEFAULT '[]',

    -- Employee sentiment
    employee_mood INTEGER CHECK (employee_mood >= 1 AND employee_mood <= 5),
    employee_engagement INTEGER CHECK (employee_engagement >= 1 AND employee_engagement <= 5),

    -- Goals discussed
    goals_discussed JSONB DEFAULT '[]',

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
    completed_at TIMESTAMPTZ,

    -- Follow-up
    follow_up_items JSONB DEFAULT '[]',
    next_checkin_date DATE,

    -- Private notes (manager only)
    private_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_tenant ON goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goals_employee ON goals(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_due_date ON goals(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(tenant_id, goal_type);

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

-- OKRs indexes
CREATE INDEX IF NOT EXISTS idx_okrs_tenant ON okrs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_okrs_owner ON okrs(tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON okrs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_okrs_period ON okrs(tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_okrs_type ON okrs(tenant_id, okr_type);
CREATE INDEX IF NOT EXISTS idx_okrs_parent ON okrs(parent_okr_id);

-- Key Results indexes
CREATE INDEX IF NOT EXISTS idx_key_results_okr ON key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_key_results_owner ON key_results(owner_id);
CREATE INDEX IF NOT EXISTS idx_key_results_status ON key_results(status);

-- OKR Check-ins
CREATE INDEX IF NOT EXISTS idx_okr_checkins_okr ON okr_checkins(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_date ON okr_checkins(checkin_date DESC);

-- Review Cycles indexes
CREATE INDEX IF NOT EXISTS idx_review_cycles_tenant ON review_cycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_cycles_status ON review_cycles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_review_cycles_dates ON review_cycles(start_date, end_date);

-- Review Cycle Participants
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_cycle ON review_cycle_participants(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_employee ON review_cycle_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_participants_status ON review_cycle_participants(status);

-- Calibration Sessions indexes
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_tenant ON calibration_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_cycle ON calibration_sessions(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_status ON calibration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_date ON calibration_sessions(scheduled_date);

-- Calibration Participants
CREATE INDEX IF NOT EXISTS idx_calibration_participants_session ON calibration_participants(calibration_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_participants_employee ON calibration_participants(employee_id);

-- Calibration Adjustments
CREATE INDEX IF NOT EXISTS idx_calibration_adjustments_session ON calibration_adjustments(calibration_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_adjustments_employee ON calibration_adjustments(employee_id);

-- Performance Reviews indexes
CREATE INDEX IF NOT EXISTS idx_performance_reviews_tenant ON performance_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_cycle ON performance_reviews(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON performance_reviews(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status ON performance_reviews(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_period ON performance_reviews(review_period_start, review_period_end);

-- Self Reviews
CREATE INDEX IF NOT EXISTS idx_self_reviews_performance ON self_reviews(performance_review_id);
CREATE INDEX IF NOT EXISTS idx_self_reviews_employee ON self_reviews(employee_id);

-- 360 Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_360_tenant ON feedback_360(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_subject ON feedback_360(subject_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_rater ON feedback_360(rater_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_cycle ON feedback_360(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_feedback_360_status ON feedback_360(status);

-- Check-ins indexes
CREATE INDEX IF NOT EXISTS idx_check_ins_tenant ON check_ins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_employee ON check_ins(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_manager ON check_ins(tenant_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_check_ins_status ON check_ins(status);

-- Rating Scales
CREATE INDEX IF NOT EXISTS idx_rating_scales_tenant ON rating_scales(tenant_id);

-- Competency Frameworks
CREATE INDEX IF NOT EXISTS idx_competency_frameworks_tenant ON competency_frameworks(tenant_id);

-- Competencies
CREATE INDEX IF NOT EXISTS idx_competencies_framework ON competencies(framework_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360 ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
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
-- FUNCTIONS
-- ============================================================================

-- Function to calculate overall OKR progress from key results
CREATE OR REPLACE FUNCTION calculate_okr_progress(p_okr_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_progress NUMERIC;
BEGIN
    SELECT
        CASE
            WHEN SUM(weight) > 0 THEN
                SUM(progress_percent * weight) / SUM(weight)
            ELSE 0
        END
    INTO v_progress
    FROM key_results
    WHERE okr_id = p_okr_id AND status != 'cancelled';

    RETURN COALESCE(v_progress, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate goal progress from milestones
CREATE OR REPLACE FUNCTION calculate_goal_progress_from_milestones(p_goal_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_progress NUMERIC;
BEGIN
    SELECT
        CASE
            WHEN COUNT(*) > 0 THEN
                (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))
            ELSE 0
        END
    INTO v_progress
    FROM goal_milestones
    WHERE goal_id = p_goal_id AND status != 'cancelled';

    RETURN COALESCE(v_progress, 0);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update OKR progress when key results change
CREATE OR REPLACE FUNCTION update_okr_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE okrs
    SET
        overall_progress = calculate_okr_progress(NEW.okr_id),
        updated_at = NOW()
    WHERE id = NEW.okr_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_okr_progress ON key_results;
CREATE TRIGGER trg_update_okr_progress
    AFTER INSERT OR UPDATE OF progress_percent, weight, status ON key_results
    FOR EACH ROW
    EXECUTE FUNCTION update_okr_progress();

-- Trigger to create goal update on status/progress change
CREATE OR REPLACE FUNCTION log_goal_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.progress_percent IS DISTINCT FROM NEW.progress_percent OR OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO goal_updates (
            tenant_id, goal_id, update_type,
            previous_progress, new_progress,
            previous_status, new_status
        ) VALUES (
            NEW.tenant_id, NEW.id,
            CASE
                WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_change'
                ELSE 'progress'
            END,
            OLD.progress_percent, NEW.progress_percent,
            OLD.status, NEW.status
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_goal_update ON goals;
CREATE TRIGGER trg_log_goal_update
    AFTER UPDATE OF progress_percent, status ON goals
    FOR EACH ROW
    EXECUTE FUNCTION log_goal_update();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Goal hierarchy view
CREATE OR REPLACE VIEW goal_hierarchy AS
WITH RECURSIVE goal_tree AS (
    SELECT
        g.id,
        g.tenant_id,
        g.title,
        g.status,
        g.progress_percent,
        g.parent_goal_id,
        g.employee_id,
        1 AS depth,
        ARRAY[g.id] AS path,
        g.title AS root_title
    FROM goals g
    WHERE g.parent_goal_id IS NULL

    UNION ALL

    SELECT
        g.id,
        g.tenant_id,
        g.title,
        g.status,
        g.progress_percent,
        g.parent_goal_id,
        g.employee_id,
        gt.depth + 1,
        gt.path || g.id,
        gt.root_title
    FROM goals g
    JOIN goal_tree gt ON g.parent_goal_id = gt.id
)
SELECT * FROM goal_tree;

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

COMMENT ON TABLE goals IS 'Employee goals and objectives with hierarchical support';
COMMENT ON TABLE okrs IS 'Objectives and Key Results for strategic alignment';
COMMENT ON TABLE key_results IS 'Measurable outcomes tied to OKR objectives';
COMMENT ON TABLE review_cycles IS 'Performance review cycle definitions and configuration';
COMMENT ON TABLE calibration_sessions IS 'Group sessions for rating calibration and consistency';
COMMENT ON TABLE performance_reviews IS 'Individual performance review records';
COMMENT ON TABLE check_ins IS '1:1 meeting records between managers and employees';
COMMENT ON TABLE feedback_360 IS 'Multi-rater feedback from various sources';
