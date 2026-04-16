/**
 * Skills API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  Skill,
  EmployeeSkill,
  SkillFilters,
  PaginatedResponse,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/skills';

export async function getSkills(
  params?: SkillFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Skill>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    success: boolean;
    data: Array<Record<string, unknown>>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${BASE_PATH}${queryString}`, options);

  const rawItems = Array.isArray(response.data) ? response.data : [];
  const meta = response.meta;
  const limit = params?.limit ?? meta?.limit ?? 20;
  const page = params?.page ?? (meta?.offset ? Math.floor(meta.offset / limit) + 1 : 1);
  const total = meta?.total ?? rawItems.length;

  const items: Skill[] = rawItems.map((s) => ({
    id: String(s.id ?? ''),
    name: String(s.preferred_label_en ?? s.preferred_label ?? s.name ?? ''),
    description: s.description_en
      ? String(s.description_en)
      : s.description
        ? String(s.description)
        : undefined,
    category: s.primary_category ? String(s.primary_category) : undefined,
    skill_type: s.skill_type ? String(s.skill_type) : undefined,
    is_active: true,
    esco_uri: s.uri ? String(s.uri) : undefined,
    created_at: String(s.created_at ?? ''),
    updated_at: String(s.updated_at ?? ''),
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getSkillById(id: string, options?: RequestOptions): Promise<Skill> {
  const response = await apiClient.get<ApiResponse<Skill>>(`${BASE_PATH}/${id}`, options);
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

export async function getSkillGapAnalysis(
  employeeId: string,
  options?: RequestOptions
): Promise<unknown> {
  const response = await apiClient.get<ApiResponse<unknown>>(
    `/api/v1/gap-analysis/employee/${employeeId}`,
    options
  );
  return response.data;
}
