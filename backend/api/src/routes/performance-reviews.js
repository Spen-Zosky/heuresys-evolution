/**
 * Performance Reviews Routes
 * CRUD operations for performance reviews
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema, updateReviewSchema, updateFeedback360Schema, updateGoalRatingSchema, saveSelfAssessmentSchema, addEvidenceSchema, updateCompetenciesSchema, saveManagerReviewSchema, submitManagerReviewSchema, completeReviewSchema, acknowledgeReviewSchema, createSelfReviewSchema, updateSelfReviewSchema, request360FeedbackSchema, decline360FeedbackSchema, } from '../schemas/performance.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { buildMeta } from '../utils/pagination.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { withTransaction } from '../utils/transaction.js';
import { performanceManagementService } from '../services/performance-management.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt, firstRowOrNull } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /performance-reviews/stats
 * Extended stats including rating distribution, top performers, department performance
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    // Run all stats queries in parallel to minimize latency
    const [basicStats, ratingDist, topPerformers, deptPerformance] = await Promise.all([
        req.dbClient.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          ROUND(AVG(overall_rating), 2) as avg_overall_rating,
          ROUND(AVG(goal_achievement_rating), 2) as avg_goal_rating
        FROM performance_reviews WHERE tenant_id = $1
      `, [tenantId]),
        req.dbClient.query(`
        SELECT
          CASE
            WHEN overall_rating >= 4.5 THEN 'Eccellente'
            WHEN overall_rating >= 3.5 THEN 'Buono'
            WHEN overall_rating >= 2.5 THEN 'Adeguato'
            WHEN overall_rating >= 1.5 THEN 'Da migliorare'
            ELSE 'Insufficiente'
          END as rating,
          COUNT(*) as count
        FROM performance_reviews
        WHERE tenant_id = $1 AND overall_rating IS NOT NULL
        GROUP BY rating
        ORDER BY count DESC
      `, [tenantId]),
        req.dbClient.query(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name as name,
          d.name as department,
          ROUND(pr.overall_rating * 20)::int as score
        FROM performance_reviews pr
        JOIN employees e ON pr.employee_id = e.id
        LEFT JOIN org_units d ON e.org_unit_id = d.id
        WHERE pr.tenant_id = $1 AND pr.overall_rating IS NOT NULL
        ORDER BY pr.overall_rating DESC
        LIMIT 5
      `, [tenantId]),
        req.dbClient.query(`
        SELECT
          d.name as department,
          ROUND(AVG(pr.overall_rating) * 20)::int as avg_score,
          COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'completed') as goals_completed,
          COUNT(DISTINCT pr.id) as reviews_completed
        FROM org_units d
        JOIN employees e ON e.org_unit_id = d.id
        LEFT JOIN performance_reviews pr ON pr.employee_id = e.id AND pr.tenant_id = $1
        LEFT JOIN goals g ON g.employee_id = e.id AND g.tenant_id = $1
        WHERE d.tenant_id = $1
        GROUP BY d.name
        HAVING AVG(pr.overall_rating) IS NOT NULL
        ORDER BY avg_score DESC
        LIMIT 10
      `, [tenantId]),
    ]);
    const totalRated = ratingDist.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const ratings = ratingDist.rows.map((r) => ({
        rating: r.rating,
        count: parseInt(r.count),
        percentage: totalRated > 0 ? Math.round((parseInt(r.count) / totalRated) * 100) : 0,
    }));
    res.json({
        success: true,
        data: {
            ...(firstRowOrNull(basicStats) || {}),
            ratings,
            topPerformers: topPerformers.rows.map((p) => ({
                ...p,
                trend: 'stable', // Would need historical data for actual trend
            })),
            departmentPerformance: deptPerformance.rows.map((d) => ({
                department: d.department,
                avgScore: safeParseInt(d.avg_score, { fallback: 0 }),
                goalsCompleted: safeParseInt(d.goals_completed, { fallback: 0 }),
                reviewsCompleted: safeParseInt(d.reviews_completed, { fallback: 0 }),
            })),
        },
    });
}));
/**
 * GET /performance-reviews
 */
router.get('/', requirePermission('PERFORMANCE', 'VIEW'), applyScopeFilter('PERFORMANCE'), asyncHandler(async (req, res) => {
    getTenantIdOrThrow(req);
    const { employee_id, reviewer_id, status, review_type, limit = '100', offset = '0', } = req.query;
    const scope = getScopeCondition(req, 'pr');
    let query = `
      SELECT pr.id, pr.tenant_id, pr.employee_id, pr.reviewer_id,
        pr.review_period_start, pr.review_period_end, pr.review_type,
        pr.overall_rating, pr.goal_achievement_rating, pr.competency_rating,
        pr.potential_rating, pr.status, pr.submitted_at, pr.acknowledged_at,
        pr.created_at, pr.updated_at, pr.review_cycle_id,
        pr.performance_box, pr.potential_box, pr.template_id,
        pr.self_assessment_status, pr.goals_count, pr.competencies_count,
        e.first_name || ' ' || e.last_name as employee_name,
        r.first_name || ' ' || r.last_name as reviewer_name
      FROM performance_reviews pr
      LEFT JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      WHERE ${scope.where}
    `;
    const params = [...scope.params];
    let paramIndex = params.length + 1;
    if (employee_id) {
        query += ` AND pr.employee_id = $${paramIndex}`;
        params.push(employee_id);
        paramIndex++;
    }
    if (reviewer_id) {
        query += ` AND pr.reviewer_id = $${paramIndex}`;
        params.push(reviewer_id);
        paramIndex++;
    }
    if (status) {
        query += ` AND pr.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    if (review_type) {
        query += ` AND pr.review_type = $${paramIndex}`;
        params.push(review_type);
        paramIndex++;
    }
    query += ` ORDER BY pr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    // Build count query with same filters (reuse scope)
    let countQuery = `SELECT COUNT(*) FROM performance_reviews pr WHERE ${scope.where}`;
    const countParams = [...scope.params];
    let ci = countParams.length + 1;
    if (employee_id) {
        countQuery += ` AND pr.employee_id = $${ci}`;
        countParams.push(employee_id);
        ci++;
    }
    if (reviewer_id) {
        countQuery += ` AND pr.reviewer_id = $${ci}`;
        countParams.push(reviewer_id);
        ci++;
    }
    if (status) {
        countQuery += ` AND pr.status = $${ci}`;
        countParams.push(status);
        ci++;
    }
    if (review_type) {
        countQuery += ` AND pr.review_type = $${ci}`;
        countParams.push(review_type);
    }
    const countResult = await req.dbClient.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count);
    const parsedLimit = safeParseInt(limit, { fallback: 100 });
    const parsedOffset = safeParseInt(offset, { fallback: 0 });
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(total, parsedLimit, parsedOffset),
    });
}));
// Import service for advanced features
// ============================================================================
// STATIC ROUTES (MUST BE BEFORE /:id)
// ============================================================================
// ============================================================================
// SELF-ASSESSMENT FLOW - S-PERF-01-02
// ============================================================================
/**
 * GET /performance-reviews/my
 * Get current employee's performance reviews (employee self-service)
 */
