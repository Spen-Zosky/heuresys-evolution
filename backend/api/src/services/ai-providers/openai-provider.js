/**
 * OpenAI Embedding Provider
 * Implementation of AI embedding provider for OpenAI
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { AIEmbeddingProvider, } from './provider-interface.js';
import { logger } from '../../config/logger.js';
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
export const OPENAI_DEFAULT_CONFIG = {
    name: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    batchSize: 100,
    rateLimitPerMinute: 3000,
    costPer1kTokens: 0.00002, // text-embedding-3-small pricing
    priority: 1,
    enabled: true,
};
// Model-specific configurations
export const OPENAI_MODELS = {
    'text-embedding-3-small': { dimensions: 1536, costPer1kTokens: 0.00002 },
    'text-embedding-3-large': { dimensions: 3072, costPer1kTokens: 0.00013 },
    'text-embedding-ada-002': { dimensions: 1536, costPer1kTokens: 0.0001 },
};
// =============================================================================
// OPENAI EMBEDDING PROVIDER
// =============================================================================
export class OpenAIEmbeddingProvider extends AIEmbeddingProvider {
    baseUrl = 'https://api.openai.com/v1';
    constructor(config) {
        const fullConfig = {
            ...OPENAI_DEFAULT_CONFIG,
            ...config,
            name: 'openai',
        };
        // Apply model-specific dimensions and cost if known model
        const modelInfo = OPENAI_MODELS[fullConfig.model];
        if (modelInfo) {
            fullConfig.dimensions = modelInfo.dimensions;
            fullConfig.costPer1kTokens = modelInfo.costPer1kTokens;
        }
        super(fullConfig);
    }
    // ---------------------------------------------------------------------------
    // SINGLE EMBEDDING
    // ---------------------------------------------------------------------------
    async generateEmbedding(text) {
        if (!this.checkRateLimit()) {
            throw new Error(`OpenAI rate limit exceeded. Please wait.`);
        }
        const startTime = Date.now();
        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                signal: AbortSignal.timeout(30000),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    input: text,
                    encoding_format: 'float',
                }),
            });
            const latencyMs = Date.now() - startTime;
            if (!response.ok) {
                const errorData = (await response.json());
                this.updateMetrics(0, latencyMs, false);
                this.handleError(response.status, errorData.error?.message || 'Unknown error');
                throw new Error(`OpenAI API error: ${errorData.error?.message}`);
            }
            const data = (await response.json());
            const embedding = data.data[0]?.embedding;
            if (!embedding) {
                this.updateMetrics(0, latencyMs, false);
                throw new Error('No embedding returned from OpenAI API');
            }
            this.incrementRateLimit();
            this.updateMetrics(data.usage.total_tokens, latencyMs, true);
            return {
                embedding,
                model: data.model,
                tokensUsed: data.usage.total_tokens,
                provider: 'openai',
                latencyMs,
            };
        }
        catch (error) {
            const latencyMs = Date.now() - startTime;
            this.updateMetrics(0, latencyMs, false);
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // BATCH EMBEDDING
    // ---------------------------------------------------------------------------
    async generateBatchEmbeddings(texts) {
        if (!this.checkRateLimit()) {
            throw new Error(`OpenAI rate limit exceeded. Please wait.`);
        }
        if (texts.length === 0) {
            return {
                embeddings: [],
                model: this.config.model,
                totalTokens: 0,
                successCount: 0,
                failedCount: 0,
                provider: 'openai',
                latencyMs: 0,
            };
        }
        const startTime = Date.now();
        const embeddings = [];
        let totalTokens = 0;
        let failedCount = 0;
        // Process in batches according to config
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            try {
                const response = await fetch(`${this.baseUrl}/embeddings`, {
                    signal: AbortSignal.timeout(30000),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.config.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.config.model,
                        input: batch,
                        encoding_format: 'float',
                    }),
                });
                if (!response.ok) {
                    const errorData = (await response.json());
                    this.handleError(response.status, errorData.error?.message || 'Unknown error');
                    failedCount += batch.length;
                    continue;
                }
                const data = (await response.json());
                // Sort by index to ensure correct order
                const sortedData = data.data.sort((a, b) => a.index - b.index);
                for (const item of sortedData) {
                    embeddings.push(item.embedding);
                }
                totalTokens += data.usage.total_tokens;
                this.incrementRateLimit();
                // Rate limit delay between batches
                if (i + this.config.batchSize < texts.length) {
                    await this.delay(100); // 100ms between batches
                }
            }
            catch (error) {
                failedCount += batch.length;
                logger.error(`OpenAI batch embedding error:${error}`);
            }
        }
        const latencyMs = Date.now() - startTime;
        this.updateMetrics(totalTokens, latencyMs, failedCount < texts.length);
        return {
            embeddings,
            model: this.config.model,
            totalTokens,
            successCount: embeddings.length,
            failedCount,
            provider: 'openai',
            latencyMs,
        };
    }
    // ---------------------------------------------------------------------------
    // API KEY VALIDATION
    // ---------------------------------------------------------------------------
    async validateApiKey() {
        try {
            // Make a minimal request to validate the key
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                signal: AbortSignal.timeout(30000),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    input: 'test',
                    encoding_format: 'float',
                }),
            });
            if (response.ok) {
                this.setStatus('available');
                return true;
            }
            if (response.status === 401) {
                this.setStatus('error');
                return false;
            }
            // Other errors might be transient
            return true;
        }
        catch {
            this.setStatus('error');
            return false;
        }
    }
    // ---------------------------------------------------------------------------
    // HELPER METHODS
    // ---------------------------------------------------------------------------
    handleError(status, message) {
        if (status === 429) {
            this.setStatus('rate_limited');
        }
        else if (status === 401 || status === 403) {
            this.setStatus('error');
        }
        logger.error(`OpenAI error (${status}): ${message}`);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=openai-provider.js.map