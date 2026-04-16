/**
 * Governance API Endpoints - Heuresys Platform
 * Performance, L&D, Compensation, Recruiting governance layer
 */

import { apiClient, buildQueryString, normalizeListResponse } from '../client';
import type { ApiResponse, PaginatedResponse, RequestOptions } from '../types';

// ============================================
// TYPES
// ============================================

export type ReviewCycleStatus = 'draft' | 'active' | 'completed' | 'archived';
export type ReviewCyclePhase = 'self_review' | 'manager_review' | 'calibration' | 'results';
export type ParticipantStatus = 'pending' | 'submitted' | 'calibrated' | 'completed';
export type FeedbackType = 'praise' | 'constructive' | 'developmental' | '360';

export interface ReviewCycle {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: ReviewCycleStatus;
  review_type: string;
  start_date: string;
  end_date: string;
  current_phase?: ReviewCyclePhase;
  phases_count?: number;
  participants_count?: number;
  completed_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewCyclePhaseDetail {
  id: string;
  cycle_id: string;
  phase_name: string;
  phase_type: ReviewCyclePhase;
  start_date: string;
  end_date: string;
  is_current: boolean;
  order_index: number;
}

export interface ReviewCycleParticipant {
  id: string;
  cycle_id: string;
  employee_id: string;
  reviewer_id?: string;
  status: ParticipantStatus;
  submitted_at?: string;
  calibrated_at?: string;
  employee_name?: string;
  reviewer_name?: string;
  department_name?: string;
}

export interface ReviewCycleDetail extends ReviewCycle {
  phases: ReviewCyclePhaseDetail[];
  participants: ReviewCycleParticipant[];
}

export interface ContinuousFeedback {
  id: string;
  tenant_id: string;
  giver_id: string;
  receiver_id: string;
  feedback_type: FeedbackType;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  giver_name?: string;
  receiver_name?: string;
}

export interface ReviewCycleFilters {
  status?: ReviewCycleStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FeedbackFilters {
  feedback_type?: FeedbackType;
  receiver_id?: string;
  giver_id?: string;
  limit?: number;
  offset?: number;
}

export interface GovernanceDashboardStats {
  active_cycles: number;
  completion_rate: number;
  avg_rating: number;
  pending_reviews: number;
  active_goals: number;
  recent_feedback_count: number;
}

// ============================================
// REVIEW CYCLES
// ============================================

const CYCLES_PATH = '/api/v1/review-cycles';

export async function getReviewCycles(
  params?: ReviewCycleFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<ReviewCycle>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: ReviewCycle[] | PaginatedResponse<ReviewCycle>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${CYCLES_PATH}${queryString}`, options);
  return normalizeListResponse<ReviewCycle>(response, params);
}

export async function getReviewCycleById(
  id: string,
  options?: RequestOptions
): Promise<ReviewCycleDetail> {
  const response = await apiClient.get<ApiResponse<ReviewCycleDetail>>(
    `${CYCLES_PATH}/${id}`,
    options
  );
  return response.data;
}

// ============================================
// CONTINUOUS FEEDBACK
// ============================================

export async function getContinuousFeedbackList(
  params?: FeedbackFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<ContinuousFeedback>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: ContinuousFeedback[] | PaginatedResponse<ContinuousFeedback>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`/api/v1/continuous-feedback${queryString}`, options);
  return normalizeListResponse<ContinuousFeedback>(response, params);
}

// ============================================
// GOVERNANCE DASHBOARD STATS (aggregated)
// ============================================

// ============================================
// L&D TYPES
// ============================================

export type LearningPathStatus = 'draft' | 'published' | 'archived';
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped';
export type CertificationStatus = 'active' | 'expiring' | 'expired' | 'pending';

export interface LearningPath {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  status: LearningPathStatus;
  provider_name?: string;
  skill_area?: string;
  duration_hours?: number;
  courses_count?: number;
  enrollment_count?: number;
  avg_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface LearningPathCourse {
  id: string;
  path_id: string;
  course_id: string;
  course_title: string;
  order_index: number;
  duration_hours?: number;
  is_mandatory: boolean;
  completion_rate?: number;
}

export interface LearningPathDetail extends LearningPath {
  courses: LearningPathCourse[];
  esco_skills?: Array<{ id: string; title: string; uri: string }>;
}

export interface Enrollment {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  path_id?: string;
  course_id?: string;
  path_title?: string;
  course_title?: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at?: string;
  progress_pct?: number;
}

export interface Certification {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  certification_name: string;
  issuer?: string;
  issue_date: string;
  expiry_date?: string;
  status: CertificationStatus;
  credential_id?: string;
}

export interface LearningPathFilters {
  status?: LearningPathStatus;
  provider_name?: string;
  skill_area?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface EnrollmentFilters {
  employee_id?: string;
  status?: EnrollmentStatus;
  limit?: number;
  offset?: number;
}

export interface CertificationFilters {
  employee_id?: string;
  status?: CertificationStatus;
  limit?: number;
  offset?: number;
}

export interface LearningDashboardStats {
  active_paths: number;
  total_enrollments: number;
  completion_rate: number;
  expiring_certifications: number;
}

// ============================================
// L&D API FUNCTIONS
// ============================================

const PATHS_PATH = '/api/v1/learning-paths';
const ENROLLMENTS_PATH = '/api/v1/enrollments';
const CERTIFICATIONS_PATH = '/api/v1/certifications';

export async function getLearningPaths(
  params?: LearningPathFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<LearningPath>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: LearningPath[] | PaginatedResponse<LearningPath>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${PATHS_PATH}${queryString}`, options);
  return normalizeListResponse<LearningPath>(response, params);
}

export async function getLearningPathById(
  id: string,
  options?: RequestOptions
): Promise<LearningPathDetail> {
  const response = await apiClient.get<ApiResponse<LearningPathDetail>>(
    `${PATHS_PATH}/${id}`,
    options
  );
  return response.data;
}

export async function getEnrollments(
  params?: EnrollmentFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Enrollment>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: Enrollment[] | PaginatedResponse<Enrollment>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${ENROLLMENTS_PATH}${queryString}`, options);
  return normalizeListResponse<Enrollment>(response, params);
}

export async function getCertifications(
  params?: CertificationFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Certification>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: Certification[] | PaginatedResponse<Certification>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${CERTIFICATIONS_PATH}${queryString}`, options);
  return normalizeListResponse<Certification>(response, params);
}

