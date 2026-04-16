/**
 * AI Career Coach API Routes
 * Provides career development guidance, skill assessment, and goal tracking
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { updateCareerProfileSchema, createCareerSkillSchema, createCareerGoalSchema, updateCareerGoalSchema, createGoalMilestoneSchema, } from '../schemas/talent.js';
import { safeParseInt, firstRowOrThrow } from '../utils/query-helpers.js';
import { logger } from '../config/logger.js';
const router = Router();
// Helper to get user ID from request
const getUserId = (req) => {
    return req.user?.userId || null;
};
/**
 * GET /career-coach/profile
 * Get or create career profile for current user
 */
router.get('/profile', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    // Get employee ID for current user (users.employee_id -> employees.id)
    const employeeResult = await dbClient.query(`
      SELECT e.id, e.first_name, e.last_name, e.job_title, e.org_unit_id
      FROM employees e
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND e.tenant_id = $2
      LIMIT 1
    `, [userId, tenantId]);
    if (employeeResult.rows.length === 0) {
        // SUPERUSER / TENANT_OWNER may not have an employee record in the current tenant
        const userRole = req.user?.role;
        if (userRole === 'SUPERUSER' || userRole === 'TENANT_OWNER') {
            res.json({
                success: true,
                data: {
                    is_admin: true,
                    role: userRole,
                    chat_context: 'cross_tenant_admin',
                    message: 'Career Coach disponibile in modalita amministratore',
                },
            });
            return;
        }
        throw Errors.notFound('Employee profile');
    }
    const employee = firstRowOrThrow(employeeResult, 'Employee');
    // Get or create career profile
    let profileResult = await dbClient.query(`
      SELECT id, tenant_id, employee_id, current_job_family_id, career_aspiration,
             preferred_work_style, mobility_preference, last_assessment_date,
             created_at, updated_at
      FROM career_profiles
      WHERE employee_id = $1 AND tenant_id = $2
    `, [employee.id, tenantId]);
    if (profileResult.rows.length === 0) {
        // Create profile
        profileResult = await dbClient.query(`
        INSERT INTO career_profiles (tenant_id, employee_id)
        VALUES ($1, $2)
        RETURNING *
      `, [tenantId, employee.id]);
    }
    const profile = firstRowOrThrow(profileResult, 'Career profile');
    // Get skills
    const skillsResult = await dbClient.query(`
      SELECT id, skill_name, proficiency, source, validated_at
      FROM career_skills
      WHERE profile_id = $1
      ORDER BY proficiency DESC, skill_name
    `, [profile.id]);
    // Get active goals
    const goalsResult = await dbClient.query(`
      SELECT
        g.id, g.tenant_id, g.profile_id, g.target_role, g.target_job_family_id,
        g.target_date, g.status, g.progress, g.motivation,
        g.created_at, g.updated_at, g.completed_at,
        (SELECT COUNT(*) FROM career_goal_milestones m WHERE m.goal_id = g.id) as total_milestones,
        (SELECT COUNT(*) FROM career_goal_milestones m WHERE m.goal_id = g.id AND m.completed_at IS NOT NULL) as completed_milestones
      FROM career_goals g
      WHERE g.profile_id = $1 AND g.status = 'active'
      ORDER BY g.target_date
    `, [profile.id]);
    res.json({
        success: true,
        data: {
            employee: {
                id: employee.id,
                name: `${employee.first_name} ${employee.last_name}`,
                current_role: employee.job_title,
            },
            profile: {
                id: profile.id,
                career_aspiration: profile.career_aspiration,
                mobility_preference: profile.mobility_preference,
                last_assessment_date: profile.last_assessment_date,
            },
            skills: skillsResult.rows,
            goals: goalsResult.rows,
        },
    });
}));
/**
 * PUT /career-coach/profile
 * Update career profile
 */
router.put('/profile', validate(updateCareerProfileSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    const { career_aspiration, mobility_preference } = req.body;
    const employeeResult = await dbClient.query(`
      SELECT e.id FROM employees e
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND e.tenant_id = $2
    `, [userId, tenantId]);
    const employee = firstRowOrThrow(employeeResult, 'Employee');
    await dbClient.query(`
      UPDATE career_profiles
      SET
        career_aspiration = COALESCE($3, career_aspiration),
        mobility_preference = COALESCE($4, mobility_preference),
        updated_at = NOW()
      WHERE employee_id = $1 AND tenant_id = $2
    `, [employee.id, tenantId, career_aspiration, mobility_preference]);
    res.json({ success: true });
}));
/**
 * GET /career-coach/skills
 * Get skills for profile
 */
