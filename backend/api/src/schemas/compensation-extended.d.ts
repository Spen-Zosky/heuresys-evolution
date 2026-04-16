import { z } from 'zod';
/**
 * POST /benefits
 */
export declare const createBenefitSchema: z.ZodObject<{
    benefit_name: z.ZodString;
    benefit_type: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    monthly_cost: z.ZodOptional<z.ZodNumber>;
    coverage_options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    is_active: boolean;
    benefit_name: string;
    benefit_type: string;
    description?: string | undefined;
    monthly_cost?: number | undefined;
    coverage_options?: Record<string, unknown> | undefined;
}, {
    benefit_name: string;
    benefit_type: string;
    description?: string | undefined;
    is_active?: boolean | undefined;
    monthly_cost?: number | undefined;
    coverage_options?: Record<string, unknown> | undefined;
}>;
/**
 * PATCH /benefits/:id
 */
export declare const updateBenefitSchema: z.ZodObject<{
    benefit_name: z.ZodOptional<z.ZodString>;
    benefit_type: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    monthly_cost: z.ZodOptional<z.ZodNumber>;
    coverage_options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    is_active?: boolean | undefined;
    benefit_name?: string | undefined;
    benefit_type?: string | undefined;
    monthly_cost?: number | undefined;
    coverage_options?: Record<string, unknown> | undefined;
}, {
    description?: string | undefined;
    is_active?: boolean | undefined;
    benefit_name?: string | undefined;
    benefit_type?: string | undefined;
    monthly_cost?: number | undefined;
    coverage_options?: Record<string, unknown> | undefined;
}>;
/**
 * POST /bonus-plans
 */
export declare const createBonusPlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    bonus_type: z.ZodString;
    period_start: z.ZodOptional<z.ZodString>;
    period_end: z.ZodOptional<z.ZodString>;
    payout_date: z.ZodOptional<z.ZodString>;
    total_budget: z.ZodOptional<z.ZodNumber>;
    calculation_method: z.ZodOptional<z.ZodString>;
    eligibility_rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    performance_multipliers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    bonus_type: string;
    description?: string | undefined;
    created_by?: string | undefined;
    period_end?: string | undefined;
    period_start?: string | undefined;
    payout_date?: string | undefined;
    total_budget?: number | undefined;
    calculation_method?: string | undefined;
    eligibility_rules?: Record<string, unknown> | undefined;
    performance_multipliers?: Record<string, unknown> | undefined;
}, {
    name: string;
    bonus_type: string;
    description?: string | undefined;
    created_by?: string | undefined;
    period_end?: string | undefined;
    period_start?: string | undefined;
    payout_date?: string | undefined;
    total_budget?: number | undefined;
    calculation_method?: string | undefined;
    eligibility_rules?: Record<string, unknown> | undefined;
    performance_multipliers?: Record<string, unknown> | undefined;
}>;
/**
 * PATCH /bonus-plans/:id
 */
export declare const updateBonusPlanSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    bonus_type: z.ZodOptional<z.ZodString>;
    period_start: z.ZodOptional<z.ZodString>;
    period_end: z.ZodOptional<z.ZodString>;
    payout_date: z.ZodOptional<z.ZodString>;
    total_budget: z.ZodOptional<z.ZodNumber>;
    calculation_method: z.ZodOptional<z.ZodString>;
    eligibility_rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    performance_multipliers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "completed", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    bonus_type?: string | undefined;
    period_end?: string | undefined;
    period_start?: string | undefined;
    payout_date?: string | undefined;
    total_budget?: number | undefined;
    calculation_method?: string | undefined;
    eligibility_rules?: Record<string, unknown> | undefined;
    performance_multipliers?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    status?: "active" | "draft" | "completed" | "cancelled" | undefined;
    bonus_type?: string | undefined;
    period_end?: string | undefined;
    period_start?: string | undefined;
    payout_date?: string | undefined;
    total_budget?: number | undefined;
    calculation_method?: string | undefined;
    eligibility_rules?: Record<string, unknown> | undefined;
    performance_multipliers?: Record<string, unknown> | undefined;
}>;
/**
 * POST /merit-cycles
 */
