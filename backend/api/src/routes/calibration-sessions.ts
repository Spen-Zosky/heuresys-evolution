/**
 * Calibration Sessions Routes
 * Story 9.4: Calibration Sessions
 *
 * Calibration sessions ensure consistent and fair performance ratings across
 * managers by bringing together calibrators to review and adjust ratings.
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { performanceManagementService } from '../services/performance-management.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { withTransaction } from '../utils/transaction.js';
import {
  createCalibrationSessionSchema,
  updateCalibrationSessionSchema,
  addCalibrationParticipantsSchema,
  flagOutlierSchema,
  createAdjustmentSchema,
  updateAdjustmentSchema,
  updateAdjustmentNotesSchema,
  completeCalibrationSessionSchema,
  cancelCalibrationSessionSchema,
} from '../schemas/performance.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /calibration-sessions/stats
 * Get calibration session statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        (
          SELECT COUNT(*) FROM calibration_adjustments ca
          WHERE ca.tenant_id = $1
        ) as total_adjustments,
        (
          SELECT AVG(ABS(ca.original_rating - ca.adjusted_rating))
          FROM calibration_adjustments ca
          WHERE ca.tenant_id = $1 AND ca.original_rating IS NOT NULL AND ca.adjusted_rating IS NOT NULL
        ) as avg_rating_change
      FROM calibration_sessions
      WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /calibration-sessions
 * List all calibration sessions
 */
router.get(
  '/',
  requirePermission('PERFORMANCE', 'VIEW'),
  applyScopeFilter('PERFORMANCE'),
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req);
    const {
      status,
      review_cycle_id,
      org_unit_id,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    const scope = getScopeCondition(req, 'cs');
    let query = `
      SELECT cs.*,
        rc.name as review_cycle_name,
        cs.department as department_name,
        (SELECT COUNT(*) FROM calibration_participants cp WHERE cp.session_id = cs.id AND cp.role = 'participant') as participant_count,
        (SELECT COUNT(*) FROM calibration_participants cp WHERE cp.session_id = cs.id AND cp.role = 'observer') as observer_count,
        (SELECT COUNT(*) FROM calibration_adjustments ca WHERE ca.calibration_session_id = cs.id) as adjustment_count
      FROM calibration_sessions cs
      LEFT JOIN review_cycles rc ON cs.review_cycle_id = rc.id
      WHERE ${scope.where}
    `;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (status) {
      query += ` AND cs.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (review_cycle_id) {
      query += ` AND cs.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    if (org_unit_id) {
      // org_unit_id filter uses department name column
      query += ` AND cs.department = $${paramIndex}`;
      params.push(org_unit_id);
      paramIndex++;
    }

    query += ` ORDER BY cs.scheduled_date DESC NULLS LAST, cs.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM calibration_sessions cs WHERE ${scope.where}`,
      scope.params
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
 * GET /calibration-sessions/upcoming
 * Get upcoming calibration sessions
 */
router.get(
  '/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT cs.*,
        rc.name as review_cycle_name,
        cs.department as department_name,
        (SELECT COUNT(*) FROM calibration_participants cp WHERE cp.session_id = cs.id AND cp.role = 'participant') as participant_count,
        (SELECT COUNT(*) FROM calibration_participants cp WHERE cp.session_id = cs.id AND cp.role = 'observer') as observer_count
      FROM calibration_sessions cs
      LEFT JOIN review_cycles rc ON cs.review_cycle_id = rc.id
      WHERE cs.tenant_id = $1
        AND cs.status = 'scheduled'
        AND cs.scheduled_date >= NOW()
      ORDER BY cs.scheduled_date
      LIMIT 10
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

// ============================================================================
// STATIC ROUTES BEFORE /:id (S-PERF-01-05 Enhanced)
// ============================================================================

/**
 * GET /calibration-sessions/:id/outliers
 * Detect rating outliers for a session
 */
router.get(
  '/:id/outliers',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const threshold = parseFloat(req.query['threshold'] as string) || 2.0;

    // Use the fn_detect_calibration_outliers function
    const result = await req.dbClient!.query(
      `
      SELECT * FROM fn_detect_calibration_outliers($1, $2, $3)
    `,
      [tenantId, sessionId, threshold]
    );

    // Count outliers by reason
    const summary = {
      total_outliers: result.rows.length,
      by_reason: {
        high_variance: result.rows.filter((r) => r.outlier_reason === 'high_variance').length,
        extreme_rating: result.rows.filter((r) => r.outlier_reason === 'extreme_rating').length,
        dept_deviation: result.rows.filter((r) => r.outlier_reason === 'dept_deviation').length,
      },
    };

    res.json({
      success: true,
      data: result.rows,
      summary,
      threshold_used: threshold,
    });
  })
);

/**
 * POST /calibration-sessions/:id/flag-outlier
 * Flag an adjustment as an outlier
 */
router.post(
  '/:id/flag-outlier',
  requirePermission('PERFORMANCE', 'CREATE'),
  validate(flagOutlierSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const { adjustment_id, outlier_reason, action_by } = req.body;

    if (!adjustment_id) {
      throw Errors.badRequest('adjustment_id is required');
    }

    // Update the adjustment
    const result = await req.dbClient!.query(
      `
      UPDATE calibration_adjustments SET
        outlier_flag = true,
        outlier_reason = $1,
        updated_at = NOW()
      WHERE id = $2 AND calibration_session_id = $3 AND tenant_id = $4
      RETURNING *
    `,
      [outlier_reason, adjustment_id, sessionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Adjustment');
    }

    // Log the action
    await req.dbClient!.query(
      `
      SELECT fn_log_calibration_action($1, $2, $3, 'outlier_flagged', $4, NULL, $5, 'Flagged as outlier')
    `,
      [tenantId, sessionId, adjustment_id, action_by, JSON.stringify({ outlier_reason })]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Adjustment flagged as outlier',
    });
  })
);