router.get('/skills', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    const result = await dbClient.query(`
      SELECT cs.id, cs.tenant_id, cs.profile_id, cs.skill_id, cs.skill_name,
             cs.proficiency, cs.source, cs.validated_by, cs.validated_at,
             cs.evidence_notes, cs.created_at, cs.updated_at
      FROM career_skills cs
      JOIN career_profiles cp ON cs.profile_id = cp.id
      JOIN employees e ON cp.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND cs.tenant_id = $2
      ORDER BY cs.proficiency DESC, cs.skill_name
    `, [userId, tenantId]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * POST /career-coach/skills
 * Add or update skill
 */
router.post('/skills', validate(createCareerSkillSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    const { skill_name, proficiency, evidence_notes } = req.body;
    if (!skill_name || !proficiency) {
        throw Errors.badRequest('Skill name and proficiency required');
    }
    // Get profile
    const profileResult = await dbClient.query(`
      SELECT cp.id
      FROM career_profiles cp
      JOIN employees e ON cp.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND cp.tenant_id = $2
    `, [userId, tenantId]);
    if (profileResult.rows.length === 0) {
        throw Errors.notFound('Career profile');
    }
    const profileId = profileResult.rows[0]?.id;
    // Upsert skill
    const result = await dbClient.query(`
      INSERT INTO career_skills (tenant_id, profile_id, skill_name, proficiency, source, evidence_notes)
      VALUES ($1, $2, $3, $4, 'self', $5)
      ON CONFLICT (profile_id, skill_name) DO UPDATE SET
        proficiency = EXCLUDED.proficiency,
        evidence_notes = EXCLUDED.evidence_notes,
        updated_at = NOW()
      RETURNING *
    `, [tenantId, profileId, skill_name, proficiency, evidence_notes]);
    // Update assessment date
    await dbClient.query(`
      UPDATE career_profiles SET last_assessment_date = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [profileId]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * DELETE /career-coach/skills/:id
 * Remove skill
 */
router.delete('/skills/:id', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    await dbClient.query(`
      DELETE FROM career_skills
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    res.json({ success: true });
}));
/**
 * GET /career-coach/paths
 * Get available career paths
 */
router.get('/paths', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    // Get employee current role
    const employeeResult = await dbClient.query(`
      SELECT e.job_title FROM employees e
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND e.tenant_id = $2
    `, [userId, tenantId]);
    const currentRole = employeeResult.rows[0]?.job_title || 'Unknown';
    // Get matching paths
    const pathsResult = await dbClient.query(`
      SELECT
        id,
        name,
        description,
        from_role,
        to_role,
        estimated_months,
        required_skills,
        success_rate
      FROM career_path_templates
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY
        CASE WHEN LOWER(from_role) LIKE LOWER($2) THEN 0 ELSE 1 END,
        estimated_months
    `, [tenantId, `%${currentRole.split(' ')[0]}%`]);
    res.json({
        success: true,
        data: {
            current_role: currentRole,
            paths: pathsResult.rows,
        },
    });
}));
/**
 * GET /career-coach/goals
 * Get career goals
 */
router.get('/goals', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    const { status } = req.query;
    let query = `
      SELECT
        g.id, g.tenant_id, g.profile_id, g.target_role, g.target_job_family_id,
        g.target_date, g.status, g.progress, g.motivation,
        g.created_at, g.updated_at, g.completed_at,
        json_agg(
          json_build_object(
            'id', m.id,
            'title', m.title,
            'type', m.type,
            'due_date', m.due_date,
            'completed_at', m.completed_at
          ) ORDER BY m.sequence_order
        ) FILTER (WHERE m.id IS NOT NULL) as milestones
      FROM career_goals g
      LEFT JOIN career_goal_milestones m ON g.id = m.goal_id
      JOIN career_profiles cp ON g.profile_id = cp.id
      JOIN employees e ON cp.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND g.tenant_id = $2
    `;
    const params = [userId, tenantId];
    if (status) {
        query += ` AND g.status = $3`;
        params.push(status);
    }
    query += ` GROUP BY g.id ORDER BY g.created_at DESC`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        data: result.rows,
    });
}));
/**
 * POST /career-coach/goals
 * Create career goal
 */
