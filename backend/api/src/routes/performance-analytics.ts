/**
 * Performance Analytics Routes
 * Sprint 2025-05: S-PERF-01-09 Performance Analytics Dashboard
 *
 * Provides comprehensive analytics for performance management:
 * - Rating distributions
 * - Trend analysis (multi-year)
 * - Manager calibration consistency
 * - OrgUnit comparisons
 * - Executive summaries
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  performanceDistributionQuerySchema,
  performanceTrendsQuerySchema,
  performanceDeptComparisonQuerySchema,
  performanceManagerConsistencyQuerySchema,
  performanceExecSummaryQuerySchema,
  performanceHeatmapQuerySchema,
  performanceCompletionRatesQuerySchema,
} from '../schemas/analytics-extended.js';
import { asyncHandler } from '../errors/middleware.js';

const router = Router();

router.use(requireTenant);
// Performance analytics requires at least HR_MANAGER
router.use(authMiddleware, requirePermission('ANALYTICS', 'VIEW'));

// ============================================================================
// OVERVIEW
// ============================================================================

/**
 * GET /performance-analytics
 * Overview of available performance analytics endpoints
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        endpoints: [
          'GET /distribution',
          'GET /trends',
          'GET /department-comparison',
          'GET /manager-consistency',
          'GET /exec-summary',
          'GET /heatmap',
          'GET /completion-rates',
        ],
      },
    });
  })
);

// ============================================================================
// RATING DISTRIBUTION
// ============================================================================

/**
 * GET /performance-analytics/distribution
 * Get rating distribution across the organization
 */
router.get(
  '/distribution',
  validate(performanceDistributionQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id, org_unit_id, year } = req.query as Record<string, string>;

    let query = `
      SELECT
        ROUND(pr.overall_rating) as rating,
        COUNT(*) as count,
        COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100 as percentage
      FROM performance_reviews pr
      LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      WHERE pr.tenant_id = $1
        AND pr.overall_rating IS NOT NULL
        AND pr.status IN ('completed', 'acknowledged')
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (review_cycle_id) {
      query += ` AND pr.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    if (org_unit_id) {
      query += ` AND EXISTS (SELECT 1 FROM employees e WHERE e.id = pr.employee_id AND e.org_unit_id = $${paramIndex})`;
      params.push(org_unit_id);
      paramIndex++;
    }

    if (year) {
      query += ` AND EXTRACT(YEAR FROM pr.created_at) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    query += ` GROUP BY ROUND(pr.overall_rating) ORDER BY rating`;

    const result = await req.dbClient!.query(query, params);

    // Calculate summary stats
    const statsQuery = `
      SELECT
        COUNT(*) as total_reviews,
        ROUND(AVG(overall_rating), 2) as avg_rating,
        ROUND(STDDEV(overall_rating), 2) as stddev_rating,
        MIN(overall_rating) as min_rating,
        MAX(overall_rating) as max_rating,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_rating) as median_rating
      FROM performance_reviews
      WHERE tenant_id = $1
        AND overall_rating IS NOT NULL
        AND status IN ('completed', 'acknowledged')
    `;
    const stats = await req.dbClient!.query(statsQuery, [tenantId]);

    // Expected distribution (bell curve)
    const expected = [
      { rating: 1, expected_percentage: 5 },
      { rating: 2, expected_percentage: 15 },
      { rating: 3, expected_percentage: 40 },
      { rating: 4, expected_percentage: 30 },
      { rating: 5, expected_percentage: 10 },
    ];

    res.json({
      success: true,
      data: {
        distribution: result.rows,
        expected_distribution: expected,
        statistics: stats.rows[0],
      },
    });
  })
);

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * GET /performance-analytics/trends
 * Get performance trends over time (up to 3 years)
 */
router.get(
  '/trends',
  validate(performanceTrendsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { org_unit_id, employee_id, years = '3' } = req.query as Record<string, string>;
    const yearsNum = parseInt(years as string);

    let query = `
      SELECT
        EXTRACT(YEAR FROM rc.end_date) as year,
        rc.name as cycle_name,
        COUNT(*) as review_count,
        ROUND(AVG(pr.overall_rating), 2) as avg_rating,
        ROUND(STDDEV(pr.overall_rating), 2) as stddev_rating,
        COUNT(*) FILTER (WHERE pr.overall_rating >= 4) as high_performers,
        COUNT(*) FILTER (WHERE pr.overall_rating < 3) as low_performers,
        COUNT(*) FILTER (WHERE pr.calibrated_at IS NOT NULL) as calibrated_reviews
      FROM performance_reviews pr
      JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      WHERE pr.tenant_id = $1
        AND pr.overall_rating IS NOT NULL
        AND pr.status IN ('completed', 'acknowledged')
        AND rc.end_date >= NOW() - ($2 * INTERVAL '1 year')
    `;
    const params: unknown[] = [tenantId, yearsNum];
    let paramIndex = 3;

    if (org_unit_id) {
      query += ` AND EXISTS (SELECT 1 FROM employees e WHERE e.id = pr.employee_id AND e.org_unit_id = $${paramIndex})`;
      params.push(org_unit_id);
      paramIndex++;
    }

    if (employee_id) {
      query += ` AND pr.employee_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }

    query += ` GROUP BY EXTRACT(YEAR FROM rc.end_date), rc.name ORDER BY year DESC, rc.name`;

    const result = await req.dbClient!.query(query, params);

    // Calculate year-over-year change
    const trendData = result.rows.map((row, index) => {
      const prevRow = result.rows[index + 1];
      return {
        ...row,
        yoy_change: prevRow
          ? (parseFloat(row.avg_rating) - parseFloat(prevRow.avg_rating)).toFixed(2)
          : null,
      };
    });

    res.json({
      success: true,
      data: {
        trends: trendData,
        period: `${years} years`,
      },
    });
  })
);

