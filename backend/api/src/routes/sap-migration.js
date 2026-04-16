/**
 * SAP HCM Migration Routes
 * Epic 6: SAP HCM Migration - All Stories
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '@heuresys/shared';
import { SAPMigrationService, SAPExportParser, } from '../services/sap-migration.js';
import { validate } from '../middleware/validate.js';
import { sapParseTestSchema, createSapJobSchema, sapParseSchema, sapParsePreviewSchema, createSapMappingSchema, updateSapMappingSchema, sapExecuteJobSchema, sapRollbackJobSchema, sapDeltaSyncCheckSchema, sapDeltaSyncExecuteSchema, sapEmployeeMappingSchema, } from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { logger } from '../config/logger.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// PUBLIC ENDPOINTS (No auth required)
// These provide reference information about SAP infotypes and formats
// =============================================================================
/**
 * GET /sap-migration/infotypes
 * List all supported SAP infotypes (public endpoint)
 */
router.get('/infotypes', asyncHandler(async (_req, res) => {
    const PA_INFOTYPES = [
        { code: 'PA0000', name: 'Actions', description: 'Personnel actions/events' },
        {
            code: 'PA0001',
            name: 'Organizational Assignment',
            description: 'Employee organizational assignment',
        },
        { code: 'PA0002', name: 'Personal Data', description: 'Employee personal data' },
        { code: 'PA0006', name: 'Addresses', description: 'Employee addresses' },
        { code: 'PA0008', name: 'Basic Pay', description: 'Employee basic pay information' },
        { code: 'PA0009', name: 'Bank Details', description: 'Employee bank details' },
        {
            code: 'PA0014',
            name: 'Recurring Payments/Deductions',
            description: 'Recurring payments and deductions',
        },
        { code: 'PA0016', name: 'Contract Elements', description: 'Contract elements and details' },
        { code: 'PA0105', name: 'Communication', description: 'Communication data (email, phone)' },
    ];
    const HRP_INFOTYPES = [
        {
            code: 'HRP1000',
            name: 'Object',
            description: 'Organizational object (org unit, position, job)',
        },
        { code: 'HRP1001', name: 'Relationships', description: 'Organizational relationships' },
        { code: 'HRP1002', name: 'Description', description: 'Extended descriptions' },
    ];
    res.json({
        success: true,
        data: {
            infotypes: [...PA_INFOTYPES, ...HRP_INFOTYPES],
            summary: {
                totalPA: PA_INFOTYPES.length,
                totalHRP: HRP_INFOTYPES.length,
                total: PA_INFOTYPES.length + HRP_INFOTYPES.length,
            },
        },
    });
}));
/**
 * GET /sap-migration/formats
 * Get supported file formats (public endpoint)
 */
router.get('/formats', asyncHandler(async (_req, res) => {
    res.json({
        success: true,
        data: {
            supported: [
                {
                    extension: '.csv',
                    description: 'SAP CSV export (pipe or semicolon delimited)',
                    delimiters: ['|', ';'],
                    notes: 'Standard SAP export format. First row should contain field names.',
                },
                {
                    extension: '.xml',
                    description: 'SAP IDoc XML format',
                    notes: 'Standard IDoc format with E1Pxxxx segments',
                },
                {
                    extension: '.json',
                    description: 'JSON format',
                    notes: 'Array of records or object with infotype keys',
                },
                {
                    extension: '.zip',
                    description: 'ZIP archive',
                    notes: 'Can contain multiple CSV, XML, or JSON files',
                },
            ],
            maxFileSize: '100MB',
            maxFiles: 10,
        },
    });
}));
/**
 * POST /sap-migration/parse-test
 * Public endpoint to test parsing without authentication
 */
router.post('/parse-test', validate(sapParseTestSchema), asyncHandler(async (req, res) => {
    const { fileContent, format, limit = 10 } = req.body;
    if (!fileContent || !format) {
        throw Errors.badRequest('fileContent and format are required');
    }
    const parser = new SAPExportParser();
    let records;
    switch (format) {
        case 'csv':
            records = parser.parseCSV(fileContent);
            break;
        case 'json':
            records = parser.parseJSON(fileContent);
            break;
        case 'xml':
            records = parser.parseXML(fileContent);
            break;
        default:
            throw Errors.badRequest('format must be csv, json, or xml');
    }
    const preview = records.slice(0, limit);
    const firstRecord = preview[0];
    const fields = firstRecord ? Object.keys(firstRecord.data) : [];
    res.json({
        success: true,
        data: {
            totalRecords: records.length,
            previewRecords: preview,
            fields,
            detectedFormat: format,
        },
    });
}));
// =============================================================================
// PROTECTED ENDPOINTS (Auth required)
// =============================================================================
router.use(requireTenant);
router.use(authMiddleware);
// =============================================================================
// MIGRATION STATUS (used by /admin/settings/sap-migration)
// =============================================================================
/**
 * GET /sap-migration/status
 * Overall migration status for the current tenant
 */