router.get('/my', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, status, include_goals } = req.query;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    // Get reviews from the view
    let query = `
      SELECT * FROM v_my_performance_reviews
      WHERE tenant_id = $1 AND employee_id = $2
    `;
    const params = [tenantId, employee_id];
    let paramIndex = 3;
    if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY review_period_end DESC LIMIT 100`;
    const result = await req.dbClient.query(query, params);
    // Include goals summary using a single batch query instead of N+1 loop
    if (include_goals === 'true' && result.rows.length > 0) {
        const reviewIds = result.rows.map((r) => r.id);
        const goalsResult = await req.dbClient.query(`
        SELECT
          grr.performance_review_id,
          COUNT(*) as total_goals,
          COUNT(*) FILTER (WHERE grr.self_rating IS NOT NULL) as rated_goals,
          ROUND(AVG(grr.self_rating), 2) as avg_self_rating
        FROM goal_review_ratings grr
        WHERE grr.performance_review_id = ANY($1)
        GROUP BY grr.performance_review_id
      `, [reviewIds]);
        const goalsMap = new Map(goalsResult.rows.map((r) => [r.performance_review_id, r]));
        for (const review of result.rows) {
            review.goals_summary = goalsMap.get(review.id) || {
                total_goals: 0,
                rated_goals: 0,
                avg_self_rating: null,
            };
        }
    }
    res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length },
    });
}));
/**
 * GET /performance-reviews/my/active
 * Get current employee's active review that needs self-assessment
 */
router.get('/my/active', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id } = req.query;
    if (!employee_id) {
        throw Errors.badRequest('employee_id is required');
    }
    // Find active review requiring self-assessment
    const result = await req.dbClient.query(`
      SELECT pr.*,
        r.first_name || ' ' || r.last_name as reviewer_name,
        rc.name as cycle_name,
        rc.cycle_type,
        rcp.current_phase,
        rcp.self_review_completed,
        t.name as template_name,
        t.sections as template_sections,
        t.rating_scale_type,
        t.rating_scale_config,
        rcph.end_date as phase_deadline
      FROM performance_reviews pr
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      LEFT JOIN review_cycle_participants rcp ON pr.review_cycle_id = rcp.review_cycle_id AND pr.employee_id = rcp.employee_id
      LEFT JOIN review_cycle_phases rcph ON pr.review_cycle_id = rcph.review_cycle_id AND rcph.phase_name = 'self_assessment'
      LEFT JOIN performance_review_templates t ON pr.template_id = t.id
      WHERE pr.tenant_id = $1
        AND pr.employee_id = $2
        AND pr.status IN ('draft', 'pending', 'in_progress')
        AND (pr.self_assessment_status IS NULL OR pr.self_assessment_status != 'submitted')
      ORDER BY pr.review_period_end DESC
      LIMIT 1
    `, [tenantId, employee_id]);
    if (result.rows.length === 0) {
        res.json({
            success: true,
            data: null,
            message: 'No active review requiring self-assessment',
        });
        return;
    }
    const review = result.rows[0];
    // Get goals for this review
    const goalsResult = await req.dbClient.query(`
      SELECT grr.*, g.title, g.description, g.goal_type, g.status as goal_status,
             g.progress_percent, g.due_date, g.category
      FROM goal_review_ratings grr
      JOIN goals g ON grr.goal_id = g.id
      WHERE grr.performance_review_id = $1
      ORDER BY g.due_date, g.weight DESC
    `, [review.id]);
    // Get competency ratings
    const competenciesResult = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id, competency_id,
        ksaba_dimension, competency_name, self_rating, self_comment, self_evidence,
        manager_rating, manager_comment, weight, created_at, updated_at
      FROM competency_review_ratings
      WHERE performance_review_id = $1
      ORDER BY ksaba_dimension, competency_name
    `, [review.id]);
    // Get evidence
    const evidenceResult = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id, evidence_type,
        title, description, file_url, external_link, related_goal_id,
        related_competency, date_achieved, verified, verified_by, verified_at,
        created_at, updated_at
      FROM self_assessment_evidence
      WHERE performance_review_id = $1
      ORDER BY created_at DESC
    `, [review.id]);
    res.json({
        success: true,
        data: {
            review,
            goals: goalsResult.rows,
            competencies: competenciesResult.rows,
            evidence: evidenceResult.rows,
        },
    });
}));
/**
 * GET /performance-reviews/team
 * Get all reviews for manager's direct reports
 */
router.get('/team', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { manager_id, status, review_cycle_id } = req.query;
    if (!manager_id) {
        throw Errors.badRequest('manager_id is required');
    }
    // Get reviews for direct reports
    let query = `
      SELECT pr.id, pr.tenant_id, pr.employee_id, pr.reviewer_id,
        pr.review_period_start, pr.review_period_end, pr.review_type,
        pr.overall_rating, pr.goal_achievement_rating, pr.competency_rating,
        pr.potential_rating, pr.status, pr.submitted_at, pr.acknowledged_at,
        pr.created_at, pr.updated_at, pr.review_cycle_id,
        pr.self_rating, pr.self_assessment_status, pr.manager_submitted_at,
        pr.calibrated_rating, pr.performance_box, pr.potential_box,
        pr.goals_count, pr.competencies_count, pr.template_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        e.job_title as employee_job_title,
        d.name as department_name,
        rc.name as cycle_name,
        rc.cycle_type,
        rcp.self_review_completed,
        rcp.manager_review_completed,
        rcp.calibration_completed
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      LEFT JOIN review_cycle_participants rcp ON pr.review_cycle_id = rcp.review_cycle_id AND pr.employee_id = rcp.employee_id
      WHERE pr.tenant_id = $1
        AND e.manager_id = $2
    `;
    const params = [tenantId, manager_id];
    let paramIndex = 3;
    if (status) {
        query += ` AND pr.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    if (review_cycle_id) {
        query += ` AND pr.review_cycle_id = $${paramIndex}`;
        params.push(review_cycle_id);
        paramIndex++;
    }
    query += ` ORDER BY pr.review_period_end DESC, e.last_name, e.first_name LIMIT 200`;
    const result = await req.dbClient.query(query, params);
    // Get comparison summary
    const comparisonResult = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_reports,
        COUNT(*) FILTER (WHERE pr.self_submitted_at IS NOT NULL) as self_assessments_submitted,
        COUNT(*) FILTER (WHERE pr.manager_submitted_at IS NOT NULL) as manager_reviews_submitted,
        ROUND(AVG(pr.overall_rating), 2) as avg_team_rating,
        ROUND(AVG(pr.self_rating), 2) as avg_self_rating
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE pr.tenant_id = $1 AND e.manager_id = $2
        AND (pr.review_cycle_id = $3 OR ($3 IS NULL AND pr.review_period_end >= NOW() - INTERVAL '1 year'))
    `, [tenantId, manager_id, review_cycle_id || null]);
    res.json({
        success: true,
        data: {
            reviews: result.rows,
            summary: comparisonResult.rows[0],
        },
        meta: { total: result.rows.length },
    });
}));
/**
 * GET /performance-reviews/team/comparison
 * Team comparison matrix for calibration
 */
router.get('/team/comparison', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { manager_id, review_cycle_id } = req.query;
    if (!manager_id) {
        throw Errors.badRequest('manager_id is required');
    }
    const result = await req.dbClient.query(`
      SELECT
        pr.id,
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        d.name as department,
        pr.self_rating,
        pr.overall_rating as manager_rating,
        pr.goal_achievement_rating,
        pr.competency_rating,
        pr.potential_rating,
        pr.calibrated_rating,
        ABS(COALESCE(pr.self_rating, 0) - COALESCE(pr.overall_rating, 0)) as rating_gap,
        CASE
          WHEN pr.calibrated_rating IS NOT NULL THEN 'calibrated'
          WHEN pr.manager_submitted_at IS NOT NULL THEN 'reviewed'
          WHEN pr.self_submitted_at IS NOT NULL THEN 'pending_review'
          ELSE 'pending_self'
        END as review_status
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE pr.tenant_id = $1
        AND e.manager_id = $2
        AND (pr.review_cycle_id = $3 OR ($3 IS NULL AND pr.review_period_end >= NOW() - INTERVAL '6 months'))
      ORDER BY pr.overall_rating DESC NULLS LAST, e.last_name
    `, [tenantId, manager_id, review_cycle_id || null]);
    const distribution = {
        excellent: result.rows.filter((r) => r.manager_rating >= 4.5).length,
        good: result.rows.filter((r) => r.manager_rating >= 3.5 && r.manager_rating < 4.5).length,
        meets: result.rows.filter((r) => r.manager_rating >= 2.5 && r.manager_rating < 3.5).length,
        below: result.rows.filter((r) => r.manager_rating < 2.5 && r.manager_rating !== null).length,
        not_rated: result.rows.filter((r) => r.manager_rating === null).length,
    };
    res.json({
        success: true,
        data: {
            employees: result.rows,
            distribution,
            total: result.rows.length,
        },
    });
}));
/**
 * GET /performance-reviews/9-box-grid
 * Get 9-box grid for talent assessment
 */
router.get('/9-box-grid', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id, org_unit_id } = req.query;
    const grid = await performanceManagementService.get9BoxGrid(tenantId, review_cycle_id);
    // If department filter, filter the results
    if (org_unit_id) {
        const filteredGrid = {};
        let total = 0;
        for (const [boxKey, employees] of Object.entries(grid.grid)) {
            const filtered = employees.filter((e) => e.org_unit_id === org_unit_id);
            filteredGrid[boxKey] = filtered;
            total += filtered.length;
        }
        res.json({
            success: true,
            data: {
                grid: filteredGrid,
                summary: {
                    total,
                    by_category: grid.summary.by_category,
                },
            },
        });
        return;
    }
    res.json({ success: true, data: grid });
}));
/**
 * GET /performance-reviews/competency-frameworks
 * Get available competency frameworks
 */
router.get('/competency-frameworks', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const frameworks = await performanceManagementService.getCompetencyFrameworks(tenantId);
    res.json({ success: true, data: frameworks });
}));
/**
 * GET /performance-reviews/rating-scales
 * Get available rating scales
 */
router.get('/rating-scales', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const scales = await performanceManagementService.getRatingScales(tenantId);
    res.json({ success: true, data: scales });
}));
/**
 * GET /performance-reviews/feedback-360/pending
 * Get pending feedback requests for current user (by rater_id)
 */
router.get('/feedback-360/pending', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { rater_id } = req.query;
    if (!rater_id) {
        throw Errors.badRequest('rater_id is required');
    }
    const result = await req.dbClient.query(`
      SELECT f.*,
        s.first_name || ' ' || s.last_name as subject_name,
        s.job_title as subject_job_title,
        d.name as subject_department
      FROM feedback_360 f
      JOIN employees s ON f.subject_id = s.id
      LEFT JOIN org_units d ON s.org_unit_id = d.id
      WHERE f.rater_id = $1 AND f.tenant_id = $2 AND f.status = 'pending'
      ORDER BY f.due_date, f.created_at
    `, [rater_id, tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * PATCH /performance-reviews/feedback-360/:feedbackId
 * Update and submit 360 feedback (must be before /:id)
 */
router.patch('/feedback-360/:feedbackId', validate(updateFeedback360Schema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const feedbackId = req.params['feedbackId'];
    const { overall_rating, competency_ratings, strengths, areas_for_improvement, additional_comments, submit, } = req.body;
    // Verify feedback exists and is pending
    const feedbackCheck = await req.dbClient.query('SELECT id, status FROM feedback_360 WHERE id = $1 AND tenant_id = $2', [feedbackId, tenantId]);
    if (feedbackCheck.rows.length === 0) {
        throw Errors.notFound('Feedback request');
    }
    if (feedbackCheck.rows[0].status !== 'pending') {
        throw Errors.badRequest('Feedback has already been submitted');
    }
    if (submit) {
        // Submit the feedback
        const feedback = await performanceManagementService.submit360Feedback(tenantId, feedbackId, {
            overall_rating,
            competency_ratings,
            strengths,
            areas_for_improvement,
            additional_comments,
        });
        res.json({ success: true, data: feedback, message: 'Feedback submitted' });
    }
    else {
        // Just save as draft
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (overall_rating !== undefined) {
            updates.push(`overall_rating = $${paramIndex}`);
            values.push(overall_rating);
            paramIndex++;
        }
        if (competency_ratings !== undefined) {
            updates.push(`competency_ratings = $${paramIndex}::jsonb`);
            values.push(JSON.stringify(competency_ratings));
            paramIndex++;
        }
        if (strengths !== undefined) {
            updates.push(`strengths = $${paramIndex}`);
            values.push(strengths);
            paramIndex++;
        }
        if (areas_for_improvement !== undefined) {
            updates.push(`areas_for_improvement = $${paramIndex}`);
            values.push(areas_for_improvement);
            paramIndex++;
        }
        if (additional_comments !== undefined) {
            updates.push(`additional_comments = $${paramIndex}`);
            values.push(additional_comments);
            paramIndex++;
        }
        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            values.push(feedbackId, tenantId);
            await req.dbClient.query(`UPDATE feedback_360 SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, values);
        }
        const result = await req.dbClient.query(`SELECT id, tenant_id, target_employee_id, reviewer_employee_id,
                review_cycle_id, relationship_type, overall_rating, strengths,
                areas_for_improvement, is_anonymous, status, created_at, completed_at,
                questionnaire_id, performance_review_id, request_id,
                question_responses, sentiment_score, submission_time_seconds
         FROM feedback_360 WHERE id = $1 AND tenant_id = $2`, [feedbackId, tenantId]);
        res.json({ success: true, data: result.rows[0] || null, message: 'Feedback saved as draft' });
    }
}));
/**
 * GET /performance-reviews/competency-frameworks/:frameworkId
 * Get a specific framework with competencies
 */
