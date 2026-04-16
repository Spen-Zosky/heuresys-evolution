/**
 * Advanced Semantic Search Service
 * Extends base semantic search with query expansion and re-ranking
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-06-R (Advanced Semantic Search)
 * Created: 2025-12-22
 */
export interface QueryExpansion {
    originalQuery: string;
    expandedTerms: string[];
    synonymsFound: number;
    expansionMethod: 'synonym' | 'embedding' | 'hybrid';
}
export interface RankedResult {
    entityType: string;
    entityId: string;
    entityName: string;
    entityContext: string | null;
    similarity: number;
    contextScore: number;
    finalScore: number;
    metadata: Record<string, unknown> | null;
    rankingFactors: {
        semanticSimilarity: number;
        contextRelevance: number;
        recencyBoost: number;
        typeBoost: number;
    };
}
export interface AdvancedSearchOptions {
    query: string;
    tenantId: string;
    entityTypes?: string[];
    limit?: number;
    similarityThreshold?: number;
    enableQueryExpansion?: boolean;
    enableReranking?: boolean;
    contextHints?: string[];
    boostRecent?: boolean;
}
export interface AdvancedSearchResult {
    query: string;
    expansion: QueryExpansion | null;
    totalResults: number;
    results: RankedResult[];
    resultsByType: Record<string, RankedResult[]>;
    searchDurationMs: number;
    analyticsId: string;
}
export interface SearchAnalytics {
    totalSearches: number;
    avgResultCount: number;
    avgDurationMs: number;
    topQueries: Array<{
        query: string;
        count: number;
    }>;
    searchesByEntityType: Record<string, number>;
    zeroResultQueries: number;
    avgFeedbackScore: number | null;
}
export declare class AdvancedSemanticSearchService {
    /**
     * Expand query with synonyms and related terms
     */
    expandQuery(query: string, language?: 'en' | 'it'): Promise<QueryExpansion>;
    /**
     * Re-rank results based on context and relevance factors
     */
    reRankResults(results: Array<{
        entityType: string;
        entityId: string;
        entityName: string;
        entityContext: string | null;
        similarity: number;
        metadata: Record<string, unknown> | null;
        createdAt?: Date;
    }>, options: {
        query: string;
        contextHints?: string[] | undefined;
        preferredTypes?: string[] | undefined;
        boostRecent?: boolean | undefined;
    }): RankedResult[];
    /**
     * Perform advanced semantic search with expansion and re-ranking
     */
    advancedSearch(options: AdvancedSearchOptions): Promise<AdvancedSearchResult>;
    /**
     * Log search for analytics
     */
    private logSearchAnalytics;
    /**
     * Get search analytics summary
     */
    getSearchAnalytics(tenantId?: string, days?: number): Promise<SearchAnalytics>;
    /**
     * Submit feedback for a search
     */
    submitSearchFeedback(searchId: string, feedbackScore: number): Promise<void>;
}
export declare function getAdvancedSearchService(): AdvancedSemanticSearchService;
export default AdvancedSemanticSearchService;
//# sourceMappingURL=advanced-semantic-search.d.ts.map