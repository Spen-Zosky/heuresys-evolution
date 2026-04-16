/**
 * Employee Engagement Hub Routes
 * Surveys, Pulse Checks, Feedback, and Analytics
 *
 * @module routes/engagement
 * @author Claude Code (Autonomous)
 * @date 2025-12-27
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import crypto from 'crypto';
import { validate } from '../middleware/validate.js';
import { createEngagementTemplateSchema, updateEngagementTemplateSchema, createSurveySchema, updateSurveySchema, submitSurveyResponseSchema, submitFeedbackSchema, reviewFeedbackSchema, createPulseConfigSchema, } from '../schemas/platform.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
// ============================================================================
// DASHBOARD STATS
// ============================================================================
/**
 * GET /engagement/stats
 * Dashboard statistics overview
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const [surveysResult, feedbackResult, analyticsResult] = await Promise.all([
        req.dbClient.query(`
        SELECT
          COUNT(*) as total_surveys,
          COUNT(*) FILTER (WHERE status = 'active') as active_surveys,
          COUNT(*) FILTER (WHERE status = 'draft') as draft_surveys,
          SUM(total_invitations) as total_invitations,
          SUM(total_responses) as total_responses
        FROM engagement_surveys
        WHERE tenant_id = $1
      `, [tenantId]),
        req.dbClient.query(`
        SELECT
          COUNT(*) as total_feedback,
          COUNT(*) FILTER (WHERE status = 'new') as new_feedback
        FROM engagement_feedback
        WHERE tenant_id = $1
      `, [tenantId]),
        req.dbClient.query(`
        SELECT
          response_rate,
          enps_score
        FROM v_engagement_analytics
        WHERE tenant_id = $1
        ORDER BY period DESC
        LIMIT 1
      `, [tenantId]),
    ]);
    const surveys = surveysResult.rows[0];
    const feedback = feedbackResult.rows[0];
    const analytics = analyticsResult.rows[0] || { response_rate: 0, enps_score: null };
    return res.json({
        success: true,
        data: {
            surveys: {
                total: safeParseInt(surveys.total_surveys, { fallback: 0 }),
                active: safeParseInt(surveys.active_surveys, { fallback: 0 }),
                draft: safeParseInt(surveys.draft_surveys, { fallback: 0 }),
            },
            responses: {
                total_invitations: safeParseInt(surveys.total_invitations, { fallback: 0 }),
                total_responses: safeParseInt(surveys.total_responses, { fallback: 0 }),
                response_rate: parseFloat(analytics.response_rate) || 0,
            },
            feedback: {
                total: safeParseInt(feedback.total_feedback, { fallback: 0 }),
                new: safeParseInt(feedback.new_feedback, { fallback: 0 }),
            },
            enps: analytics.enps_score,
        },
    });
}));
// ============================================================================
// SURVEY TEMPLATES
// ============================================================================
/**
 * GET /engagement/templates
 * List all survey templates
 */
router.get('/templates', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, active_only } = req.query;
    let query = `
      SELECT
        id, name, description, category, is_system, is_active,
        jsonb_array_length(questions) as questions_count,
        created_at, updated_at
      FROM engagement_survey_templates
      WHERE tenant_id = $1
    `;
    const params = [tenantId];
    if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
    }
    if (active_only === 'true') {
        query += ` AND is_active = true`;
    }
    query += ` ORDER BY is_system DESC, name ASC`;
    const result = await req.dbClient.query(query, params);
    return res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * GET /engagement/templates/:id
 * Get template with questions
 */
router.get('/templates/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query(`
      SELECT id, tenant_id, name, description, category, questions,
             is_system, is_active, created_by, created_at, updated_at
      FROM engagement_survey_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Template');
    }
    return res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * POST /engagement/templates
 * Create new template
 */
