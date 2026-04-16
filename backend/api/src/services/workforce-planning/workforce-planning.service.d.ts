/**
 * Workforce Planning Service
 * Sprint 2025-04 - S-ONTO-03-10
 *
 * Workforce planning with future skill projections
 */
import { Pool } from 'pg';
interface SkillInventoryItem {
    skill_id: string;
    skill_name: string;
    employee_count: number;
    avg_proficiency: number;
    proficiency_distribution: {
        level_1: number;
        level_2: number;
        level_3: number;
        level_4: number;
        level_5: number;
    };
    departments: string[];
}
interface FutureRequirement {
    id?: string;
    skill_id?: string;
    skill_name: string;
    required_count: number;
    required_proficiency: number;
    target_date: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    org_unit_id?: string;
    notes?: string;
}
interface GapRiskAssessment {
    skill_name: string;
    current_count: number;
    required_count: number;
    gap_count: number;
    current_avg_proficiency: number;
    required_proficiency: number;
    proficiency_gap: number;
    risk_level: 'critical' | 'high' | 'medium' | 'low';
    risk_factors: string[];
    time_to_target: number;
}
interface HiringRecommendation {
    skill_name: string;
    positions_needed: number;
    min_proficiency: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimated_cost_per_hire: number;
    total_estimated_cost: number;
    market_availability: 'scarce' | 'limited' | 'available' | 'abundant';
    rationale: string;
}
interface TrainingInvestment {
    skill_name: string;
    employees_to_train: number;
    current_avg_level: number;
    target_level: number;
    estimated_training_hours: number;
    estimated_cost: number;
    recommended_courses: Array<{
        course_id: string;
        course_title: string;
        duration_hours: number;
        cost_estimate: number;
    }>;
    time_to_proficiency_weeks: number;
    roi_estimate: number;
}
interface WorkforcePlan {
    plan_id: string;
    tenant_id: string;
    name: string;
    description?: string;
    target_date: string;
    status: 'draft' | 'active' | 'completed' | 'archived';
    requirements: FutureRequirement[];
    gap_analysis: GapRiskAssessment[];
    hiring_recommendations: HiringRecommendation[];
    training_investments: TrainingInvestment[];
    summary: {
        total_skill_gaps: number;
        critical_gaps: number;
        positions_to_hire: number;
        employees_to_train: number;
        total_hiring_cost: number;
        total_training_cost: number;
        total_investment: number;
    };
    created_at: string;
    updated_at: string;
}
export declare class WorkforcePlanningService {
    private pool;
    constructor(pool: Pool);
    getSkillInventory(tenantId: string, options?: {
        org_unit_id?: string;
        skill_ids?: string[];
        min_proficiency?: number;
    }): Promise<SkillInventoryItem[]>;
    computeGapRisk(tenantId: string, requirements: FutureRequirement[]): Promise<GapRiskAssessment[]>;
    generateHiringRecommendations(_tenantId: string, gapAssessments: GapRiskAssessment[]): Promise<HiringRecommendation[]>;
    generateTrainingInvestments(tenantId: string, gapAssessments: GapRiskAssessment[]): Promise<TrainingInvestment[]>;
    createWorkforcePlan(tenantId: string, planData: {
        name: string;
        description?: string;
        target_date: string;
        requirements: FutureRequirement[];
    }): Promise<WorkforcePlan>;
    getWorkforcePlans(tenantId: string, options?: {
        status?: string;
    }): Promise<WorkforcePlan[]>;
    getWorkforcePlanById(tenantId: string, planId: string): Promise<WorkforcePlan | null>;
    updatePlanStatus(tenantId: string, planId: string, status: 'draft' | 'active' | 'completed' | 'archived'): Promise<boolean>;
}
export default WorkforcePlanningService;
//# sourceMappingURL=workforce-planning.service.d.ts.map