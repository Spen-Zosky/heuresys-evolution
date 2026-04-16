/**
 * OKRs Routes
 * CRUD operations for Objectives and Key Results
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createOkrSchema,
  updateOkrSchema,
  updateOkrProgressSchema,
  createKeyResultSchema,
  updateKeyResultSchema,
  updateKeyResultProgressSchema,
  createOkrCheckinSchema,
} from '../schemas/okrs.js';
import { performanceManagementService } from '../services/performance-management.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /okrs/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        ROUND(AVG(overall_progress), 2) as avg_progress,
        ROUND(AVG(confidence_level), 2) as avg_confidence
      FROM okrs WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /okrs
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      owner_id,
      status,
      okr_type,
      department,
      period_type,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT o.*,
        e.first_name || ' ' || e.last_name as owner_name
      FROM okrs o
      LEFT JOIN employees e ON o.owner_id = e.id
      WHERE o.tenant_id = $1
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (owner_id) {
      query += ` AND o.owner_id = $${paramIndex}`;
      params.push(owner_id as string);
      paramIndex++;
    }

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (okr_type) {
      query += ` AND o.okr_type = $${paramIndex}`;
      params.push(okr_type as string);
      paramIndex++;
    }

    if (department) {
      query += ` AND o.department = $${paramIndex}`;
      params.push(department as string);
      paramIndex++;
    }

    if (period_type) {
      query += ` AND o.period_type = $${paramIndex}`;
      params.push(period_type as string);
      paramIndex++;
    }

    query += ` ORDER BY o.period_start DESC, o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM okrs WHERE tenant_id = $1',
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
 * GET /okrs/current
 */
router.get(
  '/current',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT o.*,
        e.first_name || ' ' || e.last_name as owner_name
      FROM okrs o
      LEFT JOIN employees e ON o.owner_id = e.id
      WHERE o.tenant_id = $1
        AND o.status = 'active'
        AND o.period_start <= NOW()
        AND o.period_end >= NOW()
      ORDER BY o.okr_type, o.department
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /okrs/by-period
 * Get OKRs grouped by period
 */
router.get(
  '/by-period',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { year } = req.query as Record<string, string>;

    let query = `
      SELECT
        period_type,
        EXTRACT(YEAR FROM period_start) as year,
        EXTRACT(QUARTER FROM period_start) as quarter,
        COUNT(*) as total_okrs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        ROUND(AVG(overall_progress), 2) as avg_progress,
        ROUND(AVG(confidence_level), 2) as avg_confidence
      FROM okrs
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    const paramIndex = 2;

    if (year) {
      query += ` AND EXTRACT(YEAR FROM period_start) = $${paramIndex}`;
      params.push(parseInt(year as string));
    }

    query += `
      GROUP BY period_type, EXTRACT(YEAR FROM period_start), EXTRACT(QUARTER FROM period_start)
      ORDER BY year DESC, quarter DESC
    `;

    const result = await req.dbClient!.query(query, params);

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /okrs/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT o.*,
        e.first_name || ' ' || e.last_name as owner_name,
        e.email as owner_email,
        c.first_name || ' ' || c.last_name as created_by_name
      FROM okrs o
      LEFT JOIN employees e ON o.owner_id = e.id
      LEFT JOIN employees c ON o.created_by = c.id
      WHERE o.id = $1 AND o.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('OKR');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /okrs
 */
router.post(
  '/',
  validate(createOkrSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      objective,
      okr_type = 'individual',
      department,
      period_type = 'quarterly',
      period_start,
      period_end,
      status = 'draft',
      overall_progress = 0,
      confidence_level,
      owner_id,
      created_by,
    } = req.body;

    if (!objective) {
      throw Errors.badRequest('Objective is required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO okrs (tenant_id, objective, okr_type, department, period_type, period_start, period_end,
        status, overall_progress, confidence_level, owner_id, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        objective,
        okr_type,
        department,
        period_type,
        period_start,
        period_end,
        status,
        overall_progress,
        confidence_level,
        owner_id,
        created_by,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null, message: 'OKR created' });
  })
);

/**
 * PATCH /okrs/:id
 */
router.patch(
  '/:id',
  validate(updateOkrSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM okrs WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('OKR');
    }

    const allowedFields = [
      'objective',
      'okr_type',
      'department',
      'period_type',
      'period_start',
      'period_end',
      'status',
      'overall_progress',
      'confidence_level',
      'owner_id',
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
      `UPDATE okrs SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'OKR updated' });
  })
);

/**
 * PATCH /okrs/:id/progress
 */
