/**
 * Internal Mobility Routes
 * Internal job postings and applications management
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { createJobPostingSchema, updateJobPostingSchema, createApplicationSchema, updateApplicationStatusSchema, } from '../schemas/talent.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /internal-mobility/jobs
 * List internal job postings
 */
router.get('/jobs', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, department, work_type, job_level, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        ijp.*,
        hm.first_name || ' ' || hm.last_name as hiring_manager_name,
        d.name as department_name
      FROM internal_job_postings ijp
      LEFT JOIN employees hm ON hm.id = ijp.hiring_manager_id
      LEFT JOIN org_units d ON d.name = ijp.department
      WHERE ijp.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (status) {
        query += ` AND ijp.status = $${paramIndex++}`;
        params.push(status);
    }
    if (department) {
        query += ` AND ijp.department = $${paramIndex++}`;
        params.push(department);
    }
    if (work_type) {
        query += ` AND ijp.work_type = $${paramIndex++}`;
        params.push(work_type);
    }
    if (job_level) {
        query += ` AND ijp.job_level = $${paramIndex++}`;
        params.push(job_level);
    }
    query += ` ORDER BY ijp.posted_at DESC NULLS LAST, ijp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
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
 * GET /internal-mobility/jobs/:id
 * Get job posting details
 */
router.get('/jobs/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        ijp.*,
        hm.first_name || ' ' || hm.last_name as hiring_manager_name,
        hm.email as hiring_manager_email,
        hr.first_name || ' ' || hr.last_name as hr_contact_name
      FROM internal_job_postings ijp
      LEFT JOIN employees hm ON hm.id = ijp.hiring_manager_id
      LEFT JOIN employees hr ON hr.id = ijp.hr_contact_id
      WHERE ijp.id = $1 AND ijp.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Job posting');
    }
    // Increment views
    await req.dbClient.query('UPDATE internal_job_postings SET views_count = views_count + 1 WHERE id = $1', [id]);
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /internal-mobility/jobs
 * Create new internal job posting
 */
router.post('/jobs', validate(createJobPostingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { title, department, team, location, work_type, summary, responsibilities, requirements, nice_to_have, job_level, job_family, salary_min, salary_max, currency = 'EUR', show_salary = false, visibility = 'all_employees', min_tenure_months, min_rating, required_skills, expires_at, target_start_date, hiring_manager_id, hr_contact_id, created_by_employee_id, } = req.body;
    if (!title || !department) {
        throw Errors.badRequest('title and department are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO internal_job_postings (
        tenant_id, title, department, team, location, work_type,
        summary, responsibilities, requirements, nice_to_have,
        job_level, job_family, salary_min, salary_max, currency,
        show_salary, status, visibility, min_tenure_months, min_rating,
        required_skills, expires_at, target_start_date, hiring_manager_id,
        hr_contact_id, created_by_employee_id, views_count, applications_count,
        posted_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, 'draft', $17, $18, $19, $20, $21, $22, $23, $24, $25, 0, 0,
        NULL, NOW(), NOW()
      )
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
        JSON.stringify(required_skills || []),
        expires_at,
        target_start_date,
        hiring_manager_id,
        hr_contact_id,
        created_by_employee_id,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PATCH /internal-mobility/jobs/:id
 * Update job posting
 */
router.patch('/jobs/:id', validate(updateJobPostingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM internal_job_postings WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Job posting');
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
        'salary_min',
        'salary_max',
        'show_salary',
        'status',
        'visibility',
        'min_tenure_months',
        'min_rating',
        'required_skills',
        'expires_at',
    ];
    const updates = ['updated_at = NOW()'];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            if (field === 'required_skills') {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(JSON.stringify(req.body[field]));
            }
            else {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        }
    }
    // Handle status change to 'open' - set posted_at
    if (req.body.status === 'open') {
        updates.push(`posted_at = COALESCE(posted_at, NOW())`);
    }
    const result = await req.dbClient.query(`UPDATE internal_job_postings SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Job posting updated' });
}));
/**
 * GET /internal-mobility/applications
 * List applications
 */
