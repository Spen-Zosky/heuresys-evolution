/**
 * Policy Violations Routes
 * Placeholder route for compliance policy violations management
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { policyViolationsQuerySchema } from '../schemas/time-policy.js';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /policy-violations
 * List all policy violations (placeholder - returns audit entries related to policies)
 */
router.get('/', validate(policyViolationsQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit, offset } = req.query;
    // Return policy-related audit logs as placeholder for violations
    const result = await req.dbClient.query(`
      SELECT al.id, al.action, al.resource_type as violation_type,
        al.resource_id, al.user_id, al.description,
        'medium' as severity, 'reviewing' as status,
        al.timestamp as created_at,
        COALESCE(e.first_name || ' ' || e.last_name, u.username, 'Unknown') as reported_by
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE al.tenant_id = $1
        AND al.action IN ('policy_violation', 'security_alert', 'unauthorized_access', 'delete', 'update')
      ORDER BY al.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [tenantId, limit, offset]);
    res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length },
    });
}));
/**
 * GET /policy-violations/stats
 * Get policy violations statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE action IN ('policy_violation', 'security_alert', 'unauthorized_access')) as total_violations,
        COUNT(*) FILTER (WHERE action = 'policy_violation') as policy_violations,
        COUNT(*) FILTER (WHERE action = 'security_alert') as security_alerts,
        COUNT(*) FILTER (WHERE action = 'unauthorized_access') as unauthorized_access,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as recent_week
      FROM audit_logs
      WHERE tenant_id = $1
    `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
export default router;
//# sourceMappingURL=policy-violations.js.map