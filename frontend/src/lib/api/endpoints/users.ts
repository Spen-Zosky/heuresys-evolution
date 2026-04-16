/**
 * Users API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/users';

export async function getUsers(
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

export async function getUserById(
  id: string,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}`,
    options
  );
  return response.data;
}

export async function createUser(
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

export async function updateUser(
  id: string,
  data: Record<string, unknown>,
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.patch<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}`,
    data,
    options
  );
  return response.data;
}

export async function deleteUser(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`${BASE_PATH}/${id}`, options);
}

export async function resetPassword(
  id: string,
  data: { new_password: string },
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `${BASE_PATH}/${id}/reset-password`,
    data,
    options
  );
  return response.data;
}

export async function getRoles(options?: RequestOptions): Promise<Record<string, unknown>[]> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>[]>>(
    `${BASE_PATH}/meta/roles`,
    options
  );
  return response.data;
}

export async function getAvailableTenants(
  options?: RequestOptions
): Promise<Record<string, unknown>[]> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>[]>>(
    '/api/v1/tenants',
    options
  );
  // Backend returns tenants array in different shapes
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data)
    return (data as Record<string, unknown>).items as Record<string, unknown>[];
  return [];
}
