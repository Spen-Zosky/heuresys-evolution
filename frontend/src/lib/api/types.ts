/**
 * API Types - Heuresys Platform
 *
 * Tipi TypeScript per le risposte API.
 * Basati sulla struttura reale delle API backend.
 */

// ============================================
// BASE RESPONSE TYPES
// ============================================

/**
 * Risposta API standard di successo
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Risposta API di errore
 */
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Paginazione standard
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Risposta paginata
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

// ============================================
// AUTH TYPES
// ============================================

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  tenantId?: string;
  tenant_code?: string;
  tenant_name?: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  permissions: string[];
  jobTitle?: string;
  department?: string;
  lastLogin?: string;
}

export type UserRole =
  | 'SUPERUSER'
  | 'TENANT_OWNER'
  | 'SYSADMIN' // legacy
  | 'ADMIN'
  | 'HR'
  | 'MANAGER'
  | 'USER'
  | 'EMPLOYEE'
  | 'DEMO';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ============================================
// EMPLOYEE TYPES
// ============================================

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  department: string;
  location: string;
  hire_date: string;
  is_active: boolean;
  employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  org_unit_id: string;
  manager_id: string | null;
  cost_center_id: string | null;
  location_id: string | null;
  department_name: string;
  location_name: string;
  cost_center_name: string | null;
  org_unit_name: string;
  phone?: string;
  mobile?: string;
  avatar_url?: string;
}

export interface EmployeeListResponse {
  employees: Employee[];
  pagination: Pagination;
}

export interface EmployeeFilters {
  search?: string;
  org_unit_id?: string;
  location_id?: string;
  is_active?: boolean;
  employment_status?: string;
}

export interface CreateEmployeeRequest {
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  org_unit_id: string;
  hire_date: string;
  manager_id?: string;
  location_id?: string;
  cost_center_id?: string;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  is_active?: boolean;
  employment_status?: string;
}

// ============================================
// DEPARTMENT TYPES
// ============================================

export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  name_en?: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager_id?: string;
  parent_id?: string;
  employee_count?: number;
}

export interface OrgUnitStats {
  id: string;
  name: string;
  employee_count: number;
  percentage: number;
}

// ============================================
// ORG UNIT TYPES
// ============================================

export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  org_unit_id?: string;
  manager_id?: string;
  default_location_id?: string;
  org_level: number;
  org_type?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed fields from API
  department_name?: string;
  location_name?: string;
  manager_name?: string;
  employee_count?: number;
}

