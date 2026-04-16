import { apiClient } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/contracts';

export async function getContractsByEmployee(employeeId: string, options?: RequestOptions) {
  const response = await apiClient.get<ApiResponse<any[]>>(
    `${BASE_PATH}/employee/${employeeId}`,
    options
  );
  return Array.isArray(response.data) ? response.data : [];
}
