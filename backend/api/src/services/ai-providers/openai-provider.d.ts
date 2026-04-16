/**
 * OpenAI Embedding Provider
 * Implementation of AI embedding provider for OpenAI
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { AIEmbeddingProvider, ProviderConfig, EmbeddingResult, BatchEmbeddingResult } from './provider-interface.js';
export declare const OPENAI_DEFAULT_CONFIG: Partial<ProviderConfig>;
export declare const OPENAI_MODELS: Record<string, {
    dimensions: number;
    costPer1kTokens: number;
}>;
export declare class OpenAIEmbeddingProvider extends AIEmbeddingProvider {
    private readonly baseUrl;
    constructor(config: Partial<ProviderConfig> & {
        apiKey: string;
    });
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
    validateApiKey(): Promise<boolean>;
    private handleError;
    private delay;
}
//# sourceMappingURL=openai-provider.d.ts.map