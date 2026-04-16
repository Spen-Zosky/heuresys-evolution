import { createHash } from 'node:crypto';
import { pool } from './pool.js';
function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object')
        return JSON.stringify(obj);
    if (Array.isArray(obj))
        return '[' + obj.map(stableStringify).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
export function computeIdempotencyKey(input, extractionSchemaVersion = 1) {
    const payload = [
        input.targetTable,
        input.targetRecordId,
        stableStringify(input.semanticScope),
        String(extractionSchemaVersion),
        input.policyId,
        String(input.freshnessDays ?? 7),
    ].join('|');
    return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 64);
}
export async function createJob(input, db = pool) {
    const idempotencyKey = computeIdempotencyKey(input);
    const existing = await db.query(`SELECT id, status FROM enrichment_jobs
      WHERE tenant_id = $1 AND idempotency_key = $2
      LIMIT 1`, [input.tenantId, idempotencyKey]);
    if (existing.rows.length > 0) {
        return { id: existing.rows[0].id, idempotencyKey, cached: true };
    }
    const result = await db.query(`INSERT INTO enrichment_jobs
       (tenant_id, descriptor_id, target_table, target_pk_field, target_record_id,
        semantic_scope_jsonb, policy_id, mode, idempotency_key, status,
        requested_by_user_id, freshness_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)
     RETURNING id`, [
        input.tenantId,
        input.descriptorId,
        input.targetTable,
        input.targetPkField,
        input.targetRecordId,
        JSON.stringify(input.semanticScope),
        input.policyId,
        input.mode,
        idempotencyKey,
        input.requestedByUserId ?? null,
        input.freshnessDays ?? 7,
    ]);
    return { id: result.rows[0].id, idempotencyKey, cached: false };
}
export async function updateJobStatus(jobId, status, errorDetails, db = pool) {
    await db.query(`UPDATE enrichment_jobs
        SET status = $1::varchar,
            completed_at = CASE WHEN $1::varchar IN ('committed','failed','cached','rolled_back') THEN NOW() ELSE completed_at END,
            error_details = COALESCE($2::jsonb, error_details)
      WHERE id = $3::uuid`, [status, errorDetails ? JSON.stringify(errorDetails) : null, jobId]);
}
export async function recordJobEvent(jobId, tenantId, eventType, payload, db = pool) {
    await db.query(`INSERT INTO enrichment_job_events (job_id, tenant_id, event_type, payload_jsonb)
     VALUES ($1,$2,$3,$4)`, [jobId, tenantId, eventType, payload ? JSON.stringify(payload) : null]);
}
//# sourceMappingURL=jobs.js.map