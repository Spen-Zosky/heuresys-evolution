/**
 * AI Provider Interface
 * Abstract interface for AI embedding providers
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
export type ProviderName = 'openai' | 'gemini' | 'anthropic';
export type ProviderStatus = 'available' | 'rate_limited' | 'error' | 'disabled';
export interface EmbeddingResult {
    embedding: number[];
    model: string;
    tokensUsed: number;
    provider: ProviderName;
    latencyMs: number;
}
export interface BatchEmbeddingResult {
    embeddings: number[][];
    model: string;
    totalTokens: number;
    successCount: number;
    failedCount: number;
    provider: ProviderName;
    latencyMs: number;
}
export interface ProviderConfig {
    name: ProviderName;
    model: string;
    apiKey: string;
    dimensions: number;
    batchSize: number;
    rateLimitPerMinute: number;
    costPer1kTokens: number;
    priority: number;
    enabled: boolean;
}
export interface ProviderMetrics {
    provider: ProviderName;
    requestCount: number;
    tokenCount: number;
    totalCost: number;
    avgLatencyMs: number;
    errorCount: number;
    lastUsed: Date | null;
    status: ProviderStatus;
}
export interface RateLimitState {
    requestsThisMinute: number;
    minuteStart: number;
    isLimited: boolean;
}
export declare abstract class AIEmbeddingProvider {
    protected config: ProviderConfig;
    protected rateLimitState: RateLimitState;
    protected metrics: ProviderMetrics;
    constructor(config: ProviderConfig);
    abstract generateEmbedding(text: string): Promise<EmbeddingResult>;
    abstract generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
    abstract validateApiKey(): Promise<boolean>;
    getName(): ProviderName;
    getConfig(): ProviderConfig;
    getMetrics(): ProviderMetrics;
    isAvailable(): boolean;
    getDimensions(): number;
    protected checkRateLimit(): boolean;
    protected incrementRateLimit(): void;
    protected updateMetrics(tokensUsed: number, latencyMs: number, success: boolean): void;
    estimateCost(tokenCount: number): number;
    resetMetrics(): void;
    setStatus(status: ProviderStatus): void;
    setEnabled(enabled: boolean): void;
}
export interface IProviderFactory {
    getProvider(name?: ProviderName): AIEmbeddingProvider;
    getAllProviders(): AIEmbeddingProvider[];
    getAvailableProviders(): AIEmbeddingProvider[];
    getFallbackProvider(excludeProvider?: ProviderName): AIEmbeddingProvider | null;
    getMetrics(): ProviderMetrics[];
}
//# sourceMappingURL=provider-interface.d.ts.map