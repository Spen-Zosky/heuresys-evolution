/**
 * Certifications API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/certifications';

export async function getCertifications(
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

export async function getCertificationById(
  id: string,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}`,
    options
  );
  return response.data;
}

export async function createCertification(
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

export async function deleteCertification(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`${BASE_PATH}/${id}`, options);
}
