/**
 * Continuous Feedback Routes
 * CRUD operations for continuous_feedback within tenant context
 * Schema verified: id, tenant_id, from_employee_id, to_employee_id,
 *   feedback_type, message, is_private, related_goal_id, created_at,
 *   competency_id, sentiment_score, acknowledged, acknowledged_at,
 *   visibility, tags, category, performance_review_id
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors/middleware.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { safeParseInt } from '../utils/query-helpers.js';
const CreateFeedbackSchema = z.object({
    from_employee_id: z.string().uuid(),
    to_employee_id: z.string().uuid(),
    message: z.string().min(1),
    feedback_type: z.string().optional(),
    is_private: z.boolean().optional(),
    related_goal_id: z.string().uuid().optional(),
    competency_id: z.string().uuid().optional(),
    sentiment_score: z.number().optional(),
    visibility: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    performance_review_id: z.string().uuid().optional(),
});
const UpdateFeedbackSchema = z.object({
    feedback_type: z.string().optional(),
    message: z.string().min(1).optional(),
    is_private: z.boolean().optional(),
    related_goal_id: z.string().uuid().optional(),
    competency_id: z.string().uuid().optional(),
    sentiment_score: z.number().optional(),
    acknowledged: z.boolean().optional(),
    acknowledged_at: z.string().optional(),
    visibility: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    performance_review_id: z.string().uuid().optional(),
});
const router = Router();
router.use(requireTenant);
/**
 * GET /api/v1/continuous-feedback
 * List all feedback for the current tenant (paginated)
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '50', offset = '0', to_employee_id, from_employee_id, feedback_type, category, } = req.query;
    let query = `
      SELECT
        cf.id, cf.tenant_id, cf.from_employee_id, cf.to_employee_id,
        cf.feedback_type, cf.message, cf.is_private, cf.related_goal_id,
        cf.created_at, cf.competency_id, cf.sentiment_score,
        cf.acknowledged, cf.acknowledged_at, cf.visibility,
        cf.tags, cf.category, cf.performance_review_id,
        fe.first_name || ' ' || fe.last_name AS from_employee_name,
        te.first_name || ' ' || te.last_name AS to_employee_name
      FROM continuous_feedback cf
      LEFT JOIN employees fe ON cf.from_employee_id = fe.id
      LEFT JOIN employees te ON cf.to_employee_id = te.id
      WHERE cf.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (to_employee_id) {
        query += ` AND cf.to_employee_id = $${paramIndex}`;
        params.push(to_employee_id);
        paramIndex++;
    }
    if (from_employee_id) {
        query += ` AND cf.from_employee_id = $${paramIndex}`;
        params.push(from_employee_id);
        paramIndex++;
    }
    if (feedback_type) {
        query += ` AND cf.feedback_type = $${paramIndex}`;
        params.push(feedback_type);
        paramIndex++;
    }
    if (category) {
        query += ` AND cf.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    const MAX_LIMIT = 500;
    const parsedLimit = Math.min(safeParseInt(limit, { fallback: 50 }), MAX_LIMIT);
    const parsedOffset = safeParseInt(offset, { fallback: 0 });
    query += ` ORDER BY cf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parsedLimit, parsedOffset);
    const countQuery = `SELECT COUNT(*) FROM continuous_feedback WHERE tenant_id = $1`;
    const [result, countResult] = await Promise.all([
        req.dbClient.query(query, params),
        req.dbClient.query(countQuery, [tenantId]),
    ]);
    const total = parseInt(countResult.rows[0]?.count);
    res.json({
        success: true,
        data: {
            items: result.rows,
            meta: {
                total,
                limit: parsedLimit,
                offset: parsedOffset,
            },
        },
    });
}));
/**
 * POST /api/v1/continuous-feedback
 * Create new feedback
 */
router.post('/', validate(CreateFeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { from_employee_id, to_employee_id, feedback_type, message, is_private, related_goal_id, competency_id, sentiment_score, visibility, tags, category, performance_review_id, } = req.body;
    const query = `
      INSERT INTO continuous_feedback (
        tenant_id, from_employee_id, to_employee_id, feedback_type,
        message, is_private, related_goal_id, competency_id,
        sentiment_score, visibility, tags, category, performance_review_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const result = await req.dbClient.query(query, [
        tenantId,
        from_employee_id,
        to_employee_id,
        feedback_type || null,
        message,
        is_private ?? false,
        related_goal_id || null,
        competency_id || null,
        sentiment_score || null,
        visibility || null,
        tags || null,
        category || null,
        performance_review_id || null,
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * GET /api/v1/continuous-feedback/:id
 * Get single feedback by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const query = `
      SELECT
        cf.*,
        fe.first_name || ' ' || fe.last_name AS from_employee_name,
        te.first_name || ' ' || te.last_name AS to_employee_name
      FROM continuous_feedback cf
      LEFT JOIN employees fe ON cf.from_employee_id = fe.id
      LEFT JOIN employees te ON cf.to_employee_id = te.id
      WHERE cf.id = $1 AND cf.tenant_id = $2
    `;
    const result = await req.dbClient.query(query, [id, tenantId]);
    if (result.rows.length === 0) {
        res.status(404).json({
            success: false,
            error: { message: 'Feedback not found' },
        });
        return;
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * PUT /api/v1/continuous-feedback/:id
 * Update feedback
 */
router.put('/:id', validate(UpdateFeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { feedback_type, message, is_private, related_goal_id, competency_id, sentiment_score, acknowledged, acknowledged_at, visibility, tags, category, performance_review_id, } = req.body;
    const query = `
      UPDATE continuous_feedback SET
        feedback_type = COALESCE($3, feedback_type),
        message = COALESCE($4, message),
        is_private = COALESCE($5, is_private),
        related_goal_id = COALESCE($6, related_goal_id),
        competency_id = COALESCE($7, competency_id),
        sentiment_score = COALESCE($8, sentiment_score),
        acknowledged = COALESCE($9, acknowledged),
        acknowledged_at = COALESCE($10, acknowledged_at),
        visibility = COALESCE($11, visibility),
        tags = COALESCE($12, tags),
        category = COALESCE($13, category),
        performance_review_id = COALESCE($14, performance_review_id)
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;
    const result = await req.dbClient.query(query, [
        id,
        tenantId,
        feedback_type ?? null,
        message ?? null,
        is_private ?? null,
        related_goal_id ?? null,
        competency_id ?? null,
        sentiment_score ?? null,
        acknowledged ?? null,
        acknowledged_at ?? null,
        visibility ?? null,
        tags ?? null,
        category ?? null,
        performance_review_id ?? null,
    ]);
    if (result.rows.length === 0) {
        res.status(404).json({
            success: false,
            error: { message: 'Feedback not found' },
        });
        return;
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * DELETE /api/v1/continuous-feedback/:id
 * Delete feedback
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query('DELETE FROM continuous_feedback WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        res.status(404).json({
            success: false,
            error: { message: 'Feedback not found' },
        });
        return;
    }
    res.json({
        success: true,
        data: { id: result.rows[0]?.id, deleted: true },
    });
}));
export default router;
//# sourceMappingURL=continuous-feedback.js.map