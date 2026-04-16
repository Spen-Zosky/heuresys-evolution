/**
 * Dashboard Routes
 * Aggregated analytics and dashboard data
 *
 * Enhanced with time-range filtering and trend data
 * @updated 2024-12-30 - Added /trends endpoint for sparklines
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrAll } from '../middleware/tenantContext.js';
import { pool } from '../config/database.js';
import { cacheControl } from '../middleware/cacheHeaders.js';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
/**
 * Helper: get the right DB client for single-tenant or cross-tenant queries.
 * When tenantId is null (SUPERUSER "All Tenants"), uses pool directly (bypasses RLS).
 * The tenantId can be passed as $1 to queries — when null, use ($1::uuid IS NULL OR tenant_id = $1).
 */
function getClient(req, tenantId) {
    return tenantId && req.dbClient ? req.dbClient : pool;
}
/** SQL fragment: replaces `tenant_id = $1` to also handle NULL (cross-tenant) */
const TF = '($1::uuid IS NULL OR tenant_id = $1)';
router.use(requireTenant);
// Dashboard data is tenant-specific with short cache
router.use(cacheControl('private-short'));
function getDateRange(range) {
    const now = new Date();
    const dateTo = new Date(now);
    let dateFrom = new Date(now);
    switch (range) {
        case 'today':
            dateFrom.setHours(0, 0, 0, 0);
            break;
        case '7d':
            dateFrom.setDate(now.getDate() - 7);
            break;
        case '30d':
            dateFrom.setDate(now.getDate() - 30);
            break;
        case '90d':
            dateFrom.setDate(now.getDate() - 90);
            break;
        case 'ytd':
            dateFrom = new Date(now.getFullYear(), 0, 1);
            break;
        case '12m':
            dateFrom.setFullYear(now.getFullYear() - 1);
            break;
        case 'all':
        default:
            dateFrom = new Date('2020-01-01');
    }
    return { dateFrom, dateTo };
}
/**
 * GET /dashboard/overview
 * Get overall dashboard metrics
 */
router.get('/overview', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    // Employee stats
    const employeeStats = await client.query(`SELECT
        COUNT(*)::int as total_employees,
        COUNT(*) FILTER (WHERE is_active = true)::int as active_employees,
        COUNT(DISTINCT org_unit_id)::int as departments
      FROM employees WHERE ${TF}`, [tenantId]);
    // Goals stats
    const goalsStats = await client.query(`SELECT
        COUNT(*)::int as total_goals,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed_goals,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress_goals,
        ROUND(AVG(progress_percent), 1) as avg_progress
      FROM goals WHERE ${TF}`, [tenantId]);
    // Reviews stats
    const reviewsStats = await client.query(`SELECT
        COUNT(*)::int as total_reviews,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed_reviews,
        ROUND(AVG(overall_rating), 2) as avg_rating
      FROM performance_reviews WHERE ${TF}`, [tenantId]);
    // Learning stats
    const learningStats = await client.query(`SELECT
        COUNT(*)::int as total_courses,
        (SELECT COUNT(*)::int FROM course_enrollments ce JOIN courses c ON ce.course_id = c.id WHERE ($1::uuid IS NULL OR c.tenant_id = $1)) as total_enrollments
      FROM courses WHERE ${TF}`, [tenantId]);
    // Recognition stats
    const recognitionStats = await client.query(`SELECT
        COUNT(*)::int as total_recognitions,
        COALESCE(SUM(points_awarded), 0)::int as total_points
      FROM recognition WHERE ${TF}`, [tenantId]);
    res.json({
        success: true,
        data: {
            employees: employeeStats.rows[0],
            goals: goalsStats.rows[0],
            reviews: reviewsStats.rows[0],
            learning: learningStats.rows[0],
            recognition: recognitionStats.rows[0],
        },
    });
}));
/**
 * GET /dashboard/hr-metrics
 * Get HR-specific metrics
 */
