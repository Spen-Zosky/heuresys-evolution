/**
 * Ontology Embedding Service
 * Specialized embedding generation and vector search for skill ontology
 * Epic: E-ONTO-01 (Ontology Foundation)
 * Story: S-ONTO-01-08 (Basic Semantic Search)
 * Created: 2025-12-22
 */
export type EmbeddingProvider = 'openai' | 'gemini';
export interface EmbeddingConfig {
    provider: EmbeddingProvider;
    model: string;
    apiKey?: string;
    dimensions: number;
    batchSize: number;
    rateLimitDelay: number;
}
export interface EmbeddingResult {
    embedding: number[];
    model: string;
    tokensUsed: number;
}
export interface BatchEmbeddingResult {
    embeddings: number[][];
    model: string;
    totalTokens: number;
    successCount: number;
    failedCount: number;
}
export interface VectorSearchOptions {
    query: string;
    language: 'en' | 'it';
    limit: number;
    similarityThreshold: number;
    skillType?: string;
    isDigital?: boolean;
    isGreen?: boolean;
    isTransversal?: boolean;
    includeCustomSkills?: boolean;
    tenantId?: string;
}
export interface VectorSearchResult {
    id: string;
    preferredLabel: string;
    altLabels: string[];
    description: string;
    skillType: string;
    similarity: number;
    source: 'esco' | 'tenant_custom';
}
export interface EmbeddingJobResult {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    totalItems: number;
    processedItems: number;
    failedItems: number;
    tokensUsed: number;
    estimatedCost: number;
}
export declare class OntologyEmbeddingService {
    private config;
    constructor(provider?: EmbeddingProvider);
    setApiKey(apiKey: string): void;
    loadApiKeyFromDb(tenantId?: string): Promise<boolean>;
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    private openAIEmbedding;
    private geminiEmbedding;
    generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
    private openAIBatchEmbedding;
    private delay;
    searchSkillsByVector(options: VectorSearchOptions): Promise<VectorSearchResult[]>;
    private searchCustomSkillsByVector;
    private fallbackTextSearch;
    createEmbeddingJob(targetTable: 'esco_skills' | 'tenant_custom_skills' | 'industry_classifications', jobType: 'full' | 'incremental', tenantId?: string): Promise<string>;
    getJobStatus(jobId: string): Promise<EmbeddingJobResult>;
    processEmbeddingJob(jobId: string): Promise<EmbeddingJobResult>;
    private processEscoSkillsEmbeddings;
    private processTenantSkillsEmbeddings;
    private processIndustryClassificationsEmbeddings;
    inferSkillRelations(similarityThreshold?: number, limit?: number): Promise<{
        relationsFound: number;
        jobId: string;
    }>;
}
export declare function createOntologyEmbeddingService(provider?: EmbeddingProvider): OntologyEmbeddingService;
export default OntologyEmbeddingService;
//# sourceMappingURL=ontology-embedding.d.ts.map