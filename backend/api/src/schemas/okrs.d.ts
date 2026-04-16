/**
 * Zod Schemas for OKR Routes
 * Covers: OKRs, key results, check-ins, and progress updates
 */
import { z } from 'zod';
export declare const createOkrSchema: z.ZodObject<{
    objective: z.ZodString;
    okr_type: z.ZodOptional<z.ZodEnum<["individual", "team", "department", "company"]>>;
    department: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period_type: z.ZodOptional<z.ZodEnum<["quarterly", "annual", "monthly", "custom"]>>;
    period_start: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period_end: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "completed", "cancelled"]>>;
    overall_progress: z.ZodOptional<z.ZodNumber>;
    confidence_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    owner_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    created_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    objective: string;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    department?: string | null | undefined;
    owner_id?: string | null | undefined;
    created_by?: string | null | undefined;
    confidence_level?: number | null | undefined;
    overall_progress?: number | undefined;
    period_end?: string | null | undefined;
    okr_type?: "team" | "department" | "company" | "individual" | undefined;
    period_type?: "custom" | "monthly" | "annual" | "quarterly" | undefined;
    period_start?: string | null | undefined;
}, {
    objective: string;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    department?: string | null | undefined;
    owner_id?: string | null | undefined;
    created_by?: string | null | undefined;
    confidence_level?: number | null | undefined;
    overall_progress?: number | undefined;
    period_end?: string | null | undefined;
    okr_type?: "team" | "department" | "company" | "individual" | undefined;
    period_type?: "custom" | "monthly" | "annual" | "quarterly" | undefined;
    period_start?: string | null | undefined;
}>;
export declare const updateOkrSchema: z.ZodObject<{
    objective: z.ZodOptional<z.ZodString>;
    okr_type: z.ZodOptional<z.ZodEnum<["individual", "team", "department", "company"]>>;
    department: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period_type: z.ZodOptional<z.ZodEnum<["quarterly", "annual", "monthly", "custom"]>>;
    period_start: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period_end: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "completed", "cancelled"]>>;
    overall_progress: z.ZodOptional<z.ZodNumber>;
    confidence_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    owner_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    department?: string | null | undefined;
    owner_id?: string | null | undefined;
    objective?: string | undefined;
    confidence_level?: number | null | undefined;
    overall_progress?: number | undefined;
    period_end?: string | null | undefined;
    okr_type?: "team" | "department" | "company" | "individual" | undefined;
    period_type?: "custom" | "monthly" | "annual" | "quarterly" | undefined;
    period_start?: string | null | undefined;
}, {
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    department?: string | null | undefined;
    owner_id?: string | null | undefined;
    objective?: string | undefined;
    confidence_level?: number | null | undefined;
    overall_progress?: number | undefined;
    period_end?: string | null | undefined;
    okr_type?: "team" | "department" | "company" | "individual" | undefined;
    period_type?: "custom" | "monthly" | "annual" | "quarterly" | undefined;
    period_start?: string | null | undefined;
}>;
export declare const updateOkrProgressSchema: z.ZodObject<{
    overall_progress: z.ZodOptional<z.ZodNumber>;
    confidence_level: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    confidence_level?: number | undefined;
    overall_progress?: number | undefined;
}, {
    confidence_level?: number | undefined;
    overall_progress?: number | undefined;
}>;
export declare const createKeyResultSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metric_type: z.ZodOptional<z.ZodString>;
    unit: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    start_value: z.ZodOptional<z.ZodNumber>;
    target_value: z.ZodNumber;
    current_value: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNumber>;
    owner_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    due_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    target_value: number;
    description?: string | null | undefined;
    due_date?: string | null | undefined;
    weight?: number | undefined;
    owner_id?: string | null | undefined;
    unit?: string | null | undefined;
    start_value?: number | undefined;
    metric_type?: string | undefined;
    current_value?: number | undefined;
}, {
    title: string;
    target_value: number;
    description?: string | null | undefined;
    due_date?: string | null | undefined;
    weight?: number | undefined;
    owner_id?: string | null | undefined;
    unit?: string | null | undefined;
    start_value?: number | undefined;
    metric_type?: string | undefined;
    current_value?: number | undefined;
}>;
export declare const updateKeyResultSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metric_type: z.ZodOptional<z.ZodString>;
    unit: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    start_value: z.ZodOptional<z.ZodNumber>;
    target_value: z.ZodOptional<z.ZodNumber>;
    current_value: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNumber>;
    owner_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    due_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    status?: string | undefined;
    title?: string | undefined;
    due_date?: string | null | undefined;
    weight?: number | undefined;
    target_value?: number | undefined;
    owner_id?: string | null | undefined;
    unit?: string | null | undefined;
    start_value?: number | undefined;
    metric_type?: string | undefined;
    current_value?: number | undefined;
}, {
    description?: string | null | undefined;
    status?: string | undefined;
    title?: string | undefined;
    due_date?: string | null | undefined;
    weight?: number | undefined;
    target_value?: number | undefined;
    owner_id?: string | null | undefined;
    unit?: string | null | undefined;
    start_value?: number | undefined;
    metric_type?: string | undefined;
    current_value?: number | undefined;
}>;
export declare const updateKeyResultProgressSchema: z.ZodObject<{
    current_value: z.ZodNumber;
    confidence_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    current_value: number;
    notes?: string | null | undefined;
    confidence_level?: number | null | undefined;
}, {
    current_value: number;
    notes?: string | null | undefined;
    confidence_level?: number | null | undefined;
}>;
export declare const createOkrCheckinSchema: z.ZodObject<{
    progress_snapshot: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    confidence_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    blockers: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    achievements: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    next_steps: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    key_result_updates: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    created_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    created_by?: string | null | undefined;
    blockers?: string | null | undefined;
    next_steps?: string | null | undefined;
    confidence_level?: number | null | undefined;
    achievements?: string | null | undefined;
    progress_snapshot?: number | null | undefined;
    key_result_updates?: Record<string, unknown>[] | null | undefined;
}, {
    notes?: string | null | undefined;
    created_by?: string | null | undefined;
    blockers?: string | null | undefined;
    next_steps?: string | null | undefined;
    confidence_level?: number | null | undefined;
    achievements?: string | null | undefined;
    progress_snapshot?: number | null | undefined;
    key_result_updates?: Record<string, unknown>[] | null | undefined;
}>;
//# sourceMappingURL=okrs.d.ts.map