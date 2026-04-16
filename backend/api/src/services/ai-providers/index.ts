/**
 * AI Providers Module
 * Exports for the AI provider abstraction layer
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-01 (AI Provider Abstraction Layer)
 * Created: 2025-12-22
 */

// Core interfaces and types
export {
  ProviderName,
  ProviderStatus,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderConfig,
  ProviderMetrics,
  RateLimitState,
  AIEmbeddingProvider,
  IProviderFactory,
} from './provider-interface.js';

// Provider implementations
export { OpenAIEmbeddingProvider, OPENAI_DEFAULT_CONFIG, OPENAI_MODELS } from './openai-provider.js';
export { GeminiEmbeddingProvider, GEMINI_DEFAULT_CONFIG, GEMINI_MODELS } from './gemini-provider.js';

// Factory
export {
  AIProviderFactory,
  getProviderFactory,
  initProviderFactory,
} from './provider-factory.js';
