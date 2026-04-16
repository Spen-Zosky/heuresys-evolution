/**
 * Review Cycles Routes
 * CRUD operations for review cycles
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { cachedForTenant, invalidateCachePattern, CACHE_TTL } from '../services/cache.js';
import {
  createReviewCycleSchema,
  updateReviewCycleSchema,
  addCycleParticipantsSchema,
  updateCycleParticipantSchema,
  addCyclePhasesSchema,
  updateCyclePhaseSchema,
  closeCycleSchema,
  createTemplateSchema,
  updateTemplateSchema,
  autoAssignParticipantsSchema,
} from '../schemas/performance.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { withTransaction } from '../utils/transaction.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { performanceManagementService } from '../services/performance-management.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /review-cycles
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, cycle_type, limit = '100', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT rc.id, rc.tenant_id, rc.name, rc.description, rc.cycle_type,
        rc.start_date, rc.end_date, rc.status, rc.created_at, rc.updated_at,
        rc.self_review_deadline, rc.manager_review_deadline, rc.calibration_deadline,
        rc.feedback_deadline, rc.acknowledgment_deadline,
        rc.include_self_review, rc.include_peer_review, rc.include_360_feedback,
        rc.require_goal_assessment, rc.require_competency_rating,
        rc.rating_scale_type, rc.launched_at, rc.completed_at, rc.template_id,
        COALESCE(pr_counts.review_count, 0) as review_count,
        COALESCE(f_counts.feedback_count, 0) as feedback_count
      FROM review_cycles rc
      LEFT JOIN (
        SELECT pr.tenant_id, pr.review_period_start, pr.review_period_end, COUNT(*) as review_count
        FROM performance_reviews pr
        GROUP BY pr.tenant_id, pr.review_period_start, pr.review_period_end
      ) pr_counts ON pr_counts.review_period_start >= rc.start_date
        AND pr_counts.review_period_end <= rc.end_date
        AND pr_counts.tenant_id = rc.tenant_id
      LEFT JOIN (
        SELECT review_cycle_id, COUNT(*) as feedback_count
        FROM feedback_360
        GROUP BY review_cycle_id
      ) f_counts ON f_counts.review_cycle_id = rc.id
      WHERE rc.tenant_id = $1
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND rc.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (cycle_type) {
      query += ` AND rc.cycle_type = $${paramIndex}`;
      params.push(cycle_type as string);
      paramIndex++;
    }

    query += ` ORDER BY rc.start_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM review_cycles WHERE tenant_id = $1',
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
 * GET /review-cycles/active
 */
router.get(
  '/active',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const data = await cachedForTenant(
      tenantId,
      'review-cycles:active',
      async () => {
        const result = await req.dbClient!.query(
          `
          SELECT id, tenant_id, name, description, cycle_type,
        start_date, end_date, status, created_at, updated_at,
        self_review_deadline, manager_review_deadline, calibration_deadline,
        feedback_deadline, acknowledgment_deadline,
        include_self_review, include_peer_review, include_360_feedback,
        require_goal_assessment, require_competency_rating,
        rating_scale_type, launched_at, completed_at, template_id
      FROM review_cycles
          WHERE tenant_id = $1 AND status = 'active' AND start_date <= NOW() AND end_date >= NOW()
          ORDER BY start_date
          LIMIT 50
        `,
          [tenantId]
        );
        return result.rows;
      },
      CACHE_TTL.REFERENCE
    );

    res.json({ success: true, data });
  })
);

/**
 * GET /review-cycles/stats
 * Get overall review cycle statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_cycles,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_cycles,
        COUNT(*) FILTER (WHERE status = 'active') as active_cycles,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_cycles,
        (
          SELECT COUNT(*)
          FROM review_cycle_participants rcp
          WHERE rcp.tenant_id = $1
        ) as total_participants_ever,
        (
          SELECT AVG(
            CASE
              WHEN total > 0 THEN completed::numeric / total * 100
              ELSE 0
            END
          )
          FROM (
            SELECT
              review_cycle_id,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'completed') as completed
            FROM review_cycle_participants
            WHERE tenant_id = $1
            GROUP BY review_cycle_id
          ) cycle_stats
        ) as avg_completion_rate
      FROM review_cycles
      WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /review-cycles/:id
 */