/**
 * GET /calibration-sessions/:id/9box
 * Get 9-box grid placement for a session
 */
router.get(
  '/:id/9box',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT tenant_id, calibration_session_id, employee_id, employee_name,
        department_name, original_rating, adjusted_rating, final_rating,
        performance_bucket, potential_bucket, box_position, outlier_flag, outlier_reason
      FROM v_calibration_9box
      WHERE calibration_session_id = $1 AND tenant_id = $2
      ORDER BY box_position DESC, final_rating DESC
    `,
      [sessionId, tenantId]
    );

    // Group by box position
    const boxes: Record<number, unknown[]> = {};
    for (let i = 1; i <= 9; i++) {
      boxes[i] = result.rows.filter((r) => r.box_position === i);
    }

    // Box labels
    const boxLabels: Record<number, string> = {
      1: 'Underperformer',
      2: 'Effective',
      3: 'Solid Performer',
      4: 'Development Needed',
      5: 'Core Player',
      6: 'Strong Performer',
      7: 'Inconsistent Talent',
      8: 'High Potential',
      9: 'Star',
    };

    const summary = {
      total_employees: result.rows.length,
      stars: (boxes[9] || []).length,
      high_potentials: (boxes[8] || []).length + (boxes[7] || []).length,
      solid_performers: (boxes[3] || []).length + (boxes[6] || []).length,
      core_players: (boxes[5] || []).length,
      development_needed:
        (boxes[4] || []).length + (boxes[2] || []).length + (boxes[1] || []).length,
    };

    res.json({
      success: true,
      data: {
        employees: result.rows,
        boxes,
        box_labels: boxLabels,
        summary,
      },
    });
  })
);

/**
 * GET /calibration-sessions/:id/bell-curve
 * Get bell curve distribution for a session
 */
router.get(
  '/:id/bell-curve',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT tenant_id, calibration_session_id, rating, count, percentage, expected_percentage
      FROM v_calibration_bell_curve
      WHERE calibration_session_id = $1 AND tenant_id = $2
      ORDER BY rating
    `,
      [sessionId, tenantId]
    );

    // Calculate deviation from expected
    const distribution = result.rows.map((row) => ({
      ...row,
      deviation: parseFloat(row.percentage) - parseFloat(row.expected_percentage),
    }));

    // Summary stats
    const totalCount = distribution.reduce((sum, r) => sum + parseInt(r.count), 0);
    const deviation = distribution.reduce((sum, r) => sum + Math.abs(r.deviation), 0);

    res.json({
      success: true,
      data: {
        distribution,
        total_employees: totalCount,
        total_deviation: deviation.toFixed(2),
        is_bell_curve_compliant: deviation < 20, // Less than 20% total deviation
      },
    });
  })
);

