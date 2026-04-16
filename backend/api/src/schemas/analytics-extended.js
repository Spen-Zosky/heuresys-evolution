/**
 * Zod Schemas for Analytics Extended Routes
 * Covers: skill-analytics, training-recommendations, performance-skill-integration, performance-analytics
 */
import { z } from 'zod';
// =============================================================================
// SKILL ANALYTICS
// =============================================================================
export const skillAnalyticsHeatmapQuerySchema = z
    .object({
    org_unit_ids: z.string().trim().optional().nullable(),
    skill_ids: z.string().trim().optional().nullable(),
    min_proficiency: z.coerce.number().min(0).max(10).optional(),
})
    .passthrough();
export const skillAnalyticsTrendsQuerySchema = z
    .object({
    skill_ids: z.string().trim().optional().nullable(),
    period: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
    lookback_periods: z.coerce.number().int().min(1).max(24).default(6),
})
    .passthrough();
export const skillAnalyticsShortagesQuerySchema = z
    .object({
    org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
    min_shortage: z.coerce.number().int().min(0).optional(),
})
    .passthrough();
export const skillAnalyticsKsabaQuerySchema = z
    .object({
    org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
    employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
})
    .passthrough();
export const skillAnalyticsEmergingQuerySchema = z
    .object({
    lookback_days: z.coerce.number().int().min(1).max(365).default(90),
    min_occurrences: z.coerce.number().int().min(1).max(100).default(3),
    limit: z.coerce.number().int().min(1).max(500).default(20),
})
    .passthrough();
export const skillAnalyticsDepartmentsQuerySchema = z
    .object({
    org_unit_ids: z.string().trim().optional().nullable(),
})
    .passthrough();
export const orgUnitIdParamSchema = z.object({
    orgUnitId: z.string().uuid('Invalid department ID'),
});
// =============================================================================
// TRAINING RECOMMENDATIONS
// =============================================================================
export const employeeIdParamSchema = z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
});
export const courseIdParamSchema = z.object({
    courseId: z.string().uuid('Invalid course ID'),
});
export const skillIdParamSchema = z.object({
    skillId: z.string().uuid('Invalid skill ID'),
});
export const pathIdParamSchema = z.object({
    pathId: z.string().uuid('Invalid path ID'),
});
export const trainingRecommendationsQuerySchema = z
    .object({
    language: z.string().trim().max(10).optional().nullable(),
    max_duration: z.coerce.number().int().min(1).max(10000).optional(),
    max_courses: z.coerce.number().int().min(1).max(100).default(10),
    max_learning_paths: z.coerce.number().int().min(1).max(50).default(3),
    delivery_methods: z.string().trim().optional().nullable(),
    include_completed: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    skills: z.string().trim().optional().nullable(),
})
    .passthrough();
export const courseSearchQuerySchema = z
    .object({
    skill: z.string().trim().min(1, 'Skill query parameter is required'),
    limit: z.coerce.number().int().min(1).max(500).default(10),
})
    .passthrough();
export const learningPathsQuerySchema = z
    .object({
    target_role: z.string().trim().max(200).optional().nullable(),
    skill_level: z.string().trim().max(50).optional().nullable(),
})
    .passthrough();
export const gapBasedQuerySchema = z
    .object({
    org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
    limit: z.coerce.number().int().min(1).max(500).default(20),
})
    .passthrough();
// =============================================================================
// PERFORMANCE-SKILL INTEGRATION
// =============================================================================
export const reviewIdParamSchema = z.object({
    reviewId: z.string().uuid('Invalid review ID'),
});
export const linkIdParamSchema = z.object({
    linkId: z.string().uuid('Invalid link ID'),
});
export const performanceSkillLinksQuerySchema = z
    .object({
    ratingLevel: z.enum(['low', 'medium', 'high']).optional().nullable(),
})
    .passthrough();
export const mentorMatchesQuerySchema = z
    .object({
    skillId: z.string().uuid('Invalid skill ID').optional().nullable(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
})
    .passthrough();
// =============================================================================
// PERFORMANCE ANALYTICS
// =============================================================================
export const performanceDistributionQuerySchema = z
    .object({
    review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
    org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
})
    .passthrough();
export const performanceTrendsQuerySchema = z
    .object({
    org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
    employee_id: z.string().uuid('Invalid employee ID').optional().nullable(),
    years: z.coerce.number().int().min(1).max(10).default(3),
})
    .passthrough();
export const performanceDeptComparisonQuerySchema = z
    .object({
    review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
})
    .passthrough();
export const performanceManagerConsistencyQuerySchema = z
    .object({
    review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
})
    .passthrough();
export const performanceExecSummaryQuerySchema = z
    .object({
    review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
})
    .passthrough();
export const performanceHeatmapQuerySchema = z
    .object({
    review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
})
    .passthrough();
export const performanceCompletionRatesQuerySchema = z
    .object({
    review_cycle_id: z.string().uuid('Invalid review cycle ID').optional().nullable(),
    group_by: z.enum(['department', 'manager']).default('department'),
})
    .passthrough();
//# sourceMappingURL=analytics-extended.js.map