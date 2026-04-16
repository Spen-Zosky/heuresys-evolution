import { useQuery } from '@tanstack/react-query';
import * as processLayerApi from '../api/endpoints/process-layer';
import type { ProcessListFilters } from '../api/endpoints/process-layer';

export function useProcessList(filters?: ProcessListFilters) {
  return useQuery({
    queryKey: ['process', 'list', filters],
    queryFn: () => processLayerApi.getProcesses(filters),
  });
}

export function useProcessDetail(processId: string | null) {
  return useQuery({
    queryKey: ['process', 'detail', processId],
    queryFn: () => processLayerApi.getProcessDetail(processId!),
    enabled: !!processId,
  });
}

export function useProcessDeep(processId: string | null) {
  return useQuery({
    queryKey: ['process', 'deep', processId],
    queryFn: () => processLayerApi.getProcessDeep(processId!),
    enabled: !!processId,
  });
}

export function useProcessSkills(processId: string | null) {
  return useQuery({
    queryKey: ['process', 'skills', processId],
    queryFn: () => processLayerApi.getProcessSkills(processId!),
    enabled: !!processId,
  });
}

export function useSkillProcesses(skillId: string | null) {
  return useQuery({
    queryKey: ['skill', 'processes', skillId],
    queryFn: () => processLayerApi.getSkillProcesses(skillId!),
    enabled: !!skillId,
  });
}

export function useEmployeeQualification(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee', 'process-qualification', employeeId],
    queryFn: () => processLayerApi.getEmployeeProcessQualification(employeeId!),
    enabled: !!employeeId,
  });
}

export function useProcessKpiCascade(processId: string | null) {
  return useQuery({
    queryKey: ['process', 'kpi-cascade', processId],
    queryFn: () => processLayerApi.getProcessKpiCascade(processId!),
    enabled: !!processId,
  });
}

export function useBlueprintTemplates(profileId?: string) {
  return useQuery({
    queryKey: ['blueprint', 'templates', profileId],
    queryFn: () => processLayerApi.getBlueprintTemplates(profileId),
  });
}
