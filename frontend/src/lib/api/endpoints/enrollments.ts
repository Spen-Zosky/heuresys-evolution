/**
 * Enrollments API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/enrollments';

export async function getEnrollments(
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

export async function getEnrollmentStats(
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/stats`,
    options
  );
  return response.data;
}

export async function createEnrollment(
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

export async function completeEnrollment(
  id: string,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.patch<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}/complete`,
    {},
    options
  );
  return response.data;
}
