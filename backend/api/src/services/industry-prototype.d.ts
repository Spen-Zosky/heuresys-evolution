/**
 * Industry Prototype Service
 * Resolves NACE codes to industry prototypes and retrieves ESCO occupations
 * Part of Org Chart Generation System
 */
export interface IndustryPrototype {
    id: string;
    code: string;
    name: string;
    description: string | null;
    naceSection: string | null;
    naceDivision: string | null;
    naceGroup: string | null;
    sizeClass: CompanySize;
    minEmployees: number | null;
    maxEmployees: number | null;
    typicalDepartments: string[];
    typicalRoles: string[];
    typicalHierarchy: HierarchyLevel[] | null;
    typicalSpanOfControl: number[];
    escoOccupationCodes: string[];
    orgUnitTemplates: string[];
}
export type CompanySize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
export interface HierarchyLevel {
    level: number;
    nameIt: string;
    nameEn: string;
    typicalCount: number;
    typicalRoles: string[];
}
export interface NACEInfo {
    section: string;
    sectionName: string;
    division: string;
    divisionName: string;
    group: string | null;
    groupName: string | null;
    class: string | null;
    className: string | null;
}
export interface ESCOOccupation {
    code: string;
    preferredLabel: string;
    altLabels: string[];
    description: string | null;
    skillLevel: number;
    isco08Code: string | null;
}
export interface TenantContext {
    tenantId: string;
    tenantName: string;
    industryType: string | null;
    naceCode: string | null;
    employeeCount: number;
    departments: {
        id: string;
        name: string;
        count: number;
    }[];
    locations: {
        id: string;
        name: string;
        city: string;
    }[];
    costCenters: {
        id: string;
        code: string;
        name: string;
    }[];
    orgUnits: {
        id: string;
        code: string;
        name: string;
    }[];
    jobTitles: string[];
}
export declare class IndustryPrototypeService {
    private tenantId;
    constructor(tenantId: string);
    /**
     * Get complete tenant context for org chart generation
     */
    getTenantContext(): Promise<TenantContext>;
    /**
     * Get NACE information from code
     */
    getNACEInfo(naceCode: string): Promise<NACEInfo | null>;
    private getNACESectionName;
    /**
     * Get industry prototype for tenant based on NACE and size
     */
    getPrototypeForTenant(): Promise<IndustryPrototype>;
    private findPrototypeInDB;
    private generateDefaultPrototype;
    private getTypicalDepartments;
    private getSizeRange;
    /**
     * Get ESCO occupations relevant for industry
     */
    getRelevantESCOOccupations(naceSection: string, limit?: number): Promise<ESCOOccupation[]>;
    /**
     * Match job title to ESCO occupation
     */
    matchJobTitleToESCO(jobTitle: string): Promise<ESCOOccupation | null>;
    /**
     * Get org chart templates for industry/size
     */
    getTemplatesForIndustry(naceSection: string, sizeClass: CompanySize): Promise<Record<string, any>[]>;
}
export declare function createIndustryPrototypeService(tenantId: string): IndustryPrototypeService;
export default IndustryPrototypeService;
//# sourceMappingURL=industry-prototype.d.ts.map