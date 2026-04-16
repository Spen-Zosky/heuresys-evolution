/**
 * Feedback Routes
 * CRUD operations for continuous feedback and 360 feedback
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { createContinuousFeedbackSchema, createQuickFeedbackSchema, createFeedback360Schema, updateFeedback360Schema, completeFeedback360Schema, createQuestionnaireSchema, requestFeedback360Schema, } from '../schemas/engagement.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
/**
 * GET /feedback
 * Get all feedback (continuous + 360) combined
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '100', offset = '0', employee_id } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 100 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    // Optional: filter by employee involvement (sent or received)
    const continuousParams = [tenantId];
    let continuousFilter = '';
    if (employee_id) {
        continuousParams.push(employee_id);
        continuousFilter = ` AND (cf.from_employee_id = $${continuousParams.length} OR cf.to_employee_id = $${continuousParams.length})`;
    }
    continuousParams.push(limitNum, offsetNum);
    const continuous = await req.dbClient.query(`
      SELECT cf.id, 'continuous' as type, cf.feedback_type, cf.message as content,
        cf.from_employee_id, cf.to_employee_id, cf.created_at,
        f.first_name || ' ' || f.last_name as from_name,
        t.first_name || ' ' || t.last_name as to_name
      FROM continuous_feedback cf
      LEFT JOIN employees f ON cf.from_employee_id = f.id
      LEFT JOIN employees t ON cf.to_employee_id = t.id
      WHERE cf.tenant_id = $1${continuousFilter}
      ORDER BY cf.created_at DESC
      LIMIT $${continuousParams.length - 1} OFFSET $${continuousParams.length}
    `, continuousParams);
    const f360Params = [tenantId];
    let f360Filter = '';
    if (employee_id) {
        f360Params.push(employee_id);
        f360Filter = ` AND (f360.target_employee_id = $${f360Params.length} OR f360.reviewer_employee_id = $${f360Params.length})`;
    }
    f360Params.push(limitNum, offsetNum);
    const feedback360 = await req.dbClient.query(`
      SELECT f360.id, '360' as type, f360.relationship_type as feedback_type, f360.overall_rating as rating,
        f360.strengths, f360.areas_for_improvement, f360.created_at,
        subj.first_name || ' ' || subj.last_name as subject_name,
        rev.first_name || ' ' || rev.last_name as reviewer_name
      FROM feedback_360 f360
      LEFT JOIN employees subj ON f360.target_employee_id = subj.id
      LEFT JOIN employees rev ON f360.reviewer_employee_id = rev.id
      WHERE f360.tenant_id = $1${f360Filter}
      ORDER BY f360.created_at DESC
      LIMIT $${f360Params.length - 1} OFFSET $${f360Params.length}
    `, f360Params);
    res.json({
        success: true,
        data: {
            continuous: continuous.rows,
            feedback_360: feedback360.rows,
            total: continuous.rows.length + feedback360.rows.length,
        },
    });
}));
// ==================== CONTINUOUS FEEDBACK ====================
/**
 * GET /feedback/continuous
 */