router.post('/templates', validate(createEngagementTemplateSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { name, description, category, questions } = req.body;
    const userId = req.user?.userId;
    if (!name || !questions || !Array.isArray(questions)) {
        throw Errors.badRequest('Name and questions are required');
    }
    // Add IDs to questions if not present
    const processedQuestions = questions.map((q, idx) => ({
        ...q,
        id: q.id || `q${idx + 1}`,
    }));
    const result = await req.dbClient.query(`
      INSERT INTO engagement_survey_templates
        (tenant_id, name, description, category, questions, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
        tenantId,
        name,
        description,
        category || 'custom',
        JSON.stringify(processedQuestions),
        userId,
    ]);
    return res.status(201).json({
        success: true,
        data: { id: result.rows[0]?.id },
    });
}));
/**
 * PUT /engagement/templates/:id
 * Update template
 */
router.put('/templates/:id', validate(updateEngagementTemplateSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { name, description, category, questions, is_active } = req.body;
    // Check if template exists and is not system template
    const existing = await req.dbClient.query(`
      SELECT is_system FROM engagement_survey_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Template');
    }
    if (existing.rows[0].is_system) {
        throw Errors.forbidden('system templates', 'modify');
    }
    const result = await req.dbClient.query(`
      UPDATE engagement_survey_templates
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        category = COALESCE($5, category),
        questions = COALESCE($6, questions),
        is_active = COALESCE($7, is_active),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [
        id,
        tenantId,
        name,
        description,
        category,
        questions ? JSON.stringify(questions) : null,
        is_active,
    ]);
    return res.json({
        success: true,
        data: { id: result.rows[0]?.id },
    });
}));
/**
 * DELETE /engagement/templates/:id
 * Delete template (soft delete via is_active)
 */
router.delete('/templates/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    // Check if template is in use
    const inUse = await req.dbClient.query(`
      SELECT COUNT(*) as count FROM engagement_surveys
      WHERE template_id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (parseInt(inUse.rows[0].count) > 0) {
        // Soft delete
        await req.dbClient.query(`
        UPDATE engagement_survey_templates
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND is_system = false
      `, [id, tenantId]);
    }
    else {
        // Hard delete
        await req.dbClient.query(`
        DELETE FROM engagement_survey_templates
        WHERE id = $1 AND tenant_id = $2 AND is_system = false
      `, [id, tenantId]);
    }
    res.json({ success: true });
}));
// ============================================================================
// SURVEYS
// ============================================================================
/**
 * GET /engagement/surveys
 * List surveys with pagination
 */
router.get('/surveys', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, limit = 20, offset = 0 } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 20 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    let query = `
      SELECT
        s.id, s.title, s.description, s.is_anonymous, s.status,
        s.audience_type, s.start_date, s.end_date,
        s.total_invitations, s.total_responses,
        t.name as template_name,
        u.username as created_by_name,
        s.created_at,
        CASE WHEN s.total_invitations > 0
          THEN ROUND((s.total_responses::NUMERIC / s.total_invitations::NUMERIC) * 100, 1)
          ELSE 0
        END as response_rate
      FROM engagement_surveys s
      LEFT JOIN engagement_survey_templates t ON s.template_id = t.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.tenant_id = $1
    `;
    const params = [tenantId];
    if (status) {
        params.push(status);
        query += ` AND s.status = $${params.length}`;
    }
    query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offsetNum);
    const result = await req.dbClient.query(query, params);
    // Get total count
    const countResult = await req.dbClient.query(`
      SELECT COUNT(*) as total FROM engagement_surveys
      WHERE tenant_id = $1 ${status ? 'AND status = $2' : ''}
    `, status ? [tenantId, status] : [tenantId]);
    return res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), safeParseInt(limit, { fallback: 50 }), safeParseInt(offset, { fallback: 0 })),
    });
}));
/**
 * GET /engagement/surveys/:id
 * Get survey details
 */
router.get('/surveys/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const result = await req.dbClient.query(`
      SELECT
        s.id, s.tenant_id, s.template_id, s.title, s.description, s.questions,
        s.is_anonymous, s.status, s.audience_type, s.audience_ids,
        s.start_date, s.end_date, s.reminder_days, s.total_invitations,
        s.total_responses, s.created_by, s.created_at, s.updated_at,
        t.name as template_name,
        u.username as created_by_name
      FROM engagement_surveys s
      LEFT JOIN engagement_survey_templates t ON s.template_id = t.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1 AND s.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Survey');
    }
    return res.json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * POST /engagement/surveys
 * Create new survey
 */