// ============================================================================
// DEPARTMENT COMPARISON
// ============================================================================

/**
 * GET /performance-analytics/department-comparison
 * Compare performance across departments
 */
router.get(
  '/department-comparison',
  validate(performanceDeptComparisonQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id } = req.query as Record<string, string>;

    let query = `
      SELECT
        d.id as org_unit_id,
        d.name as department_name,
        COUNT(DISTINCT pr.id) as review_count,
        COUNT(DISTINCT pr.employee_id) as employee_count,
        ROUND(AVG(pr.overall_rating), 2) as avg_rating,
        ROUND(STDDEV(pr.overall_rating), 2) as stddev_rating,
        MIN(pr.overall_rating) as min_rating,
        MAX(pr.overall_rating) as max_rating,
        COUNT(*) FILTER (WHERE pr.overall_rating >= 4)::NUMERIC / NULLIF(COUNT(*), 0) * 100 as high_performer_pct,
        COUNT(*) FILTER (WHERE pr.overall_rating < 3)::NUMERIC / NULLIF(COUNT(*), 0) * 100 as low_performer_pct,
        COUNT(*) FILTER (WHERE pr.calibrated_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0) * 100 as calibration_rate
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE pr.tenant_id = $1
        AND pr.overall_rating IS NOT NULL
        AND pr.status IN ('completed', 'acknowledged')
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (review_cycle_id) {
      query += ` AND pr.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    query += ` GROUP BY d.id, d.name ORDER BY avg_rating DESC`;

    const result = await req.dbClient!.query(query, params);

    // Calculate org-wide average for comparison
    const orgAvg = await req.dbClient!.query(
      `
      SELECT ROUND(AVG(overall_rating), 2) as org_avg
      FROM performance_reviews
      WHERE tenant_id = $1
        AND overall_rating IS NOT NULL
        AND status IN ('completed', 'acknowledged')
    `,
      [tenantId]
    );

    // Add deviation from org avg
    const comparisonData = result.rows.map((row) => ({
      ...row,
      deviation_from_org: (
        parseFloat(row.avg_rating) - parseFloat(orgAvg.rows[0]?.org_avg)
      ).toFixed(2),
    }));

    res.json({
      success: true,
      data: {
        departments: comparisonData,
        org_average: parseFloat(orgAvg.rows[0]?.org_avg),
      },
    });
  })
);

// ============================================================================
// MANAGER CALIBRATION CONSISTENCY
// ============================================================================

/**
 * GET /performance-analytics/manager-consistency
 * Analyze manager rating consistency (calibration metrics)
 */
