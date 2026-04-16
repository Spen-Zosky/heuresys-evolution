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
import { logger } from '../config/logger.js';

// =============================================================================
// TYPES
// =============================================================================

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

interface QueueRow {
  id: string;
  entity_type: string;
  entity_id: string;
  tenant_id: string;
  operation: string;
  status: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TEXT_LENGTH = 8000;
const MAX_BATCH_SIZE = 2048; // OpenAI batch limit
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;
const MAX_RETRIES = 5;

// =============================================================================
// EMBEDDING PIPELINE SERVICE
// =============================================================================

export class EmbeddingPipelineService {
  private pool: Pool;
  private apiKey: string | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Load OpenAI API key from database config or environment variable.
   */
  async loadApiKey(): Promise<void> {
    // Try database first
    try {
      const result = await this.pool.query(
        `SELECT config_value FROM system_config WHERE config_key = 'openai_api_key' LIMIT 1`
      );
      if (result.rows.length > 0 && result.rows[0].config_value) {
        this.apiKey = result.rows[0].config_value;
        return;
      }
    } catch (_err) {
      logger.warn({ err: _err }, 'Silent catch in services.embedding-pipeline');
    }

    // Fallback to environment variable
    if (process.env.OPENAI_API_KEY) {
      this.apiKey = process.env.OPENAI_API_KEY;
    }
  }