export async function getLearningDashboardStats(
  options?: RequestOptions
): Promise<LearningDashboardStats> {
  const [paths, enrollments, certs] = await Promise.all([
    getLearningPaths({ status: 'published', limit: 1 }, options),
    getEnrollments({ limit: 1 }, options),
    getCertifications({ status: 'expiring', limit: 1 }, options),
  ]);
  const completedEnrollments = await getEnrollments({ status: 'completed', limit: 1 }, options);
  const total = enrollments.pagination?.total ?? 0;
  const completed = completedEnrollments.pagination?.total ?? 0;
  return {
    active_paths: paths.pagination?.total ?? 0,
    total_enrollments: total,
    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    expiring_certifications: certs.pagination?.total ?? 0,
  };
}

// ============================================
// GOVERNANCE DASHBOARD STATS (aggregated)
// ============================================

// ============================================
// COMPENSATION TYPES
// ============================================

export interface SalaryBand {
  id: string;
  band_code: string;
  band_name: string;
  description?: string;
  job_level: string;
  job_family?: string;
  currency: string;
  min_salary: number;
  mid_salary: number;
  max_salary: number;
  range_spread_percent?: number;
  geo_region?: string;
  is_active: boolean;
  effective_from?: string;
}

export interface SalaryBandFilters {
  active?: boolean;
  job_level?: string;
  job_family?: string;
  limit?: number;
  offset?: number;
}

