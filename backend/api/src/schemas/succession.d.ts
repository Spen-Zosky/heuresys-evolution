/**
 * Zod Schemas for Succession Planning Routes
 * Covers: critical roles and succession candidates
 */
import { z } from 'zod';
export declare const createCriticalRoleSchema: z.ZodObject<{
    role_name: z.ZodString;
    department: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    current_incumbent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    criticality_level: z.ZodOptional<z.ZodString>;
    impact_if_vacant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    time_to_fill_estimate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    succession_status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role_name: string;
    department?: string | null | undefined;
    current_incumbent_id?: string | null | undefined;
    criticality_level?: string | undefined;
    impact_if_vacant?: string | null | undefined;
    time_to_fill_estimate?: string | null | undefined;
    succession_status?: string | undefined;
}, {
    role_name: string;
    department?: string | null | undefined;
    current_incumbent_id?: string | null | undefined;
    criticality_level?: string | undefined;
    impact_if_vacant?: string | null | undefined;
    time_to_fill_estimate?: string | null | undefined;
    succession_status?: string | undefined;
}>;
export declare const updateCriticalRoleSchema: z.ZodObject<{
    role_name: z.ZodOptional<z.ZodString>;
    department: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    current_incumbent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    criticality_level: z.ZodOptional<z.ZodString>;
    impact_if_vacant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    time_to_fill_estimate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    succession_status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    department?: string | null | undefined;
    role_name?: string | undefined;
    current_incumbent_id?: string | null | undefined;
    criticality_level?: string | undefined;
    impact_if_vacant?: string | null | undefined;
    time_to_fill_estimate?: string | null | undefined;
    succession_status?: string | undefined;
}, {
    department?: string | null | undefined;
    role_name?: string | undefined;
    current_incumbent_id?: string | null | undefined;
    criticality_level?: string | undefined;
    impact_if_vacant?: string | null | undefined;
    time_to_fill_estimate?: string | null | undefined;
    succession_status?: string | undefined;
}>;
export declare const createSuccessionCandidateSchema: z.ZodObject<{
    critical_role_id: z.ZodString;
    candidate_employee_id: z.ZodString;
    readiness_level: z.ZodOptional<z.ZodString>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    development_needs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    development_plan: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rank_order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    critical_role_id: string;
    candidate_employee_id: string;
    readiness_level?: string | undefined;
    strengths?: string | null | undefined;
    development_needs?: string | null | undefined;
    development_plan?: string | null | undefined;
    rank_order?: number | undefined;
}, {
    critical_role_id: string;
    candidate_employee_id: string;
    readiness_level?: string | undefined;
    strengths?: string | null | undefined;
    development_needs?: string | null | undefined;
    development_plan?: string | null | undefined;
    rank_order?: number | undefined;
}>;
export declare const updateSuccessionCandidateSchema: z.ZodObject<{
    readiness_level: z.ZodOptional<z.ZodString>;
    strengths: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    development_needs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    development_plan: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rank_order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    readiness_level?: string | undefined;
    strengths?: string | null | undefined;
    development_needs?: string | null | undefined;
    development_plan?: string | null | undefined;
    rank_order?: number | undefined;
}, {
    readiness_level?: string | undefined;
    strengths?: string | null | undefined;
    development_needs?: string | null | undefined;
    development_plan?: string | null | undefined;
    rank_order?: number | undefined;
}>;
//# sourceMappingURL=succession.d.ts.map