/**
 * Skill Analytics Routes
 * Sprint 2025-04 - S-ONTO-03-09
 *
 * Analytics API for workforce skill insights
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  skillAnalyticsHeatmapQuerySchema,
  skillAnalyticsTrendsQuerySchema,
  skillAnalyticsShortagesQuerySchema,
  skillAnalyticsKsabaQuerySchema,
  skillAnalyticsEmergingQuerySchema,
  skillAnalyticsDepartmentsQuerySchema,
  orgUnitIdParamSchema,
} from '../schemas/analytics-extended.js';
import { SkillAnalyticsService } from '../services/skill-analytics/index.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// NOTE: pool is retained here only for service singleton construction.
// SkillAnalyticsService uses pool internally for all its queries.
// A full migration of service internals is tracked separately.
const analyticsService = new SkillAnalyticsService(pool);

router.use(requireTenant);

/**
 * GET /skill-analytics/dashboard
 * Get comprehensive dashboard data combining summary, shortages, and department overview
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const [summary, shortages, departments] = await Promise.all([
      analyticsService.getSummaryStats(tenantId),
      analyticsService.getCriticalShortages(tenantId, {}),
      analyticsService.getDepartmentComparison(tenantId, {}),
    ]);

    res.json({
      success: true,
      data: {
        summary,
        critical_shortages: shortages.slice(0, 10),
        departments: departments.slice(0, 10),
        shortages_summary: {
          critical: shortages.filter((s) => s.severity === 'critical').length,
          high: shortages.filter((s) => s.severity === 'high').length,
          medium: shortages.filter((s) => s.severity === 'medium').length,
          low: shortages.filter((s) => s.severity === 'low').length,
        },
      },
    });
  })
);

/**
 * GET /skill-analytics/summary
 * Get summary statistics for skill analytics dashboard
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const summary = await analyticsService.getSummaryStats(tenantId);

    res.json({
      success: true,
      data: summary,
    });
  })
);

/**
 * GET /skill-analytics/heatmap
 * Get skill coverage heatmap data (departments vs skills)
 */
router.get(
  '/heatmap',
  validate(skillAnalyticsHeatmapQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitIds = req.query['org_unit_ids']
      ? (req.query['org_unit_ids'] as string).split(',')
      : undefined;
    const skillIds = req.query['skill_ids']
      ? (req.query['skill_ids'] as string).split(',')
      : undefined;
    const minProficiency = req.query['min_proficiency']
      ? parseFloat(req.query['min_proficiency'] as string)
      : undefined;

    const heatmap = await analyticsService.getSkillCoverageHeatmap(tenantId, {
      ...(orgUnitIds ? { org_unit_ids: orgUnitIds } : {}),
      ...(skillIds ? { skill_ids: skillIds } : {}),
      ...(minProficiency !== undefined ? { min_proficiency: minProficiency } : {}),
    });

    res.json({
      success: true,
      data: heatmap,
      count: heatmap.length,
    });
  })
);

/**
 * GET /skill-analytics/trends
 * Get skill trends over time
 */
router.get(
  '/trends',
  validate(skillAnalyticsTrendsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const skillIds = req.query['skill_ids']
      ? (req.query['skill_ids'] as string).split(',')
      : undefined;
    const period = (req.query['period'] as 'monthly' | 'quarterly' | 'yearly') || 'monthly';
    const lookbackPeriods = safeParseInt(req.query['lookback_periods'] as string, { fallback: 6 });

    const trends = await analyticsService.getSkillTrends(tenantId, {
      ...(skillIds ? { skill_ids: skillIds } : {}),
      period,
      lookback_periods: lookbackPeriods,
    });

    res.json({
      success: true,
      data: trends,
      count: trends.length,
    });
  })
);

/**
 * GET /skill-analytics/shortages
 * Get critical skill shortages
 */
router.get(
  '/shortages',
  validate(skillAnalyticsShortagesQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.query['org_unit_id'] as string | undefined;
    const minShortage = safeParseInt(req.query['min_shortage'] as string, { fallback: 0 });

    const shortages = await analyticsService.getCriticalShortages(tenantId, {
      ...(orgUnitId ? { org_unit_id: orgUnitId } : {}),
      ...(minShortage !== undefined ? { min_shortage: minShortage } : {}),
    });

    res.json({
      success: true,
      data: shortages,
      count: shortages.length,
      summary: {
        critical: shortages.filter((s) => s.severity === 'critical').length,
        high: shortages.filter((s) => s.severity === 'high').length,
        medium: shortages.filter((s) => s.severity === 'medium').length,
        low: shortages.filter((s) => s.severity === 'low').length,
      },
    });
  })
);

/**
 * GET /skill-analytics/ksaba
 * Get KSABA dimension distribution
 */
router.get(
  '/ksaba',
  validate(skillAnalyticsKsabaQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.query['org_unit_id'] as string | undefined;
    const employeeId = req.query['employee_id'] as string | undefined;

    const distribution = await analyticsService.getKSABADistribution(tenantId, {
      ...(orgUnitId ? { org_unit_id: orgUnitId } : {}),
      ...(employeeId ? { employee_id: employeeId } : {}),
    });

    res.json({
      success: true,
      data: distribution,
    });
  })
);

/**
 * GET /skill-analytics/emerging
 * Get emerging skills from AI extraction
 */
router.get(
  '/emerging',
  validate(skillAnalyticsEmergingQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const lookbackDays = safeParseInt(req.query['lookback_days'] as string, { fallback: 90 });
    const minOccurrences = safeParseInt(req.query['min_occurrences'] as string, { fallback: 3 });
    const limit = safeParseInt(req.query['limit'] as string, { fallback: 20 });

    const emerging = await analyticsService.getEmergingSkills(tenantId, {
      lookback_days: lookbackDays,
      min_occurrences: minOccurrences,
      limit,
    });

    res.json({
      success: true,
      data: emerging,
      count: emerging.length,
    });
  })
);

/**
 * GET /skill-analytics/org-units
 * Get department comparison metrics
 */
router.get(
  '/org-units',
  validate(skillAnalyticsDepartmentsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitIds = req.query['org_unit_ids']
      ? (req.query['org_unit_ids'] as string).split(',')
      : undefined;

    const comparison = await analyticsService.getDepartmentComparison(tenantId, {
      ...(orgUnitIds ? { org_unit_ids: orgUnitIds } : {}),
    });

    res.json({
      success: true,
      data: comparison,
      count: comparison.length,
    });
  })
);

/**
 * GET /skill-analytics/org-units/:orgUnitId
 * Get detailed analytics for a specific department
 */
router.get(
  '/org-units/:orgUnitId',
  validate(orgUnitIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const orgUnitId = req.params['orgUnitId'] as string;

    // Get multiple analytics for the department
    const [comparison, ksaba, heatmap, shortages] = await Promise.all([
      analyticsService.getDepartmentComparison(tenantId, { org_unit_ids: [orgUnitId] }),
      analyticsService.getKSABADistribution(tenantId, { org_unit_id: orgUnitId }),
      analyticsService.getSkillCoverageHeatmap(tenantId, { org_unit_ids: [orgUnitId] }),
      analyticsService.getCriticalShortages(tenantId, { org_unit_id: orgUnitId }),
    ]);

    if (comparison.length === 0) {
      throw Errors.notFound('OrgUnit', orgUnitId);
    }

    res.json({
      success: true,
      data: {
        overview: comparison[0],
        ksaba_distribution: ksaba,
        skill_coverage: heatmap,
        shortages: shortages,
      },
    });
  })
);

export default router;
