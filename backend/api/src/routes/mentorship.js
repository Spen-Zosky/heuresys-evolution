/**
 * Mentorship Routes
 * Mentorship programs, matchings, and sessions management
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { createMentorshipProgramSchema, updateMentorshipProgramSchema, createMentorshipSchema, updateMentorshipSchema, createMentorshipSessionSchema, updateMentorshipSessionSchema, } from '../schemas/mentorship.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /mentorship
 * List mentorship relationships with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const status = req.query.status;
    let whereClause = 'WHERE m.tenant_id = $1';
    const params = [tenantId];
    if (status) {
        params.push(status);
        whereClause += ` AND m.status = $${params.length}`;
    }
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM mentorships m ${whereClause}`, params),
        req.dbClient.query(`SELECT m.id, m.program_id, m.mentor_id, m.mentee_id, m.status,
                m.focus_areas, m.meeting_frequency, m.match_score,
                m.start_date, m.end_date, m.created_at,
                mentor.first_name as mentor_first_name, mentor.last_name as mentor_last_name,
                mentee.first_name as mentee_first_name, mentee.last_name as mentee_last_name
         FROM mentorships m
         LEFT JOIN employees mentor ON m.mentor_id = mentor.id
         LEFT JOIN employees mentee ON m.mentee_id = mentee.id
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
/**
 * GET /mentorship/programs
 * List mentorship programs
 */
router.get('/programs', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, program_type, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        mp.*,
        (SELECT COUNT(*) FROM mentorships m WHERE m.program_id = mp.id) as active_pairs
      FROM mentorship_programs mp
      WHERE mp.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (status) {
        query += ` AND mp.status = $${paramIndex++}`;
        params.push(status);
    }
    if (program_type) {
        query += ` AND mp.program_type = $${paramIndex++}`;
        params.push(program_type);
    }
    query += ` ORDER BY mp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM mentorship_programs WHERE tenant_id = $1', [tenantId]);
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
 * GET /mentorship/programs/:id
 * Get program details
 */
router.get('/programs/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT mp.*,
        (SELECT COUNT(*) FROM mentorships m WHERE m.program_id = mp.id) as active_pairs,
        (SELECT COUNT(*) FROM mentorships m WHERE m.program_id = mp.id AND m.status = 'completed') as completed_pairs
      FROM mentorship_programs mp
      WHERE mp.id = $1 AND mp.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Program');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /mentorship/programs
 * Create new mentorship program
 */
router.post('/programs', validate(createMentorshipProgramSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, program_type = 'traditional', duration_months, max_participants, focus_areas, eligibility_criteria, start_date, end_date, } = req.body;
    if (!name) {
        throw Errors.badRequest('name is required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO mentorship_programs (
        tenant_id, name, description, program_type, status,
        duration_months, max_participants, focus_areas,
        eligibility_criteria, start_date, end_date,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        name,
        description,
        program_type,
        duration_months,
        max_participants,
        JSON.stringify(focus_areas || []),
        JSON.stringify(eligibility_criteria || {}),
        start_date,
        end_date,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PATCH /mentorship/programs/:id
 * Update program
 */
router.patch('/programs/:id', validate(updateMentorshipProgramSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM mentorship_programs WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Program');
    }
    const allowedFields = [
        'name',
        'description',
        'program_type',
        'status',
        'duration_months',
        'max_participants',
        'focus_areas',
        'eligibility_criteria',
        'start_date',
        'end_date',
    ];
    const updates = ['updated_at = NOW()'];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            if (['focus_areas', 'eligibility_criteria'].includes(field)) {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(JSON.stringify(req.body[field]));
            }
            else {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        }
    }
    const result = await req.dbClient.query(`UPDATE mentorship_programs SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Program updated' });
}));
/**
 * GET /mentorship/mentorships
 * List mentorship relationships
 */
