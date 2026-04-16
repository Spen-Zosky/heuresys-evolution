/**
 * Whistleblowing Routes
 * EU Whistleblower Directive 2019/1937 compliant reporting system
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createWhistleblowingReportSchema, updateWhistleblowingStatusSchema, } from '../schemas/engagement.js';
import crypto from 'crypto';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
// Whistleblowing categories (hardcoded as no dedicated table exists)
const CATEGORIES = [
    { code: 'fraud', name: 'Frode', description: 'Frode finanziaria, appropriazione indebita' },
    { code: 'corruption', name: 'Corruzione', description: 'Tangenti, conflitti di interesse' },
    {
        code: 'harassment',
        name: 'Molestie',
        description: 'Molestie sessuali, mobbing, discriminazione',
    },
    { code: 'safety', name: 'Sicurezza', description: 'Violazioni sicurezza sul lavoro' },
    { code: 'environment', name: 'Ambiente', description: 'Violazioni ambientali' },
    { code: 'data_privacy', name: 'Privacy', description: 'Violazioni GDPR e protezione dati' },
    { code: 'competition', name: 'Concorrenza', description: 'Pratiche anticoncorrenziali' },
    { code: 'other', name: 'Altro', description: 'Altre violazioni' },
];
/**
 * GET /whistleblowing/categories
 * Get available reporting categories
 */
router.get('/categories', async (_req, res) => {
    res.json({ success: true, data: CATEGORIES });
});
/**
 * GET /whistleblowing/reports
 * List reports (HR_MANAGER+ only - filtered by tenant)
 */
router.get('/reports', authMiddleware, requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, category, severity, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        id, case_number, category, severity, title, status, priority,
        reporter_type, created_at, updated_at,
        acknowledgement_sent, feedback_provided
      FROM whistleblowing_reports
      WHERE tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
    }
    if (category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(category);
    }
    if (severity) {
        query += ` AND severity = $${paramIndex++}`;
        params.push(severity);
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM whistleblowing_reports WHERE tenant_id = $1', [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /whistleblowing/reports/:id
 * Get report details (HR_MANAGER+ only)
 */
router.get('/reports/:id', authMiddleware, requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT id, tenant_id, case_number, anonymous_token, reporter_type,
        reporter_name, reporter_email, reporter_phone, reporter_employee_id,
        reporter_role, category, severity, title, description, incident_date,
        incident_location, involved_persons, witnesses, status, priority,
        assigned_to, assigned_team, acknowledgement_sent, acknowledgement_date,
        feedback_provided, feedback_date, resolution_type, resolution_summary,
        consent_data_processing, retention_end_date, anonymized, source,
        ip_hash, user_agent_hash, created_at, updated_at, assigned_to_employee_id
      FROM whistleblowing_reports
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Report');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /whistleblowing/track/:caseNumber
 * Track report status (public - for anonymous reporters)
 */
router.get('/track/:caseNumber', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const caseNumber = req.params['caseNumber'];
    const { token } = req.query;
    const result = await req.dbClient.query(`
      SELECT
        case_number, status, category, severity,
        acknowledgement_sent, acknowledgement_date,
        feedback_provided, feedback_date,
        created_at, updated_at
      FROM whistleblowing_reports
      WHERE case_number = $1 AND tenant_id = $2
        AND ($3::text IS NULL OR anonymous_token = $3)
    `, [caseNumber, tenantId, token || null]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Report');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /whistleblowing/reports
 * Submit a new report (can be anonymous)
 */
router.post('/reports', validate(createWhistleblowingReportSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, severity = 'medium', title, description, incident_date, incident_location, involved_persons, witnesses, reporter_type = 'anonymous', reporter_name, reporter_email, reporter_phone, reporter_employee_id, consent_data_processing = false, } = req.body;
    if (!category || !title || !description) {
        throw Errors.badRequest('category, title, and description are required');
    }
    // Generate case number and anonymous token
    const caseNumber = `WB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const anonymousToken = reporter_type === 'anonymous' ? crypto.randomBytes(32).toString('hex') : null;
    const result = await req.dbClient.query(`
      INSERT INTO whistleblowing_reports (
        tenant_id, case_number, anonymous_token, category, severity,
        title, description, incident_date, incident_location,
        involved_persons, witnesses, reporter_type, reporter_name,
        reporter_email, reporter_phone, reporter_employee_id,
        consent_data_processing, status, priority, source,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        'received', 'normal', 'web', NOW(), NOW()
      )
      RETURNING id, case_number, status, created_at
    `, [
        tenantId,
        caseNumber,
        anonymousToken,
        category,
        severity,
        title,
        description,
        incident_date,
        incident_location,
        JSON.stringify(involved_persons || []),
        JSON.stringify(witnesses || []),
        reporter_type,
        reporter_name,
        reporter_email,
        reporter_phone,
        reporter_employee_id,
        consent_data_processing,
    ]);
    const response = {
        success: true,
        data: {
            id: result.rows[0]?.id,
            case_number: result.rows[0]?.case_number,
            status: result.rows[0]?.status,
            message: 'Report submitted successfully. Save your case number to track status.',
        },
    };
    if (anonymousToken) {
        response.data.tracking_token = anonymousToken;
    }
    res.status(201).json(response);
}));
/**
 * PATCH /whistleblowing/reports/:id/status
 * Update report status (HR_MANAGER+ only)
 */
router.patch('/reports/:id/status', authMiddleware, requirePermission('COMPLIANCE', 'EDIT'), validate(updateWhistleblowingStatusSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { status, resolution_type, resolution_summary, assigned_to, priority } = req.body;
    const existing = await req.dbClient.query('SELECT id FROM whistleblowing_reports WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Report');
    }
    const updates = ['updated_at = NOW()'];
    const values = [];
    let paramIndex = 1;
    if (status) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
    }
    if (resolution_type) {
        updates.push(`resolution_type = $${paramIndex++}`);
        values.push(resolution_type);
    }
    if (resolution_summary) {
        updates.push(`resolution_summary = $${paramIndex++}`);
        values.push(resolution_summary);
    }
    if (assigned_to) {
        updates.push(`assigned_to = $${paramIndex++}`);
        values.push(assigned_to);
    }
    if (priority) {
        updates.push(`priority = $${paramIndex++}`);
        values.push(priority);
    }
    const result = await req.dbClient.query(`UPDATE whistleblowing_reports SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Report updated' });
}));
/**
 * POST /whistleblowing/reports/:id/acknowledge
 * Send acknowledgement to reporter (HR_MANAGER+ only)
 */
router.post('/reports/:id/acknowledge', authMiddleware, requirePermission('COMPLIANCE', 'EDIT'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE whistleblowing_reports
      SET acknowledgement_sent = true, acknowledgement_date = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, case_number, acknowledgement_date
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Report');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Acknowledgement sent' });
}));
/**
 * GET /whistleblowing/stats
 * Get whistleblowing statistics (HR_MANAGER+ only)
 */
router.get('/stats', authMiddleware, requirePermission('COMPLIANCE', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const stats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_reports,
        COUNT(*) FILTER (WHERE status = 'received') as pending,
        COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30_days,
        ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::numeric, 1) as avg_resolution_days
      FROM whistleblowing_reports
      WHERE tenant_id = $1
    `, [tenantId]);
    const byCategory = await req.dbClient.query(`
      SELECT category, COUNT(*) as count
      FROM whistleblowing_reports
      WHERE tenant_id = $1
      GROUP BY category
      ORDER BY count DESC
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            summary: stats.rows[0],
            by_category: byCategory.rows,
        },
    });
}));
export default router;
//# sourceMappingURL=whistleblowing.js.map