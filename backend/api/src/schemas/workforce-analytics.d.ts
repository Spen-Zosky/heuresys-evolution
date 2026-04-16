/**
 * Zod Schemas for Workforce Analytics Routes
 * Covers: overtime, compensation-analytics, nace, talent-skill-profiles
 */
import { z } from 'zod';
export declare const overtimeStatsQuerySchema: z.ZodObject<{
    year: z.ZodOptional<z.ZodNumber>;
    month: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    year: z.ZodOptional<z.ZodNumber>;
    month: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    year: z.ZodOptional<z.ZodNumber>;
    month: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const overtimeByTypeQuerySchema: z.ZodObject<{
    year: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    year: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    year: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const overtimeListQuerySchema: z.ZodObject<{
    employee_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    overtime_type: z.ZodOptional<z.ZodString>;
    date_from: z.ZodOptional<z.ZodString>;
    date_to: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    employee_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    overtime_type: z.ZodOptional<z.ZodString>;
    date_from: z.ZodOptional<z.ZodString>;
    date_to: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    employee_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    overtime_type: z.ZodOptional<z.ZodString>;
    date_from: z.ZodOptional<z.ZodString>;
    date_to: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const compaRatioQuerySchema: z.ZodObject<{
    org_unit_id: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_id: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_id: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const bonusDistributionQuerySchema: z.ZodObject<{
    year: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    year: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    year: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const naceDivisionsQuerySchema: z.ZodObject<{
    section: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    section: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    section: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const naceGroupsQuerySchema: z.ZodObject<{
    division: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    division: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    division: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const talentSkillProfilesListQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    org_unit_id: z.ZodOptional<z.ZodString>;
    min_score: z.ZodOptional<z.ZodNumber>;
    max_score: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    include_stats: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    org_unit_id: z.ZodOptional<z.ZodString>;
    min_score: z.ZodOptional<z.ZodNumber>;
    max_score: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    include_stats: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    org_unit_id: z.ZodOptional<z.ZodString>;
    min_score: z.ZodOptional<z.ZodNumber>;
    max_score: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    include_stats: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
//# sourceMappingURL=workforce-analytics.d.ts.map