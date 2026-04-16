/**
 * Zod Schemas for Employee-related Routes
 * Covers: employees, departments, org-units, org-charts, locations, cost-centers, contracts
 */
import { z } from 'zod';
export declare const createEmployeeSchema: z.ZodObject<{
    first_name: z.ZodString;
    last_name: z.ZodString;
    email: z.ZodString;
    job_title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    manager_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    hire_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    first_name: string;
    last_name: string;
    email: string;
    job_title?: string | null | undefined;
    org_unit_id?: string | null | undefined;
    location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    hire_date?: string | null | undefined;
}, {
    first_name: string;
    last_name: string;
    email: string;
    job_title?: string | null | undefined;
    org_unit_id?: string | null | undefined;
    location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    hire_date?: string | null | undefined;
}>;
export declare const updateEmployeeSchema: z.ZodObject<{
    first_name: z.ZodOptional<z.ZodString>;
    last_name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    job_title: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    org_unit_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    location_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    manager_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    hire_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    employment_status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["active", "on_leave", "probation", "suspended", "notice_period", "terminated"]>>>;
}, "strip", z.ZodTypeAny, {
    job_title?: string | null | undefined;
    org_unit_id?: string | null | undefined;
    location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    is_active?: boolean | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    email?: string | undefined;
    hire_date?: string | null | undefined;
    employment_status?: "active" | "suspended" | "on_leave" | "probation" | "notice_period" | "terminated" | undefined;
}, {
    job_title?: string | null | undefined;
    org_unit_id?: string | null | undefined;
    location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    is_active?: boolean | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    email?: string | undefined;
    hire_date?: string | null | undefined;
    employment_status?: "active" | "suspended" | "on_leave" | "probation" | "notice_period" | "terminated" | undefined;
}>;
export declare const archiveEmployeeSchema: z.ZodObject<{
    reason: z.ZodString;
    termination_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    notes?: string | null | undefined;
    termination_date?: string | null | undefined;
}, {
    reason: string;
    notes?: string | null | undefined;
    termination_date?: string | null | undefined;
}>;
export declare const updateSelfEmployeeSchema: z.ZodObject<{
    phone_mobile: z.ZodOptional<z.ZodString>;
    phone_home: z.ZodOptional<z.ZodString>;
    personal_email: z.ZodOptional<z.ZodString>;
    address_street: z.ZodOptional<z.ZodString>;
    address_city: z.ZodOptional<z.ZodString>;
    address_postal_code: z.ZodOptional<z.ZodString>;
    address_country: z.ZodOptional<z.ZodString>;
    emergency_contact_name: z.ZodOptional<z.ZodString>;
    emergency_contact_phone: z.ZodOptional<z.ZodString>;
    emergency_contact_relationship: z.ZodOptional<z.ZodString>;
    iban: z.ZodOptional<z.ZodString>;
    bank_name: z.ZodOptional<z.ZodString>;
    bank_account_number: z.ZodOptional<z.ZodString>;
    swift_bic: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    phone_mobile: z.ZodOptional<z.ZodString>;
    phone_home: z.ZodOptional<z.ZodString>;
    personal_email: z.ZodOptional<z.ZodString>;
    address_street: z.ZodOptional<z.ZodString>;
    address_city: z.ZodOptional<z.ZodString>;
    address_postal_code: z.ZodOptional<z.ZodString>;
    address_country: z.ZodOptional<z.ZodString>;
    emergency_contact_name: z.ZodOptional<z.ZodString>;
    emergency_contact_phone: z.ZodOptional<z.ZodString>;
    emergency_contact_relationship: z.ZodOptional<z.ZodString>;
    iban: z.ZodOptional<z.ZodString>;
    bank_name: z.ZodOptional<z.ZodString>;
    bank_account_number: z.ZodOptional<z.ZodString>;
    swift_bic: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    phone_mobile: z.ZodOptional<z.ZodString>;
    phone_home: z.ZodOptional<z.ZodString>;
    personal_email: z.ZodOptional<z.ZodString>;
    address_street: z.ZodOptional<z.ZodString>;
    address_city: z.ZodOptional<z.ZodString>;
    address_postal_code: z.ZodOptional<z.ZodString>;
    address_country: z.ZodOptional<z.ZodString>;
    emergency_contact_name: z.ZodOptional<z.ZodString>;
    emergency_contact_phone: z.ZodOptional<z.ZodString>;
    emergency_contact_relationship: z.ZodOptional<z.ZodString>;
    iban: z.ZodOptional<z.ZodString>;
    bank_name: z.ZodOptional<z.ZodString>;
    bank_account_number: z.ZodOptional<z.ZodString>;
    swift_bic: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const createOrgUnitSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    name_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_level: z.ZodOptional<z.ZodNumber>;
    org_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    default_location_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    manager_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    deputy_manager_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    headcount_budget: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    valid_from: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sort_order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    org_level?: number | undefined;
    org_type?: string | null | undefined;
    default_location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    deputy_manager_id?: string | null | undefined;
    headcount_budget?: number | null | undefined;
    valid_from?: string | null | undefined;
    sort_order?: number | undefined;
}, {
    code: string;
    name: string;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    org_level?: number | undefined;
    org_type?: string | null | undefined;
    default_location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    deputy_manager_id?: string | null | undefined;
    headcount_budget?: number | null | undefined;
    valid_from?: string | null | undefined;
    sort_order?: number | undefined;
}>;
export declare const updateOrgUnitSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    org_unit_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    name_en: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    parent_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    org_level: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    org_type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    default_location_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    manager_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    deputy_manager_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    headcount_budget: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    valid_from: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    sort_order: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    valid_to: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    org_level?: number | undefined;
    org_type?: string | null | undefined;
    default_location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    deputy_manager_id?: string | null | undefined;
    headcount_budget?: number | null | undefined;
    valid_from?: string | null | undefined;
    sort_order?: number | undefined;
    valid_to?: string | null | undefined;
    is_active?: boolean | undefined;
}, {
    name?: string | undefined;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    org_level?: number | undefined;
    org_type?: string | null | undefined;
    default_location_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    deputy_manager_id?: string | null | undefined;
    headcount_budget?: number | null | undefined;
    valid_from?: string | null | undefined;
    sort_order?: number | undefined;
    valid_to?: string | null | undefined;
    is_active?: boolean | undefined;
}>;
export declare const moveOrgUnitSchema: z.ZodObject<{
    newParentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    newParentId?: string | null | undefined;
}, {
    newParentId?: string | null | undefined;
}>;
export declare const createOrgChartSessionSchema: z.ZodObject<{
    sessionName: z.ZodString;
    config: z.ZodOptional<z.ZodObject<{
        method: z.ZodOptional<z.ZodEnum<["web_search", "template", "nace_esco", "combined"]>>;
        aiProvider: z.ZodOptional<z.ZodString>;
        levelCount: z.ZodOptional<z.ZodNumber>;
        includeVacancies: z.ZodOptional<z.ZodBoolean>;
        useExistingDepartments: z.ZodOptional<z.ZodBoolean>;
        useExistingJobTitles: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
        aiProvider?: string | undefined;
        levelCount?: number | undefined;
        includeVacancies?: boolean | undefined;
        useExistingDepartments?: boolean | undefined;
        useExistingJobTitles?: boolean | undefined;
    }, {
        method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
        aiProvider?: string | undefined;
        levelCount?: number | undefined;
        includeVacancies?: boolean | undefined;
        useExistingDepartments?: boolean | undefined;
        useExistingJobTitles?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    sessionName: string;
    config?: {
        method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
        aiProvider?: string | undefined;
        levelCount?: number | undefined;
        includeVacancies?: boolean | undefined;
        useExistingDepartments?: boolean | undefined;
        useExistingJobTitles?: boolean | undefined;
    } | undefined;
}, {
    sessionName: string;
    config?: {
        method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
        aiProvider?: string | undefined;
        levelCount?: number | undefined;
        includeVacancies?: boolean | undefined;
        useExistingDepartments?: boolean | undefined;
        useExistingJobTitles?: boolean | undefined;
    } | undefined;
}>;
export declare const generateOrgChartSchema: z.ZodObject<{
    method: z.ZodOptional<z.ZodEnum<["web_search", "template", "nace_esco", "combined"]>>;
    aiProvider: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
    aiProvider?: string | undefined;
}, {
    method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
    aiProvider?: string | undefined;
}>;
export declare const generatePrototypeSchema: z.ZodObject<{
    sessionName: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodEnum<["web_search", "template", "nace_esco", "combined"]>>;
    aiProvider: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sessionName?: string | undefined;
    method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
    aiProvider?: string | undefined;
}, {
    sessionName?: string | undefined;
    method?: "web_search" | "template" | "nace_esco" | "combined" | undefined;
    aiProvider?: string | undefined;
}>;
export declare const exportTenantOrgUnitsSchema: z.ZodObject<{
    chartName: z.ZodOptional<z.ZodString>;
    setAsActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    chartName?: string | undefined;
    setAsActive?: boolean | undefined;
}, {
    chartName?: string | undefined;
    setAsActive?: boolean | undefined;
}>;
export declare const createSnapshotSchema: z.ZodObject<{
    snapshotName: z.ZodOptional<z.ZodString>;
    snapshotType: z.ZodOptional<z.ZodEnum<["staging", "generated", "approved"]>>;
}, "strip", z.ZodTypeAny, {
    snapshotName?: string | undefined;
    snapshotType?: "staging" | "generated" | "approved" | undefined;
}, {
    snapshotName?: string | undefined;
    snapshotType?: "staging" | "generated" | "approved" | undefined;
}>;
export declare const createLocationSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    location_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    city: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    province: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    postal_code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    country: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    latitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    longitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    capacity_headcount: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    square_meters: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    opening_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    country?: string | null | undefined;
    phone?: string | null | undefined;
    location_type?: string | null | undefined;
    province?: string | null | undefined;
    postal_code?: string | null | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    capacity_headcount?: number | null | undefined;
    square_meters?: number | null | undefined;
    opening_date?: string | null | undefined;
}, {
    code: string;
    name: string;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    country?: string | null | undefined;
    phone?: string | null | undefined;
    location_type?: string | null | undefined;
    province?: string | null | undefined;
    postal_code?: string | null | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    capacity_headcount?: number | null | undefined;
    square_meters?: number | null | undefined;
    opening_date?: string | null | undefined;
}>;
export declare const updateLocationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    city: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    location_type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    province: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    postal_code: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    latitude: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    longitude: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    capacity_headcount: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    square_meters: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    opening_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    closing_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    is_active?: boolean | undefined;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    country?: string | null | undefined;
    phone?: string | null | undefined;
    location_type?: string | null | undefined;
    province?: string | null | undefined;
    postal_code?: string | null | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    capacity_headcount?: number | null | undefined;
    square_meters?: number | null | undefined;
    opening_date?: string | null | undefined;
    closing_date?: string | null | undefined;
}, {
    name?: string | undefined;
    is_active?: boolean | undefined;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    country?: string | null | undefined;
    phone?: string | null | undefined;
    location_type?: string | null | undefined;
    province?: string | null | undefined;
    postal_code?: string | null | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    capacity_headcount?: number | null | undefined;
    square_meters?: number | null | undefined;
    opening_date?: string | null | undefined;
    closing_date?: string | null | undefined;
}>;
export declare const createCostCenterSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    name_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cost_center_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    responsible_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    org_unit_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    budget_annual_eur: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    budget_headcount: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    gl_account: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    valid_from: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    valid_from?: string | null | undefined;
    cost_center_type?: string | null | undefined;
    responsible_id?: string | null | undefined;
    budget_annual_eur?: number | null | undefined;
    budget_headcount?: number | null | undefined;
    gl_account?: string | null | undefined;
}, {
    code: string;
    name: string;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    valid_from?: string | null | undefined;
    cost_center_type?: string | null | undefined;
    responsible_id?: string | null | undefined;
    budget_annual_eur?: number | null | undefined;
    budget_headcount?: number | null | undefined;
    gl_account?: string | null | undefined;
}>;
export declare const updateCostCenterSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    org_unit_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    name_en: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    parent_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    valid_from: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    cost_center_type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    responsible_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    budget_annual_eur: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    budget_headcount: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    gl_account: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    valid_to: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    valid_from?: string | null | undefined;
    valid_to?: string | null | undefined;
    is_active?: boolean | undefined;
    cost_center_type?: string | null | undefined;
    responsible_id?: string | null | undefined;
    budget_annual_eur?: number | null | undefined;
    budget_headcount?: number | null | undefined;
    gl_account?: string | null | undefined;
}, {
    name?: string | undefined;
    org_unit_id?: string | null | undefined;
    name_en?: string | null | undefined;
    parent_id?: string | null | undefined;
    valid_from?: string | null | undefined;
    valid_to?: string | null | undefined;
    is_active?: boolean | undefined;
    cost_center_type?: string | null | undefined;
    responsible_id?: string | null | undefined;
    budget_annual_eur?: number | null | undefined;
    budget_headcount?: number | null | undefined;
    gl_account?: string | null | undefined;
}>;
export declare const createContractSchema: z.ZodObject<{
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["tempo_indeterminato", "tempo_determinato", "apprendistato", "somministrazione", "collaborazione"]>;
    contractCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    startDate: z.ZodString;
    endDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    probationEndDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    ccnlType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    ccnlLevel: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    grossAnnualSalary: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodString>;
    salaryType: z.ZodOptional<z.ZodString>;
    paymentFrequency: z.ZodOptional<z.ZodString>;
    workHoursWeekly: z.ZodOptional<z.ZodNumber>;
    workScheduleType: z.ZodOptional<z.ZodString>;
    partTimePercentage: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    jobTitle: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    jobDescription: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    orgUnitId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    locationId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    costCenterId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodString>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    startDate: string;
    contractType: "tempo_indeterminato" | "tempo_determinato" | "apprendistato" | "somministrazione" | "collaborazione";
    status?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    orgUnitId?: string | null | undefined;
    ccnlType?: string | null | undefined;
    endDate?: string | null | undefined;
    notes?: string | null | undefined;
    contractCode?: string | null | undefined;
    probationEndDate?: string | null | undefined;
    ccnlLevel?: string | null | undefined;
    grossAnnualSalary?: number | null | undefined;
    currency?: string | undefined;
    salaryType?: string | undefined;
    paymentFrequency?: string | undefined;
    workHoursWeekly?: number | undefined;
    workScheduleType?: string | undefined;
    partTimePercentage?: number | null | undefined;
    jobTitle?: string | null | undefined;
    jobDescription?: string | null | undefined;
    locationId?: string | null | undefined;
    costCenterId?: string | null | undefined;
}, {
    employeeId: string;
    startDate: string;
    contractType: "tempo_indeterminato" | "tempo_determinato" | "apprendistato" | "somministrazione" | "collaborazione";
    status?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    orgUnitId?: string | null | undefined;
    ccnlType?: string | null | undefined;
    endDate?: string | null | undefined;
    notes?: string | null | undefined;
    contractCode?: string | null | undefined;
    probationEndDate?: string | null | undefined;
    ccnlLevel?: string | null | undefined;
    grossAnnualSalary?: number | null | undefined;
    currency?: string | undefined;
    salaryType?: string | undefined;
    paymentFrequency?: string | undefined;
    workHoursWeekly?: number | undefined;
    workScheduleType?: string | undefined;
    partTimePercentage?: number | null | undefined;
    jobTitle?: string | null | undefined;
    jobDescription?: string | null | undefined;
    locationId?: string | null | undefined;
    costCenterId?: string | null | undefined;
}>;
export declare const updateContractSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    orgUnitId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    ccnlType: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    contractType: z.ZodOptional<z.ZodEnum<["tempo_indeterminato", "tempo_determinato", "apprendistato", "somministrazione", "collaborazione"]>>;
    contractCode: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    probationEndDate: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    ccnlLevel: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    grossAnnualSalary: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    currency: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    salaryType: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    paymentFrequency: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    workHoursWeekly: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    workScheduleType: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    partTimePercentage: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    jobDescription: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    locationId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    costCenterId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    terminationDate: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    terminationReason: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    orgUnitId?: string | null | undefined;
    ccnlType?: string | null | undefined;
    startDate?: string | undefined;
    endDate?: string | null | undefined;
    notes?: string | null | undefined;
    contractType?: "tempo_indeterminato" | "tempo_determinato" | "apprendistato" | "somministrazione" | "collaborazione" | undefined;
    contractCode?: string | null | undefined;
    probationEndDate?: string | null | undefined;
    ccnlLevel?: string | null | undefined;
    grossAnnualSalary?: number | null | undefined;
    currency?: string | undefined;
    salaryType?: string | undefined;
    paymentFrequency?: string | undefined;
    workHoursWeekly?: number | undefined;
    workScheduleType?: string | undefined;
    partTimePercentage?: number | null | undefined;
    jobTitle?: string | null | undefined;
    jobDescription?: string | null | undefined;
    locationId?: string | null | undefined;
    costCenterId?: string | null | undefined;
    terminationDate?: string | null | undefined;
    terminationReason?: string | null | undefined;
}, {
    status?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    orgUnitId?: string | null | undefined;
    ccnlType?: string | null | undefined;
    startDate?: string | undefined;
    endDate?: string | null | undefined;
    notes?: string | null | undefined;
    contractType?: "tempo_indeterminato" | "tempo_determinato" | "apprendistato" | "somministrazione" | "collaborazione" | undefined;
    contractCode?: string | null | undefined;
    probationEndDate?: string | null | undefined;
    ccnlLevel?: string | null | undefined;
    grossAnnualSalary?: number | null | undefined;
    currency?: string | undefined;
    salaryType?: string | undefined;
    paymentFrequency?: string | undefined;
    workHoursWeekly?: number | undefined;
    workScheduleType?: string | undefined;
    partTimePercentage?: number | null | undefined;
    jobTitle?: string | null | undefined;
    jobDescription?: string | null | undefined;
    locationId?: string | null | undefined;
    costCenterId?: string | null | undefined;
    terminationDate?: string | null | undefined;
    terminationReason?: string | null | undefined;
}>;
export declare const terminateContractSchema: z.ZodObject<{
    terminationDate: z.ZodString;
    terminationReason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    terminationDate: string;
    terminationReason?: string | null | undefined;
}, {
    terminationDate: string;
    terminationReason?: string | null | undefined;
}>;
export declare const createAmendmentSchema: z.ZodObject<{
    amendmentType: z.ZodEnum<["salary_change", "role_change", "schedule_change", "renewal", "promotion", "transfer", "other"]>;
    effectiveDate: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    previousValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    newValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    effectiveDate: string;
    amendmentType: "salary_change" | "role_change" | "schedule_change" | "renewal" | "promotion" | "transfer" | "other";
    description?: string | null | undefined;
    previousValues?: Record<string, unknown> | undefined;
    newValues?: Record<string, unknown> | undefined;
}, {
    effectiveDate: string;
    amendmentType: "salary_change" | "role_change" | "schedule_change" | "renewal" | "promotion" | "transfer" | "other";
    description?: string | null | undefined;
    previousValues?: Record<string, unknown> | undefined;
    newValues?: Record<string, unknown> | undefined;
}>;
//# sourceMappingURL=employees.d.ts.map