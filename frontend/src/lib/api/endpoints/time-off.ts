/**
 * Time Off API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/time-off';

export async function getMyBalances(options?: RequestOptions): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/my/balances`,
    options
  );
  return response.data;
}

export async function getMyRequests(
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Record<string, unknown>>>>(
    `${BASE_PATH}/my/requests${queryString}`,
    options
  );
  return response.data;
}

export async function createRequest(
  data: Record<string, unknown>,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    BASE_PATH,
    data,
    options
  );
  return response.data;
}

export async function getLeaveTypes(options?: RequestOptions): Promise<Record<string, unknown>[]> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>[]>>(
    `${BASE_PATH}/leave-types`,
    options
  );
  return response.data;
}

export async function getTeamRequests(
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Record<string, unknown>>>>(
    `${BASE_PATH}/team-requests${queryString}`,
    options
  );
  return response.data;
}

export async function approveRequest(
  id: string,
  data: Record<string, unknown>,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.patch<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/requests/${id}/approve`,
    data,
    options
  );
  return response.data;
}
