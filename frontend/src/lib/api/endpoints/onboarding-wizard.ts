/**
 * Onboarding Wizard API — O3.9
 * Setup wizard endpoints for new tenant guided onboarding.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '../types';

const BASE_PATH = '/api/v1/tenant-onboarding';

// ============================================================
// TYPES
// ============================================================

export type CompanySize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
export type OrgStructureType = 'flat' | 'functional' | 'divisional' | 'matrix';

export interface SetupRequest {
  nacePrimary: string;
  companySize: CompanySize;
  orgStructureType?: OrgStructureType;
}

export interface BlueprintSummary {
  departmentsGenerated: number;
  positionsGenerated: number;
  skillRequirementsGenerated: number;
}

export interface SetupResult {
  nacePrimary: string;
  companySize: CompanySize;
  orgStructureType: OrgStructureType | null;
  blueprint: BlueprintSummary | null;
}

export interface OnboardingStatus {
  completed: boolean;
  nacePrimary: string | null;
  companySize: CompanySize | null;
  profile: {
    departmentsGenerated: number;
    positionsGenerated: number;
    skillRequirementsGenerated: number;
    generatedAt: string;
    generatorVersion: string;
  } | null;
}

export interface IndustryOption {
  code: string;
  nameIt: string;
  level: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

export async function runOnboardingSetup(payload: SetupRequest): Promise<SetupResult> {
  const response = await apiClient.post<ApiResponse<SetupResult>>(`${BASE_PATH}/setup`, payload);
  return response.data;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const response = await apiClient.get<ApiResponse<OnboardingStatus>>(`${BASE_PATH}/status`);
  return response.data;
}

export async function fetchIndustriesL4(): Promise<IndustryOption[]> {
  const response = await apiClient.get<ApiResponse<{ items: IndustryOption[] }>>(
    '/api/v1/ontology/industries?level=4&limit=500'
  );
  const raw = response.data as unknown as { items?: IndustryOption[] } | IndustryOption[];
  if (Array.isArray(raw)) return raw;
  return (raw as { items?: IndustryOption[] }).items ?? [];
}
