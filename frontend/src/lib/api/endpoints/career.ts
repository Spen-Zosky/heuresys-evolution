import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

export async function getCareerPaths(params?: { employee_id?: string }, options?: RequestOptions) {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<any>>(
    `/api/v1/career-paths${queryString}`,
    options
  );
  return response.data;
}

export async function getSuccessionPlans(
  params?: { employee_id?: string },
  options?: RequestOptions
) {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<any>>(
    `/api/v1/succession${queryString}`,
    options
  );
  return response.data;
}

export async function getWellbeing(params?: { employee_id?: string }, options?: RequestOptions) {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<any>>(
    `/api/v1/wellbeing${queryString}`,
    options
  );
  return response.data;
}

export async function getTurnoverRisk(params?: { employee_id?: string }, options?: RequestOptions) {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<any>>(
    `/api/v1/predictions${queryString}`,
    options
  );
  return response.data;
}
