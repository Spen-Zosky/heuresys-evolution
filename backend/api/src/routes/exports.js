/**
 * Export Routes
 * Epic 7 - Story 7.4: Data Export & Visualization
 *
 * API for data exports and configurations
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { dataExportService } from '../services/data-export.js';
import { validate } from '../middleware/validate.js';
import { createExportConfigSchema, updateExportConfigSchema, createExportJobSchema, quickExportReportSchema, quickExportTableSchema, } from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
const router = Router();
router.use(requireTenant);
// All export operations require HR_MANAGER role
router.use(requirePermission('ANALYTICS', 'EXPORT'));
// ============================================================================
// Export Statistics
// ============================================================================
/**
 * GET /exports/stats
 * Get export statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const stats = await dataExportService.getExportStats(tenantId);
    res.json({ success: true, data: stats });
}));
// ============================================================================
// Export Configurations
// ============================================================================
/**
 * GET /exports/configs
 * List export configurations
 */
router.get('/configs', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { data_source, search } = req.query;
    const configs = await dataExportService.listConfigs(tenantId, {
        data_source: data_source,
        search: search,
    });
    res.json({ success: true, data: configs });
}));
/**
 * GET /exports/configs/:id
 * Get export configuration
 */
router.get('/configs/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const config = await dataExportService.getConfig(tenantId, id);
    if (!config) {
        throw Errors.notFound('Configuration');
    }
    res.json({ success: true, data: config });
}));
/**
 * POST /exports/configs
 * Create export configuration
 */
router.post('/configs', validate(createExportConfigSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, data_source, report_id, table_name, query, options, is_default, created_by, } = req.body;
    if (!name || !data_source || !options) {
        throw Errors.badRequest('name, data_source, and options are required');
    }
    const config = await dataExportService.createConfig({
        tenant_id: tenantId,
        name,
        description,
        data_source,
        report_id,
        table_name,
        query,
        options,
        is_default,
        created_by: created_by || 'system',
    });
    res.status(201).json({
        success: true,
        data: config,
        message: 'Export configuration created successfully',
    });
}));
/**
 * PATCH /exports/configs/:id
 * Update export configuration
 */
router.patch('/configs/:id', validate(updateExportConfigSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const config = await dataExportService.updateConfig(tenantId, id, req.body);
    if (!config) {
        throw Errors.notFound('Configuration');
    }
    res.json({
        success: true,
        data: config,
        message: 'Export configuration updated successfully',
    });
}));
/**
 * DELETE /exports/configs/:id
 * Delete export configuration
 */
router.delete('/configs/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const deleted = await dataExportService.deleteConfig(tenantId, id);
    if (!deleted) {
        throw Errors.notFound('Configuration');
    }
    res.json({ success: true, message: 'Export configuration deleted successfully' });
}));
// ============================================================================
// Export Jobs
// ============================================================================
/**
 * GET /exports/jobs
 * List export jobs
 */
router.get('/jobs', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, type, user_id, page = '1', page_size = '20', } = req.query;
    const { jobs, total } = await dataExportService.listJobs(tenantId, {
        ...(status ? { status: status } : {}),
        type: type,
        user_id: user_id,
        page: parseInt(page),
        page_size: parseInt(page_size),
    });
    res.json({
        success: true,
        data: jobs,
        meta: {
            total,
            page: parseInt(page),
            page_size: parseInt(page_size),
            total_pages: Math.ceil(total / parseInt(page_size)),
        },
    });
}));
/**
 * GET /exports/jobs/:id
 * Get export job details
 */
router.get('/jobs/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const job = await dataExportService.getJob(tenantId, id);
    if (!job) {
        throw Errors.notFound('Export job');
    }
    res.json({ success: true, data: job });
}));
/**
 * POST /exports/jobs
 * Create new export job
 */
router.post('/jobs', validate(createExportJobSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { config_id, type, source_id, options, parameters, filters, created_by } = req.body;
    if (!type || !options) {
        throw Errors.badRequest('type and options are required');
    }
    if (!options.format) {
        throw Errors.badRequest('options.format is required');
    }
    const job = await dataExportService.createExportJob({
        tenant_id: tenantId,
        config_id,
        type,
        source_id,
        options,
        parameters,
        filters,
        created_by: created_by || 'system',
    });
    res.status(202).json({
        success: true,
        data: job,
        message: 'Export job created and processing',
    });
}));
/**
 * POST /exports/jobs/:id/cancel
 * Cancel an export job
 */
router.post('/jobs/:id/cancel', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const cancelled = await dataExportService.cancelJob(tenantId, id);
    if (!cancelled) {
        throw Errors.badRequest('Job cannot be cancelled (not found or already completed)');
    }
    res.json({ success: true, message: 'Export job cancelled' });
}));
// ============================================================================
// Quick Export Endpoints
// ============================================================================
/**
 * POST /exports/report/:reportId
 * Quick export a report
 */
router.post('/report/:reportId', validate(quickExportReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reportId = req.params['reportId'];
    const { format = 'csv', parameters, created_by } = req.body;
    const job = await dataExportService.createExportJob({
        tenant_id: tenantId,
        type: 'report',
        source_id: reportId,
        options: {
            format,
            include_headers: true,
            include_timestamp: true,
        },
        parameters,
        created_by: created_by || 'system',
    });
    res.status(202).json({
        success: true,
        data: job,
        message: 'Report export started',
    });
}));
/**
 * POST /exports/table/:tableName
 * Quick export a table
 */
router.post('/table/:tableName', validate(quickExportTableSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const tableName = req.params['tableName'];
    const { format = 'csv', max_rows = 10000, created_by } = req.body;
    const job = await dataExportService.createExportJob({
        tenant_id: tenantId,
        type: 'table',
        source_id: tableName,
        options: {
            format,
            include_headers: true,
            include_timestamp: true,
            max_rows,
        },
        created_by: created_by || 'system',
    });
    res.status(202).json({
        success: true,
        data: job,
        message: 'Table export started',
    });
}));
export default router;
//# sourceMappingURL=exports.js.map