router.post('/surveys', validate(createSurveySchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = req.user?.userId;
    const { template_id, title, description, questions, is_anonymous = true, audience_type = 'all', audience_ids = [], start_date, end_date, reminder_days = [3, 7], } = req.body;
    if (!title) {
        throw Errors.badRequest('Title is required');
    }
    // If template_id provided, get questions from template
    let surveyQuestions = questions;
    if (template_id && !questions) {
        const templateResult = await req.dbClient.query(`
        SELECT questions FROM engagement_survey_templates
        WHERE id = $1 AND tenant_id = $2
      `, [template_id, tenantId]);
        if (templateResult.rows.length === 0) {
            throw Errors.notFound('Template');
        }
        surveyQuestions = templateResult.rows[0]?.questions;
    }
    if (!surveyQuestions || surveyQuestions.length === 0) {
        throw Errors.badRequest('Questions are required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO engagement_surveys
        (tenant_id, template_id, title, description, questions, is_anonymous,
         audience_type, audience_ids, start_date, end_date, reminder_days, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
        tenantId,
        template_id,
        title,
        description,
        JSON.stringify(surveyQuestions),
        is_anonymous,
        audience_type,
        audience_ids,
        start_date || new Date(),
        end_date,
        reminder_days,
        userId,
    ]);
    return res.status(201).json({
        success: true,
        data: { id: result.rows[0]?.id },
    });
}));
/**
 * PUT /engagement/surveys/:id
 * Update survey (only if draft)
 */
router.put('/surveys/:id', validate(updateSurveySchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { title, description, questions, is_anonymous, audience_type, audience_ids, start_date, end_date, } = req.body;
    // Check if survey is draft
    const existing = await req.dbClient.query(`
      SELECT status FROM engagement_surveys
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Survey');
    }
    if (existing.rows[0].status !== 'draft') {
        throw Errors.forbidden('non-draft surveys', 'edit');
    }
    await req.dbClient.query(`
      UPDATE engagement_surveys
      SET
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        questions = COALESCE($5, questions),
        is_anonymous = COALESCE($6, is_anonymous),
        audience_type = COALESCE($7, audience_type),
        audience_ids = COALESCE($8, audience_ids),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [
        id,
        tenantId,
        title,
        description,
        questions ? JSON.stringify(questions) : null,
        is_anonymous,
        audience_type,
        audience_ids,
        start_date,
        end_date,
    ]);
    return res.json({ success: true });
}));
/**
 * POST /engagement/surveys/:id/launch
 * Launch survey (change status to active)
 */
router.post('/surveys/:id/launch', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    // Get survey and calculate invitations
    const survey = await req.dbClient.query(`
      SELECT audience_type, audience_ids FROM engagement_surveys
      WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
    `, [id, tenantId]);
    if (survey.rows.length === 0) {
        throw Errors.notFound('Draft survey');
    }
    // Count target employees
    let countQuery = `SELECT COUNT(*) as count FROM employees WHERE tenant_id = $1 AND status = 'active'`;
    const countParams = [tenantId];
    const { audience_type, audience_ids } = survey.rows[0];
    if (audience_type === 'department' && audience_ids?.length > 0) {
        countQuery += ` AND org_unit_id = ANY($2)`;
        countParams.push(audience_ids);
    }
    else if (audience_type === 'org_unit' && audience_ids?.length > 0) {
        countQuery += ` AND org_unit_id = ANY($2)`;
        countParams.push(audience_ids);
    }
    else if (audience_type === 'custom' && audience_ids?.length > 0) {
        countQuery += ` AND id = ANY($2)`;
        countParams.push(audience_ids);
    }
    const countResult = await req.dbClient.query(countQuery, countParams);
    const totalInvitations = parseInt(countResult.rows[0]?.count);
    // Update survey status
    await req.dbClient.query(`
      UPDATE engagement_surveys
      SET status = 'active', total_invitations = $3, start_date = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId, totalInvitations]);
    return res.json({
        success: true,
        data: { invitations_sent: totalInvitations },
    });
}));
/**
 * POST /engagement/surveys/:id/close
 * Close survey
 */
router.post('/surveys/:id/close', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    await req.dbClient.query(`
      UPDATE engagement_surveys
      SET status = 'closed', end_date = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status = 'active'
    `, [id, tenantId]);
    res.json({ success: true });
}));
/**
 * GET /engagement/surveys/:id/results
 * Get survey results (aggregated)
 */
router.get('/surveys/:id/results', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    // Get survey with questions
    const surveyResult = await req.dbClient.query(`
      SELECT questions, total_invitations, total_responses, is_anonymous
      FROM engagement_surveys
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (surveyResult.rows.length === 0) {
        throw Errors.notFound('Survey');
    }
    const survey = surveyResult.rows[0];
    const questions = survey.questions;
    // Get all responses
    const responsesResult = await req.dbClient.query(`
      SELECT answers FROM engagement_survey_responses
      WHERE survey_id = $1 AND tenant_id = $2 AND is_complete = true
    `, [id, tenantId]);
    // Aggregate results per question
    const questionResults = questions.map((q) => {
        const answers = responsesResult.rows
            .map((r) => r.answers.find((a) => a.question_id === q.id))
            .filter((a) => a !== undefined);
        const result = {
            question_id: q.id,
            question_text: q.text,
            question_type: q.type,
            response_count: answers.length,
        };
        if (q.type === 'scale_5' || q.type === 'scale_10' || q.type === 'nps') {
            const numericAnswers = answers
                .map((a) => parseInt(a.value))
                .filter((v) => !isNaN(v));
            if (numericAnswers.length > 0) {
                result.average = (numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length).toFixed(2);
                result.distribution = {};
                numericAnswers.forEach((v) => {
                    result.distribution[v] = (result.distribution[v] || 0) + 1;
                });
            }
            if (q.type === 'nps') {
                const promoters = numericAnswers.filter((v) => v >= 9).length;
                const detractors = numericAnswers.filter((v) => v <= 6).length;
                result.nps_score = Math.round(((promoters - detractors) / numericAnswers.length) * 100);
                result.promoters = promoters;
                result.passives = numericAnswers.length - promoters - detractors;
                result.detractors = detractors;
            }
        }
        else if (q.type === 'multiple_choice') {
            result.distribution = {};
            answers.forEach((a) => {
                result.distribution[a.value] = (result.distribution[a.value] || 0) + 1;
            });
        }
        else if (q.type === 'text') {
            // For privacy, only return count for text responses
            result.text_responses = answers.length;
            // Could add text responses if not anonymous, but skipped for privacy
        }
        return result;
    });
    return res.json({
        success: true,
        data: {
            total_invitations: survey.total_invitations,
            total_responses: survey.total_responses,
            response_rate: survey.total_invitations > 0
                ? ((survey.total_responses / survey.total_invitations) * 100).toFixed(1)
                : 0,
            questions: questionResults,
        },
    });
}));
// ============================================================================
// EMPLOYEE SURVEY PARTICIPATION
// ============================================================================
/**
 * GET /engagement/my-surveys
 * Get surveys available for current employee
 */
