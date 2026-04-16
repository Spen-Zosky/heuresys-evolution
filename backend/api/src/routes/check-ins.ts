/**
 * Check-ins Routes
 * CRUD operations for 1:1 check-ins between managers and employees
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createCheckInSchema,
  updateCheckInSchema,
  completeCheckInSchema,
} from '../schemas/performance.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /check-ins/stats
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
        ROUND(AVG(employee_mood), 2) as avg_mood,
        ROUND(AVG(duration_minutes), 0) as avg_duration
      FROM check_ins WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /check-ins/upcoming
 */
router.get(
  '/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, manager_id, days = '7' } = req.query as Record<string, string>;

    let query = `
      SELECT ci.*,
        e.first_name || ' ' || e.last_name as employee_name,
        m.first_name || ' ' || m.last_name as manager_name
      FROM check_ins ci
      LEFT JOIN employees e ON ci.employee_id = e.id
      LEFT JOIN employees m ON ci.manager_id = m.id
      WHERE ci.tenant_id = $1
        AND ci.status = 'scheduled'
        AND ci.scheduled_date >= NOW()
        AND ci.scheduled_date <= NOW() + INTERVAL '1 day' * $2
    `;
    const params: (string | boolean | number)[] = [tenantId, days as string];
    let paramIndex = 3;

    if (employee_id) {
      query += ` AND ci.employee_id = $${paramIndex}`;
      params.push(employee_id as string);
      paramIndex++;
    }

    if (manager_id) {
      query += ` AND ci.manager_id = $${paramIndex}`;
      params.push(manager_id as string);
    }

    query += ' ORDER BY ci.scheduled_date ASC';

    const result = await req.dbClient!.query(query, params);
    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /check-ins
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      manager_id,
      status,
      meeting_type,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT ci.*,
        e.first_name || ' ' || e.last_name as employee_name,
        m.first_name || ' ' || m.last_name as manager_name
      FROM check_ins ci
      LEFT JOIN employees e ON ci.employee_id = e.id
      LEFT JOIN employees m ON ci.manager_id = m.id
      WHERE ci.tenant_id = $1
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (employee_id) {
      query += ` AND ci.employee_id = $${paramIndex}`;
      params.push(employee_id as string);
      paramIndex++;
    }

    if (manager_id) {
      query += ` AND ci.manager_id = $${paramIndex}`;
      params.push(manager_id as string);
      paramIndex++;
    }

    if (status) {
      query += ` AND ci.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (meeting_type) {
      query += ` AND ci.meeting_type = $${paramIndex}`;
      params.push(meeting_type as string);
      paramIndex++;
    }

    query += ` ORDER BY ci.scheduled_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Build count query with same filters (exclude limit/offset)
    let countQuery = `SELECT COUNT(*) FROM check_ins ci WHERE ci.tenant_id = $1`;
    const countParams: (string | boolean | number)[] = [tenantId];
    let ci = 2;

    if (employee_id) {
      countQuery += ` AND ci.employee_id = $${ci}`;
      countParams.push(employee_id as string);
      ci++;
    }
    if (manager_id) {
      countQuery += ` AND ci.manager_id = $${ci}`;
      countParams.push(manager_id as string);
      ci++;
    }
    if (status) {
      countQuery += ` AND ci.status = $${ci}`;
      countParams.push(status as string);
      ci++;
    }
    if (meeting_type) {
      countQuery += ` AND ci.meeting_type = $${ci}`;
      countParams.push(meeting_type as string);
    }

    const countResult = await req.dbClient!.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0]?.count);
    const parsedLimit = safeParseInt(limit as string, { fallback: 100 });
    const parsedOffset = safeParseInt(offset as string, { fallback: 0 });

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(total, parsedLimit, parsedOffset),
    });
  })
);

/**
 * GET /check-ins/:id
 */
router.get(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT ci.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        m.first_name || ' ' || m.last_name as manager_name,
        m.email as manager_email
      FROM check_ins ci
      LEFT JOIN employees e ON ci.employee_id = e.id
      LEFT JOIN employees m ON ci.manager_id = m.id
      WHERE ci.id = $1 AND ci.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Check-in');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /check-ins
 */
router.post(
  '/',
  validate(createCheckInSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      manager_id,
      scheduled_date,
      duration_minutes = 30,
      meeting_type = 'one_on_one',
      agenda,
      employee_notes,
      manager_notes,
      action_items,
      employee_mood,
      status = 'scheduled',
    } = req.body;

    if (!employee_id || !manager_id || !scheduled_date) {
      throw Errors.badRequest('Employee ID, manager ID, and scheduled date are required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO check_ins (tenant_id, employee_id, manager_id, scheduled_date, duration_minutes, meeting_type,
        agenda, employee_notes, manager_notes, action_items, employee_mood, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        employee_id,
        manager_id,
        scheduled_date,
        duration_minutes,
        meeting_type,
        agenda,
        employee_notes,
        manager_notes,
        action_items ? JSON.stringify(action_items) : null,
        employee_mood,
        status,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Check-in scheduled' });
  })
);

/**
 * PATCH /check-ins/:id
 */
router.patch(
  '/:id',
  validateUUID(),
  validate(updateCheckInSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM check_ins WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Check-in');
    }

    const allowedFields = [
      'scheduled_date',
      'duration_minutes',
      'meeting_type',
      'agenda',
      'employee_notes',
      'manager_notes',
      'action_items',
      'employee_mood',
      'status',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'action_items') {
          updates.push(`${field} = $${paramIndex}`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    // Auto-set completed_at when status changes to completed
    if (req.body.status === 'completed') {
      updates.push(`completed_at = NOW()`);
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE check_ins SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Check-in updated' });
  })
);

/**
 * POST /check-ins/:id/complete
 */
router.post(
  '/:id/complete',
  validateUUID(),
  validate(completeCheckInSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { employee_mood, action_items, manager_notes, employee_notes } = req.body;

    const result = await req.dbClient!.query(
      `
      UPDATE check_ins SET
        status = 'completed',
        completed_at = NOW(),
        employee_mood = COALESCE($1, employee_mood),
        action_items = COALESCE($2, action_items),
        manager_notes = COALESCE($3, manager_notes),
        employee_notes = COALESCE($4, employee_notes),
        updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `,
      [
        employee_mood,
        action_items ? JSON.stringify(action_items) : null,
        manager_notes,
        employee_notes,
        id,
        tenantId,
      ]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Check-in');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Check-in completed' });
  })
);

/**
 * DELETE /check-ins/:id
 */
router.delete(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM check_ins WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Check-in');
    }

    res.json({ success: true, message: 'Check-in deleted' });
  })
);

export default router;
