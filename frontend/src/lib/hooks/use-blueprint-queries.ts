import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as blueprintApi from '../api/endpoints/blueprint';
import type { CreateBlueprintRunRequest } from '../api/endpoints/blueprint';
import { getBlueprintTemplates } from '../api/endpoints/process-layer';
import { getIndustries } from '../api/endpoints/blueprint';

export function useBlueprintRuns() {
  return useQuery({
    queryKey: ['blueprint', 'runs'],
    queryFn: () => blueprintApi.getBlueprintRuns(),
  });
}

export function useBlueprintRun(runId: string | null) {
  return useQuery({
    queryKey: ['blueprint', 'runs', runId],
    queryFn: () => blueprintApi.getBlueprintRun(runId!),
    enabled: !!runId,
  });
}

export function useBlueprintResults(runId: string | null, filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['blueprint', 'runs', runId, 'results', filters],
    queryFn: () => blueprintApi.getBlueprintResults(runId!, filters),
    enabled: !!runId,
  });
}

export function useCreateBlueprintRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBlueprintRunRequest) => blueprintApi.createBlueprintRun(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprint', 'runs'] });
    },
  });
}

export function useBlueprintTemplates() {
  return useQuery({
    queryKey: ['blueprint', 'templates'],
    queryFn: () => getBlueprintTemplates(),
  });
}

export function useIndustries(level?: number) {
  return useQuery({
    queryKey: ['ontology', 'industries', level],
    queryFn: () => getIndustries(level),
  });
}