router.get('/continuous', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { from_employee_id, to_employee_id, feedback_type, limit = '100', offset = '0', } = req.query;
    let query = `
      SELECT cf.id, cf.tenant_id, cf.from_employee_id, cf.to_employee_id,
        cf.feedback_type, cf.message, cf.is_private, cf.related_goal_id,
        cf.created_at, cf.visibility, cf.category, cf.acknowledged, cf.acknowledged_at,
        f.first_name || ' ' || f.last_name as from_name,
        t.first_name || ' ' || t.last_name as to_name
      FROM continuous_feedback cf
      LEFT JOIN employees f ON cf.from_employee_id = f.id
      LEFT JOIN employees t ON cf.to_employee_id = t.id
      WHERE cf.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (from_employee_id) {
        query += ` AND cf.from_employee_id = $${paramIndex}`;
        params.push(from_employee_id);
        paramIndex++;
    }
    if (to_employee_id) {
        query += ` AND cf.to_employee_id = $${paramIndex}`;
        params.push(to_employee_id);
        paramIndex++;
    }
    if (feedback_type) {
        query += ` AND cf.feedback_type = $${paramIndex}`;
        params.push(feedback_type);
        paramIndex++;
    }
    query += ` ORDER BY cf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM continuous_feedback WHERE tenant_id = $1', [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /feedback/continuous/:id
 */
router.get('/continuous/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT cf.id, cf.tenant_id, cf.from_employee_id, cf.to_employee_id,
        cf.feedback_type, cf.message, cf.is_private, cf.related_goal_id,
        cf.created_at, cf.competency_id, cf.sentiment_score, cf.acknowledged,
        cf.acknowledged_at, cf.visibility, cf.tags, cf.category,
        cf.performance_review_id,
        f.first_name || ' ' || f.last_name as from_name,
        f.email as from_email,
        t.first_name || ' ' || t.last_name as to_name,
        t.email as to_email
      FROM continuous_feedback cf
      LEFT JOIN employees f ON cf.from_employee_id = f.id
      LEFT JOIN employees t ON cf.to_employee_id = t.id
      WHERE cf.id = $1 AND cf.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Feedback');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /feedback/continuous
 */
router.post('/continuous', validate(createContinuousFeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { from_employee_id, to_employee_id, feedback_type = 'praise', message, is_private = false, related_goal_id, } = req.body;
    if (!from_employee_id || !to_employee_id || !message) {
        throw Errors.badRequest('from_employee_id, to_employee_id, and message are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO continuous_feedback (tenant_id, from_employee_id, to_employee_id, feedback_type, message, is_private, related_goal_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
        tenantId,
        from_employee_id,
        to_employee_id,
        feedback_type,
        message,
        is_private,
        related_goal_id,
    ]);
    res.status(201).json({ success: true, data: result.rows[0] || null, message: 'Feedback sent' });
}));
/**
 * DELETE /feedback/continuous/:id
 */
router.delete('/continuous/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM continuous_feedback WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Feedback');
    }
    res.json({ success: true, message: 'Feedback deleted' });
}));
// ==================== CONTINUOUS FEEDBACK ENHANCED (S-PERF-01-06) ====================
/**
 * GET /feedback/wall
 * Public praise wall
 */
