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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Token payload type (matches JWTPayload from auth middleware)
// ---------------------------------------------------------------------------

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
  employeeId?: string;
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// Default UUIDs (stable, realistic UUIDs for test reproducibility)
// ---------------------------------------------------------------------------

const DEFAULT_TENANT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DEFAULT_EMPLOYEE_ID = '11111111-2222-4333-a444-555555555555';
const DEFAULT_DEPARTMENT_ID = '22222222-3333-4444-a555-666666666666';
const DEFAULT_GOAL_ID = '33333333-4444-5555-a666-777777777777';
const DEFAULT_USER_ID = '44444444-5555-6666-a777-888888888888';

// ---------------------------------------------------------------------------
// Counters for unique data generation
// ---------------------------------------------------------------------------

let employeeCounter = 0;
let tenantCounter = 0;
let orgUnitCounter = 0;
let goalCounter = 0;
let userCounter = 0;

/**
 * Reset all factory counters. Call in beforeEach() if tests need
 * deterministic sequences.
 */
export function resetFactories(): void {
  employeeCounter = 0;
  tenantCounter = 0;
  orgUnitCounter = 0;
  goalCounter = 0;
  userCounter = 0;
}

// ---------------------------------------------------------------------------
// Factory: Employee
// ---------------------------------------------------------------------------

const EMPLOYEE_NAMES = [
  { first: 'Mario', last: 'Rossi' },
  { first: 'Lucia', last: 'Bianchi' },
  { first: 'Marco', last: 'Verdi' },
  { first: 'Giulia', last: 'Colombo' },
  { first: 'Andrea', last: 'Ferrari' },
  { first: 'Francesca', last: 'Romano' },
  { first: 'Alessandro', last: 'Conti' },
  { first: 'Chiara', last: 'Esposito' },
  { first: 'Luca', last: 'Ricci' },
  { first: 'Elena', last: 'Moretti' },
];

const JOB_TITLES = [
  'Software Developer',
  'HR Manager',
  'Data Analyst',
  'Senior Developer',
  'Financial Analyst',
  'Project Manager',
  'UX Designer',
  'Business Analyst',
  'DevOps Engineer',
  'Product Manager',
];

