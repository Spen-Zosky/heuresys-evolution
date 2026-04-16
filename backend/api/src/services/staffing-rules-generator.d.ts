/**
 * Staffing Rules Generator Service
 * Calculates optimal staffing, retrieves industry benchmarks, and validates ratios
 * Part of Tenant Prototype Generator System
 */
import { CompanySize } from './industry-prototype.js';
export interface StaffingRule {
    id?: string;
    prototypeId: string;
    orgUnitTemplateId: string;
    jobTemplateId: string;
    companySize: CompanySize;
    minHeadcount: number;
    maxHeadcount?: number;
    recommendedHeadcount?: number;
    isMandatory: boolean;
    rationale?: string;
}
export interface IndustryBenchmark {
    naceCode: string;
    naceName: string;
    sizeClass: CompanySize;
    totalEmployeeRange: {
        min: number;
        max: number;
    };
    ratios: StaffingRatio[];
    spanOfControl: SpanOfControlBenchmark[];
    productivityMetrics: ProductivityMetric[];
    source: string;
    updatedAt: Date;
}
export interface StaffingRatio {
    category: string;
    description: string;
    ratio: string;
    benchmark: number;
    unit: string;
    interpretationGuide: string;
}
export interface SpanOfControlBenchmark {
    level: number;
    levelName: string;
    minReports: number;
    maxReports: number;
    optimalReports: number;
}
export interface ProductivityMetric {
    metricCode: string;
    metricName: string;
    value: number;
    unit: string;
    benchmark: string;
}
export interface ValidationResult {
    isValid: boolean;
    score: number;
    issues: ValidationIssue[];
    warnings: ValidationWarning[];
    recommendations: string[];
}
export interface ValidationIssue {
    severity: 'critical' | 'major' | 'minor';
    code: string;
    message: string;
    affectedUnit?: string;
    affectedRole?: string;
    suggestedFix?: string;
}
export interface ValidationWarning {
    code: string;
    message: string;
    context: string;
}
export interface StaffingPlanForValidation {
    totalHeadcount: number;
    byOrgUnit: {
        orgUnitCode: string;
        headcount: number;
        roles: {
            jobCode: string;
            count: number;
        }[];
    }[];
    sizeClass: CompanySize;
    prototypeId?: string;
}
export interface OptimalStaffingResult {
    prototypeId: string;
    sizeClass: CompanySize;
    rules: StaffingRule[];
    totalMinHeadcount: number;
    totalMaxHeadcount: number;
    totalRecommendedHeadcount: number;
    breakdown: DepartmentStaffingBreakdown[];
    generationLog: string[];
}
export interface DepartmentStaffingBreakdown {
    orgUnitCode: string;
    orgUnitName: string;
    minHeadcount: number;
    maxHeadcount: number;
    recommendedHeadcount: number;
    roles: RoleStaffingDetail[];
}
export interface RoleStaffingDetail {
    jobCode: string;
    jobTitle: string;
    minHeadcount: number;
    maxHeadcount: number;
    recommendedHeadcount: number;
    isMandatory: boolean;
}
export declare class StaffingRulesGeneratorService {
    constructor(_tenantId: string);
    /**
     * Calculate optimal staffing for a prototype and company size
     */
    calculateOptimalStaffing(prototypeId: string, sizeClass: CompanySize): Promise<OptimalStaffingResult>;
    private calculateRoleStaffing;
    /**
     * Get industry benchmarks for a NACE code
     */
    getIndustryBenchmarks(naceCode: string): Promise<IndustryBenchmark>;
    private getCachedBenchmark;
    private getDefaultSpanOfControl;
    private generateGenericBenchmark;
    /**
     * Validate a staffing plan against rules and benchmarks
     */
    validateStaffingRatios(staffingPlan: StaffingPlanForValidation): Promise<ValidationResult>;
    /**
     * Save staffing rules to database
     */
    saveStaffingRules(rules: StaffingRule[]): Promise<void>;
    /**
     * Get staffing rules for a prototype
     */
    getStaffingRules(prototypeId: string, sizeClass?: CompanySize): Promise<StaffingRule[]>;
    private getPrototype;
    private getExistingRules;
    private getOrgUnitTemplates;
    private getJobTemplates;
}
export declare function createStaffingRulesGeneratorService(tenantId: string): StaffingRulesGeneratorService;
export default StaffingRulesGeneratorService;
//# sourceMappingURL=staffing-rules-generator.d.ts.map