router.get('/wall', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { limit = '50', offset = '0', category } = req.query;
    let query = `
      SELECT id, tenant_id, from_employee_id, from_name, from_job_title,
        to_employee_id, to_name, to_job_title, to_department, feedback_type,
        message, category, tags, created_at, acknowledged, related_goal_title
      FROM v_feedback_wall
      WHERE tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;
    if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /feedback/received/:employeeId
 * Get all feedback received by an employee
 */
router.get('/received/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { feedback_type, limit = '100', offset = '0' } = req.query;
    let query = `
      SELECT cf.id, cf.tenant_id, cf.from_employee_id, cf.to_employee_id,
        cf.feedback_type, cf.message, cf.is_private, cf.related_goal_id,
        cf.created_at, cf.visibility, cf.category, cf.acknowledged, cf.acknowledged_at,
        cf.tags, cf.sentiment_score,
        f.first_name || ' ' || f.last_name as from_name,
        f.job_title as from_job_title,
        g.title as goal_title
      FROM continuous_feedback cf
      JOIN employees f ON cf.from_employee_id = f.id
      LEFT JOIN goals g ON cf.related_goal_id = g.id
      WHERE cf.tenant_id = $1 AND cf.to_employee_id = $2
    `;
    const params = [tenantId, employeeId];
    let paramIndex = 3;
    if (feedback_type) {
        query += ` AND cf.feedback_type = $${paramIndex}`;
        params.push(feedback_type);
        paramIndex++;
    }
    query += ` ORDER BY cf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    // Get summary
    const summary = await req.dbClient.query(`
      SELECT tenant_id, employee_id, employee_name, total_received, praise_count,
        suggestion_count, concern_count, public_count, avg_sentiment,
        last_feedback_at, unique_givers
      FROM v_feedback_summary WHERE tenant_id = $1 AND employee_id = $2
    `, [tenantId, employeeId]);
    res.json({
        success: true,
        data: result.rows,
        summary: summary.rows[0] || null,
        meta: {
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /feedback/given/:employeeId
 * Get all feedback given by an employee
 */
router.get('/given/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { feedback_type, limit = '100', offset = '0' } = req.query;
    let query = `
      SELECT cf.id, cf.tenant_id, cf.from_employee_id, cf.to_employee_id,
        cf.feedback_type, cf.message, cf.is_private, cf.related_goal_id,
        cf.created_at, cf.visibility, cf.category, cf.acknowledged, cf.acknowledged_at,
        cf.tags, cf.sentiment_score,
        t.first_name || ' ' || t.last_name as to_name,
        t.job_title as to_job_title,
        g.title as goal_title
      FROM continuous_feedback cf
      JOIN employees t ON cf.to_employee_id = t.id
      LEFT JOIN goals g ON cf.related_goal_id = g.id
      WHERE cf.tenant_id = $1 AND cf.from_employee_id = $2
    `;
    const params = [tenantId, employeeId];
    let paramIndex = 3;
    if (feedback_type) {
        query += ` AND cf.feedback_type = $${paramIndex}`;
        params.push(feedback_type);
        paramIndex++;
    }
    query += ` ORDER BY cf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    // Get summary
    const summary = await req.dbClient.query(`
      SELECT tenant_id, employee_id, employee_name, total_given, praise_given,
        suggestion_given, concern_given, unique_recipients, last_feedback_given
      FROM v_feedback_given_summary WHERE tenant_id = $1 AND employee_id = $2
    `, [tenantId, employeeId]);
    res.json({
        success: true,
        data: result.rows,
        summary: summary.rows[0] || null,
        meta: {
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /feedback/categories
 * Get feedback categories for the tenant
 */
router.get('/categories', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT id, tenant_id, name, description, icon, color, display_order, is_active, created_at
      FROM feedback_categories
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY display_order
    `, [tenantId]);
    res.json({ success: true, data: result.rows });
}));
/**
 * GET /feedback/for-review/:employeeId
 * Get continuous feedback for performance review aggregation
 */
router.get('/for-review/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { start_date, end_date } = req.query;
    const result = await req.dbClient.query(`
      SELECT * FROM fn_get_feedback_for_review($1, $2, $3, $4)
    `, [tenantId, employeeId, start_date || null, end_date || null]);
    // Summary by type
    const summary = {
        total: result.rows.length,
        praise: result.rows.filter((r) => r.feedback_type === 'praise').length,
        suggestion: result.rows.filter((r) => r.feedback_type === 'suggestion').length,
        concern: result.rows.filter((r) => r.feedback_type === 'concern').length,
        avg_sentiment: result.rows.length > 0
            ? (result.rows.reduce((sum, r) => sum + (parseFloat(r.sentiment_score) || 0), 0) /
                result.rows.length).toFixed(2)
            : null,
    };
    res.json({
        success: true,
        data: result.rows,
        summary,
    });
}));
/**
 * POST /feedback/continuous/acknowledge/:id
 * Acknowledge receipt of feedback
 */
router.post('/continuous/acknowledge/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      UPDATE continuous_feedback SET
        acknowledged = true,
        acknowledged_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Feedback');
    }
    res.json({ success: true, data: result.rows[0] || null, message: 'Feedback acknowledged' });
}));
/**
 * Enhanced POST /feedback/continuous (update existing to support new fields)
 */
