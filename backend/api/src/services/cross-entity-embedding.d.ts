/**
 * Cross-Entity Embedding Service
 * Extends ontology embedding to support multiple entity types for semantic search
 * Epic: E-ONTO-01 (Ontology Foundation)
 * Feature: Cross-Entity Semantic Search
 * Created: 2025-12-22
 */
import { OntologyEmbeddingService, EmbeddingProvider } from './ontology-embedding.js';
export type EntityType = 'skills' | 'occupations' | 'jobs' | 'courses' | 'goals' | 'industry_classifications_l1' | 'industry_classifications_l2' | 'industry_classifications_l3';
export interface EntitySearchResult {
    entityType: EntityType;
    id: string;
    label: string;
    description: string;
    similarity: number;
    metadata: Record<string, unknown>;
}
export interface CrossEntitySearchOptions {
    query: string;
    language: 'en' | 'it';
    entityTypes: EntityType[];
    limit: number;
    similarityThreshold: number;
    tenantId?: string;
}
export interface CrossEntitySearchResponse {
    query: string;
    totalResults: number;
    resultsByType: Record<EntityType, EntitySearchResult[]>;
    searchDurationMs: number;
}
export interface OrgAdvisoryRequest {
    industry: string;
    companySize: number;
    language: 'en' | 'it';
    additionalContext?: string;
}
export interface OrgRole {
    occupationUri: string;
    occupationTitle: string;
    count: number;
    isCore: boolean;
    department?: string;
    notes?: string;
    requiredSkills: Array<{
        skillId: string;
        skillLabel: string;
        importance: 'essential' | 'important' | 'nice_to_have';
    }>;
}
export interface OrgAdvisoryResponse {
    matchedIndustry: {
        naceCode: string;
        nameEn: string;
        nameIt: string;
        level: 'section' | 'division' | 'group';
    };
    companySize: number;
    suggestedStructure: {
        org_units: Array<{
            name: string;
            headcount: number;
            roles: OrgRole[];
        }>;
    };
    totalHeadcount: number;
    keyRoles: OrgRole[];
    skillsProfile: Array<{
        skillId: string;
        skillLabel: string;
        frequency: number;
        importance: string;
    }>;
    recommendations: string[];
}
export interface EmbeddingJobConfig {
    entityType: EntityType;
    jobType: 'full' | 'incremental';
    tenantId?: string;
}
export declare class CrossEntityEmbeddingService extends OntologyEmbeddingService {
    generateEntityEmbeddings(config: EmbeddingJobConfig): Promise<{
        processed: number;
        failed: number;
        tokens: number;
    }>;
    private processOccupationsEmbeddings;
    private processJobTemplatesEmbeddings;
    private processCoursesEmbeddings;
    private processGoalsEmbeddings;
    private processNaceEmbeddings;
    protected waitMs(ms: number): Promise<void>;
    crossEntitySearch(options: CrossEntitySearchOptions): Promise<CrossEntitySearchResponse>;
    private searchEntity;
    private logCrossEntitySearch;
    getOrganizationAdvice(request: OrgAdvisoryRequest): Promise<OrgAdvisoryResponse>;
    private findMatchingIndustry;
    private findIndustryOccupations;
    private getDefaultOccupations;
    private assignRolesToCompany;
    private buildOrgStructure;
    private buildSkillsProfile;
    private generateRecommendations;
    getEmbeddingStatus(): Promise<Record<EntityType, {
        total: number;
        embedded: number;
        percentage: number;
    }>>;
}
export declare function createCrossEntityService(provider?: EmbeddingProvider): CrossEntityEmbeddingService;
export default CrossEntityEmbeddingService;
//# sourceMappingURL=cross-entity-embedding.d.ts.map