router.get(
  '/manager-consistency',
  validate(performanceManagerConsistencyQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id } = req.query as Record<string, string>;

    let query = `
      SELECT
        m.id as manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        d.name as department_name,
        COUNT(DISTINCT pr.id) as review_count,
        ROUND(AVG(pr.overall_rating), 2) as avg_rating,
        ROUND(STDDEV(pr.overall_rating), 2) as rating_spread,
        COUNT(*) FILTER (WHERE pr.overall_rating >= 4)::NUMERIC / NULLIF(COUNT(*), 0) * 100 as high_rating_pct,
        COUNT(*) FILTER (WHERE ca.adjusted_rating IS NOT NULL AND ca.adjusted_rating != ca.original_rating) as adjustments_needed,
        ROUND(AVG(ABS(COALESCE(ca.adjusted_rating, pr.overall_rating) - pr.overall_rating)), 2) as avg_adjustment
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN employees m ON e.manager_id = m.id
      LEFT JOIN org_units d ON m.org_unit_id = d.id
      LEFT JOIN calibration_adjustments ca ON pr.id = ca.performance_review_id
      WHERE pr.tenant_id = $1
        AND pr.overall_rating IS NOT NULL
        AND pr.status IN ('completed', 'acknowledged')
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (review_cycle_id) {
      query += ` AND pr.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    query += ` GROUP BY m.id, m.first_name, m.last_name, d.name
               HAVING COUNT(DISTINCT pr.id) >= 3
               ORDER BY avg_adjustment DESC NULLS LAST, rating_spread DESC NULLS LAST`;

    const result = await req.dbClient!.query(query, params);

    // Calculate consistency score (inverse of adjustments and spread)
    const managerData = result.rows.map((row) => ({
      ...row,
      consistency_score: Math.max(
        0,
        100 - parseFloat(row.avg_adjustment || 0) * 20 - parseFloat(row.rating_spread || 0) * 10
      ).toFixed(1),
    }));

    res.json({
      success: true,
      data: managerData,
    });
  })
);

// ============================================================================
// EXECUTIVE SUMMARY
// ============================================================================

/**
 * GET /performance-analytics/executive-summary
 * Get executive summary for a review cycle
 */
router.get(
  '/executive-summary',
  validate(performanceExecSummaryQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id } = req.query as Record<string, string>;

    // Overall metrics
    let overallQuery = `
      SELECT
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE status = 'completed' OR status = 'acknowledged') as completed_reviews,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        ROUND(AVG(overall_rating), 2) as avg_rating,
        COUNT(*) FILTER (WHERE overall_rating >= 4) as high_performers,
        COUNT(*) FILTER (WHERE overall_rating >= 3 AND overall_rating < 4) as solid_performers,
        COUNT(*) FILTER (WHERE overall_rating < 3) as needs_improvement,
        COUNT(*) FILTER (WHERE calibrated_at IS NOT NULL) as calibrated_count,
        ROUND(AVG(CASE WHEN goal_achievement_rating IS NOT NULL THEN goal_achievement_rating ELSE 0 END), 1) as avg_goal_achievement_rating
      FROM performance_reviews
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (review_cycle_id) {
      overallQuery += ` AND review_cycle_id = $2`;
      params.push(review_cycle_id);
    }

    // Run all independent queries in parallel
    const [overall, topPerformers, concerns, goalTrends, calibrationImpact] = await Promise.all([
      req.dbClient!.query(overallQuery, params),
      req.dbClient!.query(
        `
        SELECT
          d.name as department,
          e.first_name || ' ' || e.last_name as employee_name,
          pr.overall_rating,
          pr.goal_achievement_rating
        FROM performance_reviews pr
        JOIN employees e ON pr.employee_id = e.id
        LEFT JOIN org_units d ON e.org_unit_id = d.id
        WHERE pr.tenant_id = $1
          AND pr.overall_rating >= 4.5
          AND pr.status IN ('completed', 'acknowledged')
        ORDER BY pr.overall_rating DESC, pr.goal_achievement_rating DESC NULLS LAST
        LIMIT 10
      `,
        [tenantId]
      ),
      req.dbClient!.query(
        `
        SELECT
          d.name as department,
          COUNT(*) as low_performer_count,
          ROUND(AVG(pr.overall_rating), 2) as avg_rating
        FROM performance_reviews pr
        JOIN employees e ON pr.employee_id = e.id
        LEFT JOIN org_units d ON e.org_unit_id = d.id
        WHERE pr.tenant_id = $1
          AND pr.overall_rating < 3
          AND pr.status IN ('completed', 'acknowledged')
        GROUP BY d.name
        HAVING COUNT(*) >= 2
        ORDER BY low_performer_count DESC
        LIMIT 5
      `,
        [tenantId]
      ),
      req.dbClient!.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE goal_achievement_rating >= 100) as goals_exceeded,
          COUNT(*) FILTER (WHERE goal_achievement_rating >= 80 AND goal_achievement_rating < 100) as goals_met,
          COUNT(*) FILTER (WHERE goal_achievement_rating >= 50 AND goal_achievement_rating < 80) as goals_partial,
          COUNT(*) FILTER (WHERE goal_achievement_rating < 50) as goals_missed
        FROM performance_reviews
        WHERE tenant_id = $1
          AND goal_achievement_rating IS NOT NULL
          AND status IN ('completed', 'acknowledged')
      `,
        [tenantId]
      ),
      req.dbClient!.query(
        `
        SELECT
          COUNT(*) as total_adjustments,
          COUNT(*) FILTER (WHERE adjusted_rating > original_rating) as upgrades,
          COUNT(*) FILTER (WHERE adjusted_rating < original_rating) as downgrades,
          ROUND(AVG(ABS(adjusted_rating - original_rating)), 2) as avg_change
        FROM calibration_adjustments
        WHERE tenant_id = $1
          AND original_rating IS NOT NULL
          AND adjusted_rating IS NOT NULL
      `,
        [tenantId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        overall: overall.rows[0],
        top_performers: topPerformers.rows,
        areas_of_concern: concerns.rows,
        goal_achievement: goalTrends.rows[0],
        calibration_impact: calibrationImpact.rows[0],
        generated_at: new Date().toISOString(),
      },
    });
  })
);

