/**
 * Graph Navigation Service
 * Traverses the knowledge graph connecting processes, skills, employees, org units, and industry classifications.
 * Uses req.dbClient (PoolClient with tenant context) for RLS enforcement.
 */
import { PoolClient } from 'pg';
export interface ProcessDeepResult {
    process: {
        id: string;
        processCode: string;
        processName: string;
        processCategory: string;
        valueChainPosition: number;
        description: string | null;
        typicalInputs: string | null;
        typicalOutputs: string | null;
    };
    phases: Array<{
        id: string;
        phaseCode: string;
        phaseName: string;
        phaseOrder: number;
        description: string | null;
        estimatedDurationDays: number | null;
        isOptional: boolean;
    }>;
    roles: Array<{
        id: string;
        roleName: string;
        roleType: string;
        phaseId: string | null;
        minHeadcount: number;
        maxHeadcount: number;
        description: string | null;
        occupationLabel: string | null;
        iscoCode: string | null;
        occupationUri: string | null;
    }>;
    skillRequirements: Array<{
        id: string;
        phaseId: string | null;
        proficiencyLevel: number;
        isMandatory: boolean;
        description: string | null;
        skillLabel: string;
        skillType: string;
        skillUri: string;
    }>;
    kpis: Array<{
        id: string;
        kpiCode: string;
        kpiName: string;
        phaseId: string | null;
        measurementUnit: string | null;
        targetDirection: string | null;
        benchmarkValue: number | null;
        benchmarkMin: number | null;
        benchmarkMax: number | null;
        description: string | null;
    }>;
}
export interface ProcessSkillRow {
    id: string;
    phaseId: string | null;
    proficiencyLevel: number;
    isMandatory: boolean;
    requirementDescription: string | null;
    escoSkillId: string;
    preferredLabel: string;
    skillDescription: string | null;
    skillType: string;
    uri: string;
    phaseName: string | null;
    qualifiedEmployeeCount: number;
    totalEmployeeCount: number;
}
export interface SkillProcessRow {
    processId: string;
    processCode: string;
    processName: string;
    processCategory: string;
    proficiencyLevel: number;
    isMandatory: boolean;
    phaseId: string | null;
    phaseName: string | null;
    phaseOrder: number | null;
}
export interface EmployeeProcessQualification {
    processId: string;
    processCode: string;
    processName: string;
    totalRequirements: number;
    metRequirements: number;
    qualificationScore: number;
    gaps: Array<{
        escoSkillId: string;
        skillLabel: string;
        requiredLevel: number;
        employeeLevel: number;
    }>;
}
export interface OrgUnitCoverageResult {
    employees: Array<{
        id: string;
        firstName: string;
        lastName: string;
        jobTitle: string | null;
    }>;
    skillProfile: Array<{
        skillId: string;
        preferredLabel: string;
        skillType: string;
        employeeCount: number;
        avgProficiency: number;
    }>;
    mappedProcesses: Array<{
        processId: string;
        processCode: string;
        processName: string;
        responsibilityLevel: string | null;
    }>;
}
export interface OrgUnitSkillGap {
    skillId: string;
    skillLabel: string;
    skillType: string;
    requiredLevel: number;
    availableLevel: number;
    gapLevel: number;
    isMandatory: boolean;
    processCount: number;
    employeesWithSkill: number;
    totalEmployees: number;
    coveragePercent: number;
}
export interface KpiCascadeOrgUnit {
    templateId: string;
    name: string;
    code: string;
    responsibilityLevel: string;
    employeesWithGoals: number;
    totalEmployees: number;
}
export interface KpiCascadeRole {
    id: string;
    roleName: string;
    roleType: string;
    phaseId: string | null;
    occupationLabel: string | null;
}
export interface KpiCascadeItem {
    id: string;
    kpiCode: string;
    kpiName: string;
    phaseId: string | null;
    phaseName: string | null;
    measurementUnit: string | null;
    targetDirection: string | null;
    benchmarkValue: number | null;
    benchmarkMin: number | null;
    benchmarkMax: number | null;
    description: string | null;
    roles: KpiCascadeRole[];
    alignmentStatus: 'aligned' | 'partial' | 'unaligned';
}
export interface KpiCascadeResult {
    processId: string;
    processName: string;
    processCode: string;
    kpis: KpiCascadeItem[];
    orgUnits: KpiCascadeOrgUnit[];
}
export interface IndustryProcessMapResult {
    occupations: Array<{
        id: string;
        preferredLabel: string;
        iscoCode: string | null;
        uri: string;
        relevanceScore: number | null;
    }>;
    processes: Array<{
        processId: string;
        processCode: string;
        processName: string;
        processCategory: string;
    }>;
    commonSkills: Array<{
        id: string;
        preferredLabel: string;
        skillType: string;
        occupationCount: number;
    }>;
}
export declare class GraphNavigationService {
    private dbClient;
    constructor(dbClient: PoolClient);
    getProcessDeep(processId: string): Promise<ProcessDeepResult | null>;
    getProcessSkills(processId: string, tenantId: string): Promise<ProcessSkillRow[]>;
    getSkillProcesses(skillId: string): Promise<SkillProcessRow[]>;
    getEmployeeProcessQualification(employeeId: string): Promise<EmployeeProcessQualification[]>;
    getOrgUnitCoverage(orgUnitId: string, tenantId: string): Promise<OrgUnitCoverageResult>;
    getOrgUnitSkillGaps(orgUnitId: string, tenantId: string): Promise<OrgUnitSkillGap[]>;
    getIndustryProcessMap(industryCode: string): Promise<IndustryProcessMapResult>;
    getProcessKpiCascade(processId: string, tenantId: string): Promise<KpiCascadeResult | null>;
}
//# sourceMappingURL=graph-navigation.d.ts.map