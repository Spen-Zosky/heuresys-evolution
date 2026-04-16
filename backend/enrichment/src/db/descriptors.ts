import { pool, type Queryable } from './pool.js';

export interface EntityDescriptor {
  id: string;
  entity_name: string;
  target_table: string;
  pk_field: string;
  match_keys: string[];
  source_strategy: Record<string, unknown>;
  extraction_schema_id: string;
  extraction_schema: Record<string, unknown>;
  default_merge_policy_id: string;
  default_mode: 'suggest' | 'merge' | 'observe';
  crawl_config: Record<string, unknown>;
}

export async function loadDescriptor(entityName: string, db: Queryable = pool): Promise<EntityDescriptor> {
  const result = await db.query(
    `SELECT d.id, d.entity_name, d.target_table, d.pk_field, d.match_keys,
            d.source_strategy_jsonb AS source_strategy,
            d.extraction_schema_id, s.schema_jsonb AS extraction_schema,
            d.default_merge_policy_id, d.default_mode, d.crawl_config
       FROM enrichment_entity_descriptors d
       JOIN enrichment_extraction_schemas s ON s.id = d.extraction_schema_id
      WHERE d.entity_name = $1
        AND d.is_active = true
      ORDER BY d.tenant_id NULLS LAST
      LIMIT 1`,
    [entityName],
  );
  if (result.rows.length === 0) {
    throw new Error(`Descriptor not found: ${entityName}`);
  }
  return result.rows[0] as EntityDescriptor;
}
