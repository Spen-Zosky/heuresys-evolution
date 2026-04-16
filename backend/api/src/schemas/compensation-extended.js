import { z } from 'zod';
// =============================================================================
// BENEFITS SCHEMAS
// =============================================================================
/**
 * POST /benefits
 */
export const createBenefitSchema = z.object({
    benefit_name: z.string().trim().min(1, 'Benefit name is required').max(200),
    benefit_type: z.string().trim().min(1, 'Benefit type is required').max(100),
    description: z.string().trim().max(5000).optional(),
    monthly_cost: z.number().min(0).optional(),
    coverage_options: z.record(z.unknown()).optional(),
    is_active: z.boolean().optional().default(true),
});
/**
 * PATCH /benefits/:id
 */
export const updateBenefitSchema = z.object({
    benefit_name: z.string().trim().min(1).max(200).optional(),
    benefit_type: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(5000).optional(),
    monthly_cost: z.number().min(0).optional(),
    coverage_options: z.record(z.unknown()).optional(),
    is_active: z.boolean().optional(),
});
// =============================================================================
// BONUS PLANS SCHEMAS
// =============================================================================
/**
 * POST /bonus-plans
 */
export const createBonusPlanSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(5000).optional(),
    bonus_type: z.string().trim().min(1, 'bonus_type is required').max(100),
    period_start: z.string().trim().max(50).optional(),
    period_end: z.string().trim().max(50).optional(),
    payout_date: z.string().trim().max(50).optional(),
    total_budget: z.number().min(0).optional(),
    calculation_method: z.string().trim().max(200).optional(),
    eligibility_rules: z.record(z.unknown()).optional(),
    performance_multipliers: z.record(z.unknown()).optional(),
    created_by: z.string().uuid('Invalid user ID').optional(),
});
/**
 * PATCH /bonus-plans/:id
 */
export const updateBonusPlanSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    bonus_type: z.string().trim().min(1).max(100).optional(),
    period_start: z.string().trim().max(50).optional(),
    period_end: z.string().trim().max(50).optional(),
    payout_date: z.string().trim().max(50).optional(),
    total_budget: z.number().min(0).optional(),
    calculation_method: z.string().trim().max(200).optional(),
    eligibility_rules: z.record(z.unknown()).optional(),
    performance_multipliers: z.record(z.unknown()).optional(),
    status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
});
// =============================================================================
// MERIT CYCLES SCHEMAS
// =============================================================================
/**
 * POST /merit-cycles
 */
export const createMeritCycleSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(5000).optional(),
    effective_date: z.string().trim().min(1, 'effective_date is required').max(50),
    submission_deadline: z.string().trim().max(50).optional(),
    approval_deadline: z.string().trim().max(50).optional(),
    total_budget: z.number().min(0).optional(),
    min_increase_percent: z.number().min(0).max(100).optional(),
    max_increase_percent: z.number().min(0).max(100).optional(),
    guideline_matrix: z.record(z.unknown()).optional(),
    created_by: z.string().uuid('Invalid user ID').optional(),
});
/**
 * PATCH /merit-cycles/:id
 */
export const updateMeritCycleSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    effective_date: z.string().trim().max(50).optional(),
    submission_deadline: z.string().trim().max(50).optional(),
    approval_deadline: z.string().trim().max(50).optional(),
    total_budget: z.number().min(0).optional(),
    min_increase_percent: z.number().min(0).max(100).optional(),
    max_increase_percent: z.number().min(0).max(100).optional(),
    guideline_matrix: z.record(z.unknown()).optional(),
    status: z.enum(['planning', 'active', 'completed', 'cancelled']).optional(),
});
// =============================================================================
// SALARY BANDS SCHEMAS
// =============================================================================
/**
 * POST /salary-bands
 */
export const createSalaryBandSchema = z.object({
    band_code: z.string().trim().max(100).optional(),
    band_name: z.string().trim().min(1, 'Band name is required').max(200),
    description: z.string().trim().max(5000).optional(),
    job_level: z.string().trim().max(100).optional(),
    job_family: z.string().trim().max(200).optional(),
    currency: z.string().trim().max(3).optional().default('EUR'),
    min_salary: z.number().min(0, 'min_salary is required'),
    mid_salary: z.number().min(0).optional(),
    max_salary: z.number().min(0, 'max_salary is required'),
    range_spread_percent: z.number().min(0).max(1000).optional(),
    geo_region: z.string().trim().max(200).optional(),
    geo_adjustment_percent: z.number().min(-100).max(1000).optional(),
    effective_from: z.string().trim().max(50).optional(),
    effective_to: z.string().trim().max(50).optional(),
    is_active: z.boolean().optional().default(true),
    created_by: z.string().uuid('Invalid user ID').optional(),
});
/**
 * PATCH /salary-bands/:id
 */