export interface MeritCycle {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'closed';
  cycle_year: number;
  start_date: string;
  end_date?: string;
  total_budget?: number;
  budget_spent?: number;
  participants_count?: number;
  created_at: string;
}

export interface MeritCycleStats {
  total: number;
  active: number;
  planning: number;
  completed: number;
  total_budget: number;
  total_spent: number;
}

export interface CompensationAnalyticsSummary {
  avg_compa_ratio: number;
  equity_score: number;
  merit_budget_used_pct: number;
  headcount_in_range: number;
  headcount_above_range: number;
  headcount_below_range: number;
}

export interface PayEquityRecord {
  gender?: string;
  department_name?: string;
  avg_salary: number;
  employee_count: number;
  pay_gap_pct?: number;
}

export interface CompaRatioRecord {
  department_name: string;
  avg_compa_ratio: number;
  employee_count: number;
  below_range: number;
  in_range: number;
  above_range: number;
}

// ============================================
// COMPENSATION API FUNCTIONS
// ============================================

const SALARY_BANDS_PATH = '/api/v1/salary-bands';
const MERIT_CYCLES_PATH = '/api/v1/merit-cycles';
const COMP_ANALYTICS_PATH = '/api/v1/analytics/compensation';

export async function getSalaryBands(
  params?: SalaryBandFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<SalaryBand>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: SalaryBand[] | PaginatedResponse<SalaryBand>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${SALARY_BANDS_PATH}${queryString}`, options);
  return normalizeListResponse<SalaryBand>(response, params);
}

export async function getMeritCycles(
  options?: RequestOptions
): Promise<PaginatedResponse<MeritCycle>> {
  const response = await apiClient.get<{
    data: MeritCycle[] | PaginatedResponse<MeritCycle>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(MERIT_CYCLES_PATH, options);
  return normalizeListResponse<MeritCycle>(response);
}

export async function getMeritCycleStats(options?: RequestOptions): Promise<MeritCycleStats> {
  const response = await apiClient.get<ApiResponse<MeritCycleStats>>(
    `${MERIT_CYCLES_PATH}/stats`,
    options
  );
  const raw = response.data as unknown as {
    total?: string | number;
    active?: string | number;
    planning?: string | number;
    completed?: string | number;
    total_budget?: string | number;
    total_spent?: string | number;
  };
  return {
    total: parseInt(String(raw.total ?? 0)),
    active: parseInt(String(raw.active ?? 0)),
    planning: parseInt(String(raw.planning ?? 0)),
    completed: parseInt(String(raw.completed ?? 0)),
    total_budget: parseFloat(String(raw.total_budget ?? 0)),
    total_spent: parseFloat(String(raw.total_spent ?? 0)),
  };
}

export async function getCompAnalyticsSummary(
  options?: RequestOptions
): Promise<CompensationAnalyticsSummary> {
  const [compaRatio, payEquity, meritStats, salaryBands] = await Promise.all([
    apiClient.get<{ data: CompaRatioRecord[] }>(`${COMP_ANALYTICS_PATH}/compa-ratio`, options),
    apiClient.get<{ data: PayEquityRecord[] }>(`${COMP_ANALYTICS_PATH}/pay-equity`, options),
    getMeritCycleStats(options),
    getSalaryBands({ active: true, limit: 1 }, options),
  ]);

  const compaRows: CompaRatioRecord[] = Array.isArray(compaRatio.data)
    ? compaRatio.data
    : ((compaRatio as unknown as { data: { data: CompaRatioRecord[] } }).data?.data ?? []);

  const totalEmp = compaRows.reduce((s, r) => s + (r.employee_count ?? 0), 0);
  const inRange = compaRows.reduce((s, r) => s + (r.in_range ?? 0), 0);
  const above = compaRows.reduce((s, r) => s + (r.above_range ?? 0), 0);
  const below = compaRows.reduce((s, r) => s + (r.below_range ?? 0), 0);

  const weightedCompa =
    totalEmp > 0
      ? compaRows.reduce(
          (s, r) => s + parseFloat(String(r.avg_compa_ratio ?? 1)) * r.employee_count,
          0
        ) / totalEmp
      : 1;

  const equityRows: PayEquityRecord[] = Array.isArray(payEquity.data)
    ? payEquity.data
    : ((payEquity as unknown as { data: { data: PayEquityRecord[] } }).data?.data ?? []);
  const avgGap =
    equityRows.length > 0
      ? equityRows.reduce((s, r) => s + Math.abs(parseFloat(String(r.pay_gap_pct ?? 0))), 0) /
        equityRows.length
      : 0;
  const equityScore = Math.max(0, Math.round(100 - avgGap));

  const budgetUsed =
    meritStats.total_budget > 0
      ? Math.round((meritStats.total_spent / meritStats.total_budget) * 100)
      : 0;

  return {
    avg_compa_ratio: parseFloat(weightedCompa.toFixed(2)),
    equity_score: equityScore,
    merit_budget_used_pct: budgetUsed,
    headcount_in_range: inRange,
    headcount_above_range: above,
    headcount_below_range: below,
  };
}

export async function getCompaRatioByDept(options?: RequestOptions): Promise<CompaRatioRecord[]> {
  const response = await apiClient.get<{ data: CompaRatioRecord[] | { data: CompaRatioRecord[] } }>(
    `${COMP_ANALYTICS_PATH}/compa-ratio`,
    options
  );
  if (Array.isArray(response.data)) return response.data;
  const inner = (response as unknown as { data: { data: CompaRatioRecord[] } }).data;
  return Array.isArray(inner?.data) ? inner.data : [];
}

export async function getPayEquityData(options?: RequestOptions): Promise<PayEquityRecord[]> {
  const response = await apiClient.get<{ data: PayEquityRecord[] | { data: PayEquityRecord[] } }>(
    `${COMP_ANALYTICS_PATH}/pay-equity`,
    options
  );
  if (Array.isArray(response.data)) return response.data;
  const inner = (response as unknown as { data: { data: PayEquityRecord[] } }).data;
  return Array.isArray(inner?.data) ? inner.data : [];
}

// ============================================
// RECRUITING TYPES
// ============================================

export type CandidateStage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type RequisitionStatus = 'draft' | 'open' | 'in_progress' | 'filled' | 'cancelled';
export type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Candidate {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  current_company?: string;
  job_title?: string;
  experience_years?: number;
  stage: CandidateStage;
  rating?: number;
  source?: string;
  created_at: string;
}

export interface Requisition {
  id: string;
  tenant_id: string;
  title: string;
  department_name?: string;
  hiring_manager_name?: string;
  status: RequisitionStatus;
  priority: RequisitionPriority;
  headcount: number;
  candidates_count?: number;
  open_date?: string;
  target_close_date?: string;
  created_at: string;
}

export interface RequisitionStats {
  total: number;
  open_count: number;
  in_progress: number;
  filled: number;
  cancelled: number;
  urgent: number;
  total_headcount: number;
}

export interface CandidateStats {
  total: number;
  by_stage: { stage: CandidateStage; count: number }[];
}

export interface RecruitingDashboardStats {
  open_requisitions: number;
  candidates_in_pipeline: number;
  avg_time_to_hire: number;
  offer_acceptance_rate: number;
}

export interface CandidateFilters {
  stage?: CandidateStage;
  limit?: number;
  offset?: number;
}

export interface RequisitionFilters {
  status?: RequisitionStatus;
  priority?: RequisitionPriority;
  limit?: number;
  offset?: number;
}

// ============================================
// RECRUITING API FUNCTIONS
// ============================================

const CANDIDATES_PATH = '/api/v1/candidates';
const REQUISITIONS_PATH = '/api/v1/requisitions';

export async function getCandidates(
  params?: CandidateFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Candidate>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: Candidate[] | PaginatedResponse<Candidate>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${CANDIDATES_PATH}${queryString}`, options);
  return normalizeListResponse<Candidate>(response, params);
}

