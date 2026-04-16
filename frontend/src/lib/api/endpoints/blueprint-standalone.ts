/**
 * Blueprint Standalone API — O3.5
 * Endpoint pubblico: nessun JWT, nessun tenant context.
 */

import { getApiBaseUrl } from '../../api-config';

// ============================================================
// TYPES
// ============================================================

export type CompanySize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';

export interface IndustryOption {
  naceCode: string;
  companySizeCode: CompanySize;
  profileCode: string;
  profileName: string;
  industryNameIt: string;
  industryNameEn: string | null;
  naceLevel: number;
}

export interface BlueprintProcess {
  id: string;
  processCode: string;
  processName: string;
  processCategory: 'primary' | 'support' | 'custom';
  description: string | null;
  valueChainPosition: number;
  typicalInputs: string[];
  typicalOutputs: string[];
}

export interface BlueprintRole {
  processId: string;
  roleName: string;
  roleType: 'owner' | 'executor' | 'approver' | 'reviewer' | 'informed';
  minHeadcount: number | null;
  maxHeadcount: number | null;
  description: string | null;
  occupationLabel: string | null;
}

export interface BlueprintKpi {
  processId: string;
  kpiCode: string;
  kpiName: string;
  measurementUnit: string | null;
  targetDirection: string | null;
  benchmarkValue: number | null;
  description: string | null;
  processName: string;
  processCode: string;
}

export interface BlueprintSkill {
  processId: string;
  proficiencyLevel: number;
  isMandatory: boolean;
  skillName: string;
  skillType: string | null;
  processName: string;
  processCode: string;
}

export interface BlueprintOrgUnit {
  code: string;
  nameIt: string;
  nameEn: string | null;
  depth: number;
  level: number | null;
  levelName: string | null;
  nature: string | null;
  isLine: boolean;
  isManagement: boolean;
}

export interface BlueprintOrgConfig {
  headcount: string;
  departments: number;
  layers: number;
  label: string;
}

export interface StandaloneBlueprintResult {
  meta: {
    naceCode: string;
    companySize: CompanySize;
    orgConfig: BlueprintOrgConfig;
    industry: { nameIt: string; nameEn: string | null } | null;
    profile: { name: string; code: string } | null;
    generatedAt: string;
    matchedExact: boolean;
  };
  processes: BlueprintProcess[];
  roles: BlueprintRole[];
  skills: BlueprintSkill[];
  kpis: BlueprintKpi[];
  orgUnits: BlueprintOrgUnit[];
  typicalStructure: unknown | null;
  typicalRoles: string[];
  typicalDepartments: string[];
}

export interface GenerateRequest {
  naceCode: string;
  companySize: CompanySize;
  customProcesses?: string[];
}

// ============================================================
// API FUNCTIONS (public fetch — no auth headers)
// ============================================================

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.data as T;
}

export async function fetchStandaloneIndustries(): Promise<IndustryOption[]> {
  return publicFetch<IndustryOption[]>('/api/v1/blueprint/standalone/industries');
}

export async function generateStandaloneBlueprint(
  payload: GenerateRequest
): Promise<StandaloneBlueprintResult> {
  return publicFetch<StandaloneBlueprintResult>('/api/v1/blueprint/standalone/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