export const updateSalaryBandSchema = z.object({
    band_code: z.string().trim().max(100).optional(),
    band_name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    job_level: z.string().trim().max(100).optional(),
    job_family: z.string().trim().max(200).optional(),
    currency: z.string().trim().max(3).optional(),
    min_salary: z.number().min(0).optional(),
    mid_salary: z.number().min(0).optional(),
    max_salary: z.number().min(0).optional(),
    range_spread_percent: z.number().min(0).max(1000).optional(),
    geo_region: z.string().trim().max(200).optional(),
    geo_adjustment_percent: z.number().min(-100).max(1000).optional(),
    effective_from: z.string().trim().max(50).optional(),
    effective_to: z.string().trim().max(50).optional(),
    is_active: z.boolean().optional(),
});
// =============================================================================
// PAY STUBS SCHEMAS
// =============================================================================
/**
 * POST /pay-stubs
 */
export const createPayStubSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
    period: z.string().trim().min(1, 'Period is required').max(50),
    period_start: z.string().trim().max(50).optional(),
    period_end: z.string().trim().max(50).optional(),
    gross_pay: z.number().min(0, 'gross_pay is required'),
    net_pay: z.number().min(0).optional(),
    deductions: z.record(z.unknown()).optional(),
    payment_date: z.string().trim().max(50).optional(),
    status: z.enum(['draft', 'pending', 'paid', 'cancelled']).optional().default('draft'),
});
/**
 * PATCH /pay-stubs/:id
 */
export const updatePayStubSchema = z.object({
    gross_pay: z.number().min(0).optional(),
    net_pay: z.number().min(0).optional(),
    deductions: z.record(z.unknown()).optional(),
    payment_date: z.string().trim().max(50).optional(),
    status: z.enum(['draft', 'pending', 'paid', 'cancelled']).optional(),
});
// =============================================================================
// EXPORTS SCHEMAS
// =============================================================================
/**
 * POST /exports/configs
 */
export const createExportConfigSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(5000).optional(),
    data_source: z.string().trim().min(1, 'data_source is required').max(200),
    report_id: z.string().uuid('Invalid report ID').optional(),
    table_name: z.string().trim().max(200).optional(),
    query: z.string().trim().max(10000).optional(),
    options: z.record(z.unknown()),
    is_default: z.boolean().optional(),
    created_by: z.string().trim().max(200).optional(),
});
/**
 * PATCH /exports/configs/:id
 */
export const updateExportConfigSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    data_source: z.string().trim().max(200).optional(),
    report_id: z.string().uuid('Invalid report ID').optional().nullable(),
    table_name: z.string().trim().max(200).optional(),
    query: z.string().trim().max(10000).optional(),
    options: z.record(z.unknown()).optional(),
    is_default: z.boolean().optional(),
});
/**
 * POST /exports/jobs
 */
export const createExportJobSchema = z.object({
    config_id: z.string().uuid('Invalid config ID').optional(),
    type: z.string().trim().min(1, 'Type is required').max(100),
    source_id: z.string().trim().max(200).optional(),
    options: z.object({
        format: z.string().trim().min(1, 'options.format is required').max(50),
        include_headers: z.boolean().optional(),
        include_timestamp: z.boolean().optional(),
        max_rows: z.number().int().min(1).max(1000000).optional(),
    }).passthrough(),
    parameters: z.record(z.unknown()).optional(),
    filters: z.record(z.unknown()).optional(),
    created_by: z.string().trim().max(200).optional(),
});
/**
 * POST /exports/report/:reportId
 */
export const quickExportReportSchema = z.object({
    format: z.enum(['csv', 'xlsx', 'json', 'pdf']).optional().default('csv'),
    parameters: z.record(z.unknown()).optional(),
    created_by: z.string().trim().max(200).optional(),
});
/**
 * POST /exports/table/:tableName
 */
export const quickExportTableSchema = z.object({
    format: z.enum(['csv', 'xlsx', 'json', 'pdf']).optional().default('csv'),
    max_rows: z.number().int().min(1).max(1000000).optional().default(10000),
    created_by: z.string().trim().max(200).optional(),
});
// =============================================================================
// ERROR ANALYTICS SCHEMAS
// =============================================================================
/**
 * PATCH /error-analytics/patterns/:id/resolve
 */
export const resolveErrorPatternSchema = z.object({
    resolutionNotes: z.string().trim().max(5000).optional(),
});
// =============================================================================
// OFFERS SCHEMAS
// =============================================================================
/**
 * POST /offers
 */
export const createOfferSchema = z.object({
    candidate_id: z.string().uuid('Invalid candidate ID'),
    requisition_id: z.string().uuid('Invalid requisition ID').optional(),
    salary_offered: z.number().min(0, 'salary_offered is required'),
    currency: z.string().trim().max(3).optional().default('EUR'),
    bonus_offered: z.number().min(0).optional(),
    equity_offered: z.string().trim().max(500).optional(),
    start_date: z.string().trim().max(50).optional(),
    expiry_date: z.string().trim().max(50).optional(),
    job_title: z.string().trim().max(200).optional(),
    department: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    employment_type: z.string().trim().max(100).optional(),
    benefits: z.string().trim().max(5000).optional(),
    notes: z.string().trim().max(5000).optional(),
});
/**
 * PATCH /offers/:id
 */
