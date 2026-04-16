/**
 * Feedback API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/feedback';

export async function getFeedback(
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

export async function getContinuousFeedback(
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Record<string, unknown>>>>(
    `/api/v1/continuous-feedback${queryString}`,
    options
  );
  return response.data;
}

export async function createFeedback(
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

export async function getFeedbackCategories(
  options?: RequestOptions
): Promise<Record<string, unknown>[]> {
  const response = await apiClient.get<ApiResponse<Record<string, unknown>[]>>(
    `${BASE_PATH}/categories`,
    options
  );
  return response.data;
}

export async function get360Reviews(
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Record<string, unknown>>>>(
    `/api/v1/360-reviews${queryString}`,
    options
  );
  return response.data;
}