/**
 * GET /calibration-sessions/:id/audit-log
 * Get audit trail for a session
 */
router.get(
  '/:id/audit-log',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const { action_type, limit = '100', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT cal.*,
        e.first_name || ' ' || e.last_name as action_by_name,
        ca.employee_id as adjustment_employee_id
      FROM calibration_audit_log cal
      LEFT JOIN employees e ON cal.action_by = e.id
      LEFT JOIN calibration_adjustments ca ON cal.adjustment_id = ca.id
      WHERE cal.calibration_session_id = $1 AND cal.tenant_id = $2
    `;
    const params: unknown[] = [sessionId, tenantId];
    let paramIndex = 3;

    if (action_type) {
      query += ` AND cal.action_type = $${paramIndex}`;
      params.push(action_type);
      paramIndex++;
    }

    query += ` ORDER BY cal.action_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Count by action type
    const countResult = await req.dbClient!.query(
      `
      SELECT action_type, COUNT(*) as count
      FROM calibration_audit_log
      WHERE calibration_session_id = $1 AND tenant_id = $2
      GROUP BY action_type
      ORDER BY count DESC
    `,
      [sessionId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      action_counts: countResult.rows,
      meta: {
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * PATCH /calibration-sessions/:id/adjustments/:adjustmentId/notes
 * Add or update discussion notes for an adjustment
 */
router.patch(
  '/:id/adjustments/:adjustmentId/notes',
  requirePermission('PERFORMANCE', 'EDIT'),
  validate(updateAdjustmentNotesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id: sessionId, adjustmentId } = req.params as Record<string, string>;
    const { discussion_notes, action_by } = req.body;

    if (discussion_notes === undefined) {
      throw Errors.badRequest('discussion_notes is required');
    }

    // Get old value for audit
    const oldValue = await req.dbClient!.query(
      'SELECT discussion_notes FROM calibration_adjustments WHERE id = $1 AND calibration_session_id = $2 AND tenant_id = $3',
      [adjustmentId, sessionId, tenantId]
    );

    if (oldValue.rows.length === 0) {
      throw Errors.notFound('Adjustment');
    }

    // Update the adjustment
    const result = await req.dbClient!.query(
      `
      UPDATE calibration_adjustments SET
        discussion_notes = $1,
        updated_at = NOW()
      WHERE id = $2 AND calibration_session_id = $3 AND tenant_id = $4
      RETURNING *
    `,
      [discussion_notes, adjustmentId, sessionId, tenantId]
    );

    // Log the action
    await req.dbClient!.query(
      `
      SELECT fn_log_calibration_action($1, $2, $3, 'notes_added', $4, $5, $6, 'Discussion notes updated')
    `,
      [
        tenantId,
        sessionId,
        adjustmentId,
        action_by,
        JSON.stringify({ notes: oldValue.rows[0]?.discussion_notes }),
        JSON.stringify({ notes: discussion_notes }),
      ]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Discussion notes updated' });
  })
);

// END ENHANCED ROUTES

/**
 * GET /calibration-sessions/:id
 * Get a specific calibration session
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT cs.*,
        rc.name as review_cycle_name,
        d.name as department_name
      FROM calibration_sessions cs
      LEFT JOIN review_cycles rc ON cs.review_cycle_id = rc.id
      LEFT JOIN org_units d ON cs.org_unit_id = d.id
      WHERE cs.id = $1 AND cs.tenant_id = $2
    `,
      [sessionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /calibration-sessions/:id/details
 * Get full calibration session details with participants and adjustments
 */
router.get(
  '/:id/details',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const details = await performanceManagementService.getCalibrationSessionDetails(
      tenantId,
      sessionId
    );

    if (!details.session) {
      throw Errors.notFound('Calibration session');
    }

    res.json({ success: true, data: details });
  })
);

/**
 * POST /calibration-sessions
 * Create a new calibration session
 */
router.post(
  '/',
  requirePermission('PERFORMANCE', 'CREATE'),
  validate(createCalibrationSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      description,
      review_cycle_id,
      org_unit_id,
      scheduled_date,
      scheduled_end_date,
      location,
      meeting_link,
      facilitator_id,
      facilitator_ids,
      status = 'scheduled',
    } = req.body;

    if (!name) {
      throw Errors.badRequest('Name is required');
    }

    const session = await performanceManagementService.createCalibrationSession(tenantId, {
      name,
      description,
      review_cycle_id,
      org_unit_id,
      scheduled_date,
      scheduled_end_date,
      location,
      meeting_link,
      facilitator_id,
      facilitator_ids,
      status,
    } as Parameters<typeof performanceManagementService.createCalibrationSession>[1]);

    res.status(201).json({ success: true, data: session, message: 'Calibration session created' });
  })
);

