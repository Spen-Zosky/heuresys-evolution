/**
 * Semantic Enrichment Engine API — SEE Fase 9
 *
 * Wraps /api/v1/enrichment/* proxy endpoints added in Fase 8.
 * Every call goes through api-gateway which enforces JWT + RBP
 * ENRICHMENT.{VIEW,CREATE,APPROVE,DELETE} permissions.
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/enrichment';

export type EnrichmentJobStatus =
  | 'pending'
  | 'queued'
  | 'crawling'
  | 'extracting'
  | 'previewing'
  | 'committed'
  | 'failed'
  | 'rolled_back'
  | 'cached'
  | 'partial';

export interface EnrichmentJob {
  id: string;
  tenant_id: string;
  descriptor_id: string;
  target_table: string;
  target_pk_field: string;
  target_record_id: string;
  policy_id: string | null;
  mode: 'suggest' | 'merge' | 'observe';
  status: EnrichmentJobStatus;
  idempotency_key: string;
  freshness_days: number;
  llm_cost_eur: string;
  error_details?: { message?: string; stack?: string } | null;
  created_at: string;
  completed_at: string | null;
}

export interface EnrichmentCandidate {
  id: string;
  tenant_id: string;
  job_id: string;
  entity_type: string;
  entity_anchor: string | null;
  field_name: string;
  candidate_value: unknown;
  confidence: string;
  extraction_method: string;
  llm_provider_code: string | null;
  fact_hash: string;
  created_at: string;
}

export interface CreateJobInput {
  entity_name: string;
  target_record_id: string;
  url: string;
  mode?: 'suggest' | 'merge' | 'observe';
}

export interface CreateJobResponse {
  jobId: string;
  cached: boolean;
  status?: string;
  message?: string;
  pollUrl?: string;
}

export interface CommitJobInput {
  approved_candidate_ids?: string[];
  force_mode?: 'suggest' | 'merge' | 'observe';
}

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

export interface CommitJobResponse {
  jobId: string;
  policyId: string;
  mode: string;
  totalCandidates: number;
  applied: number;
  skipped: number;
  unmapped: number;
  alreadyCommitted: number;
  identityBlocked?: boolean;
  identityReason?: string;
  results: ApplyCandidateSummary[];
}

export interface RollbackJobResponse {
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

export async function listEnrichmentJobs(
  params?: { status?: string; limit?: number; offset?: number },
  options?: RequestOptions
): Promise<EnrichmentJob[]> {
  const qs = params ? buildQueryString(params as Record<string, unknown>) : '';
  const response = await apiClient.get<
    ApiResponse<EnrichmentJob[] | { items?: EnrichmentJob[]; total?: number }>
  >(`${BASE_PATH}/jobs${qs}`, options);
  // Upstream engine returns { items: [...], total, limit, offset }
  // but earlier iterations returned a plain array. Handle both.
  const payload = response.data as unknown;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && 'items' in payload) {
    return (payload as { items?: EnrichmentJob[] }).items ?? [];
  }
  return [];
}

export async function getEnrichmentJob(
  id: string,
  options?: RequestOptions
): Promise<EnrichmentJob> {
  const response = await apiClient.get<ApiResponse<EnrichmentJob>>(
    `${BASE_PATH}/jobs/${id}`,
    options
  );
  return response.data;
}

export async function createEnrichmentJob(
  input: CreateJobInput,
  options?: RequestOptions
): Promise<CreateJobResponse> {
  const response = await apiClient.post<ApiResponse<CreateJobResponse>>(
    `${BASE_PATH}/jobs`,
    input,
    options
  );
  return response.data;
}

export async function deleteEnrichmentJob(
  id: string,
  options?: RequestOptions
): Promise<{ id: string; status: string }> {
  const response = await apiClient.delete<ApiResponse<{ id: string; status: string }>>(
    `${BASE_PATH}/jobs/${id}`,
    options
  );
  return response.data;
}

export async function commitEnrichmentJob(
  id: string,
  input: CommitJobInput,
  options?: RequestOptions
): Promise<CommitJobResponse> {
  const response = await apiClient.post<ApiResponse<CommitJobResponse>>(
    `${BASE_PATH}/jobs/${id}/commit`,
    input,
    options
  );
  return response.data;
}

export async function rollbackEnrichmentJob(
  id: string,
  options?: RequestOptions
): Promise<RollbackJobResponse> {
  const response = await apiClient.post<ApiResponse<RollbackJobResponse>>(
    `${BASE_PATH}/jobs/${id}/rollback`,
    {},
    options
  );
  return response.data;
}

// SEE Fase 10 — tenant metrics.

export interface EnrichmentMetrics {
  tenantId: string;
  generatedAt: string;
  jobs: {
    total: number;
    byStatus: Record<string, number>;
    lastCompletedAt: string | null;
  };
  candidates: {
    total: number;
    avgConfidence: number;
  };
  writes: {
    total: number;
    activeWrites: number;
    rolledBack: number;
    identityBlockedLast30d: number;
  };
  acquisition: {
    sourcesTotal: number;
    freshnessHits: number;
  };
  budget: {
    capEur: number;
    usedEur: number;
    remainingEur: number;
    percentUsed: number;
  };
}

export async function getEnrichmentMetrics(options?: RequestOptions): Promise<EnrichmentMetrics> {
  const response = await apiClient.get<ApiResponse<EnrichmentMetrics>>(
    `${BASE_PATH}/metrics`,
    options
  );
  return response.data;
}