router.get('/my-surveys', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = req.user?.userId;
    // Get employee ID from user
    const userResult = await req.dbClient.query(`
      SELECT e.id as employee_id, e.org_unit_id, e.org_unit_id
      FROM users u
      JOIN employees e ON u.employee_id = e.id
      WHERE u.id = $1 AND u.tenant_id = $2
    `, [userId, tenantId]);
    if (userResult.rows.length === 0) {
        return res.json({ success: true, data: { pending: [], completed: [] } });
    }
    const employee = userResult.rows[0];
    // Get active surveys for this employee
    const surveysResult = await req.dbClient.query(`
      SELECT
        s.id, s.title, s.description, s.is_anonymous, s.end_date,
        jsonb_array_length(s.questions) as questions_count,
        r.id as response_id, r.is_complete, r.started_at
      FROM engagement_surveys s
      LEFT JOIN engagement_survey_responses r
        ON r.survey_id = s.id AND (r.employee_id = $2 OR r.anonymous_token IS NOT NULL)
      WHERE s.tenant_id = $1
        AND s.status = 'active'
        AND (s.end_date IS NULL OR s.end_date > NOW())
        AND (
          s.audience_type = 'all'
          OR (s.audience_type = 'department' AND $3 = ANY(s.audience_ids))
          OR (s.audience_type = 'org_unit' AND $4 = ANY(s.audience_ids))
          OR (s.audience_type = 'custom' AND $2 = ANY(s.audience_ids))
        )
      ORDER BY s.created_at DESC
    `, [tenantId, employee.employee_id, employee.org_unit_id, employee.org_unit_id]);
    const pending = surveysResult.rows.filter((s) => !s.is_complete);
    const completed = surveysResult.rows.filter((s) => s.is_complete);
    return res.json({
        success: true,
        data: { pending, completed },
    });
}));
/**
 * POST /engagement/surveys/:id/respond
 * Submit survey response
 */
