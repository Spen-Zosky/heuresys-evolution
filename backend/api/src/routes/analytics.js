/**
 * Analytics Routes
 * Epic 7 - Story 7.5: Real-time Analytics Pipeline
 *
 * API for analytics events, metrics, and dashboards
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { analyticsPipelineService } from '../services/analytics-pipeline.js';
import { generateHRDashboardPDF, generateCompensationPDF, generateWorkforcePlanningPDF, generatePerformancePDF, generateGenericPDF, } from '../services/pdf-generator.js';
import { validate } from '../middleware/validate.js';
import { trackEventSchema, trackEventBatchSchema, computeAggregationsSchema, analyticsExportSchema, } from '../schemas/platform.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
// ============================================================================
// Event Tracking
// ============================================================================
/**
 * POST /analytics/events
 * Track a single analytics event
 */
router.post('/events', validate(trackEventSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { event_type, category, entity_type, entity_id, user_id, session_id, data, metrics } = req.body;
    if (!event_type || !category) {
        throw Errors.badRequest('event_type and category are required');
    }
    const eventId = await analyticsPipelineService.trackEvent({
        tenant_id: tenantId,
        event_type,
        category,
        entity_type,
        entity_id,
        user_id,
        session_id,
        data,
        metrics,
    });
    res.status(201).json({
        success: true,
        data: { event_id: eventId },
        message: 'Event tracked successfully',
    });
}));
/**
 * POST /analytics/events/batch
 * Track multiple events in batch
 */
router.post('/events/batch', validate(trackEventBatchSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { events } = req.body;
    if (!events || !Array.isArray(events) || events.length === 0) {
        throw Errors.badRequest('events array is required');
    }
    // Add tenant_id to all events
    const tenantEvents = events.map((e) => ({
        ...e,
        tenant_id: tenantId,
    }));
    const eventIds = await analyticsPipelineService.trackEvents(tenantEvents);
    res.status(201).json({
        success: true,
        data: { event_ids: eventIds, count: eventIds.length },
        message: 'Events tracked successfully',
    });
}));
/**
 * GET /analytics/events
 * Get recent events
 */
router.get('/events', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, event_type, entity_type, limit = '100', } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 100, min: 1, max: 5000 });
    const events = await analyticsPipelineService.getRecentEvents(tenantId, {
        ...(category ? { category: category } : {}),
        event_type: event_type,
        entity_type: entity_type,
        limit: limitNum,
    });
    res.json({ success: true, data: events });
}));
// ============================================================================
// Metrics
// ============================================================================
/**
 * GET /analytics/metrics/timeseries
 * Get time series data for a metric
 */
router.get('/metrics/timeseries', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { metric_name, entity_type, period, start_date, end_date } = req.query;
    if (!metric_name || !period || !start_date || !end_date) {
        throw Errors.badRequest('metric_name, period, start_date, and end_date are required');
    }
    const timeSeries = await analyticsPipelineService.getTimeSeries(tenantId, {
        metric_name: metric_name,
        entity_type: entity_type,
        period: period,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
    });
    res.json({ success: true, data: timeSeries });
}));
/**
 * GET /analytics/metrics/current
 * Get current metric value with comparison
 */
router.get('/metrics/current', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { metric_name, entity_type, period } = req.query;
    if (!metric_name || !entity_type || !period) {
        throw Errors.badRequest('metric_name, entity_type, and period are required');
    }
    const metric = await analyticsPipelineService.getCurrentMetric(tenantId, metric_name, entity_type, period);
    res.json({ success: true, data: metric });
}));
/**
 * GET /analytics/events/counts
 * Get event counts by category
 */
