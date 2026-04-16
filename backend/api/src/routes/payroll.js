/**
 * Payroll Integration Routes
 * Epic 7: Payroll Integration (Zucchetti)
 * Stories: 7.1-7.5
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '@heuresys/shared';
import { PayrollIntegrationService, } from '../services/payroll-integration.js';
import { createPayrollIntegrationSchema, updatePayrollIntegrationSchema, createExportJobSchema, transmitExportSchema, acknowledgeExportSchema, } from '../schemas/compensation.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================
/**
 * GET /payroll/providers
 * List supported payroll providers (public)
 */
router.get('/providers', async (_req, res) => {
    const providers = [
        {
            code: 'zucchetti',
            name: 'Zucchetti Paghe',
            description: 'Integrazione con Zucchetti HR Infinity / Paghe Web',
            integrationTypes: ['api', 'file', 'sftp'],
            exportFormats: ['csv', 'xml'],
            features: ['auto_export', 'validation', 'anomaly_detection'],
        },
        {
            code: 'teamsystem',
            name: 'TeamSystem HR',
            description: 'Integrazione con TeamSystem Paghe',
            integrationTypes: ['file', 'sftp'],
            exportFormats: ['csv', 'fixed_width'],
            features: ['validation'],
        },
        {
            code: 'adsystems',
            name: 'ADP Systems',
            description: 'Integrazione con ADP Payroll',
            integrationTypes: ['api', 'file'],
            exportFormats: ['csv', 'json', 'xml'],
            features: ['api', 'validation', 'auto_export'],
        },
        {
            code: 'inaz',
            name: 'INAZ Paghe',
            description: 'Integrazione con INAZ',
            integrationTypes: ['file', 'sftp'],
            exportFormats: ['csv'],
            features: ['validation'],
        },
        {
            code: 'custom',
            name: 'Custom Integration',
            description: 'Integrazione personalizzata con formato configurabile',
            integrationTypes: ['file'],
            exportFormats: ['csv', 'json', 'xml', 'fixed_width'],
            features: ['validation', 'custom_mapping'],
        },
    ];
    res.json({
        success: true,
        data: { providers },
    });
});
/**
 * GET /payroll/export-sections
 * List available export sections (public)
 */
router.get('/export-sections', async (_req, res) => {
    const sections = [
        {
            code: 'anagrafica',
            name: 'Anagrafica Dipendenti',
            description: 'Dati anagrafici e contrattuali dei dipendenti',
            fields: ['MATR', 'CODFIS', 'COGN', 'NOME', 'DTNAS', 'DTASS', 'CCNL', 'LIVELLO'],
        },
        {
            code: 'presenze',
            name: 'Presenze/Assenze',
            description: 'Registrazione presenze e ore lavorate',
            fields: ['DATA', 'ORE_ORD', 'CAUSALE', 'GG_PRESENTI'],
        },
        {
            code: 'straordinari',
            name: 'Straordinari',
            description: 'Ore di straordinario per tipologia',
            fields: ['DATA', 'ORE_STR', 'TIPO_STR'],
        },
        {
            code: 'variazioni',
            name: 'Variazioni Contrattuali',
            description: 'Modifiche a contratti, livelli, stipendi',
            fields: ['TIPO_VAR', 'DATA_VAR', 'VALORE_PREC', 'VALORE_NUOVO'],
        },
        {
            code: 'assenze',
            name: 'Assenze',
            description: 'Ferie, permessi, malattia, maternità',
            fields: ['DATA_INI', 'DATA_FIN', 'CAUSALE', 'GG_ASS'],
        },
    ];
    res.json({
        success: true,
        data: { sections },
    });
});
// =============================================================================
// PROTECTED ENDPOINTS
// =============================================================================
router.use(requireTenant);
router.use(authMiddleware);
// =============================================================================
// EMPLOYEE SELF-SERVICE: PAY STUBS
// =============================================================================
/**
 * GET /payroll
 * List pay stubs for the current user's employee profile.
 * The employee_pay_stubs table has no tenant_id — filter via employees JOIN.
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const employeeId = authReq.user?.employeeId;
    if (!employeeId) {
        // Return empty set rather than error — the frontend handles empty gracefully
        res.json({ success: true, data: { pay_stubs: [] } });
        return;
    }
    const { year, limit = '24' } = req.query;
    let query = `
      SELECT
        ps.id,
        ps.period,
        ps.period_start,
        ps.period_end,
        ps.gross_pay   AS gross_amount,
        ps.net_pay     AS net_amount,
        COALESCE(
          (SELECT SUM(v::numeric) FROM jsonb_each_text(ps.deductions) AS t(k, v)),
          ps.gross_pay - ps.net_pay
        ) AS deductions,
        ps.payment_date AS pay_date,
        ps.status,
        ps.created_at
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.employee_id = $1 AND e.tenant_id = $2
    `;
    const params = [employeeId, tenantId];
    let paramIndex = 3;
    if (year) {
        query += ` AND EXTRACT(YEAR FROM ps.period_start) = $${paramIndex}`;
        params.push(parseInt(year));
        paramIndex++;
    }
    query += ` ORDER BY ps.period_start DESC LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: { pay_stubs: result.rows },
    });
}));
/**
 * GET /payroll/my-stub/:id
 * Get a single pay stub by ID (employee self-service).
 * Uses /my-stub/ prefix to avoid collision with /providers, /integrations, etc.
 */
