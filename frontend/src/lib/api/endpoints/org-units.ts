/**
 * OrgUnits API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  OrgUnit,
  OrgUnitStats,
  PaginationParams,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/org-units';

/**
 * Get all departments
 */
export async function getOrgUnits(
  params?: PaginationParams & {
    is_active?: boolean;
    org_type?: string;
    parent_id?: string;
    search?: string;
  },
  options?: RequestOptions
): Promise<OrgUnit[]> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<OrgUnit[]>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get department by ID
 */
export async function getOrgUnitById(id: string, options?: RequestOptions): Promise<OrgUnit> {
  const response = await apiClient.get<ApiResponse<OrgUnit>>(`${BASE_PATH}/${id}`, options);
  return response.data;
}

/**
 * Create new department
 */
export async function createOrgUnit(
  data: Partial<OrgUnit>,
  options?: RequestOptions
): Promise<OrgUnit> {
  const response = await apiClient.post<ApiResponse<OrgUnit>>(BASE_PATH, data, options);
  return response.data;
}

/**
 * Update department
 */
export async function updateOrgUnit(
  id: string,
  data: Partial<OrgUnit>,
  options?: RequestOptions
): Promise<OrgUnit> {
  const response = await apiClient.put<ApiResponse<OrgUnit>>(`${BASE_PATH}/${id}`, data, options);
  return response.data;
}

/**
 * Delete department
 */
export async function deleteOrgUnit(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/${id}`, options);
}

/**
 * Get department statistics
 */
export async function getOrgUnitStats(options?: RequestOptions): Promise<OrgUnitStats[]> {
  const response = await apiClient.get<ApiResponse<OrgUnitStats[]>>(`${BASE_PATH}/stats`, options);
  return response.data;
}

/**
 * Get department tree (hierarchical structure)
 */
export async function getOrgUnitTree(options?: RequestOptions): Promise<OrgUnit[]> {
  const response = await apiClient.get<ApiResponse<OrgUnit[]>>(`${BASE_PATH}/tree`, options);
  return response.data;
}

/**
 * Get department employee count
 */
export async function getOrgUnitEmployeeCount(
  id: string,
  options?: RequestOptions
): Promise<number> {
  const response = await apiClient.get<ApiResponse<{ count: number }>>(
    `${BASE_PATH}/${id}/employee-count`,
    options
  );
  return response.data.count;
}

/**
 * Get org unit types
 */
export async function getOrgUnitTypes(options?: RequestOptions): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>(`${BASE_PATH}/types`, options);
  return response.data;
}