router.get(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT rc.id, rc.tenant_id, rc.name, rc.description, rc.cycle_type,
        rc.start_date, rc.end_date, rc.status, rc.created_at, rc.updated_at,
        rc.self_review_deadline, rc.manager_review_deadline, rc.calibration_deadline,
        rc.feedback_deadline, rc.acknowledgment_deadline,
        rc.include_self_review, rc.include_peer_review, rc.include_360_feedback,
        rc.require_goal_assessment, rc.require_competency_rating,
        rc.rating_scale_type, rc.launched_at, rc.completed_at, rc.template_id,
        (SELECT COUNT(*) FROM performance_reviews pr WHERE pr.review_period_start >= rc.start_date AND pr.review_period_end <= rc.end_date AND pr.tenant_id = rc.tenant_id) as review_count,
        (SELECT COUNT(*) FROM feedback_360 f WHERE f.review_cycle_id = rc.id) as feedback_count
      FROM review_cycles rc
      WHERE rc.id = $1 AND rc.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /review-cycles
 */
router.post(
  '/',
  requirePermission('PERFORMANCE', 'CREATE'),
  validate(createReviewCycleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, cycle_type, start_date, end_date, status = 'draft' } = req.body;

    if (!name || !start_date || !end_date) {
      res
        .status(400)
        .json({ success: false, error: 'Name, start date, and end date are required' });
      return;
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO review_cycles (tenant_id, name, description, cycle_type, start_date, end_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `,
      [tenantId, name, description, cycle_type, start_date, end_date, status]
    );

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Review cycle created' });
  })
);

/**
 * PATCH /review-cycles/:id
 */
router.patch(
  '/:id',
  validateUUID(),
  requirePermission('PERFORMANCE', 'EDIT'),
  validate(updateReviewCycleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }

    const allowedFields = ['name', 'description', 'cycle_type', 'start_date', 'end_date', 'status'];
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
      `UPDATE review_cycles SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({ success: true, data: result.rows[0] || null, message: 'Review cycle updated' });
  })
);

/**
 * DELETE /review-cycles/:id
 */
router.delete(
  '/:id',
  validateUUID(),
  requirePermission('PERFORMANCE', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Check for associated data
    const feedbackCount = await req.dbClient!.query(
      'SELECT COUNT(*) FROM feedback_360 WHERE review_cycle_id = $1',
      [id]
    );
    if (parseInt(feedbackCount.rows[0].count) > 0) {
      res
        .status(400)
        .json({ success: false, error: 'Cannot delete review cycle with associated feedback' });
      return;
    }

    const result = await req.dbClient!.query(
      'DELETE FROM review_cycles WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({ success: true, message: 'Review cycle deleted' });
  })
);

// ============================================================================
// ADVANCED REVIEW CYCLE FEATURES - Story 9.3: Performance Review Cycles
// ============================================================================

/**
 * GET /review-cycles/:id/details
 * Get detailed review cycle with participants and progress
 */
router.get(
  '/:id/details',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;

    // Get cycle with detailed metrics
    const cycleResult = await req.dbClient!.query(
      `
      SELECT rc.id, rc.tenant_id, rc.name, rc.description, rc.cycle_type,
        rc.start_date, rc.end_date, rc.status, rc.created_at, rc.updated_at,
        rc.self_review_deadline, rc.manager_review_deadline, rc.calibration_deadline,
        rc.feedback_deadline, rc.acknowledgment_deadline,
        rc.include_self_review, rc.include_peer_review, rc.include_360_feedback,
        rc.require_goal_assessment, rc.require_competency_rating,
        rc.rating_scale_type, rc.launched_at, rc.completed_at, rc.template_id,
        (SELECT COUNT(*) FROM review_cycle_participants rcp WHERE rcp.review_cycle_id = rc.id) as total_participants,
        (SELECT COUNT(*) FROM review_cycle_participants rcp WHERE rcp.review_cycle_id = rc.id AND rcp.status = 'completed') as completed_participants,
        (SELECT COUNT(*) FROM review_cycle_participants rcp WHERE rcp.review_cycle_id = rc.id AND rcp.status = 'in_progress') as in_progress_participants,
        (SELECT COUNT(*) FROM performance_reviews pr WHERE pr.review_period_start >= rc.start_date AND pr.review_period_end <= rc.end_date AND pr.tenant_id = rc.tenant_id) as review_count,
        (SELECT COUNT(*) FROM feedback_360 f WHERE f.review_cycle_id = rc.id) as feedback_count,
        (SELECT COUNT(*) FROM feedback_360 f WHERE f.review_cycle_id = rc.id AND f.status = 'submitted') as submitted_feedback_count
      FROM review_cycles rc
      WHERE rc.id = $1 AND rc.tenant_id = $2
    `,
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }

    const cycle = cycleResult.rows[0];

    // Calculate completion percentage
    const totalParticipants = safeParseInt(cycle.total_participants, { fallback: 0 });
    const completedParticipants = safeParseInt(cycle.completed_participants, { fallback: 0 });
    cycle.completion_percentage =
      totalParticipants > 0 ? Math.round((completedParticipants / totalParticipants) * 100) : 0;

    res.json({ success: true, data: cycle });
  })
);