export declare const createMeritCycleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    effective_date: z.ZodString;
    submission_deadline: z.ZodOptional<z.ZodString>;
    approval_deadline: z.ZodOptional<z.ZodString>;
    total_budget: z.ZodOptional<z.ZodNumber>;
    min_increase_percent: z.ZodOptional<z.ZodNumber>;
    max_increase_percent: z.ZodOptional<z.ZodNumber>;
    guideline_matrix: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    effective_date: string;
    description?: string | undefined;
    created_by?: string | undefined;
    total_budget?: number | undefined;
    submission_deadline?: string | undefined;
    approval_deadline?: string | undefined;
    min_increase_percent?: number | undefined;
    max_increase_percent?: number | undefined;
    guideline_matrix?: Record<string, unknown> | undefined;
}, {
    name: string;
    effective_date: string;
    description?: string | undefined;
    created_by?: string | undefined;
    total_budget?: number | undefined;
    submission_deadline?: string | undefined;
    approval_deadline?: string | undefined;
    min_increase_percent?: number | undefined;
    max_increase_percent?: number | undefined;
    guideline_matrix?: Record<string, unknown> | undefined;
}>;
/**
 * PATCH /merit-cycles/:id
 */
export declare const updateMeritCycleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    effective_date: z.ZodOptional<z.ZodString>;
    submission_deadline: z.ZodOptional<z.ZodString>;
    approval_deadline: z.ZodOptional<z.ZodString>;
    total_budget: z.ZodOptional<z.ZodNumber>;
    min_increase_percent: z.ZodOptional<z.ZodNumber>;
    max_increase_percent: z.ZodOptional<z.ZodNumber>;
    guideline_matrix: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodOptional<z.ZodEnum<["planning", "active", "completed", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    status?: "active" | "completed" | "cancelled" | "planning" | undefined;
    effective_date?: string | undefined;
    total_budget?: number | undefined;
    submission_deadline?: string | undefined;
    approval_deadline?: string | undefined;
    min_increase_percent?: number | undefined;
    max_increase_percent?: number | undefined;
    guideline_matrix?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    status?: "active" | "completed" | "cancelled" | "planning" | undefined;
    effective_date?: string | undefined;
    total_budget?: number | undefined;
    submission_deadline?: string | undefined;
    approval_deadline?: string | undefined;
    min_increase_percent?: number | undefined;
    max_increase_percent?: number | undefined;
    guideline_matrix?: Record<string, unknown> | undefined;
}>;
/**
 * POST /salary-bands
 */
export declare const createSalaryBandSchema: z.ZodObject<{
    band_code: z.ZodOptional<z.ZodString>;
    band_name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    job_level: z.ZodOptional<z.ZodString>;
    job_family: z.ZodOptional<z.ZodString>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    min_salary: z.ZodNumber;
    mid_salary: z.ZodOptional<z.ZodNumber>;
    max_salary: z.ZodNumber;
    range_spread_percent: z.ZodOptional<z.ZodNumber>;
    geo_region: z.ZodOptional<z.ZodString>;
    geo_adjustment_percent: z.ZodOptional<z.ZodNumber>;
    effective_from: z.ZodOptional<z.ZodString>;
    effective_to: z.ZodOptional<z.ZodString>;
    is_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    is_active: boolean;
    band_name: string;
    min_salary: number;
    max_salary: number;
    description?: string | undefined;
    created_by?: string | undefined;
    band_code?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    mid_salary?: number | undefined;
    range_spread_percent?: number | undefined;
    geo_region?: string | undefined;
    geo_adjustment_percent?: number | undefined;
    effective_from?: string | undefined;
    effective_to?: string | undefined;
}, {
    band_name: string;
    min_salary: number;
    max_salary: number;
    description?: string | undefined;
    currency?: string | undefined;
    is_active?: boolean | undefined;
    created_by?: string | undefined;
    band_code?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    mid_salary?: number | undefined;
    range_spread_percent?: number | undefined;
    geo_region?: string | undefined;
    geo_adjustment_percent?: number | undefined;
    effective_from?: string | undefined;
    effective_to?: string | undefined;
}>;
/**
 * PATCH /salary-bands/:id
 */
