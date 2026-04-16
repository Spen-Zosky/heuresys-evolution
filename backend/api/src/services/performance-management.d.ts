/**
 * Performance Management Service
 * Epic 9: Complete Performance Management functionality
 *
 * Covers:
 * - Story 9.1: Goal Management System
 * - Story 9.2: OKR Tracking System
 * - Story 9.3: Performance Review Cycles
 * - Story 9.4: Calibration Sessions
 * - Story 9.5: Performance Reviews
 */
export interface Goal {
    id: string;
    tenant_id: string;
    employee_id: string;
    owner_id?: string;
    title: string;
    description?: string;
    goal_type: 'individual' | 'team' | 'department' | 'company' | 'stretch';
    category?: string;
    parent_goal_id?: string;
    start_date?: string;
    due_date?: string;
    completed_at?: string;
    status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'at_risk';
    progress_percent: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    weight?: number;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
export interface GoalAlignment {
    id: string;
    goal_id: string;
    aligned_goal_id: string;
    alignment_type: 'supports' | 'contributes_to' | 'derived_from' | 'depends_on';
    alignment_weight: number;
}
export interface GoalUpdate {
    id: string;
    goal_id: string;
    author_id?: string;
    update_type: 'progress' | 'status_change' | 'milestone' | 'blocker' | 'note';
    previous_progress?: number;
    new_progress?: number;
    previous_status?: string;
    new_status?: string;
    content?: string;
    created_at: string;
}
export interface GoalMilestone {
    id: string;
    goal_id: string;
    title: string;
    description?: string;
    target_date?: string;
    completed_at?: string;
    status: 'pending' | 'completed' | 'missed' | 'cancelled';
    weight: number;
}
export interface OKR {
    id: string;
    tenant_id: string;
    owner_id?: string;
    objective: string;
    description?: string;
    okr_type: 'company' | 'department' | 'team' | 'individual';
    department?: string;
    period_type: 'annual' | 'quarterly' | 'monthly' | 'custom';
    period_start?: string;
    period_end?: string;
    status: 'draft' | 'active' | 'completed' | 'cancelled';
    overall_progress: number;
    confidence_level?: number;
    parent_okr_id?: string;
}
export interface KeyResult {
    id: string;
    okr_id: string;
    owner_id?: string;
    title: string;
    description?: string;
    metric_type: 'number' | 'percentage' | 'currency' | 'boolean' | 'milestone';
    start_value: number;
    target_value: number;
    current_value: number;
    unit?: string;
    progress_percent: number;
    confidence_level?: number;
    weight: number;
    status: 'active' | 'at_risk' | 'behind' | 'on_track' | 'completed' | 'cancelled';
    due_date?: string;
}
export interface ReviewCycle {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    cycle_type: 'annual' | 'semi_annual' | 'quarterly' | 'probation' | 'adhoc';
    start_date: string;
    end_date: string;
    status: 'draft' | 'active' | 'in_calibration' | 'completed' | 'cancelled';
    self_review_deadline?: string;
    manager_review_deadline?: string;
    calibration_deadline?: string;
    include_self_review: boolean;
    include_peer_review: boolean;
    include_360_feedback: boolean;
}
export interface CalibrationSession {
    id: string;
    tenant_id: string;
    review_cycle_id?: string;
    name: string;
    description?: string;
    session_type: 'company' | 'division' | 'department' | 'team' | 'custom';
    org_unit_id?: string;
    scheduled_date?: string;
    scheduled_end_date?: string;
    location?: string;
    meeting_link?: string;
    status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    facilitator_id?: string;
    facilitator_ids?: string[];
}
export interface PerformanceReview {
    id: string;
    tenant_id: string;
    review_cycle_id?: string;
    employee_id: string;
    reviewer_id: string;
    review_type: 'annual' | 'semi_annual' | 'quarterly' | 'probation' | 'adhoc' | 'project';
    overall_rating?: number;
    goal_achievement_rating?: number;
    competency_rating?: number;
    potential_rating?: number;
    status: string;
    performance_box?: number;
    potential_box?: number;
}
export interface Feedback360 {
    id: string;
    tenant_id: string;
    subject_id: string;
    rater_id?: string;
    rater_type: 'self' | 'manager' | 'peer' | 'direct_report' | 'stakeholder' | 'external';
    is_anonymous: boolean;
    overall_rating?: number;
    status: 'pending' | 'in_progress' | 'submitted' | 'declined';
}
export declare class PerformanceManagementService {
    /**
     * Get goal hierarchy for a tenant
     */
    getGoalHierarchy(tenantId: string, options?: {
        rootOnly?: boolean;
        employeeId?: string;
        status?: string;
    }): Promise<Goal[]>;
    /**
     * Create goal alignment
     */
    createGoalAlignment(tenantId: string, goalId: string, alignedGoalId: string, alignmentType: string, weight?: number): Promise<GoalAlignment>;
    /**
     * Get goal alignments
     */
    getGoalAlignments(tenantId: string, goalId: string): Promise<{
        aligns_to: GoalAlignment[];
        aligned_from: GoalAlignment[];
    }>;
    /**
     * Add goal update
     */
    addGoalUpdate(tenantId: string, goalId: string, update: {
        author_id?: string;
        update_type: string;
        content?: string;
        new_progress?: number;
        new_status?: string;
    }): Promise<GoalUpdate>;
    /**
     * Get goal updates history
     */
    getGoalUpdates(tenantId: string, goalId: string, limit?: number): Promise<GoalUpdate[]>;
    /**
     * Manage goal milestones
     */
    createGoalMilestone(tenantId: string, goalId: string, milestone: Omit<GoalMilestone, 'id' | 'completed_at'>): Promise<GoalMilestone>;
    completeMilestone(tenantId: string, milestoneId: string): Promise<GoalMilestone>;
    getGoalMilestones(tenantId: string, goalId: string): Promise<GoalMilestone[]>;
    /**
     * Calculate cascaded goal progress
     */
    calculateCascadedProgress(tenantId: string, goalId: string): Promise<number>;
    /**
     * Create Key Result for an OKR
     */
    createKeyResult(tenantId: string, okrId: string, keyResult: {
        title: string;
        description?: string;
        metric_type?: string;
        start_value?: number;
        target_value: number;
        current_value?: number;
        unit?: string;
        weight?: number;
        owner_id?: string;
        due_date?: string;
    }): Promise<KeyResult>;
    /**
     * Update Key Result progress
     */
    updateKeyResultProgress(tenantId: string, keyResultId: string, currentValue: number, confidenceLevel?: number): Promise<KeyResult>;
    /**
     * Get OKR with Key Results
     */
    getOKRWithKeyResults(tenantId: string, okrId: string): Promise<{
        okr: OKR;
        key_results: KeyResult[];
        progress_summary: {
            total_key_results: number;
            completed: number;
            on_track: number;
            at_risk: number;
            behind: number;
        };
    }>;
    /**
     * Create OKR Check-in
     */
    createOKRCheckin(tenantId: string, okrId: string, checkin: {
        author_id?: string;
        created_by?: string;
        progress_snapshot?: number;
        overall_progress?: number;
        confidence_level?: number;
        status_update?: string;
        blockers?: string;
        achievements?: string;
        next_steps?: string;
        notes?: string;
        key_result_updates?: Array<{
            key_result_id: string;
            current_value: number;
            notes?: string;
        }>;
    }): Promise<Record<string, unknown>>;
    /**
     * Add participants to review cycle
     */
    addReviewCycleParticipants(tenantId: string, cycleId: string, participantIds: string[]): Promise<number>;
    /**
     * Get review cycle participants with status
     */
    getReviewCycleParticipants(tenantId: string, cycleId: string, options?: {
        status?: string;
        managerId?: string;
        orgUnitId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        participants: Record<string, unknown>[];
        total: number;
        status_summary: Record<string, number>;
    }>;
    /**
     * Update participant status
     */
    updateParticipantStatus(tenantId: string, participantId: string, status: string, additionalUpdates?: {
        self_review_completed?: boolean;
        manager_review_completed?: boolean;
        calibrated?: boolean;
        acknowledged?: boolean;
    }): Promise<Record<string, unknown>>;
    /**
     * Create calibration session
     */
    createCalibrationSession(tenantId: string, session: Omit<CalibrationSession, 'id' | 'tenant_id'> & {
        status?: CalibrationSession['status'];
    }): Promise<CalibrationSession>;
    /**
     * Add calibration participants
     */
    addCalibrationParticipants(tenantId: string, sessionId: string, participants: Array<{
        employee_id: string;
        participant_type: 'facilitator' | 'calibrator' | 'observer' | 'subject';
        pre_calibration_rating?: number;
    }>): Promise<number>;
    /**
     * Record calibration adjustment
     */
    recordCalibrationAdjustment(tenantId: string, sessionId: string, adjustment: {
        employee_id: string;
        performance_review_id?: string;
        original_rating?: number;
        adjusted_rating?: number;
        rating_category?: string;
        adjustment_reason?: string;
        supporting_evidence?: string;
        proposed_by?: string;
        adjusted_by?: string;
        competency_adjustments?: Record<string, unknown>;
    }): Promise<Record<string, unknown>>;
    /**
     * Complete calibration session
     */
    completeCalibrationSession(tenantId: string, sessionId: string, notes?: string, decisions?: Record<string, unknown>[]): Promise<CalibrationSession>;
    /**
     * Get calibration session with participants
     */
    getCalibrationSessionDetails(tenantId: string, sessionId: string): Promise<{
        session: CalibrationSession;
        facilitators: Record<string, unknown>[];
        calibrators: Record<string, unknown>[];
        subjects: Record<string, unknown>[];
        adjustments: Record<string, unknown>[];
    }>;
    /**
     * Create self-review
     */
    createSelfReview(tenantId: string, performanceReviewId: string, selfReview: {
        employee_id: string;
        self_rating?: number;
        self_overall_rating?: number;
        self_goal_rating?: number;
        self_competency_rating?: number;
        achievements?: string;
        challenges?: string;
        learnings?: string;
        development_goals?: string;
        goals_for_next_period?: string;
        feedback_for_manager?: string;
        competency_ratings?: Record<string, unknown>;
        competency_self_ratings?: Record<string, unknown>[];
        goal_self_assessments?: Record<string, unknown>[];
        additional_comments?: string;
    }): Promise<Record<string, unknown>>;
    /**
     * Submit self-review
     */
    submitSelfReview(tenantId: string, selfReviewId: string): Promise<Record<string, unknown>>;
    /**
     * Request 360 feedback
     */
    request360Feedback(tenantId: string, subjectId: string, raters: Array<{
        rater_id?: string;
        rater_type: string;
        is_anonymous?: boolean;
        due_date?: string;
    }>, reviewCycleId?: string): Promise<Feedback360[]>;
    /**
     * Submit 360 feedback
     */
    submit360Feedback(tenantId: string, feedbackId: string, feedback: {
        overall_rating?: number;
        competency_ratings?: Record<string, unknown>[];
        strengths?: string;
        development_areas?: string;
        areas_for_improvement?: string;
        additional_comments?: string;
        responses?: Record<string, unknown>[];
    }): Promise<Feedback360>;
    /**
     * Get 360 feedback summary for an employee
     */
    get360FeedbackSummary(tenantId: string, subjectId: string, reviewCycleId?: string): Promise<{
        total_requests: number;
        submitted: number;
        pending: number;
        declined: number;
        avg_rating: number | null;
        by_rater_type: Record<string, {
            count: number;
            avg_rating: number | null;
        }>;
        feedback_items: Record<string, unknown>[];
    }>;
    /**
     * Get 9-box grid data
     */
    get9BoxGrid(tenantId: string, reviewCycleId?: string): Promise<{
        grid: Record<string, Record<string, unknown>[]>;
        summary: {
            total: number;
            by_category: Record<string, number>;
        };
    }>;
    /**
     * Get competency frameworks
     */
    getCompetencyFrameworks(tenantId: string): Promise<Record<string, unknown>[]>;
    /**
     * Get competencies for a framework
     */
    getFrameworkCompetencies(tenantId: string, frameworkId: string): Promise<Record<string, unknown>[]>;
    /**
     * Get rating scales
     */
    getRatingScales(tenantId: string): Promise<Record<string, unknown>[]>;
}
export declare const performanceManagementService: PerformanceManagementService;
//# sourceMappingURL=performance-management.d.ts.map