/**
 * GET /review-cycles/:id/participants
 * Get all participants in a review cycle
 */
router.get(
  '/:id/participants',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;
    const {
      status,
      manager_id,
      org_unit_id,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    const participants = await performanceManagementService.getReviewCycleParticipants(
      tenantId,
      cycleId,
      {
        status: status as string,
        managerId: manager_id as string,
        orgUnitId: org_unit_id as string,
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      }
    );

    res.json({
      success: true,
      data: participants.participants,
      status_summary: participants.status_summary,
      meta: {
        total: participants.total,
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * POST /review-cycles/:id/participants
 * Add participants to a review cycle
 */
router.post(
  '/:id/participants',
  validate(addCycleParticipantsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;
    const { employee_ids, org_unit_id, include_all } = req.body;

    // Verify cycle exists and is not completed
    const cycleCheck = await req.dbClient!.query(
      'SELECT id, status FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [cycleId, tenantId]
    );
    if (cycleCheck.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }
    if (cycleCheck.rows[0].status === 'completed') {
      res
        .status(400)
        .json({ success: false, error: 'Cannot add participants to a completed cycle' });
      return;
    }

    let participantIds: string[] = [];

    if (include_all) {
      // Add all active employees
      const employees = await req.dbClient!.query(
        'SELECT id FROM employees WHERE tenant_id = $1 AND status = $2',
        [tenantId, 'active']
      );
      participantIds = employees.rows.map((e) => e.id);
    } else if (org_unit_id) {
      // Add all employees from a department
      const employees = await req.dbClient!.query(
        'SELECT id FROM employees WHERE tenant_id = $1 AND org_unit_id = $2 AND status = $3',
        [tenantId, org_unit_id, 'active']
      );
      participantIds = employees.rows.map((e) => e.id);
    } else if (employee_ids && Array.isArray(employee_ids)) {
      participantIds = employee_ids;
    } else {
      res.status(400).json({
        success: false,
        error: 'employee_ids, org_unit_id, or include_all is required',
      });
      return;
    }

    if (participantIds.length === 0) {
      throw Errors.badRequest('No employees found to add');
    }

    const addedCount = await performanceManagementService.addReviewCycleParticipants(
      tenantId,
      cycleId,
      participantIds
    );

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.status(201).json({
      success: true,
      message: `${addedCount} participants added to review cycle`,
      data: { added_count: addedCount },
    });
  })
);

/**
 * GET /review-cycles/:id/participants/:participantId
 * Get a specific participant's details
 */
router.get(
  '/:id/participants/:participantId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const participantId = req.params['participantId'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT rcp.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        e.job_title,
        d.name as department_name,
        m.first_name || ' ' || m.last_name as manager_name
      FROM review_cycle_participants rcp
      JOIN employees e ON rcp.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees m ON rcp.manager_id = m.id
      WHERE rcp.id = $1 AND rcp.tenant_id = $2
    `,
      [participantId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Participant');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PATCH /review-cycles/:id/participants/:participantId
 * Update participant status
 */
router.patch(
  '/:id/participants/:participantId',
  validate(updateCycleParticipantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const participantId = req.params['participantId'] as string;
    const {
      status,
      notes,
      self_review_completed,
      manager_review_completed,
      calibration_completed,
    } = req.body;

    const additionalUpdates: Record<string, unknown> = {};
    if (notes !== undefined) additionalUpdates.notes = notes;
    if (self_review_completed !== undefined)
      additionalUpdates.self_review_completed = self_review_completed;
    if (manager_review_completed !== undefined)
      additionalUpdates.manager_review_completed = manager_review_completed;
    if (calibration_completed !== undefined)
      additionalUpdates.calibration_completed = calibration_completed;

    const participant = await performanceManagementService.updateParticipantStatus(
      tenantId,
      participantId,
      status,
      Object.keys(additionalUpdates).length > 0 ? additionalUpdates : undefined
    );

    if (!participant) {
      throw Errors.notFound('Participant');
    }

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({ success: true, data: participant, message: 'Participant updated' });
  })
);

/**
 * DELETE /review-cycles/:id/participants/:participantId
 * Remove a participant from a review cycle
 */
router.delete(
  '/:id/participants/:participantId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id: cycleId, participantId } = req.params as Record<string, string>;

    const result = await req.dbClient!.query(
      'DELETE FROM review_cycle_participants WHERE id = $1 AND review_cycle_id = $2 AND tenant_id = $3 RETURNING id',
      [participantId, cycleId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Participant');
    }

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({ success: true, message: 'Participant removed from review cycle' });
  })
);

/**
 * POST /review-cycles/:id/launch
 * Launch a review cycle (change status to active)
 */
router.post(
  '/:id/launch',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;

    // Verify cycle exists and is in draft status
    const cycleCheck = await req.dbClient!.query(
      'SELECT id, status, name FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [cycleId, tenantId]
    );
    if (cycleCheck.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }
    if (cycleCheck.rows[0].status !== 'draft') {
      throw Errors.badRequest('Only draft cycles can be launched');
    }

    // Check if there are participants
    const participantCount = await req.dbClient!.query(
      'SELECT COUNT(*) FROM review_cycle_participants WHERE review_cycle_id = $1',
      [cycleId]
    );
    if (parseInt(participantCount.rows[0].count) === 0) {
      throw Errors.badRequest('Cannot launch a cycle with no participants');
    }

    // Launch cycle within a transaction to ensure atomicity
    const result = await withTransaction(async (txClient) => {
      const updateResult = await txClient.query(
        `
        UPDATE review_cycles SET
          status = 'active',
          launched_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `,
        [cycleId, tenantId]
      );

      // Update all participants to pending status
      await txClient.query(
        `
        UPDATE review_cycle_participants SET
          status = 'pending',
          updated_at = NOW()
        WHERE review_cycle_id = $1 AND status = 'draft'
      `,
        [cycleId]
      );

      return updateResult.rows[0];
    }, tenantId);

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({
      success: true,
      data: result,
      message: 'Review cycle launched successfully',
    });
  })
);

/**
 * POST /review-cycles/:id/close
 * Close a review cycle
 */
router.post(
  '/:id/close',
  validate(closeCycleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;
    const { force = false } = req.body;

    // Verify cycle exists and is active
    const cycleCheck = await req.dbClient!.query(
      'SELECT id, status FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [cycleId, tenantId]
    );
    if (cycleCheck.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }
    if (cycleCheck.rows[0].status !== 'active') {
      throw Errors.badRequest('Only active cycles can be closed');
    }

    // Check for incomplete participants unless force is true
    if (!force) {
      const incompleteCount = await req.dbClient!.query(
        "SELECT COUNT(*) FROM review_cycle_participants WHERE review_cycle_id = $1 AND status != 'completed'",
        [cycleId]
      );
      if (parseInt(incompleteCount.rows[0].count) > 0) {
        res.status(400).json({
          success: false,
          error: 'There are incomplete participants. Use force=true to close anyway.',
          incomplete_count: parseInt(incompleteCount.rows[0]?.count),
        });
        return;
      }
    }

    // Update status to completed
    const result = await req.dbClient!.query(
      `
      UPDATE review_cycles SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
      [cycleId, tenantId]
    );

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Review cycle closed successfully',
    });
  })
);