router.get('/status', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient;
    const jobsResult = await dbClient.query(`SELECT
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'in_progress') as active_jobs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
        MAX(completed_at) as last_completed,
        SUM(success_count) as total_records_migrated,
        SUM(error_count) as total_errors
      FROM sap_migration_jobs
      WHERE tenant_id = $1`, [tenantId]);
    const configResult = await dbClient.query(`SELECT * FROM sap_config LIMIT 1`);
    const stats = jobsResult.rows[0] || {};
    const config = configResult.rows[0];
    res.json({
        success: true,
        data: {
            status: parseInt(stats.active_jobs) > 0
                ? 'in_progress'
                : parseInt(stats.total_jobs) > 0
                    ? 'configured'
                    : 'not_configured',
            sap_configured: !!config,
            jobs: {
                total: safeParseInt(stats.total_jobs, { fallback: 0 }),
                completed: safeParseInt(stats.completed_jobs, { fallback: 0 }),
                active: safeParseInt(stats.active_jobs, { fallback: 0 }),
                failed: safeParseInt(stats.failed_jobs, { fallback: 0 }),
            },
            records_migrated: safeParseInt(stats.total_records_migrated, { fallback: 0 }),
            total_errors: safeParseInt(stats.total_errors, { fallback: 0 }),
            last_sync: stats.last_completed,
        },
    });
}));
// =============================================================================
// MIGRATION JOBS
// =============================================================================
/**
 * GET /sap-migration/jobs
 * List migration jobs for tenant
 */
router.get('/jobs', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, limit = '20', offset = '0' } = req.query;
    const service = new SAPMigrationService(tenantId);
    const jobs = await service.listJobs({
        status: status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
    });
    res.json({
        success: true,
        data: jobs,
    });
}));
/**
 * POST /sap-migration/jobs
 * Create a new migration job
 */
router.post('/jobs', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(createSapJobSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const { name, description, sourceSystem, migrationScope } = req.body;
    if (!name || !sourceSystem) {
        throw Errors.badRequest('name and sourceSystem are required');
    }
    const config = {
        name,
        description,
        sourceSystem,
        migrationScope: migrationScope || ['employees', 'org_structure'],
    };
    const service = new SAPMigrationService(tenantId);
    const userId = authReq.user?.userId;
    const jobId = await service.createMigrationJob(config, userId);
    res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Migration job created',
    });
}));
/**
 * GET /sap-migration/jobs/:id
 * Get migration job details
 */
router.get('/jobs/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    res.json({
        success: true,
        data: job,
    });
}));
/**
 * DELETE /sap-migration/jobs/:id
 * Cancel/delete a migration job
 */
router.delete('/jobs/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    const jobStatus = job.status;
    if (['completed', 'in_progress'].includes(jobStatus)) {
        throw Errors.badRequest('Cannot delete completed or in-progress jobs');
    }
    await service.updateJobStatus(jobId, 'cancelled');
    res.json({
        success: true,
        message: 'Migration job cancelled',
    });
}));
// =============================================================================
// FILE PARSING & STAGING
// =============================================================================
/**
 * POST /sap-migration/jobs/:id/parse
 * Parse SAP export file and stage data
 */
router.post('/jobs/:id/parse', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapParseSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const { fileContent, format, infotype } = req.body;
    if (!fileContent || !format) {
        throw Errors.badRequest('fileContent and format are required');
    }
    if (!['csv', 'json', 'xml'].includes(format)) {
        throw Errors.badRequest('format must be csv, json, or xml');
    }
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    const result = await service.parseAndStage(jobId, fileContent, format, infotype);
    res.json({
        success: true,
        data: result,
        message: `Parsed ${result.totalRecords} records, staged ${result.stagedCount}`,
    });
}));
/**
 * POST /sap-migration/parse-preview
 * Preview parsing without staging
 */
