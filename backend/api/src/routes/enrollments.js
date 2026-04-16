/**
 * Enrollments Routes
 * CRUD operations for course enrollments
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { withTransaction } from '../utils/transaction.js';
import { validate } from '../middleware/validate.js';
import { createEnrollmentSchema, updateEnrollmentSchema, completeEnrollmentSchema, } from '../schemas/skills-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /enrollments/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ce.status = 'enrolled') as enrolled,
        COUNT(*) FILTER (WHERE ce.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE ce.status = 'completed') as completed,
        ROUND(AVG(ce.progress_percent), 1) as avg_progress,
        ROUND(AVG(ce.score), 1) as avg_score
      FROM course_enrollments ce
      JOIN employees e ON ce.employee_id = e.id
      WHERE e.tenant_id = $1
    `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /enrollments
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, course_id, status, limit = '100', offset = '0', } = req.query;
    let query = `
      SELECT ce.*,
        e.first_name || ' ' || e.last_name as employee_name,
        c.title as course_title,
        c.category as course_category
      FROM course_enrollments ce
      JOIN employees e ON ce.employee_id = e.id
      JOIN courses c ON ce.course_id = c.id
      WHERE e.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (employee_id) {
        query += ` AND ce.employee_id = $${paramIndex}`;
        params.push(employee_id);
        paramIndex++;
    }
    if (course_id) {
        query += ` AND ce.course_id = $${paramIndex}`;
        params.push(course_id);
        paramIndex++;
    }
    if (status) {
        query += ` AND ce.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY ce.enrolled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    // Count query reuses the same WHERE filters (params before limit/offset)
    const countParams = params.slice(0, -2);
    const countQuery = query
        .replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
        .replace(/ORDER BY[\s\S]*$/, '');
    const countResult = await req.dbClient.query(countQuery, countParams);
    const total = safeParseInt(countResult.rows[0]?.total, { fallback: 0 });
    const parsedLimit = safeParseInt(limit, { fallback: 100 });
    const parsedOffset = safeParseInt(offset, { fallback: 0 });
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total,
            limit: parsedLimit,
            offset: parsedOffset,
            hasMore: parsedOffset + result.rows.length < total,
        },
    });
}));
/**
 * GET /enrollments/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT ce.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        c.title as course_title,
        c.description as course_description,
        c.duration_hours,
        c.category as course_category
      FROM course_enrollments ce
      JOIN employees e ON ce.employee_id = e.id
      JOIN courses c ON ce.course_id = c.id
      WHERE ce.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Enrollment');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /enrollments
 */
router.post('/', validate(createEnrollmentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, course_id, due_date, enrolled_by, enrollment_source = 'manual', } = req.body;
    if (!employee_id || !course_id) {
        throw Errors.badRequest('employee_id and course_id are required');
    }
    // Verify employee belongs to tenant
    const employeeCheck = await req.dbClient.query('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [employee_id, tenantId]);
    if (employeeCheck.rows.length === 0) {
        throw Errors.badRequest('Invalid employee');
    }
    // Check for existing enrollment
    const existingEnrollment = await req.dbClient.query("SELECT id FROM course_enrollments WHERE employee_id = $1 AND course_id = $2 AND status NOT IN ('cancelled', 'completed')", [employee_id, course_id]);
    if (existingEnrollment.rows.length > 0) {
        throw Errors.conflict('Employee already enrolled in this course');
    }
    const result = await withTransaction(async (client) => {
        const insertResult = await client.query(`
        INSERT INTO course_enrollments (employee_id, course_id, enrolled_at, enrolled_by, enrollment_source,
          status, progress_percent, due_date, attempts, created_at, updated_at)
        VALUES ($1, $2, NOW(), $3, $4, 'enrolled', 0, $5, 0, NOW(), NOW())
        RETURNING *
      `, [employee_id, course_id, enrolled_by, enrollment_source, due_date]);
        return insertResult.rows[0];
    }, tenantId);
    res.status(201).json({ success: true, data: result, message: 'Employee enrolled' });
}));
/**
 * PATCH /enrollments/:id
 */
router.patch('/:id', validate(updateEnrollmentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify enrollment exists for tenant
    const existing = await req.dbClient.query(`
      SELECT ce.id FROM course_enrollments ce
      JOIN employees e ON ce.employee_id = e.id
      WHERE ce.id = $1 AND e.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Enrollment');
    }
    const allowedFields = [
        'status',
        'progress_percent',
        'score',
        'passed',
        'due_date',
        'time_spent_minutes',
        'notes',
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
    // Auto-set timestamps
    if (req.body.status === 'in_progress') {
        updates.push(`started_at = COALESCE(started_at, NOW())`);
    }
    if (req.body.status === 'completed') {
        updates.push(`completed_at = NOW()`);
        updates.push(`progress_percent = 100`);
    }
    updates.push(`last_accessed_at = NOW()`);
    if (updates.length === 1) {
        // Only last_accessed_at
        throw Errors.badRequest('No fields to update');
    }
    updates.push('updated_at = NOW()');
    const result = await req.dbClient.query(`UPDATE course_enrollments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, [...values, id]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Enrollment updated' });
}));
/**
 * POST /enrollments/:id/complete
 */
router.post('/:id/complete', validate(completeEnrollmentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { score, passed = true } = req.body;
    const result = await req.dbClient.query(`
      UPDATE course_enrollments SET
        status = 'completed',
        progress_percent = 100,
        completed_at = NOW(),
        score = $1,
        passed = $2,
        updated_at = NOW()
      WHERE id = $3
      AND employee_id IN (SELECT id FROM employees WHERE tenant_id = $4)
      RETURNING *
    `, [score, passed, id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Enrollment');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Course completed' });
}));
/**
 * DELETE /enrollments/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE course_enrollments SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      AND employee_id IN (SELECT id FROM employees WHERE tenant_id = $2)
      RETURNING id, course_id
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Enrollment');
    }
    res.json({ success: true, message: 'Enrollment cancelled' });
}));
export default router;
//# sourceMappingURL=enrollments.js.map