router.get('/competency-frameworks/:frameworkId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { frameworkId } = req.params;
    const frameworkResult = await req.dbClient.query(`SELECT id, tenant_id, name, description, version, framework_type,
              is_active, created_at, updated_at
       FROM competency_frameworks WHERE id = $1 AND tenant_id = $2`, [frameworkId, tenantId]);
    if (frameworkResult.rows.length === 0) {
        throw Errors.notFound('Competency framework');
    }
    const competenciesResult = await req.dbClient.query('SELECT id, tenant_id, framework_id, name, description, category, behavioral_indicators, weight, sort_order, is_active, created_at, updated_at FROM competencies WHERE framework_id = $1 AND tenant_id = $2 ORDER BY category, sort_order', [frameworkId, tenantId]);
    res.json({
        success: true,
        data: {
            framework: frameworkResult.rows[0],
            competencies: competenciesResult.rows,
        },
    });
}));
// ============================================================================
// PARAMETERIZED ROUTES
// ============================================================================
/**
 * GET /performance-reviews/:id
 */
router.get('/:id', validateUUID(), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT pr.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        e.job_title as employee_job_title,
        r.first_name || ' ' || r.last_name as reviewer_name
      FROM performance_reviews pr
      LEFT JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      WHERE pr.id = $1 AND pr.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /performance-reviews
 */
router.post('/', requirePermission('PERFORMANCE', 'CREATE'), validate(createReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, reviewer_id, review_period_start, review_period_end, review_type, overall_rating, goal_achievement_rating, competency_rating, potential_rating, strengths, areas_for_improvement, manager_comments, employee_comments, status = 'draft', } = req.body;
    if (!employee_id || !reviewer_id) {
        throw Errors.badRequest('Employee ID and reviewer ID are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO performance_reviews (tenant_id, employee_id, reviewer_id, review_period_start, review_period_end,
        review_type, overall_rating, goal_achievement_rating, competency_rating, potential_rating,
        strengths, areas_for_improvement, manager_comments, employee_comments, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *
    `, [
        tenantId,
        employee_id,
        reviewer_id,
        review_period_start,
        review_period_end,
        review_type,
        overall_rating,
        goal_achievement_rating,
        competency_rating,
        potential_rating,
        strengths,
        areas_for_improvement,
        manager_comments,
        employee_comments,
        status,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Performance review created' });
}));
/**
 * PATCH /performance-reviews/:id
 */
router.patch('/:id', validateUUID(), requirePermission('PERFORMANCE', 'EDIT'), validate(updateReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const allowedFields = [
        'review_period_start',
        'review_period_end',
        'review_type',
        'overall_rating',
        'goal_achievement_rating',
        'competency_rating',
        'potential_rating',
        'strengths',
        'areas_for_improvement',
        'manager_comments',
        'employee_comments',
        'status',
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(req.body[field]);
            paramIndex++;
        }
    }
    // Auto-set submitted_at when status changes to submitted
    if (req.body.status === 'submitted') {
        updates.push(`submitted_at = NOW()`);
    }
    if (req.body.status === 'acknowledged') {
        updates.push(`acknowledged_at = NOW()`);
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    updates.push('updated_at = NOW()');
    const result = await req.dbClient.query(`UPDATE performance_reviews SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Performance review updated',
    });
}));
/**
 * DELETE /performance-reviews/:id
 */
