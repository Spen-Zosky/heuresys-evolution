/**
 * Unified Semantic Service
 *
 * Provides cross-domain semantic search capabilities across all HR entities:
 * - Core HR: employees, departments, org_units, locations
 * - Performance: reviews, check-ins, feedback
 * - Talent: skill gaps, career paths, succession
 * - Learning: paths, courses
 * - Recruiting: candidates, job postings
 *
 * @author Claude
 * @date 2025-12-22
 */
import { Pool } from 'pg';
export type SemanticEntityType = 'employee' | 'department' | 'org_unit' | 'location' | 'performance_review' | 'check_in' | 'feedback_360' | 'skill_gap_analysis' | 'career_path' | 'learning_path' | 'candidate' | 'job_posting' | 'goal' | 'course' | 'skill';
export interface SemanticEntity {
    entityType: SemanticEntityType;
    entityId: string;
    entityName: string;
    entityContext?: string;
    similarity: number;
    metadata?: Record<string, unknown>;
}
export interface UnifiedSearchOptions {
    query: string;
    tenantId: string;
    entityTypes?: SemanticEntityType[];
    limit?: number;
    similarityThreshold?: number;
    filters?: {
        orgUnitId?: string;
        locationId?: string;
        isActive?: boolean;
        dateFrom?: string;
        dateTo?: string;
    };
}
export interface UnifiedSearchResult {
    query: string;
    totalResults: number;
    results: SemanticEntity[];
    resultsByType: Record<SemanticEntityType, SemanticEntity[]>;
    searchDurationMs: number;
}
export interface EmbeddingGenerationConfig {
    entityType: SemanticEntityType;
    batchSize?: number;
    tenantId?: string | undefined;
    forceRegenerate?: boolean;
}
export interface EmbeddingGenerationResult {
    entityType: SemanticEntityType;
    totalRecords: number;
    embedded: number;
    skipped: number;
    errors: number;
    durationMs: number;
}
export interface EmployeeSemanticProfile {
    employeeId: string;
    name: string;
    jobTitle: string;
    department: string;
    skills: string[];
    performanceSummary: string;
    talentContext: string;
    learningContext: string;
    embedding?: number[];
}
export declare class UnifiedSemanticService {
    private pool;
    private apiKey;
    private embeddingModel;
    constructor(pool: Pool);
    /**
     * Set OpenAI API key
     */
    setApiKey(apiKey: string): void;
    /**
     * Load API key from database
     */
    loadApiKeyFromDb(): Promise<boolean>;
    /**
     * Generate embedding for text using OpenAI API directly
     */
    private generateEmbedding;
    /**
     * Generate text hash for change detection
     */
    private generateTextHash;
    /**
     * Wait helper for rate limiting
     */
    private wait;
    /**
     * Perform unified semantic search across all entity types
     */
    unifiedSearch(options: UnifiedSearchOptions): Promise<UnifiedSearchResult>;
    /**
     * Search directly in source tables (for entities not yet in unified index)
     */
    directSearch(options: UnifiedSearchOptions): Promise<UnifiedSearchResult>;
    /**
     * Search a specific entity type
     */
    private searchEntityType;
    /**
     * Get entity configuration for direct search
     */
    private getEntityConfig;
    /**
     * Generate embeddings for a specific entity type
     */
    generateEntityEmbeddings(config: EmbeddingGenerationConfig): Promise<EmbeddingGenerationResult>;
    /**
     * Generate all embeddings for all entity types
     */
    generateAllEmbeddings(tenantId?: string): Promise<EmbeddingGenerationResult[]>;
    /**
     * Get embedding generator for entity type
     */
    private getEmbeddingGenerator;
    /**
     * Upsert entity into unified semantic index
     */
    private upsertSemanticIndex;
    /**
     * Log search for analytics
     */
    private logSearch;
    /**
     * Get embedding status for all entity types
     */
    getEmbeddingStatus(): Promise<Record<SemanticEntityType, {
        total: number;
        embedded: number;
        percentage: number;
    }>>;
    /**
     * Get unified index statistics
     */
    getIndexStats(): Promise<{
        totalEntities: number;
        byType: Record<string, number>;
    }>;
}
export declare function createUnifiedSemanticService(pool: Pool): UnifiedSemanticService;
export declare function getUnifiedSemanticService(): UnifiedSemanticService | null;
//# sourceMappingURL=unified-semantic-service.d.ts.map