router.post('/continuous/quick', validate(createQuickFeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { from_employee_id, to_employee_id, feedback_type = 'praise', message, visibility = 'private', category, competency_id, related_goal_id, tags, } = req.body;
    if (!from_employee_id || !to_employee_id || !message) {
        throw Errors.badRequest('from_employee_id, to_employee_id, and message are required');
    }
    // Validate feedback_type
    if (!['praise', 'suggestion', 'concern'].includes(feedback_type)) {
        res
            .status(400)
            .json({ success: false, error: 'feedback_type must be praise, suggestion, or concern' });
        return;
    }
    // Map visibility to is_private for backward compatibility
    const is_private = visibility === 'private';
    const result = await req.dbClient.query(`
      INSERT INTO continuous_feedback (
        tenant_id, from_employee_id, to_employee_id, feedback_type, message,
        is_private, visibility, category, competency_id, related_goal_id, tags, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `, [
        tenantId,
        from_employee_id,
        to_employee_id,
        feedback_type,
        message,
        is_private,
        visibility,
        category,
        competency_id,
        related_goal_id,
        tags,
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        message: visibility === 'public' ? 'Public praise posted to wall!' : 'Feedback sent',
    });
}));
// END CONTINUOUS FEEDBACK ENHANCED
// ==================== 360 FEEDBACK ====================
// STATIC ROUTES FIRST (before /:id) - S-PERF-01-04
/**
 * GET /feedback/360/response-rates
 * Get response rates for 360 feedback by cycle
 */
router.get('/360/response-rates', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { review_cycle_id } = req.query;
    let query = `
      SELECT review_cycle_id, tenant_id, cycle_name, total_requests,
        completed_requests, response_rate, total_employees,
        pending_reviewers, avg_rating
      FROM v_360_response_rates
      WHERE tenant_id = $1
    `;
    const params = [tenantId];
    if (review_cycle_id) {
        query += ` AND review_cycle_id = $2`;
        params.push(review_cycle_id);
    }
    query += ` ORDER BY cycle_name`;
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /feedback/360/suggested-peers/:employeeId
 * Get suggested peers for 360 feedback
 */
router.get('/360/suggested-peers/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { review_cycle_id, limit = '10' } = req.query;
    const result = await req.dbClient.query(`
      SELECT * FROM fn_identify_360_peers($1, $2, $3, $4)
    `, [
        tenantId,
        employeeId,
        review_cycle_id || null,
        safeParseInt(limit, { fallback: 50 }),
    ]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /feedback/360/requests/:reviewId
 * Get feedback requests for a performance review
 */
router.get('/360/requests/:reviewId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['reviewId'];
    const result = await req.dbClient.query(`
      SELECT fr.id, fr.tenant_id, fr.requestee_id, fr.reviewer_id,
        fr.feedback_type, fr.status, fr.due_date, fr.completed_at, fr.is_anonymous,
        fr.created_at, fr.review_cycle_id, fr.performance_review_id,
        fr.questionnaire_id, fr.relationship_type, fr.feedback_360_id,
        e.first_name || ' ' || e.last_name as requestee_name,
        r.first_name || ' ' || r.last_name as reviewer_name,
        f.id as feedback_id,
        f.overall_rating,
        f.completed_at as feedback_completed_at
      FROM feedback_requests fr
      LEFT JOIN employees e ON fr.requestee_id = e.id
      LEFT JOIN employees r ON fr.reviewer_id = r.id
      LEFT JOIN feedback_360 f ON fr.feedback_360_id = f.id
      WHERE fr.performance_review_id = $1 AND fr.tenant_id = $2
      ORDER BY fr.created_at DESC
    `, [reviewId, tenantId]);
    const stats = {
        total: result.rows.length,
        completed: result.rows.filter((r) => r.status === 'completed').length,
        pending: result.rows.filter((r) => r.status === 'pending').length,
        response_rate: result.rows.length > 0
            ? Math.round((result.rows.filter((r) => r.status === 'completed').length / result.rows.length) *
                100)
            : 0,
    };
    res.json({
        success: true,
        data: result.rows,
        meta: stats,
    });
}));
/**
 * GET /feedback/360/summary/:employeeId
 * Get aggregated 360 feedback summary for an employee
 */
router.get('/360/summary/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = req.params['employeeId'];
    const { review_cycle_id } = req.query;
    let query = `
      SELECT tenant_id, target_employee_id, employee_name, review_cycle_id,
        cycle_name, relationship_type, response_count, avg_rating,
        rating_stddev, avg_sentiment, rating_distribution
      FROM v_360_feedback_summary
      WHERE tenant_id = $1 AND target_employee_id = $2
    `;
    const params = [tenantId, employeeId];
    if (review_cycle_id) {
        query += ` AND review_cycle_id = $3`;
        params.push(review_cycle_id);
    }
    query += ` ORDER BY relationship_type`;
    const result = await req.dbClient.query(query, params);
    // Get detailed themes if enough responses
    const themes = await req.dbClient.query(`
      SELECT
        'strength' as theme_type,
        UNNEST(STRING_TO_ARRAY(strengths, '. ')) as theme
      FROM feedback_360
      WHERE tenant_id = $1 AND target_employee_id = $2 AND status = 'completed' AND strengths IS NOT NULL
      UNION ALL
      SELECT
        'improvement' as theme_type,
        UNNEST(STRING_TO_ARRAY(areas_for_improvement, '. ')) as theme
      FROM feedback_360
      WHERE tenant_id = $1 AND target_employee_id = $2 AND status = 'completed' AND areas_for_improvement IS NOT NULL
    `, [tenantId, employeeId]);
    res.json({
        success: true,
        data: {
            by_relationship: result.rows,
            themes: themes.rows,
        },
    });
}));
/**
 * POST /feedback/360/complete/:requestId
 * Complete a 360 feedback request with responses
 */
