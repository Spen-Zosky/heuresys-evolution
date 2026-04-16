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
import { validateTableName, validateIdentifier } from '../utils/sql-safety.js';
import { logger } from '../config/logger.js';

interface QueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  tenant_id: string | null;
  operation: 'upsert' | 'delete';
}

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

// Entity type to table and column mappings
const ENTITY_CONFIGS: Record<
  string,
  {
    table: string;
    textColumns: string[];
    contextTemplate: (row: Record<string, unknown>) => string;
    metadataColumns?: string[];
  }
> = {
  employee: {
    table: 'employees',
    textColumns: ['first_name', 'last_name', 'job_title', 'skills'],
    contextTemplate: (r) =>
      `${r.first_name} ${r.last_name} - ${r.job_title || ''} - ${Array.isArray(r.skills) ? r.skills.join(', ') : r.skills || ''}`,
    metadataColumns: ['skills'],
  },
  department: {
    table: 'departments',
    textColumns: ['name', 'description'],
    contextTemplate: (r) => `${r.name} - ${r.description || ''}`,
  },
  org_unit: {
    table: 'org_units',
    textColumns: ['name', 'org_type'],
    contextTemplate: (r) => `${r.name} (${r.org_type || 'unit'})`,
    metadataColumns: ['org_type'],
  },
  location: {
    table: 'locations',
    textColumns: ['name', 'address', 'city', 'country'],
    contextTemplate: (r) => `${r.name} - ${r.address || ''}, ${r.city || ''}, ${r.country || ''}`,
  },
  performance_review: {
    table: 'performance_reviews',
    textColumns: ['review_type', 'strengths', 'areas_for_improvement', 'manager_comments'],
    contextTemplate: (r) =>
      `Performance Review (${r.review_type || 'annual'}) - Strengths: ${r.strengths || ''} - Areas: ${r.areas_for_improvement || ''}`,
    metadataColumns: ['employee_id', 'review_type'],
  },
  check_in: {
    table: 'check_ins',
    textColumns: ['meeting_type', 'employee_notes', 'manager_notes', 'action_items'],
    contextTemplate: (r) =>
      `Check-in (${r.meeting_type || 'weekly'}) - ${r.employee_notes || ''} ${r.manager_notes || ''}`,
    metadataColumns: ['employee_id', 'meeting_type'],
  },
  feedback_360: {
    table: 'feedback_360',
    textColumns: ['strengths', 'areas_for_improvement', 'relationship_type'],
    contextTemplate: (r) =>
      `360 Feedback (${r.relationship_type || 'peer'}) - ${r.strengths || ''} - ${r.areas_for_improvement || ''}`,
    metadataColumns: ['target_employee_id', 'relationship_type'],
  },
  skill_gap_analysis: {
    table: 'skill_gap_analyses',
    textColumns: ['analysis_name', 'recommendations', 'priority_skills'],
    contextTemplate: (r) =>
      `Skill Gap: ${r.analysis_name || ''} - ${r.recommendations || ''} - Priority: ${Array.isArray(r.priority_skills) ? r.priority_skills.join(', ') : r.priority_skills || ''}`,
    metadataColumns: ['target_entity_type', 'overall_match_score'],
  },
  career_path: {
    table: 'career_paths',
    textColumns: ['name', 'description'],
    contextTemplate: (r) => `Career Path: ${r.name} - ${r.description || ''}`,
  },
  learning_path: {
    table: 'learning_paths',
    textColumns: ['title', 'description', 'target_role'],
    contextTemplate: (r) =>
      `Learning Path: ${r.title} - ${r.description || ''} - Target: ${r.target_role || ''}`,
    metadataColumns: ['skill_level', 'path_type'],
  },
  candidate: {
    table: 'recruiting_candidates',
    textColumns: ['first_name', 'last_name', 'job_title', 'skills', 'notes', 'current_company'],
    contextTemplate: (r) =>
      `${r.first_name} ${r.last_name} - ${r.job_title || ''} at ${r.current_company || ''} - Skills: ${Array.isArray(r.skills) ? r.skills.join(', ') : r.skills || ''}`,
    metadataColumns: ['experience_years', 'source'],
  },
};

