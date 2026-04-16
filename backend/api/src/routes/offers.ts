/**
 * Recruiting Offers Routes
 * CRUD operations for job offers
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { withTransaction } from '../utils/transaction.js';
import { validate } from '../middleware/validate.js';
import {
  createOfferSchema,
  updateOfferSchema,
  approveOfferSchema,
  declineOfferSchema,
} from '../schemas/compensation-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /offers/stats
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
      COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
      COUNT(*) FILTER (WHERE status = 'declined') as declined,
      ROUND(AVG(salary_offered), 0) as avg_salary_offered
    FROM recruiting_offers WHERE tenant_id = $1
  `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /offers/pending
 */
router.get(
  '/pending',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
    SELECT o.*,
      c.first_name || ' ' || c.last_name as candidate_name,
      c.email as candidate_email,
      r.title as requisition_title
    FROM recruiting_offers o
    JOIN recruiting_candidates c ON o.candidate_id = c.id
    LEFT JOIN recruiting_requisitions r ON o.requisition_id = r.id
    WHERE o.tenant_id = $1
      AND o.status IN ('pending_approval', 'approved', 'sent')
    ORDER BY o.expiry_date ASC NULLS LAST
  `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /offers
 */
router.get(
  '/',
  requirePermission('RECRUITMENT', 'VIEW'),
  applyScopeFilter('RECRUITMENT'),
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req);
    const {
      candidate_id,
      requisition_id,
      status,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    const scope = getScopeCondition(req, 'o');
    let query = `
    SELECT o.*,
      c.first_name || ' ' || c.last_name as candidate_name,
      c.email as candidate_email,
      r.title as requisition_title
    FROM recruiting_offers o
    JOIN recruiting_candidates c ON o.candidate_id = c.id
    LEFT JOIN recruiting_requisitions r ON o.requisition_id = r.id
    WHERE ${scope.where}
  `;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (candidate_id) {
      query += ` AND o.candidate_id = $${paramIndex}`;
      params.push(candidate_id as string);
      paramIndex++;
    }

    if (requisition_id) {
      query += ` AND o.requisition_id = $${paramIndex}`;
      params.push(requisition_id as string);
      paramIndex++;
    }

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM recruiting_offers o WHERE ${scope.where}`,
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
 * GET /offers/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    SELECT o.*,
      c.first_name || ' ' || c.last_name as candidate_name,
      c.email as candidate_email,
      c.phone as candidate_phone,
      r.title as requisition_title,
      r.department as requisition_org_unit,
      ap.first_name || ' ' || ap.last_name as approved_by_name
    FROM recruiting_offers o
    JOIN recruiting_candidates c ON o.candidate_id = c.id
    LEFT JOIN recruiting_requisitions r ON o.requisition_id = r.id
    LEFT JOIN employees ap ON o.approved_by = ap.id
    WHERE o.id = $1 AND o.tenant_id = $2
  `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Offer', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /offers
 */
router.post(
  '/',
  requirePermission('RECRUITMENT', 'CREATE'),
  validate(createOfferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      candidate_id,
      requisition_id,
      salary_offered,
      currency = 'EUR',
      bonus_offered,
      equity_offered,
      start_date,
      expiry_date,
      job_title,
      department,
      location,
      employment_type,
      benefits,
      notes,
    } = req.body;

    if (!candidate_id || !salary_offered) {
      throw Errors.badRequest('candidate_id and salary_offered are required');
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
    INSERT INTO recruiting_offers (tenant_id, candidate_id, requisition_id, status, salary_offered, currency,
      bonus_offered, equity_offered, start_date, expiry_date, job_title, department, location,
      employment_type, benefits, notes, created_at, updated_at)
    VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING *
  `,
      [
        tenantId,
        candidate_id,
        requisition_id,
        salary_offered,
        currency,
        bonus_offered,
        equity_offered,
        start_date,
        expiry_date,
        job_title,
        department,
        location,
        employment_type,
        benefits,
        notes,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] || null, message: 'Offer created' });
  })
);

/**
 * PATCH /offers/:id
 */