router.post('/surveys/:id/respond', validate(submitSurveyResponseSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { answers } = req.body;
    const userId = req.user?.userId;
    if (!answers || !Array.isArray(answers)) {
        throw Errors.badRequest('Answers are required');
    }
    // Get survey
    const surveyResult = await req.dbClient.query(`
      SELECT is_anonymous FROM engagement_surveys
      WHERE id = $1 AND tenant_id = $2 AND status = 'active'
    `, [id, tenantId]);
    if (surveyResult.rows.length === 0) {
        throw Errors.notFound('Active survey');
    }
    const isAnonymous = surveyResult.rows[0]?.is_anonymous;
    // Get employee ID
    const userResult = await req.dbClient.query(`
      SELECT e.id as employee_id FROM users u
      JOIN employees e ON u.employee_id = e.id
      WHERE u.id = $1 AND u.tenant_id = $2
    `, [userId, tenantId]);
    const employeeId = userResult.rows[0]?.employee_id;
    // Check for existing response
    const existingResult = await req.dbClient.query(`
      SELECT id FROM engagement_survey_responses
      WHERE survey_id = $1 AND employee_id = $2
    `, [id, employeeId]);
    if (existingResult.rows.length > 0) {
        throw Errors.conflict('Already responded to this survey');
    }
    // Create response
    const anonymousToken = isAnonymous ? crypto.randomBytes(32).toString('hex') : null;
    const result = await req.dbClient.query(`
      INSERT INTO engagement_survey_responses
        (tenant_id, survey_id, employee_id, anonymous_token, answers, is_complete, completed_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW())
      RETURNING id
    `, [tenantId, id, isAnonymous ? null : employeeId, anonymousToken, JSON.stringify(answers)]);
    return res.status(201).json({
        success: true,
        data: { response_id: result.rows[0]?.id },
    });
}));
// ============================================================================
// ANONYMOUS FEEDBACK
// ============================================================================
/**
 * GET /engagement/feedback
 * List feedback (admin only)
 */
router.get('/feedback', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, category, limit = 50, offset = 0 } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 50 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    let query = `
      SELECT
        f.id, f.category, f.message, f.status,
        f.reviewed_by, f.reviewed_at, f.action_notes,
        u.username as reviewed_by_name,
        f.created_at
      FROM engagement_feedback f
      LEFT JOIN users u ON f.reviewed_by = u.id
      WHERE f.tenant_id = $1
    `;
    const params = [tenantId];
    if (status) {
        params.push(status);
        query += ` AND f.status = $${params.length}`;
    }
    if (category) {
        params.push(category);
        query += ` AND f.category = $${params.length}`;
    }
    query += ` ORDER BY f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offsetNum);
    const result = await req.dbClient.query(query, params);
    return res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * POST /engagement/feedback
 * Submit anonymous feedback
 */
router.post('/feedback', validate(submitFeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, message } = req.body;
    if (!message || message.trim().length === 0) {
        throw Errors.badRequest('Message is required');
    }
    await req.dbClient.query(`
      INSERT INTO engagement_feedback (tenant_id, category, message)
      VALUES ($1, $2, $3)
    `, [tenantId, category || 'other', message.trim()]);
    return res.status(201).json({
        success: true,
        data: { received: true },
    });
}));
/**
 * PUT /engagement/feedback/:id
 * Review feedback
 */
router.put('/feedback/:id', validate(reviewFeedbackSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { status, action_notes } = req.body;
    const userId = req.user?.userId;
    await req.dbClient.query(`
      UPDATE engagement_feedback
      SET
        status = COALESCE($3, status),
        action_notes = COALESCE($4, action_notes),
        reviewed_by = $5,
        reviewed_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId, status, action_notes, userId]);
    res.json({ success: true });
}));
// ============================================================================
// PULSE CHECKS
// ============================================================================
/**
 * GET /engagement/pulse
 * List pulse configurations
 */
router.get('/pulse', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        p.id, p.tenant_id, p.name, p.questions, p.frequency,
        p.audience_type, p.audience_ids, p.is_active, p.last_sent_at,
        p.next_send_date, p.created_by, p.created_at, p.updated_at,
        u.username as created_by_name
      FROM engagement_pulse_configs p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.tenant_id = $1
      ORDER BY p.created_at DESC
    `, [tenantId]);
    return res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * POST /engagement/pulse
 * Create pulse configuration
 */
router.post('/pulse', validate(createPulseConfigSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const userId = req.user?.userId;
    const { name, questions, frequency = 'biweekly', audience_type = 'all', audience_ids = [], } = req.body;
    if (!name || !questions || questions.length === 0) {
        throw Errors.badRequest('Name and questions are required');
    }
    if (questions.length > 5) {
        return res
            .status(400)
            .json({ success: false, error: 'Maximum 5 questions allowed for pulse checks' });
    }
    // Calculate next send date
    const nextSendDate = new Date();
    if (frequency === 'weekly') {
        nextSendDate.setDate(nextSendDate.getDate() + 7);
    }
    else if (frequency === 'biweekly') {
        nextSendDate.setDate(nextSendDate.getDate() + 14);
    }
    else {
        nextSendDate.setMonth(nextSendDate.getMonth() + 1);
    }
    const result = await req.dbClient.query(`
      INSERT INTO engagement_pulse_configs
        (tenant_id, name, questions, frequency, audience_type, audience_ids, next_send_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
        tenantId,
        name,
        JSON.stringify(questions),
        frequency,
        audience_type,
        audience_ids,
        nextSendDate,
        userId,
    ]);
    return res.status(201).json({
        success: true,
        data: { id: result.rows[0]?.id },
    });
}));
// ============================================================================
// ANALYTICS
// ============================================================================
/**
 * GET /engagement/analytics
 * Get engagement analytics
 */
