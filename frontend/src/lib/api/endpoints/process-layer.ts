/**
 * Process Layer API Endpoints — Heuresys Platform
 * CRUD for phases, roles, skill-requirements, KPIs, blueprint templates,
 * plus graph navigation (deep, skills, employee qualification).
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

// ============================================
// TYPES
// ============================================

export interface ProcessPhase {
  id: string;
  processId: string;
  phaseCode: string;
  phaseName: string;
  phaseOrder: number;
  description: string | null;
  estimatedDurationDays: number | null;
  isOptional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessRole {
  id: string;
  processId: string;
  roleName: string;
  roleType: 'owner' | 'executor' | 'approver' | 'reviewer' | 'informed';
  phaseId: string | null;
  escoOccupationId: string | null;
  minHeadcount: number | null;
  maxHeadcount: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessSkillRequirement {
  id: string;
  processId: string;
  escoSkillId: string;
  phaseId: string | null;
  proficiencyLevel: number;
  isMandatory: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessKpi {
  id: string;
  processId: string;
  kpiCode: string;
  kpiName: string;
  phaseId: string | null;
  measurementUnit: string | null;
  targetDirection: 'higher_better' | 'lower_better' | 'target_range' | null;
  benchmarkValue: number | null;
  benchmarkMin: number | null;
  benchmarkMax: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessDetail {
  process: Record<string, unknown>;
  phases: ProcessPhase[];
  roles: ProcessRole[];
  skillRequirements: ProcessSkillRequirement[];
  kpis: ProcessKpi[];
}

export interface BlueprintTemplate {
  id: string;
  templateCode: string;
  templateName: string;
  description: string | null;
  industryCode: string | null;
  companySize: string | null;
  processCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessDeepNode {
  process: Record<string, unknown>;
  phases: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  skillRequirements: Record<string, unknown>[];
  kpis: Record<string, unknown>[];
}

export interface ProcessSkillCoverage {
  skillId: string;
  skillLabel: string;
  proficiencyLevel: number;
  isMandatory: boolean;
  employeeCoverage: number;
}

export interface SkillProcessLink {
  processId: string;
  processName: string;
  proficiencyLevel: number;
  isMandatory: boolean;
}

export interface KpiCascadeRole {
  id: string;
  roleName: string;
  roleType: string;
  phaseId: string | null;
  occupationLabel: string | null;
}

export interface KpiCascadeItem {
  id: string;
  kpiCode: string;
  kpiName: string;
  phaseId: string | null;
  phaseName: string | null;
  measurementUnit: string | null;
  targetDirection: 'higher_better' | 'lower_better' | 'target_range' | null;
  benchmarkValue: number | null;
  benchmarkMin: number | null;
  benchmarkMax: number | null;
  description: string | null;
  roles: KpiCascadeRole[];
  alignmentStatus: 'aligned' | 'partial' | 'unaligned';
}

export interface KpiCascadeOrgUnit {
  templateId: string;
  name: string;
  code: string;
  responsibilityLevel: string;
  employeesWithGoals: number;
  totalEmployees: number;
}

export interface KpiCascadeResult {
  processId: string;
  processName: string;
  processCode: string;
  kpis: KpiCascadeItem[];
  orgUnits: KpiCascadeOrgUnit[];
}

export interface EmployeeProcessQualification {
  processId: string;
  processName: string;
  qualificationScore: number;
  skillsHeld: number;
  skillsRequired: number;
}

export interface ProcessListItem {
  id: string;
  processCode: string;
  processName: string;
  processCategory: string;
  valueChainPosition: number;
  description: string | null;
  phaseCount: number;
  roleCount: number;
  skillCount: number;
  kpiCount: number;
}

export interface ProcessListFilters {
  category?: string;
  search?: string;
}

// ============================================
// PROCESS LAYER ENDPOINTS
// ============================================

const PROCESS_BASE = '/api/v1/process-layer';

export async function getProcesses(
  filters?: ProcessListFilters,
  options?: RequestOptions
): Promise<ProcessListItem[]> {
  const qs = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<{ success: boolean; data: ProcessListItem[] }>(
    `${PROCESS_BASE}/processes${qs}`,
    options
  );
  return response.data;
}

export async function getProcessPhases(
  processId: string,
  options?: RequestOptions
): Promise<ProcessPhase[]> {
  const response = await apiClient.get<{ success: boolean; data: ProcessPhase[] }>(
    `${PROCESS_BASE}/processes/${processId}/phases`,
    options
  );
  return response.data;
}

export async function getProcessRoles(
  processId: string,
  options?: RequestOptions
): Promise<ProcessRole[]> {
  const response = await apiClient.get<{ success: boolean; data: ProcessRole[] }>(
    `${PROCESS_BASE}/processes/${processId}/roles`,
    options
  );
  return response.data;
}

export async function getProcessSkillRequirements(
  processId: string,
  options?: RequestOptions
): Promise<ProcessSkillRequirement[]> {
  const response = await apiClient.get<{ success: boolean; data: ProcessSkillRequirement[] }>(
    `${PROCESS_BASE}/processes/${processId}/skill-requirements`,
    options
  );
  return response.data;
}

export async function getProcessKpis(
  processId: string,
  options?: RequestOptions
): Promise<ProcessKpi[]> {
  const response = await apiClient.get<{ success: boolean; data: ProcessKpi[] }>(
    `${PROCESS_BASE}/processes/${processId}/kpis`,
    options
  );
  return response.data;
}

export async function getProcessDetail(
  processId: string,
  options?: RequestOptions
): Promise<ProcessDetail> {
  const response = await apiClient.get<{ success: boolean; data: ProcessDetail }>(
    `${PROCESS_BASE}/processes/${processId}/detail`,
    options
  );
  return response.data;
}

export async function getBlueprintTemplates(
  profileId?: string,
  options?: RequestOptions
): Promise<BlueprintTemplate[]> {
  const qs = profileId ? buildQueryString({ profileId }) : '';
  const response = await apiClient.get<{ success: boolean; data: BlueprintTemplate[] }>(
    `${PROCESS_BASE}/blueprint-templates${qs}`,
    options
  );
  return response.data;
}

export async function getBlueprintTemplate(
  templateId: string,
  options?: RequestOptions
): Promise<BlueprintTemplate> {
  const response = await apiClient.get<{ success: boolean; data: BlueprintTemplate }>(
    `${PROCESS_BASE}/blueprint-templates/${templateId}`,
    options
  );
  return response.data;
}

// ============================================
// GRAPH NAVIGATION ENDPOINTS
// ============================================

const GRAPH_BASE = '/api/v1/graph';

export async function getProcessDeep(
  processId: string,
  options?: RequestOptions
): Promise<ProcessDeepNode> {
  const response = await apiClient.get<{ data: ProcessDeepNode }>(
    `${GRAPH_BASE}/process/${processId}/deep`,
    options
  );
  return response.data;
}

export async function getProcessSkills(
  processId: string,
  options?: RequestOptions
): Promise<ProcessSkillCoverage[]> {
  const response = await apiClient.get<{ data: ProcessSkillCoverage[]; meta: { total: number } }>(
    `${GRAPH_BASE}/process/${processId}/skills`,
    options
  );
  return response.data;
}

export async function getSkillProcesses(
  skillId: string,
  options?: RequestOptions
): Promise<SkillProcessLink[]> {
  const response = await apiClient.get<{ data: SkillProcessLink[]; meta: { total: number } }>(
    `${GRAPH_BASE}/skill/${skillId}/processes`,
    options
  );
  return response.data;
}

export async function getProcessKpiCascade(
  processId: string,
  options?: RequestOptions
): Promise<KpiCascadeResult> {
  const response = await apiClient.get<{ data: KpiCascadeResult }>(
    `${GRAPH_BASE}/process/${processId}/kpi-cascade`,
    options
  );
  return response.data;
}

export async function getEmployeeProcessQualification(
  employeeId: string,
  options?: RequestOptions
): Promise<EmployeeProcessQualification[]> {
  const response = await apiClient.get<{
    data: EmployeeProcessQualification[];
    meta: { total: number };
  }>(`${GRAPH_BASE}/employee/${employeeId}/process-qualification`, options);
  return response.data;
}
