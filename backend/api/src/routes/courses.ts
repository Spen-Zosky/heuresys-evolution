/**
 * Courses Routes
 * CRUD operations for learning courses
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createCourseSchema, updateCourseSchema } from '../schemas/learning.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);

// =============================================================================
// EMPLOYEE SELF-SERVICE ENDPOINTS (must be before parametric routes)
// =============================================================================

/**
 * GET /courses/me
 * Get current employee's course enrollments
 */
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const { status } = req.query as Record<string, string>;

    let query = `
      SELECT
        ce.id,
        ce.course_id,
        ce.employee_id,
        ce.status,
        ce.progress_percent,
        ce.enrolled_at,
        ce.started_at,
        ce.completed_at,
        ce.due_date,
        ce.score,
        ce.time_spent_minutes,
        ce.last_accessed_at,
        ce.certificate_issued,
        ce.certificate_url,
        c.title as course_title,
        c.category,
        c.duration_hours,
        c.skill_level,
        c.thumbnail_url,
        c.provider
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      JOIN employees e ON ce.employee_id = e.id
      WHERE ce.employee_id = $1 AND e.tenant_id = $2
    `;
    const params: (string | boolean)[] = [employeeId, tenantId];
    let paramIndex = 3;

    if (status) {
      query += ` AND ce.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    query += ` ORDER BY
      CASE ce.status
        WHEN 'in_progress' THEN 1
        WHEN 'enrolled' THEN 2
        WHEN 'completed' THEN 3
        ELSE 4
      END,
      ce.last_accessed_at DESC NULLS LAST`;

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rows.length,
        inProgress: result.rows.filter((r) => r.status === 'in_progress').length,
        completed: result.rows.filter((r) => r.status === 'completed').length,
      },
    });
  })
);

/**
 * GET /courses/me/stats
 * Get current employee's learning statistics
 */
router.get(
  '/me/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    // Get learning stats
    const stats = await req.dbClient!.query(
      `
      SELECT
        COALESCE(SUM(ce.time_spent_minutes), 0) / 60 as total_hours,
        COUNT(*) FILTER (WHERE ce.status = 'completed') as courses_completed,
        COUNT(*) as total_enrollments
      FROM course_enrollments ce
      JOIN employees e ON ce.employee_id = e.id
      WHERE ce.employee_id = $1 AND e.tenant_id = $2
    `,
      [employeeId, tenantId]
    );

    // Get certification count
    const certs = await req.dbClient!.query(
      `
      SELECT COUNT(*) as certifications
      FROM employee_certifications ec
      JOIN employees e ON ec.employee_id = e.id
      WHERE ec.employee_id = $1 AND e.tenant_id = $2 AND ec.status = 'active'
    `,
      [employeeId, tenantId]
    );

    // Calculate streak (consecutive days with learning activity)
    const streakQuery = await req.dbClient!.query(
      `
      WITH daily_activity AS (
        SELECT DISTINCT DATE(last_accessed_at) as activity_date
        FROM course_enrollments
        WHERE employee_id = $1 AND last_accessed_at IS NOT NULL
        ORDER BY activity_date DESC
      ),
      streak_calc AS (
        SELECT activity_date,
          activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int as grp
        FROM daily_activity
        WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT COUNT(*) as streak
      FROM streak_calc
      WHERE grp = (SELECT grp FROM streak_calc WHERE activity_date = CURRENT_DATE LIMIT 1)
    `,
      [employeeId]
    );

    res.json({
      success: true,
      data: {
        totalHours: parseFloat(stats.rows[0]?.total_hours) || 0,
        coursesCompleted: safeParseInt(stats.rows[0]?.courses_completed, { fallback: 0 }),
        certifications: safeParseInt(certs.rows[0]?.certifications, { fallback: 0 }),
        streak: safeParseInt(streakQuery.rows[0]?.streak, { fallback: 0 }),
        totalEnrollments: safeParseInt(stats.rows[0]?.total_enrollments, { fallback: 0 }),
      },
    });
  })
);

/**
 * GET /courses/recommended
 * Get recommended courses for current employee (not yet enrolled)
 */
router.get(
  '/recommended',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user?.employeeId;

    if (!employeeId) {
      throw Errors.unauthorized('No employee profile linked to this user');
    }

    const { limit = '10' } = req.query as Record<string, string>;

    // Get courses not enrolled by the employee, ordered by popularity
    const result = await req.dbClient!.query(
      `
      SELECT
        c.id,
        c.title,
        c.category,
        c.duration_hours,
        c.skill_level,
        c.thumbnail_url,
        c.provider,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id) as enrolled_count,
        (SELECT ROUND(AVG(score), 1) FROM course_enrollments WHERE course_id = c.id AND score IS NOT NULL) as avg_rating
      FROM courses c
      WHERE c.tenant_id = $1
      AND c.status = 'published'
      AND c.id NOT IN (
        SELECT course_id FROM course_enrollments WHERE employee_id = $2
      )
      ORDER BY enrolled_count DESC, c.title
      LIMIT $3
    `,
      [tenantId, employeeId, safeParseInt(limit as string, { fallback: 50 })]
    );

    // Transform to match frontend expectations
    const recommended = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      duration: row.duration_hours ? `${row.duration_hours} ore` : null,
      rating: parseFloat(row.avg_rating) || null,
      enrolledCount: safeParseInt(row.enrolled_count, { fallback: 0 }),
      level: row.skill_level,
      thumbnail: row.thumbnail_url,
      provider: row.provider,
    }));

    res.json({ success: true, data: recommended });
  })
);

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /courses/stats
 * Basic course statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_courses,
        COUNT(*) FILTER (WHERE status = 'published') as active_courses,
        COUNT(*) FILTER (WHERE is_mandatory = true) as mandatory_courses,
        ROUND(AVG(duration_hours), 1) as avg_duration_hours
      FROM courses WHERE tenant_id = $1
    `,
      [tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /courses/talent-stats
 * Comprehensive talent management statistics including learning, recruiting, and skills
 */
router.get(
  '/talent-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    // Learning metrics from course enrollments
    const learningStats = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE ce.status = 'completed') as courses_completed,
        COALESCE(SUM(ce.time_spent_minutes) / 60, 0) as hours_training,
        COUNT(*) FILTER (WHERE ce.certificate_issued = true) as certifications,
        ROUND(AVG(ce.score), 0) as avg_score
      FROM course_enrollments ce
      JOIN employees e ON ce.employee_id = e.id
      WHERE e.tenant_id = $1
    `,
      [tenantId]
    );

    // Internal job postings (open positions)
    const jobPostings = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') as open_positions,
        COUNT(*) as total_postings
      FROM internal_job_postings WHERE tenant_id = $1
    `,
      [tenantId]
    );

    // Recruiting pipeline
    const recruitingPipeline = await req.dbClient!.query(
      `
      SELECT stage, COUNT(*) as count FROM recruiting_candidates
      WHERE tenant_id = $1
      GROUP BY stage ORDER BY count DESC
    `,
      [tenantId]
    );

    // Map recruiting stages to display names and colors (stages from DB: applied, screening, phone_screen, interview, final_interview, offer)
    const stageMapping: Record<string, { name: string; color: string; order: number }> = {
      applied: { name: 'Candidature', color: '#4a5568', order: 1 },
      screening: { name: 'Screening', color: '#00b4d8', order: 2 },
      phone_screen: { name: 'Phone Screen', color: '#9f7aea', order: 3 },
      interview: { name: 'Colloquio', color: '#ed8936', order: 4 },
      final_interview: { name: 'Final Interview', color: '#48bb78', order: 5 },
      offer: { name: 'Offerta', color: '#00b4d8', order: 6 },
    };

    const pipeline = recruitingPipeline.rows
      .map((r) => ({
        stage: stageMapping[r.stage]?.name || r.stage,
        count: parseInt(r.count),
        color: stageMapping[r.stage]?.color || '#4a5568',
        order: stageMapping[r.stage]?.order || 99,
      }))
      .sort((a, b) => a.order - b.order);

    // Total candidates (applicants)
    const totalApplicants = pipeline.reduce((sum, p) => sum + p.count, 0);

    // Skills gap from latest snapshot
    const skillsGap = await req.dbClient!.query(
      `
      SELECT gap_metrics FROM skill_gap_snapshots
      WHERE tenant_id = $1
      ORDER BY analysis_date DESC LIMIT 1
    `,
      [tenantId]
    );

    const gapMetrics = skillsGap.rows[0]?.gap_metrics || {};
    // Use real data from DB - only skill names and aggregate counts are available
    const topGapSkills = (gapMetrics.top_gap_skills || []).map((skill: string, idx: number) => ({
      skill,
      priority: idx < 2 ? 'critical' : idx < 4 ? 'high' : 'medium',
    }));

    res.json({
      success: true,
      data: {
        recruitment: {
          openPositions: safeParseInt(jobPostings.rows[0]?.open_positions, { fallback: 0 }),
          applicants: totalApplicants,
          interviews: pipeline.find((p) => p.stage === 'Colloquio')?.count || 0,
          offers: pipeline.find((p) => p.stage === 'Offerta')?.count || 0,
        },
        pipeline,
        skillsGap: topGapSkills,
        skillsGapSummary: {
          criticalGaps: gapMetrics.critical_gaps_count || 0,
          highGaps: gapMetrics.high_gaps_count || 0,
          mediumGaps: gapMetrics.medium_gaps_count || 0,
          coverage: gapMetrics.skills_coverage_percentage || 0,
          employeesAnalyzed: gapMetrics.total_employees_analyzed || 0,
        },
        learningMetrics: {
          coursesCompleted: safeParseInt(learningStats.rows[0]?.courses_completed, { fallback: 0 }),
          hoursTraining: safeParseInt(learningStats.rows[0]?.hours_training, { fallback: 0 }),
          certifications: safeParseInt(learningStats.rows[0]?.certifications, { fallback: 0 }),
          avgScore: safeParseInt(learningStats.rows[0]?.avg_score, { fallback: 0 }),
        },
      },
    });
  })
);

