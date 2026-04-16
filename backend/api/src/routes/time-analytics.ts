/**
 * Time & Attendance Analytics Routes
 * Epic 7 - Story S-ANLT-01-04: Time & Attendance Analytics (7 pts)
 *
 * Analytics dashboard for time tracking, attendance patterns, overtime trends
 */

import { Router, Request, Response } from 'express';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { timeAnalyticsPeriodQuerySchema } from '../schemas/time-policy.js';

import { asyncHandler } from '../errors/middleware.js';

const router = Router();

// Time analytics requires at least HR_MANAGER (or higher)
router.use(authMiddleware, requirePermission('TIME_ATTENDANCE', 'VIEW'));

// ============================================================================
// Overview
// ============================================================================

/**
 * GET /time-analytics
 * Overview of available time analytics endpoints
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        endpoints: [
          'GET /dashboard',
          'GET /attendance-patterns',
          'GET /overtime-trends',
          'GET /department-comparison',
          'GET /anomalies',
        ],
      },
    });
  })
);

// ============================================================================
// Dashboard Metrics
// ============================================================================

/**
 * GET /time-analytics/dashboard
 * Get comprehensive time & attendance dashboard metrics
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    // Get current month attendance summary
    const attendanceSummary = await dbClient.query(
      `
      SELECT
        COUNT(DISTINCT employee_id) as active_employees,
        COUNT(*) as total_records,
        ROUND(AVG(hours_total), 2) as avg_hours_per_day,
        SUM(hours_regular) as total_regular_hours,
        SUM(hours_overtime) as total_overtime_hours,
        SUM(hours_night) as total_night_hours,
        SUM(hours_holiday) as total_holiday_hours,
        COUNT(*) FILTER (WHERE status = 'present') as present_count,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE status = 'late') as late_count,
        COUNT(*) FILTER (WHERE status = 'remote') as remote_count
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= DATE_TRUNC('month', CURRENT_DATE)
    `,
      [tenantId]
    );

    // Get attendance rate by department (last 30 days)
    const byDepartment = await dbClient.query(
      `
      SELECT
        d.name as department,
        COUNT(DISTINCT ea.employee_id) as employees,
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE ea.status = 'present' OR ea.status = 'remote') as present_days,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ea.status = 'present' OR ea.status = 'remote') / NULLIF(COUNT(*), 0), 1) as attendance_rate,
        ROUND(AVG(ea.hours_total), 2) as avg_hours
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY d.id, d.name
      ORDER BY attendance_rate DESC
    `,
      [tenantId]
    );

    // Get weekly trends (last 8 weeks)
    const weeklyTrends = await dbClient.query(
      `
      SELECT
        DATE_TRUNC('week', attendance_date)::date as week_start,
        COUNT(DISTINCT employee_id) as employees,
        ROUND(AVG(hours_total), 2) as avg_hours,
        SUM(hours_overtime) as overtime_hours,
        COUNT(*) FILTER (WHERE status = 'late') as late_count
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', attendance_date)
      ORDER BY week_start
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        summary: attendanceSummary.rows[0],
        by_org_unit: byDepartment.rows,
        weekly_trends: weeklyTrends.rows,
        generated_at: new Date().toISOString(),
      },
    });
  })
);

// ============================================================================
// Attendance Patterns
// ============================================================================

/**
 * GET /time-analytics/attendance-patterns
 * Analyze attendance patterns (late arrivals, absences, etc.)
 */
router.get(
  '/attendance-patterns',
  validate(timeAnalyticsPeriodQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const days = (req.query as unknown as { period: number }).period;

    // Late arrival patterns by day of week
    const byDayOfWeek = await dbClient.query(
      `
      SELECT
        EXTRACT(DOW FROM attendance_date) as day_of_week,
        TO_CHAR(attendance_date, 'Day') as day_name,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'late') as late_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'late') / NULLIF(COUNT(*), 0), 1) as late_percentage
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - $2::interval
      GROUP BY EXTRACT(DOW FROM attendance_date), TO_CHAR(attendance_date, 'Day')
      ORDER BY day_of_week
    `,
      [tenantId, `${days} days`]
    );

    // Status distribution
    const statusDistribution = await dbClient.query(
      `
      SELECT
        status,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - $2::interval
      GROUP BY status
      ORDER BY count DESC
    `,
      [tenantId, `${days} days`]
    );

    // Employees with most late arrivals
    const frequentLate = await dbClient.query(
      `
      SELECT
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        COUNT(*) FILTER (WHERE ea.status = 'late') as late_count,
        COUNT(*) as total_days,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ea.status = 'late') / NULLIF(COUNT(*), 0), 1) as late_percentage
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - $2::interval
      GROUP BY e.id, e.first_name, e.last_name, d.name
      HAVING COUNT(*) FILTER (WHERE ea.status = 'late') > 0
      ORDER BY late_count DESC
      LIMIT 10
    `,
      [tenantId, `${days} days`]
    );

    res.json({
      success: true,
      data: {
        period_days: days,
        by_day_of_week: byDayOfWeek.rows,
        status_distribution: statusDistribution.rows,
        frequent_late: frequentLate.rows,
      },
    });
  })
);

