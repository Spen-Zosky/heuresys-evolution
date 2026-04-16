/**
 * Predictive Analytics Service
 * Epic 7 - Story 7.6: Predictive Analytics Models
 *
 * Features:
 * - Turnover risk prediction
 * - Performance prediction
 * - Model management
 * - Prediction history
 * - Risk scoring and alerts
 */
import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
// ============================================================================
// Predictive Analytics Service
// ============================================================================
export class PredictiveAnalyticsService {
    // ==========================================================================
    // Model Management
    // ==========================================================================
    /**
     * Register a new model
     */
    async registerModel(tenantId, input) {
        const id = uuidv4();
        const query = `
      INSERT INTO predictive_models (
        id, tenant_id, name, type, version, description, config, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      RETURNING *
    `;
        const values = [
            id,
            tenantId,
            input.name,
            input.type,
            input.version,
            input.description || null,
            JSON.stringify(input.config),
            input.created_by,
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }
    /**
     * Get active model for a type
     */
    async getActiveModel(tenantId, type) {
        const result = await pool.query(`
      SELECT * FROM predictive_models
      WHERE tenant_id = $1 AND model_type = $2 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `, [tenantId, type]);
        return result.rows[0] || null;
    }
    /**
     * List models
     */
    async listModels(tenantId, options) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (options?.type) {
            conditions.push(`model_type = $${paramIndex++}`);
            params.push(options.type);
        }
        if (options?.status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(options.status);
        }
        const result = await pool.query(`
      SELECT * FROM predictive_models
      WHERE ${conditions.join(' AND ')}
      ORDER BY model_type, created_at DESC
    `, params);
        return result.rows;
    }
    /**
     * Update model status
     */
    async updateModelStatus(tenantId, modelId, status) {
        const result = await pool.query(`
      UPDATE predictive_models SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `, [status, modelId, tenantId]);
        return result.rows[0] || null;
    }
    // ==========================================================================
    // Turnover Risk Prediction
    // ==========================================================================
    /**
     * Calculate turnover risk for an employee
     */
    async calculateTurnoverRisk(tenantId, employeeId) {
        // Gather factors
        const factors = await this.gatherTurnoverFactors(tenantId, employeeId);
        // Get model config or use defaults
        const model = await this.getActiveModel(tenantId, 'turnover_risk');
        const config = model?.config || this.getDefaultTurnoverConfig();
        // Calculate score
        const score = this.calculateTurnoverScore(factors, config);
        // Determine risk level
        const riskLevel = this.getRiskLevel(score, config.thresholds);
        // Analyze contributing factors
        const analyzedFactors = this.analyzeTurnoverFactors(factors, config);
        // Generate recommendations
        const recommendations = this.generateTurnoverRecommendations(riskLevel, analyzedFactors);
        const result = {
            score,
            risk_level: riskLevel,
            confidence: this.calculateConfidence(factors),
            factors: analyzedFactors,
            recommendations,
        };
        // Store prediction
        await this.storeTurnoverRisk(tenantId, employeeId, result);
        return result;
    }
    /**
     * Gather turnover risk factors for an employee
     */
    async gatherTurnoverFactors(tenantId, employeeId) {
        // Employee base data
        const empResult = await pool.query(`
      SELECT
        e.hire_date,
        e.manager_id,
        e.org_unit_id,
        e.salary
      FROM employees e
      WHERE e.id = $1 AND e.tenant_id = $2
    `, [employeeId, tenantId]);
        const emp = empResult.rows[0];
        if (!emp) {
            throw new Error('Employee not found');
        }
        // Calculate tenure
        const hireDate = new Date(emp.hire_date);
        const tenureMonths = Math.floor((Date.now() - hireDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        // Promotion wait (simplified - using hire date as fallback)
        const promotionWaitMonths = tenureMonths;
        // Salary band position (simplified - use 0.5 as default)
        const salaryBandPosition = 0.5;
        // Recent performance
        const perfResult = await pool.query(`
      SELECT overall_rating, created_at
      FROM performance_reviews
      WHERE employee_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 3
    `, [employeeId, tenantId]);
        const ratings = perfResult.rows.map((r) => parseFloat(r.overall_rating) || 3);
        const recentRating = ratings[0] ?? 3;
        const performanceTrend = ratings.length >= 2
            ? ((ratings[0] ?? 3) - (ratings[ratings.length - 1] ?? 3)) / ratings.length
            : 0;
        // Manager tenure
        let managerTenureMonths = 0;
        if (emp.manager_id) {
            const mgrResult = await pool.query(`
        SELECT hire_date FROM employees WHERE id = $1 AND tenant_id = $2
      `, [emp.manager_id, tenantId]);
            if (mgrResult.rows[0]) {
                const mgrHire = new Date(mgrResult.rows[0].hire_date);
                managerTenureMonths = Math.floor((Date.now() - mgrHire.getTime()) / (30 * 24 * 60 * 60 * 1000));
            }
        }
        // Team turnover rate (last 12 months)
        const turnoverResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE termination_date > NOW() - INTERVAL '12 months') as terminated,
        COUNT(*) as total
      FROM employees
      WHERE org_unit_id = $1 AND tenant_id = $2
    `, [emp.org_unit_id, tenantId]);
        const teamTurnoverRate = turnoverResult.rows[0].total > 0
            ? parseInt(turnoverResult.rows[0].terminated) / parseInt(turnoverResult.rows[0].total)
            : 0;
        // Engagement (from surveys/wellbeing)
        const engagementResult = await pool.query(`
      SELECT AVG(overall_score) as score
      FROM wellbeing_assessments
      WHERE employee_id = $1 AND tenant_id = $2 AND created_at > NOW() - INTERVAL '6 months'
    `, [employeeId, tenantId]);
        const engagementScore = parseFloat(engagementResult.rows[0]?.score) || 3;
        // Training hours
        const trainingResult = await pool.query(`
      SELECT COALESCE(SUM(c.duration_hours), 0) as hours
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      WHERE ce.employee_id = $1 AND c.tenant_id = $2
        AND ce.status = 'completed'
        AND EXTRACT(YEAR FROM ce.completed_at) = EXTRACT(YEAR FROM NOW())
    `, [employeeId, tenantId]);
        const trainingHoursYtd = parseFloat(trainingResult.rows[0]?.hours) || 0;
        // Check-in frequency (monthly average)
        const checkInResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM check_ins
      WHERE employee_id = $1 AND tenant_id = $2 AND scheduled_date > NOW() - INTERVAL '3 months'
    `, [employeeId, tenantId]);
        const checkInFrequency = parseInt(checkInResult.rows[0]?.count) / 3 || 0;
        return {
            tenure_months: tenureMonths,
            performance_trend: performanceTrend,
            recent_rating: recentRating,
            salary_band_position: salaryBandPosition,
            promotion_wait_months: promotionWaitMonths,
            manager_tenure_months: managerTenureMonths,
            team_turnover_rate: teamTurnoverRate,
            engagement_score: engagementScore,
            training_hours_ytd: trainingHoursYtd,
            check_in_frequency: checkInFrequency,
        };
    }
    /**
     * Get default turnover model config
     */
    getDefaultTurnoverConfig() {
        return {
            features: [
                'tenure_months',
                'performance_trend',
                'recent_rating',
                'salary_band_position',
                'promotion_wait_months',
                'team_turnover_rate',
                'engagement_score',
                'training_hours_ytd',
                'check_in_frequency',
            ],
            weights: {
                tenure_months: 0.1,
                performance_trend: 0.15,
                recent_rating: 0.1,
                salary_band_position: 0.15,
                promotion_wait_months: 0.15,
                team_turnover_rate: 0.1,
                engagement_score: 0.15,
                training_hours_ytd: 0.05,
                check_in_frequency: 0.05,
            },
            thresholds: {
                low: 0.3,
                medium: 0.5,
                high: 0.7,
                critical: 0.85,
            },
        };
    }
    /**
     * Calculate turnover risk score
     */
    calculateTurnoverScore(factors, config) {
        const weights = config.weights || {};
        let totalWeight = 0;
        let weightedScore = 0;
        // Tenure risk (higher for 1-2 years, lower for <1 and >5)
        if (factors.tenure_months >= 12 && factors.tenure_months <= 24) {
            weightedScore += (weights.tenure_months || 0.1) * 0.8;
        }
        else if (factors.tenure_months < 6) {
            weightedScore += (weights.tenure_months || 0.1) * 0.3;
        }
        else if (factors.tenure_months > 60) {
            weightedScore += (weights.tenure_months || 0.1) * 0.2;
        }
        else {
            weightedScore += (weights.tenure_months || 0.1) * 0.5;
        }
        totalWeight += weights.tenure_months || 0.1;
        // Performance trend (negative trend = higher risk)
        const trendRisk = 0.5 - factors.performance_trend * 0.5;
        weightedScore += (weights.performance_trend || 0.15) * Math.min(1, Math.max(0, trendRisk));
        totalWeight += weights.performance_trend || 0.15;
        // Recent rating (low rating = higher risk)
        const ratingRisk = 1 - (factors.recent_rating - 1) / 4;
        weightedScore += (weights.recent_rating || 0.1) * ratingRisk;
        totalWeight += weights.recent_rating || 0.1;
        // Salary band position (low position = higher risk)
        const salaryRisk = 1 - factors.salary_band_position;
        weightedScore += (weights.salary_band_position || 0.15) * salaryRisk;
        totalWeight += weights.salary_band_position || 0.15;
        // Promotion wait (longer wait = higher risk)
        const promoRisk = Math.min(1, factors.promotion_wait_months / 36);
        weightedScore += (weights.promotion_wait_months || 0.15) * promoRisk;
        totalWeight += weights.promotion_wait_months || 0.15;
        // Team turnover (higher = higher risk)
        weightedScore +=
            (weights.team_turnover_rate || 0.1) * Math.min(1, factors.team_turnover_rate * 2);
        totalWeight += weights.team_turnover_rate || 0.1;
        // Engagement (lower = higher risk)
        const engagementRisk = 1 - (factors.engagement_score - 1) / 4;
        weightedScore += (weights.engagement_score || 0.15) * engagementRisk;
        totalWeight += weights.engagement_score || 0.15;
        // Training (lower = slightly higher risk)
        const trainingRisk = 1 - Math.min(1, factors.training_hours_ytd / 40);
        weightedScore += (weights.training_hours_ytd || 0.05) * trainingRisk;
        totalWeight += weights.training_hours_ytd || 0.05;
        // Check-in frequency (lower = higher risk)
        const checkInRisk = 1 - Math.min(1, factors.check_in_frequency / 2);
        weightedScore += (weights.check_in_frequency || 0.05) * checkInRisk;
        totalWeight += weights.check_in_frequency || 0.05;
        return totalWeight > 0 ? weightedScore / totalWeight : 0.5;
    }
    /**
     * Get risk level from score
     */
    getRiskLevel(score, thresholds) {
        const t = thresholds || { low: 0.3, medium: 0.5, high: 0.7, critical: 0.85 };
        if (score >= (t.critical || 0.85))
            return 'critical';
        if (score >= t.high)
            return 'high';
        if (score >= t.medium)
            return 'medium';
        return 'low';
    }
    /**
     * Analyze contributing factors
     */
    analyzeTurnoverFactors(factors, _config) {
        const analyzed = [];
        if (factors.promotion_wait_months > 24) {
            analyzed.push({
                name: 'Promotion Wait Time',
                impact: 0.8,
                value: factors.promotion_wait_months,
                description: `No promotion in ${factors.promotion_wait_months} months`,
            });
        }
        if (factors.salary_band_position < 0.3) {
            analyzed.push({
                name: 'Salary Position',
                impact: 0.7,
                value: `${Math.round(factors.salary_band_position * 100)}%`,
                description: 'Salary below midpoint of band',
            });
        }
        if (factors.performance_trend < -0.2) {
            analyzed.push({
                name: 'Performance Trend',
                impact: 0.6,
                value: factors.performance_trend.toFixed(2),
                description: 'Declining performance ratings',
            });
        }
        if (factors.engagement_score < 3) {
            analyzed.push({
                name: 'Engagement Score',
                impact: 0.7,
                value: factors.engagement_score.toFixed(1),
                description: 'Below average engagement',
            });
        }
        if (factors.team_turnover_rate > 0.15) {
            analyzed.push({
                name: 'Team Turnover',
                impact: 0.5,
                value: `${Math.round(factors.team_turnover_rate * 100)}%`,
                description: 'High turnover in team',
            });
        }
        if (factors.check_in_frequency < 1) {
            analyzed.push({
                name: 'Check-in Frequency',
                impact: 0.4,
                value: factors.check_in_frequency.toFixed(1),
                description: 'Infrequent manager check-ins',
            });
        }
        // Sort by impact
        return analyzed.sort((a, b) => b.impact - a.impact);
    }
    /**
     * Generate recommendations
     */
    generateTurnoverRecommendations(riskLevel, factors) {
        const recommendations = [];
        if (riskLevel === 'critical' || riskLevel === 'high') {
            recommendations.push('Schedule immediate stay interview with direct manager');
        }
        const factorNames = factors.map((f) => f.name);
        if (factorNames.includes('Promotion Wait Time')) {
            recommendations.push('Review career progression opportunities and discuss development plan');
        }
        if (factorNames.includes('Salary Position')) {
            recommendations.push('Consider salary adjustment or compensation review');
        }
        if (factorNames.includes('Engagement Score')) {
            recommendations.push('Conduct one-on-one to understand engagement concerns');
        }
        if (factorNames.includes('Check-in Frequency')) {
            recommendations.push('Increase frequency of manager-employee check-ins');
        }
        if (factorNames.includes('Team Turnover')) {
            recommendations.push('Address team dynamics and workload distribution');
        }
        if (recommendations.length === 0) {
            recommendations.push('Continue monitoring and maintain regular communication');
        }
        return recommendations;
    }
    /**
     * Calculate prediction confidence
     */
    calculateConfidence(factors) {
        // Base confidence on data completeness
        let dataPoints = 0;
        let availablePoints = 0;
        if (factors.tenure_months > 0) {
            dataPoints++;
            availablePoints++;
        }
        if (factors.recent_rating !== 3) {
            dataPoints++;
        }
        availablePoints++;
        if (factors.engagement_score !== 3) {
            dataPoints++;
        }
        availablePoints++;
        if (factors.training_hours_ytd > 0) {
            dataPoints++;
        }
        availablePoints++;
        if (factors.check_in_frequency > 0) {
            dataPoints++;
        }
        availablePoints++;
        return Math.min(0.95, Math.max(0.5, dataPoints / availablePoints));
    }
    /**
     * Store turnover risk prediction
     */
    async storeTurnoverRisk(tenantId, employeeId, result) {
        await pool.query(`
      INSERT INTO turnover_risk_scores (
        id, tenant_id, employee_id, risk_score, risk_level, factors, recommendations, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (tenant_id, employee_id)
      DO UPDATE SET
        risk_score = $4,
        risk_level = $5,
        factors = $6,
        recommendations = $7,
        calculated_at = NOW()
    `, [
            uuidv4(),
            tenantId,
            employeeId,
            result.score,
            result.risk_level,
            JSON.stringify(result.factors),
            JSON.stringify(result.recommendations),
        ]);
    }
    // ==========================================================================
    // Performance Prediction
    // ==========================================================================
    /**
     * Predict next performance rating
     */
    async predictPerformance(tenantId, employeeId) {
        // Gather factors
        const factors = await this.gatherPerformanceFactors(tenantId, employeeId);
        // Calculate predicted rating
        const predictedRating = this.calculatePredictedRating(factors);
        // Determine level
        const riskLevel = predictedRating >= 4 ? 'low' : predictedRating >= 3 ? 'medium' : 'high';
        // Analyze factors
        const analyzedFactors = this.analyzePerformanceFactors(factors);
        // Generate recommendations
        const recommendations = this.generatePerformanceRecommendations(predictedRating, analyzedFactors);
        const result = {
            score: predictedRating,
            risk_level: riskLevel,
            confidence: this.calculatePerformanceConfidence(factors),
            factors: analyzedFactors,
            recommendations,
        };
        // Store prediction
        await this.storePerformancePrediction(tenantId, employeeId, result);
        return result;
    }
    /**
     * Gather performance prediction factors
     */
    async gatherPerformanceFactors(tenantId, employeeId) {
        // Historical ratings
        const ratingsResult = await pool.query(`
      SELECT overall_rating FROM performance_reviews
      WHERE employee_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 5
    `, [employeeId, tenantId]);
        const historicalRatings = ratingsResult.rows.map((r) => parseFloat(r.overall_rating) || 3);
        // Goal completion
        const goalsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
      FROM goals
      WHERE employee_id = $1 AND tenant_id = $2
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    `, [employeeId, tenantId]);
        const goalCompletionRate = goalsResult.rows[0].total > 0
            ? parseInt(goalsResult.rows[0].completed) / parseInt(goalsResult.rows[0].total)
            : 0.5;
        // Training completion
        const trainingResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE ce.status = 'completed') as completed,
        COUNT(*) as total
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      WHERE ce.employee_id = $1 AND c.tenant_id = $2
        AND EXTRACT(YEAR FROM ce.enrolled_at) = EXTRACT(YEAR FROM NOW())
    `, [employeeId, tenantId]);
        const trainingCompletion = trainingResult.rows[0].total > 0
            ? parseInt(trainingResult.rows[0].completed) / parseInt(trainingResult.rows[0].total)
            : 0.5;
        // Skills growth
        const skillsResult = await pool.query(`
      SELECT AVG(proficiency_level) as avg_level
      FROM employee_skills
      WHERE employee_id = $1 AND tenant_id = $2
    `, [employeeId, tenantId]);
        const skillsGrowth = parseFloat(skillsResult.rows[0]?.avg_level) / 5 || 0.5;
        // Feedback sentiment (simplified)
        const feedbackResult = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE rating >= 4) as positive, COUNT(*) as total
      FROM feedback
      WHERE receiver_id = $1 AND tenant_id = $2 AND created_at > NOW() - INTERVAL '6 months'
    `, [employeeId, tenantId]);
        const feedbackSentiment = feedbackResult.rows[0].total > 0
            ? parseInt(feedbackResult.rows[0].positive) / parseInt(feedbackResult.rows[0].total)
            : 0.5;
        // Check-in quality (use status as proxy)
        const checkInResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
      FROM check_ins
      WHERE employee_id = $1 AND tenant_id = $2 AND scheduled_date > NOW() - INTERVAL '3 months'
    `, [employeeId, tenantId]);
        const checkInQuality = checkInResult.rows[0].total > 0
            ? parseInt(checkInResult.rows[0].completed) / parseInt(checkInResult.rows[0].total)
            : 0.5;
        // Tenure
        const tenureResult = await pool.query(`
      SELECT hire_date FROM employees WHERE id = $1 AND tenant_id = $2
    `, [employeeId, tenantId]);
        const hireDate = new Date(tenureResult.rows[0]?.hire_date || Date.now());
        const tenureMonths = Math.floor((Date.now() - hireDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        return {
            historical_ratings: historicalRatings,
            goal_completion_rate: goalCompletionRate,
            skills_growth: skillsGrowth,
            training_completion: trainingCompletion,
            feedback_sentiment: feedbackSentiment,
            check_in_quality: checkInQuality,
            peer_ratings: feedbackSentiment, // Using feedback as proxy
            tenure_months: tenureMonths,
        };
    }
    /**
     * Calculate predicted performance rating
     */
    calculatePredictedRating(factors) {
        const weights = {
            historical: 0.35,
            goals: 0.2,
            training: 0.1,
            skills: 0.1,
            feedback: 0.15,
            checkIns: 0.1,
        };
        // Historical average (most important)
        const avgHistorical = factors.historical_ratings.length > 0
            ? factors.historical_ratings.reduce((a, b) => a + b, 0) / factors.historical_ratings.length
            : 3;
        // Calculate weighted prediction
        const prediction = avgHistorical * weights.historical +
            factors.goal_completion_rate * 5 * weights.goals +
            factors.training_completion * 5 * weights.training +
            factors.skills_growth * 5 * weights.skills +
            factors.feedback_sentiment * 5 * weights.feedback +
            factors.check_in_quality * 5 * weights.checkIns;
        return Math.min(5, Math.max(1, prediction));
    }
    /**
     * Analyze performance factors
     */
    analyzePerformanceFactors(factors) {
        const analyzed = [];
        if (factors.goal_completion_rate > 0.8) {
            analyzed.push({
                name: 'Goal Completion',
                impact: 0.8,
                value: `${Math.round(factors.goal_completion_rate * 100)}%`,
                description: 'Excellent goal achievement',
            });
        }
        else if (factors.goal_completion_rate < 0.5) {
            analyzed.push({
                name: 'Goal Completion',
                impact: -0.6,
                value: `${Math.round(factors.goal_completion_rate * 100)}%`,
                description: 'Below target goal completion',
            });
        }
        if (factors.training_completion > 0.8) {
            analyzed.push({
                name: 'Training Completion',
                impact: 0.5,
                value: `${Math.round(factors.training_completion * 100)}%`,
                description: 'Strong commitment to learning',
            });
        }
        if (factors.feedback_sentiment > 0.7) {
            analyzed.push({
                name: 'Peer Feedback',
                impact: 0.6,
                value: `${Math.round(factors.feedback_sentiment * 100)}%`,
                description: 'Positive peer feedback',
            });
        }
        // Historical trend
        if (factors.historical_ratings.length >= 2) {
            const trend = (factors.historical_ratings[0] ?? 0) -
                (factors.historical_ratings[factors.historical_ratings.length - 1] ?? 0);
            if (trend > 0.3) {
                analyzed.push({
                    name: 'Performance Trend',
                    impact: 0.7,
                    value: `+${trend.toFixed(1)}`,
                    description: 'Improving performance trajectory',
                });
            }
            else if (trend < -0.3) {
                analyzed.push({
                    name: 'Performance Trend',
                    impact: -0.7,
                    value: trend.toFixed(1),
                    description: 'Declining performance trajectory',
                });
            }
        }
        return analyzed.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    }
    /**
     * Generate performance recommendations
     */
    generatePerformanceRecommendations(predictedRating, factors) {
        const recommendations = [];
        if (predictedRating < 3) {
            recommendations.push('Schedule performance improvement discussion');
            recommendations.push('Create detailed development plan with specific milestones');
        }
        const lowFactors = factors.filter((f) => f.impact < 0);
        for (const factor of lowFactors) {
            if (factor.name === 'Goal Completion') {
                recommendations.push('Review and adjust goal targets for achievability');
            }
            if (factor.name === 'Performance Trend') {
                recommendations.push('Investigate root causes of performance decline');
            }
        }
        if (predictedRating >= 4) {
            recommendations.push('Consider for high-potential development program');
            recommendations.push('Discuss career advancement opportunities');
        }
        return recommendations;
    }
    /**
     * Calculate performance confidence
     */
    calculatePerformanceConfidence(factors) {
        const historicalCount = factors.historical_ratings.length;
        return Math.min(0.95, 0.5 + historicalCount * 0.1);
    }
    /**
     * Store performance prediction
     */
    async storePerformancePrediction(tenantId, employeeId, result) {
        await pool.query(`
      INSERT INTO performance_predictions (
        id, tenant_id, employee_id, predicted_rating, confidence, factors, recommendations, predicted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
            uuidv4(),
            tenantId,
            employeeId,
            result.score,
            result.confidence,
            JSON.stringify(result.factors),
            JSON.stringify(result.recommendations),
        ]);
    }
    // ==========================================================================
    // Batch Predictions
    // ==========================================================================
    /**
     * Calculate turnover risk for all employees
     */
    async batchCalculateTurnoverRisk(tenantId) {
        const employeesResult = await pool.query(`
      SELECT id FROM employees
      WHERE tenant_id = $1 AND status = 'active'
    `, [tenantId]);
        let processed = 0;
        let errors = 0;
        for (const emp of employeesResult.rows) {
            try {
                await this.calculateTurnoverRisk(tenantId, emp.id);
                processed++;
            }
            catch (error) {
                logger.error(`Failed to calculate turnover risk for ${emp.id}:${error}`);
                errors++;
            }
        }
        return { processed, errors };
    }
    /**
     * Get high-risk employees
     */
    async getHighRiskEmployees(tenantId, options) {
        const conditions = ['trs.tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (options?.risk_level) {
            conditions.push(`trs.risk_level = $${paramIndex++}`);
            params.push(options.risk_level);
        }
        else {
            conditions.push(`trs.risk_level IN ('high', 'critical')`);
        }
        const limit = options?.limit || 50;
        const result = await pool.query(`
      SELECT
        trs.*,
        e.first_name,
        e.last_name,
        e.email,
        d.name as department_name
      FROM turnover_risk_scores trs
      JOIN employees e ON trs.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY trs.risk_score DESC
      LIMIT $${paramIndex}
    `, [...params, limit]);
        return result.rows;
    }
    /**
     * Get prediction summary
     */
    async getPredictionSummary(tenantId) {
        const turnoverResult = await pool.query(`
      SELECT
        risk_level,
        COUNT(*) as count
      FROM turnover_risk_scores
      WHERE tenant_id = $1
      GROUP BY risk_level
    `, [tenantId]);
        const performanceResult = await pool.query(`
      SELECT
        CASE
          WHEN predicted_rating >= 4 THEN 'high'
          WHEN predicted_rating >= 3 THEN 'medium'
          ELSE 'low'
        END as performance_level,
        COUNT(*) as count
      FROM performance_predictions
      WHERE tenant_id = $1
      GROUP BY performance_level
    `, [tenantId]);
        return {
            turnover_risk: turnoverResult.rows,
            performance_predictions: performanceResult.rows,
            generated_at: new Date().toISOString(),
        };
    }
}
// Export singleton instance
export const predictiveAnalyticsService = new PredictiveAnalyticsService();
//# sourceMappingURL=predictive-analytics.js.map