export function buildEmployee(overrides: Partial<EmployeeData> = {}): EmployeeData {
  const idx = employeeCounter++ % EMPLOYEE_NAMES.length;
  const name = EMPLOYEE_NAMES[idx]!;
  const emailLocal = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;

  return {
    id: DEFAULT_EMPLOYEE_ID,
    tenant_id: DEFAULT_TENANT_ID,
    first_name: name.first,
    last_name: name.last,
    email: `${emailLocal}@rtl-bank.com`,
    job_title: JOB_TITLES[idx % JOB_TITLES.length]!,
    department: 'IT',
    department_name: 'IT',
    org_unit_id: null,
    org_unit_name: null,
    manager_id: null,
    manager_first_name: null,
    manager_last_name: null,
    cost_center_id: null,
    cost_center_name: null,
    location_id: null,
    location_name: 'Milano',
    hire_date: '2020-03-15',
    employment_status: 'active',
    is_active: true,
    created_at: '2020-03-15T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Build a list of employees with sequential data.
 */
export function buildEmployeeList(
  count: number,
  overrides: Partial<EmployeeData> = {}
): EmployeeData[] {
  return Array.from({ length: count }, () => buildEmployee(overrides));
}

// ---------------------------------------------------------------------------
// Factory: Tenant
// ---------------------------------------------------------------------------

const TENANT_PRESETS = [
  {
    code: 'rtl-bank',
    name: 'RTL Bank',
    industry: 'Banking',
    plan: 'professional',
    count: 200,
    nace: '6419',
  },
  {
    code: 'heuresys',
    name: 'Heuresys System',
    industry: 'IT',
    plan: 'enterprise',
    count: 10,
    nace: '6201',
  },
  {
    code: 'smartfood',
    name: 'SmartFood S.r.l.',
    industry: 'Food',
    plan: 'professional',
    count: 150,
    nace: '1071',
  },
  {
    code: 'econova',
    name: 'EcoNova',
    industry: 'Energy',
    plan: 'enterprise',
    count: 80,
    nace: '3511',
  },
];

export function buildTenant(overrides: Partial<TenantData> = {}): TenantData {
  const idx = tenantCounter++ % TENANT_PRESETS.length;
  const preset = TENANT_PRESETS[idx]!;

  return {
    id: DEFAULT_TENANT_ID,
    code: preset.code,
    name: preset.name,
    description: null,
    nace_code: preset.nace,
    region: 'EU',
    status: 'active',
    subscription_plan: preset.plan,
    industry_type: preset.industry,
    sap_company_code: null,
    annual_revenue_eur: null,
    employee_count: preset.count,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: OrgUnit
// ---------------------------------------------------------------------------

const DEPARTMENT_PRESETS = [
  { name: 'Information Technology', code: 'IT' },
  { name: 'Human Resources', code: 'HR' },
  { name: 'Finance', code: 'FIN' },
  { name: 'Operations', code: 'OPS' },
  { name: 'Marketing', code: 'MKT' },
  { name: 'Legal & Compliance', code: 'LGL' },
  { name: 'Risk Management', code: 'RISK' },
  { name: 'Customer Relations', code: 'CRM' },
];

export function buildDepartment(overrides: Partial<DepartmentData> = {}): DepartmentData {
  const idx = orgUnitCounter++ % DEPARTMENT_PRESETS.length;
  const preset = DEPARTMENT_PRESETS[idx]!;

  return {
    id: DEFAULT_DEPARTMENT_ID,
    tenant_id: DEFAULT_TENANT_ID,
    name: preset.name,
    code: preset.code,
    description: null,
    parent_id: null,
    head_employee_id: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Goal
// ---------------------------------------------------------------------------

const GOAL_PRESETS = [
  { title: 'Complete Q1 Sales Targets', category: 'performance', priority: 'high' },
  { title: 'Improve Customer Satisfaction Score', category: 'quality', priority: 'high' },
  { title: 'Complete Security Certification', category: 'development', priority: 'medium' },
  { title: 'Reduce Operational Costs by 10%', category: 'performance', priority: 'high' },
  { title: 'Launch New Employee Portal', category: 'project', priority: 'medium' },
  { title: 'Complete Leadership Training', category: 'development', priority: 'low' },
];

export function buildGoal(overrides: Partial<GoalData> = {}): GoalData {
  const idx = goalCounter++ % GOAL_PRESETS.length;
  const preset = GOAL_PRESETS[idx]!;

  return {
    id: DEFAULT_GOAL_ID,
    tenant_id: DEFAULT_TENANT_ID,
    employee_id: DEFAULT_EMPLOYEE_ID,
    title: preset.title,
    description: null,
    category: preset.category,
    status: 'in_progress',
    priority: preset.priority,
    start_date: '2025-01-01',
    due_date: '2025-06-30',
    completion_percentage: 0,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: User
// ---------------------------------------------------------------------------

const USER_PRESETS = [
  { username: 'sysadmin', role: 'SYSADMIN', permissions: ['platform:admin'] },
  { username: 'admin', role: 'ADMIN', permissions: ['tenant:view', 'tenant:configure'] },
  { username: 'hr.manager', role: 'HR_MANAGER', permissions: ['employees:view', 'employees:edit'] },
  { username: 'employee', role: 'EMPLOYEE', permissions: ['employees:view:own'] },
  { username: 'dept.head', role: 'DEPT_HEAD', permissions: ['employees:view', 'departments:view'] },
];

export function buildUser(overrides: Partial<UserData> = {}): UserData {
  const idx = userCounter++ % USER_PRESETS.length;
  const preset = USER_PRESETS[idx]!;

  return {
    id: DEFAULT_USER_ID,
    tenant_id: DEFAULT_TENANT_ID,
    username: preset.username,
    password_hash: '$2b$10$fakehashforunitestingpurposes000000000000000000',
    role: preset.role,
    permissions: preset.permissions,
    is_active: true,
    last_login: null,
    employee_id: DEFAULT_EMPLOYEE_ID,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Token Payloads (for auth middleware tests)
// ---------------------------------------------------------------------------

export function buildTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: DEFAULT_USER_ID,
    username: 'testuser',
    role: 'EMPLOYEE',
    permissions: [],
    ...overrides,
  };
}

export function buildSysadminTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-uuid-1',
    username: 'sysadmin',
    role: 'SYSADMIN',
    permissions: ['platform:admin'],
    employeeId: 'emp-uuid-1',
    tenantId: DEFAULT_TENANT_ID,
    ...overrides,
  };
}

/**
 * Build a SUPERUSER token payload (god-role, cross-tenant, migration 109+).
 * Use this for platform-wide endpoints that require requireRole('SUPERUSER').
 */
export function buildSuperuserTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-uuid-0',
    username: 'superuser',
    role: 'SUPERUSER',
    permissions: ['platform:admin'],
    employeeId: 'emp-uuid-0',
    tenantId: DEFAULT_TENANT_ID,
    ...overrides,
  };
}

export function buildAdminTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-uuid-2',
    username: 'admin',
    role: 'ADMIN',
    permissions: ['tenant:view', 'tenant:configure'],
    employeeId: 'emp-uuid-2',
    tenantId: DEFAULT_TENANT_ID,
    ...overrides,
  };
}

export function buildEmployeeTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-uuid-3',
    username: 'employee',
    role: 'EMPLOYEE',
    permissions: ['employees:view:own'],
    employeeId: 'emp-uuid-3',
    tenantId: DEFAULT_TENANT_ID,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Re-export default IDs for convenience
// ---------------------------------------------------------------------------

export const DEFAULT_IDS = {
  TENANT_ID: DEFAULT_TENANT_ID,
  EMPLOYEE_ID: DEFAULT_EMPLOYEE_ID,
  DEPARTMENT_ID: DEFAULT_DEPARTMENT_ID,
  GOAL_ID: DEFAULT_GOAL_ID,
  USER_ID: DEFAULT_USER_ID,
} as const;