router.get('/my-stub/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const employeeId = authReq.user?.employeeId;
    const id = req.params.id;
    if (!employeeId) {
        throw Errors.unauthorized('No employee profile linked to this user');
    }
    const result = await req.dbClient.query(`
      SELECT
        ps.id,
        ps.period,
        ps.period_start,
        ps.period_end,
        ps.gross_pay   AS gross_amount,
        ps.net_pay     AS net_amount,
        ps.deductions  AS deductions_detail,
        COALESCE(
          (SELECT SUM(v::numeric) FROM jsonb_each_text(ps.deductions) AS t(k, v)),
          ps.gross_pay - ps.net_pay
        ) AS deductions,
        ps.payment_date AS pay_date,
        ps.status,
        ps.created_at
      FROM employee_pay_stubs ps
      JOIN employees e ON e.id = ps.employee_id
      WHERE ps.id = $1 AND ps.employee_id = $2 AND e.tenant_id = $3
      `, [id, employeeId, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Pay stub');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
// =============================================================================
// STORY 7.1: INTEGRATION CONFIGURATION
// =============================================================================
/**
 * GET /payroll/integrations
 * List payroll integrations for tenant
 */
router.get('/integrations', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new PayrollIntegrationService(tenantId);
    const integrations = await service.listIntegrations();
    res.json({
        success: true,
        data: { integrations },
    });
}));
/**
 * POST /payroll/integrations
 * Create new payroll integration
 */
router.post('/integrations', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(createPayrollIntegrationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const config = req.body;
    if (!config.providerName || !config.providerCode || !config.integrationType) {
        throw Errors.badRequest('providerName, providerCode, and integrationType are required');
    }
    const service = new PayrollIntegrationService(tenantId);
    const integrationId = await service.createIntegration(config);
    res.status(201).json({
        success: true,
        data: { id: integrationId },
        message: 'Integrazione payroll creata con successo',
    });
}));
/**
 * GET /payroll/integrations/:id
 * Get integration details
 */
router.get('/integrations/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const integration = await service.getIntegration(id);
    if (!integration) {
        throw Errors.notFound('Integrazione');
    }
    res.json({
        success: true,
        data: integration,
    });
}));
/**
 * PATCH /payroll/integrations/:id
 * Update integration configuration
 */
router.patch('/integrations/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(updatePayrollIntegrationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const updates = req.body;
    const service = new PayrollIntegrationService(tenantId);
    await service.updateIntegration(id, updates);
    res.json({
        success: true,
        message: 'Integrazione aggiornata con successo',
    });
}));
/**
 * POST /payroll/integrations/:id/test
 * Test connection to payroll provider
 */
router.post('/integrations/:id/test', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const result = await service.testConnection(id);
    res.json({
        success: result.success,
        data: result,
    });
}));
// =============================================================================
// STORY 7.2: PAYROLL DATA EXPORT GENERATION
// =============================================================================
/**
 * GET /payroll/jobs
 * List export jobs
 */
router.get('/jobs', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year, month, status, limit = '20', offset = '0' } = req.query;
    const service = new PayrollIntegrationService(tenantId);
    const filters = {
        limit: safeParseInt(limit, { fallback: 50 }),
        offset: safeParseInt(offset, { fallback: 0 }),
    };
    if (year)
        filters.year = parseInt(year);
    if (month)
        filters.month = parseInt(month);
    if (status)
        filters.status = status;
    const result = await service.listExportJobs(filters);
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * POST /payroll/jobs
 * Create new export job
 */
router.post('/jobs', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(createExportJobSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const config = req.body;
    if (!config.payPeriodYear || !config.payPeriodMonth || !config.exportType) {
        throw Errors.badRequest('payPeriodYear, payPeriodMonth, and exportType are required');
    }
    const service = new PayrollIntegrationService(tenantId);
    const userId = authReq.user?.userId ?? 'system';
    const jobId = await service.createExportJob(config, userId);
    res.status(201).json({
        success: true,
        data: { id: jobId },
        message: 'Job di export creato con successo',
    });
}));
/**
 * GET /payroll/jobs/:id
 * Get export job details
 */
router.get('/jobs/:id', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const job = await service.getExportJob(id);
    if (!job) {
        throw Errors.notFound('Job');
    }
    res.json({
        success: true,
        data: job,
    });
}));
/**
 * POST /payroll/jobs/:id/generate
 * Generate export file
 */
router.post('/jobs/:id/generate', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const result = await service.generateExport(id);
    res.json({
        success: true,
        data: result,
        message: 'Export generato con successo',
    });
}));
// =============================================================================
// STORY 7.3: PRE-EXPORT VALIDATION & ANOMALY DETECTION
// =============================================================================
/**
 * POST /payroll/jobs/:id/validate
 * Validate export job data
 */