export async function getCandidateStats(options?: RequestOptions): Promise<CandidateStats> {
  const response = await apiClient.get<ApiResponse<CandidateStats>>(
    `${CANDIDATES_PATH}/stats`,
    options
  );
  const raw = response.data as unknown as {
    total?: string | number;
    by_stage?: { stage: CandidateStage; count: string | number }[];
  };
  return {
    total: parseInt(String(raw.total ?? 0)),
    by_stage: (raw.by_stage ?? []).map((s) => ({
      stage: s.stage,
      count: parseInt(String(s.count ?? 0)),
    })),
  };
}

export async function getRequisitions(
  params?: RequisitionFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Requisition>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: Requisition[] | PaginatedResponse<Requisition>;
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${REQUISITIONS_PATH}${queryString}`, options);
  return normalizeListResponse<Requisition>(response, params);
}

export async function getRequisitionStats(options?: RequestOptions): Promise<RequisitionStats> {
  const response = await apiClient.get<ApiResponse<RequisitionStats>>(
    `${REQUISITIONS_PATH}/stats`,
    options
  );
  const raw = response.data as unknown as {
    total?: string | number;
    open_count?: string | number;
    in_progress?: string | number;
    filled?: string | number;
    cancelled?: string | number;
    urgent?: string | number;
    total_headcount?: string | number;
  };
  return {
    total: parseInt(String(raw.total ?? 0)),
    open_count: parseInt(String(raw.open_count ?? 0)),
    in_progress: parseInt(String(raw.in_progress ?? 0)),
    filled: parseInt(String(raw.filled ?? 0)),
    cancelled: parseInt(String(raw.cancelled ?? 0)),
    urgent: parseInt(String(raw.urgent ?? 0)),
    total_headcount: parseInt(String(raw.total_headcount ?? 0)),
  };
}

export async function getRecruitingDashboardStats(
  options?: RequestOptions
): Promise<RecruitingDashboardStats> {
  const [reqStats, candStats] = await Promise.all([
    getRequisitionStats(options),
    getCandidateStats(options),
  ]);
  const activeStages: CandidateStage[] = ['new', 'screening', 'interview', 'offer'];
  const inPipeline = candStats.by_stage
    .filter((s) => activeStages.includes(s.stage))
    .reduce((sum, s) => sum + s.count, 0);
  const hired = candStats.by_stage.find((s) => s.stage === 'hired')?.count ?? 0;
  const offerStage = candStats.by_stage.find((s) => s.stage === 'offer')?.count ?? 0;
  const offersTotal = hired + offerStage;
  return {
    open_requisitions: reqStats.open_count + reqStats.in_progress,
    candidates_in_pipeline: inPipeline,
    avg_time_to_hire: 0,
    offer_acceptance_rate: offersTotal > 0 ? Math.round((hired / offersTotal) * 100) : 0,
  };
}

// ============================================
export async function getGovernanceDashboardStats(
  options?: RequestOptions
): Promise<GovernanceDashboardStats> {
  const response = await apiClient.get<ApiResponse<GovernanceDashboardStats>>(
    '/api/v1/performance-reviews/stats',
    options
  );
  // Map ReviewStats fields into GovernanceDashboardStats
  const raw = response.data as unknown as {
    total?: number;
    pending?: number;
    avg_overall_rating?: number;
    active_cycles?: number;
    completion_rate?: number;
    avg_rating?: number;
    pending_reviews?: number;
    active_goals?: number;
    recent_feedback_count?: number;
  };
  return {
    active_cycles: raw.active_cycles ?? 0,
    completion_rate: raw.completion_rate ?? 0,
    avg_rating: raw.avg_rating ?? raw.avg_overall_rating ?? 0,
    pending_reviews: raw.pending_reviews ?? raw.pending ?? 0,
    active_goals: raw.active_goals ?? 0,
    recent_feedback_count: raw.recent_feedback_count ?? 0,
  };
}