export const updateOfferSchema = z.object({
    salary_offered: z.number().min(0).optional(),
    currency: z.string().trim().max(3).optional(),
    bonus_offered: z.number().min(0).optional(),
    equity_offered: z.string().trim().max(500).optional(),
    start_date: z.string().trim().max(50).optional(),
    expiry_date: z.string().trim().max(50).optional(),
    job_title: z.string().trim().max(200).optional(),
    department: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    employment_type: z.string().trim().max(100).optional(),
    benefits: z.string().trim().max(5000).optional(),
    notes: z.string().trim().max(5000).optional(),
});
/**
 * POST /offers/:id/approve
 */
export const approveOfferSchema = z.object({
    approved_by: z.string().uuid('Invalid user ID').optional(),
});
/**
 * POST /offers/:id/decline
 */
export const declineOfferSchema = z.object({
    reason: z.string().trim().max(5000).optional(),
});
// =============================================================================
// REQUISITIONS SCHEMAS
// =============================================================================
/**
 * POST /requisitions
 */
export const createRequisitionSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    department: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    employment_type: z.string().trim().max(100).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
    description: z.string().trim().max(5000).optional(),
    requirements: z.string().trim().max(5000).optional(),
    salary_min: z.number().min(0).optional(),
    salary_max: z.number().min(0).optional(),
    currency: z.string().trim().max(3).optional().default('EUR'),
    hiring_manager_id: z.string().uuid('Invalid hiring manager ID').optional(),
    recruiter_id: z.string().uuid('Invalid recruiter ID').optional(),
    target_hire_date: z.string().trim().max(50).optional(),
    headcount: z.number().int().min(1).max(1000).optional().default(1),
});
/**
 * PATCH /requisitions/:id
 */
export const updateRequisitionSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    department: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    employment_type: z.string().trim().max(100).optional(),
    status: z.enum(['open', 'in_progress', 'filled', 'cancelled', 'on_hold']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    description: z.string().trim().max(5000).optional(),
    requirements: z.string().trim().max(5000).optional(),
    salary_min: z.number().min(0).optional(),
    salary_max: z.number().min(0).optional(),
    currency: z.string().trim().max(3).optional(),
    hiring_manager_id: z.string().uuid('Invalid hiring manager ID').optional(),
    recruiter_id: z.string().uuid('Invalid recruiter ID').optional(),
    target_hire_date: z.string().trim().max(50).optional(),
    headcount: z.number().int().min(1).max(1000).optional(),
});
// =============================================================================
// JOB POSTINGS SCHEMAS
// =============================================================================
/**
 * POST /job-postings
 */
export const createJobPostingSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    department: z.string().trim().max(200).optional(),
    team: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    work_type: z.string().trim().max(100).optional(),
    summary: z.string().trim().max(5000).optional(),
    responsibilities: z.string().trim().max(10000).optional(),
    requirements: z.string().trim().max(10000).optional(),
    nice_to_have: z.string().trim().max(5000).optional(),
    job_level: z.string().trim().max(100).optional(),
    job_family: z.string().trim().max(200).optional(),
    salary_min: z.number().min(0).optional(),
    salary_max: z.number().min(0).optional(),
    currency: z.string().trim().max(3).optional().default('EUR'),
    show_salary: z.boolean().optional().default(false),
    visibility: z.enum(['internal', 'external', 'confidential']).optional().default('internal'),
    min_tenure_months: z.number().int().min(0).optional(),
    min_rating: z.number().min(0).max(5).optional(),
    required_skills: z.array(z.string().trim().max(200)).optional(),
    expires_at: z.string().trim().max(50).optional(),
    target_start_date: z.string().trim().max(50).optional(),
    hiring_manager_id: z.string().uuid('Invalid hiring manager ID').optional(),
    hr_contact_id: z.string().uuid('Invalid HR contact ID').optional(),
    created_by: z.string().uuid('Invalid user ID').optional(),
});
/**
 * PATCH /job-postings/:id
 */
export const updateJobPostingSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    department: z.string().trim().max(200).optional(),
    team: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    work_type: z.string().trim().max(100).optional(),
    summary: z.string().trim().max(5000).optional(),
    responsibilities: z.string().trim().max(10000).optional(),
    requirements: z.string().trim().max(10000).optional(),
    nice_to_have: z.string().trim().max(5000).optional(),
    job_level: z.string().trim().max(100).optional(),
    job_family: z.string().trim().max(200).optional(),
    salary_min: z.number().min(0).optional(),
    salary_max: z.number().min(0).optional(),
    currency: z.string().trim().max(3).optional(),
    show_salary: z.boolean().optional(),
    status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
    visibility: z.enum(['internal', 'external', 'confidential']).optional(),
    min_tenure_months: z.number().int().min(0).optional(),
    min_rating: z.number().min(0).max(5).optional(),
    required_skills: z.array(z.string().trim().max(200)).optional(),
    expires_at: z.string().trim().max(50).optional(),
    target_start_date: z.string().trim().max(50).optional(),
    hiring_manager_id: z.string().uuid('Invalid hiring manager ID').optional(),
    hr_contact_id: z.string().uuid('Invalid HR contact ID').optional(),
});
//# sourceMappingURL=compensation-extended.js.map