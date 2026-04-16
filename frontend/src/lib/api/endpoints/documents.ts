/**
 * Employee Documents API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  EmployeeDocument,
  DocumentFilters,
  PaginatedResponse,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/employee-documents';

export async function getDocuments(
  params?: DocumentFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<EmployeeDocument>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<PaginatedResponse<EmployeeDocument>>>(
    `${BASE_PATH}${queryString}`,
    options
  );
  return response.data;
}

export async function getDocumentById(
  id: string,
  options?: RequestOptions
): Promise<EmployeeDocument> {
  const response = await apiClient.get<ApiResponse<EmployeeDocument>>(
    `${BASE_PATH}/${id}`,
    options
  );
  return response.data;
}

export async function getEmployeeDocuments(
  _employeeId: string,
  options?: RequestOptions
): Promise<EmployeeDocument[]> {
  // Note: Backend uses JWT userId to resolve employee, not explicit employee_id.
  // Admin endpoint for cross-employee document access is pending.
  const response = await apiClient.get<ApiResponse<EmployeeDocument[]>>(BASE_PATH, options);
  return response.data;
}

export async function getDocumentCategories(
  options?: RequestOptions
): Promise<{ id: string; name: string }[]> {
  const response = await apiClient.get<ApiResponse<{ id: string; name: string }[]>>(
    `${BASE_PATH}/categories`,
    options
  );
  return response.data;
}
