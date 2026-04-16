/**
 * Prototype Generator Service
 * Generates complete organizational structures from industry prototypes
 * Part of Tenant Prototype Generator System
 */
import { BusinessProcess } from './business-process-research.js';
import { IndustryPrototype, CompanySize } from './industry-prototype.js';
export interface GenerationConfig {
    prototypeId: string;
    companySize: CompanySize;
    generateOrgStructure: boolean;
    generateJobRoles: boolean;
    generateStaffing: boolean;
    generateTasks: boolean;
    generateKPIs: boolean;
    distributeTasksAndKPIs: boolean;
}
export interface GenerationResult {
    sessionId: string;
    tenantId: string;
    prototypeId: string;
    status: GenerationStatus;
    statistics: GenerationStatistics;
    orgUnits: OrgUnit[];
    jobRoles: JobRole[];
    staffingPlan: StaffingPlan;
    tasks: Task[];
    kpis: KPI[];
    taskDistributions: TaskDistribution[];
    kpiDistributions: KPIDistribution[];
    generatedAt: Date;
    completedAt?: Date;
}
export type GenerationStatus = 'pending' | 'researching' | 'generating_structure' | 'generating_roles' | 'calculating_staffing' | 'defining_tasks' | 'defining_kpis' | 'distributing' | 'completed' | 'failed' | 'cancelled';
export interface GenerationStatistics {
    orgUnitsGenerated: number;
    jobRolesAssigned: number;
    staffingRulesApplied: number;
    tasksCreated: number;
    kpisCreated: number;
    taskDistributions: number;
    kpiDistributions: number;
    processingTimeMs: number;
}
export interface OrgUnit {
    id?: string;
    code: string;
    nameIt: string;
    nameEn: string;
    level: number;
    parentCode?: string;
    costCenter?: string;
    processIds: string[];
    headcountMin?: number;
    headcountMax?: number;
}
export interface JobRole {
    id?: string;
    jobCode: string;
    titleIt: string;
    titleEn: string;
    orgUnitCode: string;
    orgLevel: number;
    isManagement: boolean;
    escoOccupationCode?: string;
}
export interface StaffingPlan {
    totalHeadcount: number;
    byOrgUnit: {
        orgUnitCode: string;
        headcount: number;
        roles: {
            jobCode: string;
            count: number;
        }[];
    }[];
    bySizeClass: CompanySize;
}
export interface Task {
    id?: string;
    taskCode: string;
    taskName: string;
    orgUnitCode: string;
    frequency: string;
    complexityLevel: number;
    estimatedHours?: number;
}
export interface KPI {
    id?: string;
    kpiCode: string;
    kpiName: string;
    orgUnitCode: string;
    measurementUnit: string;
    targetDirection: string;
    benchmarkValue?: number;
}
export interface TaskDistribution {
    jobCode: string;
    taskCode: string;
    responsibilityPercentage: number;
    isPrimaryOwner: boolean;
}
export interface KPIDistribution {
    jobCode: string;
    kpiCode: string;
    accountabilityLevel: 'owner' | 'contributor' | 'informed';
    weightPercentage: number;
}
export declare class PrototypeGeneratorService {
    private tenantId;
    private processResearchService;
    constructor(tenantId: string);
    /**
     * Generate complete organizational structure from prototype
     */
    generateFromPrototype(prototypeId: string, _config?: Partial<GenerationConfig>): Promise<GenerationResult>;
    private createSession;
    private updateSessionStatus;
    private completeSession;
    private failSession;
    private getPrototype;
    generateOrgStructure(prototype: IndustryPrototype, processes: BusinessProcess[]): Promise<OrgUnit[]>;
    private groupProcessesToDivisions;
    private getDivisionCode;
    private getItalianName;
    generateJobRoles(prototype: IndustryPrototype, orgUnits: OrgUnit[]): Promise<JobRole[]>;
    private getRolesForOrgUnit;
    generateStaffing(prototypeId: string, orgUnits: OrgUnit[], jobRoles: JobRole[], sizeClass: CompanySize): Promise<StaffingPlan>;
    generateTasks(orgUnits: OrgUnit[], processes: BusinessProcess[]): Promise<Task[]>;
    private generateGenericTasks;
    generateKPIs(orgUnits: OrgUnit[], _processes: BusinessProcess[]): Promise<KPI[]>;
    private getKPIsForOrgUnit;
    distributeTasksToRoles(tasks: Task[], roles: JobRole[]): Promise<TaskDistribution[]>;
    distributeKPIsToRoles(kpis: KPI[], roles: JobRole[]): Promise<KPIDistribution[]>;
    /**
     * Export org structure to Excalidraw format
     */
    exportToExcalidraw(orgUnits: OrgUnit[]): Promise<object>;
    private groupByLevel;
}
export declare function createPrototypeGeneratorService(tenantId: string): PrototypeGeneratorService;
export default PrototypeGeneratorService;
//# sourceMappingURL=prototype-generator.d.ts.map