router.get('/hr-metrics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    // Headcount by department
    const headcountByDept = await client.query(`SELECT d.name as department, COUNT(e.id)::int as count
      FROM employees e
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE ($1::uuid IS NULL OR e.tenant_id = $1)
      GROUP BY d.name
      ORDER BY count DESC
      LIMIT 10`, [tenantId]);
    // Recruiting pipeline
    const recruitingPipeline = await client.query(`SELECT stage, COUNT(*)::int as count
      FROM recruiting_candidates
      WHERE ${TF}
      GROUP BY stage
      ORDER BY CASE stage
        WHEN 'new' THEN 1 WHEN 'screening' THEN 2 WHEN 'interview' THEN 3
        WHEN 'offer' THEN 4 WHEN 'hired' THEN 5 ELSE 6
      END`, [tenantId]);
    // Open requisitions
    const openRequisitions = await client.query(`SELECT COUNT(*)::int as count
      FROM recruiting_requisitions
      WHERE ${TF} AND status = 'open'`, [tenantId]);
    // Time off requests pending
    const pendingTimeOff = await client.query(`SELECT COUNT(*)::int as count
      FROM employee_time_off_requests etor
      JOIN employees e ON etor.employee_id = e.id
      WHERE ($1::uuid IS NULL OR e.tenant_id = $1) AND etor.status = 'pending'`, [tenantId]);
    res.json({
        success: true,
        data: {
            headcount_by_org_unit: headcountByDept.rows,
            recruiting_pipeline: recruitingPipeline.rows,
            open_requisitions: parseInt(openRequisitions.rows[0]?.count),
            pending_time_off: parseInt(pendingTimeOff.rows[0]?.count),
        },
    });
}));
/**
 * GET /dashboard/performance-metrics
 * Get performance-related metrics
 */
router.get('/performance-metrics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    // Goal completion rate
    const goalCompletion = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*)::int as total,
        ROUND(COUNT(*) FILTER (WHERE status = 'completed')::decimal / NULLIF(COUNT(*), 0) * 100, 1) as completion_rate
      FROM goals WHERE ($1::uuid IS NULL OR tenant_id = $1)
    `, [tenantId]);
    // Review completion by type (reviews aren't linked to cycles in this schema)
    const reviewByType = await client.query(`
      SELECT review_type,
        COUNT(*)::int as total_reviews,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed
      FROM performance_reviews
      WHERE ($1::uuid IS NULL OR tenant_id = $1)
      GROUP BY review_type
      ORDER BY total_reviews DESC
    `, [tenantId]);
    // Rating distribution
    const ratingDistribution = await client.query(`
      SELECT
        CASE
          WHEN overall_rating >= 4.5 THEN 'Exceptional'
          WHEN overall_rating >= 3.5 THEN 'Exceeds'
          WHEN overall_rating >= 2.5 THEN 'Meets'
          WHEN overall_rating >= 1.5 THEN 'Needs Improvement'
          ELSE 'Unsatisfactory'
        END as rating_category,
        COUNT(*)::int as count
      FROM performance_reviews
      WHERE ($1::uuid IS NULL OR tenant_id = $1) AND overall_rating IS NOT NULL
      GROUP BY rating_category
      ORDER BY count DESC
    `, [tenantId]);
    // Check-in activity
    const checkInActivity = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int as last_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int as last_30d,
        COUNT(*)::int as total
      FROM check_ins WHERE ($1::uuid IS NULL OR tenant_id = $1)
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            goal_completion: goalCompletion.rows[0],
            reviews_by_type: reviewByType.rows,
            rating_distribution: ratingDistribution.rows,
            check_in_activity: checkInActivity.rows[0],
        },
    });
}));
/**
 * GET /dashboard/learning-metrics
 * Get learning and development metrics
 */
router.get('/learning-metrics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    // Course enrollment stats
    const enrollmentStats = await client.query(`
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(*) FILTER (WHERE ce.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE ce.status = 'in_progress') as in_progress
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      WHERE ($1::uuid IS NULL OR c.tenant_id = $1)
    `, [tenantId]);
    // Top courses
    const topCourses = await client.query(`
      SELECT c.title, COUNT(ce.id) as enrollment_count
      FROM courses c
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE ($1::uuid IS NULL OR c.tenant_id = $1)
      GROUP BY c.id, c.title
      ORDER BY enrollment_count DESC
      LIMIT 5
    `, [tenantId]);
    // Learning paths progress
    const learningPathProgress = await client.query(`
      SELECT lp.title,
        COUNT(lpe.id) as total_enrolled,
        COUNT(lpe.id) FILTER (WHERE lpe.status = 'completed') as completed
      FROM learning_paths lp
      LEFT JOIN learning_path_enrollments lpe ON lp.id = lpe.learning_path_id
      WHERE ($1::uuid IS NULL OR lp.tenant_id = $1)
      GROUP BY lp.id, lp.title
      ORDER BY total_enrolled DESC
      LIMIT 5
    `, [tenantId]);
    // Certifications
    const certifications = await client.query(`
      SELECT
        COUNT(*) as total_certifications,
        COUNT(*) FILTER (WHERE ec.expiry_date > NOW() OR ec.expiry_date IS NULL) as valid,
        COUNT(*) FILTER (WHERE ec.expiry_date < NOW()) as expired
      FROM employee_certifications ec
      JOIN certifications c ON ec.certification_id = c.id
      WHERE ($1::uuid IS NULL OR c.tenant_id = $1)
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            enrollment_stats: enrollmentStats.rows[0],
            top_courses: topCourses.rows,
            learning_path_progress: learningPathProgress.rows,
            certifications: certifications.rows[0],
        },
    });
}));
/**
 * GET /dashboard/engagement-metrics
 * Get employee engagement metrics
 */
