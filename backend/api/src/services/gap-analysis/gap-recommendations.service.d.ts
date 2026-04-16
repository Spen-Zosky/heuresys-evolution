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
import { GapAnalysisResult } from './gap-analysis.service.js';
export type RecommendationType = 'training' | 'mentoring' | 'assignment' | 'self_study' | 'certification';
export interface Recommendation {
    id: string;
    type: RecommendationType;
    priority: 'critical' | 'high' | 'medium' | 'low';
    skillId: string;
    skillName: string;
    gapSeverity: string;
    title: string;
    description: string;
    resourceType?: 'course' | 'employee' | 'role' | 'external' | undefined;
    resourceId?: string | undefined;
    resourceName?: string | undefined;
    resourceUrl?: string | undefined;
    estimatedHours?: number;
    estimatedDays?: number;
    estimatedWeeks?: number;
    effortLevel: 'minimal' | 'moderate' | 'significant' | 'major';
    expectedGapReduction: number;
    expectedLevelGain: number;
    confidence: number;
    rationale: string;
}
export interface RecommendationsResult {
    analysisId: string;
    targetId: string;
    targetName: string;
    generatedAt: Date;
    totalRecommendations: number;
    byPriority: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    byType: {
        training: number;
        mentoring: number;
        assignment: number;
        self_study: number;
        certification: number;
    };
    totalEstimatedHours: number;
    skillRecommendations: {
        skillId: string;
        skillName: string;
        gapScore: number;
        gapSeverity: string;
        recommendations: Recommendation[];
    }[];
    topRecommendations: Recommendation[];
}
export declare function generateRecommendations(gapAnalysis: GapAnalysisResult, options?: {
    maxPerSkill?: number;
    includeTypes?: RecommendationType[];
    minSeverity?: 'none' | 'low' | 'medium' | 'high' | 'critical';
}): Promise<RecommendationsResult>;
export declare const gapRecommendationsService: {
    generateRecommendations: typeof generateRecommendations;
};
//# sourceMappingURL=gap-recommendations.service.d.ts.map