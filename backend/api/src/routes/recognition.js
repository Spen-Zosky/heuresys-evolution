/**
 * Recognition Routes
 * Employee recognition and kudos management
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createRecognitionSchema, updateRecognitionSchema, } from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /recognition
 * List recognition entries with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM recognition WHERE tenant_id = $1`, [
            tenantId,
        ]),
        req.dbClient.query(`SELECT r.id, r.from_employee_id, r.to_employee_id, r.message, r.category,
                r.is_public, r.badge_type, r.core_value, r.points_awarded, r.created_at,
                giver.first_name as giver_first_name, giver.last_name as giver_last_name,
                rcvr.first_name as receiver_first_name, rcvr.last_name as receiver_last_name
         FROM recognition r
         LEFT JOIN employees giver ON r.from_employee_id = giver.id
         LEFT JOIN employees rcvr ON r.to_employee_id = rcvr.id
         WHERE r.tenant_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`, [tenantId, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
/**
 * GET /recognition/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_public = true) as public_count,
        COUNT(*) FILTER (WHERE is_public = false) as private_count,
        COUNT(DISTINCT from_employee_id) as unique_givers,
        COUNT(DISTINCT to_employee_id) as unique_receivers,
        COALESCE(SUM(points_awarded), 0) as total_points
      FROM recognition WHERE tenant_id = $1
    `, [tenantId]);
    // Get recognition by time period
    const timeStats = await req.dbClient.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days') as last_90d
      FROM recognition WHERE tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            ...(timeStats.rows[0] || {}),
        },
    });
}));
/**
 * GET /recognition/categories
 * Get recognition categories breakdown
 */
router.get('/categories', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(points_awarded), 0) as total_points
      FROM recognition
      WHERE tenant_id = $1 AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /recognition/badges
 * Get badge types breakdown
 */
router.get('/badges', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT badge_type, COUNT(*) as count
      FROM recognition
      WHERE tenant_id = $1 AND badge_type IS NOT NULL
      GROUP BY badge_type
      ORDER BY count DESC
    `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /recognition/leaderboard
 * Get top receivers of recognition
 */
router.get('/leaderboard', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { period = '30', limit = '10' } = req.query;
    const result = await req.dbClient.query(`
      SELECT
        r.to_employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        COUNT(*) as recognition_count,
        COALESCE(SUM(r.points_awarded), 0) as total_points
      FROM recognition r
      LEFT JOIN employees e ON r.to_employee_id = e.id
      WHERE r.tenant_id = $1
        AND r.created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY r.to_employee_id, e.first_name, e.last_name
      ORDER BY recognition_count DESC
      LIMIT $3
    `, [tenantId, parseInt(period), safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /recognition/recent
 * Get recent public recognitions
 */
router.get('/recent', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '20' } = req.query;
    const result = await req.dbClient.query(`
      SELECT r.*,
        giver.first_name || ' ' || giver.last_name as giver_name,
        receiver.first_name || ' ' || receiver.last_name as receiver_name
      FROM recognition r
      LEFT JOIN employees giver ON r.from_employee_id = giver.id
      LEFT JOIN employees receiver ON r.to_employee_id = receiver.id
      WHERE r.tenant_id = $1 AND r.is_public = true
      ORDER BY r.created_at DESC
      LIMIT $2
    `, [tenantId, safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /recognition
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { from_employee_id, to_employee_id, category, badge_type, is_public, limit = '100', offset = '0', } = req.query;
    let query = `
      SELECT r.*,
        giver.first_name || ' ' || giver.last_name as giver_name,
        receiver.first_name || ' ' || receiver.last_name as receiver_name
      FROM recognition r
      LEFT JOIN employees giver ON r.from_employee_id = giver.id
      LEFT JOIN employees receiver ON r.to_employee_id = receiver.id
      WHERE r.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (from_employee_id) {
        query += ` AND r.from_employee_id = $${paramIndex}`;
        params.push(from_employee_id);
        paramIndex++;
    }
    if (to_employee_id) {
        query += ` AND r.to_employee_id = $${paramIndex}`;
        params.push(to_employee_id);
        paramIndex++;
    }
    if (category) {
        query += ` AND r.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    if (badge_type) {
        query += ` AND r.badge_type = $${paramIndex}`;
        params.push(badge_type);
        paramIndex++;
    }
    if (is_public !== undefined) {
        query += ` AND r.is_public = $${paramIndex}`;
        params.push(is_public === 'true');
        paramIndex++;
    }
    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM recognition WHERE tenant_id = $1', [tenantId]);
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
 * GET /recognition/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT r.*,
        giver.first_name || ' ' || giver.last_name as giver_name,
        giver.email as giver_email,
        receiver.first_name || ' ' || receiver.last_name as receiver_name,
        receiver.email as receiver_email
      FROM recognition r
      LEFT JOIN employees giver ON r.from_employee_id = giver.id
      LEFT JOIN employees receiver ON r.to_employee_id = receiver.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Recognition');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /recognition/employee/:employeeId/given
 * Get recognitions given by an employee
 */
router.get('/employee/:employeeId/given', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { limit = '50' } = req.query;
    const result = await req.dbClient.query(`
      SELECT r.*,
        receiver.first_name || ' ' || receiver.last_name as receiver_name
      FROM recognition r
      LEFT JOIN employees receiver ON r.to_employee_id = receiver.id
      WHERE r.tenant_id = $1 AND r.from_employee_id = $2
      ORDER BY r.created_at DESC
      LIMIT $3
    `, [tenantId, employeeId, safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /recognition/employee/:employeeId/received
 * Get recognitions received by an employee
 */
router.get('/employee/:employeeId/received', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { limit = '50' } = req.query;
    const result = await req.dbClient.query(`
      SELECT r.*,
        giver.first_name || ' ' || giver.last_name as giver_name
      FROM recognition r
      LEFT JOIN employees giver ON r.from_employee_id = giver.id
      WHERE r.tenant_id = $1 AND r.to_employee_id = $2
      ORDER BY r.created_at DESC
      LIMIT $3
    `, [tenantId, employeeId, safeParseInt(limit, { fallback: 50 })]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /recognition
 */
router.post('/', validate(createRecognitionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { from_employee_id, to_employee_id, message, category, badge_type, core_value, is_public = true, points_awarded = 0, } = req.body;
    if (!to_employee_id || !message) {
        throw Errors.badRequest('to_employee_id and message are required');
    }
    // Verify receiver belongs to tenant
    const receiverCheck = await req.dbClient.query('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [to_employee_id, tenantId]);
    if (receiverCheck.rows.length === 0) {
        throw Errors.badRequest('Invalid receiver employee');
    }
    const result = await req.dbClient.query(`
      INSERT INTO recognition (tenant_id, from_employee_id, to_employee_id, message, category,
        badge_type, core_value, is_public, points_awarded, giver_id, receiver_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $2, $3, NOW())
      RETURNING *
    `, [
        tenantId,
        from_employee_id,
        to_employee_id,
        message,
        category,
        badge_type,
        core_value,
        is_public,
        points_awarded,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Recognition created' });
}));
/**
 * PATCH /recognition/:id
 */
router.patch('/:id', validate(updateRecognitionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM recognition WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Recognition');
    }
    const allowedFields = [
        'message',
        'category',
        'badge_type',
        'core_value',
        'is_public',
        'points_awarded',
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
    const result = await req.dbClient.query(`UPDATE recognition SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Recognition updated' });
}));
/**
 * DELETE /recognition/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM recognition WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Recognition');
    }
    res.json({ success: true, message: 'Recognition deleted' });
}));
export default router;
//# sourceMappingURL=recognition.js.map