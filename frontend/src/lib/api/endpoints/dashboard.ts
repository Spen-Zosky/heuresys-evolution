/**
 * Dashboard API Endpoints - Heuresys Platform
 */

import { apiClient } from '../client';
import type { ApiResponse, DashboardStats, DashboardKPI, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/dashboard';

/**
 * Get dashboard overview stats
 */
export async function getDashboardStats(options?: RequestOptions): Promise<DashboardStats> {
  const response = await apiClient.get<ApiResponse<DashboardStats>>(
    `${BASE_PATH}/overview`,
    options
  );
  return response.data;
}

/**
 * Get dashboard KPIs
 */
export async function getDashboardKPIs(options?: RequestOptions): Promise<DashboardKPI[]> {
  const response = await apiClient.get<ApiResponse<DashboardKPI[]>>(`${BASE_PATH}/kpis`, options);
  return response.data;
}

/**
 * Get recent activity
 */
export async function getRecentActivity(
  limit: number = 10,
  options?: RequestOptions
): Promise<
  {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
  }[]
> {
  const response = await apiClient.get<
    ApiResponse<
      {
        id: string;
        type: string;
        description: string;
        timestamp: string;
        user?: string;
      }[]
    >
  >(`${BASE_PATH}/activity?limit=${limit}`, options);
  return response.data;
}

/**
 * Get goal statistics
 */
export async function getGoalStats(options?: RequestOptions): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
}> {
  const response = await apiClient.get<
    ApiResponse<{
      total: number;
      completed: number;
      inProgress: number;
      notStarted: number;
      completionRate: number;
    }>
  >('/api/v1/goals/stats', options);
  return response.data;
}

/**
 * Get course statistics
 */
export async function getCourseStats(options?: RequestOptions): Promise<{
  total: number;
  active: number;
  totalEnrollments: number;
  completedEnrollments: number;
}> {
  const response = await apiClient.get<
    ApiResponse<{
      total: number;
      active: number;
      totalEnrollments: number;
      completedEnrollments: number;
    }>
  >('/api/v1/courses/stats', options);
  return response.data;
}

/**
 * Get performance review statistics
 */
export async function getPerformanceStats(options?: RequestOptions): Promise<{
  total: number;
  pending: number;
  completed: number;
  upcoming: number;
}> {
  const response = await apiClient.get<
    ApiResponse<{
      total: number;
      pending: number;
      completed: number;
      upcoming: number;
    }>
  >('/api/v1/performance-reviews/stats', options);
  return response.data;
}
