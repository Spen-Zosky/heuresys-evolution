/**
 * Performance-Skill Integration Routes
 * Sprint 2025-05: S-PERF-01-10
 *
 * Links performance review competencies to skill development actions,
 * triggers gap analyses, and provides mentor matching.
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { reviewIdParamSchema, employeeIdParamSchema, linkIdParamSchema, performanceSkillLinksQuerySchema, mentorMatchesQuerySchema, } from '../schemas/analytics-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// UUID validation helper (retained for in-handler defense-in-depth)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUUID = (uuid) => UUID_REGEX.test(uuid);
// Valid rating levels
const VALID_RATING_LEVELS = ['low', 'medium', 'high'];
// ============================================================================
// POST /performance-skill/link/:reviewId - Link performance review to skills
// ============================================================================
router.post('/link/:reviewId', validate(reviewIdParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { reviewId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!reviewId || !isValidUUID(reviewId)) {
        throw Errors.badRequest('Invalid review ID format');
    }
    const result = await dbClient.query(`SELECT * FROM fn_link_performance_to_skills($1, $2)`, [
        tenantId,
        reviewId,
    ]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Performance review');
    }
    const linkResult = result.rows[0];
    res.json({
        success: true,
        message: 'Performance review linked to skills',
        data: {
            performanceReviewId: reviewId,
            competenciesProcessed: linkResult.competencies_processed,
            lowRatingsFound: linkResult.low_ratings_found,
            skillsLinked: linkResult.skills_linked,
            gapAnalysesTriggered: linkResult.gap_analyses_triggered,
        },
    });
}));
// ============================================================================
// POST /performance-skill/gap-analysis/:employeeId - Trigger gap analysis
// ============================================================================
router.post('/gap-analysis/:employeeId', validate(employeeIdParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { employeeId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!employeeId || !isValidUUID(employeeId)) {
        throw Errors.badRequest('Invalid employee ID format');
    }
    const result = await dbClient.query(`SELECT * FROM fn_trigger_gap_analysis_for_low_ratings($1, $2)`, [tenantId, employeeId]);
    if (result.rows.length === 0) {
        res.json({
            success: true,
            message: 'No low-rated competencies found requiring gap analysis',
            data: null,
        });
        return;
    }
    const gapResult = result.rows[0];
    res.json({
        success: true,
        message: 'Gap analysis triggered for low-rated competencies',
        data: {
            gapAnalysisId: gapResult.gap_analysis_id,
            skillGapsCount: gapResult.skill_gaps_count,
            prioritySkills: gapResult.priority_skills,
        },
    });
}));
// ============================================================================
// GET /performance-skill/mentor-matches/:employeeId - Find mentor matches
// ============================================================================
router.get('/mentor-matches/:employeeId', validate(employeeIdParamSchema, 'params'), validate(mentorMatchesQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { employeeId } = req.params;
    const { skillId, limit = '10' } = req.query;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!employeeId || !isValidUUID(employeeId)) {
        throw Errors.badRequest('Invalid employee ID format');
    }
    if (skillId && !isValidUUID(skillId)) {
        throw Errors.badRequest('Invalid skill ID format');
    }
    const result = await dbClient.query(`SELECT * FROM fn_find_mentor_matches($1, $2, $3, $4)`, [
        tenantId,
        employeeId,
        skillId || null,
        safeParseInt(limit, { fallback: 50 }),
    ]);
    res.json({
        success: true,
        menteeId: employeeId,
        matchesCount: result.rows.length,
        matches: result.rows.map((row) => ({
            mentorId: row.mentor_id,
            mentorName: row.mentor_name,
            mentorTitle: row.mentor_title,
            mentorDepartment: row.mentor_department,
            skillName: row.skill_name,
            menteeLevel: parseFloat(row.mentee_level),
            mentorLevel: parseFloat(row.mentor_level),
            matchScore: parseFloat(row.match_score),
            matchFactors: row.match_factors,
        })),
    });
}));
// ============================================================================
// GET /performance-skill/learning-recommendations/:employeeId
// ============================================================================
router.get('/learning-recommendations/:employeeId', validate(employeeIdParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { employeeId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!employeeId || !isValidUUID(employeeId)) {
        throw Errors.badRequest('Invalid employee ID format');
    }
    const result = await dbClient.query(`SELECT * FROM v_learning_recommendations
       WHERE tenant_id = $1 AND employee_id = $2
       ORDER BY competency_rating ASC`, [tenantId, employeeId]);
    // Group by competency
    const byCompetency = result.rows.reduce((acc, row) => {
        const key = row.competency_name;
        if (!acc[key]) {
            acc[key] = {
                competencyName: row.competency_name,
                competencyRating: parseFloat(row.competency_rating),
                linkedSkillName: row.linked_skill_name,
                skillDescription: row.skill_description,
                recommendedCourses: [],
            };
        }
        if (row.course_id) {
            acc[key].recommendedCourses.push({
                courseId: row.course_id,
                courseTitle: row.course_title,
                durationHours: row.duration_hours,
            });
        }
        return acc;
    }, {});
    res.json({
        success: true,
        employeeId,
        employeeName: result.rows[0]?.employee_name || null,
        recommendations: Object.values(byCompetency),
    });
}));
// ============================================================================
// GET /performance-skill/summary/:employeeId - Get performance-skill summary
// ============================================================================
router.get('/summary/:employeeId', validate(employeeIdParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { employeeId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!employeeId || !isValidUUID(employeeId)) {
        throw Errors.badRequest('Invalid employee ID format');
    }
    const result = await dbClient.query(`SELECT tenant_id, employee_id, employee_name, job_title, department_name,
              total_competencies, low_rated, medium_rated, high_rated,
              skills_linked, gap_analyses, addressed, last_updated
       FROM v_performance_skill_summary
       WHERE tenant_id = $1 AND employee_id = $2`, [tenantId, employeeId]);
    if (result.rows.length === 0) {
        res.json({
            success: true,
            message: 'No performance-skill links found for this employee',
            data: null,
        });
        return;
    }
    const summary = result.rows[0];
    res.json({
        success: true,
        data: {
            employeeId: summary.employee_id,
            employeeName: summary.employee_name,
            jobTitle: summary.job_title,
            orgUnitName: summary.department_name,
            totalCompetencies: parseInt(summary.total_competencies),
            lowRated: parseInt(summary.low_rated),
            mediumRated: parseInt(summary.medium_rated),
            highRated: parseInt(summary.high_rated),
            skillsLinked: parseInt(summary.skills_linked),
            gapAnalyses: parseInt(summary.gap_analyses),
            addressed: parseInt(summary.addressed),
            lastUpdated: summary.last_updated,
        },
    });
}));
// ============================================================================
// GET /performance-skill/summary - Get summary for all employees
// ============================================================================
router.get('/summary', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    const result = await dbClient.query(`SELECT tenant_id, employee_id, employee_name, job_title, department_name,
              total_competencies, low_rated, medium_rated, high_rated,
              skills_linked, gap_analyses, addressed, last_updated
       FROM v_performance_skill_summary
       WHERE tenant_id = $1
       ORDER BY low_rated DESC, employee_name`, [tenantId]);
    res.json({
        success: true,
        count: result.rows.length,
        data: result.rows.map((row) => ({
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            jobTitle: row.job_title,
            orgUnitName: row.department_name,
            totalCompetencies: parseInt(row.total_competencies),
            lowRated: parseInt(row.low_rated),
            mediumRated: parseInt(row.medium_rated),
            highRated: parseInt(row.high_rated),
            skillsLinked: parseInt(row.skills_linked),
            gapAnalyses: parseInt(row.gap_analyses),
            addressed: parseInt(row.addressed),
            lastUpdated: row.last_updated,
        })),
    });
}));
// ============================================================================
// GET /performance-skill/links/:employeeId - Get all links for an employee
// ============================================================================
router.get('/links/:employeeId', validate(employeeIdParamSchema, 'params'), validate(performanceSkillLinksQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { employeeId } = req.params;
    const { ratingLevel } = req.query;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!employeeId || !isValidUUID(employeeId)) {
        throw Errors.badRequest('Invalid employee ID format');
    }
    if (ratingLevel && !VALID_RATING_LEVELS.includes(ratingLevel)) {
        throw Errors.badRequest('Invalid rating level. Must be: low, medium, or high');
    }
    let query = `
      SELECT
        psl.id, psl.tenant_id, psl.employee_id, psl.performance_review_id,
        psl.competency_name, psl.competency_rating, psl.rating_level,
        psl.linked_skill_id, psl.linked_gap_analysis_id,
        psl.recommended_actions, psl.learning_path_id,
        psl.mentor_recommendation_id, psl.is_addressed, psl.addressed_at,
        psl.created_at,
        es.preferred_label_en as skill_name,
        es.description_en as skill_description,
        pr.review_period_start,
        pr.review_period_end,
        rc.name as cycle_name
      FROM performance_skill_links psl
      LEFT JOIN esco_skills es ON psl.linked_skill_id = es.id
      LEFT JOIN performance_reviews pr ON psl.performance_review_id = pr.id
      LEFT JOIN review_cycles rc ON pr.review_cycle_id = rc.id
      WHERE psl.tenant_id = $1 AND psl.employee_id = $2
    `;
    const params = [tenantId, employeeId];
    if (ratingLevel) {
        query += ` AND psl.rating_level = $3`;
        params.push(ratingLevel);
    }
    query += ` ORDER BY psl.created_at DESC`;
    const result = await dbClient.query(query, params);
    res.json({
        success: true,
        count: result.rows.length,
        links: result.rows.map((row) => ({
            id: row.id,
            performanceReviewId: row.performance_review_id,
            competencyName: row.competency_name,
            competencyRating: parseFloat(row.competency_rating),
            ratingLevel: row.rating_level,
            linkedSkillId: row.linked_skill_id,
            skillName: row.skill_name,
            skillDescription: row.skill_description,
            linkedGapAnalysisId: row.linked_gap_analysis_id,
            recommendedActions: row.recommended_actions,
            learningPathId: row.learning_path_id,
            mentorRecommendationId: row.mentor_recommendation_id,
            isAddressed: row.is_addressed,
            addressedAt: row.addressed_at,
            reviewPeriod: {
                start: row.review_period_start,
                end: row.review_period_end,
            },
            cycleName: row.cycle_name,
            createdAt: row.created_at,
        })),
    });
}));
// ============================================================================
// PUT /performance-skill/links/:linkId/address - Mark a link as addressed
// ============================================================================
router.put('/links/:linkId/address', validate(linkIdParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { linkId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!linkId || !isValidUUID(linkId)) {
        throw Errors.badRequest('Invalid link ID format');
    }
    const result = await dbClient.query(`UPDATE performance_skill_links
       SET is_addressed = true, addressed_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`, [linkId, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Performance-skill link');
    }
    res.json({
        success: true,
        message: 'Link marked as addressed',
        data: result.rows[0] || null,
    });
}));
// ============================================================================
// POST /performance-skill/batch-link - Batch link all pending reviews
// ============================================================================
router.post('/batch-link', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    // Find all completed reviews that haven't been linked yet
    const pendingReviews = await dbClient.query(`SELECT pr.id
       FROM performance_reviews pr
       WHERE pr.tenant_id = $1
         AND pr.status = 'completed'
         AND NOT EXISTS (
           SELECT 1 FROM performance_skill_links psl
           WHERE psl.performance_review_id = pr.id
         )`, [tenantId]);
    const results = [];
    for (const review of pendingReviews.rows) {
        try {
            const linkResult = await dbClient.query(`SELECT * FROM fn_link_performance_to_skills($1, $2)`, [tenantId, review.id]);
            if (linkResult.rows.length > 0) {
                results.push({
                    reviewId: review.id,
                    ...(linkResult.rows[0] || {}),
                    success: true,
                });
            }
        }
        catch (err) {
            results.push({
                reviewId: review.id,
                success: false,
                error: err.message,
            });
        }
    }
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    res.json({
        success: true,
        message: `Batch linking completed: ${successful} successful, ${failed} failed`,
        totalProcessed: results.length,
        successful,
        failed,
        results,
    });
}));
// ============================================================================
// GET /performance-skill/development-plan/:employeeId - Full development plan
// ============================================================================
router.get('/development-plan/:employeeId', validate(employeeIdParamSchema, 'params'), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { employeeId } = req.params;
    const tenantId = getTenantIdOrThrow(req);
    if (!tenantId) {
        throw Errors.badRequest('Tenant context required');
    }
    if (!employeeId || !isValidUUID(employeeId)) {
        throw Errors.badRequest('Invalid employee ID format');
    }
    // Get employee info
    const empResult = await dbClient.query(`SELECT e.id, e.first_name, e.last_name, e.job_title, d.name as department
       FROM employees e
       LEFT JOIN org_units d ON e.org_unit_id = d.id
       WHERE e.id = $1 AND e.tenant_id = $2`, [employeeId, tenantId]);
    if (empResult.rows.length === 0) {
        throw Errors.notFound('Employee');
    }
    const employee = empResult.rows[0];
    // Get low-rated competencies
    const competencies = await dbClient.query(`SELECT
        psl.competency_name,
        psl.competency_rating,
        psl.rating_level,
        es.preferred_label_en as linked_skill,
        psl.recommended_actions,
        psl.is_addressed
       FROM performance_skill_links psl
       LEFT JOIN esco_skills es ON psl.linked_skill_id = es.id
       WHERE psl.tenant_id = $1
         AND psl.employee_id = $2
         AND psl.rating_level = 'low'
       ORDER BY psl.competency_rating ASC`, [tenantId, employeeId]);
    // Get mentor matches
    const mentors = await dbClient.query(`SELECT * FROM fn_find_mentor_matches($1, $2, NULL, 5)`, [
        tenantId,
        employeeId,
    ]);
    // Get gap analysis if exists
    const gapAnalysis = await dbClient.query(`SELECT id, tenant_id, analysis_name, analysis_type, target_entity_type,
              target_entity_id, target_position_id, target_position_name,
              comparison_type, analysis_date, overall_match_score, coverage_score,
              proficiency_score, skill_matches, skill_gaps, skill_surplus,
              recommendations, priority_skills, market_comparison, internal_comparison,
              created_by, created_at, updated_at, created_by_employee_id
       FROM skill_gap_analyses
       WHERE tenant_id = $1
         AND target_entity_id = $2
         AND target_entity_type = 'employee'
       ORDER BY created_at DESC
       LIMIT 1`, [tenantId, employeeId]);
    res.json({
        success: true,
        developmentPlan: {
            employee: {
                id: employee.id,
                name: `${employee.first_name} ${employee.last_name}`,
                jobTitle: employee.job_title,
                department: employee.department,
            },
            areasForDevelopment: competencies.rows.map((c) => ({
                competencyName: c.competency_name,
                currentRating: parseFloat(c.competency_rating),
                ratingLevel: c.rating_level,
                linkedSkill: c.linked_skill,
                recommendedActions: c.recommended_actions,
                isAddressed: c.is_addressed,
            })),
            recommendedMentors: mentors.rows.map((m) => ({
                mentorId: m.mentor_id,
                mentorName: m.mentor_name,
                mentorTitle: m.mentor_title,
                department: m.mentor_department,
                skillName: m.skill_name,
                matchScore: parseFloat(m.match_score),
            })),
            gapAnalysis: gapAnalysis.rows.length > 0
                ? {
                    id: gapAnalysis.rows[0]?.id,
                    analysisDate: gapAnalysis.rows[0]?.analysis_date,
                    skillGaps: gapAnalysis.rows[0]?.skill_gaps,
                    prioritySkills: gapAnalysis.rows[0]?.priority_skills,
                    recommendations: gapAnalysis.rows[0]?.recommendations,
                }
                : null,
            generatedAt: new Date().toISOString(),
        },
    });
}));
export default router;
//# sourceMappingURL=performance-skill-integration.js.map