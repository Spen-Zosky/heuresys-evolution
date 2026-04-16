/**
 * Succession Planning Service
 * Sprint 2025-04 - S-ONTO-03-11
 *
 * Skill-based succession planning with candidate identification,
 * readiness scoring, development plans, and risk assessment
 */
import { Pool } from 'pg';
interface SuccessionCandidate {
    employee_id: string;
    employee_name: string;
    current_role: string;
    department: string;
    readiness_score: number;
    readiness_level: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'needs_development';
    skill_match_percentage: number;
    matching_skills: number;
    total_required_skills: number;
    skill_gaps: SkillGap[];
    development_plan: DevelopmentAction[];
    strengths: string[];
    time_to_ready_months: number;
}
interface SkillGap {
    skill_id: string;
    skill_name: string;
    required_level: number;
    current_level: number;
    gap: number;
    importance: string;
}
interface DevelopmentAction {
    action_type: 'training' | 'mentoring' | 'project' | 'job_rotation' | 'certification';
    skill_name: string;
    description: string;
    estimated_duration_weeks: number;
    priority: 'high' | 'medium' | 'low';
    recommended_courses?: Array<{
        course_id: string;
        course_title: string;
        duration_hours: number;
    }>;
}
interface RoleRiskAssessment {
    role_id: string;
    role_name: string;
    current_incumbent_id?: string;
    current_incumbent_name?: string;
    risk_level: 'critical' | 'high' | 'medium' | 'low';
    risk_factors: string[];
    succession_readiness: 'strong' | 'adequate' | 'weak' | 'none';
    ready_now_candidates: number;
    ready_1_year_candidates: number;
    ready_2_years_candidates: number;
    bench_strength: number;
    recommended_actions: string[];
}
interface SuccessionPlanResult {
    role: {
        id: string;
        title: string;
        department?: string;
        required_skills: number;
    };
    risk_assessment: RoleRiskAssessment;
    candidates: SuccessionCandidate[];
    summary: {
        total_candidates_evaluated: number;
        qualified_candidates: number;
        average_readiness_score: number;
        average_skill_match: number;
        coverage_ratio: number;
    };
}
export declare class SuccessionPlanningService {
    private pool;
    constructor(pool: Pool);
    getSuccessionPlan(tenantId: string, roleId: string, options?: {
        min_skill_match?: number;
        max_candidates?: number;
        include_development_plans?: boolean;
        org_unit_id?: string;
    }): Promise<SuccessionPlanResult>;
    private findCandidates;
    private calculateReadinessScore;
    private determineReadinessLevel;
    private estimateTimeToReady;
    private generateDevelopmentPlan;
    private assessRoleRisk;
}
export default SuccessionPlanningService;
//# sourceMappingURL=succession-planning.service.d.ts.map