/**
 * Ontology Relations API — Endpoint wrappers
 * Advanced ontological analysis: skill clustering, career pathways, process-skill impact.
 * Horizon O3.7
 */

import { apiClient, buildQueryString } from '../client';

// ============================================
// TYPES
// ============================================

export interface SkillClusterSkill {
  id: string;
  label: string;
  skillType: string;
}

export interface SkillCluster {
  clusterId: string;
  label: string;
  broaderUri: string;
  memberCount: number;
  topSkills: SkillClusterSkill[];
  relatedOccupationCount: number;
}

export interface SkillClustersResponse {
  clusters: SkillCluster[];
  meta: { total: number; limit: number; offset: number };
}

export interface CareerStepSkill {
  id: string;
  label: string;
  skillType: string;
}

export interface CareerStep {
  occupationId: string;
  occupationLabel: string;
  iscoCode: string | null;
  skillOverlap: number;
  skillsGained: CareerStepSkill[];
  skillsLost: CareerStepSkill[];
}

export interface CareerPathwayResponse {
  source: { id: string; label: string; iscoCode: string | null };
  steps: CareerStep[];
}

export interface SkillImpactEntry {
  skillId: string;
  skillLabel: string;
  skillType: string;
  processCount: number;
  processNames: string[];
  isCritical: boolean;
  isUnique: boolean;
}

export interface ProcessSkillImpactResponse {
  totalSkills: number;
  criticalSkills: SkillImpactEntry[];
  uniqueSkills: SkillImpactEntry[];
}

// ============================================
// ENDPOINTS
// ============================================

export async function getSkillClusters(params?: {
  limit?: number;
  offset?: number;
  skillType?: 'skill' | 'knowledge' | 'competence';
}): Promise<SkillClustersResponse> {
  const qs = buildQueryString(params ?? {});
  const res = await apiClient.get<{
    success: boolean;
    data: SkillCluster[];
    meta: SkillClustersResponse['meta'];
  }>(`/ontology/skill-clusters${qs}`);
  return { clusters: res.data, meta: res.meta as SkillClustersResponse['meta'] };
}

export async function getCareerPathways(occupationId: string): Promise<CareerPathwayResponse> {
  const res = await apiClient.get<{ success: boolean; data: CareerPathwayResponse }>(
    `/ontology/career-pathways/${occupationId}`
  );
  return res.data;
}

export async function getProcessSkillImpact(): Promise<ProcessSkillImpactResponse> {
  const res = await apiClient.get<{ success: boolean; data: ProcessSkillImpactResponse }>(
    `/ontology/process-skill-impact`
  );
  return res.data;
}
