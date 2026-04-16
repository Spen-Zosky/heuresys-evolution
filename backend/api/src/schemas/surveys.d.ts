/**
 * Zod Schemas for Surveys Routes
 * Covers: survey CRUD, survey responses
 */
import { z } from 'zod';
export declare const createSurveySchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    survey_type: z.ZodOptional<z.ZodString>;
    start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_anonymous: z.ZodOptional<z.ZodBoolean>;
    questions: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description?: string | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    questions?: unknown;
    survey_type?: string | undefined;
}, {
    title: string;
    description?: string | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    questions?: unknown;
    survey_type?: string | undefined;
}>;
export declare const updateSurveySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    survey_type: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    start_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    end_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_anonymous: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["draft", "active", "closed"]>>>;
    questions: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodUnknown>>>;
    total_invitations: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    status?: "active" | "draft" | "closed" | undefined;
    title?: string | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    is_active?: boolean | undefined;
    is_anonymous?: boolean | undefined;
    questions?: unknown;
    survey_type?: string | undefined;
    total_invitations?: number | undefined;
}, {
    description?: string | null | undefined;
    status?: "active" | "draft" | "closed" | undefined;
    title?: string | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    is_active?: boolean | undefined;
    is_anonymous?: boolean | undefined;
    questions?: unknown;
    survey_type?: string | undefined;
    total_invitations?: number | undefined;
}>;
export declare const submitSurveyResponseSchema: z.ZodObject<{
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    responses: z.ZodArray<z.ZodObject<{
        question_id: z.ZodString;
        rating_value: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        text_value: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        choice_value: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        question_id: string;
        rating_value?: number | null | undefined;
        text_value?: string | null | undefined;
        choice_value?: string | null | undefined;
    }, {
        question_id: string;
        rating_value?: number | null | undefined;
        text_value?: string | null | undefined;
        choice_value?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    responses: {
        question_id: string;
        rating_value?: number | null | undefined;
        text_value?: string | null | undefined;
        choice_value?: string | null | undefined;
    }[];
    employee_id?: string | null | undefined;
}, {
    responses: {
        question_id: string;
        rating_value?: number | null | undefined;
        text_value?: string | null | undefined;
        choice_value?: string | null | undefined;
    }[];
    employee_id?: string | null | undefined;
}>;
//# sourceMappingURL=surveys.d.ts.map