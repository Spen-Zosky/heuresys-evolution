import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTenantClient } from '../db/pool.js';
import { recordWrite, isWriteAlreadyCommitted } from '../db/writes.js';
import { logger } from '../lib/logger.js';
import { checkEntityMismatch } from './entity-mismatch.js';
import { verifyEntityIdentity } from './identity-verification.js';
import { loadPolicyForDescriptor } from './policies.js';
import { decideMerge, type MergeDecision } from './strategies.js';

/**
 * SEE Fase 7 — merge apply engine.
 *
 * Commits approved candidates for a job into the real business tables.
 * For each candidate:
 *   1. Resolve the target column via ENTITY_FIELD_MAP (extraction-schema
 *      field name → target table column name).
 *   2. SELECT the current value from the target row.
 *   3. Ask strategies.decideMerge() whether to apply.
 *   4. If apply=true, UPDATE the target column (in a SAVEPOINT so one
 *      bad candidate does not kill the whole commit).
 *   5. Record the write in enrichment_writes (L4 ledger) — unique
 *      constraint makes it a no-op on replay.
 *
 * Returns a summary per candidate that the HTTP layer serialises to the
 * client. Fields not mapped to a target column are logged as 'unmapped'
 * and skipped — the observation still lives in enrichment_candidates so
 * Fase 8 can surface them in the admin UI for manual handling.
 */

/**
 * Maps a descriptor field name to the target business table + column.
 * MVP: tenant_profile only. Fase 8 will move this into a DB-driven
 * configuration so tenant-specific overrides are possible.
 */
const ENTITY_FIELD_MAP: Record<string, Record<string, string>> = {
  tenant_profile: {
    legal_name: 'name',
    vat_id: 'tax_id',
    description: 'description',
    headquarters_city: 'address_city',
    industry_hint: 'industry_type',
    // website + country_code are intentionally unmapped — the tenants
    // table has no website column and its address_country is 3-char.
    // Fase 8 will add a DB-level mapping layer.
  },
};

export interface ApplyCandidateSummary {
  candidateId: string;
  fieldName: string;
  mappedColumn: string | null;
  applied: boolean;
  reason: string;
  previousValue: unknown;
  newValue: unknown;
  writeId: string | null;
  alreadyCommitted: boolean;
}

export interface CommitJobResult {
  jobId: string;
  policyId: string;
  mode: string;
  totalCandidates: number;
  applied: number;
  skipped: number;
  unmapped: number;
  alreadyCommitted: number;
  /** set when the pre-flight identity check blocked the entire commit */
  identityBlocked?: boolean;
  /** human-readable summary when identityBlocked=true */
  identityReason?: string;
  results: ApplyCandidateSummary[];
}

interface CandidateRow {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_anchor: string | null;
  field_name: string;
  candidate_value: unknown;
  confidence: string;
  fact_hash: string;
  source_trust_score: string | null;
  source_type: string | null;
}

interface JobRow {
  id: string;
  tenant_id: string;
  descriptor_id: string;
  target_table: string;
  target_pk_field: string;
  target_record_id: string;
  policy_id: string | null;
  mode: string;
  status: string;
  match_keys: string[];
}

function stripSchema(tableName: string): string {
  const idx = tableName.indexOf('.');
  return idx === -1 ? tableName : tableName.slice(idx + 1);
}

async function loadJob(client: PoolClient, jobId: string, tenantId: string): Promise<JobRow | null> {
  const r = await client.query<JobRow>(
    `SELECT j.id, j.tenant_id, j.descriptor_id, j.target_table, j.target_pk_field,
            j.target_record_id, j.policy_id, j.mode, j.status,
            d.match_keys
       FROM enrichment_jobs j
       JOIN enrichment_entity_descriptors d ON d.id = j.descriptor_id
      WHERE j.id = $1 AND j.tenant_id = $2`,
    [jobId, tenantId],
  );
  return r.rows[0] ?? null;
}

