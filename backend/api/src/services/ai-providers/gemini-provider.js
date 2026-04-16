/**
 * Gemini Embedding Provider
 * Implementation of AI embedding provider for Google Gemini
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { AIEmbeddingProvider, } from './provider-interface.js';
import { logger } from '../../config/logger.js';
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
export const GEMINI_DEFAULT_CONFIG = {
    name: 'gemini',
    model: 'text-embedding-004',
    dimensions: 768,
    batchSize: 100,
    rateLimitPerMinute: 1500,
    costPer1kTokens: 0.000025,
    priority: 2,
    enabled: true,
};
// Model-specific configurations
export const GEMINI_MODELS = {
    'text-embedding-004': { dimensions: 768, costPer1kTokens: 0.000025 },
    'embedding-001': { dimensions: 768, costPer1kTokens: 0.00001 },
};
// =============================================================================
// GEMINI EMBEDDING PROVIDER
// =============================================================================
export class GeminiEmbeddingProvider extends AIEmbeddingProvider {
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    constructor(config) {
        const fullConfig = {
            ...GEMINI_DEFAULT_CONFIG,
            ...config,
            name: 'gemini',
        };
        // Apply model-specific dimensions and cost if known model
        const modelInfo = GEMINI_MODELS[fullConfig.model];
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
            throw new Error(`Gemini rate limit exceeded. Please wait.`);
        }
        const startTime = Date.now();
        try {
            const url = `${this.baseUrl}/models/${this.config.model}:embedContent?key=${this.config.apiKey}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: `models/${this.config.model}`,
                    content: {
                        parts: [{ text }],
                    },
                }),
            });
            const latencyMs = Date.now() - startTime;
            if (!response.ok) {
                const errorData = (await response.json());
                this.updateMetrics(0, latencyMs, false);
                this.handleError(response.status, errorData.error?.message || 'Unknown error');
                throw new Error(`Gemini API error: ${errorData.error?.message}`);
            }
            const data = (await response.json());
            const embedding = data.embedding?.values;
            if (!embedding) {
                this.updateMetrics(0, latencyMs, false);
                throw new Error('No embedding returned from Gemini API');
            }
            // Gemini doesn't return token count, estimate based on text length
            const estimatedTokens = Math.ceil(text.length / 4);
            this.incrementRateLimit();
            this.updateMetrics(estimatedTokens, latencyMs, true);
            return {
                embedding,
                model: this.config.model,
                tokensUsed: estimatedTokens,
                provider: 'gemini',
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
            throw new Error(`Gemini rate limit exceeded. Please wait.`);
        }
        if (texts.length === 0) {
            return {
                embeddings: [],
                model: this.config.model,
                totalTokens: 0,
                successCount: 0,
                failedCount: 0,
                provider: 'gemini',
                latencyMs: 0,
            };
        }
        const startTime = Date.now();
        const embeddings = [];
        let totalTokens = 0;
        let failedCount = 0;
        // Gemini supports batch embedding via batchEmbedContents
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            try {
                const url = `${this.baseUrl}/models/${this.config.model}:batchEmbedContents?key=${this.config.apiKey}`;
                const requests = batch.map((text) => ({
                    model: `models/${this.config.model}`,
                    content: {
                        parts: [{ text }],
                    },
                }));
                const response = await fetch(url, {
                    signal: AbortSignal.timeout(30000),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ requests }),
                });
                if (!response.ok) {
                    const errorData = (await response.json());
                    this.handleError(response.status, errorData.error?.message || 'Unknown error');
                    failedCount += batch.length;
                    continue;
                }
                const data = (await response.json());
                for (const item of data.embeddings) {
                    if (item.values) {
                        embeddings.push(item.values);
                    }
                    else {
                        failedCount++;
                    }
                }
                // Estimate tokens
                const batchTokens = batch.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
                totalTokens += batchTokens;
                this.incrementRateLimit();
                // Rate limit delay between batches
                if (i + this.config.batchSize < texts.length) {
                    await this.delay(150); // 150ms between batches
                }
            }
            catch (error) {
                failedCount += batch.length;
                logger.error(`Gemini batch embedding error:${error}`);
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
            provider: 'gemini',
            latencyMs,
        };
    }
    // ---------------------------------------------------------------------------
    // API KEY VALIDATION
    // ---------------------------------------------------------------------------
    async validateApiKey() {
        try {
            const url = `${this.baseUrl}/models/${this.config.model}:embedContent?key=${this.config.apiKey}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: `models/${this.config.model}`,
                    content: {
                        parts: [{ text: 'test' }],
                    },
                }),
            });
            if (response.ok) {
                this.setStatus('available');
                return true;
            }
            if (response.status === 401 || response.status === 403) {
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
        logger.error(`Gemini error (${status}): ${message}`);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=gemini-provider.js.map