export class EmbeddingQueueProcessor {
  private pool: Pool;
  private apiKey: string | null = null;
  private embeddingModel = 'text-embedding-3-small';
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Load OpenAI API key from database or environment
   */
  async loadApiKey(): Promise<void> {
    try {
      const result = await this.pool.query(`
        SELECT config_value FROM system_config
        WHERE config_key = 'openai_api_key'
        LIMIT 1
      `);

      if (result.rows.length > 0 && result.rows[0].config_value) {
        this.apiKey = result.rows[0].config_value;
        return;
      }
    } catch (_err) {
      logger.warn({ err: _err }, 'Silent catch in services.embedding-queue-processor');
    }

    // Fallback to environment variable
    if (process.env.OPENAI_API_KEY) {
      this.apiKey = process.env.OPENAI_API_KEY;
    }
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.apiKey) {
      await this.loadApiKey();
    }

    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const cleanText = text.slice(0, 8000).trim();
    if (!cleanText) {
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: cleanText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding || null;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const result = await this.pool.query(`
      SELECT
        status,
        entity_type,
        COUNT(*) as count
      FROM embedding_queue
      GROUP BY status, entity_type
    `);

    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      byEntityType: {},
    };

    for (const row of result.rows) {
      const count = parseInt(row.count, 10);

      // Aggregate by status
      if (row.status === 'pending') stats.pending += count;
      else if (row.status === 'processing') stats.processing += count;
      else if (row.status === 'completed') stats.completed += count;
      else if (row.status === 'failed') stats.failed += count;

      // Aggregate pending by entity type
      if (row.status === 'pending') {
        stats.byEntityType[row.entity_type] = (stats.byEntityType[row.entity_type] || 0) + count;
      }
    }

