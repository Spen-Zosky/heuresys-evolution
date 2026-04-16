/**
 * Zod Schemas for Employee-related Routes
 * Covers: employees, departments, org-units, org-charts, locations, cost-centers, contracts
 */
import { z } from 'zod';
// =============================================================================
// EMPLOYEES
// =============================================================================
export const createEmployeeSchema = z.object({
    first_name: z.string().trim().min(1, 'First name is required').max(100),
    last_name: z.string().trim().min(1, 'Last name is required').max(100),
    email: z.string().trim().email('Invalid email format').max(255),
    job_title: z.string().trim().max(200).optional().nullable(),
    org_unit_id: z.string().uuid('Invalid org unit ID').optional().nullable(),
    location_id: z.string().uuid('Invalid location ID').optional().nullable(),
    manager_id: z.string().uuid('Invalid manager ID').optional().nullable(),
    hire_date: z.string().optional().nullable(),
});
export const updateEmployeeSchema = createEmployeeSchema
    .extend({
    is_active: z.boolean().optional(),
    employment_status: z
        .enum(['active', 'on_leave', 'probation', 'suspended', 'notice_period', 'terminated'])
        .optional(),
})
    .partial();
export const archiveEmployeeSchema = z.object({
    reason: z.string().trim().min(1, 'Termination reason is required').max(500),
    termination_date: z.string().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
});
export const updateSelfEmployeeSchema = z
    .object({
    phone_mobile: z.string().trim().max(30).optional(),
    phone_home: z.string().trim().max(30).optional(),
    personal_email: z.string().trim().email('Invalid email format').max(255).optional(),
    address_street: z.string().trim().max(300).optional(),
    address_city: z.string().trim().max(100).optional(),
    address_postal_code: z.string().trim().max(20).optional(),
    address_country: z.string().trim().max(100).optional(),
    emergency_contact_name: z.string().trim().max(200).optional(),
    emergency_contact_phone: z.string().trim().max(30).optional(),
    emergency_contact_relationship: z.string().trim().max(100).optional(),
    iban: z.string().trim().max(34).optional(),
    bank_name: z.string().trim().max(200).optional(),
    bank_account_number: z.string().trim().max(50).optional(),
    swift_bic: z.string().trim().max(11).optional(),
})
    .passthrough();
// =============================================================================
// ORG UNITS
// =============================================================================
export const createOrgUnitSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(50),
    name: z.string().trim().min(1, 'Name is required').max(200),
    name_en: z.string().trim().max(200).optional().nullable(),
    parent_id: z.string().uuid('Invalid parent ID').optional().nullable(),
    org_level: z.coerce.number().int().min(1).max(20).optional(),
    org_type: z.string().trim().max(50).optional().nullable(),
    org_unit_id: z.string().uuid('Invalid department ID').optional().nullable(),
    default_location_id: z.string().uuid('Invalid location ID').optional().nullable(),
    manager_id: z.string().uuid('Invalid manager ID').optional().nullable(),
    deputy_manager_id: z.string().uuid('Invalid deputy manager ID').optional().nullable(),
    headcount_budget: z.coerce.number().int().min(0).optional().nullable(),
    valid_from: z.string().optional().nullable(),
    sort_order: z.coerce.number().int().min(0).optional(),
});
export const updateOrgUnitSchema = createOrgUnitSchema
    .omit({ code: true })
    .extend({
    valid_to: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
})
    .partial();
