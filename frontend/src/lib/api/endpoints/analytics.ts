/**
 * Analytics API Endpoints
 *
 * API client methods for analytics data retrieval and reporting.
 */

import { apiClient, buildQueryString } from '../client';
import type {
  ApiResponse,
  WorkforceDataPoint,
  DepartmentAnalytics,
  FlightRiskAssessment,
  PerformancePrediction,
  CompensationAnalytics,
  PayEquityAnalysis,
  BandCompliance,
  AttendanceAnalytics,
  OvertimeAnalysis,
  LeaveBalanceSummary,
  AnalyticsDateRange,
  AnalyticsExportRequest,
  ReportTemplate,
  AnalyticsResponse,
  RequestOptions,
} from '../types';

// ============================================
// WORKFORCE ANALYTICS
// ============================================

export interface WorkforceFilters {
  start_date?: string;
  end_date?: string;
  org_unit_id?: string;
  include_forecast?: boolean;
  forecast_months?: number;
}

/**
 * Get workforce headcount trend data
 */
export async function getWorkforceTrend(
  filters?: WorkforceFilters,
  options?: RequestOptions
): Promise<AnalyticsResponse<WorkforceDataPoint[]>> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<AnalyticsResponse<WorkforceDataPoint[]>>>(
    `/api/v1/analytics/workforce/trend${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get department-level workforce analytics
 */
export async function getDepartmentAnalytics(
  filters?: { date?: string },
  options?: RequestOptions
): Promise<DepartmentAnalytics[]> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<DepartmentAnalytics[]>>(
    `/api/v1/analytics/workforce/departments${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get attrition analysis by department
 */
export async function getAttritionAnalysis(
  filters?: WorkforceFilters,
  options?: RequestOptions
): Promise<
  ApiResponse<{ current: number; predicted: number; by_org_unit: DepartmentAnalytics[] }>
> {
  const queryString = filters ? buildQueryString(filters) : '';
  return apiClient.get(`/api/v1/analytics/workforce/attrition${queryString}`, options);
}

// ============================================
// AI PREDICTIVE ANALYTICS
// ============================================

export interface FlightRiskFilters {
  org_unit_id?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  min_score?: number;
  max_score?: number;
  limit?: number;
  offset?: number;
}

/**
 * Get flight risk assessments for employees
 */
export async function getFlightRiskAssessments(
  filters?: FlightRiskFilters,
  options?: RequestOptions
): Promise<ApiResponse<{ items: FlightRiskAssessment[]; total: number }>> {
  const queryString = filters ? buildQueryString(filters) : '';
  return apiClient.get(`/api/v1/analytics/ai/flight-risk${queryString}`, options);
}

/**
 * Get flight risk details for specific employee
 */
export async function getEmployeeFlightRisk(
  employeeId: string,
  options?: RequestOptions
): Promise<FlightRiskAssessment> {
  const response = await apiClient.get<ApiResponse<FlightRiskAssessment>>(
    `/api/v1/analytics/ai/flight-risk/${employeeId}`,
    options
  );
  return response.data;
}

/**
 * Get performance predictions
 */
export async function getPerformancePredictions(
  filters?: { org_unit_id?: string; limit?: number },
  options?: RequestOptions
): Promise<ApiResponse<{ items: PerformancePrediction[]; model_accuracy: number }>> {
  const queryString = filters ? buildQueryString(filters) : '';
  return apiClient.get(`/api/v1/analytics/ai/performance-prediction${queryString}`, options);
}

/**
 * Get AI recommendations for an employee
 */
export async function getAIRecommendations(
  employeeId: string,
  options?: RequestOptions
): Promise<ApiResponse<{ recommendations: string[]; confidence: number }>> {
  return apiClient.get(`/api/v1/analytics/ai/recommendations/${employeeId}`, options);
}

// ============================================
// COMPENSATION ANALYTICS
// ============================================

export interface CompensationFilters {
  org_unit_id?: string;
  location_id?: string;
  job_level?: string;
  as_of_date?: string;
}

/**
 * Get compensation overview
 */
export async function getCompensationOverview(
  filters?: CompensationFilters,
  options?: RequestOptions
): Promise<CompensationAnalytics> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<CompensationAnalytics>>(
    `/api/v1/analytics/compensation/overview${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get pay equity analysis
 */
export async function getPayEquityAnalysis(
  dimension: 'gender' | 'department' | 'location' | 'tenure',
  filters?: CompensationFilters,
  options?: RequestOptions
): Promise<PayEquityAnalysis[]> {
  const queryString = filters
    ? buildQueryString({ ...filters, dimension })
    : `?dimension=${dimension}`;
  const response = await apiClient.get<ApiResponse<PayEquityAnalysis[]>>(
    `/api/v1/analytics/compensation/pay-equity${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get salary band compliance analysis
 */
export async function getBandCompliance(
  filters?: CompensationFilters,
  options?: RequestOptions
): Promise<BandCompliance[]> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<BandCompliance[]>>(
    `/api/v1/analytics/compensation/band-compliance${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get compa-ratio distribution
 */
export async function getCompaRatioDistribution(
  filters?: CompensationFilters,
  options?: RequestOptions
): Promise<
  ApiResponse<{ buckets: { range: string; count: number }[]; avg: number; median: number }>
> {
  const queryString = filters ? buildQueryString(filters) : '';
  return apiClient.get(`/api/v1/analytics/compensation/compa-ratio${queryString}`, options);
}

// ============================================
// TIME & ATTENDANCE ANALYTICS
// ============================================

export interface AttendanceFilters {
  start_date?: string;
  end_date?: string;
  org_unit_id?: string;
  location_id?: string;
}

/**
 * Get attendance analytics summary
 */
export async function getAttendanceAnalytics(
  filters?: AttendanceFilters,
  options?: RequestOptions
): Promise<AttendanceAnalytics[]> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<AttendanceAnalytics[]>>(
    `/api/v1/analytics/attendance/summary${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get absence heatmap data (day x department)
 */
export async function getAbsenceHeatmap(
  filters?: AttendanceFilters,
  options?: RequestOptions
): Promise<ApiResponse<{ data: { day: string; department: string; rate: number }[] }>> {
  const queryString = filters ? buildQueryString(filters) : '';
  return apiClient.get(`/api/v1/analytics/attendance/heatmap${queryString}`, options);
}

/**
 * Get overtime analysis
 */
export async function getOvertimeAnalysis(
  filters?: AttendanceFilters,
  options?: RequestOptions
): Promise<OvertimeAnalysis[]> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<OvertimeAnalysis[]>>(
    `/api/v1/analytics/attendance/overtime${queryString}`,
    options
  );
  return response.data;
}

/**
 * Get leave balance summary
 */
export async function getLeaveBalanceSummary(
  filters?: { org_unit_id?: string; as_of_date?: string },
  options?: RequestOptions
): Promise<LeaveBalanceSummary[]> {
  const queryString = filters ? buildQueryString(filters) : '';
  const response = await apiClient.get<ApiResponse<LeaveBalanceSummary[]>>(
    `/api/v1/analytics/attendance/leave-balance${queryString}`,
    options
  );
  return response.data;
}

// ============================================
// EXPORT & REPORTING
// ============================================

/**
 * Export analytics report
 */
export async function exportAnalyticsReport(
  request: AnalyticsExportRequest,
  options?: RequestOptions
): Promise<Blob> {
  const response = await apiClient.post<{ download_url: string }>(
    '/api/v1/analytics/export',
    request,
    options
  );

  // Fetch the actual file
  const fileResponse = await fetch(response.download_url);
  return fileResponse.blob();
}

/**
 * Get available report templates
 */
export async function getReportTemplates(options?: RequestOptions): Promise<ReportTemplate[]> {
  const response = await apiClient.get<ApiResponse<ReportTemplate[]>>(
    '/api/v1/analytics/export/templates',
    options
  );
  return response.data;
}

/**
 * Save report template
 */
export async function saveReportTemplate(
  template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>,
  options?: RequestOptions
): Promise<ReportTemplate> {
  const response = await apiClient.post<ApiResponse<ReportTemplate>>(
    '/api/v1/analytics/export/templates',
    template,
    options
  );
  return response.data;
}

/**
 * Delete report template
 */
export async function deleteReportTemplate(
  templateId: string,
  options?: RequestOptions
): Promise<void> {
  await apiClient.delete(`/api/v1/analytics/templates/${templateId}`, options);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate date range for analytics queries
 */
export function generateDateRange(months: number, endDate: Date = new Date()): AnalyticsDateRange {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);

  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
}

/**
 * Format period for display
 */
export function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
  const endMonth = end.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });

  return `${startMonth} - ${endMonth}`;
}
