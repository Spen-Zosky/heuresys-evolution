/**
 * Business Process Research Service
 * AI-powered research for industry business processes based on Porter's Value Chain
 * Part of Tenant Prototype Generator System
 */
export interface BusinessProcess {
    processCode: string;
    processName: string;
    processCategory: 'primary' | 'support';
    valueChainPosition: number;
    description: string;
    typicalInputs: string[];
    typicalOutputs: string[];
}
export interface CostCenter {
    costCenterCode: string;
    costCenterName: string;
    costType: 'direct' | 'indirect' | 'overhead';
    description: string;
}
export interface ValueChainMapping {
    primaryActivities: BusinessProcess[];
    supportActivities: BusinessProcess[];
    totalProcesses: number;
}
export interface ProcessResearchResult {
    naceCode: string;
    industryName: string;
    companySize: string;
    processes: BusinessProcess[];
    costCenters: CostCenter[];
    valueChainMapping: ValueChainMapping;
    researchSource: 'database' | 'ai_generated' | 'cached';
    generatedAt: Date;
}
export interface CachedResearch {
    id: string;
    naceSection: string;
    naceDivision: string;
    companySize: string;
    research: ProcessResearchResult;
    createdAt: Date;
    expiresAt: Date;
}
export interface ProcessPhase {
    id: string;
    processId: string;
    phaseCode: string;
    phaseName: string;
    phaseOrder: number;
    description: string | null;
    estimatedDurationDays: number | null;
    isOptional: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ProcessRole {
    id: string;
    processId: string;
    phaseId: string | null;
    roleName: string;
    roleType: 'owner' | 'executor' | 'approver' | 'reviewer' | 'informed';
    escoOccupationId: string | null;
    minHeadcount: number;
    maxHeadcount: number | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface ProcessSkillRequirement {
    id: string;
    processId: string;
    phaseId: string | null;
    escoSkillId: string;
    proficiencyLevel: number;
    isMandatory: boolean;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface ProcessKpi {
    id: string;
    processId: string;
    phaseId: string | null;
    kpiCode: string;
    kpiName: string;
    measurementUnit: string | null;
    targetDirection: 'higher_better' | 'lower_better' | 'target_range' | null;
    benchmarkValue: number | null;
    benchmarkMin: number | null;
    benchmarkMax: number | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface BlueprintTemplate {
    id: string;
    profileId: string;
    templateName: string;
    templateVersion: string;
    description: string | null;
    templateConfig: Record<string, unknown>;
    isActive: boolean;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface BlueprintRun {
    id: string;
    tenantId: string;
    templateId: string;
    runMode: 'greenfield' | 'overlay';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    inputConfig: Record<string, unknown>;
    startedAt: Date | null;
    completedAt: Date | null;
    createdBy: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface BlueprintResult {
    id: string;
    runId: string;
    resultType: 'org_unit_suggestion' | 'process_mapping' | 'skill_gap' | 'role_assignment' | 'kpi_target' | 'cleanup_action';
    entityType: string | null;
    entityId: string | null;
    severity: 'info' | 'warning' | 'critical' | 'action_required' | null;
    title: string;
    description: string | null;
    suggestedAction: Record<string, unknown> | null;
    isApplied: boolean;
    appliedAt: Date | null;
    appliedBy: string | null;
    createdAt: Date;
}
export declare const VALUE_CHAIN_POSITIONS: {
    PRIMARY: {
        INBOUND_LOGISTICS: number;
        OPERATIONS: number;
        OUTBOUND_LOGISTICS: number;
        MARKETING_SALES: number;
        SERVICE: number;
    };
    SUPPORT: {
        PROCUREMENT: number;
        TECHNOLOGY: number;
        HUMAN_RESOURCES: number;
        INFRASTRUCTURE: number;
    };
};
export declare const VALUE_CHAIN_DESCRIPTIONS: Record<number, {
    name: string;
    description: string;
}>;
export declare const COST_CENTER_PROMPT = "You are an expert financial analyst specializing in cost center design.\nBased on the business processes provided, identify the appropriate cost centers.\n\nFor each cost center, provide:\n1. A unique code (e.g., CC-PROD)\n2. Name\n3. Cost type (direct, indirect, or overhead)\n4. Description\n\nRespond in JSON format:\n{\n  \"costCenters\": [\n    {\n      \"costCenterCode\": \"CC-PROD\",\n      \"costCenterName\": \"Production\",\n      \"costType\": \"direct\",\n      \"description\": \"Manufacturing operations\"\n    }\n  ]\n}";
export declare class BusinessProcessResearchService {
    private tenantId;
    private aiOrchestrator;
    constructor(tenantId: string);
    /**
     * Research industry processes based on NACE code and company size
     */
    researchIndustryProcesses(naceCode: string, companySize: string): Promise<ProcessResearchResult>;
    private getProcessesFromDatabase;
    private buildResultFromDatabase;
    private getCostCentersFromDatabase;
    private buildResultFromTemplate;
    private generateCostCentersFromProcesses;
    private generateProcessesWithAI;
    private generateGenericProcesses;
    mapToValueChain(processes: BusinessProcess[]): ValueChainMapping;
    getCachedResearch(naceCode: string, companySize: string): Promise<CachedResearch | null>;
    private cacheResearch;
    private getIndustryName;
    identifyCostCenters(process: BusinessProcess): CostCenter[];
}
export declare function createBusinessProcessResearchService(tenantId: string): BusinessProcessResearchService;
export default BusinessProcessResearchService;
//# sourceMappingURL=business-process-research.d.ts.map