router.patch(
  '/:id/progress',
  validate(updateOkrProgressSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { overall_progress, confidence_level } = req.body;

    if (overall_progress === undefined && confidence_level === undefined) {
      res
        .status(400)
        .json({ success: false, error: 'overall_progress or confidence_level required' });
      return;
    }

    const result = await req.dbClient!.query(
      `
      UPDATE okrs SET
        overall_progress = COALESCE($1, overall_progress),
        confidence_level = COALESCE($2, confidence_level),
        updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING id, overall_progress, confidence_level
    `,
      [overall_progress, confidence_level, id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('OKR');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Progress updated' });
  })
);

/**
 * DELETE /okrs/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM okrs WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('OKR');
    }

    res.json({ success: true, message: 'OKR deleted' });
  })
);

// ============================================================================
// ADVANCED OKR FEATURES - Story 9.2: OKR Tracking System
// ============================================================================

/**
 * GET /okrs/:id/details
 * Get OKR with all key results and progress summary
 */
router.get(
  '/:id/details',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const okrId = req.params['id'] as string;

    const details = await performanceManagementService.getOKRWithKeyResults(tenantId, okrId);

    if (!details.okr) {
      throw Errors.notFound('OKR');
    }

    res.json({ success: true, data: details });
  })
);

/**
 * GET /okrs/:id/key-results
 * Get all key results for an OKR
 */
