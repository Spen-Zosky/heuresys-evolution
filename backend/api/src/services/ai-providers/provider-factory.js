/**
 * AI Provider Factory
 * Factory pattern for AI provider instantiation with fallback support
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
import { pool } from '../../config/database.js';
import { OpenAIEmbeddingProvider } from './openai-provider.js';
import { GeminiEmbeddingProvider } from './gemini-provider.js';
import { logger } from '../../config/logger.js';
// =============================================================================
// PROVIDER FACTORY
// =============================================================================
export class AIProviderFactory {
    providers = new Map();
    defaultProvider = 'openai';
    initialized = false;
    constructor() {
        // Providers will be initialized when init() is called
    }
    // ---------------------------------------------------------------------------
    // INITIALIZATION
    // ---------------------------------------------------------------------------
    async init() {
        if (this.initialized)
            return;
        // Load configuration from environment
        const openaiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        // Initialize OpenAI if key available
        if (openaiKey) {
            const openai = new OpenAIEmbeddingProvider({
                apiKey: openaiKey,
                model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
            });
            this.providers.set('openai', openai);
            logger.info('OpenAI embedding provider initialized');
        }
        // Initialize Gemini if key available
        if (geminiKey) {
            const gemini = new GeminiEmbeddingProvider({
                apiKey: geminiKey,
                model: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
            });
            this.providers.set('gemini', gemini);
            logger.info('Gemini embedding provider initialized');
        }
        // Set default provider from env or fallback to first available
        const envDefault = process.env.DEFAULT_EMBEDDING_PROVIDER;
        if (envDefault && this.providers.has(envDefault)) {
            this.defaultProvider = envDefault;
        }
        else if (this.providers.size > 0) {
            const firstKey = this.providers.keys().next().value;
            if (firstKey) {
                this.defaultProvider = firstKey;
            }
        }
        this.initialized = true;
        logger.info(`AI Provider Factory initialized. Default: ${this.defaultProvider}`);
    }
    // ---------------------------------------------------------------------------
    // PROVIDER ACCESS
    // ---------------------------------------------------------------------------
    getProvider(name) {
        const providerName = name || this.defaultProvider;
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider '${providerName}' not configured. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return provider;
    }
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    getAvailableProviders() {
        return Array.from(this.providers.values()).filter((p) => p.isAvailable());
    }
    getFallbackProvider(excludeProvider) {
        // Get available providers sorted by priority (lower = higher priority)
        const available = this.getAvailableProviders()
            .filter((p) => p.getName() !== excludeProvider)
            .sort((a, b) => a.getConfig().priority - b.getConfig().priority);
        return available[0] ?? null;
    }
    getMetrics() {
        return Array.from(this.providers.values()).map((p) => p.getMetrics());
    }
    // ---------------------------------------------------------------------------
    // EMBEDDING WITH FALLBACK
    // ---------------------------------------------------------------------------
    async generateEmbedding(text, preferredProvider) {
        // Ensure initialized before use
        await this.init();
        const primaryProvider = this.getProvider(preferredProvider);
        try {
            if (primaryProvider.isAvailable()) {
                return await primaryProvider.generateEmbedding(text);
            }
        }
        catch (error) {
            logger.warn(`Primary provider ${primaryProvider.getName()} failed:${error}`);
        }
        // Try fallback
        const fallback = this.getFallbackProvider(primaryProvider.getName());
        if (fallback) {
            logger.info(`Falling back to ${fallback.getName()}`);
            return await fallback.generateEmbedding(text);
        }
        throw new Error('All embedding providers failed or unavailable');
    }
    async generateBatchEmbeddings(texts, preferredProvider) {
        // Ensure initialized before use
        await this.init();
        const primaryProvider = this.getProvider(preferredProvider);
        try {
            if (primaryProvider.isAvailable()) {
                return await primaryProvider.generateBatchEmbeddings(texts);
            }
        }
        catch (error) {
            logger.warn(`Primary provider ${primaryProvider.getName()} failed:${error}`);
        }
        // Try fallback
        const fallback = this.getFallbackProvider(primaryProvider.getName());
        if (fallback) {
            logger.info(`Falling back to ${fallback.getName()}`);
            return await fallback.generateBatchEmbeddings(texts);
        }
        throw new Error('All embedding providers failed or unavailable');
    }
    // ---------------------------------------------------------------------------
    // METRICS PERSISTENCE
    // ---------------------------------------------------------------------------
    async saveMetricsToDb() {
        const metrics = this.getMetrics();
        for (const m of metrics) {
            try {
                await pool.query(`
          INSERT INTO ai_provider_metrics
            (provider, request_count, token_count, total_cost, avg_latency_ms, error_count, status, recorded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
                    m.provider,
                    m.requestCount,
                    m.tokenCount,
                    m.totalCost,
                    m.avgLatencyMs,
                    m.errorCount,
                    m.status,
                ]);
            }
            catch (error) {
                logger.error(`Failed to save metrics for ${m.provider}:${error}`);
            }
        }
    }
    async loadCostSummary(provider, since) {
        const whereClause = [];
        const params = [];
        let paramIndex = 1;
        if (provider) {
            whereClause.push(`provider = $${paramIndex++}`);
            params.push(provider);
        }
        if (since) {
            whereClause.push(`recorded_at >= $${paramIndex++}`);
            params.push(since);
        }
        const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        const result = await pool.query(`
      SELECT
        provider,
        SUM(request_count) as total_requests,
        SUM(token_count) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(avg_latency_ms) as avg_latency
      FROM ai_provider_metrics
      ${where}
      GROUP BY provider
      ORDER BY total_cost DESC
    `, params);
        return result.rows.map((row) => ({
            provider: row.provider,
            totalRequests: parseInt(row.total_requests) || 0,
            totalTokens: parseInt(row.total_tokens) || 0,
            totalCost: parseFloat(row.total_cost) || 0,
            avgLatency: parseFloat(row.avg_latency) || 0,
        }));
    }
    // ---------------------------------------------------------------------------
    // HEALTH CHECK
    // ---------------------------------------------------------------------------
    async healthCheck() {
        const providerStatus = {};
        let availableCount = 0;
        for (const [name, provider] of this.providers) {
            const isValid = await provider.validateApiKey();
            providerStatus[name] = {
                available: isValid && provider.isAvailable(),
                status: provider.getMetrics().status,
            };
            if (providerStatus[name].available)
                availableCount++;
        }
        let status;
        if (availableCount === this.providers.size) {
            status = 'healthy';
        }
        else if (availableCount > 0) {
            status = 'degraded';
        }
        else {
            status = 'unhealthy';
        }
        return {
            status,
            providers: providerStatus,
        };
    }
}
// =============================================================================
// SINGLETON INSTANCE
// =============================================================================
let factoryInstance = null;
let initPromise = null;
export function getProviderFactory() {
    if (!factoryInstance) {
        factoryInstance = new AIProviderFactory();
        // Auto-init in background for sync callers
        // The init will complete before embeddings are generated
        initPromise = factoryInstance.init().catch((err) => {
            logger.error({ err: err }, 'Failed to auto-init provider factory:');
        });
    }
    return factoryInstance;
}
export async function initProviderFactory() {
    const factory = getProviderFactory();
    // Wait for any pending initialization
    if (initPromise) {
        await initPromise;
    }
    // Ensure initialized (idempotent)
    await factory.init();
    return factory;
}
//# sourceMappingURL=provider-factory.js.map