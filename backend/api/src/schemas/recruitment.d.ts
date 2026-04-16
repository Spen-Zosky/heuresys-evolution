import { z } from 'zod';
export declare const createCandidateSchema: z.ZodObject<{
    requisition_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    first_name: z.ZodString;
    last_name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    current_company: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    job_title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    experience_years: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    source: z.ZodDefault<z.ZodOptional<z.ZodEnum<["direct", "referral", "linkedin", "job_board", "agency", "career_page", "other"]>>>;
    resume_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    linkedin_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    portfolio_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skills: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    source: "direct" | "other" | "referral" | "linkedin" | "job_board" | "agency" | "career_page";
    first_name: string;
    last_name: string;
    email: string;
    skills?: string[] | null | undefined;
    notes?: string | null | undefined;
    job_title?: string | null | undefined;
    phone?: string | null | undefined;
    requisition_id?: string | null | undefined;
    current_company?: string | null | undefined;
    experience_years?: number | null | undefined;
    resume_url?: string | null | undefined;
    linkedin_url?: string | null | undefined;
    portfolio_url?: string | null | undefined;
}, {
    first_name: string;
    last_name: string;
    email: string;
    source?: "direct" | "other" | "referral" | "linkedin" | "job_board" | "agency" | "career_page" | undefined;
    skills?: string[] | null | undefined;
    notes?: string | null | undefined;
    job_title?: string | null | undefined;
    phone?: string | null | undefined;
    requisition_id?: string | null | undefined;
    current_company?: string | null | undefined;
    experience_years?: number | null | undefined;
    resume_url?: string | null | undefined;
    linkedin_url?: string | null | undefined;
    portfolio_url?: string | null | undefined;
}>;
export declare const updateCandidateSchema: z.ZodObject<{
    first_name: z.ZodOptional<z.ZodString>;
    last_name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    current_company: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    job_title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    experience_years: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    stage: z.ZodOptional<z.ZodEnum<["new", "screening", "interview", "offer", "hired", "rejected"]>>;
    rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    source: z.ZodOptional<z.ZodEnum<["direct", "referral", "linkedin", "job_board", "agency", "career_page", "other"]>>;
    resume_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    linkedin_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    portfolio_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skills: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    source?: "direct" | "other" | "referral" | "linkedin" | "job_board" | "agency" | "career_page" | undefined;
    skills?: string[] | null | undefined;
    notes?: string | null | undefined;
    job_title?: string | null | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    email?: string | undefined;
    rating?: number | null | undefined;
    stage?: "rejected" | "screening" | "interview" | "offer" | "hired" | "new" | undefined;
    phone?: string | null | undefined;
    current_company?: string | null | undefined;
    experience_years?: number | null | undefined;
    resume_url?: string | null | undefined;
    linkedin_url?: string | null | undefined;
    portfolio_url?: string | null | undefined;
}, {
    source?: "direct" | "other" | "referral" | "linkedin" | "job_board" | "agency" | "career_page" | undefined;
    skills?: string[] | null | undefined;
    notes?: string | null | undefined;
    job_title?: string | null | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    email?: string | undefined;
    rating?: number | null | undefined;
    stage?: "rejected" | "screening" | "interview" | "offer" | "hired" | "new" | undefined;
    phone?: string | null | undefined;
    current_company?: string | null | undefined;
    experience_years?: number | null | undefined;
    resume_url?: string | null | undefined;
    linkedin_url?: string | null | undefined;
    portfolio_url?: string | null | undefined;
}>;
export declare const advanceCandidateSchema: z.ZodObject<{
    next_stage: z.ZodOptional<z.ZodEnum<["new", "screening", "interview", "offer", "hired"]>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    next_stage?: "screening" | "interview" | "offer" | "hired" | "new" | undefined;
}, {
    notes?: string | null | undefined;
    next_stage?: "screening" | "interview" | "offer" | "hired" | "new" | undefined;
}>;
export declare const rejectCandidateSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
export declare const createInterviewSchema: z.ZodObject<{
    candidate_id: z.ZodString;
    job_posting_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    interview_type: z.ZodOptional<z.ZodEnum<["phone", "video", "onsite", "panel", "technical", "behavioral", "culture_fit"]>>;
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduled_at: z.ZodString;
    duration_minutes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    timezone: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    location_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["video", "onsite", "phone"]>>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    meeting_link: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dial_in: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    created_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    timezone: string;
    location_type: "video" | "phone" | "onsite";
    duration_minutes: number;
    candidate_id: string;
    scheduled_at: string;
    description?: string | null | undefined;
    location?: string | null | undefined;
    title?: string | null | undefined;
    notes?: string | null | undefined;
    created_by?: string | null | undefined;
    meeting_link?: string | null | undefined;
    job_posting_id?: string | null | undefined;
    interview_type?: "video" | "technical" | "phone" | "onsite" | "panel" | "behavioral" | "culture_fit" | undefined;
    dial_in?: string | null | undefined;
}, {
    candidate_id: string;
    scheduled_at: string;
    description?: string | null | undefined;
    location?: string | null | undefined;
    title?: string | null | undefined;
    notes?: string | null | undefined;
    created_by?: string | null | undefined;
    timezone?: string | undefined;
    location_type?: "video" | "phone" | "onsite" | undefined;
    meeting_link?: string | null | undefined;
    duration_minutes?: number | undefined;
    job_posting_id?: string | null | undefined;
    interview_type?: "video" | "technical" | "phone" | "onsite" | "panel" | "behavioral" | "culture_fit" | undefined;
    dial_in?: string | null | undefined;
}>;
export declare const updateInterviewSchema: z.ZodObject<{
    interview_type: z.ZodOptional<z.ZodEnum<["phone", "video", "onsite", "panel", "technical", "behavioral", "culture_fit"]>>;
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduled_at: z.ZodOptional<z.ZodString>;
    duration_minutes: z.ZodOptional<z.ZodNumber>;
    timezone: z.ZodOptional<z.ZodString>;
    location_type: z.ZodOptional<z.ZodEnum<["video", "onsite", "phone"]>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    meeting_link: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dial_in: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "completed", "cancelled", "no_show"]>>;
    outcome: z.ZodNullable<z.ZodOptional<z.ZodEnum<["pass", "fail", "maybe", "strong_pass", "strong_fail"]>>>;
    feedback: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    status?: "completed" | "cancelled" | "scheduled" | "no_show" | undefined;
    location?: string | null | undefined;
    title?: string | null | undefined;
    notes?: string | null | undefined;
    rating?: number | null | undefined;
    feedback?: string | null | undefined;
    timezone?: string | undefined;
    location_type?: "video" | "phone" | "onsite" | undefined;
    meeting_link?: string | null | undefined;
    duration_minutes?: number | undefined;
    interview_type?: "video" | "technical" | "phone" | "onsite" | "panel" | "behavioral" | "culture_fit" | undefined;
    scheduled_at?: string | undefined;
    dial_in?: string | null | undefined;
    outcome?: "pass" | "fail" | "maybe" | "strong_pass" | "strong_fail" | null | undefined;
}, {
    description?: string | null | undefined;
    status?: "completed" | "cancelled" | "scheduled" | "no_show" | undefined;
    location?: string | null | undefined;
    title?: string | null | undefined;
    notes?: string | null | undefined;
    rating?: number | null | undefined;
    feedback?: string | null | undefined;
    timezone?: string | undefined;
    location_type?: "video" | "phone" | "onsite" | undefined;
    meeting_link?: string | null | undefined;
    duration_minutes?: number | undefined;
    interview_type?: "video" | "technical" | "phone" | "onsite" | "panel" | "behavioral" | "culture_fit" | undefined;
    scheduled_at?: string | undefined;
    dial_in?: string | null | undefined;
    outcome?: "pass" | "fail" | "maybe" | "strong_pass" | "strong_fail" | null | undefined;
}>;
export declare const completeInterviewSchema: z.ZodObject<{
    outcome: z.ZodNullable<z.ZodOptional<z.ZodEnum<["pass", "fail", "maybe", "strong_pass", "strong_fail"]>>>;
    feedback: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    rating?: number | null | undefined;
    feedback?: string | null | undefined;
    outcome?: "pass" | "fail" | "maybe" | "strong_pass" | "strong_fail" | null | undefined;
}, {
    rating?: number | null | undefined;
    feedback?: string | null | undefined;
    outcome?: "pass" | "fail" | "maybe" | "strong_pass" | "strong_fail" | null | undefined;
}>;
export declare const cancelInterviewSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
//# sourceMappingURL=recruitment.d.ts.map