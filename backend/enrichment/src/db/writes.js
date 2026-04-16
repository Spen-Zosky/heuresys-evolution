import { pool } from './pool.js';
export async function recordWrite(input, db = pool) {
    const result = await db.query(`INSERT INTO enrichment_writes
       (tenant_id, job_id, candidate_id, entity_name, target_table,
        target_record_id, entity_anchor, field_name,
        written_value, previous_value, fact_hash, committed_by_job)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$2)
     ON CONFLICT (tenant_id, target_table, target_record_id, field_name, fact_hash)
       DO NOTHING
     RETURNING id`, [
        input.tenantId,
        input.jobId,
        input.candidateId ?? null,
        input.entityName,
        input.targetTable,
        input.targetRecordId,
        input.entityAnchor,
        input.fieldName,
        JSON.stringify(input.writtenValue ?? null),
        JSON.stringify(input.previousValue ?? null),
        input.factHash,
    ]);
    if (result.rows.length > 0) {
        return { id: result.rows[0].id, inserted: true };
    }
    // Existing row — fetch it so callers can link back to the ledger entry.
    const existing = await db.query(`SELECT id FROM enrichment_writes
      WHERE tenant_id = $1
        AND target_table = $2
        AND target_record_id = $3
        AND field_name = $4
        AND fact_hash = $5
      LIMIT 1`, [
        input.tenantId,
        input.targetTable,
        input.targetRecordId,
        input.fieldName,
        input.factHash,
    ]);
    return { id: existing.rows[0]?.id ?? '', inserted: false };
}
export async function isWriteAlreadyCommitted(tenantId, targetTable, targetRecordId, fieldName, factHash, db = pool) {
    const result = await db.query(`SELECT id FROM enrichment_writes
      WHERE tenant_id = $1
        AND target_table = $2
        AND target_record_id = $3
        AND field_name = $4
        AND fact_hash = $5
        AND rolled_back_at IS NULL
      LIMIT 1`, [tenantId, targetTable, targetRecordId, fieldName, factHash]);
    return result.rows.length > 0;
}
export async function markWriteRolledBack(writeId, rolledBackByJobId, db = pool) {
    const result = await db.query(`UPDATE enrichment_writes
        SET rolled_back_at = NOW(),
            rolled_back_by = $2
      WHERE id = $1
        AND rolled_back_at IS NULL`, [writeId, rolledBackByJobId]);
    return (result.rowCount ?? 0) > 0;
}
//# sourceMappingURL=writes.js.map