/**
 * GET /courses/categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      'SELECT DISTINCT category FROM courses WHERE tenant_id = $1 AND category IS NOT NULL ORDER BY category LIMIT 100',
      [tenantId]
    );

    res.json({ success: true, data: result.rows.map((r) => r.category) });
  })
);

/**
 * GET /courses
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      status,
      category,
      skill_level,
      is_mandatory,
      search,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    // Validate and sanitize numeric inputs
    const limitNum = safeParseInt(limit as string, { fallback: 100, min: 1, max: 1000 });
    const offsetNum = Math.max(0, safeParseInt(offset as string, { fallback: 0 }));

    let whereClause = `WHERE tenant_id = $1`;
    const filterParams: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      filterParams.push(status as string);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      filterParams.push(category as string);
      paramIndex++;
    }

    if (skill_level) {
      whereClause += ` AND skill_level = $${paramIndex}`;
      filterParams.push(skill_level as string);
      paramIndex++;
    }

    if (is_mandatory !== undefined) {
      whereClause += ` AND is_mandatory = $${paramIndex}`;
      filterParams.push(is_mandatory === 'true');
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      filterParams.push(`%${escapeILIKE(search as string)}%`);
      paramIndex++;
    }

    const query = `
      SELECT id, code, title, title_en, description, category, duration_hours, skill_level,
        provider, is_mandatory, is_certification, thumbnail_url, language, status,
        published_at, created_at, updated_at
      FROM courses
      ${whereClause}
      ORDER BY title LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const params = [...filterParams, limitNum, offsetNum];

    const result = await req.dbClient!.query(query, params);
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM courses ${whereClause}`,
      filterParams
    );

    const total = safeParseInt(countResult.rows[0]?.count, { fallback: 0 });

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(total, limitNum, offsetNum),
    });
  })
);

/**
 * GET /courses/:id
 */