router.post('/360/complete/:requestId', validate(completeFeedback360Schema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const requestId = req.params['requestId'];
    const { overall_rating, strengths, areas_for_improvement, question_responses } = req.body;
    // Get the feedback request
    const request = await req.dbClient.query(`
      SELECT id, tenant_id, requestee_id, reviewer_id, feedback_type, status,
        due_date, completed_at, is_anonymous, created_at, review_cycle_id,
        performance_review_id, questionnaire_id, relationship_type,
        reminder_sent_at, feedback_360_id
      FROM feedback_requests WHERE id = $1 AND tenant_id = $2
    `, [requestId, tenantId]);
    if (request.rows.length === 0) {
        throw Errors.notFound('Feedback request');
    }
    const { requestee_id, reviewer_id, review_cycle_id, performance_review_id, questionnaire_id, relationship_type, is_anonymous, } = request.rows[0];
    // Create the 360 feedback
    const feedback = await req.dbClient.query(`
      INSERT INTO feedback_360 (tenant_id, target_employee_id, reviewer_employee_id, review_cycle_id, performance_review_id,
        questionnaire_id, request_id, relationship_type, overall_rating, strengths, areas_for_improvement,
        question_responses, is_anonymous, status, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'completed', NOW())
      RETURNING *
    `, [
        tenantId,
        requestee_id,
        reviewer_id,
        review_cycle_id,
        performance_review_id,
        questionnaire_id,
        requestId,
        relationship_type,
        overall_rating,
        strengths,
        areas_for_improvement,
        JSON.stringify(question_responses),
        is_anonymous,
    ]);
    // Update the request
    await req.dbClient.query(`
      UPDATE feedback_requests
      SET status = 'completed', completed_at = NOW(), feedback_360_id = $1
      WHERE id = $2
    `, [feedback.rows[0]?.id, requestId]);
    res.json({
        success: true,
        data: feedback.rows[0] || null,
        message: '360 Feedback submitted successfully',
    });
}));
// END STATIC ROUTES
/**
 * GET /feedback/360
 */