router.get('/mentorships', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { program_id, status, mentor_id, mentee_id, limit = '50', offset = '0', } = req.query;
    let query = `
      SELECT
        m.*,
        mp.name as program_name,
        mentor.first_name || ' ' || mentor.last_name as mentor_name,
        mentee.first_name || ' ' || mentee.last_name as mentee_name,
        (SELECT COUNT(*) FROM mentorship_sessions ms WHERE ms.mentorship_id = m.id) as sessions_count
      FROM mentorships m
      JOIN mentorship_programs mp ON mp.id = m.program_id
      JOIN employees mentor ON mentor.id = m.mentor_id
      JOIN employees mentee ON mentee.id = m.mentee_id
      WHERE m.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (program_id) {
        query += ` AND m.program_id = $${paramIndex++}`;
        params.push(program_id);
    }
    if (status) {
        query += ` AND m.status = $${paramIndex++}`;
        params.push(status);
    }
    if (mentor_id) {
        query += ` AND m.mentor_id = $${paramIndex++}`;
        params.push(mentor_id);
    }
    if (mentee_id) {
        query += ` AND m.mentee_id = $${paramIndex++}`;
        params.push(mentee_id);
    }
    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * GET /mentorship/mentorships/:id
 * Get mentorship details
 */
router.get('/mentorships/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT
        m.*,
        mp.name as program_name,
        mp.program_type,
        mentor.first_name || ' ' || mentor.last_name as mentor_name,
        mentor.email as mentor_email,
        mentee.first_name || ' ' || mentee.last_name as mentee_name,
        mentee.email as mentee_email
      FROM mentorships m
      JOIN mentorship_programs mp ON mp.id = m.program_id
      JOIN employees mentor ON mentor.id = m.mentor_id
      JOIN employees mentee ON mentee.id = m.mentee_id
      WHERE m.id = $1 AND m.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Mentorship');
    }
    // Get sessions
    const sessions = await req.dbClient.query(`
      SELECT id, mentorship_id, session_date, duration_minutes, status,
        topics, notes, rating, created_at
      FROM mentorship_sessions
      WHERE mentorship_id = $1
      ORDER BY session_date DESC
      LIMIT 100
    `, [id]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            sessions: sessions.rows,
        },
    });
}));
/**
 * POST /mentorship/mentorships
 * Create mentorship relationship
 */
router.post('/mentorships', validate(createMentorshipSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { program_id, mentor_id, mentee_id, focus_areas, meeting_frequency, goals, start_date, end_date, } = req.body;
    if (!program_id || !mentor_id || !mentee_id) {
        throw Errors.badRequest('program_id, mentor_id, and mentee_id are required');
    }
    // Verify program exists
    const programCheck = await req.dbClient.query('SELECT id FROM mentorship_programs WHERE id = $1 AND tenant_id = $2', [program_id, tenantId]);
    if (programCheck.rows.length === 0) {
        throw Errors.notFound('Program');
    }
    // Check for existing active mentorship
    const existingCheck = await req.dbClient.query(`
      SELECT id FROM mentorships
      WHERE program_id = $1 AND mentor_id = $2 AND mentee_id = $3
      AND status IN ('active', 'pending')
    `, [program_id, mentor_id, mentee_id]);
    if (existingCheck.rows.length > 0) {
        throw Errors.conflict('Active mentorship already exists');
    }
    const result = await req.dbClient.query(`
      INSERT INTO mentorships (
        tenant_id, program_id, mentor_id, mentee_id,
        status, focus_areas, meeting_frequency, goals,
        start_date, end_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        program_id,
        mentor_id,
        mentee_id,
        JSON.stringify(focus_areas || []),
        meeting_frequency,
        JSON.stringify(goals || []),
        start_date,
        end_date,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PATCH /mentorship/mentorships/:id
 * Update mentorship
 */
router.patch('/mentorships/:id', validate(updateMentorshipSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM mentorships WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Mentorship');
    }
    const allowedFields = [
        'status',
        'focus_areas',
        'meeting_frequency',
        'goals',
        'notes',
        'end_date',
    ];
    const updates = ['updated_at = NOW()'];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            if (['focus_areas', 'goals'].includes(field)) {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(JSON.stringify(req.body[field]));
            }
            else {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        }
    }
    const result = await req.dbClient.query(`UPDATE mentorships SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
       RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Mentorship updated' });
}));
/**
 * GET /mentorship/sessions
 * List mentorship sessions
 */
router.get('/sessions', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { mentorship_id, status, from_date, to_date, limit = '50', } = req.query;
    let query = `
      SELECT
        ms.*,
        m.mentor_id,
        m.mentee_id,
        mentor.first_name || ' ' || mentor.last_name as mentor_name,
        mentee.first_name || ' ' || mentee.last_name as mentee_name
      FROM mentorship_sessions ms
      JOIN mentorships m ON m.id = ms.mentorship_id
      JOIN employees mentor ON mentor.id = m.mentor_id
      JOIN employees mentee ON mentee.id = m.mentee_id
      WHERE m.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (mentorship_id) {
        query += ` AND ms.mentorship_id = $${paramIndex++}`;
        params.push(mentorship_id);
    }
    if (status) {
        query += ` AND ms.status = $${paramIndex++}`;
        params.push(status);
    }
    if (from_date) {
        query += ` AND ms.session_date >= $${paramIndex++}`;
        params.push(from_date);
    }
    if (to_date) {
        query += ` AND ms.session_date <= $${paramIndex++}`;
        params.push(to_date);
    }
    query += ` ORDER BY ms.session_date DESC LIMIT $${paramIndex}`;
    params.push(safeParseInt(limit, { fallback: 50 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * POST /mentorship/sessions
 * Create session
 */
router.post('/sessions', validate(createMentorshipSessionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { mentorship_id, session_date, duration_minutes, topics, notes } = req.body;
    if (!mentorship_id || !session_date) {
        throw Errors.badRequest('mentorship_id and session_date are required');
    }
    // Verify mentorship exists and belongs to tenant
    const mentorshipCheck = await req.dbClient.query('SELECT id FROM mentorships WHERE id = $1 AND tenant_id = $2', [mentorship_id, tenantId]);
    if (mentorshipCheck.rows.length === 0) {
        throw Errors.notFound('Mentorship');
    }
    const result = await req.dbClient.query(`
      INSERT INTO mentorship_sessions (
        mentorship_id, session_date, duration_minutes,
        status, topics, notes, created_at
      ) VALUES ($1, $2, $3, 'scheduled', $4, $5, NOW())
      RETURNING *
    `, [mentorship_id, session_date, duration_minutes || 60, JSON.stringify(topics || []), notes]);
    res.status(201).json({ success: true, data: result.rows[0] || null });
}));
/**
 * PATCH /mentorship/sessions/:id
 * Update session
 */
router.patch('/sessions/:id', validate(updateMentorshipSessionSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Verify session belongs to tenant
    const existing = await req.dbClient.query(`
      SELECT ms.id FROM mentorship_sessions ms
      JOIN mentorships m ON m.id = ms.mentorship_id
      WHERE ms.id = $1 AND m.tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Session');
    }
    const allowedFields = [
        'session_date',
        'duration_minutes',
        'status',
        'topics',
        'notes',
        'rating',
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            if (field === 'topics') {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(JSON.stringify(req.body[field]));
            }
            else {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        }
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    const result = await req.dbClient.query(`UPDATE mentorship_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, [...values, id]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Session updated' });
}));
/**
 * GET /mentorship/mentors/available
 * Get available mentors
 */
router.get('/mentors/available', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { org_unit_id, skill_id } = req.query;
    let query = `
      SELECT
        e.id,
        e.first_name || ' ' || e.last_name as name,
        e.email,
        e.job_title,
        d.name as department,
        e.hire_date,
        (SELECT COUNT(*) FROM mentorships m WHERE m.mentor_id = e.id AND m.status = 'active') as active_mentees
      FROM employees e
      LEFT JOIN org_units d ON d.id = e.org_unit_id
      WHERE e.tenant_id = $1
      AND e.is_active = true
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (org_unit_id) {
        query += ` AND e.org_unit_id = $${paramIndex++}`;
        params.push(org_unit_id);
    }
    if (skill_id) {
        query += ` AND EXISTS (SELECT 1 FROM employee_skills es WHERE es.employee_id = e.id AND es.skill_id = $${paramIndex++})`;
        params.push(skill_id);
    }
    // Exclude employees who are already at max mentees (e.g., 3)
    query += ` AND (SELECT COUNT(*) FROM mentorships m WHERE m.mentor_id = e.id AND m.status = 'active') < 3`;
    query += ` ORDER BY e.hire_date ASC LIMIT 50`;
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
    });
}));
/**
 * GET /mentorship/my
 * Get current user's mentorship relationships
 */
router.get('/my', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id } = req.query;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    // As mentor
    const asMentor = await req.dbClient.query(`
      SELECT
        m.*,
        mp.name as program_name,
        mentee.first_name || ' ' || mentee.last_name as mentee_name,
        'mentor' as role
      FROM mentorships m
      JOIN mentorship_programs mp ON mp.id = m.program_id
      JOIN employees mentee ON mentee.id = m.mentee_id
      WHERE m.mentor_id = $1 AND m.tenant_id = $2
      ORDER BY m.created_at DESC
    `, [employee_id, tenantId]);
    // As mentee
    const asMentee = await req.dbClient.query(`
      SELECT
        m.*,
        mp.name as program_name,
        mentor.first_name || ' ' || mentor.last_name as mentor_name,
        'mentee' as role
      FROM mentorships m
      JOIN mentorship_programs mp ON mp.id = m.program_id
      JOIN employees mentor ON mentor.id = m.mentor_id
      WHERE m.mentee_id = $1 AND m.tenant_id = $2
      ORDER BY m.created_at DESC
    `, [employee_id, tenantId]);
    res.json({
        success: true,
        data: {
            as_mentor: asMentor.rows,
            as_mentee: asMentee.rows,
        },
    });
}));
/**
 * GET /mentorship/stats
 * Get mentorship statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const programStats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_programs,
        COUNT(*) FILTER (WHERE status = 'active') as active_programs
      FROM mentorship_programs
      WHERE tenant_id = $1
    `, [tenantId]);
    const mentorshipStats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_mentorships,
        COUNT(*) FILTER (WHERE status = 'active') as active_mentorships,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_mentorships,
        COUNT(DISTINCT mentor_id) as unique_mentors,
        COUNT(DISTINCT mentee_id) as unique_mentees
      FROM mentorships
      WHERE tenant_id = $1
    `, [tenantId]);
    const sessionStats = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE ms.status = 'completed') as completed_sessions,
        AVG(ms.duration_minutes) as avg_duration,
        AVG(ms.rating) as avg_rating
      FROM mentorship_sessions ms
      JOIN mentorships m ON m.id = ms.mentorship_id
      WHERE m.tenant_id = $1
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            programs: programStats.rows[0],
            mentorships: mentorshipStats.rows[0],
            sessions: sessionStats.rows[0],
        },
    });
}));
export default router;
//# sourceMappingURL=mentorship.js.map