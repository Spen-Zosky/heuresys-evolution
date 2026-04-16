/**
 * Blueprint Routes
 * Endpoints for running blueprint generation (greenfield/overlay) and managing results.
 * Mount point: /api/v1/blueprint
 */
import { Router } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { BlueprintGeneratorService } from '../services/blueprint-generator.js';
import { z } from 'zod';
const router = Router();
router.use(requireTenant);
// =============================================================================
// UUID VALIDATION HELPER
// =============================================================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUUID(value, label) {
    if (!UUID_REGEX.test(value)) {
        throw Errors.badRequest(`Invalid ${label} format`);
    }
}
// =============================================================================
// ZOD SCHEMAS
// =============================================================================
const createRunSchema = z.object({
    templateId: z.string().uuid(),
    runMode: z.enum(['greenfield', 'overlay']),
    inputConfig: z.record(z.unknown()).optional(),
});
const resultsQuerySchema = z.object({
    resultType: z.string().optional(),
    severity: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});
// =============================================================================
// ENDPOINTS
// =============================================================================
// POST /runs — Start a blueprint run
router.post('/runs', requirePermission('ORGANIZATION', 'CREATE'), validate(createRunSchema), asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId)
        throw Errors.badRequest('Tenant context required');
    const { templateId, runMode, inputConfig } = req.body;
    const service = new BlueprintGeneratorService(req.dbClient);
    const output = await service.runBlueprint({
        templateId,
        tenantId,
        runMode,
        createdBy: req.user?.userId,
        inputConfig,
    });
    res.status(201).json({ success: true, data: output });
}));
// GET /runs — List runs for tenant
router.get('/runs', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId)
        throw Errors.badRequest('Tenant context required');
    const limit = Math.min(parseInt(req.query['limit'], 10) || 20, 100);
    const offset = parseInt(req.query['offset'], 10) || 0;
    const result = await req.dbClient.query(`SELECT * FROM blueprint_runs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`, [tenantId, limit, offset]);
    const countResult = await req.dbClient.query(`SELECT COUNT(*) AS total FROM blueprint_runs WHERE tenant_id = $1`, [tenantId]);
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    res.json({
        success: true,
        data: result.rows,
        meta: { total, limit, offset, hasMore: offset + limit < total },
    });
}));
// GET /runs/:runId — Run detail with severity summary
router.get('/runs/:runId', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const runId = req.params['runId'];
    assertUUID(runId, 'run ID');
    const tenantId = req.tenantId;
    if (!tenantId)
        throw Errors.badRequest('Tenant context required');
    const runResult = await req.dbClient.query(`SELECT * FROM blueprint_runs WHERE id = $1 AND tenant_id = $2`, [runId, tenantId]);
    if (runResult.rows.length === 0) {
        throw Errors.notFound('Blueprint run not found');
    }
    // Severity summary
    const summaryResult = await req.dbClient.query(`SELECT severity, COUNT(*) AS count
       FROM blueprint_results
       WHERE run_id = $1
       GROUP BY severity`, [runId]);
    const severitySummary = {};
    for (const row of summaryResult.rows) {
        severitySummary[row.severity ?? 'unknown'] = parseInt(row.count, 10);
    }
    res.json({
        success: true,
        data: {
            run: runResult.rows[0],
            severitySummary,
        },
    });
}));
// GET /runs/:runId/results — List results with optional filters
router.get('/runs/:runId/results', requirePermission('ORGANIZATION', 'VIEW'), validate(resultsQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const runId = req.params['runId'];
    assertUUID(runId, 'run ID');
    const { resultType, severity, limit: qLimit, offset: qOffset, } = req.query;
    const limit = Math.min(parseInt(qLimit ?? '50', 10) || 50, 100);
    const offset = parseInt(qOffset ?? '0', 10) || 0;
    const conditions = ['run_id = $1'];
    const params = [runId];
    let paramIdx = 2;
    if (resultType) {
        conditions.push(`result_type = $${paramIdx}`);
        params.push(resultType);
        paramIdx++;
    }
    if (severity) {
        conditions.push(`severity = $${paramIdx}`);
        params.push(severity);
        paramIdx++;
    }
    const whereClause = conditions.join(' AND ');
    const result = await req.dbClient.query(`SELECT * FROM blueprint_results
       WHERE ${whereClause}
       ORDER BY created_at
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, [...params, limit, offset]);
    const countResult = await req.dbClient.query(`SELECT COUNT(*) AS total FROM blueprint_results WHERE ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    res.json({
        success: true,
        data: result.rows,
        meta: { total, limit, offset, hasMore: offset + limit < total },
    });
}));
// POST /runs/:runId/results/:resultId/apply — Mark result as applied
router.post('/runs/:runId/results/:resultId/apply', requirePermission('ORGANIZATION', 'EDIT'), asyncHandler(async (req, res) => {
    const { runId, resultId } = req.params;
    assertUUID(runId, 'run ID');
    assertUUID(resultId, 'result ID');
    const result = await req.dbClient.query(`UPDATE blueprint_results
       SET is_applied = true, applied_at = NOW(), applied_by = $1
       WHERE id = $2 AND run_id = $3
       RETURNING *`, [req.user?.userId ?? null, resultId, runId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Blueprint result not found');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
export default router;
//# sourceMappingURL=blueprint.js.map