/**
 * PATCH /calibration-sessions/:id
 * Update a calibration session
 */
router.patch(
  '/:id',
  requirePermission('PERFORMANCE', 'EDIT'),
  validate(updateCalibrationSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id, status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }

    const allowedFields = [
      'name',
      'description',
      'scheduled_date',
      'scheduled_end_date',
      'location',
      'meeting_link',
      'status',
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
      `UPDATE calibration_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, sessionId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Calibration session updated',
    });
  })
);

/**
 * DELETE /calibration-sessions/:id
 * Delete a calibration session
 */
router.delete(
  '/:id',
  requirePermission('PERFORMANCE', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    // Check session status
    const sessionCheck = await req.dbClient!.query(
      'SELECT status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (sessionCheck.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }
    if (sessionCheck.rows[0].status === 'completed') {
      throw Errors.badRequest('Cannot delete a completed session');
    }

    // Delete in transaction: participants first (no CASCADE FK), then session
    // calibration_adjustments has ON DELETE CASCADE from session, no manual delete needed
    await withTransaction(async (txClient) => {
      await txClient.query('DELETE FROM calibration_participants WHERE session_id = $1', [
        sessionId,
      ]);
      await txClient.query(
        'DELETE FROM calibration_sessions WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [sessionId, tenantId]
      );
    }, tenantId);

    res.json({ success: true, message: 'Calibration session deleted' });
  })
);

// ============================================================================
// PARTICIPANT MANAGEMENT
// ============================================================================

/**
 * GET /calibration-sessions/:id/participants
 * Get all participants for a session
 */
router.get(
  '/:id/participants',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const { role } = req.query as Record<string, string>;

    let query = `
      SELECT cp.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        e.job_title,
        d.name as department_name
      FROM calibration_participants cp
      JOIN employees e ON cp.manager_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE cp.session_id = $1
    `;
    const params: unknown[] = [sessionId, tenantId];

    if (role) {
      query += ` AND cp.role = $3`;
      params.push(role);
    }

    query += ` ORDER BY cp.role, e.last_name`;

    const result = await req.dbClient!.query(query, params);

    // Group by role
    const grouped = {
      facilitators: result.rows.filter((p) => p.role === 'facilitator'),
      calibrators: result.rows.filter((p) => p.role === 'calibrator'),
      subjects: result.rows.filter((p) => p.role === 'subject'),
    };

    res.json({ success: true, data: result.rows, grouped });
  })
);

/**
 * POST /calibration-sessions/:id/participants
 * Add participants to a calibration session
 */
router.post(
  '/:id/participants',
  requirePermission('PERFORMANCE', 'CREATE'),
  validate(addCalibrationParticipantsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const { participants } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      throw Errors.badRequest('participants array is required');
    }

    // Verify session exists and is not completed
    const sessionCheck = await req.dbClient!.query(
      'SELECT status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (sessionCheck.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }
    if (sessionCheck.rows[0].status === 'completed') {
      res
        .status(400)
        .json({ success: false, error: 'Cannot add participants to a completed session' });
      return;
    }

    const addedCount = await performanceManagementService.addCalibrationParticipants(
      tenantId,
      sessionId,
      participants
    );

    res.status(201).json({
      success: true,
      message: `${addedCount} participants added`,
      data: { added_count: addedCount },
    });
  })
);

/**
 * DELETE /calibration-sessions/:id/participants/:participantId
 * Remove a participant from a session
 */
router.delete(
  '/:id/participants/:participantId',
  requirePermission('PERFORMANCE', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id: sessionId, participantId } = req.params as Record<string, string>;

    const result = await req.dbClient!.query(
      'DELETE FROM calibration_participants WHERE id = $1 AND session_id = $2 AND tenant_id = $3 RETURNING id',
      [participantId, sessionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Participant');
    }

    res.json({ success: true, message: 'Participant removed' });
  })
);

// ============================================================================
// SESSION WORKFLOW
// ============================================================================

/**
 * POST /calibration-sessions/:id/start
 * Start a calibration session
 */
router.post(
  '/:id/start',
  requirePermission('PERFORMANCE', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const sessionCheck = await req.dbClient!.query(
      'SELECT status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (sessionCheck.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }
    if (sessionCheck.rows[0].status !== 'scheduled') {
      throw Errors.badRequest('Only scheduled sessions can be started');
    }

    // Check if there are subjects
    const subjectCount = await req.dbClient!.query(
      "SELECT COUNT(*) FROM calibration_participants WHERE session_id = $1 AND role = 'subject'",
      [sessionId]
    );
    if (parseInt(subjectCount.rows[0].count) === 0) {
      throw Errors.badRequest('Cannot start a session with no subjects');
    }

    const result = await req.dbClient!.query(
      `
      UPDATE calibration_sessions SET
        status = 'in_progress',
        started_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
      [sessionId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Calibration session started',
    });
  })
);