export const moveOrgUnitSchema = z.object({
    newParentId: z.string().uuid('Invalid parent ID').optional().nullable(),
});
// =============================================================================
// ORG CHARTS
// =============================================================================
export const createOrgChartSessionSchema = z.object({
    sessionName: z.string().trim().min(1, 'Session name is required').max(200),
    config: z
        .object({
        method: z.enum(['web_search', 'template', 'nace_esco', 'combined']).optional(),
        aiProvider: z.string().trim().max(50).optional(),
        levelCount: z.coerce.number().int().min(1).max(20).optional(),
        includeVacancies: z.boolean().optional(),
        useExistingDepartments: z.boolean().optional(),
        useExistingJobTitles: z.boolean().optional(),
    })
        .optional(),
});
export const generateOrgChartSchema = z.object({
    method: z.enum(['web_search', 'template', 'nace_esco', 'combined']).optional(),
    aiProvider: z.string().trim().max(50).optional(),
});
export const generatePrototypeSchema = z.object({
    sessionName: z.string().trim().max(200).optional(),
    method: z.enum(['web_search', 'template', 'nace_esco', 'combined']).optional(),
    aiProvider: z.string().trim().max(50).optional(),
});
export const exportTenantOrgUnitsSchema = z.object({
    chartName: z.string().trim().max(200).optional(),
    setAsActive: z.boolean().optional(),
});
export const createSnapshotSchema = z.object({
    snapshotName: z.string().trim().max(200).optional(),
    snapshotType: z.enum(['staging', 'generated', 'approved']).optional(),
});
// =============================================================================
// LOCATIONS
// =============================================================================
export const createLocationSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(50),
    name: z.string().trim().min(1, 'Name is required').max(200),
    location_type: z.string().trim().max(50).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    province: z.string().trim().max(100).optional().nullable(),
    postal_code: z.string().trim().max(20).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email('Invalid email format').max(255).optional().nullable(),
    capacity_headcount: z.coerce.number().int().min(0).optional().nullable(),
    square_meters: z.coerce.number().min(0).optional().nullable(),
    opening_date: z.string().optional().nullable(),
});
export const updateLocationSchema = createLocationSchema
    .omit({ code: true })
    .extend({
    closing_date: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
})
    .partial();
// =============================================================================
// COST CENTERS
// =============================================================================
export const createCostCenterSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(50),
    name: z.string().trim().min(1, 'Name is required').max(200),
    name_en: z.string().trim().max(200).optional().nullable(),
    parent_id: z.string().uuid('Invalid parent ID').optional().nullable(),
    cost_center_type: z.string().trim().max(50).optional().nullable(),
    responsible_id: z.string().uuid('Invalid responsible ID').optional().nullable(),
    org_unit_id: z.string().uuid('Invalid org unit ID').optional().nullable(),
    budget_annual_eur: z.coerce.number().min(0).optional().nullable(),
    budget_headcount: z.coerce.number().int().min(0).optional().nullable(),
    gl_account: z.string().trim().max(50).optional().nullable(),
    valid_from: z.string().optional().nullable(),
});
export const updateCostCenterSchema = createCostCenterSchema
    .omit({ code: true })
    .extend({
    valid_to: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
})
    .partial();
// =============================================================================
// CONTRACTS
// =============================================================================
export const createContractSchema = z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    contractType: z.enum([
        'tempo_indeterminato',
        'tempo_determinato',
        'apprendistato',
        'somministrazione',
        'collaborazione',
    ]),
    contractCode: z.string().trim().max(50).optional().nullable(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional().nullable(),
    probationEndDate: z.string().optional().nullable(),
    ccnlType: z.string().trim().max(100).optional().nullable(),
    ccnlLevel: z.string().trim().max(50).optional().nullable(),
    grossAnnualSalary: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(3).optional(),
    salaryType: z.string().trim().max(50).optional(),
    paymentFrequency: z.string().trim().max(50).optional(),
    workHoursWeekly: z.coerce.number().min(0).max(168).optional(),
    workScheduleType: z.string().trim().max(50).optional(),
    partTimePercentage: z.coerce.number().min(0).max(100).optional().nullable(),
    jobTitle: z.string().trim().max(200).optional().nullable(),
    jobDescription: z.string().trim().max(5000).optional().nullable(),
    orgUnitId: z.string().uuid('Invalid department ID').optional().nullable(),
    locationId: z.string().uuid('Invalid location ID').optional().nullable(),
    costCenterId: z.string().uuid('Invalid cost center ID').optional().nullable(),
    status: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(5000).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
});
export const updateContractSchema = createContractSchema
    .omit({ employeeId: true })
    .extend({
    terminationDate: z.string().optional().nullable(),
    terminationReason: z.string().trim().max(500).optional().nullable(),
})
    .partial();
export const terminateContractSchema = z.object({
    terminationDate: z.string().min(1, 'Termination date is required'),
    terminationReason: z.string().trim().max(500).optional().nullable(),
});
export const createAmendmentSchema = z.object({
    amendmentType: z.enum([
        'salary_change',
        'role_change',
        'schedule_change',
        'renewal',
        'promotion',
        'transfer',
        'other',
    ]),
    effectiveDate: z.string().min(1, 'Effective date is required'),
    description: z.string().trim().max(2000).optional().nullable(),
    previousValues: z.record(z.unknown()).optional(),
    newValues: z.record(z.unknown()).optional(),
});
//# sourceMappingURL=employees.js.map