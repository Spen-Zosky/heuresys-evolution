/**
 * Blueprint API Endpoints — Heuresys Platform
 * Manage blueprint runs: create, list, detail, results, apply.
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

// ============================================
// TYPES
// ============================================

export interface BlueprintRun {
  id: string;
  templateId: string;
  tenantId: string;
  runMode: 'greenfield' | 'overlay';
  status: string;
  inputConfig: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BlueprintRunDetail {
  run: BlueprintRun;
  severitySummary: Record<string, number>;
}

export interface BlueprintResult {
  id: string;
  runId: string;
  resultType: string;
  severity: string | null;
  title: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  isApplied: boolean;
  appliedAt: string | null;
  appliedBy: string | null;
  createdAt: string;
}

export interface CreateBlueprintRunRequest {
  templateId: string;
  runMode: 'greenfield' | 'overlay';
  inputConfig?: Record<string, unknown>;
}

// ============================================
// ENDPOINTS
// ============================================

const BASE_PATH = '/api/v1/blueprint';

export async function getBlueprintRuns(
  params?: { limit?: number; offset?: number },
  options?: RequestOptions
): Promise<BlueprintRun[]> {
  const qs = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: BlueprintRun[];
    meta: { total: number; limit: number; offset: number; hasMore: boolean };
  }>(`${BASE_PATH}/runs${qs}`, options);
  return response.data;
}

export async function getBlueprintRun(
  runId: string,
  options?: RequestOptions
): Promise<BlueprintRunDetail> {
  const response = await apiClient.get<{ success: boolean; data: BlueprintRunDetail }>(
    `${BASE_PATH}/runs/${runId}`,
    options
  );
  return response.data;
}

export async function getBlueprintResults(
  runId: string,
  filters?: Record<string, string>,
  options?: RequestOptions
): Promise<BlueprintResult[]> {
  const qs = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: BlueprintResult[];
    meta: { total: number; limit: number; offset: number; hasMore: boolean };
  }>(`${BASE_PATH}/runs/${runId}/results${qs}`, options);
  return response.data;
}

export async function createBlueprintRun(
  data: CreateBlueprintRunRequest,
  options?: RequestOptions
): Promise<BlueprintRun> {
  const response = await apiClient.post<{ success: boolean; data: BlueprintRun }>(
    `${BASE_PATH}/runs`,
    data,
    options
  );
  return response.data;
}

// ============================================
// ONTOLOGY
// ============================================

export interface IndustryClassification {
  id: string;
  code: string;
  description: string;
  level: number;
  parentCode: string | null;
}

export async function getIndustries(
  level?: number,
  options?: RequestOptions
): Promise<IndustryClassification[]> {
  const qs = level ? buildQueryString({ level }) : '';
  const response = await apiClient.get<{ success: boolean; data: IndustryClassification[] }>(
    `/api/v1/ontology/industries${qs}`,
    options
  );
  return response.data;
}

export async function applyBlueprintResult(
  runId: string,
  resultId: string,
  options?: RequestOptions
): Promise<BlueprintResult> {
  const response = await apiClient.post<{ success: boolean; data: BlueprintResult }>(
    `${BASE_PATH}/runs/${runId}/results/${resultId}/apply`,
    undefined,
    options
  );
  return response.data;
}