/**
 * POST /calibration-sessions/:id/complete
 * Complete a calibration session
 */
router.post(
  '/:id/complete',
  requirePermission('PERFORMANCE', 'EDIT'),
  validate(completeCalibrationSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const { notes, decisions } = req.body;

    const session = await performanceManagementService.completeCalibrationSession(
      tenantId,
      sessionId,
      notes,
      decisions
    );

    if (!session) {
      res.status(400).json({ success: false, error: 'Could not complete session. Check status.' });
      return;
    }

    res.json({ success: true, data: session, message: 'Calibration session completed' });
  })
);

/**
 * POST /calibration-sessions/:id/cancel
 * Cancel a calibration session
 */
router.post(
  '/:id/cancel',
  requirePermission('PERFORMANCE', 'EDIT'),
  validate(cancelCalibrationSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const { reason } = req.body;

    const sessionCheck = await req.dbClient!.query(
      'SELECT status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (sessionCheck.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }
    if (sessionCheck.rows[0].status === 'completed') {
      throw Errors.badRequest('Cannot cancel a completed session');
    }

    const result = await req.dbClient!.query(
      `
      UPDATE calibration_sessions SET
        status = 'cancelled',
        notes = COALESCE(notes || E'\\n', '') || 'Cancelled: ' || COALESCE($3, 'No reason provided'),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
      [sessionId, tenantId, reason]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Calibration session cancelled',
    });
  })
);

// ============================================================================
// RATING ADJUSTMENTS
// ============================================================================

/**
 * GET /calibration-sessions/:id/adjustments
 * Get all rating adjustments for a session
 */
router.get(
  '/:id/adjustments',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT ca.*,
        e.first_name || ' ' || e.last_name as employee_name,
        adj.first_name || ' ' || adj.last_name as adjusted_by_name
      FROM calibration_adjustments ca
      JOIN employees e ON ca.employee_id = e.id
      LEFT JOIN employees adj ON ca.adjusted_by = adj.id
      WHERE ca.calibration_session_id = $1 AND ca.tenant_id = $2
      ORDER BY ca.created_at DESC
    `,
      [sessionId, tenantId]
    );

    // Summary statistics
    const summary = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_adjustments,
        COUNT(*) FILTER (WHERE adjusted_rating > original_rating) as upgrades,
        COUNT(*) FILTER (WHERE adjusted_rating < original_rating) as downgrades,
        COUNT(*) FILTER (WHERE adjusted_rating = original_rating) as unchanged,
        AVG(original_rating) as avg_original_rating,
        AVG(adjusted_rating) as avg_adjusted_rating
      FROM calibration_adjustments
      WHERE session_id = $1 AND tenant_id = $2
    `,
      [sessionId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      summary: summary.rows[0],
    });
  })
);

/**
 * POST /calibration-sessions/:id/adjustments
 * Record a rating adjustment
 */
router.post(
  '/:id/adjustments',
  requirePermission('PERFORMANCE', 'CREATE'),
  validate(createAdjustmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;
    const {
      employee_id,
      performance_review_id,
      original_rating,
      adjusted_rating,
      adjustment_reason,
      competency_adjustments,
      adjusted_by,
    } = req.body;

    if (!employee_id) {
      throw Errors.badRequest('employee_id is required');
    }

    // Verify session is in progress
    const sessionCheck = await req.dbClient!.query(
      'SELECT status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (sessionCheck.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }
    if (sessionCheck.rows[0].status !== 'in_progress') {
      res
        .status(400)
        .json({ success: false, error: 'Can only record adjustments for in-progress sessions' });
      return;
    }

    const adjustment = await performanceManagementService.recordCalibrationAdjustment(
      tenantId,
      sessionId,
      {
        employee_id,
        performance_review_id,
        original_rating,
        adjusted_rating,
        adjustment_reason,
        competency_adjustments,
        adjusted_by,
      }
    );

    res.status(201).json({ success: true, data: adjustment, message: 'Adjustment recorded' });
  })
);

/**
 * PATCH /calibration-sessions/:id/adjustments/:adjustmentId
 * Update an adjustment
 */
router.patch(
  '/:id/adjustments/:adjustmentId',
  requirePermission('PERFORMANCE', 'EDIT'),
  validate(updateAdjustmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const adjustmentId = req.params['adjustmentId'] as string;

    const allowedFields = [
      'adjusted_rating',
      'adjustment_reason',
      'competency_adjustments',
      'final_comments',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'competency_adjustments') {
          updates.push(`${field} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE calibration_adjustments SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, adjustmentId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Adjustment');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Adjustment updated' });
  })
);