router.post('/goals', validate(createCareerGoalSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    const { target_role, target_date, motivation, milestones } = req.body;
    if (!target_role) {
        throw Errors.badRequest('Target role is required');
    }
    // Get profile
    const profileResult = await dbClient.query(`
      SELECT cp.id
      FROM career_profiles cp
      JOIN employees e ON cp.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND cp.tenant_id = $2
    `, [userId, tenantId]);
    if (profileResult.rows.length === 0) {
        throw Errors.notFound('Career profile');
    }
    const profileId = profileResult.rows[0]?.id;
    // Create goal
    const goalResult = await dbClient.query(`
      INSERT INTO career_goals (tenant_id, profile_id, target_role, target_date, motivation)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [tenantId, profileId, target_role, target_date, motivation]);
    const goalId = goalResult.rows[0]?.id;
    // Create milestones if provided (batch insert)
    if (milestones && Array.isArray(milestones) && milestones.length > 0) {
        const mTenantIds = milestones.map(() => tenantId);
        const mGoalIds = milestones.map(() => goalId);
        const mTitles = milestones.map((m) => m.title);
        const mTypes = milestones.map((m) => m.type || 'action');
        const mDueDates = milestones.map((m) => m.due_date ?? null);
        const mSequences = milestones.map((_, i) => i);
        await dbClient.query(`
        INSERT INTO career_goal_milestones (tenant_id, goal_id, title, type, due_date, sequence_order)
        SELECT t.tenant_id, t.goal_id, t.title, t.type, t.due_date, t.sequence_order
        FROM UNNEST(
          $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::date[], $6::int[]
        ) AS t(tenant_id, goal_id, title, type, due_date, sequence_order)
      `, [mTenantIds, mGoalIds, mTitles, mTypes, mDueDates, mSequences]);
    }
    res.status(201).json({
        success: true,
        data: goalResult.rows[0] || null,
    });
}));
/**
 * PUT /career-coach/goals/:id
 * Update career goal
 */
router.put('/goals/:id', validate(updateCareerGoalSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    const { target_role, target_date, motivation, status } = req.body;
    await dbClient.query(`
      UPDATE career_goals
      SET
        target_role = COALESCE($3, target_role),
        target_date = COALESCE($4, target_date),
        motivation = COALESCE($5, motivation),
        status = COALESCE($6, status),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId, target_role, target_date, motivation, status]);
    res.json({ success: true });
}));
/**
 * POST /career-coach/goals/:id/milestones
 * Add milestone to goal
 */
router.post('/goals/:id/milestones', validate(createGoalMilestoneSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const { id: goalId } = req.params;
    const { title, type, due_date } = req.body;
    if (!title) {
        throw Errors.badRequest('Title is required');
    }
    // Get max sequence
    const seqResult = await dbClient.query(`
      SELECT COALESCE(MAX(sequence_order), -1) + 1 as next_seq
      FROM career_goal_milestones WHERE goal_id = $1
    `, [goalId]);
    const result = await dbClient.query(`
      INSERT INTO career_goal_milestones (tenant_id, goal_id, title, type, due_date, sequence_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenantId, goalId, title, type || 'action', due_date, seqResult.rows[0]?.next_seq]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
    });
}));
/**
 * PUT /career-coach/milestones/:id/complete
 * Mark milestone as complete
 */
router.put('/milestones/:id/complete', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    await dbClient.query(`
      UPDATE career_goal_milestones
      SET completed_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    res.json({ success: true });
}));
/**
 * GET /career-coach/recommendations
 * Get AI-powered recommendations
 */