router.get('/engagement-metrics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    // Survey participation
    const surveyParticipation = await client.query(`
      SELECT
        s.title,
        s.total_invitations,
        COUNT(DISTINCT sr.employee_id) as responses,
        ROUND(COUNT(DISTINCT sr.employee_id)::decimal / NULLIF(s.total_invitations, 0) * 100, 1) as participation_rate
      FROM surveys s
      LEFT JOIN survey_responses sr ON s.id = sr.survey_id
      WHERE ($1::uuid IS NULL OR s.tenant_id = $1) AND s.status IN ('active', 'closed')
      GROUP BY s.id, s.title, s.total_invitations
      ORDER BY s.created_at DESC
      LIMIT 5
    `, [tenantId]);
    // Recognition activity
    const recognitionActivity = await client.query(`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as count
      FROM recognition
      WHERE ($1::uuid IS NULL OR tenant_id = $1) AND created_at > NOW() - INTERVAL '12 weeks'
      GROUP BY week
      ORDER BY week DESC
    `, [tenantId]);
    // Wellbeing trends
    const wellbeingTrends = await client.query(`
      SELECT
        ROUND(AVG(mood_score), 2) as avg_mood,
        ROUND(AVG(stress_level), 2) as avg_stress,
        ROUND(AVG(energy_level), 2) as avg_energy
      FROM wellbeing_checkins
      WHERE ($1::uuid IS NULL OR tenant_id = $1) AND checkin_date > CURRENT_DATE - 30
    `, [tenantId]);
    // Feedback frequency
    const feedbackFrequency = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
      FROM continuous_feedback WHERE ($1::uuid IS NULL OR tenant_id = $1)
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            survey_participation: surveyParticipation.rows,
            recognition_activity: recognitionActivity.rows,
            wellbeing_trends: wellbeingTrends.rows[0],
            feedback_frequency: feedbackFrequency.rows[0],
        },
    });
}));
/**
 * GET /dashboard/compensation-metrics
 * Get compensation-related metrics
 */