  /**
   * Ensure API key is available, loading it if necessary.
   */
  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      await this.loadApiKey();
    }
    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key not configured. Set OPENAI_API_KEY env var or system_config row.'
      );
    }
    return this.apiKey;
  }

  // ===========================================================================
  // QUEUE MANAGEMENT
  // ===========================================================================

  /**
   * Add an entity to the embedding queue for processing.
   *
   * Uses ON CONFLICT to handle the unique constraint (entity_type, entity_id, status).
   * If the same entity is already pending, the priority is updated if higher.
   */
  async queueEntity(params: QueueEntityParams): Promise<string> {
    const { entityType, entityId, tenantId, textContent } = params;

    if (!entityType || !entityId || !tenantId) {
      throw new Error('entityType, entityId, and tenantId are required');
    }

    // First, store or update the text content in semantic_entity_index
    // so the queue processor can find it. We store the raw text as entity_context
    // and generate the embedding later during processing.
    const cleanText = textContent.slice(0, MAX_TEXT_LENGTH).trim();

    // Insert into queue
    const result = await this.pool.query(
      `INSERT INTO embedding_queue (entity_type, entity_id, tenant_id, operation, priority, status)
       VALUES ($1, $2, $3, 'upsert', 5, 'pending')
       ON CONFLICT (entity_type, entity_id, status)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         priority = LEAST(embedding_queue.priority, EXCLUDED.priority),
         attempts = 0,
         error_message = NULL,
         created_at = NOW()
       WHERE embedding_queue.status = 'pending'
       RETURNING id`,
      [entityType, entityId, tenantId]
    );

    const queueId = result.rows[0]?.id as string | undefined;

    // Pre-store the text content so processQueue can generate the embedding
    // Upsert into semantic_entity_index with NULL embedding (to be filled by processQueue)
    await this.pool.query(
      `INSERT INTO semantic_entity_index (
         tenant_id, entity_type, entity_id, entity_name, entity_context,
         embedding_model, is_active, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, true, '{}'::jsonb)
       ON CONFLICT (tenant_id, entity_type, entity_id)
       DO UPDATE SET
         entity_context = EXCLUDED.entity_context,
         updated_at = NOW()`,
      [
        tenantId,
        entityType,
        entityId,
        `${entityType}:${entityId.slice(0, 8)}`,
        cleanText,
        EMBEDDING_MODEL,
      ]
    );

    return queueId ?? entityId;
  }

  // ===========================================================================
  // QUEUE PROCESSING
  // ===========================================================================

  /**
   * Process pending items from the embedding queue.
   *
   * Fetches a batch of pending items, generates embeddings in bulk,
   * and stores them in semantic_entity_index.
   */
  async processQueue(batchSize: number = 50): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
    };

    const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);

    // Claim a batch of pending items (mark as 'processing')
    const batchResult = await this.pool.query(
      `UPDATE embedding_queue
       SET status = 'processing', processed_at = NOW()
       WHERE id IN (
         SELECT id FROM embedding_queue
         WHERE status = 'pending' AND attempts < max_attempts
         ORDER BY priority ASC, created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, entity_type, entity_id, tenant_id, operation, status, attempts, max_attempts, error_message`,
      [effectiveBatchSize]
    );

    const items: QueueRow[] = batchResult.rows;
    result.processed = items.length;

    if (items.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Separate upserts from deletes
    const upsertItems = items.filter((i) => i.operation === 'upsert');
    const deleteItems = items.filter((i) => i.operation === 'delete');

    // Handle deletes
    for (const item of deleteItems) {
      try {
        await this.pool.query(
          `DELETE FROM semantic_entity_index WHERE entity_type = $1 AND entity_id = $2`,
          [item.entity_type, item.entity_id]
        );
        await this.markCompleted(item.id);
        result.succeeded++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`delete ${item.entity_type}/${item.entity_id}: ${msg}`);
        await this.markFailed(item.id, msg);
        result.failed++;
      }
    }

    // Handle upserts: fetch text content, generate embeddings in batch, store
    if (upsertItems.length > 0) {
      await this.processUpsertBatch(upsertItems, result);
    }

    result.durationMs = Date.now() - startTime;

    logger.info(
      `[EmbeddingPipeline] Processed ${result.processed} items: ` +
        `${result.succeeded} succeeded, ${result.failed} failed in ${result.durationMs}ms`
    );

    return result;
  }

  /**
   * Process a batch of upsert items: fetch their text, generate embeddings, store.
   */
  private async processUpsertBatch(items: QueueRow[], result: ProcessingResult): Promise<void> {
    // Fetch text content for all items from semantic_entity_index
    const entityKeys = items.map(
      (i) => `(${this.escapeLiteral(i.entity_type)}, ${this.escapeLiteral(i.entity_id)})`
    );

    const textResult = await this.pool.query(
      `SELECT entity_type, entity_id, tenant_id, entity_name, entity_context, metadata
       FROM semantic_entity_index
       WHERE (entity_type, entity_id) IN (${entityKeys.join(', ')})`
    );

    const textMap = new Map<
      string,
      { context: string; name: string; tenantId: string; metadata: Record<string, unknown> }
    >();
    for (const row of textResult.rows) {
      const key = `${row.entity_type}:${row.entity_id}`;
      textMap.set(key, {
        context: row.entity_context ?? '',
        name: row.entity_name ?? '',
        tenantId: row.tenant_id,
        metadata: row.metadata ?? {},
      });
    }

    // Collect texts for batch embedding
    const textsToEmbed: string[] = [];
    const itemsWithText: Array<{
      item: QueueRow;
      text: string;
      entityData: { name: string; tenantId: string; metadata: Record<string, unknown> };
    }> = [];

    for (const item of items) {
      const key = `${item.entity_type}:${item.entity_id}`;
      const data = textMap.get(key);

      if (!data || !data.context.trim()) {
        const msg = `No text content found for ${item.entity_type}/${item.entity_id}`;
        result.errors.push(msg);
        await this.markFailed(item.id, msg);
        result.failed++;
        continue;
      }

      const cleanText = data.context.slice(0, MAX_TEXT_LENGTH).trim();
      textsToEmbed.push(cleanText);
      itemsWithText.push({
        item,
        text: cleanText,
        entityData: { name: data.name, tenantId: data.tenantId, metadata: data.metadata },
      });
    }

    if (textsToEmbed.length === 0) {
      return;
    }

    // Generate embeddings in batch
    let embeddings: number[][];
    try {
      embeddings = await this.generateEmbeddings(textsToEmbed);
    } catch (error) {
      // If batch fails, mark all as failed
      const msg = error instanceof Error ? error.message : String(error);
      for (const entry of itemsWithText) {
        result.errors.push(`embedding ${entry.item.entity_type}/${entry.item.entity_id}: ${msg}`);
        await this.markFailed(entry.item.id, msg);
        result.failed++;
      }
      return;
    }

    // Store embeddings using individual upserts (pgvector array format)
    for (let i = 0; i < itemsWithText.length; i++) {
      const entry = itemsWithText[i];
      const embedding = embeddings[i];

      if (!entry || !embedding) {
        continue;
      }

      try {
        await this.pool.query(
          `INSERT INTO semantic_entity_index (
             tenant_id, entity_type, entity_id, entity_name, entity_context,
             embedding, embedding_model, embedding_generated_at,
             metadata, is_active
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, true)
           ON CONFLICT (tenant_id, entity_type, entity_id)
           DO UPDATE SET
             entity_name = EXCLUDED.entity_name,
             entity_context = EXCLUDED.entity_context,
             embedding = EXCLUDED.embedding,
             embedding_model = EXCLUDED.embedding_model,
             embedding_generated_at = NOW(),
             metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
          [
            entry.entityData.tenantId,
            entry.item.entity_type,
            entry.item.entity_id,
            entry.entityData.name,
            entry.text,
            `[${embedding.join(',')}]`,
            EMBEDDING_MODEL,
            JSON.stringify(entry.entityData.metadata),
          ]
        );

        await this.markCompleted(entry.item.id);
        result.succeeded++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`store ${entry.item.entity_type}/${entry.item.entity_id}: ${msg}`);
        await this.markFailed(entry.item.id, msg);
        result.failed++;
      }
    }
  }

  // ===========================================================================
  // EMBEDDING GENERATION
  // ===========================================================================

  /**
   * Generate a single embedding vector using OpenAI API.
   *
   * @param text - The text to embed (max 8000 chars)
   * @returns 1536-dimension embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = await this.ensureApiKey();
    const cleanText = text.slice(0, MAX_TEXT_LENGTH).trim();

    if (!cleanText) {
      throw new Error('Cannot generate embedding for empty text');
    }

    const response = await this.fetchWithBackoff(apiKey, [cleanText]);
    const embedding = response.data[0]?.embedding;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding?.length ?? 0}`
      );
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts in a single API call.
   *
   * @param texts - Array of texts to embed
   * @returns Array of 1536-dimension embedding vectors (same order as input)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const apiKey = await this.ensureApiKey();
    const cleanTexts = texts
      .map((t) => t.slice(0, MAX_TEXT_LENGTH).trim())
      .filter((t) => t.length > 0);

    if (cleanTexts.length === 0) {
      throw new Error('All input texts are empty after cleaning');
    }

    // OpenAI batch endpoint supports up to 2048 inputs
    const results: number[][] = [];

    for (let i = 0; i < cleanTexts.length; i += MAX_BATCH_SIZE) {
      const batch = cleanTexts.slice(i, i + MAX_BATCH_SIZE);
      const response = await this.fetchWithBackoff(apiKey, batch);

      // Sort by index to preserve order
      const sortedData = response.data.sort((a, b) => a.index - b.index);

      for (const item of sortedData) {
        results.push(item.embedding);
      }
    }

    return results;
  }

  /**
   * Call OpenAI embeddings API with exponential backoff for rate limits.
   */
  private async fetchWithBackoff(
    apiKey: string,
    input: string[]
  ): Promise<OpenAIEmbeddingResponse> {
    let lastError: Error | null = null;
    let backoff = INITIAL_BACKOFF_MS;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          signal: AbortSignal.timeout(30000),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input,
          }),
        });

        if (response.ok) {
          return (await response.json()) as OpenAIEmbeddingResponse;
        }

        // Rate limit (429) or server error (5xx): retry with backoff
        if (response.status === 429 || response.status >= 500) {
          const errorText = await response.text();
          lastError = new Error(`OpenAI API error ${response.status}: ${errorText}`);

          // Check for Retry-After header
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoff;

          logger.warn(
            `[EmbeddingPipeline] Rate limited (${response.status}), ` +
              `retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );

          await this.sleep(Math.min(waitMs, MAX_BACKOFF_MS));
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          continue;
        }

        // Client error (4xx, not 429): do not retry
        const errorText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('OpenAI API error')) {
          throw error;
        }
        // Network error: retry
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          `[EmbeddingPipeline] Network error, retrying in ${backoff}ms ` +
            `(attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message}`
        );

        await this.sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    }

    throw lastError ?? new Error('Max retries exceeded for OpenAI API call');
  }

  // ===========================================================================
  // SIMILARITY SEARCH
  // ===========================================================================

  /**
   * Search for similar entities using cosine distance.
   *
   * @param queryVector - The query embedding vector (1536 dimensions)
   * @param tenantId - Tenant scope for the search
   * @param limit - Maximum number of results
   * @param entityType - Optional filter by entity type
   * @returns Ranked list of similar entities with similarity scores
   */
  async searchSimilar(
    queryVector: number[],
    tenantId: string,
    limit: number = 10,
    entityType?: string
  ): Promise<SimilarityResult[]> {
    if (queryVector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Query vector must have ${EMBEDDING_DIMENSIONS} dimensions, got ${queryVector.length}`
      );
    }

    const vectorStr = `[${queryVector.join(',')}]`;

    let query: string;
    let params: unknown[];

    if (entityType) {
      query = `
        SELECT
          id, tenant_id, entity_type, entity_id, entity_name, entity_context, metadata,
          1 - (embedding <=> $1::vector) AS similarity
        FROM semantic_entity_index
        WHERE tenant_id = $2
          AND entity_type = $3
          AND is_active = true
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $4`;
      params = [vectorStr, tenantId, entityType, limit];
    } else {
      query = `
        SELECT
          id, tenant_id, entity_type, entity_id, entity_name, entity_context, metadata,
          1 - (embedding <=> $1::vector) AS similarity
        FROM semantic_entity_index
        WHERE tenant_id = $2
          AND is_active = true
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $3`;
      params = [vectorStr, tenantId, limit];
    }

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_name: row.entity_name,
      entity_context: row.entity_context,
      metadata: row.metadata ?? {},
      similarity: parseFloat(row.similarity),
    }));
  }

  // ===========================================================================
  // RE-INDEX
  // ===========================================================================

  /**
   * Re-generate embedding for an existing entity.
   * Looks up the current entity_context from semantic_entity_index
   * and generates a fresh embedding.
   */
  async reindexEntity(entityType: string, entityId: string, tenantId: string): Promise<void> {
    // Fetch current text content
    const existingResult = await this.pool.query(
      `SELECT entity_context FROM semantic_entity_index
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [tenantId, entityType, entityId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error(`Entity not found in semantic index: ${entityType}/${entityId}`);
    }

    const text = existingResult.rows[0].entity_context as string;
    if (!text || !text.trim()) {
      throw new Error(`Entity has no text content to embed: ${entityType}/${entityId}`);
    }

    // Generate fresh embedding
    const embedding = await this.generateEmbedding(text);

    // Update the embedding in-place
    await this.pool.query(
      `UPDATE semantic_entity_index
       SET embedding = $1,
           embedding_model = $2,
           embedding_generated_at = NOW(),
           updated_at = NOW()
       WHERE tenant_id = $3 AND entity_type = $4 AND entity_id = $5`,
      [`[${embedding.join(',')}]`, EMBEDDING_MODEL, tenantId, entityType, entityId]
    );
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get queue statistics: counts by status.
   */
  async getQueueStats(): Promise<QueueStats> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) AS total
      FROM embedding_queue
    `);

    const row = result.rows[0];
    return {
      pending: parseInt(row.pending, 10),
      processing: parseInt(row.processing, 10),
      completed: parseInt(row.completed, 10),
      failed: parseInt(row.failed, 10),
      total: parseInt(row.total, 10),
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async markCompleted(queueId: string): Promise<void> {
    await this.pool.query(
      `UPDATE embedding_queue SET status = 'completed', processed_at = NOW() WHERE id = $1`,
      [queueId]
    );
  }

  private async markFailed(queueId: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE embedding_queue
       SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
           attempts = attempts + 1,
           error_message = $2,
           processed_at = NOW()
       WHERE id = $1`,
      [queueId, errorMessage.slice(0, 1000)]
    );
  }

  /**
   * Escape a string literal for safe inclusion in SQL value positions.
   * Used only for constructing IN clause tuples where parameterized queries
   * cannot handle row-value comparisons.
   */
  private escapeLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: EmbeddingPipelineService | null = null;

export function createEmbeddingPipeline(pool: Pool): EmbeddingPipelineService {
  if (!instance) {
    instance = new EmbeddingPipelineService(pool);
  }
  return instance;
}

export function getEmbeddingPipeline(): EmbeddingPipelineService | null {
  return instance;
}