router.get('/recommendations', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    // Get profile
    const profileResult = await dbClient.query(`
      SELECT cp.id, e.job_title
      FROM career_profiles cp
      JOIN employees e ON cp.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND cp.tenant_id = $2
    `, [userId, tenantId]);
    if (profileResult.rows.length === 0) {
        res.json({
            success: true,
            data: { courses: [], opportunities: [], skills: [] },
        });
        return;
    }
    const profileId = profileResult.rows[0]?.id;
    // Note: job_title available if needed for enhanced recommendations
    // Get active recommendations
    const recsResult = await dbClient.query(`
      SELECT id, tenant_id, profile_id, type, reference_type, reference_id,
             title, description, relevance_score, reason, is_dismissed,
             created_at, expires_at
      FROM career_recommendations
      WHERE profile_id = $1 AND is_dismissed = false
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT 20
    `, [profileId]);
    // Group by type
    const grouped = {
        courses: recsResult.rows.filter((r) => r.type === 'course'),
        opportunities: recsResult.rows.filter((r) => r.type === 'opportunity' || r.type === 'role'),
        skills: recsResult.rows.filter((r) => r.type === 'skill'),
        mentors: recsResult.rows.filter((r) => r.type === 'mentor'),
    };
    // If no recommendations exist, generate some based on paths
    if (recsResult.rows.length === 0) {
        const pathsResult = await dbClient.query(`
        SELECT required_skills, recommended_courses, to_role
        FROM career_path_templates
        WHERE tenant_id = $1 AND is_active = true
        LIMIT 3
      `, [tenantId]);
        // Generate skill recommendations from paths
        const suggestedSkills = [];
        pathsResult.rows.forEach((path) => {
            const skills = path.required_skills || [];
            skills.forEach((skill) => {
                if (!suggestedSkills.find((s) => s.title === skill)) {
                    suggestedSkills.push({
                        id: null,
                        type: 'skill',
                        title: skill,
                        description: `Required for transitioning to ${path.to_role}`,
                        relevance_score: 0.8,
                        reason: `Part of career path: ${path.to_role}`,
                    });
                }
            });
        });
        grouped.skills = suggestedSkills.slice(0, 5);
    }
    res.json({
        success: true,
        data: grouped,
    });
}));
/**
 * POST /career-coach/recommendations/:id/dismiss
 * Dismiss a recommendation
 */
