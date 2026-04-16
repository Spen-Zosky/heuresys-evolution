import { createHash } from 'node:crypto';
import { pool, type Queryable } from './pool.js';

export interface CreateJobInput {
  tenantId: string;
  descriptorId: string;
  targetTable: string;
  targetPkField: string;
  targetRecordId: string;
  semanticScope: Record<string, unknown>;
  policyId: string;
  mode: 'suggest' | 'merge' | 'observe';
  requestedByUserId?: string | null;
  freshnessDays?: number;
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])).join(',') + '}';
}

export function computeIdempotencyKey(input: CreateJobInput, extractionSchemaVersion = 1): string {
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

export async function createJob(input: CreateJobInput, db: Queryable = pool): Promise<{ id: string; idempotencyKey: string; cached: boolean }> {
  const idempotencyKey = computeIdempotencyKey(input);

  const existing = await db.query(
    `SELECT id, status FROM enrichment_jobs
      WHERE tenant_id = $1 AND idempotency_key = $2
      LIMIT 1`,
    [input.tenantId, idempotencyKey],
  );
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id as string, idempotencyKey, cached: true };
  }

  const result = await db.query(
    `INSERT INTO enrichment_jobs
       (tenant_id, descriptor_id, target_table, target_pk_field, target_record_id,
        semantic_scope_jsonb, policy_id, mode, idempotency_key, status,
        requested_by_user_id, freshness_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)
     RETURNING id`,
    [
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
    ],
  );
  return { id: result.rows[0].id as string, idempotencyKey, cached: false };
}

export async function updateJobStatus(jobId: string, status: string, errorDetails?: unknown, db: Queryable = pool): Promise<void> {
  await db.query(
    `UPDATE enrichment_jobs
        SET status = $1::varchar,
            completed_at = CASE WHEN $1::varchar IN ('committed','failed','cached','rolled_back') THEN NOW() ELSE completed_at END,
            error_details = COALESCE($2::jsonb, error_details)
      WHERE id = $3::uuid`,
    [status, errorDetails ? JSON.stringify(errorDetails) : null, jobId],
  );
}

export async function recordJobEvent(jobId: string, tenantId: string, eventType: string, payload?: Record<string, unknown>, db: Queryable = pool): Promise<void> {
  await db.query(
    `INSERT INTO enrichment_job_events (job_id, tenant_id, event_type, payload_jsonb)
     VALUES ($1,$2,$3,$4)`,
    [jobId, tenantId, eventType, payload ? JSON.stringify(payload) : null],
  );
}
