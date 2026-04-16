/**
 * Benchmarking Hooks — O3.8 Cross-Tenant Benchmarking
 */

import { useQuery } from '@tanstack/react-query';
import * as benchmarkingApi from '../api/endpoints/benchmarking';

export function useMyPosition() {
  return useQuery({
    queryKey: ['benchmarking', 'my-position'],
    queryFn: () => benchmarkingApi.getMyPosition(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIndustryBenchmark(naceCode: string | null) {
  return useQuery({
    queryKey: ['benchmarking', 'industry', naceCode],
    queryFn: () => benchmarkingApi.getIndustryBenchmark(naceCode!),
    enabled: !!naceCode,
    staleTime: 5 * 60 * 1000,
  });
}
