/**
 * Gemini Embedding Provider
 * Implementation of AI embedding provider for Google Gemini
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { AIEmbeddingProvider, ProviderConfig, EmbeddingResult, BatchEmbeddingResult } from './provider-interface.js';
export declare const GEMINI_DEFAULT_CONFIG: Partial<ProviderConfig>;
export declare const GEMINI_MODELS: Record<string, {
    dimensions: number;
    costPer1kTokens: number;
}>;
export declare class GeminiEmbeddingProvider extends AIEmbeddingProvider {
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
//# sourceMappingURL=gemini-provider.d.ts.map