router.post('/parse-preview', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapParsePreviewSchema), asyncHandler(async (req, res) => {
    const { fileContent, format, limit = 10 } = req.body;
    if (!fileContent || !format) {
        throw Errors.badRequest('fileContent and format are required');
    }
    const parser = new SAPExportParser();
    let records;
    switch (format) {
        case 'csv':
            records = parser.parseCSV(fileContent);
            break;
        case 'json':
            records = parser.parseJSON(fileContent);
            break;
        case 'xml':
            records = parser.parseXML(fileContent);
            break;
        default:
            throw Errors.badRequest('format must be csv, json, or xml');
    }
    const preview = records.slice(0, limit);
    const firstRecord = preview[0];
    const fields = firstRecord ? Object.keys(firstRecord) : [];
    res.json({
        success: true,
        data: {
            totalRecords: records.length,
            previewRecords: preview,
            fields,
            detectedFormat: format,
        },
    });
}));
// =============================================================================
// VALIDATION
// =============================================================================
/**
 * POST /sap-migration/jobs/:id/validate
 * Validate staged data
 */
router.post('/jobs/:id/validate', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    const result = await service.validateStagedData(jobId);
    res.json({
        success: true,
        data: result,
        message: `Validation complete: ${result.validCount} valid, ${result.errorCount} errors, ${result.warningCount} warnings`,
    });
}));
/**
 * GET /sap-migration/jobs/:id/validation-errors
 * Get validation errors for a job
 */
router.get('/jobs/:id/validation-errors', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const { severity, limit = '100', offset = '0' } = req.query;
    const service = new SAPMigrationService(tenantId);
    const errors = await service.getValidationErrors(jobId, {
        severity: severity,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
    });
    res.json({
        success: true,
        data: errors,
    });
}));
// =============================================================================
// MAPPING
// =============================================================================
/**
 * GET /sap-migration/mappings
 * Get infotype mappings for tenant
 */
router.get('/mappings', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { infotype } = req.query;
    const service = new SAPMigrationService(tenantId);
    const mappings = await service.getMappings(infotype);
    res.json({
        success: true,
        data: mappings,
    });
}));
/**
 * POST /sap-migration/mappings
 * Create custom infotype mapping
 */
router.post('/mappings', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(createSapMappingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { infotype, infotypeName, sapField, targetTable, targetField, transformType = 'direct', transformConfig, required = false, } = req.body;
    if (!infotype || !sapField || !targetTable || !targetField) {
        throw Errors.badRequest('infotype, sapField, targetTable, and targetField are required');
    }
    const service = new SAPMigrationService(tenantId);
    const mappingId = await service.createMapping({
        infotype,
        infotypeName,
        sapField,
        targetTable,
        targetField,
        transformType,
        transformConfig,
        required,
    });
    res.status(201).json({
        success: true,
        data: { mappingId },
        message: 'Mapping created',
    });
}));
/**
 * PUT /sap-migration/mappings/:id
 * Update infotype mapping
 */
router.put('/mappings/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(updateSapMappingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const mappingId = req.params['id'];
    const updates = req.body;
    const service = new SAPMigrationService(tenantId);
    await service.updateMapping(mappingId, updates);
    res.json({
        success: true,
        message: 'Mapping updated',
    });
}));
/**
 * DELETE /sap-migration/mappings/:id
 * Delete custom mapping (tenant-specific only)
 */
router.delete('/mappings/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const mappingId = req.params['id'];
    const service = new SAPMigrationService(tenantId);
    await service.deleteMapping(mappingId);
    res.json({
        success: true,
        message: 'Mapping deleted',
    });
}));
/**
 * POST /sap-migration/jobs/:id/map
 * Apply mappings to staged data
 */
router.post('/jobs/:id/map', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    const result = await service.mapStagedData(jobId);
    res.json({
        success: true,
        data: result,
        message: `Mapping complete: ${result.mappedCount} mapped, ${result.errorCount} errors`,
    });
}));
// =============================================================================
// MIGRATION EXECUTION
// =============================================================================
/**
 * POST /sap-migration/jobs/:id/dry-run
 * Execute migration dry run
 */
router.post('/jobs/:id/dry-run', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobId = req.params['id'];
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    const result = await service.executeMigration(jobId, true);
    res.json({
        success: true,
        data: result,
        message: `Dry run complete: ${result.successCount} would succeed, ${result.errorCount} errors`,
    });
}));
/**
 * POST /sap-migration/jobs/:id/execute
 * Execute migration
 */
