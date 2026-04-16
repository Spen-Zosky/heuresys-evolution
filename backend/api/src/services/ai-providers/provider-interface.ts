/**
 * AI Provider Interface
 * Abstract interface for AI embedding providers
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

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
  priority: number; // Lower = higher priority for fallback
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

// =============================================================================
// ABSTRACT PROVIDER CLASS
// =============================================================================

export abstract class AIEmbeddingProvider {
  protected config: ProviderConfig;
  protected rateLimitState: RateLimitState;
  protected metrics: ProviderMetrics;

  constructor(config: ProviderConfig) {
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

  // Abstract methods to be implemented by each provider
  abstract generateEmbedding(text: string): Promise<EmbeddingResult>;
  abstract generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
  abstract validateApiKey(): Promise<boolean>;

  // Common methods
  getName(): ProviderName {
    return this.config.name;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  isAvailable(): boolean {
    return this.config.enabled && !this.rateLimitState.isLimited && this.metrics.status === 'available';
  }

  getDimensions(): number {
    return this.config.dimensions;
  }

  // Rate limiting
  protected checkRateLimit(): boolean {
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

  protected incrementRateLimit(): void {
    this.rateLimitState.requestsThisMinute++;
  }

  // Metrics tracking
  protected updateMetrics(tokensUsed: number, latencyMs: number, success: boolean): void {
    this.metrics.requestCount++;
    this.metrics.lastUsed = new Date();

    if (success) {
      this.metrics.tokenCount += tokensUsed;
      this.metrics.totalCost += (tokensUsed / 1000) * this.config.costPer1kTokens;

      // Running average for latency
      const prevTotal = this.metrics.avgLatencyMs * (this.metrics.requestCount - 1);
      this.metrics.avgLatencyMs = (prevTotal + latencyMs) / this.metrics.requestCount;
    } else {
      this.metrics.errorCount++;
    }
  }

  // Calculate estimated cost
  estimateCost(tokenCount: number): number {
    return (tokenCount / 1000) * this.config.costPer1kTokens;
  }

  // Reset metrics (for testing or new period)
  resetMetrics(): void {
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
  setStatus(status: ProviderStatus): void {
    this.metrics.status = status;
  }

  // Enable/disable
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.metrics.status = 'disabled';
    } else if (this.metrics.status === 'disabled') {
      this.metrics.status = 'available';
    }
  }
}

// =============================================================================
// PROVIDER FACTORY INTERFACE
// =============================================================================

export interface IProviderFactory {
  getProvider(name?: ProviderName): AIEmbeddingProvider;
  getAllProviders(): AIEmbeddingProvider[];
  getAvailableProviders(): AIEmbeddingProvider[];
  getFallbackProvider(excludeProvider?: ProviderName): AIEmbeddingProvider | null;
  getMetrics(): ProviderMetrics[];
}