// ============================================================================
// Overtime Analytics
// ============================================================================

/**
 * GET /time-analytics/overtime
 * Get overtime analytics and trends
 */
router.get(
  '/overtime',
  validate(timeAnalyticsPeriodQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const days = (req.query as unknown as { period: number }).period;

    // Overtime summary
    const summary = await dbClient.query(
      `
      SELECT
        SUM(hours_overtime) as total_overtime,
        ROUND(AVG(hours_overtime), 2) as avg_overtime_per_record,
        COUNT(DISTINCT employee_id) FILTER (WHERE hours_overtime > 0) as employees_with_overtime,
        COUNT(DISTINCT employee_id) as total_employees,
        SUM(hours_night) as total_night_hours,
        SUM(hours_holiday) as total_holiday_hours
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - $2::interval
    `,
      [tenantId, `${days} days`]
    );

    // Overtime by department
    const byDepartment = await dbClient.query(
      `
      SELECT
        d.name as department,
        SUM(ea.hours_overtime) as overtime_hours,
        SUM(ea.hours_night) as night_hours,
        SUM(ea.hours_holiday) as holiday_hours,
        COUNT(DISTINCT ea.employee_id) as employees
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - $2::interval
      GROUP BY d.id, d.name
      ORDER BY overtime_hours DESC
    `,
      [tenantId, `${days} days`]
    );

    // Monthly overtime trend
    const monthlyTrend = await dbClient.query(
      `
      SELECT
        DATE_TRUNC('month', attendance_date)::date as month,
        SUM(hours_overtime) as overtime_hours,
        SUM(hours_night) as night_hours,
        COUNT(DISTINCT employee_id) as employees
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', attendance_date)
      ORDER BY month
    `,
      [tenantId]
    );

    // Top overtime employees
    const topEmployees = await dbClient.query(
      `
      SELECT
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        SUM(ea.hours_overtime) as overtime_hours,
        SUM(ea.hours_night) as night_hours,
        SUM(ea.hours_holiday) as holiday_hours
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - $2::interval
      GROUP BY e.id, e.first_name, e.last_name, d.name
      HAVING SUM(ea.hours_overtime) > 0
      ORDER BY overtime_hours DESC
      LIMIT 15
    `,
      [tenantId, `${days} days`]
    );

    res.json({
      success: true,
      data: {
        period_days: days,
        summary: summary.rows[0],
        by_org_unit: byDepartment.rows,
        monthly_trend: monthlyTrend.rows,
        top_employees: topEmployees.rows,
      },
    });
  })
);

// ============================================================================
// Work Hours Distribution
// ============================================================================

/**
 * GET /time-analytics/hours-distribution
 * Analyze work hours distribution
 */
