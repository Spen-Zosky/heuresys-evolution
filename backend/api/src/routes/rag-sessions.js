/**
 * RAG Sessions Routes
 * AI chat sessions management
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createRagSessionSchema, updateRagSessionSchema, } from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /rag-sessions/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_archived = false) as active,
        COUNT(*) FILTER (WHERE is_archived = true) as archived,
        COUNT(DISTINCT user_id) as unique_users
      FROM rag_sessions WHERE tenant_id = $1
    `, [tenantId]);
    // Get provider breakdown
    const providers = await req.dbClient.query(`
      SELECT provider, COUNT(*) as count
      FROM rag_sessions
      WHERE tenant_id = $1
      GROUP BY provider
      ORDER BY count DESC
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            providers: providers.rows,
        },
    });
}));
/**
 * GET /rag-sessions
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { user_id, provider, is_archived, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT rs.*,
        e.first_name || ' ' || e.last_name as user_name,
        (SELECT COUNT(*) FROM rag_messages rm WHERE rm.session_id = rs.id) as message_count
      FROM rag_sessions rs
      LEFT JOIN employees e ON rs.user_id_employee_id = e.id
      WHERE rs.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (user_id) {
        query += ` AND rs.user_id = $${paramIndex}`;
        params.push(user_id);
        paramIndex++;
    }
    if (provider) {
        query += ` AND rs.provider = $${paramIndex}`;
        params.push(provider);
        paramIndex++;
    }
    if (is_archived !== undefined) {
        query += ` AND rs.is_archived = $${paramIndex}`;
        params.push(is_archived === 'true');
        paramIndex++;
    }
    query += ` ORDER BY rs.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM rag_sessions WHERE tenant_id = $1', [tenantId]);
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
 * GET /rag-sessions/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT rs.*,
        e.first_name || ' ' || e.last_name as user_name
      FROM rag_sessions rs
      LEFT JOIN employees e ON rs.user_id_employee_id = e.id
      WHERE rs.id = $1 AND rs.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Session');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /rag-sessions/:id/messages
 * Get messages for a session
 */
router.get('/:id/messages', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { limit = '100' } = req.query;
    // Verify session belongs to tenant
    const session = await req.dbClient.query('SELECT id FROM rag_sessions WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (session.rows.length === 0) {
        throw Errors.notFound('Session');
    }
    const result = await req.dbClient.query(`
      SELECT id, session_id, role, content, sources, generated_sql, sql_result,
        tokens_input, tokens_output, created_at, confidence_score, confidence_factors,
        requires_escalation, escalation_reason, escalated_at, escalated_to,
        human_response, human_responded_at, feedback_rating, feedback_comment
      FROM rag_messages
      WHERE session_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `, [id, safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /rag-sessions
 */
router.post('/', validate(createRagSessionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { user_id, user_id_employee_id, provider, model, title, system_prompt, sources_enabled } = req.body;
    if (!provider) {
        throw Errors.badRequest('Provider is required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO rag_sessions (tenant_id, user_id, user_id_employee_id, provider, model, title,
        system_prompt, sources_enabled, is_archived, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        user_id,
        user_id_employee_id,
        provider,
        model,
        title,
        system_prompt,
        sources_enabled || ['db', 'documents'],
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Session created' });
}));
/**
 * PATCH /rag-sessions/:id
 */
router.patch('/:id', validate(updateRagSessionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM rag_sessions WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Session');
    }
    const allowedFields = ['title', 'system_prompt', 'sources_enabled', 'is_archived'];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(req.body[field]);
            paramIndex++;
        }
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    updates.push('updated_at = NOW()');
    const result = await req.dbClient.query(`UPDATE rag_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Session updated' });
}));
/**
 * POST /rag-sessions/:id/archive
 */
router.post('/:id/archive', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE rag_sessions SET is_archived = true, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Session');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Session archived' });
}));
/**
 * DELETE /rag-sessions/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM rag_sessions WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Session');
    }
    res.json({ success: true, message: 'Session deleted' });
}));
export default router;
//# sourceMappingURL=rag-sessions.js.map