export declare const updateSalaryBandSchema: z.ZodObject<{
    band_code: z.ZodOptional<z.ZodString>;
    band_name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    job_level: z.ZodOptional<z.ZodString>;
    job_family: z.ZodOptional<z.ZodString>;
    currency: z.ZodOptional<z.ZodString>;
    min_salary: z.ZodOptional<z.ZodNumber>;
    mid_salary: z.ZodOptional<z.ZodNumber>;
    max_salary: z.ZodOptional<z.ZodNumber>;
    range_spread_percent: z.ZodOptional<z.ZodNumber>;
    geo_region: z.ZodOptional<z.ZodString>;
    geo_adjustment_percent: z.ZodOptional<z.ZodNumber>;
    effective_from: z.ZodOptional<z.ZodString>;
    effective_to: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    currency?: string | undefined;
    is_active?: boolean | undefined;
    band_name?: string | undefined;
    min_salary?: number | undefined;
    max_salary?: number | undefined;
    band_code?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    mid_salary?: number | undefined;
    range_spread_percent?: number | undefined;
    geo_region?: string | undefined;
    geo_adjustment_percent?: number | undefined;
    effective_from?: string | undefined;
    effective_to?: string | undefined;
}, {
    description?: string | undefined;
    currency?: string | undefined;
    is_active?: boolean | undefined;
    band_name?: string | undefined;
    min_salary?: number | undefined;
    max_salary?: number | undefined;
    band_code?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    mid_salary?: number | undefined;
    range_spread_percent?: number | undefined;
    geo_region?: string | undefined;
    geo_adjustment_percent?: number | undefined;
    effective_from?: string | undefined;
    effective_to?: string | undefined;
}>;
/**
 * POST /pay-stubs
 */
export declare const createPayStubSchema: z.ZodObject<{
    employee_id: z.ZodString;
    period: z.ZodString;
    period_start: z.ZodOptional<z.ZodString>;
    period_end: z.ZodOptional<z.ZodString>;
    gross_pay: z.ZodNumber;
    net_pay: z.ZodOptional<z.ZodNumber>;
    deductions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    payment_date: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["draft", "pending", "paid", "cancelled"]>>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "draft" | "cancelled" | "paid";
    period: string;
    employee_id: string;
    gross_pay: number;
    net_pay?: number | undefined;
    period_end?: string | undefined;
    deductions?: Record<string, unknown> | undefined;
    period_start?: string | undefined;
    payment_date?: string | undefined;
}, {
    period: string;
    employee_id: string;
    gross_pay: number;
    status?: "pending" | "draft" | "cancelled" | "paid" | undefined;
    net_pay?: number | undefined;
    period_end?: string | undefined;
    deductions?: Record<string, unknown> | undefined;
    period_start?: string | undefined;
    payment_date?: string | undefined;
}>;
/**
 * PATCH /pay-stubs/:id
 */
export declare const updatePayStubSchema: z.ZodObject<{
    gross_pay: z.ZodOptional<z.ZodNumber>;
    net_pay: z.ZodOptional<z.ZodNumber>;
    deductions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    payment_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "paid", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "draft" | "cancelled" | "paid" | undefined;
    gross_pay?: number | undefined;
    net_pay?: number | undefined;
    deductions?: Record<string, unknown> | undefined;
    payment_date?: string | undefined;
}, {
    status?: "pending" | "draft" | "cancelled" | "paid" | undefined;
    gross_pay?: number | undefined;
    net_pay?: number | undefined;
    deductions?: Record<string, unknown> | undefined;
    payment_date?: string | undefined;
}>;
/**
 * POST /exports/configs
 */
export declare const createExportConfigSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    data_source: z.ZodString;
    report_id: z.ZodOptional<z.ZodString>;
    table_name: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    options: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    is_default: z.ZodOptional<z.ZodBoolean>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    options: Record<string, unknown>;
    data_source: string;
    description?: string | undefined;
    created_by?: string | undefined;
    query?: string | undefined;
    table_name?: string | undefined;
    is_default?: boolean | undefined;
    report_id?: string | undefined;
}, {
    name: string;
    options: Record<string, unknown>;
    data_source: string;
    description?: string | undefined;
    created_by?: string | undefined;
    query?: string | undefined;
    table_name?: string | undefined;
    is_default?: boolean | undefined;
    report_id?: string | undefined;
}>;
/**
 * PATCH /exports/configs/:id
 */