router.get(
  '/hours-distribution',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    // Hours distribution buckets
    const distribution = await dbClient.query(
      `
      SELECT
        CASE
          WHEN hours_total < 4 THEN 'Under 4h'
          WHEN hours_total < 6 THEN '4-6h'
          WHEN hours_total < 8 THEN '6-8h'
          WHEN hours_total < 9 THEN '8-9h (Standard)'
          WHEN hours_total < 10 THEN '9-10h'
          WHEN hours_total < 12 THEN '10-12h'
          ELSE '12h+'
        END as hours_bucket,
        COUNT(*) as count,
        ROUND(AVG(hours_total), 2) as avg_hours
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '30 days'
        AND hours_total > 0
      GROUP BY
        CASE
          WHEN hours_total < 4 THEN 'Under 4h'
          WHEN hours_total < 6 THEN '4-6h'
          WHEN hours_total < 8 THEN '6-8h'
          WHEN hours_total < 9 THEN '8-9h (Standard)'
          WHEN hours_total < 10 THEN '9-10h'
          WHEN hours_total < 12 THEN '10-12h'
          ELSE '12h+'
        END
      ORDER BY MIN(hours_total)
    `,
      [tenantId]
    );

    // Avg hours by department
    const byDepartment = await dbClient.query(
      `
      SELECT
        d.name as department,
        ROUND(AVG(ea.hours_total), 2) as avg_hours,
        ROUND(MIN(ea.hours_total), 2) as min_hours,
        ROUND(MAX(ea.hours_total), 2) as max_hours,
        COUNT(*) as records
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - INTERVAL '30 days'
        AND ea.hours_total > 0
      GROUP BY d.id, d.name
      ORDER BY avg_hours DESC
    `,
      [tenantId]
    );

    // Hours by source (manual, terminal, mobile, etc.)
    const bySource = await dbClient.query(
      `
      SELECT
        COALESCE(source, 'unknown') as source,
        COUNT(*) as records,
        ROUND(AVG(hours_total), 2) as avg_hours
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY source
      ORDER BY records DESC
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        distribution: distribution.rows,
        by_org_unit: byDepartment.rows,
        by_source: bySource.rows,
      },
    });
  })
);

// ============================================================================
// Remote Work Analytics
// ============================================================================

/**
 * GET /time-analytics/remote-work
 * Analyze remote work patterns
 */
router.get(
  '/remote-work',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    // Remote vs onsite ratio
    const ratio = await dbClient.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'remote') as remote_days,
        COUNT(*) FILTER (WHERE status = 'present') as onsite_days,
        COUNT(*) as total_days,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'remote') / NULLIF(COUNT(*), 0), 1) as remote_percentage
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '30 days'
    `,
      [tenantId]
    );

    // Remote by department
    const byDepartment = await dbClient.query(
      `
      SELECT
        d.name as department,
        COUNT(*) FILTER (WHERE ea.status = 'remote') as remote_days,
        COUNT(*) as total_days,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ea.status = 'remote') / NULLIF(COUNT(*), 0), 1) as remote_percentage
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY d.id, d.name
      ORDER BY remote_percentage DESC
    `,
      [tenantId]
    );

    // Remote trend by week
    const weeklyTrend = await dbClient.query(
      `
      SELECT
        DATE_TRUNC('week', attendance_date)::date as week_start,
        COUNT(*) FILTER (WHERE status = 'remote') as remote_days,
        COUNT(*) as total_days,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'remote') / NULLIF(COUNT(*), 0), 1) as remote_percentage
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', attendance_date)
      ORDER BY week_start
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        overall: ratio.rows[0],
        by_org_unit: byDepartment.rows,
        weekly_trend: weeklyTrend.rows,
      },
    });
  })
);

// ============================================================================
// Validation Analytics
// ============================================================================

/**
 * GET /time-analytics/validation-status
 * Get validation status for attendance records
 */
router.get(
  '/validation-status',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    // Validation summary for current month
    const summary = await dbClient.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE is_validated = true) as validated,
        COUNT(*) FILTER (WHERE is_validated = false) as pending,
        COUNT(*) as total,
        ROUND(100.0 * COUNT(*) FILTER (WHERE is_validated = true) / NULLIF(COUNT(*), 0), 1) as validated_percentage
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= DATE_TRUNC('month', CURRENT_DATE)
    `,
      [tenantId]
    );

    // Pending validation by department
    const pendingByDept = await dbClient.query(
      `
      SELECT
        d.name as department,
        COUNT(*) FILTER (WHERE ea.is_validated = false) as pending_count,
        MIN(ea.attendance_date) as oldest_pending
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.is_validated = false
      GROUP BY d.id, d.name
      HAVING COUNT(*) FILTER (WHERE ea.is_validated = false) > 0
      ORDER BY pending_count DESC
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        summary: summary.rows[0],
        pending_by_org_unit: pendingByDept.rows,
      },
    });
  })
);

// ============================================================================
// Absenteeism Analytics
// ============================================================================

/**
 * GET /time-analytics/absenteeism
 * Analyze absenteeism patterns
 */
router.get(
  '/absenteeism',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    // Absenteeism rate by month
    const monthlyRate = await dbClient.query(
      `
      SELECT
        DATE_TRUNC('month', attendance_date)::date as month,
        COUNT(DISTINCT employee_id) as total_employees,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'absent') / NULLIF(COUNT(*), 0), 2) as absence_rate
      FROM employee_attendance
      WHERE tenant_id = $1
        AND attendance_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', attendance_date)
      ORDER BY month
    `,
      [tenantId]
    );

    // Absenteeism by department
    const byDepartment = await dbClient.query(
      `
      SELECT
        d.name as department,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE ea.status = 'absent') as absent_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ea.status = 'absent') / NULLIF(COUNT(*), 0), 2) as absence_rate
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY d.id, d.name
      ORDER BY absence_rate DESC
    `,
      [tenantId]
    );

    // Employees with high absenteeism
    const highAbsentees = await dbClient.query(
      `
      SELECT
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        COUNT(*) FILTER (WHERE ea.status = 'absent') as absent_days,
        COUNT(*) as total_days,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ea.status = 'absent') / NULLIF(COUNT(*), 0), 1) as absence_rate
      FROM employee_attendance ea
      JOIN employees e ON ea.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE ea.tenant_id = $1
        AND ea.attendance_date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY e.id, e.first_name, e.last_name, d.name
      HAVING COUNT(*) FILTER (WHERE ea.status = 'absent') > 3
      ORDER BY absent_days DESC
      LIMIT 10
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        monthly_trend: monthlyRate.rows,
        by_org_unit: byDepartment.rows,
        high_absentees: highAbsentees.rows,
      },
    });
  })
);

export default router;
