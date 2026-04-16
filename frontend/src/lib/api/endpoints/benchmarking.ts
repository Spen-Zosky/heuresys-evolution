/**
 * Benchmarking API — O3.8 Cross-Tenant Benchmarking
 * Endpoint wrappers for anonymized industry comparison data.
 */

import { apiClient } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

// ============================================
// TYPES
// ============================================

export type BenchmarkPosition = 'above_average' | 'at_average' | 'below_average' | 'no_data';

export interface MetricBenchmark {
  metric: string;
  label: string;
  unit: string;
  industryAvg: number | null;
  peerCount: number;
}

export interface IndustryBenchmarkResult {
  naceCode: string;
  industryName: string | null;
  companySizeCode: string | null;
  metrics: MetricBenchmark[];
}

export interface MetricComparison {
  metric: string;
  label: string;
  unit: string;
  tenantValue: number | null;
  industryAvg: number | null;
  position: BenchmarkPosition;
  peerCount: number;
}

export interface TenantPositionResult {
  tenantId: string;
  tenantName: string;
  naceCode: string | null;
  companySizeCode: string | null;
  metrics: MetricComparison[];
}

// ============================================
// ENDPOINTS
// ============================================

export async function getIndustryBenchmark(
  naceCode: string,
  options?: RequestOptions
): Promise<IndustryBenchmarkResult> {
  const response = await apiClient.get<ApiResponse<IndustryBenchmarkResult>>(
    `/api/v1/benchmarking/industry/${encodeURIComponent(naceCode)}`,
    options
  );
  return response.data;
}

export async function getMyPosition(options?: RequestOptions): Promise<TenantPositionResult> {
  const response = await apiClient.get<ApiResponse<TenantPositionResult>>(
    '/api/v1/benchmarking/my-position',
    options
  );
  return response.data;
}