// ============================================================================
// HEATMAP DATA
// ============================================================================

/**
 * GET /performance-analytics/heatmap
 * Get heatmap data for department x rating visualization
 */
router.get(
  '/heatmap',
  validate(performanceHeatmapQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id } = req.query as Record<string, string>;

    let query = `
      SELECT
        d.name as department,
        ROUND(pr.overall_rating) as rating,
        COUNT(*) as count
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE pr.tenant_id = $1
        AND pr.overall_rating IS NOT NULL
        AND pr.status IN ('completed', 'acknowledged')
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (review_cycle_id) {
      query += ` AND pr.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    query += ` GROUP BY d.name, ROUND(pr.overall_rating)
               ORDER BY d.name, rating`;

    const result = await req.dbClient!.query(query, params);

    // Transform to heatmap format
    const departments = [...new Set(result.rows.map((r) => r.department))];
    const ratings = [1, 2, 3, 4, 5];

    const heatmapData = departments.map((dept) => {
      const row: Record<string, unknown> = { department: dept };
      ratings.forEach((rating) => {
        const found = result.rows.find((r) => r.department === dept && r.rating === rating);
        row[`rating_${rating}`] = found ? parseInt(found.count) : 0;
      });
      return row;
    });

    res.json({
      success: true,
      data: {
        heatmap: heatmapData,
        departments,
        ratings,
      },
    });
  })
);

// ============================================================================
// COMPLETION RATES
// ============================================================================

/**
 * GET /performance-analytics/completion-rates
 * Get review completion rates by department/manager
 */
router.get(
  '/completion-rates',
  validate(performanceCompletionRatesQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id, group_by = 'department' } = req.query as Record<string, string>;

    let groupColumn, groupName;
    if (group_by === 'manager') {
      groupColumn = 'm.id';
      groupName = "m.first_name || ' ' || m.last_name";
    } else {
      groupColumn = 'd.id';
      groupName = 'd.name';
    }

    let query = `
      SELECT
        ${groupColumn} as group_id,
        ${groupName} as group_name,
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE pr.status IN ('completed', 'acknowledged')) as completed,
        COUNT(*) FILTER (WHERE pr.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE pr.status = 'pending') as pending,
        ROUND(
          COUNT(*) FILTER (WHERE pr.status IN ('completed', 'acknowledged'))::NUMERIC /
          NULLIF(COUNT(*), 0) * 100,
          1
        ) as completion_rate
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE pr.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (review_cycle_id) {
      query += ` AND pr.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    query += ` GROUP BY ${groupColumn}, ${groupName}
               ORDER BY completion_rate DESC`;

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      grouped_by: group_by,
    });
  })
);

export default router;
