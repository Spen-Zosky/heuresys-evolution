/**
 * Unified Semantic Service
 *
 * Provides cross-domain semantic search capabilities across all HR entities:
 * - Core HR: employees, departments, org_units, locations
 * - Performance: reviews, check-ins, feedback
 * - Talent: skill gaps, career paths, succession
 * - Learning: paths, courses
 * - Recruiting: candidates, job postings
 *
 * @author Claude
 * @date 2025-12-22
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { logger } from '../config/logger.js';

// =============================================================================
// Types & Interfaces
// =============================================================================

export type SemanticEntityType =
  | 'employee'
  | 'department'
  | 'org_unit'
  | 'location'
  | 'performance_review'
  | 'check_in'
  | 'feedback_360'
  | 'skill_gap_analysis'
  | 'career_path'
  | 'learning_path'
  | 'candidate'
  | 'job_posting'
  | 'goal'
  | 'course'
  | 'skill';

export interface SemanticEntity {
  entityType: SemanticEntityType;
  entityId: string;
  entityName: string;
  entityContext?: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface UnifiedSearchOptions {
  query: string;
  tenantId: string;
  entityTypes?: SemanticEntityType[];
  limit?: number;
  similarityThreshold?: number;
  filters?: {
    orgUnitId?: string;
    locationId?: string;
    isActive?: boolean;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface UnifiedSearchResult {
  query: string;
  totalResults: number;
  results: SemanticEntity[];
  resultsByType: Record<SemanticEntityType, SemanticEntity[]>;
  searchDurationMs: number;
}

export interface EmbeddingGenerationConfig {
  entityType: SemanticEntityType;
  batchSize?: number;
  tenantId?: string | undefined;
  forceRegenerate?: boolean;
}

export interface EmbeddingGenerationResult {
  entityType: SemanticEntityType;
  totalRecords: number;
  embedded: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export interface EmployeeSemanticProfile {
  employeeId: string;
  name: string;
  jobTitle: string;
  department: string;
  skills: string[];
  performanceSummary: string;
  talentContext: string;
  learningContext: string;
  embedding?: number[];
}

// =============================================================================
// Service Implementation
// =============================================================================

export class UnifiedSemanticService {
  private pool: Pool;
  private apiKey: string | null = null;
  private embeddingModel = 'text-embedding-3-small';

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Set OpenAI API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Load API key from database
   */
  async loadApiKeyFromDb(): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT config_value FROM system_config WHERE config_key = 'openai_api_key' LIMIT 1`
      );
      if (result.rows.length > 0 && result.rows[0].config_value) {
        this.setApiKey(result.rows[0].config_value);
        return true;
      }
    } catch (_err) {
      logger.warn({ err: _err }, 'Silent catch in services.unified-semantic-service');
    }

    if (process.env.OPENAI_API_KEY) {
      this.setApiKey(process.env.OPENAI_API_KEY);
      return true;
    }

    return false;
  }

  /**
   * Generate embedding for text using OpenAI API directly
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Call setApiKey() or loadApiKeyFromDb() first.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        signal: AbortSignal.timeout(30000),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text.slice(0, 8000), // Limit to 8000 chars
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`OpenAI API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
      if (data.data && data.data[0]) {
        return data.data[0].embedding;
      }
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Error generating embedding:');
      return null;
    }
  }

  /**
   * Generate text hash for change detection
   */
  private generateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 64);
  }

  /**
   * Wait helper for rate limiting
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // Unified Cross-Domain Search
  // ===========================================================================

  /**
   * Perform unified semantic search across all entity types
   */
  async unifiedSearch(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const { query, tenantId, entityTypes, limit = 20, similarityThreshold = 0.5 } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding');
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Search in unified index
    let typeFilter = '';
    if (entityTypes && entityTypes.length > 0) {
      typeFilter = `AND entity_type = ANY($4)`;
    }

    const searchQuery = `
      SELECT
        entity_type,
        entity_id,
        entity_name,
        entity_context,
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM semantic_entity_index
      WHERE tenant_id = $2
        AND is_active = TRUE
        AND 1 - (embedding <=> $1::vector) >= $3
        ${typeFilter}
      ORDER BY similarity DESC
      LIMIT $${entityTypes ? 5 : 4}
    `;

    const params: unknown[] = [embeddingStr, tenantId, similarityThreshold];
    if (entityTypes) {
      params.push(entityTypes);
    }
    params.push(limit);

    const result = await this.pool.query(searchQuery, params);

    // Group results by type
    const resultsByType: Record<SemanticEntityType, SemanticEntity[]> = {} as Record<
      SemanticEntityType,
      SemanticEntity[]
    >;
    const allResults: SemanticEntity[] = [];

    for (const row of result.rows) {
      const entity: SemanticEntity = {
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        entityContext: row.entity_context,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata,
      };

      allResults.push(entity);

      if (!resultsByType[row.entity_type as SemanticEntityType]) {
        resultsByType[row.entity_type as SemanticEntityType] = [];
      }
      resultsByType[row.entity_type as SemanticEntityType].push(entity);
    }

    const searchDurationMs = Date.now() - startTime;

    // Log search for analytics
    await this.logSearch(
      tenantId,
      query,
      embeddingStr,
      entityTypes || [],
      allResults.length,
      allResults.slice(0, 5),
      searchDurationMs
    );

    return {
      query,
      totalResults: allResults.length,
      results: allResults,
      resultsByType,
      searchDurationMs,
    };
  }

  /**
   * Search directly in source tables (for entities not yet in unified index)
   */
  async directSearch(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const {
      query,
      tenantId,
      entityTypes = ['employee', 'department', 'performance_review', 'skill_gap_analysis'],
      limit = 10,
      similarityThreshold = 0.5,
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding');
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const allResults: SemanticEntity[] = [];

    // Search each entity type
    for (const entityType of entityTypes) {
      const results = await this.searchEntityType(
        entityType,
        embeddingStr,
        tenantId,
        limit,
        similarityThreshold
      );
      allResults.push(...results);
    }

    // Sort by similarity and limit
    allResults.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = allResults.slice(0, limit);

    // Group by type
    const resultsByType: Record<SemanticEntityType, SemanticEntity[]> = {} as Record<
      SemanticEntityType,
      SemanticEntity[]
    >;
    for (const result of limitedResults) {
      if (!resultsByType[result.entityType]) {
        resultsByType[result.entityType] = [];
      }
      resultsByType[result.entityType].push(result);
    }

    return {
      query,
      totalResults: limitedResults.length,
      results: limitedResults,
      resultsByType,
      searchDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Search a specific entity type
   */
  private async searchEntityType(
    entityType: SemanticEntityType,
    embeddingStr: string,
    tenantId: string,
    limit: number,
    threshold: number
  ): Promise<SemanticEntity[]> {
    const config = this.getEntityConfig(entityType);
    if (!config) return [];

    const query = `
      SELECT
        ${config.idColumn}::text AS entity_id,
        ${config.nameColumn} AS entity_name,
        ${config.contextColumn ? config.contextColumn + ' AS entity_context,' : ''}
        1 - (${config.embeddingColumn} <=> $1::vector) AS similarity
      FROM ${config.tableName}
      WHERE tenant_id = $2
        AND ${config.embeddingColumn} IS NOT NULL
        AND 1 - (${config.embeddingColumn} <=> $1::vector) >= $3
        ${config.activeFilter || ''}
      ORDER BY similarity DESC
      LIMIT $4
    `;

    try {
      const result = await this.pool.query(query, [embeddingStr, tenantId, threshold, limit]);
      return result.rows.map((row) => ({
        entityType,
        entityId: row.entity_id,
        entityName: row.entity_name,
        entityContext: row.entity_context,
        similarity: parseFloat(row.similarity),
      }));
    } catch (error) {
      logger.error(`Error searching ${entityType}:${error}`);
      return [];
    }
  }

  /**
   * Get entity configuration for direct search
   */
  private getEntityConfig(entityType: SemanticEntityType): {
    tableName: string;
    idColumn: string;
    nameColumn: string;
    contextColumn?: string;
    embeddingColumn: string;
    activeFilter?: string;
  } | null {
    const configs: Record<
      string,
      {
        tableName: string;
        idColumn: string;
        nameColumn: string;
        contextColumn?: string;
        embeddingColumn: string;
        activeFilter?: string;
      }
    > = {
      employee: {
        tableName: 'employees',
        idColumn: 'id',
        nameColumn: "first_name || ' ' || last_name",
        contextColumn: "job_title || ' - ' || COALESCE(department, '')",
        embeddingColumn: 'profile_embedding',
        activeFilter: 'AND is_active = TRUE',
      },
      department: {
        tableName: 'departments',
        idColumn: 'id',
        nameColumn: 'name',
        contextColumn: 'description',
        embeddingColumn: 'embedding',
        activeFilter: 'AND is_active = TRUE',
      },
      org_unit: {
        tableName: 'org_units',
        idColumn: 'id',
        nameColumn: 'name',
        contextColumn: 'org_type',
        embeddingColumn: 'embedding',
        activeFilter: 'AND is_active = TRUE',
      },
      location: {
        tableName: 'locations',
        idColumn: 'id',
        nameColumn: 'name',
        contextColumn: "city || ', ' || COALESCE(country, '')",
        embeddingColumn: 'embedding',
        activeFilter: 'AND is_active = TRUE',
      },
      performance_review: {
        tableName: 'performance_reviews',
        idColumn: 'id',
        nameColumn: "'Performance Review'",
        contextColumn: 'review_type',
        embeddingColumn: 'content_embedding',
      },
      check_in: {
        tableName: 'check_ins',
        idColumn: 'id',
        nameColumn: "'Check-in'",
        contextColumn: 'meeting_type',
        embeddingColumn: 'content_embedding',
      },
      feedback_360: {
        tableName: 'feedback_360',
        idColumn: 'id',
        nameColumn: "'360 Feedback'",
        contextColumn: 'relationship_type',
        embeddingColumn: 'content_embedding',
      },
      skill_gap_analysis: {
        tableName: 'skill_gap_analyses',
        idColumn: 'id',
        nameColumn: 'analysis_name',
        contextColumn: 'analysis_type',
        embeddingColumn: 'analysis_embedding',
      },
      career_path: {
        tableName: 'career_paths',
        idColumn: 'id',
        nameColumn: 'name',
        contextColumn: 'description',
        embeddingColumn: 'embedding',
        activeFilter: 'AND is_active = TRUE',
      },
      learning_path: {
        tableName: 'learning_paths',
        idColumn: 'id',
        nameColumn: 'title',
        contextColumn: 'description',
        embeddingColumn: 'embedding',
        activeFilter: 'AND is_active = TRUE',
      },
      candidate: {
        tableName: 'recruiting_candidates',
        idColumn: 'id',
        nameColumn: "first_name || ' ' || last_name",
        contextColumn: "job_title || ' at ' || COALESCE(current_company, '')",
        embeddingColumn: 'profile_embedding',
      },
      goal: {
        tableName: 'goals',
        idColumn: 'id',
        nameColumn: 'title',
        contextColumn: 'description',
        embeddingColumn: 'embedding',
      },
      course: {
        tableName: 'courses',
        idColumn: 'id',
        nameColumn: 'title',
        contextColumn: 'description_en',
        embeddingColumn: 'embedding_en',
        activeFilter: 'AND is_active = TRUE',
      },
      skill: {
        tableName: 'esco_skills',
        idColumn: 'id',
        nameColumn: 'preferred_label',
        contextColumn: 'description',
        embeddingColumn: 'embedding_en',
      },
    };

    return configs[entityType] || null;
  }

  // ===========================================================================
  // Embedding Generation
  // ===========================================================================

  /**
   * Generate embeddings for a specific entity type
   */
  async generateEntityEmbeddings(
    config: EmbeddingGenerationConfig
  ): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();
    const { entityType, batchSize = 50, tenantId, forceRegenerate = false } = config;

    const generator = this.getEmbeddingGenerator(entityType);
    if (!generator) {
      throw new Error(`No embedding generator for entity type: ${entityType}`);
    }

    let embedded = 0;
    let skipped = 0;
    let errors = 0;

    // Get records to embed
    const records = await generator.getRecords(this.pool, tenantId, forceRegenerate);
    const totalRecords = records.length;

    logger.info(`Generating embeddings for ${totalRecords} ${entityType} records...`);

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          const text = generator.buildText(record);
          const textHash = this.generateTextHash(text);

          // Skip if hash unchanged
          if (!forceRegenerate && record.embedding_text_hash === textHash) {
            skipped++;
            continue;
          }

          const embedding = await this.generateEmbedding(text);
          if (embedding) {
            await generator.updateEmbedding(
              this.pool,
              String(record.id),
              embedding,
              textHash,
              this.embeddingModel
            );

            // Also add to unified index
            await this.upsertSemanticIndex(
              String(record.tenant_id),
              entityType,
              String(record.id),
              generator.getName(record),
              generator.getContext(record),
              embedding,
              generator.getMetadata(record)
            );

            embedded++;
          } else {
            errors++;
          }
        } catch (error) {
          logger.error(`Error embedding ${entityType} ${record.id}:${error}`);
          errors++;
        }

        // Rate limiting
        await this.wait(100);
      }

      logger.info(`Progress: ${Math.min(i + batchSize, totalRecords)}/${totalRecords}`);
    }

    return {
      entityType,
      totalRecords,
      embedded,
      skipped,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Generate all embeddings for all entity types
   */
  async generateAllEmbeddings(tenantId?: string): Promise<EmbeddingGenerationResult[]> {
    const entityTypes: SemanticEntityType[] = [
      'employee',
      'department',
      'org_unit',
      'location',
      'performance_review',
      'check_in',
      'feedback_360',
      'skill_gap_analysis',
      'career_path',
      'learning_path',
      'candidate',
    ];

    const results: EmbeddingGenerationResult[] = [];

    for (const entityType of entityTypes) {
      logger.info(`\n=== Generating embeddings for ${entityType} ===`);
      const result = await this.generateEntityEmbeddings({
        entityType,
        tenantId,
        batchSize: 50,
      });
      results.push(result);
      logger.info(
        `Completed: ${result.embedded} embedded, ${result.skipped} skipped, ${result.errors} errors`
      );
    }

    return results;
  }

  /**
   * Get embedding generator for entity type
   */
  private getEmbeddingGenerator(entityType: SemanticEntityType) {
    const generators: Record<
      string,
      {
        getRecords: (
          pool: Pool,
          tenantId?: string,
          force?: boolean
        ) => Promise<Array<Record<string, unknown>>>;
        buildText: (record: Record<string, unknown>) => string;
        getName: (record: Record<string, unknown>) => string;
        getContext: (record: Record<string, unknown>) => string;
        getMetadata: (record: Record<string, unknown>) => Record<string, unknown>;
        updateEmbedding: (
          pool: Pool,
          id: string,
          embedding: number[],
          hash: string,
          model: string
        ) => Promise<void>;
      }
    > = {
      employee: {
        getRecords: async (pool, tenantId, force) => {
          let query = `
            SELECT id, tenant_id, first_name, last_name, job_title, department,
                   skills, education_history, highest_education_level,
                   highest_education_field, embedding_text_hash
            FROM employees
            WHERE is_active = TRUE
          `;
          if (!force) query += ` AND profile_embedding IS NULL`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => {
          const parts = [
            r.job_title || '',
            r.department || '',
            Array.isArray(r.skills) ? r.skills.join(', ') : '',
            r.highest_education_level || '',
            r.highest_education_field || '',
          ];
          return parts.filter(Boolean).join('. ');
        },
        getName: (r) => `${r.first_name} ${r.last_name}`,
        getContext: (r) => `${r.job_title || ''} - ${r.department || ''}`,
        getMetadata: (r) => ({ skills: r.skills, education: r.highest_education_level }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE employees SET profile_embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      department: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, name, name_en, description, embedding_text_hash
                       FROM org_units WHERE is_active = TRUE`;
          if (!force) query += ` AND embedding IS NULL`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => `${r.name}. ${r.name_en || ''}. ${r.description || ''}`,
        getName: (r) => r.name as string,
        getContext: (r) => (r.description as string) || '',
        getMetadata: () => ({}),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE org_units SET embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      org_unit: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, name, name_en, org_type, embedding_text_hash
                       FROM org_units WHERE is_active = TRUE`;
          if (!force) query += ` AND embedding IS NULL`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => `${r.name}. ${r.name_en || ''}. ${r.org_type || ''}`,
        getName: (r) => r.name as string,
        getContext: (r) => (r.org_type as string) || '',
        getMetadata: (r) => ({ org_type: r.org_type }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE org_units SET embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      location: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, name, address, city, province, country, location_type, embedding_text_hash
                       FROM locations WHERE is_active = TRUE`;
          if (!force) query += ` AND embedding IS NULL`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) =>
          `${r.name}. ${r.location_type || ''}. ${r.address || ''}, ${r.city || ''}, ${r.province || ''}, ${r.country || ''}`,
        getName: (r) => r.name as string,
        getContext: (r) => `${r.city || ''}, ${r.country || ''}`,
        getMetadata: (r) => ({ type: r.location_type, city: r.city, country: r.country }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE locations SET embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      performance_review: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, employee_id, review_type, strengths,
                       areas_for_improvement, manager_comments, employee_comments, embedding_text_hash
                       FROM performance_reviews`;
          if (!force) query += ` WHERE content_embedding IS NULL`;
          else query += ` WHERE 1=1`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => {
          const parts = [
            r.strengths || '',
            r.areas_for_improvement || '',
            r.manager_comments || '',
            r.employee_comments || '',
          ];
          return parts.filter(Boolean).join('. ');
        },
        getName: (r) => `Performance Review (${r.review_type || 'Annual'})`,
        getContext: (r) => (r.review_type as string) || '',
        getMetadata: (r) => ({ employee_id: r.employee_id, review_type: r.review_type }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE performance_reviews SET content_embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      check_in: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, employee_id, meeting_type, agenda,
                       employee_notes, manager_notes, action_items, embedding_text_hash
                       FROM check_ins`;
          if (!force) query += ` WHERE content_embedding IS NULL`;
          else query += ` WHERE 1=1`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => {
          const actionItems = r.action_items ? JSON.stringify(r.action_items) : '';
          return `${r.agenda || ''}. ${r.employee_notes || ''}. ${r.manager_notes || ''}. ${actionItems}`;
        },
        getName: (r) => `Check-in (${r.meeting_type || 'Regular'})`,
        getContext: (r) => (r.meeting_type as string) || '',
        getMetadata: (r) => ({ employee_id: r.employee_id, meeting_type: r.meeting_type }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE check_ins SET content_embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      feedback_360: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, target_employee_id, relationship_type,
                       strengths, areas_for_improvement, embedding_text_hash
                       FROM feedback_360`;
          if (!force) query += ` WHERE content_embedding IS NULL`;
          else query += ` WHERE 1=1`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => `${r.strengths || ''}. ${r.areas_for_improvement || ''}`,
        getName: (r) => `360 Feedback (${r.relationship_type || ''})`,
        getContext: (r) => (r.relationship_type as string) || '',
        getMetadata: (r) => ({
          target_employee_id: r.target_employee_id,
          relationship: r.relationship_type,
        }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE feedback_360 SET content_embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      skill_gap_analysis: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, analysis_name, analysis_type,
                       recommendations, priority_skills, embedding_text_hash
                       FROM skill_gap_analyses`;
          if (!force) query += ` WHERE analysis_embedding IS NULL`;
          else query += ` WHERE 1=1`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => {
          const recs = r.recommendations ? JSON.stringify(r.recommendations) : '';
          const skills = r.priority_skills ? JSON.stringify(r.priority_skills) : '';
          return `${r.analysis_name || ''}. ${r.analysis_type || ''}. ${recs}. ${skills}`;
        },
        getName: (r) => (r.analysis_name as string) || 'Skill Gap Analysis',
        getContext: (r) => (r.analysis_type as string) || '',
        getMetadata: (r) => ({ analysis_type: r.analysis_type }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE skill_gap_analyses SET analysis_embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      career_path: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, name, description, path_type, embedding_text_hash
                       FROM career_paths WHERE is_active = TRUE`;
          if (!force) query += ` AND embedding IS NULL`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => `${r.name}. ${r.description || ''}. ${r.path_type || ''}`,
        getName: (r) => r.name as string,
        getContext: (r) => (r.description as string) || '',
        getMetadata: (r) => ({ path_type: r.path_type }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE career_paths SET embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      learning_path: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, title, title_en, description, target_role, embedding_text_hash
                       FROM learning_paths WHERE is_active = TRUE`;
          if (!force) query += ` AND embedding IS NULL`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) =>
          `${r.title}. ${r.title_en || ''}. ${r.description || ''}. Target: ${r.target_role || ''}`,
        getName: (r) => r.title as string,
        getContext: (r) => (r.target_role as string) || '',
        getMetadata: (r) => ({ target_role: r.target_role }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE learning_paths SET embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },

      candidate: {
        getRecords: async (pool, tenantId, force) => {
          let query = `SELECT id, tenant_id, first_name, last_name, job_title,
                       current_company, skills, notes, embedding_text_hash
                       FROM recruiting_candidates`;
          if (!force) query += ` WHERE profile_embedding IS NULL`;
          else query += ` WHERE 1=1`;
          if (tenantId) query += ` AND tenant_id = '${tenantId}'`;
          const result = await pool.query(query);
          return result.rows;
        },
        buildText: (r) => {
          const skills = r.skills ? JSON.stringify(r.skills) : '';
          return `${r.job_title || ''}. ${r.current_company || ''}. ${skills}. ${r.notes || ''}`;
        },
        getName: (r) => `${r.first_name} ${r.last_name}`,
        getContext: (r) => `${r.job_title || ''} at ${r.current_company || ''}`,
        getMetadata: (r) => ({
          job_title: r.job_title,
          company: r.current_company,
          skills: r.skills,
        }),
        updateEmbedding: async (pool, id, embedding, hash, model) => {
          await pool.query(
            `UPDATE recruiting_candidates SET profile_embedding = $1, embedding_text_hash = $2,
             embedding_model = $3, embedding_generated_at = NOW() WHERE id = $4`,
            [`[${embedding.join(',')}]`, hash, model, id]
          );
        },
      },
    };

    return generators[entityType];
  }

  // ===========================================================================
  // Semantic Index Management
  // ===========================================================================

  /**
   * Upsert entity into unified semantic index
   */
  private async upsertSemanticIndex(
    tenantId: string,
    entityType: SemanticEntityType,
    entityId: string,
    entityName: string,
    entityContext: string,
    embedding: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const embeddingStr = `[${embedding.join(',')}]`;

    await this.pool.query(
      `INSERT INTO semantic_entity_index
       (tenant_id, entity_type, entity_id, entity_name, entity_context, embedding, embedding_model, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (tenant_id, entity_type, entity_id)
       DO UPDATE SET
         entity_name = EXCLUDED.entity_name,
         entity_context = EXCLUDED.entity_context,
         embedding = EXCLUDED.embedding,
         embedding_model = EXCLUDED.embedding_model,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        tenantId,
        entityType,
        entityId,
        entityName,
        entityContext,
        embeddingStr,
        this.embeddingModel,
        metadata || {},
      ]
    );
  }

  /**
   * Log search for analytics
   */
  private async logSearch(
    tenantId: string,
    queryText: string,
    queryEmbedding: string,
    entityTypes: SemanticEntityType[],
    resultsCount: number,
    topResults: SemanticEntity[],
    durationMs: number
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO semantic_search_log
         (tenant_id, query_text, query_embedding, entity_types, results_count, top_results, search_duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          queryText,
          queryEmbedding,
          entityTypes,
          resultsCount,
          JSON.stringify(topResults),
          durationMs,
        ]
      );
    } catch (error) {
      logger.error({ err: error }, 'Error logging search:');
    }
  }

  // ===========================================================================
  // Status & Analytics
  // ===========================================================================

  /**
   * Get embedding status for all entity types
   */
  async getEmbeddingStatus(): Promise<
    Record<SemanticEntityType, { total: number; embedded: number; percentage: number }>
  > {
    const status: Record<string, { total: number; embedded: number; percentage: number }> = {};

    const queries = [
      {
        type: 'employee',
        query: `SELECT COUNT(*) as total, COUNT(profile_embedding) as embedded FROM employees WHERE is_active = TRUE`,
      },
      {
        type: 'department',
        query: `SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM org_units WHERE is_active = TRUE`,
      },
      {
        type: 'org_unit',
        query: `SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM org_units WHERE is_active = TRUE`,
      },
      {
        type: 'location',
        query: `SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM locations WHERE is_active = TRUE`,
      },
      {
        type: 'performance_review',
        query: `SELECT COUNT(*) as total, COUNT(content_embedding) as embedded FROM performance_reviews`,
      },
      {
        type: 'check_in',
        query: `SELECT COUNT(*) as total, COUNT(content_embedding) as embedded FROM check_ins`,
      },
      {
        type: 'feedback_360',
        query: `SELECT COUNT(*) as total, COUNT(content_embedding) as embedded FROM feedback_360`,
      },
      {
        type: 'skill_gap_analysis',
        query: `SELECT COUNT(*) as total, COUNT(analysis_embedding) as embedded FROM skill_gap_analyses`,
      },
      {
        type: 'career_path',
        query: `SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM career_paths WHERE is_active = TRUE`,
      },
      {
        type: 'learning_path',
        query: `SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM learning_paths WHERE is_active = TRUE`,
      },
      {
        type: 'candidate',
        query: `SELECT COUNT(*) as total, COUNT(profile_embedding) as embedded FROM recruiting_candidates`,
      },
    ];

    for (const { type, query } of queries) {
      try {
        const result = await this.pool.query(query);
        const total = parseInt(result.rows[0].total) || 0;
        const embedded = parseInt(result.rows[0].embedded) || 0;
        status[type] = {
          total,
          embedded,
          percentage: total > 0 ? Math.round((embedded / total) * 100) : 0,
        };
      } catch (error) {
        status[type] = { total: 0, embedded: 0, percentage: 0 };
      }
    }

    return status as Record<
      SemanticEntityType,
      { total: number; embedded: number; percentage: number }
    >;
  }

  /**
   * Get unified index statistics
   */
  async getIndexStats(): Promise<{ totalEntities: number; byType: Record<string, number> }> {
    const result = await this.pool.query(`
      SELECT entity_type, COUNT(*) as count
      FROM semantic_entity_index
      WHERE is_active = TRUE
      GROUP BY entity_type
      ORDER BY count DESC
    `);

    const byType: Record<string, number> = {};
    let total = 0;

    for (const row of result.rows) {
      byType[row.entity_type] = parseInt(row.count);
      total += parseInt(row.count);
    }

    return { totalEntities: total, byType };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

let semanticServiceInstance: UnifiedSemanticService | null = null;

export function createUnifiedSemanticService(pool: Pool): UnifiedSemanticService {
  if (!semanticServiceInstance) {
    semanticServiceInstance = new UnifiedSemanticService(pool);
  }
  return semanticServiceInstance;
}

export function getUnifiedSemanticService(): UnifiedSemanticService | null {
  return semanticServiceInstance;
}