router.get('/360', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { target_employee_id, reviewer_employee_id, review_cycle_id, status, limit = '100', offset = '0', } = req.query;
    let query = `
      SELECT f.id, f.tenant_id, f.target_employee_id, f.reviewer_employee_id,
        f.review_cycle_id, f.relationship_type, f.overall_rating,
        f.strengths, f.areas_for_improvement, f.is_anonymous, f.status,
        f.created_at, f.completed_at, f.performance_review_id,
        t.first_name || ' ' || t.last_name as target_name,
        r.first_name || ' ' || r.last_name as reviewer_name,
        rc.name as cycle_name
      FROM feedback_360 f
      LEFT JOIN employees t ON f.target_employee_id = t.id
      LEFT JOIN employees r ON f.reviewer_employee_id = r.id
      LEFT JOIN review_cycles rc ON f.review_cycle_id = rc.id
      WHERE f.tenant_id = $1
    `;
    const params = [tenantId];
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
    if (review_cycle_id) {
        query += ` AND f.review_cycle_id = $${paramIndex}`;
        params.push(review_cycle_id);
        paramIndex++;
    }
    if (status) {
        query += ` AND f.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeParseInt(limit, { fallback: 100 }), safeParseInt(offset, { fallback: 0 }));
    const result = await req.dbClient.query(query, params);
    const countResult = await req.dbClient.query('SELECT COUNT(*) FROM feedback_360 WHERE tenant_id = $1', [tenantId]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            total: parseInt(countResult.rows[0]?.count),
            limit: safeParseInt(limit, { fallback: 50 }),
            offset: safeParseInt(offset, { fallback: 0 }),
        },
    });
}));
/**
 * GET /feedback/360/:id
 */
router.get('/360/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT f.id, f.tenant_id, f.target_employee_id, f.reviewer_employee_id,
        f.review_cycle_id, f.relationship_type, f.overall_rating,
        f.strengths, f.areas_for_improvement, f.is_anonymous, f.status,
        f.created_at, f.completed_at, f.performance_review_id,
        f.questionnaire_id, f.request_id, f.question_responses,
        f.sentiment_score, f.submission_time_seconds,
        t.first_name || ' ' || t.last_name as target_name,
        t.email as target_email,
        r.first_name || ' ' || r.last_name as reviewer_name,
        rc.name as cycle_name
      FROM feedback_360 f
      LEFT JOIN employees t ON f.target_employee_id = t.id
      LEFT JOIN employees r ON f.reviewer_employee_id = r.id
      LEFT JOIN review_cycles rc ON f.review_cycle_id = rc.id
      WHERE f.id = $1 AND f.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('360 Feedback');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /feedback/360
 */
router.post('/360', validate(createFeedback360Schema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { target_employee_id, reviewer_employee_id, review_cycle_id, relationship_type, overall_rating, strengths, areas_for_improvement, is_anonymous = false, status = 'pending', } = req.body;
    if (!target_employee_id || !reviewer_employee_id) {
        throw Errors.badRequest('target_employee_id and reviewer_employee_id are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO feedback_360 (tenant_id, target_employee_id, reviewer_employee_id, review_cycle_id, relationship_type,
        overall_rating, strengths, areas_for_improvement, is_anonymous, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [
        tenantId,
        target_employee_id,
        reviewer_employee_id,
        review_cycle_id,
        relationship_type,
        overall_rating,
        strengths,
        areas_for_improvement,
        is_anonymous,
        status,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: '360 Feedback created' });
}));
/**
 * PATCH /feedback/360/:id
 */
router.patch('/360/:id', validate(updateFeedback360Schema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM feedback_360 WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('360 Feedback');
    }
    const allowedFields = [
        'relationship_type',
        'overall_rating',
        'strengths',
        'areas_for_improvement',
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
    // Auto-set completed_at when status changes to completed
    if (req.body.status === 'completed') {
        updates.push(`completed_at = NOW()`);
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    const result = await req.dbClient.query(`UPDATE feedback_360 SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: '360 Feedback updated' });
}));
/**
 * DELETE /feedback/360/:id
 */
router.delete('/360/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('DELETE FROM feedback_360 WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('360 Feedback');
    }
    res.json({ success: true, message: '360 Feedback deleted' });
}));
// ==================== 360 FEEDBACK ENHANCED - S-PERF-01-04 ====================
/**
 * GET /feedback/360/questionnaires
 * List available 360 feedback questionnaires
 */
