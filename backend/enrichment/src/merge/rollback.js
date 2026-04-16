import { withTenantClient } from '../db/pool.js';
import { markWriteRolledBack } from '../db/writes.js';
import { logger } from '../lib/logger.js';
function stripSchema(tableName) {
    const idx = tableName.indexOf('.');
    return idx === -1 ? tableName : tableName.slice(idx + 1);
}
// Whitelist of columns we can safely revert via generated UPDATE. Mirrors
// ENTITY_FIELD_MAP in apply.ts — the set of columns that are legitimately
// writable through the merge layer.
const REVERTABLE_COLUMNS = new Set([
    'name',
    'tax_id',
    'description',
    'address_city',
    'industry_type',
]);
export async function rollbackJob(tenantId, jobId) {
    return withTenantClient(tenantId, async (client) => {
        const writesRes = await client.query(`SELECT id, target_table, target_record_id, field_name,
              written_value, previous_value, rolled_back_at
         FROM enrichment_writes
        WHERE tenant_id = $1 AND job_id = $2
        ORDER BY committed_at DESC`, [tenantId, jobId]);
        const entries = [];
        let reverted = 0;
        let skipped = 0;
        let errors = 0;
        for (const w of writesRes.rows) {
            if (w.rolled_back_at) {
                skipped++;
                entries.push({
                    writeId: w.id,
                    targetTable: w.target_table,
                    targetRecordId: w.target_record_id,
                    fieldName: w.field_name,
                    reverted: false,
                    reason: 'already rolled back',
                });
                continue;
            }
            // The column we revert IS the one we wrote to. For MVP the field
            // name == column name in ENTITY_FIELD_MAP because we store the
            // target column on the write row implicitly via field_name.
            // Future migration will add an explicit target_column column on
            // enrichment_writes for non-MVP entities.
            const column = w.field_name === 'legal_name' ? 'name'
                : w.field_name === 'vat_id' ? 'tax_id'
                    : w.field_name === 'headquarters_city' ? 'address_city'
                        : w.field_name === 'industry_hint' ? 'industry_type'
                            : w.field_name;
            if (!REVERTABLE_COLUMNS.has(column)) {
                errors++;
                entries.push({
                    writeId: w.id,
                    targetTable: w.target_table,
                    targetRecordId: w.target_record_id,
                    fieldName: w.field_name,
                    reverted: false,
                    reason: `column ${column} not in rollback whitelist`,
                });
                continue;
            }
            const bareTable = stripSchema(w.target_table);
            await client.query('SAVEPOINT sp_rollback');
            try {
                await client.query(`UPDATE "${bareTable}"
              SET "${column}" = $1,
                  updated_at = NOW()
            WHERE id = $2`, [w.previous_value, w.target_record_id]);
                await client.query('RELEASE SAVEPOINT sp_rollback');
            }
            catch (err) {
                await client.query('ROLLBACK TO SAVEPOINT sp_rollback');
                errors++;
                logger.warn({ err: err.message, column, writeId: w.id }, 'rollback UPDATE failed');
                entries.push({
                    writeId: w.id,
                    targetTable: w.target_table,
                    targetRecordId: w.target_record_id,
                    fieldName: w.field_name,
                    reverted: false,
                    reason: `UPDATE failed: ${err.message.slice(0, 120)}`,
                });
                continue;
            }
            await markWriteRolledBack(w.id, jobId, client);
            reverted++;
            entries.push({
                writeId: w.id,
                targetTable: w.target_table,
                targetRecordId: w.target_record_id,
                fieldName: w.field_name,
                reverted: true,
                reason: 'reverted to previous_value',
            });
        }
        // Flip job status if every write has been reverted.
        if (reverted > 0) {
            await client.query(`UPDATE enrichment_jobs
            SET status = 'rolled_back'
          WHERE id = $1`, [jobId]);
        }
        return {
            jobId,
            totalWrites: writesRes.rows.length,
            reverted,
            skipped,
            errors,
            entries,
        };
    });
}
//# sourceMappingURL=rollback.js.map