router.get('/applications', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { job_posting_id, employee_id, status, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        ia.*,
        e.first_name || ' ' || e.last_name as applicant_name,
        e.email as applicant_email,
        ijp.title as job_title,
        ijp.department,
        d.name as applicant_department
      FROM internal_applications ia
      JOIN internal_job_postings ijp ON ijp.id = ia.job_posting_id
      JOIN employees e ON e.id = ia.employee_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE ijp.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (job_posting_id) {
        query += ` AND ia.job_posting_id = $${paramIndex++}`;
        params.push(job_posting_id);
    }
    if (employee_id) {
        query += ` AND ia.employee_id = $${paramIndex++}`;
        params.push(employee_id);
    }
    if (status) {
        query += ` AND ia.status = $${paramIndex++}`;
        params.push(status);
    }
    query += ` ORDER BY ia.submitted_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * GET /internal-mobility/applications/:id
 * Get application details
 */
router.get('/applications/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        ia.*,
        e.first_name || ' ' || e.last_name as applicant_name,
        e.email as applicant_email,
        e.hire_date,
        ijp.title as job_title,
        ijp.department as target_department,
        d.name as current_department,
        mgr.first_name || ' ' || mgr.last_name as current_manager_name
      FROM internal_applications ia
      JOIN internal_job_postings ijp ON ijp.id = ia.job_posting_id
      JOIN employees e ON e.id = ia.employee_id
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      LEFT JOIN employees mgr ON mgr.id = ia.current_manager_id
      WHERE ia.id = $1 AND ijp.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Application');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /internal-mobility/applications
 * Submit application
 */
router.post('/applications', validate(createApplicationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { job_posting_id, employee_id, cover_letter, motivation, relevant_experience, current_manager_id, } = req.body;
    if (!job_posting_id || !employee_id) {
        throw Errors.badRequest('job_posting_id and employee_id are required');
    }
    // Verify job posting exists and is open
    const jobCheck = await req.dbClient.query('SELECT id, required_skills FROM internal_job_postings WHERE id = $1 AND tenant_id = $2 AND status = $3', [job_posting_id, tenantId, 'open']);
    if (jobCheck.rows.length === 0) {
        throw Errors.badRequest('Job posting not found or not open');
    }
    // Check for existing application
    const existingApp = await req.dbClient.query('SELECT id FROM internal_applications WHERE job_posting_id = $1 AND employee_id = $2', [job_posting_id, employee_id]);
    if (existingApp.rows.length > 0) {
        throw Errors.conflict('Already applied to this position');
    }
    // Get employee skills for matching
    const empSkills = await req.dbClient.query('SELECT skill_id FROM employee_skills WHERE employee_id = $1', [employee_id]);
    const empSkillIds = empSkills.rows.map((r) => r.skill_id);
    const reqSkills = jobCheck.rows[0]?.required_skills || [];
    const matchedSkills = reqSkills.filter((s) => empSkillIds.includes(s));
    const matchScore = reqSkills.length > 0 ? Math.round((matchedSkills.length / reqSkills.length) * 100) : null;
    const result = await req.dbClient.query(`
      INSERT INTO internal_applications (
        job_posting_id, employee_id, cover_letter, motivation,
        relevant_experience, matched_skills, skill_match_score,
        status, current_manager_id, submitted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted', $8, NOW(), NOW(), NOW())
      RETURNING *
    `, [
        job_posting_id,
        employee_id,
        cover_letter,
        motivation,
        relevant_experience,
        JSON.stringify(matchedSkills),
        matchScore,
        current_manager_id,
    ]);
    // Update applications count
    await req.dbClient.query('UPDATE internal_job_postings SET applications_count = applications_count + 1 WHERE id = $1', [job_posting_id]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PATCH /internal-mobility/applications/:id/status
 * Update application status
 */
router.patch('/applications/:id/status', validate(updateApplicationStatusSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const { status, manager_approval_status, manager_notes, hr_notes, hr_score, interview_date, interview_feedback, outcome_notes, rejected_reason, } = req.body;
    const existing = await req.dbClient.query(`
      SELECT ia.id FROM internal_applications ia
      JOIN internal_job_postings ijp ON ijp.id = ia.job_posting_id
      WHERE ia.id = $1 AND ijp.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Application');
    }
    const updates = ['updated_at = NOW()'];
    const values = [];
    let paramIndex = 1;
    if (status) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
        if (['accepted', 'rejected', 'withdrawn'].includes(status)) {
            updates.push(`decided_at = NOW()`);
        }
        if (status === 'reviewing') {
            updates.push(`reviewed_at = COALESCE(reviewed_at, NOW())`);
        }
    }
    if (manager_approval_status) {
        updates.push(`manager_approval_status = $${paramIndex++}`);
        values.push(manager_approval_status);
        updates.push(`manager_approval_date = NOW()`);
    }
    if (manager_notes) {
        updates.push(`manager_notes = $${paramIndex++}`);
        values.push(manager_notes);
    }
    if (hr_notes) {
        updates.push(`hr_notes = $${paramIndex++}`);
        values.push(hr_notes);
    }
    if (hr_score !== undefined) {
        updates.push(`hr_score = $${paramIndex++}`);
        values.push(hr_score);
    }
    if (interview_date) {
        updates.push(`interview_date = $${paramIndex++}`);
        values.push(interview_date);
        updates.push(`interview_scheduled = true`);
    }
    if (interview_feedback) {
        updates.push(`interview_feedback = $${paramIndex++}`);
        values.push(interview_feedback);
    }
    if (outcome_notes) {
        updates.push(`outcome_notes = $${paramIndex++}`);
        values.push(outcome_notes);
    }
    if (rejected_reason) {
        updates.push(`rejected_reason = $${paramIndex++}`);
        values.push(rejected_reason);
    }
    const result = await req.dbClient.query(`UPDATE internal_applications SET ${updates.join(', ')}
       WHERE id = $${paramIndex} RETURNING *`, [...values, id]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Application updated' });
}));
/**
 * GET /internal-mobility/my-applications
 * Get current user's applications
 */
