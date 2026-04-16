/**
 * Recruiting Candidates Routes
 * CRUD operations for job candidates
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import {
  createCandidateSchema,
  updateCandidateSchema,
  advanceCandidateSchema,
  rejectCandidateSchema,
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
 * GET /candidates
 * List recruiting candidates with pagination
 */
router.get(
  '/',
  requirePermission('RECRUITMENT', 'VIEW'),
  applyScopeFilter('RECRUITMENT'),
  asyncHandler(async (req: Request, res: Response) => {
    getTenantIdOrThrow(req);
    const limit = safeParseInt(req.query.limit as string, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset as string, { fallback: 0 });
    const stage = req.query.stage as string;

    const scope = getScopeCondition(req, 'rc');
    let whereClause = `WHERE ${scope.where}`;
    const params: unknown[] = [...scope.params];

    if (stage) {
      params.push(stage);
      whereClause += ` AND rc.stage = $${params.length}`;
    }

    const [countResult, dataResult] = await Promise.all([
      req.dbClient!.query(
        `SELECT COUNT(*) as total FROM recruiting_candidates rc ${whereClause}`,
        params
      ),
      req.dbClient!.query(
        `SELECT rc.id, rc.first_name, rc.last_name, rc.email, rc.phone,
                rc.current_company, rc.job_title, rc.experience_years,
                rc.stage, rc.rating, rc.source, rc.created_at
         FROM recruiting_candidates rc
         ${whereClause}
         ORDER BY rc.created_at DESC
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
 * GET /candidates/stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE stage = 'new') as new_count,
      COUNT(*) FILTER (WHERE stage = 'screening') as screening,
      COUNT(*) FILTER (WHERE stage = 'interview') as interview,
      COUNT(*) FILTER (WHERE stage = 'offer') as offer,
      COUNT(*) FILTER (WHERE stage = 'hired') as hired,
      COUNT(*) FILTER (WHERE stage = 'rejected') as rejected,
      ROUND(AVG(rating), 1) as avg_rating
    FROM recruiting_candidates WHERE tenant_id = $1
  `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /candidates/pipeline
 */
router.get(
  '/pipeline',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
    SELECT stage, COUNT(*) as count
    FROM recruiting_candidates
    WHERE tenant_id = $1
    GROUP BY stage
    ORDER BY CASE stage
      WHEN 'new' THEN 1
      WHEN 'screening' THEN 2
      WHEN 'interview' THEN 3
      WHEN 'offer' THEN 4
      WHEN 'hired' THEN 5
      WHEN 'rejected' THEN 6
      ELSE 7
    END
  `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /candidates
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      requisition_id,
      stage,
      source,
      search,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
    SELECT c.*,
      r.title as requisition_title,
      r.department as requisition_org_unit
    FROM recruiting_candidates c
    LEFT JOIN recruiting_requisitions r ON c.requisition_id = r.id
    WHERE c.tenant_id = $1
  `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (requisition_id) {
      query += ` AND c.requisition_id = $${paramIndex}`;
      params.push(requisition_id as string);
      paramIndex++;
    }

    if (stage) {
      query += ` AND c.stage = $${paramIndex}`;
      params.push(stage as string);
      paramIndex++;
    }

    if (source) {
      query += ` AND c.source = $${paramIndex}`;
      params.push(source as string);
      paramIndex++;
    }

    if (search) {
      query += ` AND (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`;
      params.push(`%${escapeILIKE(search as string)}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.applied_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 100 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM recruiting_candidates WHERE tenant_id = $1',
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
 * GET /candidates/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
    SELECT c.*,
      r.title as requisition_title,
      r.department as requisition_org_unit,
      r.hiring_manager_id,
      (SELECT COUNT(*) FROM recruiting_interviews i WHERE i.candidate_id = c.id) as interview_count,
      (SELECT COUNT(*) FROM recruiting_offers o WHERE o.candidate_id = c.id) as offer_count
    FROM recruiting_candidates c
    LEFT JOIN recruiting_requisitions r ON c.requisition_id = r.id
    WHERE c.id = $1 AND c.tenant_id = $2
  `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Candidate', id);
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /candidates
 */
router.post(
  '/',
  requirePermission('RECRUITMENT', 'CREATE'),
  validate(createCandidateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      requisition_id,
      first_name,
      last_name,
      email,
      phone,
      current_company,
      job_title,
      experience_years,
      source = 'direct',
      resume_url,
      linkedin_url,
      portfolio_url,
      notes,
      skills,
    } = req.body;

    if (!first_name || !last_name || !email) {
      throw Errors.badRequest('first_name, last_name, and email are required');
    }

    // Check for duplicate email for same requisition
    if (requisition_id) {
      const duplicate = await req.dbClient!.query(
        'SELECT id FROM recruiting_candidates WHERE email = $1 AND requisition_id = $2 AND tenant_id = $3',
        [email, requisition_id, tenantId]
      );
      if (duplicate.rows.length > 0) {
        throw Errors.conflict('Candidate already applied for this position');
      }
    }

    const result = await req.dbClient!.query(
      `
    INSERT INTO recruiting_candidates (tenant_id, requisition_id, first_name, last_name, email, phone,
      current_company, job_title, experience_years, stage, source, resume_url, linkedin_url,
      portfolio_url, notes, skills, applied_at, last_activity, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', $10, $11, $12, $13, $14, $15, NOW(), NOW(), NOW(), NOW())
    RETURNING *
  `,
      [
        tenantId,
        requisition_id,
        first_name,
        last_name,
        email,
        phone,
        current_company,
        job_title,
        experience_years,
        source,
        resume_url,
        linkedin_url,
        portfolio_url,
        notes,
        skills,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Candidate added' });
  })
);

/**
 * PATCH /candidates/:id
 */
router.patch(
  '/:id',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(updateCandidateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM recruiting_candidates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Candidate', id);
    }

    const allowedFields = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'current_company',
      'job_title',
      'experience_years',
      'stage',
      'rating',
      'source',
      'resume_url',
      'linkedin_url',
      'portfolio_url',
      'notes',
      'skills',
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

    updates.push('last_activity = NOW()');
    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE recruiting_candidates SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Candidate updated' });
  })
);

/**
 * POST /candidates/:id/advance
 */
router.post(
  '/:id/advance',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(advanceCandidateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { next_stage, notes } = req.body;

    const stageOrder = ['new', 'screening', 'interview', 'offer', 'hired'];

    const current = await req.dbClient!.query(
      'SELECT stage FROM recruiting_candidates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (current.rows.length === 0) {
      throw Errors.notFound('Candidate', id);
    }

    const currentStage = current.rows[0]?.stage;
    const targetStage = next_stage || stageOrder[stageOrder.indexOf(currentStage) + 1];

    if (!targetStage || !stageOrder.includes(targetStage)) {
      throw Errors.badRequest('Invalid stage transition');
    }

    const result = await req.dbClient!.query(
      `
    UPDATE recruiting_candidates SET stage = $1, notes = COALESCE($2, notes), last_activity = NOW(), updated_at = NOW()
    WHERE id = $3 AND tenant_id = $4 RETURNING *
  `,
      [targetStage, notes, id, tenantId]
    );

    // Log to history
    await req.dbClient!.query(
      `
    INSERT INTO recruiting_candidate_history (tenant_id, candidate_id, from_stage, to_stage, changed_at, notes)
    VALUES ($1, $2, $3, $4, NOW(), $5)
  `,
      [tenantId, id, currentStage, targetStage, notes]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: `Candidate advanced to ${targetStage}`,
    });
  })
);

/**
 * POST /candidates/:id/reject
 */
router.post(
  '/:id/reject',
  requirePermission('RECRUITMENT', 'EDIT'),
  validate(rejectCandidateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { reason } = req.body;

    const current = await req.dbClient!.query(
      'SELECT stage FROM recruiting_candidates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (current.rows.length === 0) {
      throw Errors.notFound('Candidate', id);
    }

    const result = await req.dbClient!.query(
      `
    UPDATE recruiting_candidates SET stage = 'rejected', notes = COALESCE(notes || E'\n', '') || $1, last_activity = NOW(), updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3 RETURNING *
  `,
      [reason ? `Rejection reason: ${reason}` : 'Rejected', id, tenantId]
    );

    // Log to history
    await req.dbClient!.query(
      `
    INSERT INTO recruiting_candidate_history (tenant_id, candidate_id, from_stage, to_stage, changed_at, notes)
    VALUES ($1, $2, $3, 'rejected', NOW(), $4)
  `,
      [tenantId, id, current.rows[0]?.stage, reason]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Candidate rejected' });
  })
);

/**
 * DELETE /candidates/:id
 */
router.delete(
  '/:id',
  requirePermission('RECRUITMENT', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      'DELETE FROM recruiting_candidates WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Candidate', id);
    }

    res.json({ success: true, message: 'Candidate deleted' });
  })
);

export default router;
