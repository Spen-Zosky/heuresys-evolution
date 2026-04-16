/**
 * Employees API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  Employee,
  EmployeeListResponse,
  EmployeeFilters,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  PaginationParams,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/employees';

/**
 * Get paginated list of employees
 */
export async function getEmployees(
  params?: EmployeeFilters & PaginationParams,
  options?: RequestOptions
): Promise<EmployeeListResponse> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<EmployeeListResponse>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get employee by ID
 */
export async function getEmployeeById(id: string, options?: RequestOptions): Promise<Employee> {
  const response = await apiClient.get<ApiResponse<Employee>>(`${BASE_PATH}/${id}`, options);
  return response.data;
}

/**
 * Create new employee
 */
export async function createEmployee(
  data: CreateEmployeeRequest,
  options?: RequestOptions
): Promise<Employee> {
  const response = await apiClient.post<ApiResponse<Employee>>(BASE_PATH, data, options);
  return response.data;
}

/**
 * Update employee
 */
export async function updateEmployee(
  id: string,
  data: UpdateEmployeeRequest,
  options?: RequestOptions
): Promise<Employee> {
  const response = await apiClient.put<ApiResponse<Employee>>(`${BASE_PATH}/${id}`, data, options);
  return response.data;
}

/**
 * Delete employee
 */
export async function deleteEmployee(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/${id}`, options);
}

/**
 * Get employee count
 */
export async function getEmployeeCount(options?: RequestOptions): Promise<number> {
  const response = await apiClient.get<ApiResponse<{ count: number }>>(
    `${BASE_PATH}/count`,
    options
  );
  return response.data.count;
}

/**
 * Search employees
 */
export async function searchEmployees(
  query: string,
  params?: PaginationParams,
  options?: RequestOptions
): Promise<EmployeeListResponse> {
  const queryString = buildQueryString({ search: query, ...params });
  const response = await apiClient.get<ApiResponse<EmployeeListResponse>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get employees by department
 */
export async function getEmployeesByDepartment(
  orgUnitId: string,
  params?: PaginationParams,
  options?: RequestOptions
): Promise<EmployeeListResponse> {
  const queryString = buildQueryString({ org_unit_id: orgUnitId, ...params });
  const response = await apiClient.get<ApiResponse<EmployeeListResponse>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get employees by manager
 */
export async function getEmployeesByManager(
  managerId: string,
  params?: PaginationParams,
  options?: RequestOptions
): Promise<EmployeeListResponse> {
  const queryString = buildQueryString({ manager_id: managerId, ...params });
  const response = await apiClient.get<ApiResponse<EmployeeListResponse>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get employee statistics
 */
export async function getEmployeeStats(options?: RequestOptions): Promise<{
  total: number;
  active: number;
  inactive: number;
  byDepartment: { name: string; count: number }[];
}> {
  const response = await apiClient.get<
    ApiResponse<{
      total: number;
      active: number;
      inactive: number;
      byDepartment: { name: string; count: number }[];
    }>
  >(`${BASE_PATH}/stats`, options);
  return response.data;
}
