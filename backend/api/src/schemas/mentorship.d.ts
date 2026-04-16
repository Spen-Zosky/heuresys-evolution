/**
 * Zod Schemas for Mentorship Routes
 * Covers: mentorship programs, mentorships, and sessions
 */
import { z } from 'zod';
export declare const createMentorshipProgramSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    program_type: z.ZodOptional<z.ZodString>;
    duration_months: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    max_participants: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    focus_areas: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    eligibility_criteria: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    program_type?: string | undefined;
    duration_months?: number | null | undefined;
    max_participants?: number | null | undefined;
    focus_areas?: string[] | null | undefined;
    eligibility_criteria?: Record<string, unknown> | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    program_type?: string | undefined;
    duration_months?: number | null | undefined;
    max_participants?: number | null | undefined;
    focus_areas?: string[] | null | undefined;
    eligibility_criteria?: Record<string, unknown> | null | undefined;
}>;
export declare const updateMentorshipProgramSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    program_type: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    duration_months: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    max_participants: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    focus_areas: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    eligibility_criteria: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: string | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    program_type?: string | undefined;
    duration_months?: number | null | undefined;
    max_participants?: number | null | undefined;
    focus_areas?: string[] | null | undefined;
    eligibility_criteria?: Record<string, unknown> | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: string | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    program_type?: string | undefined;
    duration_months?: number | null | undefined;
    max_participants?: number | null | undefined;
    focus_areas?: string[] | null | undefined;
    eligibility_criteria?: Record<string, unknown> | null | undefined;
}>;
export declare const createMentorshipSchema: z.ZodObject<{
    program_id: z.ZodString;
    mentor_id: z.ZodString;
    mentee_id: z.ZodString;
    focus_areas: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    meeting_frequency: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    goals: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    program_id: string;
    mentor_id: string;
    mentee_id: string;
    goals?: string[] | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    focus_areas?: string[] | null | undefined;
    meeting_frequency?: string | null | undefined;
}, {
    program_id: string;
    mentor_id: string;
    mentee_id: string;
    goals?: string[] | null | undefined;
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    focus_areas?: string[] | null | undefined;
    meeting_frequency?: string | null | undefined;
}>;
export declare const updateMentorshipSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    focus_areas: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    meeting_frequency: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    goals: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    goals?: string[] | null | undefined;
    notes?: string | null | undefined;
    end_date?: string | null | undefined;
    focus_areas?: string[] | null | undefined;
    meeting_frequency?: string | null | undefined;
}, {
    status?: string | undefined;
    goals?: string[] | null | undefined;
    notes?: string | null | undefined;
    end_date?: string | null | undefined;
    focus_areas?: string[] | null | undefined;
    meeting_frequency?: string | null | undefined;
}>;
export declare const createMentorshipSessionSchema: z.ZodObject<{
    mentorship_id: z.ZodString;
    session_date: z.ZodString;
    duration_minutes: z.ZodOptional<z.ZodNumber>;
    topics: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    mentorship_id: string;
    session_date: string;
    notes?: string | null | undefined;
    duration_minutes?: number | undefined;
    topics?: string[] | null | undefined;
}, {
    mentorship_id: string;
    session_date: string;
    notes?: string | null | undefined;
    duration_minutes?: number | undefined;
    topics?: string[] | null | undefined;
}>;
export declare const updateMentorshipSessionSchema: z.ZodObject<{
    session_date: z.ZodOptional<z.ZodString>;
    duration_minutes: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    topics: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    notes?: string | null | undefined;
    rating?: number | null | undefined;
    duration_minutes?: number | undefined;
    session_date?: string | undefined;
    topics?: string[] | null | undefined;
}, {
    status?: string | undefined;
    notes?: string | null | undefined;
    rating?: number | null | undefined;
    duration_minutes?: number | undefined;
    session_date?: string | undefined;
    topics?: string[] | null | undefined;
}>;
//# sourceMappingURL=mentorship.d.ts.map