router.delete('/:id', validateUUID(), requirePermission('PERFORMANCE', 'DELETE'), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM performance_reviews WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    res.json({ success: true, message: 'Performance review deleted' });
}));
// ============================================================================
// SELF-ASSESSMENT ENDPOINTS - S-PERF-01-02
// ============================================================================
/**
 * GET /performance-reviews/:id/goals
 * Get goals for a performance review (auto-populated from goals table)
 */
router.get('/:id/goals', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    // Get review details
    const reviewCheck = await req.dbClient.query('SELECT employee_id, review_period_start, review_period_end, goals_auto_populated FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const { employee_id, review_period_start, review_period_end, goals_auto_populated } = reviewCheck.rows[0];
    // Get goal ratings if already populated
    const goalRatingsResult = await req.dbClient.query(`
      SELECT grr.*, g.title, g.description, g.goal_type, g.status as goal_status,
             g.progress_percent, g.due_date, g.category, g.start_date,
             pg.title as parent_goal_title
      FROM goal_review_ratings grr
      JOIN goals g ON grr.goal_id = g.id
      LEFT JOIN goals pg ON g.parent_goal_id = pg.id
      WHERE grr.performance_review_id = $1
      ORDER BY g.due_date, g.weight DESC
    `, [reviewId]);
    // If not auto-populated, also show available goals
    let availableGoals = [];
    if (!goals_auto_populated || goalRatingsResult.rows.length === 0) {
        const availableResult = await req.dbClient.query(`
        SELECT * FROM fn_get_review_period_goals($1, $2, $3, $4)
      `, [tenantId, employee_id, review_period_start, review_period_end]);
        availableGoals = availableResult.rows;
    }
    res.json({
        success: true,
        data: {
            goals_auto_populated,
            goal_ratings: goalRatingsResult.rows,
            available_goals: availableGoals,
            period: { start: review_period_start, end: review_period_end },
        },
    });
}));
/**
 * POST /performance-reviews/:id/goals/auto-populate
 * Auto-populate goals from employee's goals table
 */
router.post('/:id/goals/auto-populate', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    // Call the auto-populate function
    const result = await req.dbClient.query('SELECT fn_auto_populate_goal_ratings($1, $2) as count', [tenantId, reviewId]);
    const count = result.rows[0]?.count || 0;
    // Get the populated goals
    const goalsResult = await req.dbClient.query(`
      SELECT grr.*, g.title, g.description, g.goal_type, g.status as goal_status,
             g.progress_percent, g.due_date, g.category
      FROM goal_review_ratings grr
      JOIN goals g ON grr.goal_id = g.id
      WHERE grr.performance_review_id = $1
      ORDER BY g.due_date, g.weight DESC
    `, [reviewId]);
    res.json({
        success: true,
        data: goalsResult.rows,
        message: `${count} goals auto-populated`,
    });
}));
/**
 * PUT /performance-reviews/:id/goals/:goalId
 * Update goal rating (self-assessment)
 */
router.put('/:id/goals/:goalId', validate(updateGoalRatingSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const goalId = req.params['goalId'];
    const { self_rating, self_comment, achievement_description } = req.body;
    const result = await req.dbClient.query(`
      UPDATE goal_review_ratings SET
        self_rating = COALESCE($3, self_rating),
        self_comment = COALESCE($4, self_comment),
        achievement_description = COALESCE($5, achievement_description),
        updated_at = NOW()
      WHERE performance_review_id = $1 AND goal_id = $2 AND tenant_id = $6
      RETURNING *
    `, [reviewId, goalId, self_rating, self_comment, achievement_description, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Goal rating');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Goal rating updated' });
}));
/**
 * PUT /performance-reviews/:id/self-assessment
 * Save self-assessment (draft save without validation)
 */
