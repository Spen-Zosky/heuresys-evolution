/**
 * Check-ins API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString, normalizeListResponse } from '../client';
import type {
  ApiResponse,
  CheckIn,
  CheckInStats,
  CheckInFilters,
  CreateCheckInRequest,
  UpdateCheckInRequest,
  PaginatedResponse,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/check-ins';

export async function getCheckIns(
  params?: CheckInFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<CheckIn>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: PaginatedResponse<CheckIn> | CheckIn[];
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${BASE_PATH}${queryString}`, options);
  return normalizeListResponse<CheckIn>(response, params);
}

export async function getCheckInById(id: string, options?: RequestOptions): Promise<CheckIn> {
  const response = await apiClient.get<ApiResponse<CheckIn>>(`${BASE_PATH}/${id}`, options);
  return response.data;
}

export async function getCheckInStats(options?: RequestOptions): Promise<CheckInStats> {
  const response = await apiClient.get<ApiResponse<CheckInStats>>(`${BASE_PATH}/stats`, options);
  return response.data;
}

export async function getUpcomingCheckIns(
  params?: { employee_id?: string; manager_id?: string; days?: number },
  options?: RequestOptions
): Promise<CheckIn[]> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<CheckIn[]>>(
    `${BASE_PATH}/upcoming${queryString}`,
    options
  );
  return response.data;
}

export async function createCheckIn(
  data: CreateCheckInRequest,
  options?: RequestOptions
): Promise<CheckIn> {
  const response = await apiClient.post<ApiResponse<CheckIn>>(BASE_PATH, data, options);
  return response.data;
}

export async function updateCheckIn(
  id: string,
  data: UpdateCheckInRequest,
  options?: RequestOptions
): Promise<CheckIn> {
  const response = await apiClient.put<ApiResponse<CheckIn>>(`${BASE_PATH}/${id}`, data, options);
  return response.data;
}

export async function completeCheckIn(
  id: string,
  data: UpdateCheckInRequest,
  options?: RequestOptions
): Promise<CheckIn> {
  const response = await apiClient.patch<ApiResponse<CheckIn>>(
    `${BASE_PATH}/${id}/complete`,
    data,
    options
  );
  return response.data;
}
