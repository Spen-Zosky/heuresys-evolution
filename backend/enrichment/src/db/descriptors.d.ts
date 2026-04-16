import { type Queryable } from './pool.js';
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
export declare function loadDescriptor(entityName: string, db?: Queryable): Promise<EntityDescriptor>;
//# sourceMappingURL=descriptors.d.ts.map