router.put('/:id/self-assessment', validate(saveSelfAssessmentSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { self_rating, self_comments, goal_ratings, competency_ratings, strengths, areas_for_improvement, } = req.body;
    // Check review exists and is in valid state
    const reviewCheck = await req.dbClient.query('SELECT id, status, self_assessment_status, employee_id FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const review = reviewCheck.rows[0];
    if (review.self_assessment_status === 'submitted') {
        throw Errors.badRequest('Self-assessment already submitted');
    }
    // Update performance review with self-assessment data
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (self_rating !== undefined) {
        updates.push(`self_rating = $${paramIndex}`);
        values.push(self_rating);
        paramIndex++;
    }
    if (self_comments !== undefined) {
        updates.push(`self_comments = $${paramIndex}`);
        values.push(self_comments);
        paramIndex++;
    }
    if (strengths !== undefined) {
        updates.push(`strengths = $${paramIndex}`);
        values.push(strengths);
        paramIndex++;
    }
    if (areas_for_improvement !== undefined) {
        updates.push(`areas_for_improvement = $${paramIndex}`);
        values.push(areas_for_improvement);
        paramIndex++;
    }
    // Always update these
    updates.push(`self_assessment_status = 'in_progress'`);
    updates.push(`updated_at = NOW()`);
    // Set started_at if first save
    if (review.self_assessment_status === 'not_started' || !review.self_assessment_status) {
        updates.push(`self_assessment_started_at = NOW()`);
    }
    values.push(reviewId, tenantId);
    const updateResult = await req.dbClient.query(`UPDATE performance_reviews SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, values);
    // Update goal ratings if provided
    if (goal_ratings && Array.isArray(goal_ratings)) {
        for (const gr of goal_ratings) {
            await req.dbClient.query(`
          UPDATE goal_review_ratings SET
            self_rating = COALESCE($3, self_rating),
            self_comment = COALESCE($4, self_comment),
            achievement_description = COALESCE($5, achievement_description),
            updated_at = NOW()
          WHERE performance_review_id = $1 AND goal_id = $2
        `, [reviewId, gr.goal_id, gr.self_rating, gr.self_comment, gr.achievement_description]);
        }
    }
    // Update competency ratings if provided
    if (competency_ratings && Array.isArray(competency_ratings)) {
        for (const cr of competency_ratings) {
            await req.dbClient.query(`
          INSERT INTO competency_review_ratings (tenant_id, performance_review_id, employee_id, ksaba_dimension, competency_name, self_rating, self_comment)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (performance_review_id, competency_name) DO UPDATE SET
            self_rating = COALESCE($6, competency_review_ratings.self_rating),
            self_comment = COALESCE($7, competency_review_ratings.self_comment),
            updated_at = NOW()
        `, [
                tenantId,
                reviewId,
                review.employee_id,
                cr.ksaba_dimension,
                cr.competency_name,
                cr.self_rating,
                cr.self_comment,
            ]);
        }
    }
    res.json({
        success: true,
        data: updateResult.rows[0] || null,
        message: 'Self-assessment draft saved',
    });
}));
/**
 * POST /performance-reviews/:id/self-assessment/submit
 * Submit self-assessment (with validation)
 */
router.post('/:id/self-assessment/submit', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    // Get review with template
    const reviewResult = await req.dbClient.query(`
      SELECT pr.*, t.sections as template_sections
      FROM performance_reviews pr
      LEFT JOIN performance_review_templates t ON pr.template_id = t.id
      WHERE pr.id = $1 AND pr.tenant_id = $2
    `, [reviewId, tenantId]);
    if (reviewResult.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const review = reviewResult.rows[0];
    if (review.self_assessment_status === 'submitted') {
        throw Errors.badRequest('Self-assessment already submitted');
    }
    // Validation checks
    const errors = [];
    // Check self_rating if required
    if (review.self_rating === null) {
        errors.push('Overall self-rating is required');
    }
    // Check goals have ratings
    const goalsCheck = await req.dbClient.query(`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE self_rating IS NOT NULL) as rated
      FROM goal_review_ratings WHERE performance_review_id = $1
    `, [reviewId]);
    if (goalsCheck.rows[0].total > 0 && goalsCheck.rows[0].rated < goalsCheck.rows[0].total) {
        errors.push(`${goalsCheck.rows[0]?.total - goalsCheck.rows[0]?.rated} goals not rated`);
    }
    if (errors.length > 0) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            validation_errors: errors,
        });
        return;
    }
    // Submit within a transaction to ensure atomicity
    const result = await withTransaction(async (txClient) => {
        const updateResult = await txClient.query(`
        UPDATE performance_reviews SET
          self_assessment_status = 'submitted',
          self_submitted_at = NOW(),
          status = CASE WHEN status = 'draft' THEN 'pending' ELSE status END,
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `, [reviewId, tenantId]);
        // Update participant status
        await txClient.query(`
        UPDATE review_cycle_participants SET
          self_review_completed = true,
          self_review_completed_at = NOW(),
          status = 'in_progress',
          updated_at = NOW()
        WHERE review_cycle_id = $1 AND employee_id = $2
      `, [review.review_cycle_id, review.employee_id]);
        return updateResult.rows[0];
    }, tenantId);
    res.json({
        success: true,
        data: result,
        message: 'Self-assessment submitted successfully',
    });
}));
/**
 * GET /performance-reviews/:id/evidence
 * Get all evidence for a self-assessment
 */
router.get('/:id/evidence', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT sae.*, g.title as related_goal_title
      FROM self_assessment_evidence sae
      LEFT JOIN goals g ON sae.related_goal_id = g.id
      WHERE sae.performance_review_id = $1 AND sae.tenant_id = $2
      ORDER BY sae.created_at DESC
    `, [reviewId, tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * POST /performance-reviews/:id/evidence
 * Add evidence to self-assessment
 */
router.post('/:id/evidence', validate(addEvidenceSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { evidence_type, title, description, file_url, external_link, related_goal_id, related_competency, date_achieved, } = req.body;
    if (!evidence_type || !title) {
        throw Errors.badRequest('evidence_type and title are required');
    }
    // Verify review exists and get employee_id
    const reviewCheck = await req.dbClient.query('SELECT employee_id, self_assessment_status FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    if (reviewCheck.rows[0].self_assessment_status === 'submitted') {
        throw Errors.badRequest('Cannot add evidence after submission');
    }
    const result = await req.dbClient.query(`
      INSERT INTO self_assessment_evidence (
        tenant_id, performance_review_id, employee_id, evidence_type, title,
        description, file_url, external_link, related_goal_id, related_competency, date_achieved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
        tenantId,
        reviewId,
        reviewCheck.rows[0]?.employee_id,
        evidence_type,
        title,
        description,
        file_url,
        external_link,
        related_goal_id,
        related_competency,
        date_achieved,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Evidence added' });
}));
/**
 * DELETE /performance-reviews/:id/evidence/:evidenceId
 * Remove evidence from self-assessment
 */
router.delete('/:id/evidence/:evidenceId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const evidenceId = req.params['evidenceId'];
    // Check if review is still editable
    const reviewCheck = await req.dbClient.query('SELECT self_assessment_status FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    if (reviewCheck.rows[0].self_assessment_status === 'submitted') {
        throw Errors.badRequest('Cannot remove evidence after submission');
    }
    const result = await req.dbClient.query('DELETE FROM self_assessment_evidence WHERE id = $1 AND performance_review_id = $2 AND tenant_id = $3 RETURNING id', [evidenceId, reviewId, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Evidence');
    }
    res.json({ success: true, message: 'Evidence removed' });
}));
/**
 * GET /performance-reviews/:id/competencies
 * Get competency ratings for a review (KSABA dimensions)
 */
router.get('/:id/competencies', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id, competency_id,
        ksaba_dimension, competency_name, self_rating, self_comment, self_evidence,
        manager_rating, manager_comment, weight, created_at, updated_at
      FROM competency_review_ratings
      WHERE performance_review_id = $1 AND tenant_id = $2
      ORDER BY ksaba_dimension, competency_name
    `, [reviewId, tenantId]);
    // Group by KSABA dimension
    const grouped = {
        knowledge: [],
        skills: [],
        abilities: [],
        behaviors: [],
        attitudes: [],
    };
    for (const row of result.rows) {
        const dim = row.ksaba_dimension || 'skills';
        if (grouped[dim]) {
            grouped[dim].push(row);
        }
    }
    res.json({ success: true, data: { ratings: result.rows, by_dimension: grouped } });
}));
/**
 * PUT /performance-reviews/:id/competencies
 * Batch update competency ratings
 */
router.put('/:id/competencies', validate(updateCompetenciesSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { competencies } = req.body;
    if (!competencies || !Array.isArray(competencies)) {
        throw Errors.badRequest('competencies array is required');
    }
    // Get employee_id
    const reviewCheck = await req.dbClient.query('SELECT employee_id, self_assessment_status FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    if (reviewCheck.rows[0].self_assessment_status === 'submitted') {
        res
            .status(400)
            .json({ success: false, error: 'Cannot update competencies after submission' });
        return;
    }
    const employee_id = reviewCheck.rows[0]?.employee_id;
    // Upsert each competency
    for (const comp of competencies) {
        await req.dbClient.query(`
        INSERT INTO competency_review_ratings (tenant_id, performance_review_id, employee_id, ksaba_dimension, competency_name, self_rating, self_comment, weight)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (performance_review_id, competency_name) DO UPDATE SET
          self_rating = COALESCE($6, competency_review_ratings.self_rating),
          self_comment = COALESCE($7, competency_review_ratings.self_comment),
          weight = COALESCE($8, competency_review_ratings.weight),
          updated_at = NOW()
      `, [
            tenantId,
            reviewId,
            employee_id,
            comp.ksaba_dimension,
            comp.competency_name,
            comp.self_rating,
            comp.self_comment,
            comp.weight || 1.0,
        ]);
    }
    // Get updated ratings
    const result = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id, competency_id,
        ksaba_dimension, competency_name, self_rating, self_comment, self_evidence,
        manager_rating, manager_comment, weight, created_at, updated_at
      FROM competency_review_ratings
      WHERE performance_review_id = $1 AND tenant_id = $2
      ORDER BY ksaba_dimension, competency_name
    `, [reviewId, tenantId]);
    res.json({ success: true, data: result.rows, message: 'Competency ratings updated' });
}));
// ============================================================================
// MANAGER REVIEW ENDPOINTS - S-PERF-01-03 (Parameterized routes)
// Note: Static routes /team and /team/comparison are in STATIC ROUTES section above
// ============================================================================
/**
 * GET /performance-reviews/:id/manager-view
 * Side-by-side view of self vs manager assessment
 */
router.get('/:id/manager-view', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    // Get main review data
    const reviewResult = await req.dbClient.query(`
      SELECT pr.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        e.job_title as employee_job_title,
        e.hire_date,
        d.name as department_name,
        rc.name as cycle_name,
        t.sections as template_sections,
        t.rating_scale_config
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      LEFT JOIN performance_review_templates t ON pr.template_id = t.id
      WHERE pr.id = $1 AND pr.tenant_id = $2
    `, [reviewId, tenantId]);
    if (reviewResult.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const review = reviewResult.rows[0];
    // Get goal ratings (self vs pending manager)
    const goalRatingsResult = await req.dbClient.query(`
      SELECT grr.*, g.title, g.description, g.goal_type, g.status as goal_status,
             g.progress_percent, g.due_date
      FROM goal_review_ratings grr
      JOIN goals g ON grr.goal_id = g.id
      WHERE grr.performance_review_id = $1
      ORDER BY g.due_date, g.weight DESC
    `, [reviewId]);
    // Get competency ratings
    const competencyRatingsResult = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id, competency_id,
        ksaba_dimension, competency_name, self_rating, self_comment, self_evidence,
        manager_rating, manager_comment, weight, created_at, updated_at
      FROM competency_review_ratings
      WHERE performance_review_id = $1
      ORDER BY ksaba_dimension, competency_name
    `, [reviewId]);
    // Get historical reviews (last 3)
    const historicalResult = await req.dbClient.query(`
      SELECT id, review_period_start, review_period_end, review_type,
             overall_rating, goal_achievement_rating, competency_rating,
             potential_rating, status, manager_comments
      FROM performance_reviews
      WHERE employee_id = $1 AND tenant_id = $2 AND id != $3
      ORDER BY review_period_end DESC
      LIMIT 3
    `, [review.employee_id, tenantId, reviewId]);
    // Get evidence
    const evidenceResult = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id, evidence_type,
        title, description, file_url, external_link, related_goal_id,
        related_competency, date_achieved, verified, verified_by, verified_at,
        created_at, updated_at
      FROM self_assessment_evidence
      WHERE performance_review_id = $1
      ORDER BY created_at DESC
    `, [reviewId]);
    res.json({
        success: true,
        data: {
            review,
            goal_ratings: goalRatingsResult.rows,
            competency_ratings: competencyRatingsResult.rows,
            historical_reviews: historicalResult.rows,
            evidence: evidenceResult.rows,
            comparison: {
                self_rating: review.self_rating,
                manager_rating: review.overall_rating,
                gap: review.self_rating && review.overall_rating
                    ? Math.abs(parseFloat(review.self_rating) - parseFloat(review.overall_rating))
                    : null,
            },
        },
    });
}));
/**
 * PUT /performance-reviews/:id/manager-review
 * Save manager review (with required comments)
 */
router.put('/:id/manager-review', validate(saveManagerReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { overall_rating, goal_achievement_rating, competency_rating, potential_rating, manager_comments, strengths, areas_for_improvement, goal_ratings, competency_ratings, } = req.body;
    // Validate required comments if rating provided
    if (overall_rating !== undefined && !manager_comments) {
        throw Errors.badRequest('manager_comments is required when providing ratings');
    }
    // Check review exists
    const reviewCheck = await req.dbClient.query('SELECT id, employee_id, manager_submitted_at FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    const fields = {
        overall_rating,
        goal_achievement_rating,
        competency_rating,
        potential_rating,
        manager_comments,
        strengths,
        areas_for_improvement,
    };
    for (const [field, value] of Object.entries(fields)) {
        if (value !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }
    updates.push('updated_at = NOW()');
    updates.push(`status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END`);
    values.push(reviewId, tenantId);
    const result = await req.dbClient.query(`UPDATE performance_reviews SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, values);
    // Update goal ratings if provided
    if (goal_ratings && Array.isArray(goal_ratings)) {
        for (const gr of goal_ratings) {
            await req.dbClient.query(`
          UPDATE goal_review_ratings SET
            manager_rating = COALESCE($3, manager_rating),
            manager_comment = COALESCE($4, manager_comment),
            updated_at = NOW()
          WHERE performance_review_id = $1 AND goal_id = $2
        `, [reviewId, gr.goal_id, gr.manager_rating, gr.manager_comment]);
        }
    }
    // Update competency ratings if provided
    if (competency_ratings && Array.isArray(competency_ratings)) {
        for (const cr of competency_ratings) {
            await req.dbClient.query(`
          UPDATE competency_review_ratings SET
            manager_rating = COALESCE($3, manager_rating),
            manager_comment = COALESCE($4, manager_comment),
            updated_at = NOW()
          WHERE performance_review_id = $1 AND competency_name = $2
        `, [reviewId, cr.competency_name, cr.manager_rating, cr.manager_comment]);
        }
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Manager review saved',
    });
}));
/**
 * POST /performance-reviews/:id/manager-review/submit
 * Submit manager review (with validation)
 */