/**
 * GET /review-cycles/:id/progress
 * Get progress summary for a review cycle
 */
router.get(
  '/:id/progress',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_participants,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE self_review_completed = true) as self_review_completed_count,
        COUNT(*) FILTER (WHERE manager_review_completed = true) as manager_review_completed_count,
        COUNT(*) FILTER (WHERE calibration_completed = true) as calibration_completed_count,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*)::numeric, 0) * 100,
          2
        ) as completion_percentage
      FROM review_cycle_participants
      WHERE review_cycle_id = $1 AND tenant_id = $2
    `,
      [cycleId, tenantId]
    );

    // Progress by department
    const byDepartment = await req.dbClient!.query(
      `
      SELECT
        d.id as org_unit_id,
        d.name as department_name,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rcp.status = 'completed') as completed,
        ROUND(
          COUNT(*) FILTER (WHERE rcp.status = 'completed')::numeric / NULLIF(COUNT(*)::numeric, 0) * 100,
          2
        ) as completion_percentage
      FROM review_cycle_participants rcp
      JOIN employees e ON rcp.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE rcp.review_cycle_id = $1 AND rcp.tenant_id = $2
      GROUP BY d.id, d.name
      ORDER BY d.name
    `,
      [cycleId, tenantId]
    );

    res.json({
      success: true,
      data: {
        summary: result.rows[0],
        by_org_unit: byDepartment.rows,
      },
    });
  })
);

// ============================================================================
// PHASE MANAGEMENT - S-PERF-01-01
// ============================================================================

/**
 * GET /review-cycles/:id/phases
 * Get all phases for a review cycle
 */
router.get(
  '/:id/phases',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT id, tenant_id, review_cycle_id, phase_name, phase_order,
        start_date, end_date, status, instructions, reminder_days_before,
        escalation_days_after, is_required, created_at, updated_at
      FROM review_cycle_phases
      WHERE review_cycle_id = $1 AND tenant_id = $2
      ORDER BY phase_order
      LIMIT 50
    `,
      [cycleId, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /review-cycles/:id/phases
 * Add phases to a review cycle
 */
router.post(
  '/:id/phases',
  validate(addCyclePhasesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;
    const { phases } = req.body;

    if (!Array.isArray(phases) || phases.length === 0) {
      throw Errors.badRequest('phases array is required');
    }

    // Verify cycle exists
    const cycleCheck = await req.dbClient!.query(
      'SELECT id, status FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [cycleId, tenantId]
    );
    if (cycleCheck.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }

    const insertedPhases = [];
    for (const phase of phases) {
      const result = await req.dbClient!.query(
        `
        INSERT INTO review_cycle_phases (
          tenant_id, review_cycle_id, phase_name, phase_order, start_date, end_date,
          instructions, reminder_days_before, escalation_days_after, is_required
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (review_cycle_id, phase_name) DO UPDATE SET
          phase_order = EXCLUDED.phase_order,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          instructions = EXCLUDED.instructions,
          updated_at = NOW()
        RETURNING *
      `,
        [
          tenantId,
          cycleId,
          phase.phase_name,
          phase.phase_order,
          phase.start_date,
          phase.end_date,
          phase.instructions,
          phase.reminder_days_before || 3,
          phase.escalation_days_after || 2,
          phase.is_required !== false,
        ]
      );
      insertedPhases.push(result.rows[0]);
    }

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.status(201).json({
      success: true,
      data: insertedPhases,
      message: `${insertedPhases.length} phases configured`,
    });
  })
);

