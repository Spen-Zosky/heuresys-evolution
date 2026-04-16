/**
 * Embedding Queue Processor
 *
 * Processes the embedding_queue table asynchronously,
 * generating embeddings for new/updated entities.
 *
 * @author Claude
 * @date 2025-12-22
 */
import { Pool } from 'pg';
interface QueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    byEntityType: Record<string, number>;
}
interface ProcessingResult {
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
    durationMs: number;
}
export declare class EmbeddingQueueProcessor {
    private pool;
    private apiKey;
    private embeddingModel;
    private isProcessing;
    private processingInterval;
    constructor(pool: Pool);
    /**
     * Load OpenAI API key from database or environment
     */
    loadApiKey(): Promise<void>;
    /**
     * Generate embedding using OpenAI API
     */
    private generateEmbedding;
    /**
     * Get queue statistics
     */
    getQueueStats(): Promise<QueueStats>;
    /**
     * Fetch entity data for embedding generation
     */
    private fetchEntityData;
    /**
     * Process a single queue item
     */
    private processQueueItem;
    /**
     * Process a batch of queue items
     */
    processBatch(batchSize?: number): Promise<ProcessingResult>;
    /**
     * Start background processing
     */
    startBackgroundProcessing(intervalMs?: number, batchSize?: number): void;
    /**
     * Stop background processing
     */
    stopBackgroundProcessing(): void;
    /**
     * Cleanup old completed entries
     */
    cleanup(daysToKeep?: number): Promise<number>;
    /**
     * Retry failed items
     */
    retryFailed(): Promise<number>;
}
export declare function createEmbeddingQueueProcessor(pool: Pool): EmbeddingQueueProcessor;
export declare function getEmbeddingQueueProcessor(): EmbeddingQueueProcessor | null;
export {};
//# sourceMappingURL=embedding-queue-processor.d.ts.map