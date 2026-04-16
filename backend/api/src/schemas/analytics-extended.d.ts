/**
 * Zod Schemas for Analytics Extended Routes
 * Covers: skill-analytics, training-recommendations, performance-skill-integration, performance-analytics
 */
import { z } from 'zod';
export declare const skillAnalyticsHeatmapQuerySchema: z.ZodObject<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    min_proficiency: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    min_proficiency: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    min_proficiency: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const skillAnalyticsTrendsQuerySchema: z.ZodObject<{
    skill_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period: z.ZodDefault<z.ZodEnum<["monthly", "quarterly", "yearly"]>>;
    lookback_periods: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    skill_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period: z.ZodDefault<z.ZodEnum<["monthly", "quarterly", "yearly"]>>;
    lookback_periods: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    skill_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    period: z.ZodDefault<z.ZodEnum<["monthly", "quarterly", "yearly"]>>;
    lookback_periods: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const skillAnalyticsShortagesQuerySchema: z.ZodObject<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    min_shortage: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    min_shortage: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    min_shortage: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const skillAnalyticsKsabaQuerySchema: z.ZodObject<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const skillAnalyticsEmergingQuerySchema: z.ZodObject<{
    lookback_days: z.ZodDefault<z.ZodNumber>;
    min_occurrences: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    lookback_days: z.ZodDefault<z.ZodNumber>;
    min_occurrences: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    lookback_days: z.ZodDefault<z.ZodNumber>;
    min_occurrences: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const skillAnalyticsDepartmentsQuerySchema: z.ZodObject<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_ids: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const orgUnitIdParamSchema: z.ZodObject<{
    orgUnitId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orgUnitId: string;
}, {
    orgUnitId: string;
}>;
export declare const employeeIdParamSchema: z.ZodObject<{
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
}, {
    employeeId: string;
}>;
export declare const courseIdParamSchema: z.ZodObject<{
    courseId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    courseId: string;
}, {
    courseId: string;
}>;
export declare const skillIdParamSchema: z.ZodObject<{
    skillId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    skillId: string;
}, {
    skillId: string;
}>;
export declare const pathIdParamSchema: z.ZodObject<{
    pathId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pathId: string;
}, {
    pathId: string;
}>;
export declare const trainingRecommendationsQuerySchema: z.ZodObject<{
    language: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    max_duration: z.ZodOptional<z.ZodNumber>;
    max_courses: z.ZodDefault<z.ZodNumber>;
    max_learning_paths: z.ZodDefault<z.ZodNumber>;
    delivery_methods: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    include_completed: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
    skills: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    language: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    max_duration: z.ZodOptional<z.ZodNumber>;
    max_courses: z.ZodDefault<z.ZodNumber>;
    max_learning_paths: z.ZodDefault<z.ZodNumber>;
    delivery_methods: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    include_completed: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
    skills: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    language: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    max_duration: z.ZodOptional<z.ZodNumber>;
    max_courses: z.ZodDefault<z.ZodNumber>;
    max_learning_paths: z.ZodDefault<z.ZodNumber>;
    delivery_methods: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    include_completed: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
    skills: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const courseSearchQuerySchema: z.ZodObject<{
    skill: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    skill: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    skill: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const learningPathsQuerySchema: z.ZodObject<{
    target_role: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_level: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    target_role: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_level: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    target_role: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_level: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const gapBasedQuerySchema: z.ZodObject<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const reviewIdParamSchema: z.ZodObject<{
    reviewId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reviewId: string;
}, {
    reviewId: string;
}>;
export declare const linkIdParamSchema: z.ZodObject<{
    linkId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    linkId: string;
}, {
    linkId: string;
}>;
export declare const performanceSkillLinksQuerySchema: z.ZodObject<{
    ratingLevel: z.ZodNullable<z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    ratingLevel: z.ZodNullable<z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    ratingLevel: z.ZodNullable<z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const mentorMatchesQuerySchema: z.ZodObject<{
    skillId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    skillId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    skillId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceDistributionQuerySchema: z.ZodObject<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    year: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    year: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    year: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceTrendsQuerySchema: z.ZodObject<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    years: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    years: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    years: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceDeptComparisonQuerySchema: z.ZodObject<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceManagerConsistencyQuerySchema: z.ZodObject<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceExecSummaryQuerySchema: z.ZodObject<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceHeatmapQuerySchema: z.ZodObject<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const performanceCompletionRatesQuerySchema: z.ZodObject<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    group_by: z.ZodDefault<z.ZodEnum<["department", "manager"]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    group_by: z.ZodDefault<z.ZodEnum<["department", "manager"]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    review_cycle_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    group_by: z.ZodDefault<z.ZodEnum<["department", "manager"]>>;
}, z.ZodTypeAny, "passthrough">>;
//# sourceMappingURL=analytics-extended.d.ts.map