router.get('/compensation-metrics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    // Salary band coverage
    const salaryBandCoverage = await client.query(`
      SELECT
        COUNT(*) as total_bands,
        COUNT(DISTINCT job_level) as job_levels
      FROM salary_bands WHERE ($1::uuid IS NULL OR tenant_id = $1)
    `, [tenantId]);
    // Bonus plan status
    const bonusPlanStatus = await client.query(`
      SELECT
        COUNT(*) as total_plans,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM bonus_plans WHERE ($1::uuid IS NULL OR tenant_id = $1)
    `, [tenantId]);
    // Merit cycle progress
    const meritCycleProgress = await client.query(`
      SELECT
        name,
        status,
        total_budget,
        (SELECT COUNT(*) FROM merit_recommendations mr WHERE mr.cycle_id = mc.id) as recommendations
      FROM merit_cycles mc
      WHERE ($1::uuid IS NULL OR tenant_id = $1)
      ORDER BY created_at DESC
      LIMIT 3
    `, [tenantId]);
    // Benefits enrollment
    const benefitsEnrollment = await client.query(`
      SELECT
        COUNT(DISTINCT eb.id) as total_benefits,
        COUNT(ebe.id) as total_enrollments,
        COUNT(ebe.id) FILTER (WHERE ebe.is_active = true) as active_enrollments
      FROM employee_benefits eb
      LEFT JOIN employee_benefit_enrollments ebe ON eb.id = ebe.benefit_id
      WHERE ($1::uuid IS NULL OR eb.tenant_id = $1)
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            salary_band_coverage: salaryBandCoverage.rows[0],
            bonus_plan_status: bonusPlanStatus.rows[0],
            merit_cycle_progress: meritCycleProgress.rows,
            benefits_enrollment: benefitsEnrollment.rows[0],
        },
    });
}));
/**
 * GET /dashboard/trends
 * Get historical trend data for sparklines and charts
 * @query range - Time range: today, 7d, 30d, 90d, ytd, 12m, all (default: 30d)
 */
router.get('/trends', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    const range = req.query.range || '30d';
    const { dateFrom, dateTo } = getDateRange(range);
    // Headcount trend by month (last 12 data points)
    const headcountTrend = await client.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', $2::timestamp - interval '11 months'),
          date_trunc('month', $2::timestamp),
          interval '1 month'
        ) as month
      )
      SELECT
        m.month::date as date,
        COALESCE(COUNT(e.id) FILTER (WHERE e.is_active = true), 0)::int as value
      FROM months m
      LEFT JOIN employees e ON ($1::uuid IS NULL OR e.tenant_id = $1)
        AND e.hire_date <= m.month + interval '1 month'
        AND (e.termination_date IS NULL OR e.termination_date > m.month)
      GROUP BY m.month
      ORDER BY m.month
    `, [tenantId, dateTo]);
    // Turnover by month (simulated from terminations)
    const turnoverTrend = await client.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', $2::timestamp - interval '11 months'),
          date_trunc('month', $2::timestamp),
          interval '1 month'
        ) as month
      )
      SELECT
        m.month::date as date,
        COALESCE(COUNT(e.id), 0)::int as terminations,
        (
          SELECT COUNT(*) FROM employees e2
          WHERE ($1::uuid IS NULL OR e2.tenant_id = $1)
            AND e2.hire_date <= m.month
            AND (e2.termination_date IS NULL OR e2.termination_date > m.month)
        ) as total_at_month
      FROM months m
      LEFT JOIN employees e ON ($1::uuid IS NULL OR e.tenant_id = $1)
        AND date_trunc('month', e.termination_date) = m.month
      GROUP BY m.month
      ORDER BY m.month
    `, [tenantId, dateTo]);
    // Calculate turnover rate
    const turnoverRates = turnoverTrend.rows.map((row) => ({
        date: row.date,
        value: row.total_at_month > 0
            ? Number(((row.terminations / row.total_at_month) * 100 * 12).toFixed(1))
            : 0,
    }));
    // New hires by month
    const hiresTrend = await client.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', $2::timestamp - interval '11 months'),
          date_trunc('month', $2::timestamp),
          interval '1 month'
        ) as month
      )
      SELECT
        m.month::date as date,
        COALESCE(COUNT(e.id), 0)::int as value
      FROM months m
      LEFT JOIN employees e ON ($1::uuid IS NULL OR e.tenant_id = $1)
        AND date_trunc('month', e.hire_date) = m.month
      GROUP BY m.month
      ORDER BY m.month
    `, [tenantId, dateTo]);
    // Goals completion trend
    const goalsTrend = await client.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', $2::timestamp - interval '11 months'),
          date_trunc('month', $2::timestamp),
          interval '1 month'
        ) as month
      )
      SELECT
        m.month::date as date,
        COALESCE(COUNT(g.id) FILTER (WHERE g.status = 'completed'), 0)::int as completed,
        COALESCE(COUNT(g.id), 0)::int as total
      FROM months m
      LEFT JOIN goals g ON ($1::uuid IS NULL OR g.tenant_id = $1)
        AND date_trunc('month', g.created_at) <= m.month
      GROUP BY m.month
      ORDER BY m.month
    `, [tenantId, dateTo]);
    const goalsCompletionRate = goalsTrend.rows.map((row) => ({
        date: row.date,
        value: row.total > 0 ? Number(((row.completed / row.total) * 100).toFixed(1)) : 0,
    }));
    // Engagement/Wellbeing trend (average mood)
    const engagementTrend = await client.query(`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', $2::timestamp - interval '11 weeks'),
          date_trunc('week', $2::timestamp),
          interval '1 week'
        ) as week
      )
      SELECT
        w.week::date as date,
        COALESCE(ROUND(AVG(wc.mood_score), 1), 0) as value
      FROM weeks w
      LEFT JOIN wellbeing_checkins wc ON ($1::uuid IS NULL OR wc.tenant_id = $1)
        AND date_trunc('week', wc.checkin_date) = w.week
      GROUP BY w.week
      ORDER BY w.week
    `, [tenantId, dateTo]);
    // Recognition activity trend
    const recognitionTrend = await client.query(`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', $2::timestamp - interval '11 weeks'),
          date_trunc('week', $2::timestamp),
          interval '1 week'
        ) as week
      )
      SELECT
        w.week::date as date,
        COALESCE(COUNT(r.id), 0)::int as value
      FROM weeks w
      LEFT JOIN recognition r ON ($1::uuid IS NULL OR r.tenant_id = $1)
        AND date_trunc('week', r.created_at) = w.week
      GROUP BY w.week
      ORDER BY w.week
    `, [tenantId, dateTo]);
    // Current period summary with comparison
    const currentPeriodStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE e.is_active = true) as current_headcount,
        COUNT(*) FILTER (WHERE e.hire_date >= $2) as new_hires_period,
        COUNT(*) FILTER (WHERE e.termination_date >= $2) as terminations_period
      FROM employees e
      WHERE ($1::uuid IS NULL OR e.tenant_id = $1)
    `, [tenantId, dateFrom]);
    res.json({
        success: true,
        data: {
            range,
            date_from: dateFrom.toISOString(),
            date_to: dateTo.toISOString(),
            trends: {
                headcount: headcountTrend.rows.map((r) => ({ date: r.date, value: Number(r.value) })),
                turnover_rate: turnoverRates,
                new_hires: hiresTrend.rows.map((r) => ({ date: r.date, value: Number(r.value) })),
                goals_completion: goalsCompletionRate,
                engagement: engagementTrend.rows.map((r) => ({ date: r.date, value: Number(r.value) })),
                recognition: recognitionTrend.rows.map((r) => ({ date: r.date, value: Number(r.value) })),
            },
            summary: currentPeriodStats.rows[0],
        },
    });
}));
/**
 * GET /dashboard/turnover-by-department
 * Get turnover rates by department for visualization
 */