async function loadCandidatesForJob(
  client: PoolClient,
  jobId: string,
  tenantId: string,
): Promise<CandidateRow[]> {
  // SEE Fase 7.5 — join through enrichment_source_snapshots →
  // enrichment_sources so the merge strategies see the REAL trust_score
  // recorded at acquisition time instead of the hardcoded 1.0 that
  // Fase 7's smoke test exposed as a security hole.
  const r = await client.query<CandidateRow>(
    `SELECT c.id, c.tenant_id, c.entity_type, c.entity_anchor, c.field_name,
            c.candidate_value, c.confidence::text, c.fact_hash,
            s.trust_score::text AS source_trust_score,
            s.source_type       AS source_type
       FROM enrichment_candidates c
       LEFT JOIN enrichment_source_snapshots ss ON ss.id = c.source_snapshot_id
       LEFT JOIN enrichment_sources s          ON s.id  = ss.source_id
      WHERE c.job_id = $1 AND c.tenant_id = $2
      ORDER BY c.created_at`,
    [jobId, tenantId],
  );
  return r.rows;
}

async function loadTargetRow(
  client: PoolClient,
  targetTable: string,
  pkField: string,
  targetRecordId: string,
  columns: string[],
): Promise<Record<string, unknown> | null> {
  if (columns.length === 0) return null;
  const quoted = columns.map((c) => `"${c}"`).join(', ');
  const bareTable = stripSchema(targetTable);
  const r = await client.query(
    `SELECT ${quoted} FROM "${bareTable}" WHERE "${pkField}" = $1 LIMIT 1`,
    [targetRecordId],
  );
  return r.rows[0] ?? null;
}