export interface OrgUnitFilters {
  is_active?: boolean;
  org_type?: string;
  parent_id?: string | 'null';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateOrgUnitRequest {
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  org_unit_id?: string;
  manager_id?: string;
  default_location_id?: string;
  org_type?: string;
  sort_order?: number;
}

export interface UpdateOrgUnitRequest extends Partial<CreateOrgUnitRequest> {
  is_active?: boolean;
}

// ============================================
// LOCATION TYPES
// ============================================

export interface Location {
  id: string;
  code: string;
  name: string;
  location_type?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  is_active: boolean;
  capacity_headcount?: number;
  square_meters?: number;
  opening_date?: string;
  closing_date?: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  employee_count?: number;
  org_unit_count?: number;
}

export interface LocationFilters {
  is_active?: boolean;
  location_type?: string;
  city?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateLocationRequest {
  code: string;
  name: string;
  location_type?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  capacity_headcount?: number;
  square_meters?: number;
  opening_date?: string;
}

export interface UpdateLocationRequest extends Partial<CreateLocationRequest> {
  is_active?: boolean;
  closing_date?: string;
}

// ============================================
// COST CENTER TYPES
// ============================================

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  name_en?: string;
  description?: string;
  cost_center_type?: string;
  parent_id?: string;
  org_unit_id?: string;
  responsible_id?: string;
  budget_annual_eur?: number;
  budget_headcount?: number;
  gl_account?: string;
  is_active: boolean;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  org_unit_name?: string;
  responsible_name?: string;
  parent_name?: string;
  employee_count?: number;
}

export interface CostCenterFilters {
  is_active?: boolean;
  cost_center_type?: string;
  cost_type?: string;
  parent_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCostCenterRequest {
  code: string;
  name: string;
  description?: string;
  cost_center_type?: string;
  parent_id?: string;
  org_unit_id?: string;
  responsible_id?: string;
  budget_annual_eur?: number;
  budget_headcount?: number;
}

export interface UpdateCostCenterRequest extends Partial<CreateCostCenterRequest> {
  is_active?: boolean;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  employees: {
    total_employees: number;
    active_employees: number;
    departments: number;
  };
  goals: {
    total_goals: number;
    completed_goals: number;
    in_progress_goals: number;
    avg_progress: string;
  };
  reviews: {
    total_reviews: number;
    completed_reviews: number;
    avg_rating: string;
  };
  learning: {
    total_courses: number;
    total_enrollments: number;
  };
  recognition: {
    total_recognitions: number;
    total_points: number;
  };
}

export interface DashboardKPI {
  label: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: string;
}

// ============================================
// TENANT TYPES
// ============================================

export interface Tenant {
  id: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  subscription_plan?: string;
  industry_type?: string;
  region?: string;
  nace_code?: string;
  employee_count?: number;
  contact_email?: string;
  contact_phone?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  address_country?: string;
  tax_id?: string;
  annual_revenue_eur?: number;
  created_at: string;
  updated_at?: string;
}

// ============================================
// REQUEST OPTIONS
// ============================================

export interface RequestOptions {
  signal?: AbortSignal;
  tenantCode?: string;
  skipAuth?: boolean;
  retries?: number;
  retryDelay?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// ANALYTICS TYPES
// ============================================

/**
 * Workforce analytics data point
 */
export interface WorkforceDataPoint {
  month: string; // YYYY-MM format
  headcount: number;
  hires: number;
  terminations: number;
  transfers_in: number;
  transfers_out: number;
  attrition_rate: number;
  growth_rate: number;
  is_forecast?: boolean;
}

/**
 * OrgUnit analytics summary
 */
export interface DepartmentAnalytics {
  org_unit_id: string;
  department_name: string;
  headcount: number;
  headcount_change: number;
  attrition_rate: number;
  attrition_prediction: number;
  avg_tenure_months: number;
  open_positions: number;
  utilization_rate: number;
}

/**
 * Employee flight risk assessment
 */
export interface FlightRiskAssessment {
  employee_id: string;
  employee_name: string;
  department: string;
  job_title: string;
  risk_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: FlightRiskFactor[];
  recommendation?: string;
}

/**
 * Flight risk contributing factor
 */
export interface FlightRiskFactor {
  factor: string;
  weight: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

/**
 * Performance prediction data
 */
export interface PerformancePrediction {
  employee_id: string;
  employee_name: string;
  current_rating: number;
  predicted_rating: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
  key_drivers: string[];
}

/**
 * Compensation analytics data
 */
export interface CompensationAnalytics {
  org_unit_id?: string;
  department_name?: string;
  avg_salary: number;
  median_salary: number;
  min_salary: number;
  max_salary: number;
  salary_band_min: number;
  salary_band_max: number;
  compa_ratio_avg: number;
  pay_equity_score: number;
  total_compensation: number;
}

/**
 * Pay equity analysis by dimension
 */
export interface PayEquityAnalysis {
  dimension: string; // 'gender' | 'department' | 'location' | 'tenure'
  category: string;
  avg_salary: number;
  median_salary: number;
  headcount: number;
  compa_ratio: number;
  gap_percentage: number;
}

/**
 * Compensation band compliance
 */
export interface BandCompliance {
  band_name: string;
  min_salary: number;
  max_salary: number;
  employees_below: number;
  employees_within: number;
  employees_above: number;
  compliance_rate: number;
}

/**
 * Time and attendance analytics
 */
export interface AttendanceAnalytics {
  period: string; // YYYY-MM
  org_unit_id?: string;
  department_name?: string;
  total_days: number;
  days_worked: number;
  days_absent: number;
  sick_days: number;
  vacation_days: number;
  other_leave: number;
  overtime_hours: number;
  absence_rate: number;
}

/**
 * Overtime analysis
 */
export interface OvertimeAnalysis {
  period: string;
  org_unit_id?: string;
  department_name?: string;
  total_overtime_hours: number;
  avg_overtime_per_employee: number;
  overtime_cost: number;
  employees_with_overtime: number;
  top_overtime_reasons: { reason: string; hours: number }[];
}

/**
 * Leave balance summary
 */
export interface LeaveBalanceSummary {
  leave_type: string;
  total_entitled: number;
  total_used: number;
  total_remaining: number;
  utilization_rate: number;
  employees_count: number;
}

/**
 * Analytics date range filter
 */
export interface AnalyticsDateRange {
  start_date: string;
  end_date: string;
  comparison_start?: string;
  comparison_end?: string;
}

/**
 * Analytics export request
 */
export interface AnalyticsExportRequest {
  report_type: 'workforce' | 'compensation' | 'attendance' | 'flight_risk' | 'performance';
  format: 'pdf' | 'xlsx' | 'csv';
  date_range: AnalyticsDateRange;
  filters?: Record<string, string | number | boolean>;
  include_charts?: boolean;
}

/**
 * Report template definition
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  report_type: string;
  config: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Analytics API response wrapper
 */
export interface AnalyticsResponse<T> {
  data: T;
  period: AnalyticsDateRange;
  generated_at: string;
  cache_expires_at?: string;
}

// ============================================
// PLUGIN MARKETPLACE TYPES
// ============================================

export type PluginStatus = 'draft' | 'pending_review' | 'published' | 'suspended' | 'deprecated';
export type PluginVisibility = 'public' | 'private' | 'unlisted';
export type PricingModel = 'free' | 'freemium' | 'paid' | 'subscription' | 'contact';
export type InstallationStatus =
  | 'active'
  | 'disabled'
  | 'pending_update'
  | 'error'
  | 'uninstalling'
  | 'uninstalled';
export type PluginReviewStatus = 'published' | 'pending' | 'hidden';

/**
 * Plugin category (from plugin_categories table)
 */
export interface PluginCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  parent_id?: string;
  plugin_count?: number;
}

/**
 * Plugin version record (from plugin_versions table)
 */
export interface PluginVersion {
  id: string;
  plugin_id: string;
  version: string;
  release_notes?: string;
  changelog?: string;
  config_schema?: Record<string, unknown>;
  permissions_required: string[];
  entry_point?: string;
  status: string;
  is_latest: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Plugin definition in the marketplace (from plugins table)
 */
export interface Plugin {
  id: string;
  name: string;
  slug: string;
  short_description?: string;
  description?: string;
  category_id?: string;
  publisher_tenant_id?: string;
  publisher_name: string;
  icon_url?: string;
  homepage_url?: string;
  repository_url?: string;
  license?: string;
  status: PluginStatus;
  visibility: PluginVisibility;
  pricing_model: PricingModel;
  price_cents: number;
  currency: string;
  tags: string[];
  avg_rating: number;
  total_ratings: number;
  total_installations: number;
  featured: boolean;
  screenshot_urls?: string[];
  banner_url?: string;
  created_at: string;
  updated_at: string;
  // Joined fields from API queries
  category_name?: string;
  category_slug?: string;
  category_icon?: string;
  latest_version?: string;
  latest_version_date?: string;
  release_notes?: string;
  config_schema?: Record<string, unknown>;
  permissions_required?: string[];
}

/**
 * Plugin installation record per tenant (from plugin_installations table)
 */
export interface PluginInstallation {
  id: string;
  tenant_id: string;
  plugin_id: string;
  installed_by?: string;
  installed_version: string;
  status: InstallationStatus;
  configuration: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
  uninstalled_at?: string;
  // Joined fields from API queries
  plugin_name?: string;
  plugin_slug?: string;
  short_description?: string;
  icon_url?: string;
  category_id?: string;
  publisher_name?: string;
  latest_version?: string;
  featured?: boolean;
  installed_by_name?: string;
}

/**
 * Plugin review/rating (from plugin_reviews table)
 */
export interface PluginReview {
  id: string;
  tenant_id: string;
  plugin_id: string;
  user_id: string;
  rating: number;
  title?: string;
  review_text?: string;
  is_verified_install: boolean;
  helpful_count: number;
  status: PluginReviewStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  reviewer_name?: string;
}

/**
 * Review summary/breakdown
 */
export interface ReviewSummary {
  total_reviews: number;
  avg_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

/**
 * API meta for offset-based pagination (standard backend format)
 */
export interface ApiMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * @deprecated Use ApiMeta — kept for marketplace compat
 */
export interface OffsetMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Convert backend meta (offset-based) to frontend Pagination (page-based).
 */
export function metaToPagination(meta?: ApiMeta | OffsetMeta | null): Pagination {
  if (!meta) return { page: 1, limit: 20, total: 0, totalPages: 1 };
  const { total, limit, offset } = meta;
  const page = Math.floor(offset / limit) + 1;
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Plugin filters for browse endpoint
 */
export interface PluginFilters {
  search?: string;
  category?: string;
  pricing_model?: PricingModel;
  featured?: boolean;
  sort?: 'total_installations' | 'avg_rating' | 'name' | 'created_at' | 'price_cents';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Install plugin request
 */
export interface InstallPluginRequest {
  plugin_id: string;
  installed_by?: string;
  configuration?: Record<string, unknown>;
}

/**
 * Update plugin installation configuration request
 */
export interface UpdatePluginConfigRequest {
  configuration: Record<string, unknown>;
}

/**
 * Create plugin review request
 */
export interface CreatePluginReviewRequest {
  plugin_id: string;
  user_id: string;
  rating: number;
  title?: string;
  review_text?: string;
}

// ============================================
// PLUGIN DEPENDENCY TYPES
// ============================================

/**
 * Plugin dependency record (from plugin_dependencies table)
 */
export interface PluginDependency {
  id: string;
  plugin_id: string;
  depends_on_plugin_id: string;
  min_version?: string;
  max_version?: string;
  is_optional: boolean;
  created_at: string;
  // Joined fields
  depends_on_name?: string;
  depends_on_slug?: string;
  depends_on_latest_version?: string;
  depends_on_icon_url?: string;
}

// ============================================
// PLUGIN API KEY TYPES
// ============================================

/**
 * Plugin API key record (from plugin_api_keys table)
 */
export interface PluginApiKey {
  id: string;
  tenant_id: string;
  plugin_installation_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at?: string;
  last_used_at?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  revoked_at?: string;
  // Joined fields
  plugin_name?: string;
  plugin_slug?: string;
  created_by_name?: string;
}

/**
 * Create API key request
 */
export interface CreatePluginApiKeyRequest {
  plugin_installation_id: string;
  name: string;
  scopes?: string[];
  expires_at?: string;
}

/**
 * Create API key response (includes the full key only once)
 */
export interface CreatePluginApiKeyResponse {
  api_key: PluginApiKey;
  key: string; // Full key, shown only at creation
}

// ============================================
// PLUGIN WEBHOOK TYPES
// ============================================

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

/**
 * Plugin webhook registration (from plugin_webhooks table)
 */
export interface PluginWebhook {
  id: string;
  tenant_id: string;
  plugin_installation_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  plugin_name?: string;
  plugin_slug?: string;
  created_by_name?: string;
  recent_delivery_count?: number;
  recent_failure_count?: number;
}

/**
 * Webhook delivery record (from plugin_webhook_deliveries table)
 */
export interface PluginWebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  response_headers?: Record<string, unknown>;
  duration_ms?: number;
  status: WebhookDeliveryStatus;
  attempt_number: number;
  next_retry_at?: string;
  delivered_at?: string;
  created_at: string;
}

/**
 * Create webhook request
 */
export interface CreatePluginWebhookRequest {
  plugin_installation_id: string;
  url: string;
  events: string[];
  description?: string;
}

/**
 * Update webhook request
 */
export interface UpdatePluginWebhookRequest {
  url?: string;
  events?: string[];
  is_active?: boolean;
  description?: string;
}

// ============================================
// PLUGIN RUNTIME TYPES (HOOKS & UI SLOTS)
// ============================================

export type HookExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout';

/**
 * Plugin hook definition (from plugin_hooks table)
 */
export interface PluginHook {
  id: string;
  plugin_id: string;
  hook_name: string;
  handler_path: string;
  priority: number;
  is_async: boolean;
  timeout_ms: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  plugin_name?: string;
  plugin_slug?: string;
  execution_count?: number;
  last_execution_at?: string;
  avg_duration_ms?: number;
}

/**
 * Plugin UI slot definition (from plugin_ui_slots table)
 */
export interface PluginUISlot {
  id: string;
  plugin_id: string;
  slot_name: string;
  component_path: string;
  props_schema: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  plugin_name?: string;
  plugin_slug?: string;
}

/**
 * Plugin hook execution record (from plugin_hook_executions table)
 */
export interface PluginHookExecution {
  id: string;
  hook_id: string;
  tenant_id: string;
  trigger_event: string;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  status: HookExecutionStatus;
  error_message?: string;
  duration_ms?: number;
  started_at: string;
  completed_at?: string;
  // Joined fields
  hook_name?: string;
  plugin_name?: string;
}

/**
 * Create plugin request (developer portal)
 */
export interface CreatePluginRequest {
  name: string;
  slug: string;
  short_description?: string;
  description?: string;
  category_id?: string;
  icon_url?: string;
  homepage_url?: string;
  repository_url?: string;
  license?: string;
  visibility?: PluginVisibility;
  pricing_model?: PricingModel;
  price_cents?: number;
  currency?: string;
  tags?: string[];
  screenshot_urls?: string[];
  banner_url?: string;
}

/**
 * Update plugin request (developer portal)
 */
export interface UpdatePluginRequest extends Partial<CreatePluginRequest> {
  status?: PluginStatus;
}

/**
 * Plugin submission for review
 */
export interface SubmitPluginForReviewRequest {
  plugin_id: string;
  version: string;
  release_notes?: string;
  changelog?: string;
}

// ============================================
// GOAL TYPES
// ============================================

export type GoalStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'on_hold';
export type GoalType = 'individual' | 'team' | 'department' | 'company';

export interface Goal {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  description?: string;
  goal_type: GoalType;
  parent_goal_id?: string;
  start_date?: string;
  due_date?: string;
  status: GoalStatus;
  progress_percent: number;
  weight?: number;
  category?: string;
  owner_id?: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // Computed
  employee_name?: string;
  owner_name?: string;
  parent_goal_title?: string;
}

export interface GoalStats {
  total: number;
  draft: number;
  active: number;
  completed: number;
  cancelled: number;
  on_hold: number;
  avg_progress: number;
  overdue: number;
}

export interface GoalFilters {
  employee_id?: string;
  status?: GoalStatus;
  goal_type?: GoalType;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateGoalRequest {
  employee_id: string;
  title: string;
  description?: string;
  goal_type?: GoalType;
  parent_goal_id?: string;
  start_date?: string;
  due_date?: string;
  weight?: number;
  category?: string;
  owner_id?: string;
  priority?: string;
}

export interface UpdateGoalRequest extends Partial<CreateGoalRequest> {
  status?: GoalStatus;
  progress_percent?: number;
}

// ============================================
// PERFORMANCE REVIEW TYPES
// ============================================

export type ReviewStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PerformanceReview {
  id: string;
  tenant_id: string;
  employee_id: string;
  review_period_start: string;
  review_period_end: string;
  reviewer_id?: string;
  review_cycle_id?: string;
  review_type: string;
  status: ReviewStatus;
  period_start: string;
  period_end: string;
  overall_rating?: number;
  goal_achievement_rating?: number;
  competency_rating?: number;
  manager_summary?: string;
  employee_summary?: string;
  created_at: string;
  updated_at: string;
  // Computed
  employee_name?: string;
  reviewer_name?: string;
  department_name?: string;
}

export interface ReviewStats {
  total: number;
  draft: number;
  pending: number;
  completed: number;
  avg_overall_rating: number;
  avg_goal_rating: number;
}

export interface ReviewFilters {
  employee_id?: string;
  reviewer_id?: string;
  status?: ReviewStatus;
  review_type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateReviewRequest {
  employee_id: string;
  reviewer_id?: string;
  review_cycle_id?: string;
  review_type: string;
  period_start: string;
  period_end: string;
}

export interface UpdateReviewRequest {
  status?: ReviewStatus;
  overall_rating?: number;
  goal_achievement_rating?: number;
  competency_rating?: number;
  manager_summary?: string;
  employee_summary?: string;
}

// ============================================
// CHECK-IN TYPES
// ============================================

export type CheckInStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface CheckIn {
  id: string;
  tenant_id: string;
  employee_id: string;
  manager_id: string;
  scheduled_date: string;
  check_in_type: string;
  status: CheckInStatus;
  duration_minutes?: number;
  employee_mood?: number;
  notes?: string;
  action_items?: string;
  private_notes?: string;
  created_at: string;
  updated_at: string;
  // Computed
  employee_name?: string;
  manager_name?: string;
}

export interface CheckInStats {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  avg_mood: number;
  avg_duration: number;
}

export interface CheckInFilters {
  employee_id?: string;
  manager_id?: string;
  status?: CheckInStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCheckInRequest {
  employee_id: string;
  manager_id: string;
  scheduled_date: string;
  check_in_type?: string;
  notes?: string;
}

export interface UpdateCheckInRequest {
  status?: CheckInStatus;
  duration_minutes?: number;
  employee_mood?: number;
  notes?: string;
  action_items?: string;
  private_notes?: string;
}

// ============================================
// COURSE / LEARNING TYPES
// ============================================

export type CourseStatus = 'draft' | 'published' | 'archived';
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped' | 'failed';

export interface Course {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  category?: string;
  skill_level?: string;
  duration_hours?: number;
  is_mandatory: boolean;
  /** Derived from status: true when status === 'published' */
  is_active: boolean;
  status?: string;
  provider?: string;
  delivery_method?: string;
  max_enrollments?: number;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  // Computed
  enrollment_count?: number;
  completion_rate?: number;
  avg_score?: number;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  employee_id: string;
  status: EnrollmentStatus;
  progress_percent: number;
  enrolled_at: string;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  score?: number;
  time_spent_minutes?: number;
  certificate_issued: boolean;
  certificate_url?: string;
  // Computed
  course_title?: string;
  employee_name?: string;
}

export interface CourseFilters {
  category?: string;
  skill_level?: string;
  is_mandatory?: boolean;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  category?: string;
  skill_level?: string;
  duration_hours?: number;
  is_mandatory?: boolean;
  provider?: string;
  delivery_method?: string;
  max_enrollments?: number;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
  is_active?: boolean;
}

// ============================================
// SKILL TYPES
// ============================================

export interface Skill {
  id: string;
  name: string;
  description?: string;
  category?: string;
  skill_type?: string;
  is_active: boolean;
  esco_uri?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSkill {
  id: string;
  employee_id: string;
  skill_id: string;
  proficiency_level: number;
  self_assessment?: number;
  manager_assessment?: number;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  source?: string;
  created_at: string;
  updated_at: string;
  // Computed
  skill_name?: string;
  skill_category?: string;
  employee_name?: string;
}

export interface SkillFilters {
  category?: string;
  skill_type?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// DOCUMENT TYPES
// ============================================

export type DocumentStatus = 'active' | 'archived' | 'pending' | 'expired';

export interface EmployeeDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  document_type: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  status: DocumentStatus;
  expiry_date?: string;
  issued_date?: string;
  issued_by?: string;
  category_id?: string;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  employee_name?: string;
  category_name?: string;
}

export interface DocumentFilters {
  employee_id?: string;
  document_type?: string;
  status?: DocumentStatus;
  category_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}
