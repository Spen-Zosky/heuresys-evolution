/**
 * Zod Schemas for Platform Routes
 * Covers: analytics, audit-logs, dashboards, engagement (surveys/pulse/feedback), knowledge-base, leave
 */
import { z } from 'zod';
export declare const trackEventSchema: z.ZodObject<{
    event_type: z.ZodString;
    category: z.ZodString;
    entity_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    entity_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    user_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    session_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    data: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    metrics: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    category: string;
    event_type: string;
    data?: Record<string, unknown> | null | undefined;
    entity_type?: string | null | undefined;
    entity_id?: string | null | undefined;
    user_id?: string | null | undefined;
    session_id?: string | null | undefined;
    metrics?: Record<string, unknown> | null | undefined;
}, {
    category: string;
    event_type: string;
    data?: Record<string, unknown> | null | undefined;
    entity_type?: string | null | undefined;
    entity_id?: string | null | undefined;
    user_id?: string | null | undefined;
    session_id?: string | null | undefined;
    metrics?: Record<string, unknown> | null | undefined;
}>;
export declare const trackEventBatchSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        event_type: z.ZodString;
        category: z.ZodString;
        entity_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        entity_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        user_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        session_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        data: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        metrics: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        event_type: string;
        data?: Record<string, unknown> | null | undefined;
        entity_type?: string | null | undefined;
        entity_id?: string | null | undefined;
        user_id?: string | null | undefined;
        session_id?: string | null | undefined;
        metrics?: Record<string, unknown> | null | undefined;
    }, {
        category: string;
        event_type: string;
        data?: Record<string, unknown> | null | undefined;
        entity_type?: string | null | undefined;
        entity_id?: string | null | undefined;
        user_id?: string | null | undefined;
        session_id?: string | null | undefined;
        metrics?: Record<string, unknown> | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    events: {
        category: string;
        event_type: string;
        data?: Record<string, unknown> | null | undefined;
        entity_type?: string | null | undefined;
        entity_id?: string | null | undefined;
        user_id?: string | null | undefined;
        session_id?: string | null | undefined;
        metrics?: Record<string, unknown> | null | undefined;
    }[];
}, {
    events: {
        category: string;
        event_type: string;
        data?: Record<string, unknown> | null | undefined;
        entity_type?: string | null | undefined;
        entity_id?: string | null | undefined;
        user_id?: string | null | undefined;
        session_id?: string | null | undefined;
        metrics?: Record<string, unknown> | null | undefined;
    }[];
}>;
export declare const computeAggregationsSchema: z.ZodObject<{
    period: z.ZodEnum<["hourly", "daily", "weekly", "monthly"]>;
    date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    period: "daily" | "weekly" | "monthly" | "hourly";
    date?: string | null | undefined;
}, {
    period: "daily" | "weekly" | "monthly" | "hourly";
    date?: string | null | undefined;
}>;
export declare const analyticsExportSchema: z.ZodObject<{
    dashboard: z.ZodEnum<["hr", "performance", "recruitment", "learning", "workforce-planning", "compensation", "time"]>;
    format: z.ZodOptional<z.ZodEnum<["csv", "json", "excel", "pdf"]>>;
}, "strip", z.ZodTypeAny, {
    dashboard: "performance" | "compensation" | "hr" | "recruitment" | "learning" | "workforce-planning" | "time";
    format?: "csv" | "json" | "excel" | "pdf" | undefined;
}, {
    dashboard: "performance" | "compensation" | "hr" | "recruitment" | "learning" | "workforce-planning" | "time";
    format?: "csv" | "json" | "excel" | "pdf" | undefined;
}>;
export declare const createAuditLogSchema: z.ZodObject<{
    user_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    user_email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    user_role: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action: z.ZodString;
    category: z.ZodString;
    resource_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    resource_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    resource_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    old_value: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    new_value: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    ip_address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    user_agent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    success: z.ZodOptional<z.ZodBoolean>;
    error_message: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    category: string;
    action: string;
    description?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    user_id?: string | null | undefined;
    success?: boolean | undefined;
    user_email?: string | null | undefined;
    user_role?: string | null | undefined;
    resource_type?: string | null | undefined;
    resource_id?: string | null | undefined;
    resource_name?: string | null | undefined;
    old_value?: unknown;
    new_value?: unknown;
    ip_address?: string | null | undefined;
    user_agent?: string | null | undefined;
    error_message?: string | null | undefined;
}, {
    category: string;
    action: string;
    description?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    user_id?: string | null | undefined;
    success?: boolean | undefined;
    user_email?: string | null | undefined;
    user_role?: string | null | undefined;
    resource_type?: string | null | undefined;
    resource_id?: string | null | undefined;
    resource_name?: string | null | undefined;
    old_value?: unknown;
    new_value?: unknown;
    ip_address?: string | null | undefined;
    user_agent?: string | null | undefined;
    error_message?: string | null | undefined;
}>;
export declare const updateAuditConfigSchema: z.ZodObject<{
    retentionYears: z.ZodOptional<z.ZodNumber>;
    exportSchedule: z.ZodOptional<z.ZodEnum<["manual", "weekly", "monthly"]>>;
    eventsToLog: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    retentionYears?: number | undefined;
    exportSchedule?: "weekly" | "monthly" | "manual" | undefined;
    eventsToLog?: string | undefined;
}, {
    retentionYears?: number | undefined;
    exportSchedule?: "weekly" | "monthly" | "manual" | undefined;
    eventsToLog?: string | undefined;
}>;
export declare const exportAuditLogsSchema: z.ZodObject<{
    format: z.ZodOptional<z.ZodEnum<["json", "csv"]>>;
    fromDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    toDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    action: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    format?: "csv" | "json" | undefined;
    category?: string | null | undefined;
    action?: string | null | undefined;
    fromDate?: string | null | undefined;
    toDate?: string | null | undefined;
}, {
    format?: "csv" | "json" | undefined;
    category?: string | null | undefined;
    action?: string | null | undefined;
    fromDate?: string | null | undefined;
    toDate?: string | null | undefined;
}>;
export declare const createWidgetTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodString;
    default_config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: string;
    default_config: Record<string, unknown>;
    description?: string | null | undefined;
    created_by?: string | undefined;
}, {
    name: string;
    category: string;
    default_config: Record<string, unknown>;
    description?: string | null | undefined;
    created_by?: string | undefined;
}>;
export declare const createDashboardSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    layout_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    is_shared: z.ZodOptional<z.ZodBoolean>;
    shared_with: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    created_by: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    created_by: string;
    description?: string | null | undefined;
    is_default?: boolean | undefined;
    layout_type?: string | null | undefined;
    is_shared?: boolean | undefined;
    shared_with?: string[] | undefined;
}, {
    name: string;
    created_by: string;
    description?: string | null | undefined;
    is_default?: boolean | undefined;
    layout_type?: string | null | undefined;
    is_shared?: boolean | undefined;
    shared_with?: string[] | undefined;
}>;
export declare const updateDashboardSchema: z.ZodObject<{
    user_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    layout_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    is_shared: z.ZodOptional<z.ZodBoolean>;
    shared_with: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    user_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    layout_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    is_shared: z.ZodOptional<z.ZodBoolean>;
    shared_with: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    user_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    layout_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    is_shared: z.ZodOptional<z.ZodBoolean>;
    shared_with: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const duplicateDashboardSchema: z.ZodObject<{
    name: z.ZodString;
    user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    user_id: string;
}, {
    name: string;
    user_id: string;
}>;
export declare const addWidgetSchema: z.ZodObject<{
    template_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    position: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_by: z.ZodString;
}, "strip", z.ZodTypeAny, {
    config: Record<string, unknown>;
    created_by: string;
    position: Record<string, unknown>;
    template_id?: string | null | undefined;
}, {
    config: Record<string, unknown>;
    created_by: string;
    position: Record<string, unknown>;
    template_id?: string | null | undefined;
}>;
export declare const updateWidgetSchema: z.ZodObject<{
    config: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    position: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    config?: Record<string, unknown> | undefined;
    position?: Record<string, unknown> | undefined;
}, {
    config?: Record<string, unknown> | undefined;
    position?: Record<string, unknown> | undefined;
}>;
export declare const updateWidgetPositionsSchema: z.ZodObject<{
    positions: z.ZodArray<z.ZodObject<{
        widget_id: z.ZodString;
        position: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        position: Record<string, unknown>;
        widget_id: string;
    }, {
        position: Record<string, unknown>;
        widget_id: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    positions: {
        position: Record<string, unknown>;
        widget_id: string;
    }[];
}, {
    positions: {
        position: Record<string, unknown>;
        widget_id: string;
    }[];
}>;
export declare const createEngagementTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodString>;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }, {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    questions: {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }[];
    description?: string | null | undefined;
    category?: string | undefined;
}, {
    name: string;
    questions: {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }[];
    description?: string | null | undefined;
    category?: string | undefined;
}>;
export declare const updateEngagementTemplateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    questions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }, {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }>, "many">>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | undefined;
    category?: string | undefined;
    questions?: {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }[] | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | undefined;
    category?: string | undefined;
    questions?: {
        text: string;
        options?: unknown[] | undefined;
        type?: string | undefined;
        id?: string | undefined;
        required?: boolean | undefined;
    }[] | undefined;
}>;
export declare const createSurveySchema: z.ZodObject<{
    template_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    questions: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    is_anonymous: z.ZodOptional<z.ZodBoolean>;
    audience_type: z.ZodOptional<z.ZodEnum<["all", "department", "org_unit", "custom"]>>;
    audience_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reminder_days: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description?: string | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    template_id?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    questions?: Record<string, unknown>[] | undefined;
    audience_type?: "all" | "department" | "custom" | "org_unit" | undefined;
    audience_ids?: string[] | undefined;
    reminder_days?: number[] | undefined;
}, {
    title: string;
    description?: string | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    template_id?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    questions?: Record<string, unknown>[] | undefined;
    audience_type?: "all" | "department" | "custom" | "org_unit" | undefined;
    audience_ids?: string[] | undefined;
    reminder_days?: number[] | undefined;
}>;
export declare const updateSurveySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    questions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    is_anonymous: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    audience_type: z.ZodOptional<z.ZodOptional<z.ZodEnum<["all", "department", "org_unit", "custom"]>>>;
    audience_ids: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    start_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    end_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    title?: string | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    questions?: Record<string, unknown>[] | undefined;
    audience_type?: "all" | "department" | "custom" | "org_unit" | undefined;
    audience_ids?: string[] | undefined;
}, {
    description?: string | null | undefined;
    title?: string | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    questions?: Record<string, unknown>[] | undefined;
    audience_type?: "all" | "department" | "custom" | "org_unit" | undefined;
    audience_ids?: string[] | undefined;
}>;
export declare const submitSurveyResponseSchema: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
        question_id: z.ZodString;
        value: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        question_id: string;
        value?: unknown;
    }, {
        question_id: string;
        value?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    answers: {
        question_id: string;
        value?: unknown;
    }[];
}, {
    answers: {
        question_id: string;
        value?: unknown;
    }[];
}>;
export declare const submitFeedbackSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    category?: string | undefined;
}, {
    message: string;
    category?: string | undefined;
}>;
export declare const reviewFeedbackSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["new", "reviewed", "in_progress", "resolved", "dismissed"]>>>;
    action_notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    status?: "in_progress" | "resolved" | "dismissed" | "new" | "reviewed" | undefined;
    action_notes?: string | null | undefined;
}, {
    status?: "in_progress" | "resolved" | "dismissed" | "new" | "reviewed" | undefined;
    action_notes?: string | null | undefined;
}>;
export declare const createPulseConfigSchema: z.ZodObject<{
    name: z.ZodString;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        type?: string | undefined;
        id?: string | undefined;
    }, {
        text: string;
        type?: string | undefined;
        id?: string | undefined;
    }>, "many">;
    frequency: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly"]>>;
    audience_type: z.ZodOptional<z.ZodEnum<["all", "department", "org_unit", "custom"]>>;
    audience_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    questions: {
        text: string;
        type?: string | undefined;
        id?: string | undefined;
    }[];
    audience_type?: "all" | "department" | "custom" | "org_unit" | undefined;
    audience_ids?: string[] | undefined;
    frequency?: "weekly" | "monthly" | "biweekly" | undefined;
}, {
    name: string;
    questions: {
        text: string;
        type?: string | undefined;
        id?: string | undefined;
    }[];
    audience_type?: "all" | "department" | "custom" | "org_unit" | undefined;
    audience_ids?: string[] | undefined;
    frequency?: "weekly" | "monthly" | "biweekly" | undefined;
}>;
export declare const createKnowledgeBaseSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    kbType: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodOptional<z.ZodBoolean>;
    allowedRoles: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    description?: string | null | undefined;
    kbType?: string | undefined;
    isPublic?: boolean | undefined;
    allowedRoles?: string[] | null | undefined;
}, {
    code: string;
    name: string;
    description?: string | null | undefined;
    kbType?: string | undefined;
    isPublic?: boolean | undefined;
    allowedRoles?: string[] | null | undefined;
}>;
export declare const ingestCCNLSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    sector: z.ZodString;
    fullText: z.ZodString;
    effectiveDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    version: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    sector: string;
    fullText: string;
    version?: string | null | undefined;
    effectiveDate?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    code: string;
    name: string;
    sector: string;
    fullText: string;
    version?: string | null | undefined;
    effectiveDate?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const ingestPolicySchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    policyType: z.ZodString;
    effectiveDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    version: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    orgUnitId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    policyType: string;
    version?: string | null | undefined;
    effectiveDate?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    orgUnitId?: string | null | undefined;
}, {
    title: string;
    content: string;
    policyType: string;
    version?: string | null | undefined;
    effectiveDate?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    orgUnitId?: string | null | undefined;
}>;
export declare const processPendingSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
}, {
    limit?: number | undefined;
}>;
export declare const initializeLeaveBalancesSchema: z.ZodObject<{
    employeeId: z.ZodString;
    year: z.ZodOptional<z.ZodNumber>;
    ccnlType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    year?: number | undefined;
    ccnlType?: string | undefined;
}, {
    employeeId: string;
    year?: number | undefined;
    ccnlType?: string | undefined;
}>;
export declare const createLeaveRequestSchema: z.ZodObject<{
    leaveType: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    daysRequested: z.ZodOptional<z.ZodNumber>;
    halfDayStart: z.ZodOptional<z.ZodBoolean>;
    halfDayEnd: z.ZodOptional<z.ZodBoolean>;
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    leaveType: string;
    startDate: string;
    endDate: string;
    daysRequested?: number | undefined;
    halfDayStart?: boolean | undefined;
    halfDayEnd?: boolean | undefined;
    reason?: string | null | undefined;
}, {
    leaveType: string;
    startDate: string;
    endDate: string;
    daysRequested?: number | undefined;
    halfDayStart?: boolean | undefined;
    halfDayEnd?: boolean | undefined;
    reason?: string | null | undefined;
}>;
export declare const approveLeaveSchema: z.ZodObject<{
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
}, {
    notes?: string | null | undefined;
}>;
export declare const rejectLeaveSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const cancelLeaveSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
//# sourceMappingURL=platform.d.ts.map