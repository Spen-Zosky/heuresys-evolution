import { useQuery } from '@tanstack/react-query';
import * as peopleApi from '../api/endpoints/people';
import type { PeopleListFilters } from '../api/endpoints/people';

export function useEmployees(filters?: PeopleListFilters) {
  return useQuery({
    queryKey: ['people', 'list', filters],
    queryFn: () => peopleApi.getEmployees(filters),
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ['people', 'detail', id],
    queryFn: () => peopleApi.getEmployeeById(id!),
    enabled: !!id,
  });
}

export function useEmployeeSkills(employeeId: string | null) {
  return useQuery({
    queryKey: ['people', 'skills', employeeId],
    queryFn: () => peopleApi.getEmployeeSkills(employeeId!),
    enabled: !!employeeId,
  });
}

export function useEmployeeQualification(employeeId: string | null) {
  return useQuery({
    queryKey: ['people', 'process-qualification', employeeId],
    queryFn: () => peopleApi.getEmployeeProcessQualification(employeeId!),
    enabled: !!employeeId,
  });
}

export function useEmployeeGapAnalysis(employeeId: string | null) {
  return useQuery({
    queryKey: ['people', 'gap-analysis', employeeId],
    queryFn: () => peopleApi.getEmployeeGapAnalysis(employeeId!),
    enabled: !!employeeId,
  });
}