/**
 * PATCH /review-cycles/:id/phases/:phaseId
 * Update a specific phase
 */
router.patch(
  '/:id/phases/:phaseId',
  validate(updateCyclePhaseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id: cycleId, phaseId } = req.params as Record<string, string>;
    const { status, start_date, end_date, instructions, is_required } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(end_date);
    }
    if (instructions !== undefined) {
      updates.push(`instructions = $${paramIndex++}`);
      values.push(instructions);
    }
    if (is_required !== undefined) {
      updates.push(`is_required = $${paramIndex++}`);
      values.push(is_required);
    }

    values.push(phaseId, cycleId, tenantId);

    const result = await req.dbClient!.query(
      `
      UPDATE review_cycle_phases SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND review_cycle_id = $${paramIndex++} AND tenant_id = $${paramIndex}
      RETURNING *
    `,
      values
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Phase');
    }

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({ success: true, data: result.rows[0] || null, message: 'Phase updated' });
  })
);

// ============================================================================
// TEMPLATE MANAGEMENT - S-PERF-01-01
// ============================================================================

/**
 * GET /review-cycles/templates
 * Get all review templates
 */
router.get(
  '/config/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { is_active, template_type } = req.query as Record<string, string>;

    const cacheKey = `review-cycles:templates:${is_active ?? 'all'}:${template_type ?? 'all'}`;
    const data = await cachedForTenant(
      tenantId,
      cacheKey,
      async () => {
        let query = `SELECT id, tenant_id, name, description, template_type,
        rating_scale_type, rating_scale_config, sections, competencies,
        include_goals, include_development_plan, is_default, is_active,
        created_at, updated_at
      FROM performance_review_templates WHERE tenant_id = $1`;
        const params: (string | boolean | number)[] = [tenantId];
        let paramIndex = 2;

        if (is_active !== undefined) {
          query += ` AND is_active = $${paramIndex++}`;
          params.push(is_active === 'true');
        }
        if (template_type) {
          query += ` AND template_type = $${paramIndex++}`;
          params.push(template_type as string);
        }

        query += ' ORDER BY is_default DESC, name';

        const result = await req.dbClient!.query(query, params);
        return result.rows;
      },
      CACHE_TTL.REFERENCE
    );

    res.json({ success: true, data });
  })
);

