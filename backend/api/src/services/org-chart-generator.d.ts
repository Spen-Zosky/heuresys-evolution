/**
 * Org Chart Generator Service
 * Generates realistic organizational charts using AI, templates, or NACE/ESCO data
 * Part of Org Chart Generation System
 */
import { TenantContext, IndustryPrototype } from './industry-prototype.js';
export type GenerationMethod = 'web_search' | 'template' | 'nace_esco' | 'combined';
export interface GenerationConfig {
    method: GenerationMethod;
    aiProvider?: 'openai' | 'anthropic' | 'gemini';
    levelCount?: number;
    includeVacancies?: boolean;
    useExistingDepartments?: boolean;
    useExistingJobTitles?: boolean;
}
export interface OrgUnit {
    code: string;
    name: string;
    nameEn?: string;
    parentCode: string | null;
    level: number;
    type: 'company' | 'division' | 'department' | 'team' | 'unit';
    headcountBudget: number;
    headcountActual?: number;
    costCenter?: string;
    managerId?: string;
}
export interface OrgPosition {
    code: string;
    titleIt: string;
    titleEn: string;
    unitCode: string;
    level: number;
    isManager: boolean;
    headcount: number;
    escoCode?: string;
    reportsToPositionCode?: string;
}
export interface GeneratedOrgChart {
    units: OrgUnit[];
    positions: OrgPosition[];
    totalHeadcount: number;
    levelDistribution: Record<number, number>;
    metadata: {
        method: GenerationMethod;
        aiProvider?: string;
        aiModel?: string;
        generatedAt: string;
        tenantContext: Partial<TenantContext>;
        industryPrototype: Partial<IndustryPrototype>;
    };
}
export interface GenerationSession {
    id: string;
    tenantId: string;
    sessionName: string;
    status: 'pending' | 'generating' | 'generated' | 'assigning' | 'completed' | 'failed' | 'approved';
    generatedStructure: GeneratedOrgChart | null;
    error?: string;
}
export declare class OrgChartGeneratorService {
    private tenantId;
    private prototypeService;
    private aiOrchestrator;
    constructor(tenantId: string, aiProvider?: 'openai' | 'anthropic' | 'gemini');
    /**
     * Create a new generation session
     */
    createSession(sessionName: string, config: GenerationConfig): Promise<GenerationSession>;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): Promise<GenerationSession | null>;
    /**
     * Generate org chart using configured method
     */
    generate(sessionId: string, config: GenerationConfig): Promise<GeneratedOrgChart>;
    /**
     * Generate using AI web search
     */
    private generateFromWebSearch;
    /**
     * Generate from database templates
     */
    private generateFromTemplate;
    /**
     * Generate from NACE/ESCO data
     */
    private generateFromNACEESCO;
    /**
     * Generate using all methods and combine
     */
    private generateCombined;
    private parseAIResponse;
    private adjustHeadcount;
    private buildChartFromParsed;
    private generateDefaultStructure;
    private scaleTemplateToEmployeeCount;
    private generateCode;
    private getCLevelTitle;
}
export declare function createOrgChartGeneratorService(tenantId: string, aiProvider?: 'openai' | 'anthropic' | 'gemini'): OrgChartGeneratorService;
export default OrgChartGeneratorService;
//# sourceMappingURL=org-chart-generator.d.ts.map