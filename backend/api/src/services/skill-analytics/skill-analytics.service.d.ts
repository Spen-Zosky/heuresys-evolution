/**
 * Skill Analytics Service
 * Sprint 2025-04 - S-ONTO-03-09
 *
 * Analytics API for workforce skill insights
 */
import { Pool } from 'pg';
interface SkillCoverageHeatmapCell {
    org_unit_id: string;
    department_name: string;
    skill_id: string;
    skill_name: string;
    employee_count: number;
    avg_proficiency: number;
    coverage_pct: number;
}
interface SkillTrend {
    skill_id: string;
    skill_name: string;
    period: string;
    employee_count: number;
    avg_proficiency: number;
    change_from_previous: number;
}
interface CriticalShortage {
    skill_id: string;
    skill_name: string;
    required_positions: number;
    available_employees: number;
    shortage_count: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    departments_affected: string[];
}
interface KSABADistribution {
    dimension: 'knowledge' | 'skill' | 'ability' | 'behavior' | 'attitude';
    count: number;
    avg_level: number;
    employees_with_data: number;
}
interface EmergingSkill {
    skill_name: string;
    first_seen: string;
    extraction_count: number;
    employees_with_skill: number;
    source_types: string[];
    growth_rate: number;
}
interface DepartmentComparison {
    org_unit_id: string;
    department_name: string;
    total_skills: number;
    avg_proficiency: number;
    skill_coverage_pct: number;
    top_skills: Array<{
        skill_name: string;
        count: number;
    }>;
    gap_count: number;
}
export declare class SkillAnalyticsService {
    private pool;
    constructor(pool: Pool);
    getSkillCoverageHeatmap(tenantId: string, options?: {
        org_unit_ids?: string[];
        skill_ids?: string[];
        min_proficiency?: number;
    }): Promise<SkillCoverageHeatmapCell[]>;
    getSkillTrends(tenantId: string, options?: {
        skill_ids?: string[];
        period: 'monthly' | 'quarterly' | 'yearly';
        lookback_periods?: number;
    }): Promise<SkillTrend[]>;
    getCriticalShortages(tenantId: string, options?: {
        org_unit_id?: string;
        min_shortage?: number;
    }): Promise<CriticalShortage[]>;
    getKSABADistribution(tenantId: string, options?: {
        org_unit_id?: string;
        employee_id?: string;
    }): Promise<KSABADistribution[]>;
    getEmergingSkills(tenantId: string, options?: {
        lookback_days?: number;
        min_occurrences?: number;
        limit?: number;
    }): Promise<EmergingSkill[]>;
    getDepartmentComparison(tenantId: string, options?: {
        org_unit_ids?: string[];
    }): Promise<DepartmentComparison[]>;
    getSummaryStats(tenantId: string): Promise<{
        total_employees: number;
        employees_with_profiles: number;
        total_skills_tracked: number;
        avg_proficiency: number;
        critical_shortages: number;
        departments: number;
    }>;
}
export default SkillAnalyticsService;
//# sourceMappingURL=skill-analytics.service.d.ts.map