export declare const updateExportConfigSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    data_source: z.ZodOptional<z.ZodString>;
    report_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    table_name: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is_default: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    options?: Record<string, unknown> | undefined;
    query?: string | undefined;
    table_name?: string | undefined;
    is_default?: boolean | undefined;
    data_source?: string | undefined;
    report_id?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    options?: Record<string, unknown> | undefined;
    query?: string | undefined;
    table_name?: string | undefined;
    is_default?: boolean | undefined;
    data_source?: string | undefined;
    report_id?: string | null | undefined;
}>;
/**
 * POST /exports/jobs
 */
export declare const createExportJobSchema: z.ZodObject<{
    config_id: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    source_id: z.ZodOptional<z.ZodString>;
    options: z.ZodObject<{
        format: z.ZodString;
        include_headers: z.ZodOptional<z.ZodBoolean>;
        include_timestamp: z.ZodOptional<z.ZodBoolean>;
        max_rows: z.ZodOptional<z.ZodNumber>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        format: z.ZodString;
        include_headers: z.ZodOptional<z.ZodBoolean>;
        include_timestamp: z.ZodOptional<z.ZodBoolean>;
        max_rows: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        format: z.ZodString;
        include_headers: z.ZodOptional<z.ZodBoolean>;
        include_timestamp: z.ZodOptional<z.ZodBoolean>;
        max_rows: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    options: {
        format: string;
        include_headers?: boolean | undefined;
        include_timestamp?: boolean | undefined;
        max_rows?: number | undefined;
    } & {
        [k: string]: unknown;
    };
    type: string;
    created_by?: string | undefined;
    filters?: Record<string, unknown> | undefined;
    config_id?: string | undefined;
    source_id?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
}, {
    options: {
        format: string;
        include_headers?: boolean | undefined;
        include_timestamp?: boolean | undefined;
        max_rows?: number | undefined;
    } & {
        [k: string]: unknown;
    };
    type: string;
    created_by?: string | undefined;
    filters?: Record<string, unknown> | undefined;
    config_id?: string | undefined;
    source_id?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
}>;
/**
 * POST /exports/report/:reportId
 */
export declare const quickExportReportSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["csv", "xlsx", "json", "pdf"]>>>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "json" | "pdf" | "xlsx";
    created_by?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
}, {
    format?: "csv" | "json" | "pdf" | "xlsx" | undefined;
    created_by?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
}>;
/**
 * POST /exports/table/:tableName
 */
export declare const quickExportTableSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["csv", "xlsx", "json", "pdf"]>>>;
    max_rows: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "json" | "pdf" | "xlsx";
    max_rows: number;
    created_by?: string | undefined;
}, {
    format?: "csv" | "json" | "pdf" | "xlsx" | undefined;
    created_by?: string | undefined;
    max_rows?: number | undefined;
}>;
/**
 * PATCH /error-analytics/patterns/:id/resolve
 */
export declare const resolveErrorPatternSchema: z.ZodObject<{
    resolutionNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    resolutionNotes?: string | undefined;
}, {
    resolutionNotes?: string | undefined;
}>;
/**
 * POST /offers
 */
export declare const createOfferSchema: z.ZodObject<{
    candidate_id: z.ZodString;
    requisition_id: z.ZodOptional<z.ZodString>;
    salary_offered: z.ZodNumber;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    bonus_offered: z.ZodOptional<z.ZodNumber>;
    equity_offered: z.ZodOptional<z.ZodString>;
    start_date: z.ZodOptional<z.ZodString>;
    expiry_date: z.ZodOptional<z.ZodString>;
    job_title: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    employment_type: z.ZodOptional<z.ZodString>;
    benefits: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    salary_offered: number;
    candidate_id: string;
    department?: string | undefined;
    location?: string | undefined;
    notes?: string | undefined;
    start_date?: string | undefined;
    job_title?: string | undefined;
    employment_type?: string | undefined;
    benefits?: string | undefined;
    requisition_id?: string | undefined;
    bonus_offered?: number | undefined;
    equity_offered?: string | undefined;
    expiry_date?: string | undefined;
}, {
    salary_offered: number;
    candidate_id: string;
    department?: string | undefined;
    location?: string | undefined;
    notes?: string | undefined;
    currency?: string | undefined;
    start_date?: string | undefined;
    job_title?: string | undefined;
    employment_type?: string | undefined;
    benefits?: string | undefined;
    requisition_id?: string | undefined;
    bonus_offered?: number | undefined;
    equity_offered?: string | undefined;
    expiry_date?: string | undefined;
}>;
/**
 * PATCH /offers/:id
 */