router.get('/events/counts', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { start_date, end_date } = req.query;
    const startDate = start_date
        ? new Date(start_date)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const endDate = end_date ? new Date(end_date) : new Date();
    const counts = await analyticsPipelineService.getEventCountsByCategory(tenantId, startDate, endDate);
    res.json({ success: true, data: counts });
}));
// ============================================================================
// Dashboard Metrics
// ============================================================================
/**
 * GET /analytics/dashboard
 * Aggregated dashboard metrics (HR + Performance + Recruitment + Learning)
 * Used by Company PET and other dashboards for top-level KPIs
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const [hr, perf, recruit, learn] = await Promise.allSettled([
        analyticsPipelineService.getHRDashboardMetrics(tenantId),
        analyticsPipelineService.getPerformanceDashboardMetrics(tenantId),
        analyticsPipelineService.getRecruitmentDashboardMetrics(tenantId),
        analyticsPipelineService.getLearningDashboardMetrics(tenantId),
    ]);
    const hrData = hr.status === 'fulfilled' ? hr.value : {};
    const perfData = perf.status === 'fulfilled' ? perf.value : {};
    const recruitData = recruit.status === 'fulfilled' ? recruit.value : {};
    const learnData = learn.status === 'fulfilled' ? learn.value : {};
    // Aggregate into the shape Company PET pages expect
    const hrObj = hrData;
    const perfObj = perfData;
    const recruitObj = recruitData;
    const learnObj = learnData;
    res.json({
        success: true,
        data: {
            total_employees: hrObj.total_employees || hrObj.headcount || 0,
            total_org_units: hrObj.total_org_units || 0,
            total_cost_centers: hrObj.total_cost_centers || 0,
            total_locations: hrObj.total_locations || 0,
            avg_tenure: hrObj.avg_tenure || hrObj.avg_tenure_years || 0,
            turnover_rate: hrObj.turnover_rate || hrObj.turnover_rate_annual || 0,
            gender_distribution: hrObj.gender_distribution || null,
            age_distribution: hrObj.age_distribution || null,
            total_goals: perfObj.total_goals || perfObj.goals_total || 0,
            completed_goals: perfObj.completed_goals || perfObj.goals_completed || 0,
            performance_reviews: perfObj.total_reviews || perfObj.reviews_total || 0,
            avg_rating: perfObj.avg_rating || perfObj.average_rating || 0,
            check_ins: perfObj.check_ins || perfObj.total_check_ins || 0,
            open_positions: recruitObj.open_positions || recruitObj.total_open || 0,
            total_candidates: recruitObj.total_candidates || 0,
            total_courses: learnObj.total_courses || learnObj.courses_total || 0,
            active_enrollments: learnObj.active_enrollments || 0,
            // Raw sub-sections for pages that need detailed data
            hr: hrData,
            performance: perfData,
            recruitment: recruitData,
            learning: learnData,
        },
    });
}));
/**
 * GET /analytics/dashboard/hr
 * Get HR dashboard metrics
 */
router.get('/dashboard/hr', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const metrics = await analyticsPipelineService.getHRDashboardMetrics(tenantId);
    res.json({ success: true, data: metrics });
}));
/**
 * GET /analytics/dashboard/performance
 * Get performance dashboard metrics
 */
router.get('/dashboard/performance', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const metrics = await analyticsPipelineService.getPerformanceDashboardMetrics(tenantId);
    res.json({ success: true, data: metrics });
}));
/**
 * GET /analytics/dashboard/recruitment
 * Get recruitment dashboard metrics
 */
router.get('/dashboard/recruitment', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const metrics = await analyticsPipelineService.getRecruitmentDashboardMetrics(tenantId);
    res.json({ success: true, data: metrics });
}));
/**
 * GET /analytics/dashboard/learning
 * Get learning dashboard metrics
 */
router.get('/dashboard/learning', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const metrics = await analyticsPipelineService.getLearningDashboardMetrics(tenantId);
    res.json({ success: true, data: metrics });
}));
// ============================================================================
// Aggregation Management
// ============================================================================
/**
 * POST /analytics/aggregations/compute
 * Compute aggregations for a specific period
 */
router.post('/aggregations/compute', validate(computeAggregationsSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { period, date } = req.body;
    if (!period) {
        throw Errors.badRequest('period is required');
    }
    await analyticsPipelineService.computeAggregations(tenantId, period, date ? new Date(date) : new Date());
    res.json({
        success: true,
        message: `Aggregations computed for ${period} period`,
    });
}));
/**
 * GET /analytics/aggregations/stats
 * Get aggregation statistics
 */
router.get('/aggregations/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const stats = await analyticsPipelineService.getAggregationStats(tenantId);
    res.json({ success: true, data: stats });
}));
/**
 * GET /analytics/headcount-trend
 * Get headcount trend for the last 12 months with hires and attrition
 */
router.get('/headcount-trend', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const trend = await analyticsPipelineService.getHeadcountTrend(tenantId);
    res.json({ success: true, data: trend });
}));
/**
 * GET /analytics/skill-gap-summary
 * Get aggregated skill gap analysis from database
 */
