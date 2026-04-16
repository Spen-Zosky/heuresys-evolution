/**
 * Gap Analysis Recommendations Service
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-06 (Gap Analysis Recommendations)
 *
 * Generates actionable recommendations to close skill gaps:
 * - Training courses
 * - Mentoring suggestions
 * - Job assignments
 * - Self-study resources
 */
import { pool } from '../../config/database.js';
import { logger } from '../../config/logger.js';
// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function generateRecommendationId() {
    return `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}
function mapGapToPriority(severity) {
    switch (severity) {
        case 'critical':
            return 'critical';
        case 'high':
            return 'high';
        case 'medium':
            return 'medium';
        default:
            return 'low';
    }
}
function estimateEffortLevel(gapScore) {
    if (gapScore < 0.5)
        return 'minimal';
    if (gapScore < 1.0)
        return 'moderate';
    if (gapScore < 2.0)
        return 'significant';
    return 'major';
}
function estimateHoursForGap(gapScore, dimension) {
    // Base hours per 1 point of gap
    const baseHours = {
        knowledge: 20, // Knowledge can be gained through study
        skill: 40, // Skill requires practice
        ability: 60, // Ability takes longer to develop
        behavior: 30, // Behavior change is moderate
        attitude: 25, // Attitude shifts with awareness
    };
    const base = baseHours[dimension] || 30;
    return Math.ceil(base * Math.max(0, gapScore));
}
// =============================================================================
// TRAINING RECOMMENDATIONS
// =============================================================================
async function findTrainingForSkill(skillId, skillName, gapScore, tenantId) {
    const recommendations = [];
    // Try to find courses that match the skill using embeddings
    const courseQuery = `
    SELECT
      c.id,
      c.title,
      c.title_en,
      c.description,
      c.duration_hours,
      c.level,
      c.provider,
      c.is_certification,
      c.skills,
      -- Semantic similarity between course and skill embeddings
      CASE
        WHEN c.embedding_en IS NOT NULL AND es.embedding IS NOT NULL
        THEN 1 - (c.embedding_en <=> es.embedding)
        ELSE 0
      END as similarity
    FROM public.courses c
    CROSS JOIN esco_skills es
    WHERE es.id = $1
      AND c.is_active = true
      AND (c.tenant_id = $2 OR c.tenant_id IS NULL)
    ORDER BY similarity DESC
    LIMIT 5
  `;
    try {
        const result = await pool.query(courseQuery, [skillId, tenantId]);
        for (const course of result.rows) {
            // Only include if similarity is reasonable
            if (course.similarity < 0.5 && result.rows.indexOf(course) > 0)
                continue;
            const hours = course.duration_hours
                ? parseFloat(course.duration_hours)
                : gapScore < 1
                    ? 8
                    : gapScore < 2
                        ? 16
                        : 24;
            recommendations.push({
                id: generateRecommendationId(),
                type: course.is_certification ? 'certification' : 'training',
                priority: mapGapToPriority(gapScore > 1.5 ? 'high' : gapScore > 0.5 ? 'medium' : 'low'),
                skillId,
                skillName,
                gapSeverity: gapScore > 1.5 ? 'high' : gapScore > 0.5 ? 'medium' : 'low',
                title: course.title_en || course.title,
                description: course.description || `Training course to develop ${skillName}`,
                resourceType: 'course',
                resourceId: course.id,
                resourceName: course.title_en || course.title,
                resourceUrl: undefined,
                estimatedHours: hours,
                estimatedDays: Math.ceil(hours / 8),
                estimatedWeeks: Math.ceil(hours / 40),
                effortLevel: estimateEffortLevel(gapScore),
                expectedGapReduction: Math.min(80, 30 + course.similarity * 50),
                expectedLevelGain: Math.min(gapScore, 1.5),
                confidence: Math.max(0.3, course.similarity),
                rationale: `Course matches skill with ${Math.round(course.similarity * 100)}% similarity. ${course.provider ? `Provided by ${course.provider}.` : ''}`,
            });
        }
    }
    catch {
        // Fallback: suggest generic training
        recommendations.push({
            id: generateRecommendationId(),
            type: 'training',
            priority: mapGapToPriority(gapScore > 1.5 ? 'high' : 'medium'),
            skillId,
            skillName,
            gapSeverity: gapScore > 1.5 ? 'high' : 'medium',
            title: `Training for ${skillName}`,
            description: `Find appropriate training course to develop ${skillName}`,
            resourceType: undefined,
            resourceId: undefined,
            estimatedHours: estimateHoursForGap(gapScore, 'skill'),
            effortLevel: estimateEffortLevel(gapScore),
            expectedGapReduction: 50,
            expectedLevelGain: Math.min(gapScore, 1.0),
            confidence: 0.4,
            rationale: 'Generic training recommendation - no specific courses found matching this skill.',
        });
    }
    return recommendations;
}
// =============================================================================
// MENTORING RECOMMENDATIONS
// =============================================================================
async function findMentorsForSkill(skillId, skillName, gapScore, employeeId, tenantId) {
    const recommendations = [];
    // Find employees with verified high-level skills in the same tenant
    const mentorQuery = `
    SELECT
      e.id as mentor_id,
      e.first_name || ' ' || e.last_name as mentor_name,
      e.job_title,
      d.name as department,
      esp.composite_score,
      esp.knowledge_level,
      esp.skill_level,
      esp.verification_status
    FROM employee_skill_profiles esp
    JOIN employees e ON esp.employee_id = e.id
    LEFT JOIN org_units d ON e.org_unit_id = d.id
    WHERE esp.skill_id = $1
      AND esp.employee_id != $2
      AND esp.composite_score >= 3.5
      AND esp.verification_status = 'verified'
      AND e.tenant_id = $3
      AND e.is_active = true
    ORDER BY esp.composite_score DESC
    LIMIT 3
  `;
    try {
        const result = await pool.query(mentorQuery, [skillId, employeeId, tenantId]);
        for (const mentor of result.rows) {
            const mentorLevel = parseFloat(mentor.composite_score);
            const expectedTransfer = Math.min(1.5, (mentorLevel - 2) * 0.4);
            recommendations.push({
                id: generateRecommendationId(),
                type: 'mentoring',
                priority: mapGapToPriority(gapScore > 1.5 ? 'high' : 'medium'),
                skillId,
                skillName,
                gapSeverity: gapScore > 1.5 ? 'high' : 'medium',
                title: `Mentoring with ${mentor.mentor_name}`,
                description: `${mentor.mentor_name} (${mentor.job_title}) has verified expertise in ${skillName} with a composite score of ${mentorLevel.toFixed(1)}.`,
                resourceType: 'employee',
                resourceId: mentor.mentor_id,
                resourceName: mentor.mentor_name,
                estimatedHours: Math.ceil(gapScore * 10), // Roughly 10 hours per point of gap
                estimatedWeeks: Math.ceil((gapScore * 10) / 5), // 5 hours/week mentoring
                effortLevel: estimateEffortLevel(gapScore * 0.7), // Mentoring is more efficient
                expectedGapReduction: Math.min(70, 40 + mentorLevel * 5),
                expectedLevelGain: expectedTransfer,
                confidence: 0.7,
                rationale: `${mentor.mentor_name} has a verified ${skillName} score of ${mentorLevel.toFixed(1)}. They work in ${mentor.department || 'the organization'} and can provide hands-on guidance.`,
            });
        }
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.gap-analysis.gap-recommendations.service');
    }
    return recommendations;
}
// =============================================================================
// SELF-STUDY RECOMMENDATIONS
// =============================================================================
function generateSelfStudyRecommendations(skillId, skillName, gap) {
    const recommendations = [];
    // Knowledge gap - books/documentation
    if (gap.gaps.knowledge > 0.5) {
        recommendations.push({
            id: generateRecommendationId(),
            type: 'self_study',
            priority: 'low',
            skillId,
            skillName,
            gapSeverity: 'low',
            title: `Self-study: ${skillName} fundamentals`,
            description: `Build theoretical knowledge of ${skillName} through documentation, books, and online resources.`,
            resourceType: 'external',
            estimatedHours: estimateHoursForGap(gap.gaps.knowledge, 'knowledge'),
            effortLevel: 'moderate',
            expectedGapReduction: 30,
            expectedLevelGain: Math.min(gap.gaps.knowledge, 1.0),
            confidence: 0.5,
            rationale: `Knowledge gap of ${gap.gaps.knowledge.toFixed(1)} points can be partially addressed through self-directed learning.`,
        });
    }
    // Skill gap - practice projects
    if (gap.gaps.skill > 0.5) {
        recommendations.push({
            id: generateRecommendationId(),
            type: 'self_study',
            priority: 'medium',
            skillId,
            skillName,
            gapSeverity: 'medium',
            title: `Practice project: Apply ${skillName}`,
            description: `Work on practice projects or simulations to develop practical ${skillName} capabilities.`,
            resourceType: 'external',
            estimatedHours: estimateHoursForGap(gap.gaps.skill, 'skill'),
            effortLevel: 'significant',
            expectedGapReduction: 25,
            expectedLevelGain: Math.min(gap.gaps.skill * 0.5, 0.8),
            confidence: 0.4,
            rationale: `Practical skill gap of ${gap.gaps.skill.toFixed(1)} points requires hands-on practice.`,
        });
    }
    return recommendations;
}
// =============================================================================
// MAIN RECOMMENDATION ENGINE
// =============================================================================
export async function generateRecommendations(gapAnalysis, options = {}) {
    const { maxPerSkill = 5, includeTypes = ['training', 'mentoring', 'self_study', 'certification'], minSeverity = 'low', } = options;
    const generatedAt = new Date();
    const skillRecommendations = [];
    const allRecommendations = [];
    const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType = { training: 0, mentoring: 0, assignment: 0, self_study: 0, certification: 0 };
    // Get tenant ID from first gap's context
    let tenantId;
    if (gapAnalysis.targetType === 'employee') {
        const empResult = await pool.query('SELECT tenant_id FROM employees WHERE id = $1', [
            gapAnalysis.targetId,
        ]);
        tenantId = empResult.rows[0]?.tenant_id;
    }
    // Filter gaps by minimum severity
    const severityOrder = ['none', 'low', 'medium', 'high', 'critical'];
    const minSeverityIndex = severityOrder.indexOf(minSeverity);
    const eligibleGaps = gapAnalysis.gaps.filter((g) => severityOrder.indexOf(g.severity) >= minSeverityIndex && g.gapScore > 0);
    // Generate recommendations for each gap
    for (const gap of eligibleGaps) {
        const skillRecs = [];
        // Training recommendations
        if (includeTypes.includes('training') || includeTypes.includes('certification')) {
            const trainingRecs = await findTrainingForSkill(gap.skillId, gap.skillName, gap.gapScore, tenantId);
            skillRecs.push(...trainingRecs.filter((r) => includeTypes.includes(r.type)));
        }
        // Mentoring recommendations
        if (includeTypes.includes('mentoring') && gapAnalysis.targetType === 'employee') {
            const mentoringRecs = await findMentorsForSkill(gap.skillId, gap.skillName, gap.gapScore, gapAnalysis.targetId, tenantId);
            skillRecs.push(...mentoringRecs);
        }
        // Self-study recommendations
        if (includeTypes.includes('self_study')) {
            skillRecs.push(...generateSelfStudyRecommendations(gap.skillId, gap.skillName, gap));
        }
        // Sort by priority and confidence, take top N
        skillRecs.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return b.confidence - a.confidence;
        });
        const topRecs = skillRecs.slice(0, maxPerSkill);
        // Accumulate counts
        for (const rec of topRecs) {
            byPriority[rec.priority]++;
            byType[rec.type]++;
            allRecommendations.push(rec);
        }
        skillRecommendations.push({
            skillId: gap.skillId,
            skillName: gap.skillName,
            gapScore: gap.gapScore,
            gapSeverity: gap.severity,
            recommendations: topRecs,
        });
    }
    // Calculate total estimated hours
    const totalEstimatedHours = allRecommendations.reduce((sum, r) => sum + (r.estimatedHours || 0), 0);
    // Get top recommendations across all skills
    const topRecommendations = [...allRecommendations]
        .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.expectedGapReduction - a.expectedGapReduction;
    })
        .slice(0, 10);
    return {
        analysisId: gapAnalysis.analysisId,
        targetId: gapAnalysis.targetId,
        targetName: gapAnalysis.targetName,
        generatedAt,
        totalRecommendations: allRecommendations.length,
        byPriority,
        byType,
        totalEstimatedHours,
        skillRecommendations,
        topRecommendations,
    };
}
// =============================================================================
// EXPORTS
// =============================================================================
export const gapRecommendationsService = {
    generateRecommendations,
};
//# sourceMappingURL=gap-recommendations.service.js.map