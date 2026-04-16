import { loadDescriptor, type EntityDescriptor } from '../db/descriptors.js';
import { createJob, recordJobEvent, updateJobStatus } from '../db/jobs.js';
import { fetchAndStore } from '../acquisition/fetcher.js';
import { extract } from '../extraction/llm.js';
import { insertCandidate } from '../db/candidates.js';
import {
  assertBudgetAvailable,
  BudgetExceededError,
  estimateCostEur,
  incrementBudgetUsage,
} from '../db/budget.js';
import { withTenantClient } from '../db/pool.js';

export interface PipelineInput {
  tenantId: string;
  entityName: string;
  targetRecordId: string;
  url: string;
  mode?: 'suggest' | 'merge' | 'observe';
}

export interface PipelineCandidate {
  id: string;
  field: string;
  value: unknown;
  isNew: boolean;
}

export interface PipelineResult {
  jobId: string;
  cached: boolean;
  snapshot?: {
    id: string;
    httpStatus: number;
    contentHash: string;
    bytes: number;
  };
  extraction?: {
    provider: string;
    model: string;
    confidenceOverall: number;
    inputTokens: number;
    outputTokens: number;
  };
  candidates?: PipelineCandidate[];
}

/**
 * Idempotent job creation: returns the job row and a `cached` flag.
 * Used by both the inline POST path (when resolving to a cached result) and
 * the async enqueue path (to reserve the job id before pushing to BullMQ).
 */
export async function createJobRow(
  input: PipelineInput,
): Promise<{ jobId: string; cached: boolean; descriptor: EntityDescriptor }> {
  const descriptor = await loadDescriptor(input.entityName);
  const job = await withTenantClient(input.tenantId, (c) =>
    createJob(
      {
        tenantId: input.tenantId,
        descriptorId: descriptor.id,
        targetTable: descriptor.target_table,
        targetPkField: descriptor.pk_field,
        targetRecordId: input.targetRecordId,
        semanticScope: { seed_url: input.url },
        policyId: descriptor.default_merge_policy_id,
        mode: input.mode ?? descriptor.default_mode,
      },
      c,
    ),
  );
  return { jobId: job.id, cached: job.cached, descriptor };
}

/**
 * Runs the crawl→extract→persist pipeline for an existing non-cached job row.
 * Assumes `createJobRow` has already reserved the job id.
 */
export async function runPipeline(
  jobId: string,
  input: PipelineInput,
  descriptor: EntityDescriptor,
): Promise<PipelineResult> {
  const { tenantId } = input;

  await withTenantClient(tenantId, async (c) => {
    await updateJobStatus(jobId, 'crawling', undefined, c);
    await recordJobEvent(jobId, tenantId, 'acquisition.start', { url: input.url }, c);
  });

  const fetched = await fetchAndStore(input.url, tenantId, jobId, 'official_website', 7, descriptor.crawl_config);

  await withTenantClient(tenantId, (c) =>
    recordJobEvent(
      jobId,
      tenantId,
      'acquisition.done',
      { snapshotId: fetched.snapshotId, httpStatus: fetched.httpStatus, bytes: fetched.bytesSize },
      c,
    ),
  );

  await withTenantClient(tenantId, (c) => updateJobStatus(jobId, 'extracting', undefined, c));

  // SEE Fase 10 — budget pre-flight. Refuse the extract step if the
  // policy's current_usage_eur has already reached budget_cap_eur.
  // The job is marked failed with a structured BUDGET_EXCEEDED error
  // so the operator sees the reason in the admin UI.
  if (descriptor.default_merge_policy_id) {
    try {
      await assertBudgetAvailable(descriptor.default_merge_policy_id);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        await withTenantClient(tenantId, async (c) => {
          await updateJobStatus(
            jobId,
            'failed',
            { code: 'BUDGET_EXCEEDED', message: err.message },
            c,
          );
          await recordJobEvent(
            jobId,
            tenantId,
            'budget.exceeded',
            { policyId: err.policyId, capEur: err.capEur, usedEur: err.usedEur },
            c,
          );
        });
        throw err;
      }
      throw err;
    }
  }

  const extracted = await extract({
    schema: descriptor.extraction_schema,
    entityName: descriptor.entity_name,
    markdown: fetched.markdown,
  });

  // Charge the policy for the spend we just incurred.
  if (descriptor.default_merge_policy_id) {
    const cost = estimateCostEur(
      extracted.providerCode,
      extracted.inputTokens,
      extracted.outputTokens,
    );
    if (cost > 0) {
      await incrementBudgetUsage(descriptor.default_merge_policy_id, cost);
    }
  }

  const candidates: PipelineCandidate[] = [];
  await withTenantClient(tenantId, async (c) => {
    await recordJobEvent(
      jobId,
      tenantId,
      'extraction.done',
      {
        provider: extracted.providerCode,
        model: extracted.model,
        inputTokens: extracted.inputTokens,
        outputTokens: extracted.outputTokens,
      },
      c,
    );
    for (const [fieldName, fieldValue] of Object.entries(extracted.raw)) {
      if (fieldValue === null || fieldValue === undefined || fieldValue === '') continue;
      // SEE Fase 5: use per-field confidence instead of the overall rate so
      // that "website" (strong shape match) and "description" (free text)
      // don't share the same score.
      const fieldConfidence =
        extracted.confidenceByField?.[fieldName] ?? extracted.confidenceOverall;
      const candidate = await insertCandidate(
        {
          tenantId,
          jobId,
          snapshotId: fetched.snapshotId,
          entityType: descriptor.entity_name,
          entityAnchor: input.targetRecordId,
          fieldName,
          candidateValue: fieldValue,
          confidence: fieldConfidence,
          extractionMethod: 'llm_structured',
          llmProviderCode: extracted.providerCode,
          sourceUrl: input.url,
        },
        c,
      );
      candidates.push({ id: candidate.id, field: fieldName, value: fieldValue, isNew: candidate.isNew });
    }
    await updateJobStatus(jobId, 'previewing', undefined, c);
    await recordJobEvent(jobId, tenantId, 'candidates.persisted', { count: candidates.length }, c);
  });

  return {
    jobId,
    cached: false,
    snapshot: {
      id: fetched.snapshotId,
      httpStatus: fetched.httpStatus,
      contentHash: fetched.contentHash,
      bytes: fetched.bytesSize,
    },
    extraction: {
      provider: extracted.providerCode,
      model: extracted.model,
      confidenceOverall: extracted.confidenceOverall,
      inputTokens: extracted.inputTokens,
      outputTokens: extracted.outputTokens,
    },
    candidates,
  };
}

/**
 * Mark a job as failed with error details recorded in both status row and events.
 * Used by the worker on pipeline exceptions.
 */
export async function markJobFailed(tenantId: string, jobId: string, error: Error): Promise<void> {
  await withTenantClient(tenantId, async (c) => {
    await updateJobStatus(jobId, 'failed', { message: error.message, stack: error.stack }, c);
    await recordJobEvent(jobId, tenantId, 'pipeline.failed', { message: error.message }, c);
  });
}
