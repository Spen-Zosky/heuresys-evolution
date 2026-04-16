/**
 * AI Provider Factory
 * Factory pattern for AI provider instantiation with fallback support
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { AIEmbeddingProvider, IProviderFactory, ProviderName, ProviderMetrics, EmbeddingResult, BatchEmbeddingResult } from './provider-interface.js';
export declare class AIProviderFactory implements IProviderFactory {
    private providers;
    private defaultProvider;
    private initialized;
    constructor();
    init(): Promise<void>;
    getProvider(name?: ProviderName): AIEmbeddingProvider;
    getAllProviders(): AIEmbeddingProvider[];
    getAvailableProviders(): AIEmbeddingProvider[];
    getFallbackProvider(excludeProvider?: ProviderName): AIEmbeddingProvider | null;
    getMetrics(): ProviderMetrics[];
    generateEmbedding(text: string, preferredProvider?: ProviderName): Promise<EmbeddingResult>;
    generateBatchEmbeddings(texts: string[], preferredProvider?: ProviderName): Promise<BatchEmbeddingResult>;
    saveMetricsToDb(): Promise<void>;
    loadCostSummary(provider?: ProviderName, since?: Date): Promise<{
        provider: ProviderName;
        totalRequests: number;
        totalTokens: number;
        totalCost: number;
        avgLatency: number;
    }[]>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        providers: Record<ProviderName, {
            available: boolean;
            status: string;
        }>;
    }>;
}
export declare function getProviderFactory(): AIProviderFactory;
export declare function initProviderFactory(): Promise<AIProviderFactory>;
//# sourceMappingURL=provider-factory.d.ts.map