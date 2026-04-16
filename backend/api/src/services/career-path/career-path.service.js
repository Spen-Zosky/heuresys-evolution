/**
 * Career Path Engine Service
 * Sprint 2025-04 - S-ONTO-03-07
 *
 * Provides career path recommendations, skill distance calculations,
 * fit scores, and timeline estimations for employee career development.
 */
import { escapeILIKE } from '../../utils/sql-safety.js';
import { logger } from '../../config/logger.js';
// ============================================================================
// Career Path Service Class
// ============================================================================
export class CareerPathService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    // --------------------------------------------------------------------------
    // Get All Career Paths
    // --------------------------------------------------------------------------
    async getAllPaths(tenantId, options = {}) {
        let query = `
      SELECT
        cp.id,
        cp.name,
        cp.description,
        cp.department,
        cp.path_type,
        cp.is_active,
        cp.tenant_id,
        (SELECT COUNT(*) FROM career_path_levels WHERE path_id = cp.id) as levels_count
      FROM career_paths cp
      WHERE cp.tenant_id = $1
    `;
        const params = [tenantId];
        let paramIndex = 2;
        if (options.pathType) {
            query += ` AND cp.path_type = $${paramIndex++}`;
            params.push(options.pathType);
        }
        if (options.status === 'active') {
            query += ` AND cp.is_active = true`;
        }
        else if (options.status === 'inactive') {
            query += ` AND cp.is_active = false`;
        }
        if (options.search) {
            query += ` AND (cp.name ILIKE $${paramIndex} OR cp.description ILIKE $${paramIndex})`;
            params.push(`%${escapeILIKE(options.search)}%`);
        }
        query += ` ORDER BY cp.name`;
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // Get Career Path Details with Levels
    // --------------------------------------------------------------------------
    async getPathDetails(tenantId, pathId) {
        const pathResult = await this.pool.query(`
      SELECT * FROM career_paths WHERE id = $1 AND tenant_id = $2
    `, [pathId, tenantId]);
        if (pathResult.rows.length === 0) {
            return null;
        }
        const levelsResult = await this.pool.query(`
      SELECT * FROM career_path_levels WHERE path_id = $1 ORDER BY level_order
    `, [pathId]);
        return {
            ...pathResult.rows[0],
            levels: levelsResult.rows,
        };
    }
    // --------------------------------------------------------------------------
    // Get Career Path Recommendations for Employee
    // --------------------------------------------------------------------------
    async getRecommendationsForEmployee(tenantId, employeeId, refresh = false) {
        // Check for cached recommendations unless refresh is requested
        if (!refresh) {
            const cached = await this.pool.query(`
        SELECT * FROM career_path_recommendations
        WHERE employee_id = $1 AND tenant_id = $2
          AND expires_at > NOW()
        ORDER BY composite_score DESC
        LIMIT 10
      `, [employeeId, tenantId]);
            if (cached.rows.length > 0) {
                return this.reconstructRecommendationsFromCache(tenantId, cached.rows);
            }
        }
        // Get all active career paths
        const paths = await this.getAllPaths(tenantId, { status: 'active' });
        const recommendations = [];
        for (const path of paths) {
            try {
                const recommendation = await this.calculatePathRecommendation(tenantId, employeeId, path.id);
                if (recommendation) {
                    recommendations.push(recommendation);
                }
            }
            catch (error) {
                logger.warn(`Error calculating recommendation for path ${path.id}:${error}`);
            }
        }
        // Sort by fit score
        recommendations.sort((a, b) => b.fit_score - a.fit_score);
        // Mark primary recommendation
        if (recommendations.length > 0) {
            const first = recommendations[0];
            if (first) {
                first.is_primary_recommendation = true;
            }
        }
        return recommendations.slice(0, 10);
    }
    // --------------------------------------------------------------------------
    // Calculate Path Recommendation
    // --------------------------------------------------------------------------
    async calculatePathRecommendation(tenantId, employeeId, pathId) {
        const path = await this.getPathDetails(tenantId, pathId);
        if (!path || path.levels.length === 0) {
            return null;
        }
        // Get employee's current skills
        const employeeSkills = await this.getEmployeeSkills(employeeId);
        // Calculate fit scores for each level
        const levelAnalysis = [];
        for (const level of path.levels) {
            const analysis = await this.analyzeLevelFit(level, employeeSkills);
            levelAnalysis.push(analysis);
        }
        // Find current level (highest level employee meets requirements for)
        let currentLevelIndex = -1;
        for (let i = 0; i < levelAnalysis.length; i++) {
            const analysis = levelAnalysis[i];
            if (analysis && analysis.meetsRequirements) {
                currentLevelIndex = i;
            }
            else {
                break;
            }
        }
        // Find reachable level (next level they can achieve with some development)
        let reachableLevelIndex = currentLevelIndex + 1;
        if (reachableLevelIndex >= path.levels.length) {
            reachableLevelIndex = path.levels.length - 1;
        }
        // Calculate overall fit score
        const fitScore = this.calculateOverallFitScore(levelAnalysis);
        const skillMatchScore = levelAnalysis.reduce((sum, l) => sum + l.skillCoverage, 0) / levelAnalysis.length;
        // Aggregate skill gaps from future levels
        const futureAnalysis = levelAnalysis.slice(currentLevelIndex + 1);
        const allGaps = futureAnalysis.flatMap((l) => l.gaps);
        // Estimate timeline
        let monthsToNext = 0;
        if (currentLevelIndex < path.levels.length - 1) {
            const nextAnalysis = levelAnalysis[currentLevelIndex + 1];
            if (nextAnalysis) {
                monthsToNext = this.estimateMonthsToLevel(nextAnalysis);
            }
        }
        const monthsToTarget = futureAnalysis.reduce((sum, l) => sum + this.estimateMonthsToLevel(l), 0);
        // Get level IDs
        const currentLevel = currentLevelIndex >= 0 ? path.levels[currentLevelIndex] : null;
        const reachableLevel = path.levels[reachableLevelIndex];
        const targetLevel = path.levels[path.levels.length - 1];
        const recommendation = {
            path: {
                id: path.id,
                name: path.name,
                description: path.description,
                department: path.department,
                path_type: path.path_type,
                is_active: path.is_active,
                tenant_id: path.tenant_id,
                levels_count: path.levels.length,
            },
            fit_score: fitScore,
            skill_match_score: skillMatchScore,
            current_level_id: currentLevel ? currentLevel.id : null,
            reachable_level_id: reachableLevel ? reachableLevel.id : null,
            target_level_id: targetLevel ? targetLevel.id : null,
            total_skill_gaps: allGaps.length,
            critical_skill_gaps: allGaps.filter((g) => g.severity === 'critical' || g.severity === 'high')
                .length,
            estimated_months_to_next: monthsToNext,
            estimated_months_to_target: monthsToTarget,
            skill_gaps: allGaps,
            is_primary_recommendation: false,
            recommendation_reason: this.generateRecommendationReason(fitScore),
        };
        // Save recommendation to database
        await this.saveRecommendation(tenantId, employeeId, recommendation);
        return recommendation;
    }
    // --------------------------------------------------------------------------
    // Simulate Career Path
    // --------------------------------------------------------------------------
    async simulateCareerPath(tenantId, params) {
        const { employeeId, targetPathId, targetLevelId, targetJobId } = params;
        const crypto = await import('crypto');
        const simulationId = crypto.randomUUID();
        // If target job is specified, find paths that include it
        let pathsToAnalyze = [];
        if (targetPathId) {
            const path = await this.getPathDetails(tenantId, targetPathId);
            if (path) {
                pathsToAnalyze = [path];
            }
        }
        else if (targetJobId) {
            const result = await this.pool.query(`
        SELECT DISTINCT cp.*
        FROM career_paths cp
        JOIN career_path_levels cpl ON cpl.path_id = cp.id
        WHERE cpl.target_job_id = $1 AND cp.tenant_id = $2
      `, [targetJobId, tenantId]);
            pathsToAnalyze = result.rows;
        }
        else {
            pathsToAnalyze = await this.getAllPaths(tenantId, { status: 'active' });
        }
        if (pathsToAnalyze.length === 0) {
            throw new Error('No career paths found for simulation');
        }
        // Analyze primary path
        const primaryPath = pathsToAnalyze[0];
        if (!primaryPath) {
            throw new Error('No primary path available');
        }
        const pathDetails = await this.getPathDetails(tenantId, primaryPath.id);
        if (!pathDetails) {
            throw new Error('Career path details not found');
        }
        const employeeSkills = await this.getEmployeeSkills(employeeId);
        // Analyze each level
        const levelAnalysis = [];
        for (const level of pathDetails.levels) {
            const analysis = await this.analyzeLevelFit(level, employeeSkills);
            levelAnalysis.push(analysis);
        }
        // Find current level
        let currentLevelIndex = -1;
        for (let i = 0; i < levelAnalysis.length; i++) {
            const analysis = levelAnalysis[i];
            if (analysis && analysis.meetsRequirements) {
                currentLevelIndex = i;
            }
            else {
                break;
            }
        }
        // Find target level
        let targetLevelIndex = pathDetails.levels.length - 1;
        if (targetLevelId) {
            const idx = pathDetails.levels.findIndex((l) => l.id === targetLevelId);
            if (idx >= 0)
                targetLevelIndex = idx;
        }
        // Calculate skill distance
        const relevantAnalysis = levelAnalysis.slice(currentLevelIndex + 1, targetLevelIndex + 1);
        const skillDistance = relevantAnalysis.reduce((sum, l) => sum + l.totalGap, 0);
        // Generate milestones
        const milestones = [];
        let cumulativeMonths = 0;
        for (let idx = 0; idx < pathDetails.levels.length; idx++) {
            const level = pathDetails.levels[idx];
            const analysis = levelAnalysis[idx];
            if (!level || !analysis)
                continue;
            const monthsForLevel = idx <= currentLevelIndex ? 0 : this.estimateMonthsToLevel(analysis);
            cumulativeMonths += monthsForLevel;
            milestones.push({
                level_id: level.id,
                level_title: level.title,
                level_order: level.level_order,
                months_to_reach: cumulativeMonths,
                skills_to_develop: analysis.gaps.map((g) => g.skill_name),
                is_current: idx === currentLevelIndex,
                is_target: idx === targetLevelIndex,
            });
        }
        // Get training recommendations for gaps
        const allGaps = relevantAnalysis.flatMap((l) => l.gaps);
        const trainingRecs = await this.getTrainingRecommendationsForGaps(allGaps);
        // Check if target is reachable (within reasonable timeframe)
        const isReachable = cumulativeMonths <= 60; // 5 years max
        // Save simulation
        await this.saveSimulation({
            id: simulationId,
            tenant_id: tenantId,
            employee_id: employeeId,
            target_path_id: targetPathId || primaryPath.id,
            ...(targetLevelId ? { target_level_id: targetLevelId } : {}),
            ...(targetJobId ? { target_job_id: targetJobId } : {}),
            is_reachable: isReachable,
            skill_distance: skillDistance,
            estimated_timeline_months: cumulativeMonths,
            milestones,
            required_trainings: trainingRecs,
            skill_gaps: allGaps,
        });
        return {
            id: simulationId,
            is_reachable: isReachable,
            skill_distance: skillDistance,
            estimated_timeline_months: cumulativeMonths,
            milestones,
            required_trainings: trainingRecs,
            skill_gaps: allGaps,
        };
    }
    // --------------------------------------------------------------------------
    // Get Reachable Roles
    // --------------------------------------------------------------------------
    async getReachableRoles(tenantId, employeeId, maxGapThreshold = 2.0) {
        const employeeSkills = await this.getEmployeeSkills(employeeId);
        const paths = await this.getAllPaths(tenantId, { status: 'active' });
        const reachableRoles = [];
        for (const path of paths) {
            const pathDetails = await this.getPathDetails(tenantId, path.id);
            if (!pathDetails)
                continue;
            const levelAnalysis = [];
            for (const level of pathDetails.levels) {
                const analysis = await this.analyzeLevelFit(level, employeeSkills);
                levelAnalysis.push(analysis);
            }
            // Find current level
            let currentLevelIndex = -1;
            for (let i = 0; i < levelAnalysis.length; i++) {
                const analysis = levelAnalysis[i];
                if (analysis && analysis.meetsRequirements) {
                    currentLevelIndex = i;
                }
                else {
                    break;
                }
            }
            // Calculate cumulative months for each reachable level
            let cumulativeMonths = 0;
            for (let i = currentLevelIndex + 1; i < pathDetails.levels.length; i++) {
                const level = pathDetails.levels[i];
                const analysis = levelAnalysis[i];
                if (!level || !analysis)
                    continue;
                cumulativeMonths += this.estimateMonthsToLevel(analysis);
                // Check if level has target job and is within threshold
                if (level.target_job_id && analysis.totalGap <= maxGapThreshold) {
                    const jobResult = await this.pool.query('SELECT id, title FROM tenant_jobs WHERE id = $1', [level.target_job_id]);
                    if (jobResult.rows.length > 0) {
                        const job = jobResult.rows[0];
                        reachableRoles.push({
                            job: job,
                            path: path,
                            level: level,
                            months_to_reach: cumulativeMonths,
                            gap_score: analysis.totalGap,
                        });
                    }
                }
            }
        }
        // Sort by months to reach
        reachableRoles.sort((a, b) => a.months_to_reach - b.months_to_reach);
        return reachableRoles;
    }
    // --------------------------------------------------------------------------
    // Private Helper Methods
    // --------------------------------------------------------------------------
    async getEmployeeSkills(employeeId) {
        const result = await this.pool.query(`
      SELECT skill_id, composite_score
      FROM employee_skill_profiles
      WHERE employee_id = $1 AND verification_status = 'verified'
    `, [employeeId]);
        const skillMap = new Map();
        for (const row of result.rows) {
            skillMap.set(row.skill_id, parseFloat(row.composite_score) || 0);
        }
        return skillMap;
    }
    async analyzeLevelFit(level, employeeSkills) {
        const gaps = [];
        let totalWeight = 0;
        let coveredWeight = 0;
        let totalGap = 0;
        // Get level skill requirements
        const skillsResult = await this.pool.query(`
      SELECT
        cls.*,
        es.preferred_label_en as skill_name
      FROM career_path_level_skills cls
      JOIN esco_skills es ON es.id = cls.skill_id
      WHERE cls.level_id = $1
    `, [level.id]);
        for (const req of skillsResult.rows) {
            const employeeScore = employeeSkills.get(req.skill_id) || 0;
            const requiredScore = parseFloat(req.min_composite_score) || 0;
            const weight = parseFloat(req.weight) || 1;
            totalWeight += weight;
            if (employeeScore >= requiredScore) {
                coveredWeight += weight;
            }
            else {
                const gap = requiredScore - employeeScore;
                totalGap += gap * weight;
                gaps.push({
                    skill_id: req.skill_id,
                    skill_name: req.skill_name,
                    required_score: requiredScore,
                    current_score: employeeScore,
                    gap: gap,
                    importance: req.importance,
                    is_mandatory: req.is_mandatory,
                    severity: this.classifyGapSeverity(gap, req.importance, req.is_mandatory),
                });
            }
        }
        const skillCoverage = totalWeight > 0 ? coveredWeight / totalWeight : 1;
        const meetsRequirements = gaps.filter((g) => g.is_mandatory).length === 0 && skillCoverage >= 0.7;
        return {
            level,
            meetsRequirements,
            skillCoverage,
            gaps,
            totalGap: totalWeight > 0 ? totalGap / totalWeight : 0,
        };
    }
    classifyGapSeverity(gap, importance, isMandatory) {
        if (gap <= 0)
            return 'none';
        if (isMandatory && gap > 1.5)
            return 'critical';
        if (importance === 'critical' && gap > 1)
            return 'critical';
        if (gap > 2)
            return 'high';
        if (gap > 1)
            return 'medium';
        return 'low';
    }
    calculateOverallFitScore(levelAnalysis) {
        if (levelAnalysis.length === 0)
            return 0;
        let weightedScore = 0;
        let totalWeight = 0;
        for (let i = 0; i < levelAnalysis.length; i++) {
            const analysis = levelAnalysis[i];
            if (!analysis)
                continue;
            const weight = 1 / (i + 1);
            weightedScore += analysis.skillCoverage * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? weightedScore / totalWeight : 0;
    }
    estimateMonthsToLevel(analysis) {
        if (analysis.totalGap === 0)
            return 0;
        // Base: 3 months per point of gap
        let baseMonths = analysis.totalGap * 3;
        // Add extra time for critical gaps
        const criticalGaps = analysis.gaps.filter((g) => g.severity === 'critical').length;
        baseMonths += criticalGaps * 2;
        // Minimum 1 month, maximum 24 months per level
        return Math.min(24, Math.max(1, Math.round(baseMonths)));
    }
    generateRecommendationReason(fitScore) {
        if (fitScore >= 0.8) {
            return 'Excellent match - your skills align well with this career path';
        }
        else if (fitScore >= 0.6) {
            return 'Good potential - some skill development needed to progress';
        }
        else if (fitScore >= 0.4) {
            return 'Moderate fit - significant development required but achievable';
        }
        else {
            return 'Challenging path - consider focusing on foundational skills first';
        }
    }
    async getTrainingRecommendationsForGaps(gaps) {
        const recommendations = [];
        for (const gap of gaps.slice(0, 10)) {
            // Use course_esco_skills joined via esco_skills to find courses for this skill
            const coursesResult = await this.pool.query(`
        SELECT
          c.id,
          c.title,
          c.duration_hours,
          ces.proficiency_level_gained
        FROM courses c
        JOIN course_esco_skills ces ON ces.course_id = c.id
        JOIN esco_skills es ON es.uri = ces.esco_skill_uri
        WHERE es.id = $1
        ORDER BY ces.proficiency_level_gained DESC NULLS LAST
        LIMIT 3
      `, [gap.skill_id]);
            const courses = coursesResult.rows.map((row) => ({
                id: row.id,
                title: row.title,
                duration_hours: row.duration_hours || 8,
                relevance_score: row.proficiency_level_gained ? row.proficiency_level_gained / 5.0 : 0.8,
            }));
            recommendations.push({
                skill_id: gap.skill_id,
                skill_name: gap.skill_name,
                gap: gap.gap,
                courses,
            });
        }
        return recommendations;
    }
    async reconstructRecommendationsFromCache(tenantId, cachedRows) {
        const recommendations = [];
        for (const row of cachedRows) {
            const path = await this.getPathDetails(tenantId, row.path_id);
            if (path) {
                recommendations.push({
                    path: {
                        id: path.id,
                        name: path.name,
                        description: path.description,
                        department: path.department,
                        path_type: path.path_type,
                        is_active: path.is_active,
                        tenant_id: path.tenant_id,
                        levels_count: path.levels.length,
                    },
                    fit_score: row.fit_score,
                    skill_match_score: row.skill_match_score,
                    current_level_id: null,
                    reachable_level_id: null,
                    target_level_id: null,
                    total_skill_gaps: 0,
                    critical_skill_gaps: 0,
                    estimated_months_to_next: 0,
                    estimated_months_to_target: 0,
                    skill_gaps: [],
                    is_primary_recommendation: false,
                    recommendation_reason: row.recommendation_reason,
                });
            }
        }
        return recommendations;
    }
    async saveRecommendation(tenantId, employeeId, recommendation) {
        await this.pool.query(`
      INSERT INTO career_path_recommendations (
        tenant_id, employee_id, path_id,
        fit_score, skill_match_score, composite_score,
        current_level_id, reachable_level_id, target_level_id,
        total_skill_gaps, critical_skill_gaps,
        estimated_months_to_next, estimated_months_to_target,
        development_summary, is_primary_recommendation, recommendation_reason,
        generated_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW() + INTERVAL '7 days')
      ON CONFLICT (employee_id, path_id)
      DO UPDATE SET
        fit_score = EXCLUDED.fit_score,
        skill_match_score = EXCLUDED.skill_match_score,
        composite_score = EXCLUDED.composite_score,
        current_level_id = EXCLUDED.current_level_id,
        reachable_level_id = EXCLUDED.reachable_level_id,
        target_level_id = EXCLUDED.target_level_id,
        total_skill_gaps = EXCLUDED.total_skill_gaps,
        critical_skill_gaps = EXCLUDED.critical_skill_gaps,
        estimated_months_to_next = EXCLUDED.estimated_months_to_next,
        estimated_months_to_target = EXCLUDED.estimated_months_to_target,
        development_summary = EXCLUDED.development_summary,
        is_primary_recommendation = EXCLUDED.is_primary_recommendation,
        recommendation_reason = EXCLUDED.recommendation_reason,
        generated_at = NOW(),
        expires_at = NOW() + INTERVAL '7 days',
        version = career_path_recommendations.version + 1
    `, [
            tenantId,
            employeeId,
            recommendation.path.id,
            recommendation.fit_score,
            recommendation.skill_match_score,
            (recommendation.fit_score + recommendation.skill_match_score) / 2,
            recommendation.current_level_id,
            recommendation.reachable_level_id,
            recommendation.target_level_id,
            recommendation.total_skill_gaps,
            recommendation.critical_skill_gaps,
            recommendation.estimated_months_to_next,
            recommendation.estimated_months_to_target,
            JSON.stringify({ skill_gaps: recommendation.skill_gaps }),
            recommendation.is_primary_recommendation,
            recommendation.recommendation_reason,
        ]);
    }
    async saveSimulation(simulation) {
        await this.pool.query(`
      INSERT INTO career_simulations (
        id, tenant_id, employee_id,
        target_path_id, target_level_id, target_job_id,
        is_reachable, skill_distance, estimated_timeline_months,
        milestone_plan, required_trainings, current_gap_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
            simulation.id,
            simulation.tenant_id,
            simulation.employee_id,
            simulation.target_path_id,
            simulation.target_level_id || null,
            simulation.target_job_id || null,
            simulation.is_reachable,
            simulation.skill_distance,
            simulation.estimated_timeline_months,
            JSON.stringify(simulation.milestones),
            JSON.stringify(simulation.required_trainings),
            JSON.stringify(simulation.skill_gaps),
        ]);
    }
}
export default CareerPathService;
//# sourceMappingURL=career-path.service.js.map