router.get('/skill-gap-summary', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const summary = await analyticsPipelineService.getSkillGapSummary(tenantId);
    res.json({ success: true, data: summary });
}));
/**
 * GET /analytics/turnover-summary
 * Get monthly turnover summary with voluntary/involuntary breakdown
 * Returns last 12 months of turnover data
 */
router.get('/turnover-summary', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const summary = await analyticsPipelineService.getTurnoverSummary(tenantId);
    res.json({ success: true, data: summary });
}));
// ============================================================================
// Analytics Export (S-ANLT-01-07)
// ============================================================================
/**
 * POST /analytics/export
 * Generate analytics export in specified format
 */
router.post('/export', validate(analyticsExportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { dashboard, format = 'csv' } = req.body;
    const validDashboards = [
        'hr',
        'performance',
        'recruitment',
        'learning',
        'workforce-planning',
        'compensation',
        'time',
    ];
    const validFormats = ['csv', 'json', 'excel', 'pdf'];
    if (!dashboard || !validDashboards.includes(dashboard)) {
        throw Errors.badRequest(`Invalid dashboard. Valid options: ${validDashboards.join(', ')}`);
    }
    if (!validFormats.includes(format)) {
        throw Errors.badRequest(`Invalid format. Valid options: ${validFormats.join(', ')}`);
    }
    // Get dashboard data based on type
    let data;
    let filename;
    const timestamp = new Date().toISOString().split('T')[0];
    switch (dashboard) {
        case 'hr':
            data = await analyticsPipelineService.getHRDashboardMetrics(tenantId);
            filename = `hr_analytics_${timestamp}`;
            break;
        case 'performance':
            data = await analyticsPipelineService.getPerformanceDashboardMetrics(tenantId);
            filename = `performance_analytics_${timestamp}`;
            break;
        case 'recruitment':
            data = await analyticsPipelineService.getRecruitmentDashboardMetrics(tenantId);
            filename = `recruitment_analytics_${timestamp}`;
            break;
        case 'learning':
            data = await analyticsPipelineService.getLearningDashboardMetrics(tenantId);
            filename = `learning_analytics_${timestamp}`;
            break;
        case 'workforce-planning':
            data = await analyticsPipelineService.getTurnoverSummary(tenantId);
            filename = `workforce_planning_${timestamp}`;
            break;
        case 'compensation':
            // Use inline query for compensation
            const compResult = await req.dbClient.query(`
          SELECT
            d.name as department,
            COUNT(*) as employees,
            AVG(e.salary) as avg_salary,
            MIN(e.salary) as min_salary,
            MAX(e.salary) as max_salary
          FROM employees e
          JOIN org_units d ON e.org_unit_id = d.id
          WHERE e.tenant_id = $1 AND e.is_active = true AND e.salary > 0
          GROUP BY d.id, d.name
          ORDER BY avg_salary DESC
        `, [tenantId]);
            data = { by_org_unit: compResult.rows };
            filename = `compensation_analytics_${timestamp}`;
            break;
        case 'time':
            // Time analytics summary from employee_attendance
            const timeResult = await req.dbClient.query(`
          SELECT
            d.name as department,
            COUNT(DISTINCT ea.employee_id) as employees,
            COALESCE(SUM(ea.hours_total), 0) as total_hours,
            COALESCE(AVG(ea.hours_total), 0) as avg_hours,
            COALESCE(SUM(ea.hours_overtime), 0) as overtime_hours,
            COUNT(*) FILTER (WHERE ea.status = 'present') as present_days,
            COUNT(*) FILTER (WHERE ea.status = 'absent') as absent_days
          FROM employee_attendance ea
          JOIN employees e ON ea.employee_id = e.id
          JOIN org_units d ON e.org_unit_id = d.id
          WHERE ea.tenant_id = $1
          GROUP BY d.id, d.name
          ORDER BY total_hours DESC
        `, [tenantId]);
            data = { by_org_unit: timeResult.rows };
            filename = `time_analytics_${timestamp}`;
            break;
        default:
            data = {};
            filename = `analytics_${timestamp}`;
    }
    // Generate export content based on format
    let content;
    let mimeType;
    let fileExtension;
    if (format === 'pdf') {
        // Generate PDF report
        let pdfBuffer;
        switch (dashboard) {
            case 'hr':
                pdfBuffer = await generateHRDashboardPDF(data);
                break;
            case 'compensation':
                pdfBuffer = await generateCompensationPDF(data);
                break;
            case 'workforce-planning':
                pdfBuffer = await generateWorkforcePlanningPDF(data);
                break;
            case 'performance':
                pdfBuffer = await generatePerformancePDF(data);
                break;
            default:
                pdfBuffer = await generateGenericPDF(data, `${dashboard.charAt(0).toUpperCase() + dashboard.slice(1)} Analytics`);
        }
        content = pdfBuffer;
        mimeType = 'application/pdf';
        fileExtension = 'pdf';
    }
    else if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
    }
    else if (format === 'excel' || format === 'csv') {
        // Flatten data for CSV/Excel
        const flatData = flattenDataForExport(data);
        const headers = flatData.length > 0 ? Object.keys(flatData[0]) : [];
        const rows = flatData.map((row) => headers.map((h) => escapeCSVValue(row[h])).join(','));
        content = format === 'excel' ? '\ufeff' : ''; // BOM for Excel
        content += headers.join(',') + '\n' + rows.join('\n');
        mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv';
        fileExtension = 'csv';
    }
    else {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${fileExtension}"`);
    res.send(content); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
}));
/**
 * GET /analytics/export/templates
 * Get available export templates
 */
