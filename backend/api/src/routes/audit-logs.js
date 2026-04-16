/**
 * Audit Logs Routes
 * Read operations for audit trail with configuration and export
 * Epic: 2 - User Management & Tenant Configuration
 * Story: 2.6 - Audit Log Configuration & Viewing
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow, getTenantIdOrAll, } from '../middleware/tenantContext.js';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '@heuresys/shared';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { createAuditLogSchema, updateAuditConfigSchema, exportAuditLogsSchema, } from '../schemas/platform.js';
import { buildMeta, MAX_EXPORT_LIMIT } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context and authentication
router.use(requireTenant);
router.use(authMiddleware);
/**
 * GET /audit-logs
 * List audit logs with pagination and filtering
 */
router.get('/', requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrAll(req);
    const client = tenantId && req.dbClient ? req.dbClient : pool;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const action = req.query.action;
    const resourceType = req.query.resource_type;
    let whereClause = tenantId ? 'WHERE al.tenant_id = $1' : 'WHERE 1=1'; // safe: getTenantIdOrAll now enforces SUPERUSER check
    const params = tenantId ? [tenantId] : [];
    if (action) {
        params.push(action);
        whereClause += ` AND al.action = $${params.length}`;
    }
    if (resourceType) {
        params.push(resourceType);
        whereClause += ` AND al.resource_type = $${params.length}`;
    }
    const [countResult, dataResult] = await Promise.all([
        client.query(`SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`, params),
        client.query(`SELECT al.id, al.timestamp, al.user_id, al.user_email, al.user_role,
                al.action, al.category, al.resource_type, al.resource_id,
                al.resource_name, al.description, al.ip_address, al.success,
                e.first_name || ' ' || e.last_name as user_name
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         LEFT JOIN employees e ON u.employee_id = e.id
         ${whereClause}
         ORDER BY al.timestamp DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
/**
 * GET /audit-logs/stats
 */
router.get('/stats', requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE success = true) as successful,
        COUNT(*) FILTER (WHERE success = false) as failed,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT action) as action_types,
        COUNT(DISTINCT resource_type) as resource_types
      FROM audit_logs WHERE tenant_id = $1
    `, [tenantId]);
    // Get recent activity stats
    const recentStats = await req.dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as last_7d,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as last_30d
      FROM audit_logs WHERE tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            ...(recentStats.rows[0] || {}),
        },
    });
}));
/**
 * GET /audit-logs/actions
 */
router.get('/actions', requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT action, category, COUNT(*) as count
      FROM audit_logs
      WHERE tenant_id = $1
      GROUP BY action, category
      ORDER BY count DESC
    `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /audit-logs/recent
 */
router.get('/recent', requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '50' } = req.query;
    const result = await req.dbClient.query(`
      SELECT al.*,
        e.first_name || ' ' || e.last_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE al.tenant_id = $1
      ORDER BY al.timestamp DESC
      LIMIT $2
    `, [tenantId, safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /audit-logs/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT al.*,
        e.first_name || ' ' || e.last_name as user_name,
        e.email as user_email_from_employee
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE al.id = $1 AND al.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Audit log');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /audit-logs/resource/:resourceType/:resourceId
 */
router.get('/resource/:resourceType/:resourceId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { resourceType, resourceId } = req.params;
    const result = await req.dbClient.query(`
      SELECT al.*,
        e.first_name || ' ' || e.last_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE al.tenant_id = $1 AND al.resource_type = $2 AND al.resource_id = $3
      ORDER BY al.timestamp DESC
      LIMIT 100
    `, [tenantId, resourceType, resourceId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /audit-logs/user/:userId
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = req.params['userId'];
    const { limit = '100' } = req.query;
    const result = await req.dbClient.query(`
      SELECT al.*
      FROM audit_logs al
      WHERE al.tenant_id = $1 AND al.user_id = $2
      ORDER BY al.timestamp DESC
      LIMIT $3
    `, [tenantId, userId, safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /audit-logs
 * Create an audit log entry (for internal use)
 */
router.post('/', validate(createAuditLogSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { user_id, user_email, user_role, action, category, resource_type, resource_id, resource_name, description, old_value, new_value, ip_address, user_agent, metadata, success = true, error_message, } = req.body;
    if (!action || !category) {
        throw Errors.badRequest('action and category are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO audit_logs (tenant_id, user_id, user_email, user_role, action, category,
        resource_type, resource_id, resource_name, description, old_value, new_value,
        ip_address, user_agent, metadata, success, error_message, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      RETURNING *
    `, [
        tenantId,
        user_id,
        user_email,
        user_role,
        action,
        category,
        resource_type,
        resource_id,
        resource_name,
        description,
        old_value,
        new_value,
        ip_address,
        user_agent,
        metadata,
        success,
        error_message,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Audit log created' });
}));
// =============================================================================
// CONFIGURATION & EXPORT ROUTES (Story 2.6)
// =============================================================================
/**
 * GET /audit-logs/config
 * Get audit log configuration for tenant
 */
router.get('/config', requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`SELECT settings->'auditLog' as audit_config FROM tenants WHERE id = $1`, [tenantId]);
    if (result.rows.length === 0) {
        throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }
    const auditConfig = result.rows[0]?.audit_config || {
        retentionYears: 5,
        exportSchedule: 'manual',
        eventsToLog: 'all',
    };
    res.json({
        success: true,
        data: auditConfig,
    });
}));
/**
 * PUT /audit-logs/config
 * Update audit log configuration for tenant
 */
