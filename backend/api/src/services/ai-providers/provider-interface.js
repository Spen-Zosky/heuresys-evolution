/**
 * AI Provider Interface
 * Abstract interface for AI embedding providers
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */
// =============================================================================
// ABSTRACT PROVIDER CLASS
// =============================================================================
export class AIEmbeddingProvider {
    config;
    rateLimitState;
    metrics;
    constructor(config) {
        this.config = config;
        this.rateLimitState = {
            requestsThisMinute: 0,
            minuteStart: Date.now(),
            isLimited: false,
        };
        this.metrics = {
            provider: config.name,
            requestCount: 0,
            tokenCount: 0,
            totalCost: 0,
            avgLatencyMs: 0,
            errorCount: 0,
            lastUsed: null,
            status: 'available',
        };
    }
    // Common methods
    getName() {
        return this.config.name;
    }
    getConfig() {
        return { ...this.config };
    }
    getMetrics() {
        return { ...this.metrics };
    }
    isAvailable() {
        return this.config.enabled && !this.rateLimitState.isLimited && this.metrics.status === 'available';
    }
    getDimensions() {
        return this.config.dimensions;
    }
    // Rate limiting
    checkRateLimit() {
        const now = Date.now();
        const minuteElapsed = now - this.rateLimitState.minuteStart;
        // Reset counter if minute has passed
        if (minuteElapsed >= 60000) {
            this.rateLimitState.requestsThisMinute = 0;
            this.rateLimitState.minuteStart = now;
            this.rateLimitState.isLimited = false;
        }
        // Check if at limit
        if (this.rateLimitState.requestsThisMinute >= this.config.rateLimitPerMinute) {
            this.rateLimitState.isLimited = true;
            this.metrics.status = 'rate_limited';
            return false;
        }
        return true;
    }
    incrementRateLimit() {
        this.rateLimitState.requestsThisMinute++;
    }
    // Metrics tracking
    updateMetrics(tokensUsed, latencyMs, success) {
        this.metrics.requestCount++;
        this.metrics.lastUsed = new Date();
        if (success) {
            this.metrics.tokenCount += tokensUsed;
            this.metrics.totalCost += (tokensUsed / 1000) * this.config.costPer1kTokens;
            // Running average for latency
            const prevTotal = this.metrics.avgLatencyMs * (this.metrics.requestCount - 1);
            this.metrics.avgLatencyMs = (prevTotal + latencyMs) / this.metrics.requestCount;
        }
        else {
            this.metrics.errorCount++;
        }
    }
    // Calculate estimated cost
    estimateCost(tokenCount) {
        return (tokenCount / 1000) * this.config.costPer1kTokens;
    }
    // Reset metrics (for testing or new period)
    resetMetrics() {
        this.metrics = {
            provider: this.config.name,
            requestCount: 0,
            tokenCount: 0,
            totalCost: 0,
            avgLatencyMs: 0,
            errorCount: 0,
            lastUsed: null,
            status: 'available',
        };
    }
    // Set status
    setStatus(status) {
        this.metrics.status = status;
    }
    // Enable/disable
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.metrics.status = 'disabled';
        }
        else if (this.metrics.status === 'disabled') {
            this.metrics.status = 'available';
        }
    }
}
//# sourceMappingURL=provider-interface.js.map