router.patch(
  '/:id',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(updateOfferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id, status FROM recruiting_offers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Offer', id);
    }

    // Cannot edit sent/accepted/declined offers
    if (['sent', 'accepted', 'declined'].includes(existing.rows[0].status)) {
      throw Errors.badRequest('Cannot modify offer in current status');
    }

    const allowedFields = [
      'salary_offered',
      'currency',
      'bonus_offered',
      'equity_offered',
      'start_date',
      'expiry_date',
      'job_title',
      'department',
      'location',
      'employment_type',
      'benefits',
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
      `UPDATE recruiting_offers SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Offer updated' });
  })
);

/**
 * POST /offers/:id/approve
 */
router.post(
  '/:id/approve',
  requirePermission('RECRUITMENT', 'APPROVE'),
  validate(approveOfferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { approved_by } = req.body;

    const result = await req.dbClient!.query(
      `
    UPDATE recruiting_offers SET
      status = 'approved',
      approved_by = $1,
      approved_at = NOW(),
      updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3 AND status IN ('draft', 'pending_approval')
    RETURNING *
  `,
      [approved_by, id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Offer', 'not found or cannot be approved');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Offer approved' });
  })
);

/**
 * POST /offers/:id/send
 */
router.post(
  '/:id/send',
  requirePermission('RECRUITMENT', 'EDIT'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Update offer and candidate stage atomically
    const result = await withTransaction(async (client) => {
      const updateResult = await client.query(
        `
      UPDATE recruiting_offers SET
        status = 'sent',
        sent_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'approved'
      RETURNING *
    `,
        [id, tenantId]
      );

      if (updateResult.rows.length === 0) {
        return null;
      }

      // Update candidate stage to offer
      await client.query(
        "UPDATE recruiting_candidates SET stage = 'offer', last_activity = NOW() WHERE id = $1",
        [updateResult.rows[0]?.candidate_id]
      );

      return updateResult.rows[0];
    }, tenantId);

    if (!result) {
      throw Errors.notFound('Offer', 'not found or not approved');
    }

    res.json({ success: true, data: result, message: 'Offer sent' });
  })
);

/**
 * POST /offers/:id/accept
 */
router.post(
  '/:id/accept',
  requirePermission('RECRUITMENT', 'APPROVE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Update offer, candidate, and requisition atomically
    const result = await withTransaction(async (client) => {
      const updateResult = await client.query(
        `
      UPDATE recruiting_offers SET
        status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'sent'
      RETURNING *
    `,
        [id, tenantId]
      );

      if (updateResult.rows.length === 0) {
        return null;
      }

      // Update candidate stage to hired
      await client.query(
        "UPDATE recruiting_candidates SET stage = 'hired', last_activity = NOW() WHERE id = $1",
        [updateResult.rows[0]?.candidate_id]
      );

      // Close requisition if filled
      if (updateResult.rows[0].requisition_id) {
        await client.query(
          `
        UPDATE recruiting_requisitions SET status = 'filled', closed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND headcount <= (SELECT COUNT(*) FROM recruiting_offers WHERE requisition_id = $1 AND status = 'accepted')
      `,
          [updateResult.rows[0]?.requisition_id]
        );
      }

      return updateResult.rows[0];
    }, tenantId);

    if (!result) {
      throw Errors.notFound('Offer', 'not found or not sent');
    }

    res.json({ success: true, data: result, message: 'Offer accepted' });
  })
);

/**
 * POST /offers/:id/decline
 */
router.post(
  '/:id/decline',
  requirePermission('RECRUITMENT', 'APPROVE'),
  validate(declineOfferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { reason } = req.body;

    const result = await req.dbClient!.query(
      `
    UPDATE recruiting_offers SET
      status = 'declined',
      responded_at = NOW(),
      notes = COALESCE(notes || E'\n', '') || $1,
      updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3 AND status = 'sent'
    RETURNING *
  `,
      [reason ? `Decline reason: ${reason}` : 'Declined', id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Offer', 'not found or not sent');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Offer declined' });
  })
);

/**
 * DELETE /offers/:id
 */
router.delete(
  '/:id',
  requirePermission('RECRUITMENT', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      "DELETE FROM recruiting_offers WHERE id = $1 AND tenant_id = $2 AND status = 'draft' RETURNING id",
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Offer', 'not found or cannot be deleted');
    }

    res.json({ success: true, message: 'Offer deleted' });
  })
);

export default router;
