/**
 * Reports Routes
 * Epic 7 - Story 7.1: Report Builder Engine
 *
 * Advanced report building, execution, and management
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createReportSchema, updateReportSchema, cloneReportSchema, executeReportSchema, previewReportSchema, } from '../schemas/reports.js';
import { reportBuilderService } from '../services/report-builder.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { buildMeta } from '../utils/pagination.js';
import { logger } from '../config/logger.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
// All report operations require HR_MANAGER role
router.use(requirePermission('ANALYTICS', 'VIEW'));
// ============================================================================
// List & Statistics
// ============================================================================
/**
 * GET /reports
 * List report definitions with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM report_definitions WHERE tenant_id = $1`, [
            tenantId,
        ]),
        req.dbClient.query(`SELECT rd.id, rd.name, rd.description, rd.data_source, rd.is_template,
                rd.is_public, rd.created_by, rd.created_at, rd.updated_at
         FROM report_definitions rd
         WHERE rd.tenant_id = $1
         ORDER BY rd.updated_at DESC
         LIMIT $2 OFFSET $3`, [tenantId, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
/**
 * GET /reports/stats
 * Get report statistics for the tenant
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_template = true) as template_reports,
        COUNT(*) FILTER (WHERE is_public = true) as public_reports,
        COUNT(DISTINCT data_source) as data_sources
      FROM report_definitions WHERE tenant_id = $1
    `, [tenantId]);
    // Get execution stats
    const executionStats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE re.created_at > NOW() - INTERVAL '7 days') as last_7d,
        COUNT(*) FILTER (WHERE re.created_at > NOW() - INTERVAL '30 days') as last_30d,
        ROUND(AVG(re.duration_ms)) as avg_execution_ms
      FROM report_executions re
      JOIN report_definitions rd ON re.report_id = rd.id
      WHERE rd.tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            executions: executionStats.rows[0],
        },
    });
}));
/**
 * GET /reports/data-sources
 * Get available data sources for reporting
 */
router.get('/data-sources', asyncHandler(async (_req, res) => {
    const dataSources = reportBuilderService.getAvailableDataSources();
    res.json({
        success: true,
        data: dataSources,
    });
}));
/**
 * GET /reports/data-sources/:source/fields
 * Get available fields for a data source
 */
router.get('/data-sources/:source/fields', asyncHandler(async (req, res) => {
    const source = req.params['source'];
    const fields = await reportBuilderService.getDataSourceFields(source);
    res.json({
        success: true,
        data: fields,
    });
}));
/**
 * GET /reports/categories
 * Get report categories (based on data_source) with counts
 */
