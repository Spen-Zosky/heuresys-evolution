/**
 * 360-Degree Reviews Routes
 * CRUD operations for feedback_360 within tenant context
 * Schema verified: id, tenant_id, target_employee_id, reviewer_employee_id,
 *   review_cycle_id, relationship_type, overall_rating, strengths,
 *   areas_for_improvement, is_anonymous, status, created_at, completed_at,
 *   questionnaire_id, performance_review_id, request_id, question_responses,
 *   sentiment_score, submission_time_seconds
 * Views: v_360_feedback_summary, v_360_response_rates
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors/middleware.js';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { safeParseInt } from '../utils/query-helpers.js';

const Create360ReviewSchema = z.object({
  target_employee_id: z.string().uuid(),
  reviewer_employee_id: z.string().uuid(),
  review_cycle_id: z.string().uuid().optional(),
  relationship_type: z.string().optional(),
  overall_rating: z.number().optional(),
  strengths: z.string().optional(),
  areas_for_improvement: z.string().optional(),
  is_anonymous: z.boolean().optional(),
  status: z.string().optional(),
  questionnaire_id: z.string().uuid().optional(),
  performance_review_id: z.string().uuid().optional(),
  request_id: z.string().uuid().optional(),
  question_responses: z.record(z.unknown()).optional(),
  sentiment_score: z.number().optional(),
  submission_time_seconds: z.number().int().optional(),
});

const Update360ReviewSchema = z.object({
  relationship_type: z.string().optional(),
  overall_rating: z.number().optional(),
  strengths: z.string().optional(),
  areas_for_improvement: z.string().optional(),
  is_anonymous: z.boolean().optional(),
  status: z.string().optional(),
  completed_at: z.string().optional(),
  question_responses: z.record(z.unknown()).optional(),
  sentiment_score: z.number().optional(),
  submission_time_seconds: z.number().int().optional(),
});

const router = Router();

router.use(requireTenant);

/**
 * GET /api/v1/360-reviews
 * List all 360 reviews for the current tenant (paginated)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      limit = '50',
      offset = '0',
      target_employee_id,
      reviewer_employee_id,
      status,
      review_cycle_id,
    } = req.query as Record<string, string>;

    let query = `
      SELECT
        f.id, f.tenant_id, f.target_employee_id, f.reviewer_employee_id,
        f.review_cycle_id, f.relationship_type, f.overall_rating,
        f.strengths, f.areas_for_improvement, f.is_anonymous,
        f.status, f.created_at, f.completed_at,
        f.questionnaire_id, f.performance_review_id, f.request_id,
        f.question_responses, f.sentiment_score, f.submission_time_seconds,
        te.first_name || ' ' || te.last_name AS target_employee_name,
        re.first_name || ' ' || re.last_name AS reviewer_employee_name
      FROM feedback_360 f
      LEFT JOIN employees te ON f.target_employee_id = te.id
      LEFT JOIN employees re ON f.reviewer_employee_id = re.id
      WHERE f.tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (target_employee_id) {
      query += ` AND f.target_employee_id = $${paramIndex}`;
      params.push(target_employee_id);
      paramIndex++;
    }
    if (reviewer_employee_id) {
      query += ` AND f.reviewer_employee_id = $${paramIndex}`;
      params.push(reviewer_employee_id);
      paramIndex++;
    }
    if (status) {
      query += ` AND f.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (review_cycle_id) {
      query += ` AND f.review_cycle_id = $${paramIndex}`;
      params.push(review_cycle_id);
      paramIndex++;
    }

    const MAX_LIMIT = 500;
    const parsedLimit = Math.min(safeParseInt(limit, { fallback: 50 }), MAX_LIMIT);
    const parsedOffset = safeParseInt(offset, { fallback: 0 });

    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parsedLimit, parsedOffset);

    const countQuery = `SELECT COUNT(*) FROM feedback_360 WHERE tenant_id = $1`;
    const [result, countResult] = await Promise.all([
      req.dbClient!.query(query, params),
      req.dbClient!.query(countQuery, [tenantId]),
    ]);

    const total = parseInt(countResult.rows[0]?.count);

    res.json({
      success: true,
      data: {
        items: result.rows,
        meta: {
          total,
          limit: parsedLimit,
          offset: parsedOffset,
        },
      },
    });
  })
);

/**
 * GET /api/v1/360-reviews/summary
 * Get aggregated 360 feedback summary from the view
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `SELECT * FROM v_360_feedback_summary WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /api/v1/360-reviews/response-rates
 * Get response rates from the view
 */
