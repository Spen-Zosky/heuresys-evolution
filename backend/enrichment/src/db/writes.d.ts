import type { Queryable } from './pool.js';
/**
 * SEE Fase 6 — L4 write idempotency helpers.
 *
 * Thin data layer over enrichment_writes. The write path (Fase 7 merge
 * layer) calls `recordWrite()` after successfully applying a fact to the
 * target business table. The unique (tenant, target_table, target_record_id,
 * field_name, fact_hash) constraint makes the insert a no-op when the same
 * fact has already been committed, so replaying a job is safe.
 *
 * `isWriteAlreadyCommitted` is a fast pre-check used by the merge layer to
 * skip the actual UPDATE when the fact is already in place.
 */
export interface WriteRow {
    id: string;
    tenantId: string;
    jobId: string;
    candidateId: string | null;
    entityName: string;
    targetTable: string;
    targetRecordId: string;
    entityAnchor: string;
    fieldName: string;
    writtenValue: unknown;
    previousValue: unknown;
    factHash: string;
    committedAt: Date;
    rolledBackAt: Date | null;
}
export interface RecordWriteInput {
    tenantId: string;
    jobId: string;
    candidateId?: string | null;
    entityName: string;
    targetTable: string;
    targetRecordId: string;
    entityAnchor: string;
    fieldName: string;
    writtenValue: unknown;
    previousValue?: unknown;
    factHash: string;
}
export declare function recordWrite(input: RecordWriteInput, db?: Queryable): Promise<{
    id: string;
    inserted: boolean;
}>;
export declare function isWriteAlreadyCommitted(tenantId: string, targetTable: string, targetRecordId: string, fieldName: string, factHash: string, db?: Queryable): Promise<boolean>;
export declare function markWriteRolledBack(writeId: string, rolledBackByJobId: string, db?: Queryable): Promise<boolean>;
//# sourceMappingURL=writes.d.ts.map