export declare const updateOfferSchema: z.ZodObject<{
    salary_offered: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    bonus_offered: z.ZodOptional<z.ZodNumber>;
    equity_offered: z.ZodOptional<z.ZodString>;
    start_date: z.ZodOptional<z.ZodString>;
    expiry_date: z.ZodOptional<z.ZodString>;
    job_title: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    employment_type: z.ZodOptional<z.ZodString>;
    benefits: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    department?: string | undefined;
    location?: string | undefined;
    notes?: string | undefined;
    currency?: string | undefined;
    start_date?: string | undefined;
    job_title?: string | undefined;
    employment_type?: string | undefined;
    benefits?: string | undefined;
    salary_offered?: number | undefined;
    bonus_offered?: number | undefined;
    equity_offered?: string | undefined;
    expiry_date?: string | undefined;
}, {
    department?: string | undefined;
    location?: string | undefined;
    notes?: string | undefined;
    currency?: string | undefined;
    start_date?: string | undefined;
    job_title?: string | undefined;
    employment_type?: string | undefined;
    benefits?: string | undefined;
    salary_offered?: number | undefined;
    bonus_offered?: number | undefined;
    equity_offered?: string | undefined;
    expiry_date?: string | undefined;
}>;
/**
 * POST /offers/:id/approve
 */
export declare const approveOfferSchema: z.ZodObject<{
    approved_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    approved_by?: string | undefined;
}, {
    approved_by?: string | undefined;
}>;
/**
 * POST /offers/:id/decline
 */
export declare const declineOfferSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
/**
 * POST /requisitions
 */
export declare const createRequisitionSchema: z.ZodObject<{
    title: z.ZodString;
    department: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    employment_type: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>>;
    description: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodString>;
    salary_min: z.ZodOptional<z.ZodNumber>;
    salary_max: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    hiring_manager_id: z.ZodOptional<z.ZodString>;
    recruiter_id: z.ZodOptional<z.ZodString>;
    target_hire_date: z.ZodOptional<z.ZodString>;
    headcount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    currency: string;
    priority: "low" | "high" | "normal" | "urgent";
    headcount: number;
    description?: string | undefined;
    department?: string | undefined;
    location?: string | undefined;
    employment_type?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    recruiter_id?: string | undefined;
    target_hire_date?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    department?: string | undefined;
    location?: string | undefined;
    currency?: string | undefined;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    employment_type?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    recruiter_id?: string | undefined;
    target_hire_date?: string | undefined;
    headcount?: number | undefined;
}>;
/**
 * PATCH /requisitions/:id
 */
export declare const updateRequisitionSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    employment_type: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "filled", "cancelled", "on_hold"]>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    description: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodString>;
    salary_min: z.ZodOptional<z.ZodNumber>;
    salary_max: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    hiring_manager_id: z.ZodOptional<z.ZodString>;
    recruiter_id: z.ZodOptional<z.ZodString>;
    target_hire_date: z.ZodOptional<z.ZodString>;
    headcount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    status?: "in_progress" | "cancelled" | "on_hold" | "open" | "filled" | undefined;
    department?: string | undefined;
    location?: string | undefined;
    title?: string | undefined;
    currency?: string | undefined;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    employment_type?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    recruiter_id?: string | undefined;
    target_hire_date?: string | undefined;
    headcount?: number | undefined;
}, {
    description?: string | undefined;
    status?: "in_progress" | "cancelled" | "on_hold" | "open" | "filled" | undefined;
    department?: string | undefined;
    location?: string | undefined;
    title?: string | undefined;
    currency?: string | undefined;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    employment_type?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    recruiter_id?: string | undefined;
    target_hire_date?: string | undefined;
    headcount?: number | undefined;
}>;
/**
 * POST /job-postings
 */
