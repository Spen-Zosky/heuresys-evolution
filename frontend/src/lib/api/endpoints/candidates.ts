/**
 * Candidates API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/candidates';

export async function getCandidates(
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Record<string, unknown>>>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

export async function getCandidateById(
  id: string,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}`,
    options
  );
  return response.data;
}

export async function getCandidateStats(
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/stats`,
    options
  );
  return response.data;
}

export async function getPipeline(options?: RequestOptions): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    '/api/v1/recruiting/pipeline',
    options
  );
  return response.data;
}

export async function advanceCandidate(
  id: string,
  data: Record<string, unknown>,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.patch<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}/advance`,
    data,
    options
  );
  return response.data;
}
