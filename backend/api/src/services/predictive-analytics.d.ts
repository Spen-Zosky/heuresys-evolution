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
export type ModelType = 'turnover_risk' | 'performance_prediction' | 'engagement_score' | 'skill_gap' | 'succession_readiness';
export type ModelStatus = 'active' | 'training' | 'deprecated' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface ModelConfig {
    features: string[];
    weights?: Record<string, number>;
    thresholds?: {
        low: number;
        medium: number;
        high: number;
        critical?: number;
    };
    parameters?: Record<string, any>;
}
export interface PredictionResult {
    score: number;
    risk_level: RiskLevel;
    confidence: number;
    factors: {
        name: string;
        impact: number;
        value: any;
        description: string;
    }[];
    recommendations?: string[];
}
export interface TurnoverRiskFactors {
    tenure_months: number;
    performance_trend: number;
    recent_rating: number;
    salary_band_position: number;
    promotion_wait_months: number;
    manager_tenure_months: number;
    team_turnover_rate: number;
    engagement_score: number;
    training_hours_ytd: number;
    check_in_frequency: number;
}
export interface PerformanceFactors {
    historical_ratings: number[];
    goal_completion_rate: number;
    skills_growth: number;
    training_completion: number;
    feedback_sentiment: number;
    check_in_quality: number;
    peer_ratings: number;
    tenure_months: number;
}
export declare class PredictiveAnalyticsService {
    /**
     * Register a new model
     */
    registerModel(tenantId: string, input: {
        name: string;
        type: ModelType;
        version: string;
        description?: string;
        config: ModelConfig;
        created_by: string;
    }): Promise<Record<string, any>>;
    /**
     * Get active model for a type
     */
    getActiveModel(tenantId: string, type: ModelType): Promise<Record<string, any>>;
    /**
     * List models
     */
    listModels(tenantId: string, options?: {
        type?: ModelType;
        status?: ModelStatus;
    }): Promise<Record<string, any>[]>;
    /**
     * Update model status
     */
    updateModelStatus(tenantId: string, modelId: string, status: ModelStatus): Promise<Record<string, any>>;
    /**
     * Calculate turnover risk for an employee
     */
    calculateTurnoverRisk(tenantId: string, employeeId: string): Promise<PredictionResult>;
    /**
     * Gather turnover risk factors for an employee
     */
    private gatherTurnoverFactors;
    /**
     * Get default turnover model config
     */
    private getDefaultTurnoverConfig;
    /**
     * Calculate turnover risk score
     */
    private calculateTurnoverScore;
    /**
     * Get risk level from score
     */
    private getRiskLevel;
    /**
     * Analyze contributing factors
     */
    private analyzeTurnoverFactors;
    /**
     * Generate recommendations
     */
    private generateTurnoverRecommendations;
    /**
     * Calculate prediction confidence
     */
    private calculateConfidence;
    /**
     * Store turnover risk prediction
     */
    private storeTurnoverRisk;
    /**
     * Predict next performance rating
     */
    predictPerformance(tenantId: string, employeeId: string): Promise<PredictionResult>;
    /**
     * Gather performance prediction factors
     */
    private gatherPerformanceFactors;
    /**
     * Calculate predicted performance rating
     */
    private calculatePredictedRating;
    /**
     * Analyze performance factors
     */
    private analyzePerformanceFactors;
    /**
     * Generate performance recommendations
     */
    private generatePerformanceRecommendations;
    /**
     * Calculate performance confidence
     */
    private calculatePerformanceConfidence;
    /**
     * Store performance prediction
     */
    private storePerformancePrediction;
    /**
     * Calculate turnover risk for all employees
     */
    batchCalculateTurnoverRisk(tenantId: string): Promise<{
        processed: number;
        errors: number;
    }>;
    /**
     * Get high-risk employees
     */
    getHighRiskEmployees(tenantId: string, options?: {
        risk_level?: RiskLevel;
        limit?: number;
    }): Promise<Record<string, any>[]>;
    /**
     * Get prediction summary
     */
    getPredictionSummary(tenantId: string): Promise<Record<string, any>>;
}
export declare const predictiveAnalyticsService: PredictiveAnalyticsService;
//# sourceMappingURL=predictive-analytics.d.ts.map