router.post('/recommendations/:id/dismiss', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params;
    await dbClient.query(`
      UPDATE career_recommendations
      SET is_dismissed = true
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    res.json({ success: true });
}));
/**
 * GET /career-coach/analytics
 * Get career development analytics for admin dashboard
 */
router.get('/analytics', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    // Get profile counts
    const profileStats = await dbClient.query(`
      SELECT
        COUNT(*) as total_profiles,
        COUNT(*) FILTER (WHERE last_assessment_date IS NOT NULL) as assessed_profiles
      FROM career_profiles
      WHERE tenant_id = $1
    `, [tenantId]);
    // Get goal statistics
    const goalStats = await dbClient.query(`
      SELECT
        COUNT(*) as total_goals,
        COUNT(*) FILTER (WHERE status = 'active') as active_goals,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_goals,
        COUNT(*) FILTER (WHERE status = 'paused') as paused_goals,
        COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_goals,
        ROUND(AVG(progress) FILTER (WHERE status = 'active'), 0) as avg_progress
      FROM career_goals
      WHERE tenant_id = $1
    `, [tenantId]);
    // Get goals by status for pie chart
    const goalsByStatus = [
        {
            name: 'Active',
            value: safeParseInt(goalStats.rows[0]?.active_goals, { fallback: 0 }),
            color: '#3b82f6',
        },
        {
            name: 'Completed',
            value: safeParseInt(goalStats.rows[0]?.completed_goals, { fallback: 0 }),
            color: '#22c55e',
        },
        {
            name: 'Paused',
            value: safeParseInt(goalStats.rows[0]?.paused_goals, { fallback: 0 }),
            color: '#eab308',
        },
        {
            name: 'Abandoned',
            value: safeParseInt(goalStats.rows[0]?.abandoned_goals, { fallback: 0 }),
            color: '#6b7280',
        },
    ];
    // Get top skills across all profiles
    const topSkills = await dbClient.query(`
      SELECT skill_name as name, COUNT(*) as count
      FROM career_skills
      WHERE tenant_id = $1
      GROUP BY skill_name
      ORDER BY count DESC
      LIMIT 10
    `, [tenantId]);
    // Get monthly goal activity (last 6 months)
    const monthlyProgress = await dbClient.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW()) - interval '5 months',
          date_trunc('month', NOW()),
          interval '1 month'
        ) as month
      )
      SELECT
        TO_CHAR(m.month, 'Mon') as month,
        COALESCE(COUNT(g.id) FILTER (WHERE DATE_TRUNC('month', g.created_at) = m.month), 0) as goals,
        COALESCE(COUNT(g.id) FILTER (WHERE DATE_TRUNC('month', g.updated_at) = m.month AND g.status = 'completed'), 0) as completed
      FROM months m
      LEFT JOIN career_goals g ON g.tenant_id = $1
      GROUP BY m.month
      ORDER BY m.month
    `, [tenantId]);
    res.json({
        success: true,
        data: {
            totalProfiles: safeParseInt(profileStats.rows[0]?.total_profiles, { fallback: 0 }),
            activeGoals: safeParseInt(goalStats.rows[0]?.active_goals, { fallback: 0 }),
            completedGoals: safeParseInt(goalStats.rows[0]?.completed_goals, { fallback: 0 }),
            avgProgress: safeParseInt(goalStats.rows[0]?.avg_progress, { fallback: 0 }),
            topSkills: topSkills.rows.map((s) => ({
                name: s.name,
                count: parseInt(s.count),
            })),
            goalsByStatus,
            monthlyProgress: monthlyProgress.rows.map((m) => ({
                month: m.month,
                goals: parseInt(m.goals),
                completed: parseInt(m.completed),
            })),
        },
    });
}));
/**
 * GET /career-coach/stats
 * Get career coach dashboard stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    // Get profile stats
    const statsResult = await dbClient.query(`
      SELECT
        (SELECT COUNT(*) FROM career_skills cs
         JOIN career_profiles cp ON cs.profile_id = cp.id
         JOIN employees e ON cp.employee_id = e.id
         JOIN users u ON u.employee_id = e.id
         WHERE u.id = $1 AND cs.tenant_id = $2) as skills_count,
        (SELECT COUNT(*) FROM career_goals g
         JOIN career_profiles cp ON g.profile_id = cp.id
         JOIN employees e ON cp.employee_id = e.id
         JOIN users u ON u.employee_id = e.id
         WHERE u.id = $1 AND g.tenant_id = $2 AND g.status = 'active') as active_goals,
        (SELECT COUNT(*) FROM career_goals g
         JOIN career_profiles cp ON g.profile_id = cp.id
         JOIN employees e ON cp.employee_id = e.id
         JOIN users u ON u.employee_id = e.id
         WHERE u.id = $1 AND g.tenant_id = $2 AND g.status = 'completed') as completed_goals,
        (SELECT AVG(g.progress) FROM career_goals g
         JOIN career_profiles cp ON g.profile_id = cp.id
         JOIN employees e ON cp.employee_id = e.id
         JOIN users u ON u.employee_id = e.id
         WHERE u.id = $1 AND g.tenant_id = $2 AND g.status = 'active') as avg_progress
    `, [userId, tenantId]);
    // Get upcoming milestones
    const upcomingResult = await dbClient.query(`
      SELECT m.title, m.due_date, g.target_role
      FROM career_goal_milestones m
      JOIN career_goals g ON m.goal_id = g.id
      JOIN career_profiles cp ON g.profile_id = cp.id
      JOIN employees e ON cp.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE u.id = $1 AND m.tenant_id = $2
        AND m.completed_at IS NULL
        AND m.due_date IS NOT NULL
      ORDER BY m.due_date
      LIMIT 5
    `, [userId, tenantId]);
    res.json({
        success: true,
        data: {
            ...(statsResult.rows[0] || {}),
            upcoming_milestones: upcomingResult.rows,
        },
    });
}));
/**
 * POST /career-coach/feedback
 * Persist AI chat feedback (thumbs up/down)
 */