    return stats;
  }

  /**
   * Fetch entity data for embedding generation
   */
  private async fetchEntityData(
    entityType: string,
    entityId: string
  ): Promise<{
    name: string;
    context: string;
    tenantId: string | null;
    metadata: Record<string, unknown>;
  } | null> {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      logger.warn(`Unknown entity type: ${entityType}`);
      return null;
    }

    const validatedTable = validateTableName(
      config.table,
      `EmbeddingQueue.fetchEntityData(${entityType})`
    );

    const columns = ['id', 'tenant_id', ...config.textColumns];
    if (config.metadataColumns) {
      columns.push(...config.metadataColumns);
    }

    // Validate all column identifiers
    const validatedColumns = columns.map((col) =>
      validateIdentifier(col, `EmbeddingQueue.fetchEntityData(${entityType}).columns`)
    );

    const result = await this.pool.query(
      `SELECT ${validatedColumns.join(', ')} FROM ${validatedTable} WHERE id = $1`,
      [entityId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const context = config.contextTemplate(row);

    // Build entity name
    let name = '';
    if (row.name) name = row.name;
    else if (row.title) name = row.title;
    else if (row.first_name && row.last_name) name = `${row.first_name} ${row.last_name}`;
    else if (row.analysis_name) name = row.analysis_name;
    else name = `${entityType} ${entityId.slice(0, 8)}`;

    // Build metadata
    const metadata: Record<string, unknown> = {};
    if (config.metadataColumns) {
      for (const col of config.metadataColumns) {
        if (row[col] !== undefined && row[col] !== null) {
          metadata[col] = row[col];
        }
      }
    }

    return {
      name,
      context,
      tenantId: row.tenant_id,
      metadata,
    };
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: QueueItem): Promise<void> {
    if (item.operation === 'delete') {
      // Remove from semantic index
      await this.pool.query(
        `DELETE FROM semantic_entity_index WHERE entity_type = $1 AND entity_id = $2`,
        [item.entity_type, item.entity_id]
      );
      return;
    }

    // Fetch entity data
    const entityData = await this.fetchEntityData(item.entity_type, item.entity_id);
    if (!entityData) {
      throw new Error(`Entity not found: ${item.entity_type}/${item.entity_id}`);
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(entityData.context);
    if (!embedding) {
      throw new Error('Failed to generate embedding - empty text');
    }

    // Upsert into semantic_entity_index
    await this.pool.query(
      `
      INSERT INTO semantic_entity_index (
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
        updated_at = NOW()
    `,
      [
        entityData.tenantId,
        item.entity_type,
        item.entity_id,
        entityData.name,
        entityData.context,
        JSON.stringify(embedding),
        this.embeddingModel,
        JSON.stringify(entityData.metadata),
      ]
    );
  }

  /**
   * Process a batch of queue items
   */
  async processBatch(batchSize: number = 50): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
    };

    if (this.isProcessing) {
      return result;
    }

    this.isProcessing = true;

    try {
      // Reset stuck items
      await this.pool.query(`SELECT fn_reset_stuck_embedding_queue()`);

      // Get batch of items
      const batchResult = await this.pool.query(`SELECT * FROM fn_get_embedding_queue_batch($1)`, [
        batchSize,
      ]);

      const items: QueueItem[] = batchResult.rows;
      result.processed = items.length;

      if (items.length === 0) {
        return result;
      }

      const succeededIds: string[] = [];

      for (const item of items) {
        try {
          await this.processQueueItem(item);
          succeededIds.push(item.id);
          result.succeeded++;
        } catch (error) {
          result.failed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`${item.entity_type}/${item.entity_id}: ${errorMsg}`);

          // Mark as failed
          await this.pool.query(`SELECT fn_fail_embedding_queue($1, $2)`, [item.id, errorMsg]);
        }
      }

      // Mark succeeded items as completed
      if (succeededIds.length > 0) {
        await this.pool.query(`SELECT fn_complete_embedding_queue($1)`, [succeededIds]);
      }
    } finally {
      this.isProcessing = false;
      result.durationMs = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Start background processing
   */
  startBackgroundProcessing(intervalMs: number = 30000, batchSize: number = 50): void {
    if (this.processingInterval) {
      logger.info('Background processing already running');
      return;
    }

    logger.info(
      `Starting embedding queue processor (interval: ${intervalMs}ms, batch: ${batchSize})`
    );

    // Process immediately on start
    this.processBatch(batchSize)
      .then((result) => {
        if (result.processed > 0) {
          logger.info(
            `Embedding queue processed: ${result.succeeded}/${result.processed} succeeded`
          );
        }
      })
      .catch((err) => {
        logger.error({ err: err }, 'Error processing embedding queue:');
      });

    // Then process at interval
    this.processingInterval = setInterval(async () => {
      try {
        const result = await this.processBatch(batchSize);
        if (result.processed > 0) {
          logger.info(
            `Embedding queue processed: ${result.succeeded}/${result.processed} succeeded`
          );
          if (result.errors.length > 0) {
            logger.warn(`Embedding errors: ${String(result.errors.slice(0))}`);
          }
        }
      } catch (error) {
        logger.error({ err: error }, 'Error in embedding queue processor:');
      }
    }, intervalMs);
  }

  /**
   * Stop background processing
   */
  stopBackgroundProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Embedding queue processor stopped');
    }
  }

  /**
   * Cleanup old completed entries
   */
  async cleanup(daysToKeep: number = 7): Promise<number> {
    const result = await this.pool.query(`SELECT fn_cleanup_embedding_queue($1)`, [daysToKeep]);
    return result.rows[0]?.fn_cleanup_embedding_queue || 0;
  }

  /**
   * Retry failed items
   */
  async retryFailed(): Promise<number> {
    const result = await this.pool.query(`
      UPDATE embedding_queue
      SET status = 'pending', attempts = 0, error_message = NULL
      WHERE status = 'failed'
    `);
    return result.rowCount || 0;
  }
}

// Singleton instance
let queueProcessor: EmbeddingQueueProcessor | null = null;

export function createEmbeddingQueueProcessor(pool: Pool): EmbeddingQueueProcessor {
  if (!queueProcessor) {
    queueProcessor = new EmbeddingQueueProcessor(pool);
  }
  return queueProcessor;
}

export function getEmbeddingQueueProcessor(): EmbeddingQueueProcessor | null {
  return queueProcessor;
}
