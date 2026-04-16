/**
 * Learning Paths Routes
 * CRUD operations for learning paths
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createLearningPathSchema, updateLearningPathSchema } from '../schemas/learning.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { cachedForTenant, CACHE_TTL } from '../services/cache.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /learning-paths/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_paths,
        COUNT(*) FILTER (WHERE is_active = true) as active_paths,
        COUNT(*) FILTER (WHERE is_mandatory = true) as mandatory_paths,
        ROUND(AVG(estimated_duration_hours), 1) as avg_hours
      FROM learning_paths WHERE tenant_id = $1
    `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /learning-paths
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { is_active, target_role, skill_level, is_mandatory, limit = '100', offset = '0', } = req.query;
    // Validate and sanitize numeric inputs
    const limitNum = safeParseInt(limit, { fallback: 100, min: 1, max: 1000 });
    const offsetNum = Math.max(0, safeParseInt(offset, { fallback: 0 }));
    const hasFilters = is_active !== undefined || target_role || skill_level || is_mandatory !== undefined;
    const fetchData = async () => {
        let query = `
        SELECT lp.*,
          (SELECT COUNT(*) FROM learning_path_courses lpc WHERE lpc.learning_path_id = lp.id) as course_count,
          (SELECT COUNT(*) FROM learning_path_enrollments lpe WHERE lpe.learning_path_id = lp.id) as enrollment_count
        FROM learning_paths lp
        WHERE lp.tenant_id = $1
      `;
        const params = [tenantId];
        let paramIndex = 2;
        if (is_active !== undefined) {
            query += ` AND lp.is_active = $${paramIndex}`;
            params.push(is_active === 'true');
            paramIndex++;
        }
        if (target_role) {
            query += ` AND lp.target_role = $${paramIndex}`;
            params.push(target_role);
            paramIndex++;
        }
        if (skill_level) {
            query += ` AND lp.skill_level = $${paramIndex}`;
            params.push(skill_level);
            paramIndex++;
        }
        if (is_mandatory !== undefined) {
            query += ` AND lp.is_mandatory = $${paramIndex}`;
            params.push(is_mandatory === 'true');
            paramIndex++;
        }
        query += ` ORDER BY lp.title LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limitNum, offsetNum);
        const result = await req.dbClient.query(query, params);
        const countResult = await req.dbClient.query('SELECT COUNT(*) FROM learning_paths WHERE tenant_id = $1', [tenantId]);
        return {
            rows: result.rows,
            total: safeParseInt(countResult.rows[0]?.count, { fallback: 0 }),
        };
    };
    const data = hasFilters
        ? await fetchData()
        : await cachedForTenant(tenantId, `learning-paths:list:${limitNum}:${offsetNum}`, fetchData, CACHE_TTL.MODERATE);
    res.json({
        success: true,
        data: data.rows,
        meta: {
            total: data.total,
            limit: limitNum,
            offset: offsetNum,
        },
    });
}));
/**
 * GET /learning-paths/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT lp.*,
        (SELECT COUNT(*) FROM learning_path_courses lpc WHERE lpc.learning_path_id = lp.id) as course_count,
        (SELECT COUNT(*) FROM learning_path_enrollments lpe WHERE lpe.learning_path_id = lp.id) as enrollment_count,
        (SELECT COUNT(*) FROM learning_path_enrollments lpe WHERE lpe.learning_path_id = lp.id AND lpe.status = 'completed') as completed_count
      FROM learning_paths lp
      WHERE lp.id = $1 AND lp.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Learning path');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /learning-paths/:id/courses
 */
router.get('/:id/courses', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT c.id, c.code, c.title, c.description, c.duration_hours, c.category, c.skill_level,
        lpc.sequence_order, lpc.is_mandatory
      FROM learning_path_courses lpc
      JOIN courses c ON lpc.course_id = c.id
      WHERE lpc.learning_path_id = $1 AND c.tenant_id = $2
      ORDER BY lpc.sequence_order
    `, [id, tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /learning-paths
 */
router.post('/', validate(createLearningPathSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { code, title, title_en, description, target_role, skills_gained, total_hours, skill_level, path_type, is_mandatory = false, is_active = true, created_by, } = req.body;
    if (!title) {
        throw Errors.badRequest('Title is required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO learning_paths (tenant_id, code, title, title_en, description, target_role, skills_gained,
        total_hours, skill_level, path_type, is_mandatory, is_active, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        code,
        title,
        title_en,
        description,
        target_role,
        skills_gained,
        total_hours,
        skill_level,
        path_type,
        is_mandatory,
        is_active,
        created_by,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Learning path created' });
}));
/**
 * PATCH /learning-paths/:id
 */
router.patch('/:id', validate(updateLearningPathSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM learning_paths WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Learning path');
    }
    const allowedFields = [
        'title',
        'title_en',
        'description',
        'target_role',
        'skills_gained',
        'total_hours',
        'skill_level',
        'path_type',
        'is_mandatory',
        'is_active',
    ];
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
    const result = await req.dbClient.query(`UPDATE learning_paths SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Learning path updated' });
}));
/**
 * DELETE /learning-paths/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('UPDATE learning_paths SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Learning path');
    }
    res.json({ success: true, message: 'Learning path deactivated' });
}));
export default router;
//# sourceMappingURL=learning-paths.js.map