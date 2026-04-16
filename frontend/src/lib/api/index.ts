/**
 * API Module - Heuresys Platform
 *
 * Centralizzazione di tutti gli export API.
 *
 * Usage:
 * ```ts
 * import { api, apiClient, ApiClientError } from '@/lib/api'
 *
 * // Use endpoints
 * const employees = await api.employees.getEmployees()
 * const user = await api.auth.getCurrentUser()
 *
 * // Or use client directly
 * const data = await apiClient.get('/custom/endpoint')
 * ```
 */

// Re-export client and errors
export {
  apiClient,
  ApiClient,
  ApiClientError,
  NetworkError,
  AuthenticationError,
  buildQueryString,
} from './client';

// Re-export types
export * from './types';

// Import endpoints
import * as auth from './endpoints/auth';
import * as employees from './endpoints/employees';
import * as orgUnits from './endpoints/org-units';
import * as dashboard from './endpoints/dashboard';
import * as locations from './endpoints/locations';
import * as costCenters from './endpoints/cost-centers';
import * as analytics from './endpoints/analytics';
import * as marketplace from './endpoints/marketplace';
import * as goals from './endpoints/goals';
import * as performanceReviews from './endpoints/performance-reviews';
import * as checkIns from './endpoints/check-ins';
import * as courses from './endpoints/courses';
import * as skills from './endpoints/skills';
import * as documents from './endpoints/documents';
import * as certifications from './endpoints/certifications';
import * as feedback from './endpoints/feedback';
import * as candidates from './endpoints/candidates';
import * as users from './endpoints/users';
import * as timeOff from './endpoints/time-off';
import * as tenants from './endpoints/tenants';
import * as auditLogs from './endpoints/audit-logs';
import * as enrollments from './endpoints/enrollments';
import * as contracts from './endpoints/contracts';
import * as attendance from './endpoints/attendance';
import * as career from './endpoints/career';
import * as enrichment from './endpoints/enrichment';
import * as enrichmentConsent from './endpoints/enrichment-consent';

// Grouped API object for convenient access
export const api = {
  auth,
  employees,
  orgUnits,
  dashboard,
  locations,
  costCenters,
  analytics,
  marketplace,
  goals,
  performanceReviews,
  checkIns,
  courses,
  skills,
  documents,
  certifications,
  feedback,
  candidates,
  users,
  timeOff,
  tenants,
  auditLogs,
  enrollments,
  contracts,
  attendance,
  career,
  enrichment,
  enrichmentConsent,
} as const;

// Individual endpoint exports
export {
  auth,
  employees,
  dashboard,
  locations,
  costCenters,
  analytics,
  marketplace,
  goals,
  performanceReviews,
  checkIns,
  courses,
  skills,
  documents,
  certifications,
  feedback,
  candidates,
  users,
  timeOff,
  tenants,
  auditLogs,
  enrollments,
  contracts,
  attendance,
  career,
  enrichment,
  enrichmentConsent,
};
