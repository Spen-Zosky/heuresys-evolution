/**
 * Embedding Generation Pipeline Service
 *
 * Provides a complete pipeline for generating, storing, and searching
 * vector embeddings using OpenAI's text-embedding-3-small model (1536 dimensions).
 *
 * Capabilities:
 * - Queue entities for embedding generation
 * - Process queue in batches with exponential backoff for rate limits
 * - Generate single and batch embeddings via OpenAI API
 * - Vector similarity search using pgvector cosine distance
 * - Re-index individual entities
 *
 * Tables used:
 * - embedding_queue: Queue management (status, priority, attempts)
 * - semantic_entity_index: Stored embeddings with pgvector
 */
import { Pool } from 'pg';
export interface QueueEntityParams {
    entityType: string;
    entityId: string;
    tenantId: string;
    textContent: string;
}
export interface ProcessingResult {
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
    durationMs: number;
}
export interface SimilarityResult {
    id: string;
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    entity_context: string;
    metadata: Record<string, unknown>;
    similarity: number;
}
export interface QueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
}
export declare class EmbeddingPipelineService {
    private pool;
    private apiKey;
    constructor(pool: Pool);
    /**
     * Load OpenAI API key from database config or environment variable.
     */
    loadApiKey(): Promise<void>;
    /**
     * Ensure API key is available, loading it if necessary.
     */
    private ensureApiKey;
    /**
     * Add an entity to the embedding queue for processing.
     *
     * Uses ON CONFLICT to handle the unique constraint (entity_type, entity_id, status).
     * If the same entity is already pending, the priority is updated if higher.
     */
    queueEntity(params: QueueEntityParams): Promise<string>;
    /**
     * Process pending items from the embedding queue.
     *
     * Fetches a batch of pending items, generates embeddings in bulk,
     * and stores them in semantic_entity_index.
     */
    processQueue(batchSize?: number): Promise<ProcessingResult>;
    /**
     * Process a batch of upsert items: fetch their text, generate embeddings, store.
     */
    private processUpsertBatch;
    /**
     * Generate a single embedding vector using OpenAI API.
     *
     * @param text - The text to embed (max 8000 chars)
     * @returns 1536-dimension embedding vector
     */
    generateEmbedding(text: string): Promise<number[]>;
    /**
     * Generate embeddings for multiple texts in a single API call.
     *
     * @param texts - Array of texts to embed
     * @returns Array of 1536-dimension embedding vectors (same order as input)
     */
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    /**
     * Call OpenAI embeddings API with exponential backoff for rate limits.
     */
    private fetchWithBackoff;
    /**
     * Search for similar entities using cosine distance.
     *
     * @param queryVector - The query embedding vector (1536 dimensions)
     * @param tenantId - Tenant scope for the search
     * @param limit - Maximum number of results
     * @param entityType - Optional filter by entity type
     * @returns Ranked list of similar entities with similarity scores
     */
    searchSimilar(queryVector: number[], tenantId: string, limit?: number, entityType?: string): Promise<SimilarityResult[]>;
    /**
     * Re-generate embedding for an existing entity.
     * Looks up the current entity_context from semantic_entity_index
     * and generates a fresh embedding.
     */
    reindexEntity(entityType: string, entityId: string, tenantId: string): Promise<void>;
    /**
     * Get queue statistics: counts by status.
     */
    getQueueStats(): Promise<QueueStats>;
    private markCompleted;
    private markFailed;
    /**
     * Escape a string literal for safe inclusion in SQL value positions.
     * Used only for constructing IN clause tuples where parameterized queries
     * cannot handle row-value comparisons.
     */
    private escapeLiteral;
    private sleep;
}
export declare function createEmbeddingPipeline(pool: Pool): EmbeddingPipelineService;
export declare function getEmbeddingPipeline(): EmbeddingPipelineService | null;
//# sourceMappingURL=embedding-pipeline.d.ts.map