router.get(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT c.*,
        (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) as enrollment_count,
        (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'completed') as completed_count
      FROM courses c
      WHERE c.id = $1 AND c.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Course');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /courses
 */
router.post(
  '/',
  validate(createCourseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      code,
      title,
      title_en,
      description,
      description_en,
      category,
      duration_hours,
      skill_level,
      provider,
      is_mandatory = false,
      is_certification = false,
      provider_url,
      thumbnail_url,
      language = 'it',
      tags,
      prerequisites,
      created_by,
    } = req.body;

    if (!title) {
      throw Errors.badRequest('Title is required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO courses (tenant_id, code, title, title_en, description, description_en, category, duration_hours,
        skill_level, provider, is_mandatory, is_certification, provider_url, thumbnail_url, language,
        tags, prerequisites, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'draft', $18, NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        code,
        title,
        title_en,
        description,
        description_en,
        category,
        duration_hours,
        skill_level,
        provider,
        is_mandatory,
        is_certification,
        provider_url,
        thumbnail_url,
        language,
        tags,
        prerequisites,
        created_by,
      ]
    );

    res
      .status(201)
      .json({ success: true, data: result.rows[0] || null, message: 'Course created' });
  })
);

/**
 * PATCH /courses/:id
 */
router.patch(
  '/:id',
  validateUUID(),
  validate(updateCourseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const existing = await req.dbClient!.query(
      'SELECT id FROM courses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw Errors.notFound('Course');
    }

    const allowedFields = [
      'title',
      'title_en',
      'description',
      'description_en',
      'category',
      'duration_hours',
      'skill_level',
      'provider',
      'is_mandatory',
      'is_certification',
      'provider_url',
      'thumbnail_url',
      'language',
      'tags',
      'prerequisites',
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

    // Auto-set published_at when status changes to published
    if (req.body.status === 'published') {
      updates.push(`published_at = NOW()`);
    }

    if (updates.length === 0) {
      throw Errors.badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const result = await req.dbClient!.query(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId]
    );

    res.json({ success: true, data: result.rows[0] || null, message: 'Course updated' });
  })
);

/**
 * DELETE /courses/:id
 */
router.delete(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Check for active enrollments (tenant-scoped via employee join)
    const enrollmentCount = await req.dbClient!.query(
      `SELECT COUNT(*) FROM course_enrollments ce
       JOIN employees e ON ce.employee_id = e.id
       WHERE ce.course_id = $1 AND e.tenant_id = $2
       AND ce.status NOT IN ('completed', 'cancelled')`,
      [id, tenantId]
    );
    if (parseInt(enrollmentCount.rows[0].count) > 0) {
      throw Errors.badRequest('Cannot delete course with active enrollments');
    }

    const result = await req.dbClient!.query(
      "UPDATE courses SET status = 'archived', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Course');
    }

    res.json({ success: true, message: 'Course deactivated' });
  })
);

/**
 * GET /courses/:id/enrollments
 */
router.get(
  '/:id/enrollments',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT ce.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email
      FROM course_enrollments ce
      LEFT JOIN employees e ON ce.employee_id = e.id
      WHERE ce.course_id = $1 AND e.tenant_id = $2
      ORDER BY ce.enrolled_at DESC
    `,
      [id, tenantId]
    );

    res.json({ success: true, data: result.rows });
  })
);

export default router;