function computeFactHash(fact: {
  entityType: string;
  entityAnchor: string;
  fieldName: string;
  candidateValue: unknown;
}): string {
  const s = JSON.stringify({
    entityType: fact.entityType,
    entityAnchor: fact.entityAnchor,
    fieldName: fact.fieldName,
    candidateValue: fact.candidateValue,
  });
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export interface CommitJobInput {
  tenantId: string;
  jobId: string;
  /** list of candidate ids the operator explicitly approved; empty = apply
   *  every candidate whose strategy would auto-apply */
  approvedCandidateIds?: string[];
  /** per-call override of policy mode. Use 'merge' to force write. */
  forceMode?: 'merge' | 'suggest' | 'observe';
}

export async function commitJob(input: CommitJobInput): Promise<CommitJobResult> {
  const { tenantId, jobId, approvedCandidateIds, forceMode } = input;
  const approvedSet = new Set(approvedCandidateIds ?? []);

  return withTenantClient(tenantId, async (client) => {
    const job = await loadJob(client, jobId, tenantId);
    if (!job) throw new Error(`job ${jobId} not found for tenant ${tenantId}`);

    const policy = job.policy_id
      ? await loadPolicyForDescriptor(job.descriptor_id, client)
      : null;
    if (!policy) {
      throw new Error(`no active merge policy for descriptor ${job.descriptor_id}`);
    }
    const effectiveMode = forceMode ?? policy.mode;

    const candidates = await loadCandidatesForJob(client, jobId, tenantId);

    const fieldMap = ENTITY_FIELD_MAP[job.target_table.replace(/^public\./, '')] ??
      ENTITY_FIELD_MAP[candidates[0]?.entity_type ?? ''] ??
      {};

    const mappedColumns = Array.from(
      new Set(
        candidates
          .map((c) => fieldMap[c.field_name])
          .filter((c): c is string => !!c),
      ),
    );

    const currentRow =
      mappedColumns.length > 0
        ? await loadTargetRow(
            client,
            job.target_table,
            job.target_pk_field,
            job.target_record_id,
            mappedColumns,
          )
        : null;

    // SEE Fase 7.5 extended — strong identity pre-flight. Load the
    // tenant's stored identity columns and run verifyEntityIdentity on
    // the FULL set of candidate values (not just the ones we can map).
    // A single strong-identity mismatch (vat_id, website domain,
    // legal_name with zero token overlap) blocks the WHOLE commit —
    // every candidate is skipped with the same identity reason. This
    // stops a half-right extraction from writing plausible-looking
    // fields into the wrong tenant row.
    const extractedValues: Record<string, unknown> = {};
    for (const c of candidates) {
      extractedValues[c.field_name] = c.candidate_value;
    }
    const tenantIdentityRow = await client.query<{
      tax_id: string | null;
      verified_website: string | null;
      name: string | null;
    }>(
      `SELECT tax_id, verified_website, name
         FROM tenants WHERE id = $1 LIMIT 1`,
      [job.target_record_id],
    );
    const identityRow = tenantIdentityRow.rows[0] ?? null;
    const identity = verifyEntityIdentity({
      extractedValues,
      tenantTaxId: identityRow?.tax_id ?? null,
      tenantVerifiedWebsite: identityRow?.verified_website ?? null,
      tenantName: identityRow?.name ?? null,
    });

    const summaries: ApplyCandidateSummary[] = [];
    let applied = 0;
    let skipped = 0;
    let unmapped = 0;
    let already = 0;

    if (!identity.verified) {
      // Short-circuit — do not touch the target table at all. Emit one
      // ApplyCandidateSummary per candidate with the identity reason so
      // the operator can see everything that WOULD have been considered.
      for (const cand of candidates) {
        summaries.push({
          candidateId: cand.id,
          fieldName: cand.field_name,
          mappedColumn: fieldMap[cand.field_name] ?? null,
          applied: false,
          reason: `identity_pre_flight_block: ${identity.summary}`,
          previousValue: currentRow?.[fieldMap[cand.field_name] ?? ''] ?? null,
          newValue: cand.candidate_value,
          writeId: null,
          alreadyCommitted: false,
        });
      }
      return {
        jobId,
        policyId: policy.id,
        mode: effectiveMode,
        totalCandidates: candidates.length,
        applied: 0,
        skipped: candidates.length,
        unmapped: 0,
        alreadyCommitted: 0,
        identityBlocked: true,
        identityReason: identity.summary,
        results: summaries,
      };
    }

    for (const cand of candidates) {
      const mappedColumn = fieldMap[cand.field_name] ?? null;
      if (!mappedColumn) {
        unmapped++;
        summaries.push({
          candidateId: cand.id,
          fieldName: cand.field_name,
          mappedColumn: null,
          applied: false,
          reason: 'no mapping for field',
          previousValue: null,
          newValue: cand.candidate_value,
          writeId: null,
          alreadyCommitted: false,
        });
        continue;
      }

      // SEE Fase 6: fact hash check first so replays are O(1) no-ops.
      const factHash = computeFactHash({
        entityType: cand.entity_type,
        entityAnchor: cand.entity_anchor ?? job.target_record_id,
        fieldName: cand.field_name,
        candidateValue: cand.candidate_value,
      });
      const alreadyCommittedFlag = await isWriteAlreadyCommitted(
        tenantId,
        job.target_table,
        job.target_record_id,
        cand.field_name,
        factHash,
        client,
      );
      if (alreadyCommittedFlag) {
        already++;
        summaries.push({
          candidateId: cand.id,
          fieldName: cand.field_name,
          mappedColumn,
          applied: false,
          reason: 'already committed (L4 hit)',
          previousValue: currentRow?.[mappedColumn] ?? null,
          newValue: cand.candidate_value,
          writeId: null,
          alreadyCommitted: true,
        });
        continue;
      }

      // SEE Fase 7.5 — use the real trust_score captured at acquisition
      // time. If the source was downgraded to 'unknown' by the
      // verification gate, trust_score will be ~0.10 and the
      // authoritative_only / prefer_authoritative strategies will refuse
      // to apply.
      const realTrustScore =
        cand.source_trust_score !== null ? Number(cand.source_trust_score) : 0.1;

      // SEE Fase 7.5 — entity mismatch gate. If the extracted value
      // for a match-key field has near-zero token overlap with the
      // target row's existing value (e.g. extracted "RTL 102.5" vs
      // stored "RTL Bank"), refuse the apply. This catches the case
      // where the source URL was verified at acquisition time but the
      // content is still about a different entity.
      const mismatch = checkEntityMismatch({
        fieldName: cand.field_name,
        candidateValue: cand.candidate_value,
        currentValue: currentRow?.[mappedColumn] ?? null,
        matchKeyFields: job.match_keys ?? [],
      });
      if (mismatch.mismatch) {
        skipped++;
        summaries.push({
          candidateId: cand.id,
          fieldName: cand.field_name,
          mappedColumn,
          applied: false,
          reason: mismatch.reason,
          previousValue: currentRow?.[mappedColumn] ?? null,
          newValue: cand.candidate_value,
          writeId: null,
          alreadyCommitted: false,
        });
        continue;
      }

      const decision: MergeDecision = decideMerge({
        strategy: policy.fieldStrategies[cand.field_name] ?? 'suggest_only',
        fieldName: cand.field_name,
        candidateValue: cand.candidate_value,
        currentValue: currentRow?.[mappedColumn] ?? null,
        confidence: Number(cand.confidence),
        trustScore: realTrustScore,
        policyMode: effectiveMode as 'suggest' | 'merge' | 'observe',
        operatorApproved: approvedSet.has(cand.id),
      });

      if (!decision.apply) {
        skipped++;
        summaries.push({
          candidateId: cand.id,
          fieldName: cand.field_name,
          mappedColumn,
          applied: false,
          reason: decision.reason,
          previousValue: currentRow?.[mappedColumn] ?? null,
          newValue: decision.newValue,
          writeId: null,
          alreadyCommitted: false,
        });
        continue;
      }

      // Wrap the actual UPDATE in a savepoint so a schema mismatch on one
      // column does not abort the whole commit.
      const bareTable = stripSchema(job.target_table);
      await client.query('SAVEPOINT sp_merge');
      try {
        await client.query(
          `UPDATE "${bareTable}"
              SET "${mappedColumn}" = $1,
                  updated_at = NOW()
            WHERE "${job.target_pk_field}" = $2`,
          [decision.newValue, job.target_record_id],
        );
        await client.query('RELEASE SAVEPOINT sp_merge');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_merge');
        logger.warn(
          { err: (err as Error).message, column: mappedColumn, value: decision.newValue },
          'merge apply UPDATE failed, continuing with next candidate',
        );
        summaries.push({
          candidateId: cand.id,
          fieldName: cand.field_name,
          mappedColumn,
          applied: false,
          reason: `UPDATE failed: ${(err as Error).message.slice(0, 120)}`,
          previousValue: currentRow?.[mappedColumn] ?? null,
          newValue: decision.newValue,
          writeId: null,
          alreadyCommitted: false,
        });
        continue;
      }

      const write = await recordWrite(
        {
          tenantId,
          jobId,
          candidateId: cand.id,
          entityName: cand.entity_type,
          targetTable: job.target_table,
          targetRecordId: job.target_record_id,
          entityAnchor: cand.entity_anchor ?? job.target_record_id,
          fieldName: cand.field_name,
          writtenValue: decision.newValue,
          previousValue: currentRow?.[mappedColumn] ?? null,
          factHash,
        },
        client,
      );

      applied++;
      summaries.push({
        candidateId: cand.id,
        fieldName: cand.field_name,
        mappedColumn,
        applied: true,
        reason: decision.reason,
        previousValue: currentRow?.[mappedColumn] ?? null,
        newValue: decision.newValue,
        writeId: write.id,
        alreadyCommitted: false,
      });
    }

    // Flip job status to committed if anything applied; stay in previewing
    // otherwise so the operator can still act on it.
    if (applied > 0) {
      await client.query(
        `UPDATE enrichment_jobs SET status = 'committed', completed_at = NOW() WHERE id = $1`,
        [jobId],
      );
    }

    return {
      jobId,
      policyId: policy.id,
      mode: effectiveMode,
      totalCandidates: candidates.length,
      applied,
      skipped,
      unmapped,
      alreadyCommitted: already,
      results: summaries,
    };
  });
}

// Helpers exposed for tests.
export const __test = { computeFactHash, ENTITY_FIELD_MAP };