router.post('/feedback', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    const userId = getUserId(req);
    const { message_id, rating, comment } = req.body;
    if (!message_id || !rating || !['positive', 'negative'].includes(rating)) {
        throw Errors.badRequest('message_id and rating (positive/negative) are required');
    }
    const result = await dbClient.query(`INSERT INTO continuous_feedback (
        tenant_id, from_employee_id, to_employee_id,
        feedback_type, message, category, visibility
      ) SELECT
        $1,
        u.employee_id, u.employee_id,
        'ai_chat', $4, $3, 'private'
      FROM users u WHERE u.id = $2
      RETURNING id, created_at`, [tenantId, userId, rating, comment || `AI chat feedback: ${rating} for message ${message_id}`]);
    res.status(201).json({
        success: true,
        data: { id: result.rows[0]?.id, rating, message_id },
    });
}));
// =============================================================================
// POST /career-coach/ai-coach
// Conversational AI career coaching powered by Knowledge Graph + LLM
// Gathers context from fn_employee_career_recommendations, fn_skill_gap_analysis,
// concentration risk, then sends to OpenAI for natural language response.
// =============================================================================
const CAREER_COACH_SYSTEM_PROMPT = `Sei un Career Coach AI specializzato nella piattaforma Heuresys.
Il tuo ruolo e' aiutare i dipendenti a pianificare la loro crescita professionale.

Regole:
- Rispondi SEMPRE in italiano
- Basa le tue risposte ESCLUSIVAMENTE sui dati forniti nel contesto (skill, occupazioni, gap analysis)
- NON inventare skill, occupazioni o dati che non sono nel contesto
- Se non hai dati sufficienti, dillo chiaramente
- Usa un tono professionale ma incoraggiante
- Quando suggerisci un percorso, elenca i passi concreti
- Cita le skill specifiche per nome
- Indica la percentuale di readiness quando disponibile`;
router.post('/ai-coach', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient;
    const userId = getUserId(req);
    const { message, employeeId, conversationHistory } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length < 3) {
        throw Errors.badRequest('message is required (min 3 characters)');
    }
    // Resolve employee ID: explicit param → JWT user → null
    let empId = employeeId;
    if (!empId && userId) {
        const userResult = await dbClient.query(`SELECT employee_id FROM users WHERE id = $1`, [
            userId,
        ]);
        empId = userResult.rows[0]?.employee_id;
    }
    // ================================================================
    // Step 1: Gather Knowledge Graph context
    // ================================================================
    const contextParts = [];
    if (empId) {
        // Employee profile
        const empResult = await dbClient.query(`SELECT e.first_name, e.last_name, e.job_title, d.name as department
         FROM employees e LEFT JOIN org_units d ON d.id = e.org_unit_id
         WHERE e.id = $1`, [empId]);
        if (empResult.rows[0]) {
            const emp = empResult.rows[0];
            contextParts.push(`PROFILO: ${emp.first_name} ${emp.last_name}, ${emp.job_title || 'N/A'}, Dipartimento: ${emp.department || 'N/A'}`);
        }
        // Current skills
        const skillsResult = await dbClient.query(`SELECT COALESCE(s.preferred_label_en, es.custom_skill_name) as skill_name,
                s.skill_type, es.proficiency_level
         FROM employee_skills es
         LEFT JOIN esco_skills s ON s.id = es.esco_skill_id
         WHERE es.employee_id = $1
         ORDER BY es.proficiency_level DESC NULLS LAST LIMIT 20`, [empId]);
        if (skillsResult.rows.length > 0) {
            const skillList = skillsResult.rows
                .map((s) => `${s.skill_name} (${s.skill_type || 'skill'}, lv${s.proficiency_level || '?'})`)
                .join(', ');
            contextParts.push(`SKILL ATTUALI (${skillsResult.rows.length}): ${skillList}`);
        }
        // Career recommendations
        try {
            const recResult = await dbClient.query(`SELECT * FROM fn_employee_career_recommendations($1::uuid, 5)`, [empId]);
            if (recResult.rows.length > 0) {
                const recs = recResult.rows
                    .map((r) => `${r.occupation_label} (copertura ${Math.round(parseFloat(r.skill_coverage) * 100)}%, skill ${r.skills_held}/${r.total_essential})`)
                    .join('; ');
                contextParts.push(`OCCUPAZIONI RACCOMANDATE: ${recs}`);
            }
        }
        catch (_err) {
            logger.warn({ err: _err }, 'Silent catch in routes.career-coach');
        }
        // Detect gap analysis intent
        const occMatch = message.match(/(?:diventare|passare a|per|verso|come)\s+(?:un[ao]?\s+)?(.+?)(?:\?|$)/i);
        if (occMatch) {
            try {
                const occResult = await dbClient.query(`SELECT * FROM fn_find_matching_occupations($1, 'en', 3)`, [occMatch[1].trim()]);
                if (occResult.rows[0]) {
                    const gapResult = await dbClient.query(`SELECT * FROM fn_skill_gap_analysis($1::uuid, $2)`, [empId, occResult.rows[0]?.uri]);
                    if (gapResult.rows.length > 0) {
                        const easy = gapResult.rows.filter((r) => r.gap_difficulty === 'easy');
                        const moderate = gapResult.rows.filter((r) => r.gap_difficulty === 'moderate');
                        const hard = gapResult.rows.filter((r) => r.gap_difficulty === 'hard');
                        contextParts.push(`GAP ANALYSIS verso "${occResult.rows[0]?.preferred_label}": ` +
                            `Facili (${easy.length}): ${easy
                                .slice(0, 5)
                                .map((r) => r.missing_skill_label)
                                .join(', ') || '-'}; ` +
                            `Moderate (${moderate.length}): ${moderate
                                .slice(0, 5)
                                .map((r) => r.missing_skill_label)
                                .join(', ') || '-'}; ` +
                            `Difficili (${hard.length}): ${hard
                                .slice(0, 5)
                                .map((r) => r.missing_skill_label)
                                .join(', ') || '-'}`);
                    }
                }
            }
            catch (_err) {
                logger.warn({ err: _err }, 'Silent catch in routes.career-coach');
            }
        }
    }
    // Concentration risk context
    if (/rischio|critich|concentrazione|vulnerabil/i.test(message)) {
        try {
            const riskResult = await dbClient.query(`SELECT COALESCE(s.preferred_label_en, es.custom_skill_name) AS skill_label,
                  count(DISTINCT es.employee_id) AS emp_count
           FROM employee_skills es
           LEFT JOIN esco_skills s ON s.id = es.esco_skill_id
           JOIN employees e ON e.id = es.employee_id AND e.deleted_at IS NULL
           WHERE es.tenant_id = $1
           GROUP BY COALESCE(s.preferred_label_en, es.custom_skill_name)
           HAVING count(DISTINCT es.employee_id) <= 2
           ORDER BY count(DISTINCT es.employee_id) ASC LIMIT 10`, [tenantId]);
            if (riskResult.rows.length > 0) {
                const risks = riskResult.rows
                    .map((r) => `${r.skill_label} (${r.emp_count} persona/e)`)
                    .join(', ');
                contextParts.push(`SKILL A RISCHIO CRITICO: ${risks}`);
            }
        }
        catch (_err) {
            logger.warn({ err: _err }, 'Silent catch in routes.career-coach');
        }
    }
    // ================================================================
    // Step 2: Build LLM messages
    // ================================================================
    const { AIOrchestrator } = await import('../services/ai-orchestrator.js');
    const messages = [
        { role: 'system', content: CAREER_COACH_SYSTEM_PROMPT },
    ];
    if (contextParts.length > 0) {
        messages.push({
            role: 'system',
            content: `DATI DAL KNOWLEDGE GRAPH:\n\n${contextParts.join('\n\n')}`,
        });
    }
    // Add conversation history (last 10 messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory.slice(-10)) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({ role: msg.role, content: msg.content });
            }
        }
    }
    messages.push({ role: 'user', content: message });
    // ================================================================
    // Step 3: Call LLM
    // ================================================================
    const orchestrator = new AIOrchestrator(tenantId, {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
    });
    const response = await orchestrator.chatCompletion({
        tenantId,
        messages,
    });
    res.json({
        success: true,
        data: {
            reply: response.content,
            tokensUsed: response.tokensInput + response.tokensOutput,
            confidenceScore: response.confidenceScore,
            contextDataPoints: contextParts.length,
            requiresEscalation: response.requiresEscalation,
        },
    });
}));
/**
 * GET /career-coach/learning (FE-023)
 * Restituisce raccomandazioni learning per l'utente corrente.
 * Adapter su course_enrollments + courses con context career-driven.
 */
router.get('/learning', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const employeeId = authReq.user.employeeId;
    if (!employeeId) {
        res.json({ success: true, data: { recommended: [], inProgress: [], completed: [] } });
        return;
    }
    const enrollments = await req.dbClient.query(`SELECT ce.id, ce.course_id, ce.status, ce.progress_percent,
              ce.enrolled_at, ce.completed_at,
              c.title, c.description, c.duration_hours, c.category
         FROM course_enrollments ce
         LEFT JOIN courses c ON c.id = ce.course_id
        WHERE ce.tenant_id = $1 AND ce.employee_id = $2
        ORDER BY ce.enrolled_at DESC`, [tenantId, employeeId]);
    const inProgress = enrollments.rows.filter((r) => r.status === 'in_progress' || r.status === 'enrolled');
    const completed = enrollments.rows.filter((r) => r.status === 'completed');
    res.json({
        success: true,
        data: {
            recommended: [],
            inProgress,
            completed,
            totalEnrollments: enrollments.rows.length,
        },
    });
}));
export default router;
//# sourceMappingURL=career-coach.js.map