router.get('/turnover-by-department', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = getClient(req, tenantId);
    const range = req.query.range || '12m';
    const { dateFrom, dateTo } = getDateRange(range);
    // Get turnover by department
    const turnoverByDept = await client.query(`
      WITH dept_headcount AS (
        SELECT
          d.id as dept_id,
          d.name as department,
          COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) as current_headcount,
          COUNT(DISTINCT e.id) as total_employees
        FROM org_units d
        LEFT JOIN employees e ON e.org_unit_id = d.id AND ($1::uuid IS NULL OR e.tenant_id = $1)
        WHERE ($1::uuid IS NULL OR d.tenant_id = $1)
        GROUP BY d.id, d.name
      ),
      dept_terminations AS (
        SELECT
          e.org_unit_id,
          COUNT(*) as terminations
        FROM employees e
        WHERE ($1::uuid IS NULL OR e.tenant_id = $1)
          AND e.termination_date IS NOT NULL
          AND e.termination_date >= $2
          AND e.termination_date <= $3
        GROUP BY e.org_unit_id
      )
      SELECT
        dh.department,
        dh.current_headcount as headcount,
        COALESCE(dt.terminations, 0) as terminations,
        CASE
          WHEN dh.total_employees > 0
          THEN ROUND((COALESCE(dt.terminations, 0)::decimal / dh.total_employees * 100), 1)
          ELSE 0
        END as turnover_rate
      FROM dept_headcount dh
      LEFT JOIN dept_terminations dt ON dt.org_unit_id = dh.dept_id
      WHERE dh.current_headcount > 0
      ORDER BY turnover_rate DESC
    `, [tenantId, dateFrom, dateTo]);
    res.json({
        success: true,
        data: {
            range,
            date_from: dateFrom.toISOString(),
            date_to: dateTo.toISOString(),
            departments: turnoverByDept.rows,
        },
    });
}));
export default router;
//# sourceMappingURL=dashboard.js.map