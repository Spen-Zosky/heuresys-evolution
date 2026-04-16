/**
 * Ontology Relations Hooks
 * React Query hooks for skill clustering, career pathways, and process-skill impact.
 * Horizon O3.7
 */

import { useQuery } from '@tanstack/react-query';
import * as ontologyRelationsApi from '../api/endpoints/ontology-relations';

export function useSkillClusters(params?: {
  limit?: number;
  offset?: number;
  skillType?: 'skill' | 'knowledge' | 'competence';
}) {
  return useQuery({
    queryKey: ['ontology', 'skill-clusters', params],
    queryFn: () => ontologyRelationsApi.getSkillClusters(params),
    staleTime: 5 * 60 * 1000, // 5 min — clustering results are stable
  });
}

export function useCareerPathways(occupationId: string | null) {
  return useQuery({
    queryKey: ['ontology', 'career-pathways', occupationId],
    queryFn: () => ontologyRelationsApi.getCareerPathways(occupationId!),
    enabled: !!occupationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProcessSkillImpact() {
  return useQuery({
    queryKey: ['ontology', 'process-skill-impact'],
    queryFn: () => ontologyRelationsApi.getProcessSkillImpact(),
    staleTime: 5 * 60 * 1000,
  });
}