/**
 * POST /review-cycles/templates
 * Create a review template
 */
router.post(
  '/config/templates',
  validate(createTemplateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      description,
      template_type,
      rating_scale_type,
      rating_scale_config,
      sections,
      competencies,
      include_goals,
      include_development_plan,
      is_default,
    } = req.body;

    if (!name || !sections) {
      throw Errors.badRequest('name and sections are required');
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await req.dbClient!.query(
        'UPDATE performance_review_templates SET is_default = false WHERE tenant_id = $1',
        [tenantId]
      );
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO performance_review_templates (
        tenant_id, name, description, template_type, rating_scale_type, rating_scale_config,
        sections, competencies, include_goals, include_development_plan, is_default, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *
    `,
      [
        tenantId,
        name,
        description,
        template_type || 'standard',
        rating_scale_type || '1-5',
        rating_scale_config || { min: 1, max: 5, labels: [] },
        JSON.stringify(sections),
        competencies ? JSON.stringify(competencies) : null,
        include_goals !== false,
        include_development_plan !== false,
        is_default || false,
      ]
    );

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Template created' });
  })
);

/**
 * GET /review-cycles/templates/:templateId
 * Get a specific template
 */
router.get(
  '/config/templates/:templateId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const templateId = req.params['templateId'] as string;

    const result = await req.dbClient!.query(
      `SELECT id, tenant_id, name, description, template_type,
        rating_scale_type, rating_scale_config, sections, competencies,
        include_goals, include_development_plan, is_default, is_active,
        created_at, updated_at
      FROM performance_review_templates WHERE id = $1 AND tenant_id = $2`,
      [templateId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Template');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PATCH /review-cycles/templates/:templateId
 * Update a template
 */
router.patch(
  '/config/templates/:templateId',
  validate(updateTemplateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const templateId = req.params['templateId'] as string;

    const allowedFields = [
      'name',
      'description',
      'template_type',
      'rating_scale_type',
      'rating_scale_config',
      'sections',
      'competencies',
      'include_goals',
      'include_development_plan',
      'is_default',
      'is_active',
    ];
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (
          ['sections', 'competencies', 'rating_scale_config'].includes(field) &&
          typeof value === 'object'
        ) {
          value = JSON.stringify(value);
        }
        updates.push(`${field} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updates.length === 1) {
      throw Errors.badRequest('No fields to update');
    }

    // Handle is_default
    if (req.body.is_default === true) {
      await req.dbClient!.query(
        'UPDATE performance_review_templates SET is_default = false WHERE tenant_id = $1 AND id != $2',
        [tenantId, templateId]
      );
    }

    values.push(templateId, tenantId);
    const result = await req.dbClient!.query(
      `UPDATE performance_review_templates SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Template');
    }

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({ success: true, data: result.rows[0] || null, message: 'Template updated' });
  })
);

// ============================================================================
// AUTO-ASSIGN PARTICIPANTS - S-PERF-01-01
// ============================================================================

/**
 * POST /review-cycles/:id/auto-assign
 * Auto-assign participants based on criteria
 */
router.post(
  '/:id/auto-assign',
  validate(autoAssignParticipantsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;
    const { org_unit_ids, employee_status = 'active' } = req.body;

    // Verify cycle exists and is not completed
    const cycleCheck = await req.dbClient!.query(
      'SELECT id, status FROM review_cycles WHERE id = $1 AND tenant_id = $2',
      [cycleId, tenantId]
    );
    if (cycleCheck.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }
    if (cycleCheck.rows[0].status === 'completed') {
      res
        .status(400)
        .json({ success: false, error: 'Cannot add participants to a completed cycle' });
      return;
    }

    const result = await req.dbClient!.query(
      'SELECT fn_auto_assign_review_participants($1, $2, $3, $4) as count',
      [tenantId, cycleId, org_unit_ids || null, employee_status]
    );

    const addedCount = result.rows[0]?.count;

    await invalidateCachePattern(`t:${tenantId}:review-cycles:*`);
    res.json({
      success: true,
      message: `${addedCount} participants auto-assigned`,
      data: { added_count: addedCount },
    });
  })
);

// ============================================================================
// RATING SCALE CONFIG - S-PERF-01-01
// ============================================================================

/**
 * GET /review-cycles/config/rating-scales
 * Get available rating scale configurations
 */
router.get(
  '/config/rating-scales',
  asyncHandler(async (_req: Request, res: Response) => {
    const scales = [
      {
        type: '1-5',
        config: {
          min: 1,
          max: 5,
          labels: [
            'Needs Improvement',
            'Below Expectations',
            'Meets Expectations',
            'Exceeds Expectations',
            'Outstanding',
          ],
        },
      },
      {
        type: '1-10',
        config: {
          min: 1,
          max: 10,
          labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        },
      },
      {
        type: 'descriptive',
        config: {
          min: 1,
          max: 4,
          labels: ['Does Not Meet', 'Partially Meets', 'Fully Meets', 'Exceeds'],
        },
      },
    ];

    res.json({ success: true, data: scales });
  })
);

// ============================================================================
// SUMMARY VIEW - S-PERF-01-01
// ============================================================================

/**
 * GET /review-cycles/:id/summary
 * Get comprehensive summary using the view
 */
router.get(
  '/:id/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const cycleId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'SELECT * FROM v_review_cycle_summary WHERE id = $1 AND tenant_id = $2',
      [cycleId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Review cycle');
    }

    // Get phases
    const phases = await req.dbClient!.query(
      `SELECT id, tenant_id, review_cycle_id, phase_name, phase_order,
        start_date, end_date, status, instructions, reminder_days_before,
        escalation_days_after, is_required, created_at, updated_at
      FROM review_cycle_phases WHERE review_cycle_id = $1 ORDER BY phase_order LIMIT 50`,
      [cycleId]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        phases: phases.rows,
      },
    });
  })
);

export default router;
