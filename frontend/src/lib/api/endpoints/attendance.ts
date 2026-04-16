import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

const BASE_PATH = '/api/v1/attendance';

export async function getAttendance(
  params?: { employee_id?: string; page?: number; limit?: number },
  options?: RequestOptions
) {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<any>>(`${BASE_PATH}${queryString}`, options);
  const payload = response.data;
  if (Array.isArray(payload)) return payload;
  if (payload?.items) return payload.items;
  return [];
}
