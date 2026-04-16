/**
 * Zod Schemas for Engagement Routes
 * Covers: feedback, news, notifications, whistleblowing
 */
import { z } from 'zod';
export declare const createContinuousFeedbackSchema: z.ZodObject<{
    from_employee_id: z.ZodString;
    to_employee_id: z.ZodString;
    feedback_type: z.ZodOptional<z.ZodEnum<["praise", "suggestion", "concern"]>>;
    message: z.ZodString;
    is_private: z.ZodOptional<z.ZodBoolean>;
    related_goal_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    from_employee_id: string;
    to_employee_id: string;
    feedback_type?: "suggestion" | "praise" | "concern" | undefined;
    related_goal_id?: string | null | undefined;
    is_private?: boolean | undefined;
}, {
    message: string;
    from_employee_id: string;
    to_employee_id: string;
    feedback_type?: "suggestion" | "praise" | "concern" | undefined;
    related_goal_id?: string | null | undefined;
    is_private?: boolean | undefined;
}>;
export declare const createQuickFeedbackSchema: z.ZodObject<{
    from_employee_id: z.ZodString;
    to_employee_id: z.ZodString;
    feedback_type: z.ZodOptional<z.ZodEnum<["praise", "suggestion", "concern"]>>;
    message: z.ZodString;
    visibility: z.ZodOptional<z.ZodEnum<["private", "public", "team"]>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    competency_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    related_goal_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    tags: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    from_employee_id: string;
    to_employee_id: string;
    category?: string | null | undefined;
    tags?: string[] | null | undefined;
    visibility?: "team" | "private" | "public" | undefined;
    feedback_type?: "suggestion" | "praise" | "concern" | undefined;
    related_goal_id?: string | null | undefined;
    competency_id?: string | null | undefined;
}, {
    message: string;
    from_employee_id: string;
    to_employee_id: string;
    category?: string | null | undefined;
    tags?: string[] | null | undefined;
    visibility?: "team" | "private" | "public" | undefined;
    feedback_type?: "suggestion" | "praise" | "concern" | undefined;
    related_goal_id?: string | null | undefined;
    competency_id?: string | null | undefined;
}>;
export declare const createFeedback360Schema: z.ZodObject<{
    target_employee_id: z.ZodString;
    reviewer_employee_id: z.ZodString;
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    relationship_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    overall_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_anonymous: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodEnum<["pending", "in_progress", "completed", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    target_employee_id: string;
    reviewer_employee_id: string;
    status?: "pending" | "completed" | "in_progress" | "cancelled" | undefined;
    review_cycle_id?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    overall_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    relationship_type?: string | null | undefined;
}, {
    target_employee_id: string;
    reviewer_employee_id: string;
    status?: "pending" | "completed" | "in_progress" | "cancelled" | undefined;
    review_cycle_id?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    overall_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    relationship_type?: string | null | undefined;
}>;
export declare const updateFeedback360Schema: z.ZodObject<{
    relationship_type: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    overall_rating: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    strengths: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["pending", "in_progress", "completed", "cancelled"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "completed" | "in_progress" | "cancelled" | undefined;
    overall_rating?: number | undefined;
    strengths?: string | undefined;
    areas_for_improvement?: string | undefined;
    relationship_type?: string | undefined;
}, {
    status?: "pending" | "completed" | "in_progress" | "cancelled" | undefined;
    overall_rating?: number | undefined;
    strengths?: string | undefined;
    areas_for_improvement?: string | undefined;
    relationship_type?: string | undefined;
}>;
export declare const completeFeedback360Schema: z.ZodObject<{
    overall_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    areas_for_improvement: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    question_responses: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    overall_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    question_responses?: Record<string, unknown> | undefined;
}, {
    overall_rating?: number | null | undefined;
    strengths?: string | null | undefined;
    areas_for_improvement?: string | null | undefined;
    question_responses?: Record<string, unknown> | undefined;
}>;
export declare const createQuestionnaireSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    relationship_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    created_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        question_text: z.ZodString;
        question_type: z.ZodOptional<z.ZodString>;
        category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        relationship_types: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        is_required: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        question_text: string;
        category?: string | null | undefined;
        is_required?: boolean | undefined;
        relationship_types?: string[] | null | undefined;
        question_type?: string | undefined;
    }, {
        question_text: string;
        category?: string | null | undefined;
        is_required?: boolean | undefined;
        relationship_types?: string[] | null | undefined;
        question_type?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    created_by?: string | null | undefined;
    is_default?: boolean | undefined;
    relationship_types?: string[] | undefined;
    questions?: {
        question_text: string;
        category?: string | null | undefined;
        is_required?: boolean | undefined;
        relationship_types?: string[] | null | undefined;
        question_type?: string | undefined;
    }[] | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    created_by?: string | null | undefined;
    is_default?: boolean | undefined;
    relationship_types?: string[] | undefined;
    questions?: {
        question_text: string;
        category?: string | null | undefined;
        is_required?: boolean | undefined;
        relationship_types?: string[] | null | undefined;
        question_type?: string | undefined;
    }[] | undefined;
}>;
export declare const requestFeedback360Schema: z.ZodObject<{
    reviewer_ids: z.ZodArray<z.ZodString, "many">;
    relationship_type: z.ZodOptional<z.ZodString>;
    questionnaire_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    due_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_anonymous: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reviewer_ids: string[];
    due_date?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    relationship_type?: string | undefined;
    questionnaire_id?: string | null | undefined;
}, {
    reviewer_ids: string[];
    due_date?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    relationship_type?: string | undefined;
    questionnaire_id?: string | null | undefined;
}>;
export declare const createArticleSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    excerpt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cover_image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    is_featured: z.ZodOptional<z.ZodBoolean>;
    is_pinned: z.ZodOptional<z.ZodBoolean>;
    allow_comments: z.ZodOptional<z.ZodBoolean>;
    requires_acknowledgment: z.ZodOptional<z.ZodBoolean>;
    audience_type: z.ZodOptional<z.ZodEnum<["all", "department", "role", "custom"]>>;
    audience_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publish_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "published", "scheduled", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    status?: "draft" | "published" | "scheduled" | "archived" | undefined;
    tags?: string[] | undefined;
    excerpt?: string | null | undefined;
    cover_image_url?: string | null | undefined;
    category_id?: string | null | undefined;
    is_featured?: boolean | undefined;
    is_pinned?: boolean | undefined;
    allow_comments?: boolean | undefined;
    requires_acknowledgment?: boolean | undefined;
    audience_type?: "all" | "role" | "department" | "custom" | undefined;
    audience_ids?: string[] | undefined;
    publish_at?: string | null | undefined;
}, {
    title: string;
    content: string;
    status?: "draft" | "published" | "scheduled" | "archived" | undefined;
    tags?: string[] | undefined;
    excerpt?: string | null | undefined;
    cover_image_url?: string | null | undefined;
    category_id?: string | null | undefined;
    is_featured?: boolean | undefined;
    is_pinned?: boolean | undefined;
    allow_comments?: boolean | undefined;
    requires_acknowledgment?: boolean | undefined;
    audience_type?: "all" | "role" | "department" | "custom" | undefined;
    audience_ids?: string[] | undefined;
    publish_at?: string | null | undefined;
}>;
export declare const updateArticleSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    content: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    excerpt: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    cover_image_url: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    category_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_featured: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    is_pinned: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    allow_comments: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    requires_acknowledgment: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    audience_type: z.ZodOptional<z.ZodOptional<z.ZodEnum<["all", "department", "role", "custom"]>>>;
    audience_ids: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    publish_at: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["draft", "published", "scheduled", "archived"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "draft" | "published" | "scheduled" | "archived" | undefined;
    title?: string | undefined;
    content?: string | undefined;
    excerpt?: string | null | undefined;
    cover_image_url?: string | null | undefined;
    category_id?: string | null | undefined;
    is_featured?: boolean | undefined;
    is_pinned?: boolean | undefined;
    allow_comments?: boolean | undefined;
    requires_acknowledgment?: boolean | undefined;
    audience_type?: "all" | "role" | "department" | "custom" | undefined;
    audience_ids?: string[] | undefined;
    publish_at?: string | null | undefined;
}, {
    status?: "draft" | "published" | "scheduled" | "archived" | undefined;
    title?: string | undefined;
    content?: string | undefined;
    excerpt?: string | null | undefined;
    cover_image_url?: string | null | undefined;
    category_id?: string | null | undefined;
    is_featured?: boolean | undefined;
    is_pinned?: boolean | undefined;
    allow_comments?: boolean | undefined;
    requires_acknowledgment?: boolean | undefined;
    audience_type?: "all" | "role" | "department" | "custom" | undefined;
    audience_ids?: string[] | undefined;
    publish_at?: string | null | undefined;
}>;
export declare const createReactionSchema: z.ZodObject<{
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: string | null | undefined;
}, {
    type?: string | null | undefined;
}>;
export declare const createCommentSchema: z.ZodObject<{
    content: z.ZodString;
    parent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    parent_id?: string | null | undefined;
}, {
    content: string;
    parent_id?: string | null | undefined;
}>;
export declare const createNotificationSchema: z.ZodObject<{
    type: z.ZodString;
    title: z.ZodString;
    message: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    user_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action_label: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    expires_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: string;
    title: string;
    metadata?: Record<string, unknown> | null | undefined;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    user_id?: string | null | undefined;
    action_url?: string | null | undefined;
    action_label?: string | null | undefined;
    expires_at?: string | null | undefined;
}, {
    message: string;
    type: string;
    title: string;
    metadata?: Record<string, unknown> | null | undefined;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    user_id?: string | null | undefined;
    action_url?: string | null | undefined;
    action_label?: string | null | undefined;
    expires_at?: string | null | undefined;
}>;
export declare const markAllReadSchema: z.ZodObject<{
    user_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string | null | undefined;
}, {
    user_id?: string | null | undefined;
}>;
export declare const updateNotificationPreferencesSchema: z.ZodObject<{
    email_enabled: z.ZodOptional<z.ZodBoolean>;
    in_app_enabled: z.ZodOptional<z.ZodBoolean>;
    goal_reminders: z.ZodOptional<z.ZodBoolean>;
    review_reminders: z.ZodOptional<z.ZodBoolean>;
    flight_risk_alerts: z.ZodOptional<z.ZodBoolean>;
    checkin_reminders: z.ZodOptional<z.ZodBoolean>;
    survey_notifications: z.ZodOptional<z.ZodBoolean>;
    recognition_notifications: z.ZodOptional<z.ZodBoolean>;
    system_notifications: z.ZodOptional<z.ZodBoolean>;
    quiet_hours_start: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    quiet_hours_end: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    mentorship_notifications: z.ZodOptional<z.ZodBoolean>;
    mobility_notifications: z.ZodOptional<z.ZodBoolean>;
    wellbeing_notifications: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email_enabled?: boolean | undefined;
    in_app_enabled?: boolean | undefined;
    goal_reminders?: boolean | undefined;
    review_reminders?: boolean | undefined;
    flight_risk_alerts?: boolean | undefined;
    checkin_reminders?: boolean | undefined;
    survey_notifications?: boolean | undefined;
    recognition_notifications?: boolean | undefined;
    system_notifications?: boolean | undefined;
    quiet_hours_start?: string | null | undefined;
    quiet_hours_end?: string | null | undefined;
    mentorship_notifications?: boolean | undefined;
    mobility_notifications?: boolean | undefined;
    wellbeing_notifications?: boolean | undefined;
}, {
    email_enabled?: boolean | undefined;
    in_app_enabled?: boolean | undefined;
    goal_reminders?: boolean | undefined;
    review_reminders?: boolean | undefined;
    flight_risk_alerts?: boolean | undefined;
    checkin_reminders?: boolean | undefined;
    survey_notifications?: boolean | undefined;
    recognition_notifications?: boolean | undefined;
    system_notifications?: boolean | undefined;
    quiet_hours_start?: string | null | undefined;
    quiet_hours_end?: string | null | undefined;
    mentorship_notifications?: boolean | undefined;
    mobility_notifications?: boolean | undefined;
    wellbeing_notifications?: boolean | undefined;
}>;
export declare const createWhistleblowingReportSchema: z.ZodObject<{
    category: z.ZodString;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    title: z.ZodString;
    description: z.ZodString;
    incident_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    incident_location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    involved_persons: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    witnesses: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    reporter_type: z.ZodOptional<z.ZodEnum<["anonymous", "confidential", "identified"]>>;
    reporter_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reporter_email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reporter_phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reporter_employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    consent_data_processing: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    description: string;
    title: string;
    category: string;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
    incident_date?: string | null | undefined;
    incident_location?: string | null | undefined;
    involved_persons?: unknown[] | undefined;
    witnesses?: unknown[] | undefined;
    reporter_type?: "anonymous" | "confidential" | "identified" | undefined;
    reporter_name?: string | null | undefined;
    reporter_email?: string | null | undefined;
    reporter_phone?: string | null | undefined;
    reporter_employee_id?: string | null | undefined;
    consent_data_processing?: boolean | undefined;
}, {
    description: string;
    title: string;
    category: string;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
    incident_date?: string | null | undefined;
    incident_location?: string | null | undefined;
    involved_persons?: unknown[] | undefined;
    witnesses?: unknown[] | undefined;
    reporter_type?: "anonymous" | "confidential" | "identified" | undefined;
    reporter_name?: string | null | undefined;
    reporter_email?: string | null | undefined;
    reporter_phone?: string | null | undefined;
    reporter_employee_id?: string | null | undefined;
    consent_data_processing?: boolean | undefined;
}>;
export declare const updateWhistleblowingStatusSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    resolution_type: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    resolution_summary: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    assigned_to: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    priority: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    priority?: string | undefined;
    resolution_type?: string | undefined;
    resolution_summary?: string | undefined;
    assigned_to?: string | undefined;
}, {
    status?: string | undefined;
    priority?: string | undefined;
    resolution_type?: string | undefined;
    resolution_summary?: string | undefined;
    assigned_to?: string | undefined;
}>;
//# sourceMappingURL=engagement.d.ts.map