/**
 * Goals API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString, normalizeListResponse } from '../client';
import type {
  ApiResponse,
  Goal,
  GoalStats,
  GoalFilters,
  CreateGoalRequest,
  UpdateGoalRequest,
  PaginatedResponse,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/goals';

export async function getGoals(
  params?: GoalFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Goal>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: Goal[] | PaginatedResponse<Goal>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${BASE_PATH}${queryString}`, options);
  return normalizeListResponse<Goal>(response, params);
}

export async function getGoalById(id: string, options?: RequestOptions): Promise<Goal> {
  const response = await apiClient.get<ApiResponse<Goal>>(`${BASE_PATH}/${id}`, options);
  return response.data;
}

export async function getGoalStats(options?: RequestOptions): Promise<GoalStats> {
  const response = await apiClient.get<ApiResponse<GoalStats>>(`${BASE_PATH}/stats`, options);
  return response.data;
}

export async function createGoal(data: CreateGoalRequest, options?: RequestOptions): Promise<Goal> {
  const response = await apiClient.post<ApiResponse<Goal>>(BASE_PATH, data, options);
  return response.data;
}

export async function updateGoal(
  id: string,
  data: UpdateGoalRequest,
  options?: RequestOptions
): Promise<Goal> {
  const response = await apiClient.put<ApiResponse<Goal>>(`${BASE_PATH}/${id}`, data, options);
  return response.data;
}

export async function deleteGoal(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`${BASE_PATH}/${id}`, options);
}