router.post('/jobs/:id/execute', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapExecuteJobSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const jobId = req.params['id'];
    const { confirmExecution } = req.body;
    if (!confirmExecution) {
        throw Errors.badRequest('Must set confirmExecution: true to proceed');
    }
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    if (job.status === 'completed') {
        throw Errors.badRequest('Job already completed');
    }
    // Log execution attempt
    logger.info(`[SAP Migration] Executing job ${jobId} by user ${authReq.user?.userId}`);
    const result = await service.executeMigration(jobId, false);
    res.json({
        success: result.success,
        data: result,
        message: result.success
            ? `Migration complete: ${result.successCount} records migrated`
            : `Migration failed: ${result.errorCount} errors`,
    });
}));
/**
 * POST /sap-migration/jobs/:id/rollback
 * Rollback a completed migration
 */
router.post('/jobs/:id/rollback', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapRollbackJobSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const jobId = req.params['id'];
    const { confirmRollback } = req.body;
    if (!confirmRollback) {
        throw Errors.badRequest('Must set confirmRollback: true to proceed');
    }
    const service = new SAPMigrationService(tenantId);
    const job = await service.getJob(jobId);
    if (!job) {
        throw Errors.notFound('Migration job', jobId);
    }
    if (job.status !== 'completed') {
        throw Errors.badRequest('Can only rollback completed jobs');
    }
    // Log rollback attempt
    logger.info(`[SAP Migration] Rolling back job ${jobId} by user ${authReq.user?.userId}`);
    const result = await service.rollbackMigration(jobId);
    res.json({
        success: true,
        data: result,
        message: `Rollback complete: ${result.rolledBackCount} records restored`,
    });
}));
// =============================================================================
// DELTA SYNC
// =============================================================================
/**
 * POST /sap-migration/delta-sync/check
 * Check for changes since last sync
 */
router.post('/delta-sync/check', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapDeltaSyncCheckSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { fileContent, format } = req.body;
    if (!fileContent || !format) {
        throw Errors.badRequest('fileContent and format are required');
    }
    const service = new SAPMigrationService(tenantId);
    const result = await service.deltaSyncCheck(fileContent, format);
    res.json({
        success: true,
        data: result,
        message: `Delta check: ${result.changedRecords} changed, ${result.newRecords} new, ${result.deletedRecords} deleted`,
    });
}));
/**
 * POST /sap-migration/delta-sync/execute
 * Execute delta synchronization
 */
router.post('/delta-sync/execute', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapDeltaSyncExecuteSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const { fileContent, format, confirmSync } = req.body;
    if (!fileContent || !format) {
        throw Errors.badRequest('fileContent and format are required');
    }
    if (!confirmSync) {
        throw Errors.badRequest('Must set confirmSync: true to proceed');
    }
    // Log sync attempt
    logger.info(`[SAP Migration] Delta sync by user ${authReq.user?.userId}`);
    const service = new SAPMigrationService(tenantId);
    const result = await service.executeDeltaSync(fileContent, format);
    res.json({
        success: true,
        data: result,
        message: `Delta sync complete: ${result.updatedCount} updated, ${result.createdCount} created`,
    });
}));
/**
 * GET /sap-migration/delta-sync/history
 * Get delta sync history
 */
router.get('/delta-sync/history', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '20', offset = '0' } = req.query;
    const service = new SAPMigrationService(tenantId);
    const history = await service.getDeltaSyncHistory({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
    });
    res.json({
        success: true,
        data: history,
    });
}));
// =============================================================================
// EMPLOYEE MAPPING
// =============================================================================
/**
 * GET /sap-migration/employee-mappings
 * Get SAP PERNR to Heuresys employee mappings
 */
router.get('/employee-mappings', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '100', offset = '0' } = req.query;
    const service = new SAPMigrationService(tenantId);
    const mappings = await service.getEmployeeMappings({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
    });
    res.json({
        success: true,
        data: mappings,
    });
}));
/**
 * POST /sap-migration/employee-mappings
 * Create manual employee mapping
 */
router.post('/employee-mappings', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(sapEmployeeMappingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sapPernr, employeeId } = req.body;
    if (!sapPernr || !employeeId) {
        throw Errors.badRequest('sapPernr and employeeId are required');
    }
    const service = new SAPMigrationService(tenantId);
    await service.createEmployeeMapping(sapPernr, employeeId);
    res.status(201).json({
        success: true,
        message: 'Employee mapping created',
    });
}));
// =============================================================================
// STATISTICS
// =============================================================================
/**
 * GET /sap-migration/stats
 * Get migration statistics
 */
router.get('/stats', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new SAPMigrationService(tenantId);
    const stats = await service.getStats();
    res.json({
        success: true,
        data: stats,
    });
}));
export default router;
//# sourceMappingURL=sap-migration.js.map