router.post('/:id/manager-review/submit', validate(submitManagerReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { flag_for_calibration, calibration_notes } = req.body;
    // Get review
    const reviewResult = await req.dbClient.query(`SELECT id, tenant_id, employee_id, reviewer_id, review_type, status,
                overall_rating, goal_achievement_rating, competency_rating,
                review_period_start, review_period_end, review_cycle_id,
                self_assessment_status, goals_count, competencies_count
         FROM performance_reviews WHERE id = $1 AND tenant_id = $2`, [reviewId, tenantId]);
    if (reviewResult.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const review = reviewResult.rows[0];
    // Validation
    const errors = [];
    if (!review.overall_rating) {
        errors.push('Overall rating is required');
    }
    if (!review.manager_comments) {
        errors.push('Manager comments are required');
    }
    // Check goal ratings are complete
    const goalsCheck = await req.dbClient.query(`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE manager_rating IS NOT NULL) as rated
      FROM goal_review_ratings WHERE performance_review_id = $1
    `, [reviewId]);
    if (goalsCheck.rows[0].total > 0 && goalsCheck.rows[0].rated < goalsCheck.rows[0].total) {
        errors.push(`${goalsCheck.rows[0]?.total - goalsCheck.rows[0]?.rated} goals not rated by manager`);
    }
    if (errors.length > 0) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            validation_errors: errors,
        });
        return;
    }
    // Submit manager review
    const updateFields = [
        'manager_submitted_at = NOW()',
        "status = 'submitted'",
        'updated_at = NOW()',
    ];
    const updateParams = [reviewId, tenantId];
    let updateParamIndex = 3;
    if (flag_for_calibration) {
        updateFields.push('needs_calibration = true');
    }
    if (calibration_notes) {
        updateFields.push(`calibration_notes = $${updateParamIndex}`);
        updateParams.push(calibration_notes);
        updateParamIndex++;
    }
    const result = await req.dbClient.query(`
      UPDATE performance_reviews SET ${updateFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, updateParams);
    // Update participant status
    await req.dbClient.query(`
      UPDATE review_cycle_participants SET
        manager_review_completed = true,
        manager_review_completed_at = NOW(),
        status = CASE WHEN calibration_completed THEN 'completed' ELSE 'in_progress' END,
        updated_at = NOW()
      WHERE review_cycle_id = $1 AND employee_id = $2
    `, [review.review_cycle_id, review.employee_id]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Manager review submitted successfully',
    });
}));
/**
 * GET /performance-reviews/:id/history
 * Get historical performance reviews for an employee
 */
router.get('/:id/history', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { limit = '3' } = req.query;
    // Get employee_id from current review
    const currentReview = await req.dbClient.query('SELECT employee_id FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (currentReview.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const employeeId = currentReview.rows[0]?.employee_id;
    // Get historical reviews
    const result = await req.dbClient.query(`
      SELECT pr.id, pr.review_period_start, pr.review_period_end, pr.review_type,
             pr.overall_rating, pr.self_rating, pr.goal_achievement_rating,
             pr.competency_rating, pr.potential_rating, pr.status,
             pr.manager_comments, pr.strengths, pr.areas_for_improvement,
             rc.name as cycle_name, rc.cycle_type
      FROM performance_reviews pr
      LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      WHERE pr.employee_id = $1 AND pr.tenant_id = $2 AND pr.id != $3
        AND pr.status IN ('completed', 'acknowledged')
      ORDER BY pr.review_period_end DESC
      LIMIT $4
    `, [employeeId, tenantId, reviewId, safeParseInt(limit, { fallback: 50 })]);
    // Calculate trends
    const ratings = result.rows
        .filter((r) => r.overall_rating !== null)
        .map((r) => parseFloat(r.overall_rating));
    const trend = ratings.length >= 2
        ? ratings[0] > ratings[1]
            ? 'improving'
            : ratings[0] < ratings[1]
                ? 'declining'
                : 'stable'
        : 'insufficient_data';
    res.json({
        success: true,
        data: {
            reviews: result.rows,
            trend,
            average_rating: ratings.length > 0
                ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
                : null,
        },
    });
}));
// ============================================================================
// ADVANCED PERFORMANCE REVIEW FEATURES - Story 9.5
// ============================================================================
/**
 * GET /performance-reviews/:id/details
 * Get full performance review details with self-review and 360 feedback
 */
router.get('/:id/details', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    // Get the main review
    const reviewResult = await req.dbClient.query(`
      SELECT pr.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        e.job_title as employee_job_title,
        d.name as department_name,
        r.first_name || ' ' || r.last_name as reviewer_name
      FROM performance_reviews pr
      LEFT JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      WHERE pr.id = $1 AND pr.tenant_id = $2
    `, [reviewId, tenantId]);
    if (reviewResult.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const review = reviewResult.rows[0];
    // Get self-review if exists
    const selfReviewResult = await req.dbClient.query(`
      SELECT id, tenant_id, performance_review_id, employee_id,
        self_overall_rating, self_goal_rating, self_competency_rating,
        achievements, challenges, learnings, goals_for_next_period,
        feedback_for_manager, competency_self_ratings, goal_self_assessments,
        status, submitted_at, created_at, updated_at, goal_ratings,
        ksaba_ratings, evidence_count, last_saved_at
      FROM self_reviews WHERE performance_review_id = $1 AND tenant_id = $2
    `, [reviewId, tenantId]);
    // Get 360 feedback summary
    const feedback360Result = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        AVG(CASE WHEN overall_rating IS NOT NULL THEN overall_rating::numeric ELSE NULL END) as avg_rating
      FROM feedback_360
      WHERE subject_id = $1 AND tenant_id = $2
    `, [review.employee_id, tenantId]);
    // Get goals progress
    const goalsResult = await req.dbClient.query(`
      SELECT
        COUNT(*) as total_goals,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_goals,
        ROUND(AVG(progress), 2) as avg_progress
      FROM goals
      WHERE employee_id = $1 AND tenant_id = $2
        AND target_date >= $3 AND target_date <= $4
    `, [review.employee_id, tenantId, review.review_period_start, review.review_period_end]);
    res.json({
        success: true,
        data: {
            review,
            self_review: selfReviewResult.rows[0] || null,
            feedback_360_summary: feedback360Result.rows[0],
            goals_summary: goalsResult.rows[0],
        },
    });
}));
// ============================================================================
// SELF-REVIEWS
// ============================================================================
/**
 * GET /performance-reviews/:id/self-review
 * Get self-review for a performance review
 */