export declare const createJobPostingSchema: z.ZodObject<{
    title: z.ZodString;
    department: z.ZodOptional<z.ZodString>;
    team: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    work_type: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    responsibilities: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodString>;
    nice_to_have: z.ZodOptional<z.ZodString>;
    job_level: z.ZodOptional<z.ZodString>;
    job_family: z.ZodOptional<z.ZodString>;
    salary_min: z.ZodOptional<z.ZodNumber>;
    salary_max: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    show_salary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    visibility: z.ZodDefault<z.ZodOptional<z.ZodEnum<["internal", "external", "confidential"]>>>;
    min_tenure_months: z.ZodOptional<z.ZodNumber>;
    min_rating: z.ZodOptional<z.ZodNumber>;
    required_skills: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    expires_at: z.ZodOptional<z.ZodString>;
    target_start_date: z.ZodOptional<z.ZodString>;
    hiring_manager_id: z.ZodOptional<z.ZodString>;
    hr_contact_id: z.ZodOptional<z.ZodString>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    currency: string;
    visibility: "internal" | "external" | "confidential";
    show_salary: boolean;
    team?: string | undefined;
    department?: string | undefined;
    location?: string | undefined;
    created_by?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    required_skills?: string[] | undefined;
    summary?: string | undefined;
    expires_at?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    work_type?: string | undefined;
    responsibilities?: string | undefined;
    nice_to_have?: string | undefined;
    min_tenure_months?: number | undefined;
    min_rating?: number | undefined;
    target_start_date?: string | undefined;
    hr_contact_id?: string | undefined;
}, {
    title: string;
    team?: string | undefined;
    department?: string | undefined;
    location?: string | undefined;
    currency?: string | undefined;
    created_by?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    required_skills?: string[] | undefined;
    summary?: string | undefined;
    visibility?: "internal" | "external" | "confidential" | undefined;
    expires_at?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    work_type?: string | undefined;
    responsibilities?: string | undefined;
    nice_to_have?: string | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | undefined;
    min_rating?: number | undefined;
    target_start_date?: string | undefined;
    hr_contact_id?: string | undefined;
}>;
/**
 * PATCH /job-postings/:id
 */
export declare const updateJobPostingSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    team: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    work_type: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    responsibilities: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodString>;
    nice_to_have: z.ZodOptional<z.ZodString>;
    job_level: z.ZodOptional<z.ZodString>;
    job_family: z.ZodOptional<z.ZodString>;
    salary_min: z.ZodOptional<z.ZodNumber>;
    salary_max: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    show_salary: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodEnum<["draft", "published", "closed", "archived"]>>;
    visibility: z.ZodOptional<z.ZodEnum<["internal", "external", "confidential"]>>;
    min_tenure_months: z.ZodOptional<z.ZodNumber>;
    min_rating: z.ZodOptional<z.ZodNumber>;
    required_skills: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    expires_at: z.ZodOptional<z.ZodString>;
    target_start_date: z.ZodOptional<z.ZodString>;
    hiring_manager_id: z.ZodOptional<z.ZodString>;
    hr_contact_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "draft" | "closed" | "published" | "archived" | undefined;
    team?: string | undefined;
    department?: string | undefined;
    location?: string | undefined;
    title?: string | undefined;
    currency?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    required_skills?: string[] | undefined;
    summary?: string | undefined;
    visibility?: "internal" | "external" | "confidential" | undefined;
    expires_at?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    work_type?: string | undefined;
    responsibilities?: string | undefined;
    nice_to_have?: string | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | undefined;
    min_rating?: number | undefined;
    target_start_date?: string | undefined;
    hr_contact_id?: string | undefined;
}, {
    status?: "draft" | "closed" | "published" | "archived" | undefined;
    team?: string | undefined;
    department?: string | undefined;
    location?: string | undefined;
    title?: string | undefined;
    currency?: string | undefined;
    requirements?: string | undefined;
    salary_min?: number | undefined;
    salary_max?: number | undefined;
    hiring_manager_id?: string | undefined;
    required_skills?: string[] | undefined;
    summary?: string | undefined;
    visibility?: "internal" | "external" | "confidential" | undefined;
    expires_at?: string | undefined;
    job_level?: string | undefined;
    job_family?: string | undefined;
    work_type?: string | undefined;
    responsibilities?: string | undefined;
    nice_to_have?: string | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | undefined;
    min_rating?: number | undefined;
    target_start_date?: string | undefined;
    hr_contact_id?: string | undefined;
}>;
//# sourceMappingURL=compensation-extended.d.ts.map