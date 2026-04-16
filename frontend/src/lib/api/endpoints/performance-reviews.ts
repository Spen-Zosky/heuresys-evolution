/**
 * Performance Reviews API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString, normalizeListResponse } from '../client';
import type {
  ApiResponse,
  PerformanceReview,
  ReviewStats,
  ReviewFilters,
  CreateReviewRequest,
  UpdateReviewRequest,
  PaginatedResponse,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/performance-reviews';

export async function getReviews(
  params?: ReviewFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<PerformanceReview>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: PerformanceReview[] | PaginatedResponse<PerformanceReview>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${BASE_PATH}${queryString}`, options);
  return normalizeListResponse<PerformanceReview>(response, params);
}

export async function getReviewById(
  id: string,
  options?: RequestOptions
): Promise<PerformanceReview> {
  const response = await apiClient.get<ApiResponse<PerformanceReview>>(
    `${BASE_PATH}/${id}`,
    options
  );
  return response.data;
}

export async function getReviewStats(options?: RequestOptions): Promise<ReviewStats> {
  const response = await apiClient.get<ApiResponse<ReviewStats>>(`${BASE_PATH}/stats`, options);
  return response.data;
}

export async function createReview(
  data: CreateReviewRequest,
  options?: RequestOptions
): Promise<PerformanceReview> {
  const response = await apiClient.post<ApiResponse<PerformanceReview>>(BASE_PATH, data, options);
  return response.data;
}

export async function updateReview(
  id: string,
  data: UpdateReviewRequest,
  options?: RequestOptions
): Promise<PerformanceReview> {
  const response = await apiClient.put<ApiResponse<PerformanceReview>>(
    `${BASE_PATH}/${id}`,
    data,
    options
  );
  return response.data;
}

export async function deleteReview(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`${BASE_PATH}/${id}`, options);
}