router.put('/config', requirePermission('COMPLIANCE', 'EDIT'), validate(updateAuditConfigSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { retentionYears, exportSchedule, eventsToLog } = req.body;
    // Validate retention period
    const validRetentionYears = [1, 5, 10];
    const retention = validRetentionYears.includes(retentionYears) ? retentionYears : 5;
    // Validate export schedule
    const validSchedules = ['manual', 'weekly', 'monthly'];
    const schedule = validSchedules.includes(exportSchedule) ? exportSchedule : 'manual';
    // Get current settings
    const currentResult = await req.dbClient.query('SELECT settings FROM tenants WHERE id = $1', [
        tenantId,
    ]);
    if (currentResult.rows.length === 0) {
        throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }
    const currentSettings = currentResult.rows[0]?.settings || {};
    const newSettings = {
        ...currentSettings,
        auditLog: {
            retentionYears: retention,
            exportSchedule: schedule,
            eventsToLog: eventsToLog || 'all',
            updatedAt: new Date().toISOString(),
        },
    };
    await req.dbClient.query(`UPDATE tenants SET settings = $2, updated_at = NOW() WHERE id = $1`, [tenantId, JSON.stringify(newSettings)]);
    res.json({
        success: true,
        data: newSettings.auditLog,
        message: 'Audit log configuration updated',
    });
}));
/**
 * POST /audit-logs/export
 * Export audit logs to CSV/JSON
 */
router.post('/export', requirePermission('COMPLIANCE', 'EXPORT'), validate(exportAuditLogsSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const { format = 'json', fromDate, toDate, action, category } = req.body;
    // Build query
    let query = `
      SELECT al.id, al.timestamp, al.user_email, al.user_role, al.action, al.category,
             al.resource_type, al.resource_id, al.resource_name, al.description,
             al.success, al.ip_address
      FROM audit_logs al
      WHERE al.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (fromDate) {
        query += ` AND al.timestamp >= $${paramIndex}`;
        params.push(fromDate);
        paramIndex++;
    }
    if (toDate) {
        query += ` AND al.timestamp <= $${paramIndex}`;
        params.push(toDate);
        paramIndex++;
    }
    if (action) {
        query += ` AND al.action = $${paramIndex}`;
        params.push(action);
        paramIndex++;
    }
    if (category) {
        query += ` AND al.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    query += ` ORDER BY al.timestamp DESC LIMIT ${MAX_EXPORT_LIMIT}`;
    const result = await req.dbClient.query(query, params);
    // Log the export action
    await req.dbClient.query(`
      INSERT INTO audit_logs (tenant_id, user_id, user_email, user_role, action, category,
        description, success, ip_address, timestamp)
      VALUES ($1, $2, $3, $4, 'EXPORT', 'SYSTEM', $5, true, $6, NOW())
    `, [
        tenantId,
        authReq.user.userId,
        authReq.user.username,
        authReq.user.role,
        `Exported ${result.rows.length} audit log entries`,
        req.ip,
    ]);
    if (format === 'csv') {
        // Generate CSV
        const headers = [
            'ID',
            'Timestamp',
            'User',
            'Role',
            'Action',
            'Category',
            'Resource Type',
            'Resource ID',
            'Description',
            'Success',
            'IP Address',
        ];
        const csvRows = [headers.join(',')];
        for (const row of result.rows) {
            const csvRow = [
                row.id,
                row.timestamp,
                `"${row.user_email || ''}"`,
                row.user_role || '',
                row.action,
                row.category,
                row.resource_type || '',
                row.resource_id || '',
                `"${(row.description || '').replace(/"/g, '""')}"`,
                row.success,
                row.ip_address || '',
            ];
            csvRows.push(csvRow.join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvRows.join('\n'));
    }
    else {
        // Return JSON
        res.json({
            success: true,
            data: {
                exportedAt: new Date().toISOString(),
                count: result.rows.length,
                logs: result.rows,
            },
        });
    }
}));
/**
 * GET /audit-logs/meta/actions
 * Get available action types
 */
router.get('/meta/actions', (_req, res) => {
    const actions = [
        { value: 'CREATE', label: 'Create', description: 'Resource creation' },
        { value: 'READ', label: 'Read', description: 'Resource access' },
        { value: 'UPDATE', label: 'Update', description: 'Resource modification' },
        { value: 'DELETE', label: 'Delete', description: 'Resource deletion' },
        { value: 'LOGIN', label: 'Login', description: 'User authentication' },
        { value: 'LOGOUT', label: 'Logout', description: 'Session termination' },
        { value: 'EXPORT', label: 'Export', description: 'Data export' },
        { value: 'IMPORT', label: 'Import', description: 'Data import' },
        {
            value: 'PERMISSION_CHANGE',
            label: 'Permission Change',
            description: 'Access rights modification',
        },
        { value: 'CONFIG_CHANGE', label: 'Config Change', description: 'Configuration update' },
        { value: 'DATA_ACCESS', label: 'Data Access', description: 'Sensitive data access' },
    ];
    res.json({ success: true, data: actions });
});
/**
 * GET /audit-logs/meta/categories
 * Get available categories
 */
router.get('/meta/categories', (_req, res) => {
    const categories = [
        { value: 'AUTH', label: 'Authentication' },
        { value: 'USER', label: 'User Management' },
        { value: 'EMPLOYEE', label: 'Employee Data' },
        { value: 'TENANT', label: 'Tenant Configuration' },
        { value: 'GOAL', label: 'Goals & OKRs' },
        { value: 'REVIEW', label: 'Performance Reviews' },
        { value: 'FEEDBACK', label: 'Feedback' },
        { value: 'COMPENSATION', label: 'Compensation' },
        { value: 'DOCUMENT', label: 'Documents' },
        { value: 'REPORT', label: 'Reports' },
        { value: 'CONFIG', label: 'Configuration' },
        { value: 'SYSTEM', label: 'System Events' },
    ];
    res.json({ success: true, data: categories });
});
export default router;
//# sourceMappingURL=audit-logs.js.map