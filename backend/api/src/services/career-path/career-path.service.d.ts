/**
 * Career Path Engine Service
 * Sprint 2025-04 - S-ONTO-03-07
 *
 * Provides career path recommendations, skill distance calculations,
 * fit scores, and timeline estimations for employee career development.
 */
import { Pool } from 'pg';
interface CareerPath {
    id: string;
    name: string;
    description: string;
    department: string;
    path_type: 'linear' | 'branching' | 'matrix';
    is_active: boolean;
    tenant_id: string;
    levels_count?: number;
}
interface CareerPathLevel {
    id: string;
    path_id: string;
    title: string;
    description: string;
    level_order: number;
    min_years_experience?: number;
    typical_duration_months?: number;
    target_job_id?: string;
}
interface SkillGap {
    skill_id: string;
    skill_name: string;
    required_score: number;
    current_score: number;
    gap: number;
    importance: string;
    is_mandatory: boolean;
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}
interface CareerPathRecommendation {
    path: CareerPath;
    fit_score: number;
    skill_match_score: number;
    current_level_id: string | null;
    reachable_level_id: string | null;
    target_level_id: string | null;
    total_skill_gaps: number;
    critical_skill_gaps: number;
    estimated_months_to_next: number;
    estimated_months_to_target: number;
    skill_gaps: SkillGap[];
    is_primary_recommendation: boolean;
    recommendation_reason: string;
}
interface CareerSimulation {
    id: string;
    is_reachable: boolean;
    skill_distance: number;
    estimated_timeline_months: number;
    milestones: SimulationMilestone[];
    required_trainings: TrainingRecommendation[];
    skill_gaps: SkillGap[];
}
interface SimulationMilestone {
    level_id: string;
    level_title: string;
    level_order: number;
    months_to_reach: number;
    skills_to_develop: string[];
    is_current: boolean;
    is_target: boolean;
}
interface TrainingRecommendation {
    skill_id: string;
    skill_name: string;
    gap: number;
    courses: CourseInfo[];
}
interface CourseInfo {
    id: string;
    title: string;
    duration_hours: number;
    relevance_score: number;
}
interface SimulationParams {
    employeeId: string;
    targetPathId?: string;
    targetLevelId?: string;
    targetJobId?: string;
    simulationName?: string;
}
interface ReachableRole {
    job: {
        id: string;
        title: string;
    };
    path: CareerPath;
    level: CareerPathLevel;
    months_to_reach: number;
    gap_score: number;
}
export declare class CareerPathService {
    private pool;
    constructor(pool: Pool);
    getAllPaths(tenantId: string, options?: {
        pathType?: string;
        status?: string;
        search?: string;
    }): Promise<CareerPath[]>;
    getPathDetails(tenantId: string, pathId: string): Promise<(CareerPath & {
        levels: CareerPathLevel[];
    }) | null>;
    getRecommendationsForEmployee(tenantId: string, employeeId: string, refresh?: boolean): Promise<CareerPathRecommendation[]>;
    calculatePathRecommendation(tenantId: string, employeeId: string, pathId: string): Promise<CareerPathRecommendation | null>;
    simulateCareerPath(tenantId: string, params: SimulationParams): Promise<CareerSimulation>;
    getReachableRoles(tenantId: string, employeeId: string, maxGapThreshold?: number): Promise<ReachableRole[]>;
    private getEmployeeSkills;
    private analyzeLevelFit;
    private classifyGapSeverity;
    private calculateOverallFitScore;
    private estimateMonthsToLevel;
    private generateRecommendationReason;
    private getTrainingRecommendationsForGaps;
    private reconstructRecommendationsFromCache;
    private saveRecommendation;
    private saveSimulation;
}
export default CareerPathService;
//# sourceMappingURL=career-path.service.d.ts.map