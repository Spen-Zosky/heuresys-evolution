/**
 * People API Endpoints — Heuresys Platform
 * Wrappers for employee list, detail, skills, and process qualification.
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  Employee,
  EmployeeListResponse,
  EmployeeFilters,
  EmployeeSkill,
  PaginationParams,
  RequestOptions,
} from '../types';
import type { EmployeeProcessQualification } from './process-layer';

// ============================================
// TYPES
// ============================================

export interface PeopleListFilters extends EmployeeFilters, PaginationParams {}

export interface GapAnalysisSkill {
  skill_id: string;
  skill_name: string;
  required_level: number;
  current_level: number;
  gap: number;
  source: string;
}

export interface GapAnalysisResult {
  employee_id: string;
  total_required: number;
  total_held: number;
  gap_count: number;
  skills: GapAnalysisSkill[];
}

// ============================================
// ENDPOINTS
// ============================================

const EMPLOYEES_BASE = '/api/v1/employees';

export async function getEmployees(
  params?: PeopleListFilters,
  options?: RequestOptions
): Promise<EmployeeListResponse> {
  const qs = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<EmployeeListResponse>>(
    `${EMPLOYEES_BASE}${qs}`,
    options
  );
  return response.data;
}

export async function getEmployeeById(id: string, options?: RequestOptions): Promise<Employee> {
  const response = await apiClient.get<ApiResponse<Employee>>(`${EMPLOYEES_BASE}/${id}`, options);
  return response.data;
}

export async function getEmployeeSkills(
  employeeId: string,
  options?: RequestOptions
): Promise<EmployeeSkill[]> {
  const response = await apiClient.get<ApiResponse<{ skills: EmployeeSkill[] }>>(
    `/api/v1/employee-skill-profiles/${employeeId}`,
    options
  );
  return response.data?.skills ?? [];
}

export async function getEmployeeProcessQualification(
  employeeId: string,
  options?: RequestOptions
): Promise<EmployeeProcessQualification[]> {
  const response = await apiClient.get<{
    data: EmployeeProcessQualification[];
    meta: { total: number };
  }>(`/api/v1/graph/employee/${employeeId}/process-qualification`, options);
  return response.data;
}

export async function getEmployeeGapAnalysis(
  employeeId: string,
  options?: RequestOptions
): Promise<GapAnalysisResult> {
  const response = await apiClient.get<ApiResponse<GapAnalysisResult>>(
    `/api/v1/gap-analysis/employee/${employeeId}`,
    options
  );
  return response.data;
}