router.get('/export/templates', (_req, res) => {
    const templates = [
        {
            id: 'hr-dashboard',
            name: 'HR Dashboard Report',
            description: 'Complete HR metrics including headcount, turnover, and demographics',
            dashboard: 'hr',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
        {
            id: 'performance-report',
            name: 'Performance Analytics Report',
            description: 'Performance review scores, goal completion rates, and ratings distribution',
            dashboard: 'performance',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
        {
            id: 'recruitment-report',
            name: 'Recruitment Analytics Report',
            description: 'Open positions, time-to-fill, candidate pipeline metrics',
            dashboard: 'recruitment',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
        {
            id: 'learning-report',
            name: 'Learning & Development Report',
            description: 'Training completion rates, course enrollments, skill development',
            dashboard: 'learning',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
        {
            id: 'workforce-planning',
            name: 'Workforce Planning Report',
            description: 'Headcount trends, turnover forecast, capacity planning',
            dashboard: 'workforce-planning',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
        {
            id: 'compensation-report',
            name: 'Compensation Analytics Report',
            description: 'Salary distribution by department, pay equity analysis',
            dashboard: 'compensation',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
        {
            id: 'time-analytics',
            name: 'Time & Attendance Report',
            description: 'Attendance patterns, overtime analysis, and work hours distribution',
            dashboard: 'time',
            formats: ['csv', 'json', 'excel', 'pdf'],
        },
    ];
    res.json({ success: true, data: templates });
});
// Helper function to flatten nested data for export
function flattenDataForExport(data) {
    if (Array.isArray(data)) {
        return data;
    }
    // Try to find an array property to use
    for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
            return data[key];
        }
    }
    // If no arrays, convert the object to a single-row array
    return [data];
}
// ============================================================================
// FE-030/031/032 — Top-level analytics endpoints called by /portal/analytics
// Adapter su v_workforce_planning_dashboard / v_workforce_overview esistenti
// ============================================================================
router.get('/headcount', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const r = await req.dbClient.query(`SELECT total_headcount, active_employees, new_hires_30d, new_hires_90d,
            terminations_30d, terminations_90d, net_change_90d
       FROM analytics.v_workforce_planning_dashboard
      WHERE tenant_id = $1`, [tenantId]);
    res.json({ success: true, data: r.rows[0] || { total_headcount: 0, active_employees: 0 } });
}));
router.get('/attrition', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const r = await req.dbClient.query(`SELECT turnover_rate_annual, terminations_30d, terminations_90d,
            high_flight_risk_count, medium_flight_risk_count
       FROM analytics.v_workforce_planning_dashboard
      WHERE tenant_id = $1`, [tenantId]);
    res.json({ success: true, data: r.rows[0] || { turnover_rate_annual: 0 } });
}));
router.get('/departments', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const r = await req.dbClient.query(`SELECT COALESCE(department, 'Unassigned') AS department,
            COUNT(*)::int AS headcount,
            COUNT(*) FILTER (WHERE is_active)::int AS active
       FROM employees
      WHERE tenant_id = $1
      GROUP BY department
      ORDER BY headcount DESC`, [tenantId]);
    res.json({ success: true, data: r.rows });
}));
// Helper function to escape CSV values
function escapeCSVValue(value) {
    if (value === null || value === undefined)
        return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
export default router;
//# sourceMappingURL=analytics.js.map