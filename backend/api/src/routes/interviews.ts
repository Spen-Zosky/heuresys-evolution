/**
 * Recruiting Interviews Routes
 * CRUD operations for candidate interviews
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createInterviewSchema,
  updateInterviewSchema,
  completeInterviewSchema,
  cancelInterviewSchema,
} from '../schemas/recruitment.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /interviews
 * List recruiting interviews with pagination
 */
router.get(
  '/',
  requirePermission('RECRUITMENT', 'VIEW'),
  applyScopeFilter('RECRUITMENT'),
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const status = req.query.status as string;

    const scope = getScopeCondition(req, 'ri');
    let whereClause = `WHERE ${scope.where}`;
    const params: unknown[] = [...scope.params];

    if (status) {
      params.push(status);
      whereClause += ` AND ri.status = $${params.length}`;
    }

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(
        `SELECT COUNT(*) as total FROM recruiting_interviews ri ${whereClause}`,
        params
      ),
      req.dbClient!.query(
        `SELECT ri.id, ri.candidate_id, ri.job_posting_id, ri.interview_type,
                ri.title, ri.scheduled_at, ri.duration_minutes, ri.location_type,
                ri.location, ri.status, ri.created_at
         FROM recruiting_interviews ri
         ${whereClause}
         ORDER BY ri.scheduled_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
  })
);

/**
 * GET /interviews/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE scheduled_at > NOW() AND status = 'scheduled') as upcoming,
      ROUND(AVG(rating) FILTER (WHERE rating IS NOT NULL), 1) as avg_rating
    FROM recruiting_interviews WHERE tenant_id = $1
  `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /interviews/upcoming
 */
router.get(
  '/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { days = '7' } = req.query as Record<string, string>;

    const result = await req.dbClient!.query(
      `
    SELECT i.*,
      c.first_name || ' ' || c.last_name as candidate_name,
      c.email as candidate_email,
      r.title as requisition_title
    FROM recruiting_interviews i
    JOIN recruiting_candidates c ON i.candidate_id = c.id
    LEFT JOIN recruiting_requisitions r ON c.requisition_id = r.id
    WHERE i.tenant_id = $1
      AND i.status = 'scheduled'
      AND i.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 day' * $2
    ORDER BY i.scheduled_at ASC
  `,
      [tenantId, parseInt(days as string)]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /interviews
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      candidate_id,
      status,
      interview_type,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
    SELECT i.*,
      c.first_name || ' ' || c.last_name as candidate_name,
      c.email as candidate_email,
      r.title as requisition_title
    FROM recruiting_interviews i
    JOIN recruiting_candidates c ON i.candidate_id = c.id
    LEFT JOIN recruiting_requisitions r ON c.requisition_id = r.id
    WHERE i.tenant_id = $1
  `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (candidate_id) {
      query += ` AND i.candidate_id = $${paramIndex}`;
      params.push(candidate_id as string);
      paramIndex++;
    }

    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (interview_type) {
      query += ` AND i.interview_type = $${paramIndex}`;
      params.push(interview_type as string);
      paramIndex++;
    }

    query += ` ORDER BY i.scheduled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM recruiting_interviews WHERE tenant_id = $1',
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.count),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * GET /interviews/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    SELECT i.*,
      c.first_name || ' ' || c.last_name as candidate_name,
      c.email as candidate_email,
      c.phone as candidate_phone,
      r.title as requisition_title,
      r.department as requisition_org_unit
    FROM recruiting_interviews i
    JOIN recruiting_candidates c ON i.candidate_id = c.id
    LEFT JOIN recruiting_requisitions r ON c.requisition_id = r.id
    WHERE i.id = $1 AND i.tenant_id = $2
  `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Interview', id);
    }

    // Get interviewers
    const interviewers = await req.dbClient!.query(
      `
    SELECT ip.*, e.first_name || ' ' || e.last_name as interviewer_name, e.email as interviewer_email
    FROM recruiting_interview_participants ip
    JOIN employees e ON ip.employee_id = e.id
    WHERE ip.interview_id = $1
  `,
      [id]
    );

    res.json({
      success: true,
      data: { ...(result.rows[0] || {}), interviewers: interviewers.rows },
    });
  })
);

/**
 * POST /interviews
 */
router.post(
  '/',
  requirePermission('RECRUITMENT', 'CREATE'),
  validate(createInterviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      candidate_id,
      job_posting_id,
      interview_type,
      title,
      description,
      scheduled_at,
      duration_minutes = 60,
      timezone = 'Europe/Rome',
      location_type = 'video',
      location,
      meeting_link,
      dial_in,
      notes,
      created_by,
    } = req.body;

    if (!candidate_id || !scheduled_at) {
      throw Errors.badRequest('candidate_id and scheduled_at are required');
    }

    // Verify candidate belongs to tenant
    const candidateCheck = await req.dbClient!.query(
      'SELECT id FROM recruiting_candidates WHERE id = $1 AND tenant_id = $2',
      [candidate_id, tenantId]
    );
    if (candidateCheck.rows.length === 0) {
      throw Errors.badRequest('Invalid candidate');
    }

    const result = await req.dbClient!.query(
      `
    INSERT INTO recruiting_interviews (tenant_id, candidate_id, job_posting_id, interview_type, title, description,
      scheduled_at, duration_minutes, timezone, location_type, location, meeting_link, dial_in,
      status, notes, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'scheduled', $14, $15, NOW(), NOW())
    RETURNING *
  `,
      [
        tenantId,
        candidate_id,
        job_posting_id,
        interview_type,
        title,
        description,
        scheduled_at,
        duration_minutes,
        timezone,
        location_type,
        location,
        meeting_link,
        dial_in,
        notes,
        created_by,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Interview scheduled' });
  })
);

/**
 * PATCH /interviews/:id
 */
router.patch(
  '/:id',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(updateInterviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM recruiting_interviews WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Interview', id);
    }

    const allowedFields = [
      'interview_type',
      'title',
      'description',
      'scheduled_at',
      'duration_minutes',
      'timezone',
      'location_type',
      'location',
      'meeting_link',
      'dial_in',
      'status',
      'outcome',
      'feedback',
      'rating',
      'notes',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
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

    const result = await req.dbClient!.query(
      `UPDATE recruiting_interviews SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Interview updated' });
  })
);

/**
 * POST /interviews/:id/complete
 */
router.post(
  '/:id/complete',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(completeInterviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { outcome, feedback, rating } = req.body;

    const result = await req.dbClient!.query(
      `
    UPDATE recruiting_interviews SET
      status = 'completed',
      outcome = $1,
      feedback = $2,
      rating = $3,
      updated_at = NOW()
    WHERE id = $4 AND tenant_id = $5
    RETURNING *
  `,
      [outcome, feedback, rating, id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Interview', id);
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Interview completed' });
  })
);

/**
 * POST /interviews/:id/cancel
 */
router.post(
  '/:id/cancel',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(cancelInterviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { reason } = req.body;

    const result = await req.dbClient!.query(
      `
    UPDATE recruiting_interviews SET
      status = 'cancelled',
      notes = COALESCE(notes || E'\n', '') || $1,
      updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
    RETURNING *
  `,
      [reason ? `Cancellation reason: ${reason}` : 'Cancelled', id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Interview', id);
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Interview cancelled' });
  })
);

/**
 * DELETE /interviews/:id
 */
router.delete(
  '/:id',
  requirePermission('RECRUITMENT', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM recruiting_interviews WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Interview', id);
    }

    res.json({ success: true, message: 'Interview deleted' });
  })
);

export default router;
