/**
 * Audit Logs API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/audit-logs';

export async function getAuditLogs(
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

export async function getAuditLogStats(options?: RequestOptions): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/stats`,
    options
  );
  return response.data;
}

export async function getAuditLogById(
  id: string,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}`,
    options
  );
  return response.data;
}