router.get('/analytics', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { period = '6' } = req.query; // months
    const periodMonths = parseInt(period);
    const result = await req.dbClient.query(`
      SELECT tenant_id, period, total_surveys, total_invitations, total_responses,
             response_rate, enps_score, promoters, passives, detractors
      FROM v_engagement_analytics
      WHERE tenant_id = $1
        AND period >= NOW() - ($2 * INTERVAL '1 month')
      ORDER BY period DESC
    `, [tenantId, periodMonths]);
    // Get trend data
    const trendResult = await req.dbClient.query(`
      SELECT
        DATE_TRUNC('month', r.completed_at) as month,
        AVG((a->>'value')::NUMERIC) as avg_score
      FROM engagement_survey_responses r
      JOIN engagement_surveys s ON r.survey_id = s.id
      CROSS JOIN LATERAL jsonb_array_elements(r.answers) a
      WHERE s.tenant_id = $1
        AND r.is_complete = true
        AND r.completed_at >= NOW() - ($2 * INTERVAL '1 month')
        AND (a->>'value') ~ '^[0-9]+$'
      GROUP BY DATE_TRUNC('month', r.completed_at)
      ORDER BY month
    `, [tenantId, periodMonths]);
    // Get by department
    const deptResult = await req.dbClient.query(`
      SELECT
        d.name as department,
        COUNT(DISTINCT r.id) as responses,
        AVG((a->>'value')::NUMERIC) as avg_score
      FROM engagement_survey_responses r
      JOIN employees e ON r.employee_id = e.id
      JOIN org_units d ON e.org_unit_id = d.id
      JOIN engagement_surveys s ON r.survey_id = s.id
      CROSS JOIN LATERAL jsonb_array_elements(r.answers) a
      WHERE s.tenant_id = $1
        AND r.is_complete = true
        AND (a->>'value') ~ '^[0-9]+$'
      GROUP BY d.name
      ORDER BY avg_score DESC
      LIMIT 10
    `, [tenantId]);
    return res.json({
        success: true,
        data: {
            summary: result.rows[0] || {},
            trend: trendResult.rows,
            by_org_unit: deptResult.rows,
        },
    });
}));
/**
 * GET /engagement/analytics/enps
 * Get eNPS analytics
 */
router.get('/analytics/enps', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const result = await req.dbClient.query(`
      SELECT
        DATE_TRUNC('month', r.completed_at) as month,
        COUNT(*) FILTER (WHERE (a->>'value')::int >= 9) as promoters,
        COUNT(*) FILTER (WHERE (a->>'value')::int BETWEEN 7 AND 8) as passives,
        COUNT(*) FILTER (WHERE (a->>'value')::int <= 6) as detractors,
        COUNT(*) as total
      FROM engagement_survey_responses r
      JOIN engagement_surveys s ON r.survey_id = s.id
      CROSS JOIN LATERAL jsonb_array_elements(r.answers) a
      CROSS JOIN LATERAL jsonb_array_elements(s.questions) q
      WHERE s.tenant_id = $1
        AND r.is_complete = true
        AND (q->>'type') = 'nps'
        AND (q->>'id') = (a->>'question_id')
      GROUP BY DATE_TRUNC('month', r.completed_at)
      ORDER BY month DESC
      LIMIT 12
    `, [tenantId]);
    const data = result.rows.map((row) => ({
        month: row.month,
        promoters: parseInt(row.promoters),
        passives: parseInt(row.passives),
        detractors: parseInt(row.detractors),
        total: parseInt(row.total),
        enps: row.total > 0 ? Math.round(((row.promoters - row.detractors) / row.total) * 100) : 0,
    }));
    return res.json({
        success: true,
        data,
    });
}));
export default router;
//# sourceMappingURL=engagement.js.map