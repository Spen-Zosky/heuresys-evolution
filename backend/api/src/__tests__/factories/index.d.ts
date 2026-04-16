/**
 * Test Data Factories
 *
 * Provides factory functions for creating realistic test data objects
 * matching the Heuresys platform schema. Each factory returns sensible
 * defaults and accepts partial overrides.
 *
 * Data uses Italian names and realistic values consistent with the
 * RTL Bank tenant and Heuresys platform conventions.
 */
export interface EmployeeData {
    id: string;
    tenant_id: string;
    first_name: string;
    last_name: string;
    email: string;
    job_title: string;
    department: string;
    department_name: string | null;
    org_unit_id: string | null;
    org_unit_name: string | null;
    manager_id: string | null;
    manager_first_name: string | null;
    manager_last_name: string | null;
    cost_center_id: string | null;
    cost_center_name: string | null;
    location_id: string | null;
    location_name: string | null;
    hire_date: string;
    employment_status: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface TenantData {
    id: string;
    code: string;
    name: string;
    description: string | null;
    nace_code: string | null;
    region: string;
    status: string;
    subscription_plan: string;
    industry_type: string;
    sap_company_code: string | null;
    annual_revenue_eur: number | null;
    employee_count: number;
    created_at: string;
    updated_at: string;
}
export interface DepartmentData {
    id: string;
    tenant_id: string;
    name: string;
    code: string;
    description: string | null;
    parent_id: string | null;
    head_employee_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface GoalData {
    id: string;
    tenant_id: string;
    employee_id: string;
    title: string;
    description: string | null;
    category: string;
    status: string;
    priority: string;
    start_date: string;
    due_date: string;
    completion_percentage: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface UserData {
    id: string;
    tenant_id: string;
    username: string;
    password_hash: string;
    role: string;
    permissions: string[];
    is_active: boolean;
    last_login: string | null;
    employee_id: string | null;
    created_at: string;
    updated_at: string;
}
export interface TokenPayload {
    userId: string;
    username: string;
    role: string;
    permissions: string[];
    employeeId?: string;
    tenantId?: string;
}
/**
 * Reset all factory counters. Call in beforeEach() if tests need
 * deterministic sequences.
 */
export declare function resetFactories(): void;
export declare function buildEmployee(overrides?: Partial<EmployeeData>): EmployeeData;
/**
 * Build a list of employees with sequential data.
 */
export declare function buildEmployeeList(count: number, overrides?: Partial<EmployeeData>): EmployeeData[];
export declare function buildTenant(overrides?: Partial<TenantData>): TenantData;
export declare function buildDepartment(overrides?: Partial<DepartmentData>): DepartmentData;
export declare function buildGoal(overrides?: Partial<GoalData>): GoalData;
export declare function buildUser(overrides?: Partial<UserData>): UserData;
export declare function buildTokenPayload(overrides?: Partial<TokenPayload>): TokenPayload;
export declare function buildSysadminTokenPayload(overrides?: Partial<TokenPayload>): TokenPayload;
/**
 * Build a SUPERUSER token payload (god-role, cross-tenant, migration 109+).
 * Use this for platform-wide endpoints that require requireRole('SUPERUSER').
 */
export declare function buildSuperuserTokenPayload(overrides?: Partial<TokenPayload>): TokenPayload;
export declare function buildAdminTokenPayload(overrides?: Partial<TokenPayload>): TokenPayload;
export declare function buildEmployeeTokenPayload(overrides?: Partial<TokenPayload>): TokenPayload;
export declare const DEFAULT_IDS: {
    readonly TENANT_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    readonly EMPLOYEE_ID: "11111111-2222-4333-a444-555555555555";
    readonly DEPARTMENT_ID: "22222222-3333-4444-a555-666666666666";
    readonly GOAL_ID: "33333333-4444-5555-a666-777777777777";
    readonly USER_ID: "44444444-5555-6666-a777-888888888888";
};
//# sourceMappingURL=index.d.ts.map