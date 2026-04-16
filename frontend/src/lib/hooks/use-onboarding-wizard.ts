/**
 * Onboarding Wizard Hooks — O3.9
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  runOnboardingSetup,
  getOnboardingStatus,
  fetchIndustriesL4,
} from '../api/endpoints/onboarding-wizard';
import type { SetupRequest, SetupResult } from '../api/endpoints/onboarding-wizard';

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: getOnboardingStatus,
    retry: 1,
  });
}

export function useIndustriesL4() {
  return useQuery({
    queryKey: ['ontology', 'industries', 4],
    queryFn: fetchIndustriesL4,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRunOnboardingSetup(onSuccess: (result: SetupResult) => void) {
  return useMutation({
    mutationFn: (payload: SetupRequest) => runOnboardingSetup(payload),
    onSuccess,
  });
}