router.get('/:id/self-review', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT sr.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM self_reviews sr
      JOIN employees e ON sr.employee_id = e.id
      WHERE sr.performance_review_id = $1 AND sr.tenant_id = $2
    `, [reviewId, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Self-review');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /performance-reviews/:id/self-review
 * Create a self-review
 */
router.post('/:id/self-review', validate(createSelfReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { self_rating, achievements, challenges, development_goals, feedback_for_manager, competency_ratings, additional_comments, } = req.body;
    // Verify review exists and get employee_id
    const reviewCheck = await req.dbClient.query('SELECT id, employee_id FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    // Check if self-review already exists
    const existingCheck = await req.dbClient.query('SELECT id FROM self_reviews WHERE performance_review_id = $1', [reviewId]);
    if (existingCheck.rows.length > 0) {
        res.status(400).json({ success: false, error: 'Self-review already exists for this review' });
        return;
    }
    const selfReview = await performanceManagementService.createSelfReview(tenantId, reviewId, {
        employee_id: reviewCheck.rows[0]?.employee_id,
        self_rating,
        achievements,
        challenges,
        development_goals,
        feedback_for_manager,
        competency_ratings,
        additional_comments,
    });
    res.status(201).json({ success: true, data: selfReview, message: 'Self-review created' });
}));
/**
 * PATCH /performance-reviews/:id/self-review
 * Update a self-review
 */
router.patch('/:id/self-review', validate(updateSelfReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const existingResult = await req.dbClient.query('SELECT id, status FROM self_reviews WHERE performance_review_id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (existingResult.rows.length === 0) {
        throw Errors.notFound('Self-review');
    }
    if (existingResult.rows[0].status === 'submitted') {
        throw Errors.badRequest('Cannot update a submitted self-review');
    }
    const allowedFields = [
        'self_rating',
        'achievements',
        'challenges',
        'development_goals',
        'feedback_for_manager',
        'competency_ratings',
        'additional_comments',
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            if (field === 'competency_ratings') {
                updates.push(`${field} = $${paramIndex}::jsonb`);
                values.push(JSON.stringify(req.body[field]));
            }
            else {
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
    const result = await req.dbClient.query(`UPDATE self_reviews SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, [...values, existingResult.rows[0]?.id]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Self-review updated' });
}));
/**
 * POST /performance-reviews/:id/self-review/submit
 * Submit a self-review
 */
