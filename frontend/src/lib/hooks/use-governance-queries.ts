import { useQuery } from '@tanstack/react-query';
import * as governanceApi from '../api/endpoints/governance';
import type {
  ReviewCycleFilters,
  FeedbackFilters,
  LearningPathFilters,
  EnrollmentFilters,
  CertificationFilters,
  CandidateFilters,
  RequisitionFilters,
} from '../api/endpoints/governance';
import { getGoals } from '../api/endpoints/goals';
import { getReviews } from '../api/endpoints/performance-reviews';
import type { GoalFilters, ReviewFilters } from '../api/types';

export function useGovernanceDashboardStats() {
  return useQuery({
    queryKey: ['governance', 'dashboard-stats'],
    queryFn: () => governanceApi.getGovernanceDashboardStats(),
  });
}

export function useReviewCycles(filters?: ReviewCycleFilters) {
  return useQuery({
    queryKey: ['governance', 'review-cycles', filters],
    queryFn: () => governanceApi.getReviewCycles(filters),
  });
}

export function useReviewCycleDetail(cycleId: string | null) {
  return useQuery({
    queryKey: ['governance', 'review-cycle', cycleId],
    queryFn: () => governanceApi.getReviewCycleById(cycleId!),
    enabled: !!cycleId,
  });
}

export function useGovernanceGoals(filters?: GoalFilters) {
  return useQuery({
    queryKey: ['governance', 'goals', filters],
    queryFn: () => getGoals(filters),
  });
}

export function useGovernanceReviews(filters?: ReviewFilters) {
  return useQuery({
    queryKey: ['governance', 'reviews', filters],
    queryFn: () => getReviews(filters),
  });
}

export function useContinuousFeedback(filters?: FeedbackFilters) {
  return useQuery({
    queryKey: ['governance', 'continuous-feedback', filters],
    queryFn: () => governanceApi.getContinuousFeedbackList(filters),
  });
}

// ============================================
// L&D HOOKS
// ============================================

export function useLearningDashboardStats() {
  return useQuery({
    queryKey: ['governance', 'learning-dashboard-stats'],
    queryFn: () => governanceApi.getLearningDashboardStats(),
  });
}

export function useLearningPaths(filters?: LearningPathFilters) {
  return useQuery({
    queryKey: ['governance', 'learning-paths', filters],
    queryFn: () => governanceApi.getLearningPaths(filters),
  });
}

export function useLearningPathDetail(pathId: string | null) {
  return useQuery({
    queryKey: ['governance', 'learning-path', pathId],
    queryFn: () => governanceApi.getLearningPathById(pathId!),
    enabled: !!pathId,
  });
}

export function useEnrollments(filters?: EnrollmentFilters) {
  return useQuery({
    queryKey: ['governance', 'enrollments', filters],
    queryFn: () => governanceApi.getEnrollments(filters),
  });
}

export function useCertifications(filters?: CertificationFilters) {
  return useQuery({
    queryKey: ['governance', 'certifications', filters],
    queryFn: () => governanceApi.getCertifications(filters),
  });
}

// ============================================
// COMPENSATION HOOKS
// ============================================

export function useSalaryBands(filters?: governanceApi.SalaryBandFilters) {
  return useQuery({
    queryKey: ['governance', 'salary-bands', filters],
    queryFn: () => governanceApi.getSalaryBands(filters),
  });
}

export function useMeritCycles() {
  return useQuery({
    queryKey: ['governance', 'merit-cycles'],
    queryFn: () => governanceApi.getMeritCycles(),
  });
}

export function useMeritCycleStats() {
  return useQuery({
    queryKey: ['governance', 'merit-cycle-stats'],
    queryFn: () => governanceApi.getMeritCycleStats(),
  });
}

export function useCompAnalyticsSummary() {
  return useQuery({
    queryKey: ['governance', 'comp-analytics-summary'],
    queryFn: () => governanceApi.getCompAnalyticsSummary(),
  });
}

export function useCompaRatioByDept() {
  return useQuery({
    queryKey: ['governance', 'compa-ratio-dept'],
    queryFn: () => governanceApi.getCompaRatioByDept(),
  });
}

export function usePayEquityData() {
  return useQuery({
    queryKey: ['governance', 'pay-equity'],
    queryFn: () => governanceApi.getPayEquityData(),
  });
}

// ============================================
// RECRUITING HOOKS
// ============================================

export function useRecruitingDashboardStats() {
  return useQuery({
    queryKey: ['governance', 'recruiting-dashboard-stats'],
    queryFn: () => governanceApi.getRecruitingDashboardStats(),
  });
}

export function useCandidates(filters?: CandidateFilters) {
  return useQuery({
    queryKey: ['governance', 'candidates', filters],
    queryFn: () => governanceApi.getCandidates(filters),
  });
}

export function useCandidateStats() {
  return useQuery({
    queryKey: ['governance', 'candidate-stats'],
    queryFn: () => governanceApi.getCandidateStats(),
  });
}

export function useRequisitions(filters?: RequisitionFilters) {
  return useQuery({
    queryKey: ['governance', 'requisitions', filters],
    queryFn: () => governanceApi.getRequisitions(filters),
  });
}

export function useRequisitionStats() {
  return useQuery({
    queryKey: ['governance', 'requisition-stats'],
    queryFn: () => governanceApi.getRequisitionStats(),
  });
}
