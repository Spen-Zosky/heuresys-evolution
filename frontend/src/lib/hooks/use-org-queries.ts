import { useQuery } from '@tanstack/react-query';
import * as organizationApi from '../api/endpoints/organization';
import type { OrgUnitListFilters } from '../api/endpoints/organization';

export type { OrgUnitSkillGap } from '../api/endpoints/organization';

export function useOrgUnits(filters?: OrgUnitListFilters) {
  return useQuery({
    queryKey: ['org-units', 'list', filters],
    queryFn: () => organizationApi.getOrgUnits(filters),
  });
}

export function useOrgUnit(id: string | null) {
  return useQuery({
    queryKey: ['org-units', 'detail', id],
    queryFn: () => organizationApi.getOrgUnitById(id!),
    enabled: !!id,
  });
}

export function useOrgUnitTree() {
  return useQuery({
    queryKey: ['org-units', 'tree'],
    queryFn: () => organizationApi.getOrgUnitTree(),
  });
}

export function useOrgUnitEmployees(orgUnitId: string | null) {
  return useQuery({
    queryKey: ['org-units', 'employees', orgUnitId],
    queryFn: () => organizationApi.getOrgUnitEmployees(orgUnitId!),
    enabled: !!orgUnitId,
  });
}

export function useOrgUnitCoverage(orgUnitId: string | null) {
  return useQuery({
    queryKey: ['org-units', 'coverage', orgUnitId],
    queryFn: () => organizationApi.getOrgUnitCoverage(orgUnitId!),
    enabled: !!orgUnitId,
  });
}

export function useOrgUnitSkillGaps(orgUnitId: string | null) {
  return useQuery({
    queryKey: ['org-units', 'skill-gaps', orgUnitId],
    queryFn: () => organizationApi.getOrgUnitSkillGaps(orgUnitId!),
    enabled: !!orgUnitId,
  });
}