router.get(
  '/response-rates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `SELECT * FROM v_360_response_rates WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * POST /api/v1/360-reviews
 * Create new 360 review
 */
router.post(
  '/',
  validate(Create360ReviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      target_employee_id,
      reviewer_employee_id,
      review_cycle_id,
      relationship_type,
      overall_rating,
      strengths,
      areas_for_improvement,
      is_anonymous,
      status,
      questionnaire_id,
      performance_review_id,
      request_id,
      question_responses,
      sentiment_score,
      submission_time_seconds,
    } = req.body;

    const query = `
      INSERT INTO feedback_360 (
        tenant_id, target_employee_id, reviewer_employee_id,
        review_cycle_id, relationship_type, overall_rating,
        strengths, areas_for_improvement, is_anonymous, status,
        questionnaire_id, performance_review_id, request_id,
        question_responses, sentiment_score, submission_time_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const result = await req.dbClient!.query(query, [
      tenantId,
      target_employee_id,
      reviewer_employee_id,
      review_cycle_id || null,
      relationship_type || null,
      overall_rating || null,
      strengths || null,
      areas_for_improvement || null,
      is_anonymous ?? false,
      status || 'pending',
      questionnaire_id || null,
      performance_review_id || null,
      request_id || null,
      question_responses ? JSON.stringify(question_responses) : null,
      sentiment_score || null,
      submission_time_seconds || null,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * GET /api/v1/360-reviews/:id
 * Get single 360 review by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;

    const query = `
      SELECT
        f.*,
        te.first_name || ' ' || te.last_name AS target_employee_name,
        re.first_name || ' ' || re.last_name AS reviewer_employee_name
      FROM feedback_360 f
      LEFT JOIN employees te ON f.target_employee_id = te.id
      LEFT JOIN employees re ON f.reviewer_employee_id = re.id
      WHERE f.id = $1 AND f.tenant_id = $2
    `;

    const result = await req.dbClient!.query(query, [id, tenantId]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { message: '360 review not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * PUT /api/v1/360-reviews/:id
 * Update 360 review
 */
router.put(
  '/:id',
  validate(Update360ReviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const {
      relationship_type,
      overall_rating,
      strengths,
      areas_for_improvement,
      is_anonymous,
      status,
      completed_at,
      question_responses,
      sentiment_score,
      submission_time_seconds,
    } = req.body;

    const query = `
      UPDATE feedback_360 SET
        relationship_type = COALESCE($3, relationship_type),
        overall_rating = COALESCE($4, overall_rating),
        strengths = COALESCE($5, strengths),
        areas_for_improvement = COALESCE($6, areas_for_improvement),
        is_anonymous = COALESCE($7, is_anonymous),
        status = COALESCE($8, status),
        completed_at = COALESCE($9, completed_at),
        question_responses = COALESCE($10, question_responses),
        sentiment_score = COALESCE($11, sentiment_score),
        submission_time_seconds = COALESCE($12, submission_time_seconds)
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await req.dbClient!.query(query, [
      id,
      tenantId,
      relationship_type ?? null,
      overall_rating ?? null,
      strengths ?? null,
      areas_for_improvement ?? null,
      is_anonymous ?? null,
      status ?? null,
      completed_at ?? null,
      question_responses ? JSON.stringify(question_responses) : null,
      sentiment_score ?? null,
      submission_time_seconds ?? null,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { message: '360 review not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  })
);

/**
 * DELETE /api/v1/360-reviews/:id
 * Delete 360 review
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;

    const result = await req.dbClient!.query(
      'DELETE FROM feedback_360 WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { message: '360 review not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { id: result.rows[0]?.id, deleted: true },
    });
  })
);

export default router;