router.get('/categories', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT data_source as category, COUNT(*) as count
      FROM report_definitions
      WHERE tenant_id = $1
      GROUP BY data_source
      ORDER BY count DESC, data_source
    `, [tenantId]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
// ============================================================================
// Report CRUD Operations
// ============================================================================
/**
 * GET /reports
 * List all reports for the tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, search, include_system = 'false', page = '1', page_size = '20', } = req.query;
    const { reports, total } = await reportBuilderService.listReports(tenantId, {
        category: category,
        search: search,
        include_system: include_system === 'true',
        page: parseInt(page),
        page_size: parseInt(page_size),
    });
    res.json({
        success: true,
        data: reports,
        meta: {
            total,
            page: parseInt(page),
            page_size: parseInt(page_size),
            total_pages: Math.ceil(total / parseInt(page_size)),
        },
    });
}));
/**
 * GET /reports/:id
 * Get a specific report definition
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const report = await reportBuilderService.getReport(tenantId, id);
    if (!report) {
        throw Errors.notFound('Report');
    }
    res.json({ success: true, data: report });
}));
/**
 * POST /reports
 * Create a new report definition
 */
router.post('/', validate(createReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, category, data_source, fields, calculated_fields, joins, filters, sort, group_by, parameters, drill_down_config, access_control, is_public, created_by, } = req.body;
    if (!name || !data_source || !fields || !Array.isArray(fields) || fields.length === 0) {
        throw Errors.badRequest('name, data_source, and fields (non-empty array) are required');
    }
    const report = await reportBuilderService.createReport({
        tenant_id: tenantId,
        name,
        description,
        category,
        data_source,
        fields,
        calculated_fields,
        joins,
        filters,
        sort,
        group_by,
        parameters,
        drill_down_config,
        access_control,
        is_public,
        created_by: created_by || 'system',
    });
    res.status(201).json({
        success: true,
        data: report,
        message: 'Report created successfully',
    });
}));
/**
 * PATCH /reports/:id
 * Update a report definition
 */
router.patch('/:id', validate(updateReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const report = await reportBuilderService.updateReport(tenantId, id, req.body);
    if (!report) {
        throw Errors.notFound('Report');
    }
    res.json({
        success: true,
        data: report,
        message: 'Report updated successfully',
    });
}));
/**
 * DELETE /reports/:id
 * Delete a report (soft delete)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const deleted = await reportBuilderService.deleteReport(tenantId, id);
    if (!deleted) {
        throw Errors.notFound('Report');
    }
    res.json({ success: true, message: 'Report deleted successfully' });
}));
/**
 * POST /reports/:id/clone
 * Clone an existing report
 */
router.post('/:id/clone', validate(cloneReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { name, created_by } = req.body;
    if (!name) {
        throw Errors.badRequest('name is required');
    }
    const report = await reportBuilderService.cloneReport(tenantId, id, name, created_by || 'system');
    res.status(201).json({
        success: true,
        data: report,
        message: 'Report cloned successfully',
    });
}));
// ============================================================================
// Report Execution
// ============================================================================
/**
 * POST /reports/:id/execute
 * Execute a report and return results
 */
router.post('/:id/execute', validate(executeReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { parameters, page = 1, page_size = 100, include_totals = false } = req.body;
    // Verify report exists before executing
    const report = await reportBuilderService.getReport(tenantId, id);
    if (!report) {
        throw Errors.notFound('Report', id);
    }
    const result = await reportBuilderService.executeReport(tenantId, id, {
        parameters,
        page,
        page_size,
        include_totals,
    });
    res.json({
        success: true,
        data: result.data,
        totals: result.totals,
        meta: result.metadata,
    });
}));
/**
 * POST /reports/preview
 * Preview a report definition without saving
 */
router.post('/preview', validate(previewReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const definition = req.body;
    if (!definition.data_source || !definition.fields) {
        throw Errors.badRequest('data_source and fields are required for preview');
    }
    const data = await reportBuilderService.previewReport(tenantId, definition);
    res.json({
        success: true,
        data,
        meta: {
            preview: true,
            row_count: data.length,
            max_rows: 10,
        },
    });
}));
/**
 * GET /reports/:id/executions
 * Get execution history for a report
 */
router.get('/:id/executions', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { limit = '50' } = req.query;
    // Verify report exists
    const report = await reportBuilderService.getReport(tenantId, id);
    if (!report) {
        throw Errors.notFound('Report');
    }
    const history = await reportBuilderService.getExecutionHistory(tenantId, id, safeParseInt(limit, { fallback: 50 }));
    res.json({
        success: true,
        data: history,
    });
}));
// ============================================================================
// System Reports (Pre-built reports)
// ============================================================================
/**
 * POST /reports/system/seed
 * Seed system reports for a tenant
 */
router.post('/system/seed', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    // Check if already seeded
    const existing = await req.dbClient.query('SELECT COUNT(*) FROM report_definitions WHERE tenant_id = $1 AND is_template = true', [tenantId]);
    if (parseInt(existing.rows[0].count) > 0) {
        res.json({
            success: true,
            message: 'System reports already seeded',
            count: parseInt(existing.rows[0]?.count),
        });
        return;
    }
    const systemReports = [
        {
            name: 'Employee Headcount by OrgUnit',
            description: 'Shows employee count grouped by department',
            category: 'hr',
            data_source: 'employees',
            fields: [
                { name: 'department', source_field: 't0.org_unit_id', alias: 'org_unit_id' },
                { name: 'headcount', source_field: 't0.id', aggregate: 'count', alias: 'employee_count' },
            ],
            joins: [
                {
                    table: 'departments',
                    type: 'left',
                    on: { left_field: 't0.org_unit_id', right_field: 't1.id' },
                },
            ],
            group_by: [{ field: 't0.org_unit_id' }],
            sort: [{ field: 'employee_count', direction: 'desc' }],
        },
        {
            name: 'Goals Progress Summary',
            description: 'Overview of goal completion across the organization',
            category: 'performance',
            data_source: 'goals',
            fields: [
                { name: 'status', source_field: 't0.status', alias: 'status' },
                { name: 'count', source_field: 't0.id', aggregate: 'count', alias: 'goal_count' },
                {
                    name: 'avg_progress',
                    source_field: 't0.progress',
                    aggregate: 'avg',
                    alias: 'average_progress',
                },
            ],
            group_by: [{ field: 't0.status' }],
            sort: [{ field: 'goal_count', direction: 'desc' }],
        },
        {
            name: 'Training Enrollment Summary',
            description: 'Course enrollment statistics',
            category: 'learning',
            data_source: 'enrollments',
            fields: [
                { name: 'status', source_field: 't0.status', alias: 'status' },
                { name: 'count', source_field: 't0.id', aggregate: 'count', alias: 'enrollment_count' },
            ],
            group_by: [{ field: 't0.status' }],
            sort: [{ field: 'enrollment_count', direction: 'desc' }],
        },
        {
            name: 'Open Requisitions by OrgUnit',
            description: 'Active job requisitions grouped by department',
            category: 'recruitment',
            data_source: 'requisitions',
            fields: [
                { name: 'department', source_field: 't0.org_unit_id', alias: 'org_unit_id' },
                {
                    name: 'open_positions',
                    source_field: 't0.id',
                    aggregate: 'count',
                    alias: 'position_count',
                },
            ],
            filters: [{ field: 't0.status', operator: '=', value: 'open' }],
            group_by: [{ field: 't0.org_unit_id' }],
            sort: [{ field: 'position_count', direction: 'desc' }],
        },
        {
            name: 'Leave Balance Summary',
            description: 'Summary of leave balances by type',
            category: 'hr',
            data_source: 'leave_balances',
            fields: [
                { name: 'leave_type', source_field: 't0.leave_type', alias: 'leave_type' },
                {
                    name: 'total_balance',
                    source_field: 't0.balance',
                    aggregate: 'sum',
                    alias: 'total_days',
                },
                {
                    name: 'avg_balance',
                    source_field: 't0.balance',
                    aggregate: 'avg',
                    alias: 'average_days',
                },
            ],
            group_by: [{ field: 't0.leave_type' }],
            sort: [{ field: 'total_days', direction: 'desc' }],
        },
    ];
    let seededCount = 0;
    for (const reportDef of systemReports) {
        try {
            await reportBuilderService.createReport({
                tenant_id: tenantId,
                ...reportDef,
                is_system: true,
                is_public: true,
                created_by: 'system',
            });
            seededCount++;
        }
        catch (err) {
            logger.error(`Failed to seed report ${reportDef.name}:${err}`);
        }
    }
    res.status(201).json({
        success: true,
        message: `Seeded ${seededCount} system reports`,
        count: seededCount,
    });
}));
export default router;
//# sourceMappingURL=reports.js.map