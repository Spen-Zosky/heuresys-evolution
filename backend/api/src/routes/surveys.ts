/**
 * Surveys Routes
 * Employee surveys and engagement assessments
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import {
  createSurveySchema,
  updateSurveySchema,
  submitSurveyResponseSchema,
} from '../schemas/surveys.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

/**
 * GET /surveys
 * List surveys with pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const status = req.query.status as string;

    let whereClause = 'WHERE s.tenant_id = $1';
    const params: (string | number)[] = [tenantId];

    if (status) {
      params.push(status);
      whereClause += ` AND s.status = $${params.length}`;
    }

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(`SELECT COUNT(*) as total FROM surveys s ${whereClause}`, params),
      req.dbClient!.query(
        `SELECT s.id, s.title, s.description, s.survey_type, s.start_date, s.end_date,
                s.is_anonymous, s.is_active, s.status, s.total_invitations, s.created_at
         FROM surveys s
         ${whereClause}
         ORDER BY s.created_at DESC
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
 * GET /surveys/stats
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
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) FILTER (WHERE is_anonymous = true) as anonymous,
        SUM(total_invitations) as total_invitations
      FROM surveys WHERE tenant_id = $1
    `,
      [tenantId]
    );

    // Get response stats
    const responseStats = await req.dbClient!.query(
      `
      SELECT COUNT(DISTINCT sr.id) as total_responses
      FROM survey_responses sr
      JOIN surveys s ON sr.survey_id = s.id
      WHERE s.tenant_id = $1
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        total_responses: responseStats.rows[0]?.total_responses,
      },
    });
  })
);

/**
 * GET /surveys/active
 * Get active surveys
 */
router.get(
  '/active',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT id, tenant_id, title, description, survey_type, start_date, end_date,
        is_anonymous, is_active, status, questions, total_invitations, created_at, updated_at
      FROM surveys
      WHERE tenant_id = $1
        AND status = 'active'
        AND is_active = true
        AND (start_date IS NULL OR start_date <= CURRENT_DATE)
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      ORDER BY created_at DESC
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /surveys/types
 * Get survey types breakdown
 */
router.get(
  '/types',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT survey_type, COUNT(*) as count
      FROM surveys
      WHERE tenant_id = $1
      GROUP BY survey_type
      ORDER BY count DESC
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /surveys
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      status,
      survey_type,
      is_anonymous,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query =
      'SELECT id, tenant_id, title, description, survey_type, start_date, end_date, is_anonymous, is_active, status, questions, total_invitations, created_at, updated_at FROM surveys WHERE tenant_id = $1';
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (survey_type) {
      query += ` AND survey_type = $${paramIndex}`;
      params.push(survey_type as string);
      paramIndex++;
    }

    if (is_anonymous !== undefined) {
      query += ` AND is_anonymous = $${paramIndex}`;
      params.push(is_anonymous === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM surveys WHERE tenant_id = $1',
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
 * GET /surveys/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'SELECT id, tenant_id, title, description, survey_type, start_date, end_date, is_anonymous, is_active, status, questions, total_invitations, created_at, updated_at FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Survey');
    }

    // Get response count
    const responseCount = await req.dbClient!.query(
      `
      SELECT COUNT(DISTINCT employee_id) as response_count
      FROM survey_responses
      WHERE survey_id = $1
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...(result.rows[0] || {}),
        response_count: parseInt(responseCount.rows[0]?.response_count),
      },
    });
  })
);

/**
 * GET /surveys/:id/responses
 * Get survey responses (if not anonymous)
 */
router.get(
  '/:id/responses',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Check if survey exists and is not anonymous
    const survey = await req.dbClient!.query(
      'SELECT is_anonymous FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (survey.rows.length === 0) {
      throw Errors.notFound('Survey');
    }

    if (survey.rows[0].is_anonymous) {
      // For anonymous surveys, return aggregated data only
      const aggregated = await req.dbClient!.query(
        `
        SELECT question_id,
          AVG(rating_value) as avg_rating,
          COUNT(*) as response_count
        FROM survey_responses
        WHERE survey_id = $1
        GROUP BY question_id
      `,
        [id]
      );

      res.json({ success: true, data: { anonymous: true, aggregated: aggregated.rows } });
      return;
    }

    // For non-anonymous, return individual responses
    const responses = await req.dbClient!.query(
      `
      SELECT sr.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM survey_responses sr
      LEFT JOIN employees e ON sr.employee_id = e.id
      WHERE sr.survey_id = $1
      ORDER BY sr.created_at DESC
    `,
      [id]
    );

    res.json({ success: true, data: { anonymous: false, responses: responses.rows } });
  })
);

/**
 * POST /surveys
 */
router.post(
  '/',
  validate(createSurveySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      title,
      description,
      survey_type = 'engagement',
      start_date,
      end_date,
      is_anonymous = true,
      questions,
    } = req.body;

    if (!title) {
      throw Errors.badRequest('Title is required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO surveys (tenant_id, title, description, survey_type, start_date, end_date,
        is_anonymous, is_active, status, questions, total_invitations, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'draft', $8, 0, NOW(), NOW())
      RETURNING *
    `,
      [tenantId, title, description, survey_type, start_date, end_date, is_anonymous, questions]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Survey created' });
  })
);

/**
 * PATCH /surveys/:id
 */
router.patch(
  '/:id',
  validate(updateSurveySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Survey');
    }

    const allowedFields = [
      'title',
      'description',
      'survey_type',
      'start_date',
      'end_date',
      'is_anonymous',
      'is_active',
      'status',
      'questions',
      'total_invitations',
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
      `UPDATE surveys SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Survey updated' });
  })
);

/**
 * POST /surveys/:id/activate
 */
router.post(
  '/:id/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE surveys SET status = 'active', is_active = true, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Survey');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Survey activated' });
  })
);

/**
 * POST /surveys/:id/close
 */
router.post(
  '/:id/close',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      UPDATE surveys SET status = 'closed', is_active = false, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Survey');
    }

    res.json({ success: true, data: result.rows[0] || null, message: 'Survey closed' });
  })
);

/**
 * POST /surveys/:id/respond
 * Submit a response to a survey
 */
router.post(
  '/:id/respond',
  validate(submitSurveyResponseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { employee_id, responses } = req.body;

    // Verify survey exists and is active
    const survey = await req.dbClient!.query(
      `
      SELECT id, is_anonymous FROM surveys
      WHERE id = $1 AND tenant_id = $2 AND status = 'active'
    `,
      [id, tenantId]
    );

    if (survey.rows.length === 0) {
      throw Errors.notFound('Survey', 'not found or not active');
    }

    if (!responses || !Array.isArray(responses)) {
      throw Errors.badRequest('Responses array is required');
    }

    // Insert responses
    const insertedResponses = [];
    for (const response of responses) {
      const result = await req.dbClient!.query(
        `
        INSERT INTO survey_responses (survey_id, question_id, employee_id, rating_value, text_value, choice_value, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `,
        [
          id,
          response.question_id,
          survey.rows[0]?.is_anonymous ? null : employee_id,
          response.rating_value,
          response.text_value,
          response.choice_value,
        ]
      );
      insertedResponses.push(result.rows[0]);
    }

    res
      .status(201)
      .json({ success: true, data: insertedResponses, message: 'Survey response submitted' });
  })
);

/**
 * DELETE /surveys/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM surveys WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Survey');
    }

    res.json({ success: true, message: 'Survey deleted' });
  })
);

export default router;
