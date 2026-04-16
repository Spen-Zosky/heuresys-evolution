/**
 * Career Intelligence API — Endpoint wrappers
 * Typed access to the Knowledge Graph ESCO REST API (10 endpoints)
 */

import { apiClient, buildQueryString } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

// ============================================
// TYPES
// ============================================

export interface CareerRecommendation {
  occupationId: string;
  occupationLabel: string;
  iscoCode: string;
  skillCoverage: number;
  totalEssential: number;
  skillsHeld: number;
  skillsMissing: number;
  embeddingMatch: number;
}

export interface CareerRecommendationsResponse {
  recommendations: CareerRecommendation[];
  skillCount: number;
  message?: string;
}

export interface GapSkill {
  skillId: string;
  skillLabel: string;
  skillType: string;
  relationType: string;
  closestExistingSkill: string;
  transferability: number;
  gapDifficulty: 'easy' | 'moderate' | 'hard' | null;
}

export interface GapAnalysisResponse {
  targetOccupation: string;
  targetUri: string;
  summary: {
    total: number;
    possessed: number;
    missing: number;
    readinessPercent: number;
  };
  skills: GapSkill[];
}

export interface TransitionSkill {
  skillLabel: string;
  skillType: string;
  closestSourceSkill: string;
  transferability: number;
  isEssential: boolean;
}

export interface CareerTransitionResponse {
  sourceOccupation: string;
  targetOccupation: string;
  readinessPercent: number;
  difficulty: 'easy' | 'moderate' | 'hard';
  totalSkills: number;
  have: TransitionSkill[];
  transferable: TransitionSkill[];
  learn: TransitionSkill[];
}

export interface SimilarSkill {
  skillId: string;
  uri: string;
  preferredLabel: string;
  skillType: string;
  reuseLevel: string;
  similarity: number;
}

export interface MatchingOccupation {
  occupationId: string;
  uri: string;
  preferredLabel: string;
  iscoCode: string;
  similarity: number;
}

export interface SkillIntelligenceItem {
  skillLabel: string;
  skillType: string;
  reuseLevel: string;
  employeesWithSkill: number;
  avgProficiency: number | null;
  penetrationRate: number;
  openDemand: number;
  riskLevel: 'CRITICAL_GAP' | 'SCARCE' | 'HEALTHY' | 'WIDESPREAD';
}

export interface SkillIntelligenceResponse {
  summary: {
    totalSkills: number;
    critical: number;
    scarce: number;
    healthy: number;
    widespread: number;
  };
  skills: SkillIntelligenceItem[];
}

export interface SimilarOccupation {
  occupationId: string;
  occupationLabel: string;
  iscoCode: string;
  embeddingSimilarity: number;
  skillOverlap: number;
  combinedScore: number;
}

export interface SimilarOccupationsResponse {
  occupation: string;
  uri: string;
  similarOccupations: SimilarOccupation[];
}

export interface ConcentrationRiskItem {
  skillLabel: string;
  skillType: string;
  employeeCount: number;
  penetrationRate: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'healthy';
  holders: string[];
}

export interface ConcentrationRiskResponse {
  summary: {
    totalEmployees: number;
    totalSkills: number;
    critical: number;
    high: number;
    moderate: number;
    healthy: number;
  };
  risks: ConcentrationRiskItem[];
}

export interface OnboardingStatusResponse {
  completed: boolean;
  nacePrimary: string | null;
  companySize: string | null;
  profile: {
    departmentsGenerated: number;
    positionsGenerated: number;
    skillRequirementsGenerated: number;
    generatedAt: string;
    generatorVersion: string;
  } | null;
}

// ============================================
// CAREER ENDPOINTS
// ============================================

export async function getCareerRecommendations(
  employeeId: string,
  params?: { maxResults?: number; language?: string },
  options?: RequestOptions
): Promise<CareerRecommendationsResponse> {
  const qs = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<CareerRecommendationsResponse>>(
    `/api/v1/career/recommendations/${employeeId}${qs}`,
    options
  );
  return response.data;
}

export async function getGapAnalysis(
  employeeId: string,
  occupationUri: string,
  options?: RequestOptions
): Promise<GapAnalysisResponse> {
  const encodedUri = encodeURIComponent(occupationUri);
  const response = await apiClient.get<ApiResponse<GapAnalysisResponse>>(
    `/api/v1/career/gap-analysis/${employeeId}/${encodedUri}`,
    options
  );
  return response.data;
}

export async function getCareerTransition(
  sourceUri: string,
  targetUri: string,
  options?: RequestOptions
): Promise<CareerTransitionResponse> {
  const encodedSrc = encodeURIComponent(sourceUri);
  const encodedTgt = encodeURIComponent(targetUri);
  const response = await apiClient.get<ApiResponse<CareerTransitionResponse>>(
    `/api/v1/career/transition/${encodedSrc}/${encodedTgt}`,
    options
  );
  return response.data;
}

export async function getSimilarSkills(
  skillUri: string,
  params?: { language?: string; threshold?: number; maxResults?: number },
  options?: RequestOptions
): Promise<SimilarSkill[]> {
  const encodedUri = encodeURIComponent(skillUri);
  const qs = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<SimilarSkill[]>>(
    `/api/v1/career/similar-skills/${encodedUri}${qs}`,
    options
  );
  return response.data;
}

export async function getMatchingOccupations(
  query: string,
  params?: { language?: string; maxResults?: number },
  options?: RequestOptions
): Promise<MatchingOccupation[]> {
  const qs = buildQueryString({ q: query, ...params });
  const response = await apiClient.get<ApiResponse<MatchingOccupation[]>>(
    `/api/v1/career/matching-occupations${qs}`,
    options
  );
  return response.data;
}

// ============================================
// ORGANIZATION ENDPOINTS
// ============================================

export async function getSkillIntelligence(
  options?: RequestOptions
): Promise<SkillIntelligenceResponse> {
  const response = await apiClient.get<ApiResponse<SkillIntelligenceResponse>>(
    '/api/v1/organization/skill-intelligence',
    options
  );
  return response.data;
}

export async function getSimilarOccupations(
  occupationUri: string,
  params?: { maxResults?: number },
  options?: RequestOptions
): Promise<SimilarOccupationsResponse> {
  const encodedUri = encodeURIComponent(occupationUri);
  const qs = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<SimilarOccupationsResponse>>(
    `/api/v1/organization/similar-occupations/${encodedUri}${qs}`,
    options
  );
  return response.data;
}

export async function getConcentrationRisk(
  options?: RequestOptions
): Promise<ConcentrationRiskResponse> {
  const response = await apiClient.get<ApiResponse<ConcentrationRiskResponse>>(
    '/api/v1/organization/concentration-risk',
    options
  );
  return response.data;
}

// ============================================
// ONBOARDING ENDPOINTS
// ============================================

export async function generatePrototype(
  body?: { nacePrimary?: string; companySize?: string; countryCode?: string },
  options?: RequestOptions
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    '/api/v1/tenant-onboarding/generate-prototype',
    body,
    options
  );
  return response.data;
}

export async function getOnboardingStatus(
  options?: RequestOptions
): Promise<OnboardingStatusResponse> {
  const response = await apiClient.get<ApiResponse<OnboardingStatusResponse>>(
    '/api/v1/tenant-onboarding/status',
    options
  );
  return response.data;
}