router.get(
  '/:id/key-results',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const okrId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT kr.*,
        ROUND(
          CASE
            WHEN kr.target_value = kr.start_value THEN 100
            ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100
          END, 2
        ) as calculated_progress
      FROM key_results kr
      WHERE kr.okr_id = $1 AND kr.tenant_id = $2
      ORDER BY kr.weight DESC, kr.created_at
    `,
      [okrId, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * POST /okrs/:id/key-results
 * Create a new key result for an OKR
 */
router.post(
  '/:id/key-results',
  validate(createKeyResultSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const okrId = req.params['id'] as string;
    const {
      title,
      description,
      metric_type = 'percentage',
      unit,
      start_value = 0,
      target_value,
      current_value = 0,
      weight = 1,
      owner_id,
      due_date,
    } = req.body;

    if (!title) {
      throw Errors.badRequest('Title is required');
    }

    if (target_value === undefined) {
      throw Errors.badRequest('Target value is required');
    }

    // Verify OKR exists
    const okrCheck = await req.dbClient!.query(
      'SELECT id FROM okrs WHERE id = $1 AND tenant_id = $2',
      [okrId, tenantId]
    );
    if (okrCheck.rows.length === 0) {
      throw Errors.notFound('OKR');
    }

    const keyResult = await performanceManagementService.createKeyResult(tenantId, okrId, {
      title,
      description,
      metric_type,
      unit,
      start_value,
      target_value,
      current_value,
      weight,
      owner_id,
      due_date,
    });

    res.status(201).json({ success: true, data: keyResult, message: 'Key result created' });
  })
);

/**
 * GET /okrs/:id/key-results/:krId
 * Get a specific key result
 */
router.get(
  '/:id/key-results/:krId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const krId = req.params['krId'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT kr.*,
        e.first_name || ' ' || e.last_name as owner_name
      FROM key_results kr
      LEFT JOIN employees e ON kr.owner_id = e.id
      WHERE kr.id = $1 AND kr.tenant_id = $2
    `,
      [krId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Key result');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PATCH /okrs/:id/key-results/:krId
 * Update a key result
 */
router.patch(
  '/:id/key-results/:krId',
  validate(updateKeyResultSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const krId = req.params['krId'] as string;

    const allowedFields = [
      'title',
      'description',
      'metric_type',
      'unit',
      'start_value',
      'target_value',
      'current_value',
      'weight',
      'owner_id',
      'due_date',
      'status',
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
      `UPDATE key_results SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, krId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Key result');
    }

    // Recalculate OKR overall progress
    const okrId = result.rows[0]?.okr_id;
    await req.dbClient!.query(
      `
      UPDATE okrs SET
        overall_progress = (
          SELECT COALESCE(
            SUM(
              CASE
                WHEN kr.target_value = kr.start_value THEN 100 * kr.weight
                ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100 * kr.weight
              END
            ) / NULLIF(SUM(kr.weight), 0),
            0
          )
          FROM key_results kr
          WHERE kr.okr_id = $1 AND kr.tenant_id = $2
        ),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `,
      [okrId, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Key result updated' });
  })
);

/**
 * PATCH /okrs/:id/key-results/:krId/progress
 * Update key result progress (convenience endpoint)
 */
router.patch(
  '/:id/key-results/:krId/progress',
  validate(updateKeyResultProgressSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const krId = req.params['krId'] as string;
    const { current_value, confidence_level, notes } = req.body;

    if (current_value === undefined) {
      throw Errors.badRequest('current_value is required');
    }

    const keyResult = await performanceManagementService.updateKeyResultProgress(
      tenantId,
      krId,
      current_value,
      confidence_level
    );

    if (!keyResult) {
      throw Errors.notFound('Key result');
    }

    // Optionally create a check-in record
    if (notes) {
      await req.dbClient!.query(
        `
        INSERT INTO okr_checkins (tenant_id, okr_id, checkin_date, progress_snapshot, confidence_level, notes, created_at)
        SELECT $1, okr_id, NOW(), $2, $3, $4, NOW()
        FROM key_results WHERE id = $5
      `,
        [tenantId, current_value, confidence_level, notes, krId]
      );
    }

    res.json({ success: true, data: keyResult, message: 'Key result progress updated' });
  })
);

/**
 * DELETE /okrs/:id/key-results/:krId
 * Delete a key result
 */
router.delete(
  '/:id/key-results/:krId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id: okrId, krId } = req.params as Record<string, string>;

    const result = await req.dbClient!.query(
      'DELETE FROM key_results WHERE id = $1 AND okr_id = $2 AND tenant_id = $3 RETURNING id',
      [krId, okrId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Key result');
    }

    // Recalculate OKR overall progress
    await req.dbClient!.query(
      `
      UPDATE okrs SET
        overall_progress = (
          SELECT COALESCE(
            SUM(
              CASE
                WHEN kr.target_value = kr.start_value THEN 100 * kr.weight
                ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100 * kr.weight
              END
            ) / NULLIF(SUM(kr.weight), 0),
            0
          )
          FROM key_results kr
          WHERE kr.okr_id = $1 AND kr.tenant_id = $2
        ),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `,
      [okrId, tenantId]
    );

    res.json({ success: true, message: 'Key result deleted' });
  })
);

/**
 * GET /okrs/:id/checkins
 * Get check-in history for an OKR
 */
router.get(
  '/:id/checkins',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const okrId = req.params['id'] as string;
    const { limit = '20', offset = '0' } = req.query as Record<string, string>;

    const result = await req.dbClient!.query(
      `
      SELECT c.*,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM okr_checkins c
      LEFT JOIN employees e ON c.created_by = e.id
      WHERE c.okr_id = $1 AND c.tenant_id = $2
      ORDER BY c.checkin_date DESC
      LIMIT $3 OFFSET $4
    `,
      [
        okrId,
        tenantId,
        safeParseInt(limit as string, { fallback: 20 }),
        safeParseInt(offset as string, { fallback: 0 }),
      ]
    );

    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM okr_checkins WHERE okr_id = $1 AND tenant_id = $2',
      [okrId, tenantId]
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
 * POST /okrs/:id/checkins
 * Create a new check-in for an OKR
 */
router.post(
  '/:id/checkins',
  validate(createOkrCheckinSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const okrId = req.params['id'] as string;
    const {
      progress_snapshot,
      confidence_level,
      blockers,
      achievements,
      next_steps,
      notes,
      key_result_updates,
      created_by,
    } = req.body;

    // Verify OKR exists
    const okrCheck = await req.dbClient!.query(
      'SELECT id, overall_progress FROM okrs WHERE id = $1 AND tenant_id = $2',
      [okrId, tenantId]
    );
    if (okrCheck.rows.length === 0) {
      throw Errors.notFound('OKR');
    }

    const checkin = await performanceManagementService.createOKRCheckin(tenantId, okrId, {
      progress_snapshot: progress_snapshot ?? okrCheck.rows[0]?.overall_progress,
      confidence_level,
      blockers,
      achievements,
      next_steps,
      notes,
      key_result_updates,
      created_by,
    });

    res.status(201).json({ success: true, data: checkin, message: 'Check-in created' });
  })
);

/**
 * GET /okrs/:id/progress-history
 * Get progress trend over time
 */
router.get(
  '/:id/progress-history',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const okrId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT
        DATE(checkin_date) as date,
        AVG(progress_snapshot) as avg_progress,
        AVG(confidence_level) as avg_confidence,
        COUNT(*) as checkin_count
      FROM okr_checkins
      WHERE okr_id = $1 AND tenant_id = $2
      GROUP BY DATE(checkin_date)
      ORDER BY date
    `,
      [okrId, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

export default router;
