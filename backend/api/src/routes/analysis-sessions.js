/**
 * Analysis Sessions Routes
 * BUG-053: Company PET sessions page requires /api/v1/analysis-sessions
 *
 * CRUD for PET analysis sessions (People, Economics & Talent).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { asyncHandler } from '../errors/middleware.js';
import { validate } from '../middleware/validate.js';
import { Errors } from '../errors/factory.js';
const CreateAnalysisSessionSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    session_type: z.string().optional(),
    status: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
});
const UpdateAnalysisSessionSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    session_type: z.string().optional(),
    status: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
    results: z.record(z.unknown()).optional(),
    findings_count: z.number().int().optional(),
    participants_count: z.number().int().optional(),
});
const router = Router();
router.use(requireTenant);
/**
 * GET /analysis-sessions
 * List all analysis sessions for the current tenant
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, session_type, limit = '50', offset = '0' } = req.query;
    let query = `
      SELECT
        id,
        name,
        description,
        session_type AS type,
        status,
        parameters,
        results,
        findings_count AS findings,
        participants_count AS participants,
        created_at AS date,
        created_by,
        updated_at
      FROM analysis_sessions
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `;
    const params = [tenantId];
    let paramIdx = 2;
    if (status && typeof status === 'string') {
        query += ` AND status = $${paramIdx++}`;
        params.push(status);
    }
    if (session_type && typeof session_type === 'string') {
        query += ` AND session_type = $${paramIdx++}`;
        params.push(session_type);
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(Number(limit), Number(offset));
    const result = await req.dbClient.query(query, params);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /analysis-sessions/:id
 * Get a single analysis session by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query(`
      SELECT
        id, name, description, session_type AS type, status,
        parameters, results, findings_count AS findings,
        participants_count AS participants,
        created_at AS date, created_by, updated_at
      FROM analysis_sessions
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Analysis session not found');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /analysis-sessions
 * Create a new analysis session
 */
router.post('/', validate(CreateAnalysisSessionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, session_type, status, parameters } = req.body;
    const userId = req.user?.userId || null;
    const result = await req.dbClient.query(`
      INSERT INTO analysis_sessions (tenant_id, name, description, session_type, status, parameters, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, description, session_type AS type, status,
                parameters, results, findings_count AS findings,
                participants_count AS participants,
                created_at AS date, created_by, updated_at
      `, [
        tenantId,
        name,
        description || null,
        session_type || 'performance',
        status || 'draft',
        parameters ? JSON.stringify(parameters) : '{}',
        userId,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PUT /analysis-sessions/:id
 * Update an analysis session
 */
router.put('/:id', validate(UpdateAnalysisSessionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { name, description, session_type, status, parameters, results, findings_count, participants_count, } = req.body;
    const result = await req.dbClient.query(`
      UPDATE analysis_sessions
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        session_type = COALESCE($5, session_type),
        status = COALESCE($6, status),
        parameters = COALESCE($7, parameters),
        results = COALESCE($8, results),
        findings_count = COALESCE($9, findings_count),
        participants_count = COALESCE($10, participants_count)
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      RETURNING id, name, description, session_type AS type, status,
                parameters, results, findings_count AS findings,
                participants_count AS participants,
                created_at AS date, created_by, updated_at
      `, [
        id,
        tenantId,
        name || null,
        description !== undefined ? description : null,
        session_type || null,
        status || null,
        parameters ? JSON.stringify(parameters) : null,
        results ? JSON.stringify(results) : null,
        findings_count !== undefined ? findings_count : null,
        participants_count !== undefined ? participants_count : null,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Analysis session not found');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * DELETE /analysis-sessions/:id
 * Soft-delete an analysis session
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query(`
      UPDATE analysis_sessions
      SET deleted_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      RETURNING id
      `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Analysis session not found');
    }
    res.json({ success: true, data: { id, deleted: true } });
}));
export default router;
//# sourceMappingURL=analysis-sessions.js.map