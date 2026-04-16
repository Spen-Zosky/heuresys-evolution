/**
 * SEE Fase 7 — job rollback.
 *
 * Reverses every enrichment_writes row belonging to the given job by
 * UPDATEing the target table back to the previous_value captured at
 * commit time. Each revert runs inside a SAVEPOINT so one bad revert
 * does not abort the whole operation.
 *
 * Rollback is ledger-driven: we never re-derive the previous value from
 * anywhere else. If previous_value is null we set the target column
 * back to NULL (which is the same state the commit saw). Already
 * rolled-back rows are skipped via `rolled_back_at IS NULL`.
 */
export interface RollbackResult {
    jobId: string;
    totalWrites: number;
    reverted: number;
    skipped: number;
    errors: number;
    entries: Array<{
        writeId: string;
        targetTable: string;
        targetRecordId: string;
        fieldName: string;
        reverted: boolean;
        reason: string;
    }>;
}
export declare function rollbackJob(tenantId: string, jobId: string): Promise<RollbackResult>;
//# sourceMappingURL=rollback.d.ts.map