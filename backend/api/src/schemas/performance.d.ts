import { z } from 'zod';
export declare const createReviewSchema: z.ZodObject<{
    employee_id: z.ZodString;
    reviewer_id: z.ZodString;
    review_period_start: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    review_period_end: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    review_type: z.ZodOptional<z.ZodEnum<["annual", "mid_year", "quarterly", "probation", "project", "ad_hoc"]>>;
    overall_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    goal_achievement_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    competency_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    potential_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    manager_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["draft", "pending", "in_progress", "submitted", "completed", "acknowledged"]>>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "draft" | "acknowledged" | "completed" | "in_progress" | "submitted";
    employee_id: string;
    reviewer_id: string;
    overall_rating?: number | null | undefined;
    manager_comments?: string | null | undefined;
    review_period_start?: string | null | undefined;
    review_period_end?: string | null | undefined;
    review_type?: "annual" | "probation" | "quarterly" | "project" | "mid_year" | "ad_hoc" | undefined;
    goal_achievement_rating?: number | null | undefined;
    competency_rating?: number | null | undefined;
    potential_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    employee_comments?: string | null | undefined;
}, {
    employee_id: string;
    reviewer_id: string;
    status?: "pending" | "draft" | "acknowledged" | "completed" | "in_progress" | "submitted" | undefined;
    overall_rating?: number | null | undefined;
    manager_comments?: string | null | undefined;
    review_period_start?: string | null | undefined;
    review_period_end?: string | null | undefined;
    review_type?: "annual" | "probation" | "quarterly" | "project" | "mid_year" | "ad_hoc" | undefined;
    goal_achievement_rating?: number | null | undefined;
    competency_rating?: number | null | undefined;
    potential_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    employee_comments?: string | null | undefined;
}>;
export declare const updateReviewSchema: z.ZodObject<{
    review_period_start: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    review_period_end: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    review_type: z.ZodOptional<z.ZodEnum<["annual", "mid_year", "quarterly", "probation", "project", "ad_hoc"]>>;
    overall_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    goal_achievement_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    competency_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    potential_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    manager_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "in_progress", "submitted", "completed", "acknowledged"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "draft" | "acknowledged" | "completed" | "in_progress" | "submitted" | undefined;
    overall_rating?: number | null | undefined;
    manager_comments?: string | null | undefined;
    review_period_start?: string | null | undefined;
    review_period_end?: string | null | undefined;
    review_type?: "annual" | "probation" | "quarterly" | "project" | "mid_year" | "ad_hoc" | undefined;
    goal_achievement_rating?: number | null | undefined;
    competency_rating?: number | null | undefined;
    potential_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    employee_comments?: string | null | undefined;
}, {
    status?: "pending" | "draft" | "acknowledged" | "completed" | "in_progress" | "submitted" | undefined;
    overall_rating?: number | null | undefined;
    manager_comments?: string | null | undefined;
    review_period_start?: string | null | undefined;
    review_period_end?: string | null | undefined;
    review_type?: "annual" | "probation" | "quarterly" | "project" | "mid_year" | "ad_hoc" | undefined;
    goal_achievement_rating?: number | null | undefined;
    competency_rating?: number | null | undefined;
    potential_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    employee_comments?: string | null | undefined;
}>;
export declare const updateFeedback360Schema: z.ZodObject<{
    overall_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    competency_ratings: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    additional_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    submit: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    submit?: boolean | undefined;
    overall_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    competency_ratings?: Record<string, unknown> | null | undefined;
    additional_comments?: string | null | undefined;
}, {
    submit?: boolean | undefined;
    overall_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    competency_ratings?: Record<string, unknown> | null | undefined;
    additional_comments?: string | null | undefined;
}>;
export declare const updateGoalRatingSchema: z.ZodObject<{
    self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    self_comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    achievement_description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    self_rating?: number | null | undefined;
    self_comment?: string | null | undefined;
    achievement_description?: string | null | undefined;
}, {
    self_rating?: number | null | undefined;
    self_comment?: string | null | undefined;
    achievement_description?: string | null | undefined;
}>;
export declare const saveSelfAssessmentSchema: z.ZodObject<{
    self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    self_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    goal_ratings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        goal_id: z.ZodString;
        self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        self_comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        goal_id: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }, {
        goal_id: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }>, "many">>;
    competency_ratings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        competency_name: z.ZodString;
        self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        self_comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        competency_name: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }, {
        competency_name: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }>, "many">>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    competency_ratings?: {
        competency_name: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }[] | undefined;
    self_rating?: number | null | undefined;
    self_comments?: string | null | undefined;
    goal_ratings?: {
        goal_id: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }[] | undefined;
}, {
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    competency_ratings?: {
        competency_name: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }[] | undefined;
    self_rating?: number | null | undefined;
    self_comments?: string | null | undefined;
    goal_ratings?: {
        goal_id: string;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
    }[] | undefined;
}>;
export declare const addEvidenceSchema: z.ZodObject<{
    evidence_type: z.ZodEnum<["achievement", "certification", "feedback", "metric", "project", "other"]>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    file_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    external_link: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    related_goal_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    related_competency: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    date_achieved: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    evidence_type: "other" | "certification" | "project" | "feedback" | "achievement" | "metric";
    description?: string | null | undefined;
    file_url?: string | null | undefined;
    external_link?: string | null | undefined;
    related_goal_id?: string | null | undefined;
    related_competency?: string | null | undefined;
    date_achieved?: string | null | undefined;
}, {
    title: string;
    evidence_type: "other" | "certification" | "project" | "feedback" | "achievement" | "metric";
    description?: string | null | undefined;
    file_url?: string | null | undefined;
    external_link?: string | null | undefined;
    related_goal_id?: string | null | undefined;
    related_competency?: string | null | undefined;
    date_achieved?: string | null | undefined;
}>;
export declare const updateCompetenciesSchema: z.ZodObject<{
    competencies: z.ZodArray<z.ZodObject<{
        ksaba_dimension: z.ZodOptional<z.ZodEnum<["knowledge", "skills", "abilities", "behaviors", "attitudes"]>>;
        competency_name: z.ZodString;
        self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        self_comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        weight: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        competency_name: string;
        weight?: number | null | undefined;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
        ksaba_dimension?: "knowledge" | "skills" | "abilities" | "behaviors" | "attitudes" | undefined;
    }, {
        competency_name: string;
        weight?: number | null | undefined;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
        ksaba_dimension?: "knowledge" | "skills" | "abilities" | "behaviors" | "attitudes" | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    competencies: {
        competency_name: string;
        weight?: number | null | undefined;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
        ksaba_dimension?: "knowledge" | "skills" | "abilities" | "behaviors" | "attitudes" | undefined;
    }[];
}, {
    competencies: {
        competency_name: string;
        weight?: number | null | undefined;
        self_rating?: number | null | undefined;
        self_comment?: string | null | undefined;
        ksaba_dimension?: "knowledge" | "skills" | "abilities" | "behaviors" | "attitudes" | undefined;
    }[];
}>;
export declare const saveManagerReviewSchema: z.ZodObject<{
    overall_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    goal_achievement_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    competency_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    potential_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    manager_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    goal_ratings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        goal_id: z.ZodString;
        manager_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        manager_comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        goal_id: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }, {
        goal_id: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }>, "many">>;
    competency_ratings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        competency_name: z.ZodString;
        manager_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        manager_comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        competency_name: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }, {
        competency_name: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    overall_rating?: number | null | undefined;
    manager_comments?: string | null | undefined;
    goal_achievement_rating?: number | null | undefined;
    competency_rating?: number | null | undefined;
    potential_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    competency_ratings?: {
        competency_name: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }[] | undefined;
    goal_ratings?: {
        goal_id: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }[] | undefined;
}, {
    overall_rating?: number | null | undefined;
    manager_comments?: string | null | undefined;
    goal_achievement_rating?: number | null | undefined;
    competency_rating?: number | null | undefined;
    potential_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    competency_ratings?: {
        competency_name: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }[] | undefined;
    goal_ratings?: {
        goal_id: string;
        manager_rating?: number | null | undefined;
        manager_comment?: string | null | undefined;
    }[] | undefined;
}>;
export declare const submitManagerReviewSchema: z.ZodObject<{
    flag_for_calibration: z.ZodOptional<z.ZodBoolean>;
    calibration_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    flag_for_calibration?: boolean | undefined;
    calibration_notes?: string | null | undefined;
}, {
    flag_for_calibration?: boolean | undefined;
    calibration_notes?: string | null | undefined;
}>;
export declare const completeReviewSchema: z.ZodObject<{
    final_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    final_comments?: string | null | undefined;
}, {
    final_comments?: string | null | undefined;
}>;
export declare const acknowledgeReviewSchema: z.ZodObject<{
    employee_acknowledgment_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_acknowledgment_comments?: string | null | undefined;
}, {
    employee_acknowledgment_comments?: string | null | undefined;
}>;
export declare const createSelfReviewSchema: z.ZodObject<{
    self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    achievements: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    challenges: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    development_goals: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    feedback_for_manager: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    competency_ratings: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    additional_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    competency_ratings?: Record<string, unknown> | null | undefined;
    additional_comments?: string | null | undefined;
    self_rating?: number | null | undefined;
    achievements?: string | null | undefined;
    challenges?: string | null | undefined;
    development_goals?: string | null | undefined;
    feedback_for_manager?: string | null | undefined;
}, {
    competency_ratings?: Record<string, unknown> | null | undefined;
    additional_comments?: string | null | undefined;
    self_rating?: number | null | undefined;
    achievements?: string | null | undefined;
    challenges?: string | null | undefined;
    development_goals?: string | null | undefined;
    feedback_for_manager?: string | null | undefined;
}>;
export declare const updateSelfReviewSchema: z.ZodObject<{
    self_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    achievements: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    challenges: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    development_goals: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    feedback_for_manager: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    competency_ratings: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    additional_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    competency_ratings?: Record<string, unknown> | null | undefined;
    additional_comments?: string | null | undefined;
    self_rating?: number | null | undefined;
    achievements?: string | null | undefined;
    challenges?: string | null | undefined;
    development_goals?: string | null | undefined;
    feedback_for_manager?: string | null | undefined;
}, {
    competency_ratings?: Record<string, unknown> | null | undefined;
    additional_comments?: string | null | undefined;
    self_rating?: number | null | undefined;
    achievements?: string | null | undefined;
    challenges?: string | null | undefined;
    development_goals?: string | null | undefined;
    feedback_for_manager?: string | null | undefined;
}>;
export declare const request360FeedbackSchema: z.ZodObject<{
    raters: z.ZodArray<z.ZodObject<{
        rater_id: z.ZodString;
        relationship: z.ZodOptional<z.ZodEnum<["peer", "subordinate", "manager", "cross_functional", "external"]>>;
    }, "strip", z.ZodTypeAny, {
        rater_id: string;
        relationship?: "manager" | "peer" | "external" | "subordinate" | "cross_functional" | undefined;
    }, {
        rater_id: string;
        relationship?: "manager" | "peer" | "external" | "subordinate" | "cross_functional" | undefined;
    }>, "many">;
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    raters: {
        rater_id: string;
        relationship?: "manager" | "peer" | "external" | "subordinate" | "cross_functional" | undefined;
    }[];
    review_cycle_id?: string | null | undefined;
}, {
    raters: {
        rater_id: string;
        relationship?: "manager" | "peer" | "external" | "subordinate" | "cross_functional" | undefined;
    }[];
    review_cycle_id?: string | null | undefined;
}>;
export declare const decline360FeedbackSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
export declare const createReviewCycleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cycle_type: z.ZodOptional<z.ZodEnum<["annual", "mid_year", "quarterly", "probation", "ad_hoc"]>>;
    start_date: z.ZodString;
    end_date: z.ZodString;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["draft", "active", "completed", "cancelled"]>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: "active" | "draft" | "completed" | "cancelled";
    start_date: string;
    end_date: string;
    description?: string | null | undefined;
    cycle_type?: "annual" | "probation" | "quarterly" | "mid_year" | "ad_hoc" | undefined;
}, {
    name: string;
    start_date: string;
    end_date: string;
    description?: string | null | undefined;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    cycle_type?: "annual" | "probation" | "quarterly" | "mid_year" | "ad_hoc" | undefined;
}>;
export declare const updateReviewCycleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cycle_type: z.ZodOptional<z.ZodEnum<["annual", "mid_year", "quarterly", "probation", "ad_hoc"]>>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "completed", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    cycle_type?: "annual" | "probation" | "quarterly" | "mid_year" | "ad_hoc" | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    cycle_type?: "annual" | "probation" | "quarterly" | "mid_year" | "ad_hoc" | undefined;
}>;
export declare const addCycleParticipantsSchema: z.ZodObject<{
    employee_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    org_unit_id: z.ZodOptional<z.ZodString>;
    include_all: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    org_unit_id?: string | undefined;
    employee_ids?: string[] | undefined;
    include_all?: boolean | undefined;
}, {
    org_unit_id?: string | undefined;
    employee_ids?: string[] | undefined;
    include_all?: boolean | undefined;
}>;
export declare const updateCycleParticipantSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "in_progress", "completed"]>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    self_review_completed: z.ZodOptional<z.ZodBoolean>;
    manager_review_completed: z.ZodOptional<z.ZodBoolean>;
    calibration_completed: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "draft" | "completed" | "in_progress" | undefined;
    notes?: string | null | undefined;
    self_review_completed?: boolean | undefined;
    manager_review_completed?: boolean | undefined;
    calibration_completed?: boolean | undefined;
}, {
    status?: "pending" | "draft" | "completed" | "in_progress" | undefined;
    notes?: string | null | undefined;
    self_review_completed?: boolean | undefined;
    manager_review_completed?: boolean | undefined;
    calibration_completed?: boolean | undefined;
}>;
export declare const addCyclePhasesSchema: z.ZodObject<{
    phases: z.ZodArray<z.ZodObject<{
        phase_name: z.ZodString;
        phase_order: z.ZodNumber;
        start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        instructions: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        reminder_days_before: z.ZodOptional<z.ZodNumber>;
        escalation_days_after: z.ZodOptional<z.ZodNumber>;
        is_required: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        phase_name: string;
        phase_order: number;
        start_date?: string | null | undefined;
        end_date?: string | null | undefined;
        instructions?: string | null | undefined;
        reminder_days_before?: number | undefined;
        escalation_days_after?: number | undefined;
        is_required?: boolean | undefined;
    }, {
        phase_name: string;
        phase_order: number;
        start_date?: string | null | undefined;
        end_date?: string | null | undefined;
        instructions?: string | null | undefined;
        reminder_days_before?: number | undefined;
        escalation_days_after?: number | undefined;
        is_required?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    phases: {
        phase_name: string;
        phase_order: number;
        start_date?: string | null | undefined;
        end_date?: string | null | undefined;
        instructions?: string | null | undefined;
        reminder_days_before?: number | undefined;
        escalation_days_after?: number | undefined;
        is_required?: boolean | undefined;
    }[];
}, {
    phases: {
        phase_name: string;
        phase_order: number;
        start_date?: string | null | undefined;
        end_date?: string | null | undefined;
        instructions?: string | null | undefined;
        reminder_days_before?: number | undefined;
        escalation_days_after?: number | undefined;
        is_required?: boolean | undefined;
    }[];
}>;
export declare const updateCyclePhaseSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "active", "completed", "skipped"]>>;
    start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    instructions: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_required: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "pending" | "completed" | "skipped" | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    instructions?: string | null | undefined;
    is_required?: boolean | undefined;
}, {
    status?: "active" | "pending" | "completed" | "skipped" | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    instructions?: string | null | undefined;
    is_required?: boolean | undefined;
}>;
export declare const closeCycleSchema: z.ZodObject<{
    force: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    force: boolean;
}, {
    force?: boolean | undefined;
}>;
export declare const createTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    template_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["standard", "simplified", "executive", "probation"]>>>;
    rating_scale_type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    rating_scale_config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sections: z.ZodArray<z.ZodUnknown, "many">;
    competencies: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>>;
    include_goals: z.ZodOptional<z.ZodBoolean>;
    include_development_plan: z.ZodOptional<z.ZodBoolean>;
    is_default: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sections: unknown[];
    template_type: "probation" | "standard" | "simplified" | "executive";
    rating_scale_type: string;
    description?: string | null | undefined;
    competencies?: unknown[] | null | undefined;
    rating_scale_config?: Record<string, unknown> | undefined;
    include_goals?: boolean | undefined;
    include_development_plan?: boolean | undefined;
    is_default?: boolean | undefined;
}, {
    name: string;
    sections: unknown[];
    description?: string | null | undefined;
    competencies?: unknown[] | null | undefined;
    template_type?: "probation" | "standard" | "simplified" | "executive" | undefined;
    rating_scale_type?: string | undefined;
    rating_scale_config?: Record<string, unknown> | undefined;
    include_goals?: boolean | undefined;
    include_development_plan?: boolean | undefined;
    is_default?: boolean | undefined;
}>;
export declare const updateTemplateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    template_type: z.ZodOptional<z.ZodEnum<["standard", "simplified", "executive", "probation"]>>;
    rating_scale_type: z.ZodOptional<z.ZodString>;
    rating_scale_config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sections: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    competencies: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>>;
    include_goals: z.ZodOptional<z.ZodBoolean>;
    include_development_plan: z.ZodOptional<z.ZodBoolean>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | undefined;
    sections?: unknown[] | undefined;
    competencies?: unknown[] | null | undefined;
    template_type?: "probation" | "standard" | "simplified" | "executive" | undefined;
    rating_scale_type?: string | undefined;
    rating_scale_config?: Record<string, unknown> | undefined;
    include_goals?: boolean | undefined;
    include_development_plan?: boolean | undefined;
    is_default?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | undefined;
    sections?: unknown[] | undefined;
    competencies?: unknown[] | null | undefined;
    template_type?: "probation" | "standard" | "simplified" | "executive" | undefined;
    rating_scale_type?: string | undefined;
    rating_scale_config?: Record<string, unknown> | undefined;
    include_goals?: boolean | undefined;
    include_development_plan?: boolean | undefined;
    is_default?: boolean | undefined;
}>;
export declare const autoAssignParticipantsSchema: z.ZodObject<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    employee_status: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_status: string;
    org_unit_ids?: string[] | null | undefined;
}, {
    org_unit_ids?: string[] | null | undefined;
    employee_status?: string | undefined;
}>;
export declare const createCheckInSchema: z.ZodObject<{
    employee_id: z.ZodString;
    manager_id: z.ZodString;
    scheduled_date: z.ZodString;
    duration_minutes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    meeting_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["one_on_one", "team", "skip_level", "ad_hoc"]>>>;
    agenda: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    manager_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action_items: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>>;
    employee_mood: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["scheduled", "completed", "cancelled", "rescheduled"]>>>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "cancelled" | "scheduled" | "rescheduled";
    employee_id: string;
    manager_id: string;
    scheduled_date: string;
    duration_minutes: number;
    meeting_type: "team" | "one_on_one" | "ad_hoc" | "skip_level";
    agenda?: string | null | undefined;
    employee_notes?: string | null | undefined;
    manager_notes?: string | null | undefined;
    action_items?: unknown[] | null | undefined;
    employee_mood?: number | null | undefined;
}, {
    employee_id: string;
    manager_id: string;
    scheduled_date: string;
    status?: "completed" | "cancelled" | "scheduled" | "rescheduled" | undefined;
    duration_minutes?: number | undefined;
    meeting_type?: "team" | "one_on_one" | "ad_hoc" | "skip_level" | undefined;
    agenda?: string | null | undefined;
    employee_notes?: string | null | undefined;
    manager_notes?: string | null | undefined;
    action_items?: unknown[] | null | undefined;
    employee_mood?: number | null | undefined;
}>;
export declare const updateCheckInSchema: z.ZodObject<{
    scheduled_date: z.ZodOptional<z.ZodString>;
    duration_minutes: z.ZodOptional<z.ZodNumber>;
    meeting_type: z.ZodOptional<z.ZodEnum<["one_on_one", "team", "skip_level", "ad_hoc"]>>;
    agenda: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    manager_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action_items: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>>;
    employee_mood: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "completed", "cancelled", "rescheduled"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "completed" | "cancelled" | "scheduled" | "rescheduled" | undefined;
    scheduled_date?: string | undefined;
    duration_minutes?: number | undefined;
    meeting_type?: "team" | "one_on_one" | "ad_hoc" | "skip_level" | undefined;
    agenda?: string | null | undefined;
    employee_notes?: string | null | undefined;
    manager_notes?: string | null | undefined;
    action_items?: unknown[] | null | undefined;
    employee_mood?: number | null | undefined;
}, {
    status?: "completed" | "cancelled" | "scheduled" | "rescheduled" | undefined;
    scheduled_date?: string | undefined;
    duration_minutes?: number | undefined;
    meeting_type?: "team" | "one_on_one" | "ad_hoc" | "skip_level" | undefined;
    agenda?: string | null | undefined;
    employee_notes?: string | null | undefined;
    manager_notes?: string | null | undefined;
    action_items?: unknown[] | null | undefined;
    employee_mood?: number | null | undefined;
}>;
export declare const completeCheckInSchema: z.ZodObject<{
    employee_mood: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    action_items: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>>;
    manager_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_notes?: string | null | undefined;
    manager_notes?: string | null | undefined;
    action_items?: unknown[] | null | undefined;
    employee_mood?: number | null | undefined;
}, {
    employee_notes?: string | null | undefined;
    manager_notes?: string | null | undefined;
    action_items?: unknown[] | null | undefined;
    employee_mood?: number | null | undefined;
}>;
export declare const createCalibrationSessionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduled_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduled_end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    meeting_link: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    facilitator_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    facilitator_ids: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["scheduled", "in_progress", "completed", "cancelled"]>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: "completed" | "in_progress" | "cancelled" | "scheduled";
    description?: string | null | undefined;
    location?: string | null | undefined;
    org_unit_id?: string | null | undefined;
    review_cycle_id?: string | null | undefined;
    scheduled_date?: string | null | undefined;
    scheduled_end_date?: string | null | undefined;
    meeting_link?: string | null | undefined;
    facilitator_id?: string | null | undefined;
    facilitator_ids?: string[] | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    status?: "completed" | "in_progress" | "cancelled" | "scheduled" | undefined;
    location?: string | null | undefined;
    org_unit_id?: string | null | undefined;
    review_cycle_id?: string | null | undefined;
    scheduled_date?: string | null | undefined;
    scheduled_end_date?: string | null | undefined;
    meeting_link?: string | null | undefined;
    facilitator_id?: string | null | undefined;
    facilitator_ids?: string[] | null | undefined;
}>;
export declare const updateCalibrationSessionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduled_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduled_end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    meeting_link: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "in_progress", "completed", "cancelled"]>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: "completed" | "in_progress" | "cancelled" | "scheduled" | undefined;
    location?: string | null | undefined;
    notes?: string | null | undefined;
    scheduled_date?: string | null | undefined;
    scheduled_end_date?: string | null | undefined;
    meeting_link?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: "completed" | "in_progress" | "cancelled" | "scheduled" | undefined;
    location?: string | null | undefined;
    notes?: string | null | undefined;
    scheduled_date?: string | null | undefined;
    scheduled_end_date?: string | null | undefined;
    meeting_link?: string | null | undefined;
}>;
export declare const addCalibrationParticipantsSchema: z.ZodObject<{
    participants: z.ZodArray<z.ZodObject<{
        manager_id: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<["facilitator", "calibrator", "subject", "observer", "participant"]>>;
    }, "strip", z.ZodTypeAny, {
        manager_id: string;
        role?: "facilitator" | "calibrator" | "observer" | "subject" | "participant" | undefined;
    }, {
        manager_id: string;
        role?: "facilitator" | "calibrator" | "observer" | "subject" | "participant" | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    participants: {
        manager_id: string;
        role?: "facilitator" | "calibrator" | "observer" | "subject" | "participant" | undefined;
    }[];
}, {
    participants: {
        manager_id: string;
        role?: "facilitator" | "calibrator" | "observer" | "subject" | "participant" | undefined;
    }[];
}>;
export declare const flagOutlierSchema: z.ZodObject<{
    adjustment_id: z.ZodString;
    outlier_reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    adjustment_id: string;
    outlier_reason?: string | null | undefined;
    action_by?: string | null | undefined;
}, {
    adjustment_id: string;
    outlier_reason?: string | null | undefined;
    action_by?: string | null | undefined;
}>;
export declare const createAdjustmentSchema: z.ZodObject<{
    employee_id: z.ZodString;
    performance_review_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    original_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    adjusted_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    adjustment_reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    competency_adjustments: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    adjusted_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    performance_review_id?: string | null | undefined;
    original_rating?: number | null | undefined;
    adjusted_rating?: number | null | undefined;
    adjustment_reason?: string | null | undefined;
    competency_adjustments?: Record<string, unknown> | null | undefined;
    adjusted_by?: string | null | undefined;
}, {
    employee_id: string;
    performance_review_id?: string | null | undefined;
    original_rating?: number | null | undefined;
    adjusted_rating?: number | null | undefined;
    adjustment_reason?: string | null | undefined;
    competency_adjustments?: Record<string, unknown> | null | undefined;
    adjusted_by?: string | null | undefined;
}>;
export declare const updateAdjustmentSchema: z.ZodObject<{
    adjusted_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    adjustment_reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    competency_adjustments: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    final_comments: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    final_comments?: string | null | undefined;
    adjusted_rating?: number | null | undefined;
    adjustment_reason?: string | null | undefined;
    competency_adjustments?: Record<string, unknown> | null | undefined;
}, {
    final_comments?: string | null | undefined;
    adjusted_rating?: number | null | undefined;
    adjustment_reason?: string | null | undefined;
    competency_adjustments?: Record<string, unknown> | null | undefined;
}>;
export declare const updateAdjustmentNotesSchema: z.ZodObject<{
    discussion_notes: z.ZodString;
    action_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    discussion_notes: string;
    action_by?: string | null | undefined;
}, {
    discussion_notes: string;
    action_by?: string | null | undefined;
}>;
export declare const completeCalibrationSessionSchema: z.ZodObject<{
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    decisions: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    decisions?: unknown[] | null | undefined;
}, {
    notes?: string | null | undefined;
    decisions?: unknown[] | null | undefined;
}>;
export declare const cancelCalibrationSessionSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
//# sourceMappingURL=performance.d.ts.map