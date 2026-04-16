/**
 * Organization API Endpoints — Heuresys Platform
 * Wrappers for /api/v1/org-units and /api/v1/graph/org-unit endpoints.
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, OrgUnit, RequestOptions } from '../types';

// ============================================
// TYPES
// ============================================

export interface OrgUnitEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  hire_date?: string;
  skill_count?: number;
}

export interface OrgUnitCoverageSkill {
  skillId: string;
  skillLabel: string;
  proficiencyLevel: number;
  isMandatory: boolean;
  employeeCoverage: number;
}

export interface OrgUnitListFilters {
  is_active?: boolean;
  org_type?: string;
  parent_id?: string | 'null';
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// ORG UNITS ENDPOINTS (/api/v1/org-units)
// ============================================

const ORG_UNITS_BASE = '/api/v1/org-units';

export async function getOrgUnits(
  filters?: OrgUnitListFilters,
  options?: RequestOptions
): Promise<OrgUnit[]> {
  const qs = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<OrgUnit[]>>(`${ORG_UNITS_BASE}${qs}`, options);
  return response.data;
}

export async function getOrgUnitById(id: string, options?: RequestOptions): Promise<OrgUnit> {
  const response = await apiClient.get<ApiResponse<OrgUnit>>(`${ORG_UNITS_BASE}/${id}`, options);
  return response.data;
}

export async function getOrgUnitTree(options?: RequestOptions): Promise<OrgUnit[]> {
  const response = await apiClient.get<ApiResponse<OrgUnit[]>>(`${ORG_UNITS_BASE}/tree`, options);
  return response.data;
}

// ============================================
// ORG UNIT EMPLOYEES (/api/v1/org-units/:id — employee list)
// ============================================

export async function getOrgUnitEmployees(
  orgUnitId: string,
  options?: RequestOptions
): Promise<OrgUnitEmployee[]> {
  const response = await apiClient.get<ApiResponse<OrgUnitEmployee[]>>(
    `${ORG_UNITS_BASE}/${orgUnitId}/employees`,
    options
  );
  return response.data;
}

// ============================================
// GRAPH ENDPOINT — Skill Coverage
// ============================================

const GRAPH_BASE = '/api/v1/graph';

export async function getOrgUnitCoverage(
  orgUnitId: string,
  options?: RequestOptions
): Promise<OrgUnitCoverageSkill[]> {
  const response = await apiClient.get<{
    data: OrgUnitCoverageSkill[];
    meta: { total: number };
  }>(`${GRAPH_BASE}/org-unit/${orgUnitId}/coverage`, options);
  return response.data;
}

export interface OrgUnitSkillGap {
  skillId: string;
  skillLabel: string;
  skillType: string;
  requiredLevel: number;
  availableLevel: number;
  gapLevel: number;
  isMandatory: boolean;
  processCount: number;
  employeesWithSkill: number;
  totalEmployees: number;
  coveragePercent: number;
}

export async function getOrgUnitSkillGaps(
  orgUnitId: string,
  options?: RequestOptions
): Promise<OrgUnitSkillGap[]> {
  const response = await apiClient.get<{
    data: OrgUnitSkillGap[];
    meta: { total: number };
  }>(`${GRAPH_BASE}/org-unit/${orgUnitId}/skill-gaps`, options);
  return response.data;
}