router.post('/jobs/:id/validate', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const result = await service.validateExport(id);
    res.json({
        success: true,
        data: result,
        message: result.isValid
            ? 'Validazione completata con successo'
            : `Validazione completata con ${result.blockedCount} errori bloccanti`,
    });
}));
/**
 * GET /payroll/validation-rules
 * Get validation rules
 */
router.get('/validation-rules', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new PayrollIntegrationService(tenantId);
    const rules = await service.getValidationRules();
    res.json({
        success: true,
        data: { rules },
    });
}));
/**
 * GET /payroll/field-mappings
 * Get field mappings for export
 */
router.get('/field-mappings', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { integrationId } = req.query;
    const service = new PayrollIntegrationService(tenantId);
    const mappings = await service.getFieldMappings(integrationId);
    res.json({
        success: true,
        data: { mappings },
    });
}));
// =============================================================================
// STORY 7.4: EXPORT TRANSMISSION & CONFIRMATION
// =============================================================================
/**
 * POST /payroll/jobs/:id/transmit
 * Transmit export to payroll provider
 */
router.post('/jobs/:id/transmit', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(transmitExportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const { confirmTransmission, method } = req.body;
    if (!confirmTransmission) {
        throw Errors.badRequest('È richiesta la conferma esplicita della trasmissione (confirmTransmission: true)');
    }
    const service = new PayrollIntegrationService(tenantId);
    const result = await service.transmitExport(id, { confirmTransmission, method });
    res.json({
        success: result.success,
        data: result,
        message: result.success
            ? 'Trasmissione completata con successo'
            : `Trasmissione fallita: ${result.errorMessage}`,
    });
}));
/**
 * POST /payroll/jobs/:id/acknowledge
 * Record provider acknowledgment
 */
router.post('/jobs/:id/acknowledge', checkPermission(PERMISSIONS.TENANT_CONFIGURE), validate(acknowledgeExportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const { reference, recordsAccepted, recordsRejected, details } = req.body;
    if (!reference) {
        throw Errors.badRequest('reference è richiesto');
    }
    const service = new PayrollIntegrationService(tenantId);
    await service.recordAcknowledgment(id, {
        reference,
        recordsAccepted,
        recordsRejected,
        details,
    });
    res.json({
        success: true,
        message: 'Acknowledgment registrato con successo',
    });
}));
/**
 * POST /payroll/jobs/:id/complete
 * Mark export as completed
 */
router.post('/jobs/:id/complete', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    await service.completeExport(id);
    res.json({
        success: true,
        message: 'Export completato con successo',
    });
}));
// =============================================================================
// STORY 7.5: EXPORT HISTORY & REPORTING
// =============================================================================
/**
 * GET /payroll/history
 * Get export history with filtering
 */
router.get('/history', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year, status, limit = '20', offset = '0' } = req.query;
    const service = new PayrollIntegrationService(tenantId);
    const historyFilters = {
        limit: safeParseInt(limit, { fallback: 50 }),
        offset: safeParseInt(offset, { fallback: 0 }),
    };
    if (year)
        historyFilters.year = parseInt(year);
    if (status)
        historyFilters.status = status;
    const result = await service.getExportHistory(historyFilters);
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * GET /payroll/jobs/:id/files
 * Get export files for a job
 */
router.get('/jobs/:id/files', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const files = await service.getExportFiles(id);
    res.json({
        success: true,
        data: { files },
    });
}));
/**
 * GET /payroll/jobs/:id/transmission-log
 * Get transmission log for a job
 */
router.get('/jobs/:id/transmission-log', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const log = await service.getTransmissionLog(id);
    res.json({
        success: true,
        data: { transmissions: log },
    });
}));
/**
 * GET /payroll/jobs/:id/compare
 * Compare with previous period
 */
router.get('/jobs/:id/compare', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params.id;
    const service = new PayrollIntegrationService(tenantId);
    const comparison = await service.compareWithPreviousPeriod(id);
    res.json({
        success: true,
        data: comparison,
    });
}));
/**
 * GET /payroll/annual-summary/:year
 * Get annual summary for CU preparation
 */
router.get('/annual-summary/:year', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const year = parseInt(req.params.year);
    if (isNaN(year) || year < 2020 || year > 2100) {
        throw Errors.badRequest('Anno non valido');
    }
    const service = new PayrollIntegrationService(tenantId);
    const summary = await service.getAnnualSummary(year);
    res.json({
        success: true,
        data: summary,
    });
}));
/**
 * GET /payroll/stats
 * Get payroll statistics
 */
router.get('/stats', checkPermission(PERMISSIONS.TENANT_CONFIGURE), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const service = new PayrollIntegrationService(tenantId);
    const stats = await service.getStatistics();
    res.json({
        success: true,
        data: stats,
    });
}));
export default router;
//# sourceMappingURL=payroll.js.map