router.get('/360-questionnaires', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { active_only = 'true' } = req.query;
    let query = `
      SELECT q.id, q.tenant_id, q.name, q.description, q.is_default,
        q.relationship_types, q.is_active, q.created_by, q.created_at, q.updated_at,
        (SELECT COUNT(*) FROM feedback_360_questions fq WHERE fq.questionnaire_id = q.id) as question_count,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM feedback_360_questionnaires q
      LEFT JOIN employees e ON q.created_by = e.id
      WHERE q.tenant_id = $1
    `;
    const params = [tenantId];
    if (active_only === 'true') {
        query += ` AND q.is_active = true`;
    }
    query += ` ORDER BY q.is_default DESC, q.name`;
    const result = await req.dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /feedback/360/questionnaires/:id
 * Get questionnaire with questions
 */
router.get('/360-questionnaires/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    // Get questionnaire
    const questionnaire = await req.dbClient.query(`
      SELECT q.*,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM feedback_360_questionnaires q
      LEFT JOIN employees e ON q.created_by = e.id
      WHERE q.id = $1 AND q.tenant_id = $2
    `, [id, tenantId]);
    if (questionnaire.rows.length === 0) {
        throw Errors.notFound('Questionnaire');
    }
    // Get questions
    const questions = await req.dbClient.query(`
      SELECT id, tenant_id, questionnaire_id, question_text, question_type, category,
        ksaba_dimension, competency_id, options, rating_scale_min, rating_scale_max,
        is_required, display_order, relationship_types, created_at
      FROM feedback_360_questions
      WHERE questionnaire_id = $1 AND tenant_id = $2
      ORDER BY display_order
    `, [id, tenantId]);
    res.json({
        success: true,
        data: {
            ...(questionnaire.rows[0] || {}),
            questions: questions.rows,
        },
    });
}));
/**
 * POST /feedback/360/questionnaires
 * Create a new questionnaire
 */
router.post('/360-questionnaires', validate(createQuestionnaireSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, is_default = false, relationship_types, created_by, questions, } = req.body;
    if (!name) {
        throw Errors.badRequest('name is required');
    }
    // If setting as default, unset existing default
    if (is_default) {
        await req.dbClient.query(`
        UPDATE feedback_360_questionnaires SET is_default = false WHERE tenant_id = $1
      `, [tenantId]);
    }
    const result = await req.dbClient.query(`
      INSERT INTO feedback_360_questionnaires (tenant_id, name, description, is_default, relationship_types, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
        tenantId,
        name,
        description,
        is_default,
        relationship_types || ['manager', 'peer', 'direct_report', 'self'],
        created_by,
    ]);
    const questionnaireId = result.rows[0]?.id;
    // Insert questions if provided
    if (questions && Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await req.dbClient.query(`
          INSERT INTO feedback_360_questions (tenant_id, questionnaire_id, question_text, question_type, category, display_order, relationship_types, is_required)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                tenantId,
                questionnaireId,
                q.question_text,
                q.question_type || 'rating',
                q.category,
                i + 1,
                q.relationship_types,
                q.is_required ?? true,
            ]);
        }
    }
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        message: 'Questionnaire created',
    });
}));
/**
 * POST /feedback/360/:reviewId/request
 * Request feedback for a performance review
 */
router.post('/360/:reviewId/request', validate(requestFeedback360Schema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const reviewId = req.params['reviewId'];
    const { reviewer_ids, relationship_type = 'peer', questionnaire_id, due_date, is_anonymous = true, } = req.body;
    if (!reviewer_ids || !Array.isArray(reviewer_ids) || reviewer_ids.length === 0) {
        throw Errors.badRequest('reviewer_ids array is required');
    }
    // Get the performance review and employee
    const review = await req.dbClient.query(`
      SELECT pr.id, pr.employee_id, pr.review_cycle_id
      FROM performance_reviews pr
      WHERE pr.id = $1 AND pr.tenant_id = $2
    `, [reviewId, tenantId]);
    if (review.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const { employee_id, review_cycle_id } = review.rows[0];
    // Create feedback requests
    const requests = [];
    for (const reviewerId of reviewer_ids) {
        const result = await req.dbClient.query(`
        INSERT INTO feedback_requests (tenant_id, requestee_id, reviewer_id, review_cycle_id, performance_review_id,
          questionnaire_id, relationship_type, due_date, is_anonymous, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [
            tenantId,
            employee_id,
            reviewerId,
            review_cycle_id,
            reviewId,
            questionnaire_id,
            relationship_type,
            due_date,
            is_anonymous,
        ]);
        if (result.rows.length > 0) {
            requests.push(result.rows[0]);
        }
    }
    res.status(201).json({
        success: true,
        data: requests,
        message: `${requests.length} feedback request(s) created`,
    });
}));
export default router;
//# sourceMappingURL=feedback.js.map