/**
 * DELETE /calibration-sessions/:id/adjustments/:adjustmentId
 * Delete an adjustment
 */
router.delete(
  '/:id/adjustments/:adjustmentId',
  requirePermission('PERFORMANCE', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id: sessionId, adjustmentId } = req.params as Record<string, string>;

    const result = await req.dbClient!.query(
      'DELETE FROM calibration_adjustments WHERE id = $1 AND session_id = $2 AND tenant_id = $3 RETURNING id',
      [adjustmentId, sessionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Adjustment');
    }

    res.json({ success: true, message: 'Adjustment deleted' });
  })
);

// ============================================================================
// DISTRIBUTION ANALYSIS
// ============================================================================

/**
 * GET /calibration-sessions/:id/distribution
 * Get rating distribution for a session
 */
router.get(
  '/:id/distribution',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    // Original distribution
    const original = await req.dbClient!.query(
      `
      SELECT
        original_rating as rating,
        COUNT(*) as count
      FROM calibration_adjustments
      WHERE session_id = $1 AND tenant_id = $2 AND original_rating IS NOT NULL
      GROUP BY original_rating
      ORDER BY original_rating
    `,
      [sessionId, tenantId]
    );

    // Adjusted distribution
    const adjusted = await req.dbClient!.query(
      `
      SELECT
        adjusted_rating as rating,
        COUNT(*) as count
      FROM calibration_adjustments
      WHERE session_id = $1 AND tenant_id = $2 AND adjusted_rating IS NOT NULL
      GROUP BY adjusted_rating
      ORDER BY adjusted_rating
    `,
      [sessionId, tenantId]
    );

    // By department
    const byDepartment = await req.dbClient!.query(
      `
      SELECT
        d.id as org_unit_id,
        d.name as department_name,
        COUNT(*) as total,
        AVG(ca.original_rating) as avg_original,
        AVG(ca.adjusted_rating) as avg_adjusted
      FROM calibration_adjustments ca
      JOIN employees e ON ca.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE ca.calibration_session_id = $1 AND ca.tenant_id = $2
      GROUP BY d.id, d.name
      ORDER BY d.name
    `,
      [sessionId, tenantId]
    );

    res.json({
      success: true,
      data: {
        original_distribution: original.rows,
        adjusted_distribution: adjusted.rows,
        by_org_unit: byDepartment.rows,
      },
    });
  })
);