router.get('/my-applications', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id } = req.query;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    const result = await req.dbClient.query(`
      SELECT
        ia.*,
        ijp.title as job_title,
        ijp.department,
        ijp.status as job_status
      FROM internal_applications ia
      JOIN internal_job_postings ijp ON ijp.id = ia.job_posting_id
      WHERE ia.employee_id = $1 AND ijp.tenant_id = $2
      ORDER BY ia.submitted_at DESC
    `, [employee_id, tenantId]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
}));
/**
 * GET /internal-mobility/stats
 * Get internal mobility statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const jobStats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_postings,
        COUNT(*) FILTER (WHERE status = 'open') as open_positions,
        COUNT(*) FILTER (WHERE status = 'closed') as filled_positions,
        SUM(applications_count) as total_applications,
        AVG(applications_count) as avg_applications_per_job
      FROM internal_job_postings
      WHERE tenant_id = $1
    `, [tenantId]);
    const appStats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_applications,
        COUNT(*) FILTER (WHERE ia.status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE ia.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE ia.status = 'submitted' OR ia.status = 'reviewing') as in_progress
      FROM internal_applications ia
      JOIN internal_job_postings ijp ON ijp.id = ia.job_posting_id
      WHERE ijp.tenant_id = $1
    `, [tenantId]);
    const byDepartment = await req.dbClient.query(`
      SELECT
        department,
        COUNT(*) as positions,
        SUM(applications_count) as applications
      FROM internal_job_postings
      WHERE tenant_id = $1
      GROUP BY department
      ORDER BY positions DESC
      LIMIT 10
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            jobs: jobStats.rows[0],
            applications: appStats.rows[0],
            by_org_unit: byDepartment.rows,
        },
    });
}));
export default router;
//# sourceMappingURL=internal-mobility.js.map