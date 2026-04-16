/**
 * React Query hooks — Blueprint Standalone (O3.5)
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchStandaloneIndustries,
  generateStandaloneBlueprint,
} from '../api/endpoints/blueprint-standalone';
import type {
  GenerateRequest,
  StandaloneBlueprintResult,
} from '../api/endpoints/blueprint-standalone';

export function useStandaloneIndustries() {
  return useQuery({
    queryKey: ['blueprint-standalone', 'industries'],
    queryFn: fetchStandaloneIndustries,
    staleTime: 10 * 60 * 1000, // 10 min — dati stabili
  });
}

export function useGenerateStandaloneBlueprint(
  onSuccess: (result: StandaloneBlueprintResult) => void
) {
  return useMutation({
    mutationFn: (payload: GenerateRequest) => generateStandaloneBlueprint(payload),
    onSuccess,
  });
}