/**
 * POST /calibration-sessions/:id/apply-adjustments
 * Apply calibration adjustments to performance reviews
 */
router.post(
  '/:id/apply-adjustments',
  requirePermission('PERFORMANCE', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['id'] as string;

    // Verify session is completed
    const sessionCheck = await req.dbClient!.query(
      'SELECT status FROM calibration_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );
    if (sessionCheck.rows.length === 0) {
      throw Errors.notFound('Calibration session');
    }
    if (sessionCheck.rows[0].status !== 'completed') {
      res
        .status(400)
        .json({ success: false, error: 'Can only apply adjustments from completed sessions' });
      return;
    }

    // Get all adjustments with performance_review_id
    const adjustments = await req.dbClient!.query(
      `
      SELECT id, performance_review_id, adjusted_rating
      FROM calibration_adjustments
      WHERE session_id = $1 AND tenant_id = $2
        AND performance_review_id IS NOT NULL
        AND adjusted_rating IS NOT NULL
        AND applied_at IS NULL
    `,
      [sessionId, tenantId]
    );

    // Batch update: apply all calibration adjustments in 2 queries instead of 2N
    const adjIds = adjustments.rows.map((a: Record<string, string>) => a.id);
    const appliedCount = adjustments.rows.length;

    if (appliedCount > 0) {
      // Update performance reviews from calibration adjustments
      await req.dbClient!.query(
        `
        UPDATE performance_reviews pr SET
          overall_rating = ca.adjusted_rating,
          calibrated = true,
          calibration_session_id = $1,
          updated_at = NOW()
        FROM calibration_adjustments ca
        WHERE pr.id = ca.performance_review_id
          AND pr.tenant_id = $2
          AND ca.id = ANY($3)
      `,
        [sessionId, tenantId, adjIds]
      );

      // Mark adjustments as applied
      await req.dbClient!.query(
        `
        UPDATE calibration_adjustments SET
          applied_at = NOW(),
          updated_at = NOW()
        WHERE id = ANY($1)
      `,
        [adjIds]
      );
    }

    res.json({
      success: true,
      message: `${appliedCount} adjustments applied to performance reviews`,
      data: { applied_count: appliedCount },
    });
  })
);

export default router;