router.post('/:id/self-review/submit', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const existingResult = await req.dbClient.query('SELECT id FROM self_reviews WHERE performance_review_id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (existingResult.rows.length === 0) {
        throw Errors.notFound('Self-review');
    }
    const selfReview = await performanceManagementService.submitSelfReview(tenantId, existingResult.rows[0]?.id);
    res.json({ success: true, data: selfReview, message: 'Self-review submitted' });
}));
// ============================================================================
// 360 FEEDBACK
// ============================================================================
/**
 * GET /performance-reviews/:id/feedback-360
 * Get all 360 feedback for an employee's review
 */
router.get('/:id/feedback-360', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { include_details } = req.query;
    // Get employee_id from review
    const reviewCheck = await req.dbClient.query('SELECT employee_id, review_period_start, review_period_end FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const { employee_id } = reviewCheck.rows[0];
    // Get feedback summary
    const summary = await performanceManagementService.get360FeedbackSummary(tenantId, employee_id, undefined // Could filter by review_cycle_id if needed
    );
    // Optionally include detailed feedback (anonymized if needed)
    let details = null;
    if (include_details === 'true') {
        const detailsResult = await req.dbClient.query(`
        SELECT
          f.id,
          f.rater_type,
          f.relationship,
          f.overall_rating,
          f.strengths,
          f.areas_for_improvement,
          f.additional_comments,
          f.status,
          f.submitted_at
        FROM feedback_360 f
        WHERE f.subject_id = $1 AND f.tenant_id = $2 AND f.status = 'submitted'
        ORDER BY f.submitted_at DESC
      `, [employee_id, tenantId]);
        details = detailsResult.rows;
    }
    res.json({
        success: true,
        data: {
            ...summary,
            details,
        },
    });
}));
/**
 * POST /performance-reviews/:id/feedback-360/request
 * Request 360 feedback for an employee
 */
router.post('/:id/feedback-360/request', validate(request360FeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { raters, review_cycle_id } = req.body;
    if (!raters || !Array.isArray(raters) || raters.length === 0) {
        throw Errors.badRequest('raters array is required');
    }
    // Get employee_id from review
    const reviewCheck = await req.dbClient.query('SELECT employee_id FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const feedbackRequests = await performanceManagementService.request360Feedback(tenantId, reviewCheck.rows[0]?.employee_id, raters, review_cycle_id);
    res.status(201).json({
        success: true,
        data: feedbackRequests,
        message: `${feedbackRequests.length} feedback requests created`,
    });
}));
/**
 * POST /performance-reviews/feedback-360/:feedbackId/decline
 * Decline a feedback request (this path needs to be before /:id)
 */
router.post('/feedback-360/:feedbackId/decline', validate(decline360FeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const feedbackId = req.params['feedbackId'];
    const { reason } = req.body;
    const result = await req.dbClient.query(`
      UPDATE feedback_360 SET
        status = 'declined',
        additional_comments = COALESCE($3, additional_comments),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
      RETURNING *
    `, [feedbackId, tenantId, reason]);
    if (result.rows.length === 0) {
        res
            .status(404)
            .json({ success: false, error: 'Feedback request not found or already processed' });
        return;
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Feedback request declined' });
}));
/**
 * POST /performance-reviews/:id/complete
 * Complete a performance review
 */
router.post('/:id/complete', validate(completeReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { final_comments } = req.body;
    // Verify review exists and check status
    const reviewCheck = await req.dbClient.query('SELECT id, status, employee_id FROM performance_reviews WHERE id = $1 AND tenant_id = $2', [reviewId, tenantId]);
    if (reviewCheck.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    // Check if self-review is submitted
    const selfReviewCheck = await req.dbClient.query("SELECT id FROM self_reviews WHERE performance_review_id = $1 AND status = 'submitted'", [reviewId]);
    const hasSelfReview = selfReviewCheck.rows.length > 0;
    // Complete review within a transaction to ensure atomicity
    const result = await withTransaction(async (txClient) => {
        const updateResult = await txClient.query(`
        UPDATE performance_reviews SET
          status = 'completed',
          completed_at = NOW(),
          final_comments = COALESCE($3, final_comments),
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `, [reviewId, tenantId, final_comments]);
        // Update participant status if part of a review cycle
        await txClient.query(`
        UPDATE review_cycle_participants SET
          status = 'completed',
          self_review_completed = $3,
          manager_review_completed = true,
          updated_at = NOW()
        WHERE employee_id = $1 AND tenant_id = $2 AND status != 'completed'
      `, [reviewCheck.rows[0]?.employee_id, tenantId, hasSelfReview]);
        return updateResult.rows[0];
    }, tenantId);
    res.json({ success: true, data: result, message: 'Performance review completed' });
}));
/**
 * POST /performance-reviews/:id/acknowledge
 * Employee acknowledges the review
 */
router.post('/:id/acknowledge', validate(acknowledgeReviewSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['id'];
    const { employee_acknowledgment_comments } = req.body;
    const result = await req.dbClient.query(`
      UPDATE performance_reviews SET
        status = 'acknowledged',
        acknowledged_at = NOW(),
        employee_comments = COALESCE($3, employee_comments),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'completed'
      RETURNING *
    `, [reviewId, tenantId, employee_acknowledgment_comments]);
    if (result.rows.length === 0) {
        res.status(404).json({
            success: false,
            error: 'Performance review not found or not in completed status',
        });
        return;
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Performance review acknowledged',
    });
}));
export default router;
//# sourceMappingURL=performance-reviews.js.map