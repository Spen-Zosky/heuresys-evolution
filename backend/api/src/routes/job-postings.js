/**
 * Internal Job Postings Routes
 * CRUD operations for internal job postings
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createJobPostingSchema, updateJobPostingSchema, } from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /job-postings
 * List internal job postings with pagination
 */
router.get('/', requirePermission('RECRUITMENT', 'VIEW'), applyScopeFilter('RECRUITMENT'), asyncHandler(async (req, res) => {
    getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const status = req.query.status;
    const scope = getScopeCondition(req, 'ijp');
    let whereClause = `WHERE ${scope.where}`;
    const params = [...scope.params];
    if (status) {
        params.push(status);
        whereClause += ` AND ijp.status = $${params.length}`;
    }
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM internal_job_postings ijp ${whereClause}`, params),
        req.dbClient.query(`SELECT ijp.id, ijp.title, ijp.status, ijp.department, ijp.location,
                ijp.work_type, ijp.job_level, ijp.job_family, ijp.views_count,
                ijp.applications_count, ijp.posted_at, ijp.expires_at, ijp.created_at
         FROM internal_job_postings ijp
         ${whereClause}
         ORDER BY ijp.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
/**
 * GET /job-postings/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'published') as published,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'closed') as closed,
      SUM(views_count) as total_views,
      SUM(applications_count) as total_applications
    FROM internal_job_postings WHERE tenant_id = $1
  `, [tenantId]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * GET /job-postings/active
 */
router.get('/active', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
    SELECT jp.*,
      hm.first_name || ' ' || hm.last_name as hiring_manager_name
    FROM internal_job_postings jp
    LEFT JOIN employees hm ON jp.hiring_manager_id = hm.id
    WHERE jp.tenant_id = $1
      AND jp.status = 'published'
      AND (jp.expires_at IS NULL OR jp.expires_at > NOW())
    ORDER BY jp.posted_at DESC
  `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /job-postings
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, department, location, job_level, search, limit = '100', offset = '0', } = req.query;
    let query = `
    SELECT jp.*,
      hm.first_name || ' ' || hm.last_name as hiring_manager_name
    FROM internal_job_postings jp
    LEFT JOIN employees hm ON jp.hiring_manager_id = hm.id
    WHERE jp.tenant_id = $1
  `;
    const params = [tenantId];
    let paramIndex = 2;
    if (status) {
        query += ` AND jp.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    if (department) {
        query += ` AND jp.department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
    }
    if (location) {
        query += ` AND jp.location = $${paramIndex}`;
        params.push(location);
        paramIndex++;
    }
    if (job_level) {
        query += ` AND jp.job_level = $${paramIndex}`;
        params.push(job_level);
        paramIndex++;
    }
    if (search) {
        query += ` AND (jp.title ILIKE $${paramIndex} OR jp.summary ILIKE $${paramIndex})`;
        params.push(`%${escapeILIKE(search)}%`);
        paramIndex++;
    }
    query += ` ORDER BY jp.posted_at DESC NULLS LAST, jp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM internal_job_postings WHERE tenant_id = $1', [tenantId]);
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
 * GET /job-postings/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
    SELECT jp.*,
      hm.first_name || ' ' || hm.last_name as hiring_manager_name,
      hm.email as hiring_manager_email,
      hr.first_name || ' ' || hr.last_name as hr_contact_name
    FROM internal_job_postings jp
    LEFT JOIN employees hm ON jp.hiring_manager_id = hm.id
    LEFT JOIN employees hr ON jp.hr_contact_id = hr.id
    WHERE jp.id = $1 AND jp.tenant_id = $2
  `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Job posting', id);
    }
    // Increment view count
    await req.dbClient.query('UPDATE internal_job_postings SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1', [id]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /job-postings
 */
router.post('/', requirePermission('RECRUITMENT', 'CREATE'), validate(createJobPostingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { title, department, team, location, work_type, summary, responsibilities, requirements, nice_to_have, job_level, job_family, salary_min, salary_max, currency = 'EUR', show_salary = false, visibility = 'internal', min_tenure_months, min_rating, required_skills, expires_at, target_start_date, hiring_manager_id, hr_contact_id, created_by, } = req.body;
    if (!title) {
        throw Errors.badRequest('Title is required');
    }
    const result = await req.dbClient.query(`
    INSERT INTO internal_job_postings (tenant_id, title, department, team, location, work_type, summary,
      responsibilities, requirements, nice_to_have, job_level, job_family, salary_min, salary_max, currency,
      show_salary, status, visibility, min_tenure_months, min_rating, required_skills, expires_at,
      target_start_date, hiring_manager_id, hr_contact_id, views_count, applications_count, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17, $18, $19, $20,
      $21, $22, $23, $24, 0, 0, $25, NOW(), NOW())
    RETURNING *
  `, [
        tenantId,
        title,
        department,
        team,
        location,
        work_type,
        summary,
        responsibilities,
        requirements,
        nice_to_have,
        job_level,
        job_family,
        salary_min,
        salary_max,
        currency,
        show_salary,
        visibility,
        min_tenure_months,
        min_rating,
        required_skills,
        expires_at,
        target_start_date,
        hiring_manager_id,
        hr_contact_id,
        created_by,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Job posting created' });
}));
/**
 * PATCH /job-postings/:id
 */
router.patch('/:id', requirePermission('RECRUITMENT', 'EDIT'), validate(updateJobPostingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM internal_job_postings WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Job posting', id);
    }
    const allowedFields = [
        'title',
        'department',
        'team',
        'location',
        'work_type',
        'summary',
        'responsibilities',
        'requirements',
        'nice_to_have',
        'job_level',
        'job_family',
        'salary_min',
        'salary_max',
        'currency',
        'show_salary',
        'status',
        'visibility',
        'min_tenure_months',
        'min_rating',
        'required_skills',
        'expires_at',
        'target_start_date',
        'hiring_manager_id',
        'hr_contact_id',
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
    // Auto-set posted_at when status changes to published
    if (req.body.status === 'published') {
        updates.push(`posted_at = COALESCE(posted_at, NOW())`);
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    updates.push('updated_at = NOW()');
    const result = await req.dbClient.query(`UPDATE internal_job_postings SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Job posting updated' });
}));
/**
 * POST /job-postings/:id/publish
 */
router.post('/:id/publish', requirePermission('RECRUITMENT', 'EDIT'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
    UPDATE internal_job_postings SET status = 'published', posted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 RETURNING *
  `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Job posting', id);
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Job posting published' });
}));
/**
 * POST /job-postings/:id/close
 */
router.post('/:id/close', requirePermission('RECRUITMENT', 'EDIT'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
    UPDATE internal_job_postings SET status = 'closed', updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 RETURNING *
  `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Job posting', id);
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Job posting closed' });
}));
/**
 * DELETE /job-postings/:id
 */
router.delete('/:id', requirePermission('RECRUITMENT', 'DELETE'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query("UPDATE internal_job_postings SET status = 'archived', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id", [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Job posting', id);
    }
    res.json({ success: true, message: 'Job posting archived' });
}));
export default router;
//# sourceMappingURL=job-postings.js.map