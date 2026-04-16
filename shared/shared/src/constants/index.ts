/**
 * @heuresys/shared - Constants
 * Shared constants used across all Heuresys platform services
 */

// =============================================================================
// ITALIAN HR CONSTANTS
// =============================================================================

/**
 * Italian CCNL (Contratto Collettivo Nazionale di Lavoro) types
 */
export const CCNL_TYPES = {
  METALMECCANICO_INDUSTRIA: 'metalmeccanico_industria',
  METALMECCANICO_PMI: 'metalmeccanico_pmi',
  COMMERCIO: 'commercio',
  TERZIARIO: 'terziario',
  TURISMO: 'turismo',
  CHIMICO: 'chimico',
  ALIMENTARE: 'alimentare',
  EDILIZIA: 'edilizia',
  TRASPORTI: 'trasporti',
  CUSTOM: 'custom',
} as const;

export type CCNLType = typeof CCNL_TYPES[keyof typeof CCNL_TYPES];

/**
 * Default leave accrual rates per CCNL (days per year)
 */
export const CCNL_LEAVE_DEFAULTS: Record<CCNLType, {
  ferie: number;
  rol: number;
  exFestivita: number;
}> = {
  [CCNL_TYPES.METALMECCANICO_INDUSTRIA]: { ferie: 26, rol: 104, exFestivita: 32 }, // ROL in hours
  [CCNL_TYPES.METALMECCANICO_PMI]: { ferie: 26, rol: 72, exFestivita: 32 },
  [CCNL_TYPES.COMMERCIO]: { ferie: 26, rol: 56, exFestivita: 32 },
  [CCNL_TYPES.TERZIARIO]: { ferie: 26, rol: 56, exFestivita: 32 },
  [CCNL_TYPES.TURISMO]: { ferie: 26, rol: 32, exFestivita: 32 },
  [CCNL_TYPES.CHIMICO]: { ferie: 26, rol: 80, exFestivita: 32 },
  [CCNL_TYPES.ALIMENTARE]: { ferie: 26, rol: 72, exFestivita: 32 },
  [CCNL_TYPES.EDILIZIA]: { ferie: 22, rol: 88, exFestivita: 32 },
  [CCNL_TYPES.TRASPORTI]: { ferie: 26, rol: 64, exFestivita: 32 },
  [CCNL_TYPES.CUSTOM]: { ferie: 26, rol: 56, exFestivita: 32 },
};

/**
 * Italian public holidays (fixed dates)
 */
export const ITALIAN_HOLIDAYS = [
  { date: '01-01', name: 'Capodanno' },
  { date: '01-06', name: 'Epifania' },
  { date: '04-25', name: 'Liberazione' },
  { date: '05-01', name: 'Festa dei lavoratori' },
  { date: '06-02', name: 'Festa della Repubblica' },
  { date: '08-15', name: 'Ferragosto' },
  { date: '11-01', name: 'Ognissanti' },
  { date: '12-08', name: 'Immacolata' },
  { date: '12-25', name: 'Natale' },
  { date: '12-26', name: 'Santo Stefano' },
] as const;

/**
 * Leave types
 */
export const LEAVE_TYPES = {
  FERIE: 'ferie',
  ROL: 'rol',
  EX_FESTIVITA: 'ex_festivita',
  MALATTIA: 'malattia',
  PERMESSO_LUTTO: 'permesso_lutto',
  PERMESSO_MATRIMONIO: 'permesso_matrimonio',
  PERMESSO_NASCITA: 'permesso_nascita',
  PERMESSO_STUDIO: 'permesso_studio',
  MATERNITA: 'maternita',
  PATERNITA: 'paternita',
  CONGEDO_PARENTALE: 'congedo_parentale',
  PERMESSO_104: 'permesso_104',
  ASPETTATIVA: 'aspettativa',
  ALTRO: 'altro',
} as const;

export type LeaveType = typeof LEAVE_TYPES[keyof typeof LEAVE_TYPES];

// =============================================================================
// USER ROLES & PERMISSIONS
// =============================================================================

/**
 * User roles hierarchy (lower number = higher privilege)
 * 8-role RBAC system as per RBAC Authorization Matrix
 *
 * Current DB values: SUPERUSER, TENANT_OWNER, HR, USER, DEMO
 * Legacy aliases: ADMIN/TENANT_ADMIN/SYSADMIN→TENANT_OWNER(0), HR→HR_MANAGER(3),
 *   USER→EMPLOYEE(6), DEMO→EMPLOYEE(6)
 */
/** @deprecated P9: Use RBPCacheService instead. Kept for backward compatibility. */
export const USER_ROLE_HIERARCHY = {
  SUPERUSER: -1,     // Platform god-role - Cross-tenant
  TENANT_OWNER: 0,   // Tenant Owner (CEO/DG) - Read-only full visibility
  IT_ADMIN: 1,       // IT Director - Team + IT configuration
  HR_DIRECTOR: 2,    // HR Strategic - All employees
  HR_MANAGER: 3,     // HR Operational - All employees (limited strategic)
  DEPT_HEAD: 4,      // Department Head - Department scope
  LINE_MANAGER: 5,   // Team Manager - Direct reports
  EMPLOYEE: 6,       // Standard Employee - Self only
} as const;

/**
 * Permission strings
 */
export const PERMISSIONS = {
  // Platform
  PLATFORM_ADMIN: 'platform:admin',

  // Tenant
  TENANT_VIEW: 'tenant:view',
  TENANT_CONFIGURE: 'tenant:configure',

  // Users
  USERS_VIEW_OWN: 'users:view:own',
  USERS_VIEW_ALL: 'users:view:all',
  USERS_MANAGE: 'users:manage',

  // Employees
  EMPLOYEES_VIEW_OWN: 'employees:view:own',
  EMPLOYEES_VIEW_TEAM: 'employees:view:team',
  EMPLOYEES_VIEW_ALL: 'employees:view:all',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_UPDATE: 'employees:update',
  EMPLOYEES_DELETE: 'employees:delete',

  // Leave
  LEAVE_VIEW_OWN: 'leave:view:own',
  LEAVE_VIEW_TEAM: 'leave:view:team',
  LEAVE_VIEW_ALL: 'leave:view:all',
  LEAVE_REQUEST: 'leave:request',
  LEAVE_APPROVE: 'leave:approve',
  LEAVE_CONFIGURE: 'leave:configure',

  // Reports
  REPORTS_VIEW_TEAM: 'reports:view:team',
  REPORTS_VIEW_ALL: 'reports:view:all',
  REPORTS_EXPORT: 'reports:export',

  // AI
  AI_QUERY: 'ai:query',
  AI_CONFIGURE: 'ai:configure',

  // Documents
  DOCUMENTS_VIEW_OWN: 'documents:view:own',
  DOCUMENTS_VIEW_ALL: 'documents:view:all',
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_DELETE: 'documents:delete',

  // Audit
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role-Permission mapping
 */
/** @deprecated P9: Use RBPCacheService instead. Kept for backward compatibility. */
export const ROLE_PERMISSIONS: Record<keyof typeof USER_ROLE_HIERARCHY, Permission[]> = {
  SUPERUSER: Object.values(PERMISSIONS),
  TENANT_OWNER: [
    // CEO/DG read-only: VIEW + EXPORT on all areas, zero write
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.USERS_VIEW_ALL,
    PERMISSIONS.EMPLOYEES_VIEW_ALL,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.DOCUMENTS_VIEW_ALL,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],
  IT_ADMIN: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.USERS_VIEW_ALL,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.EMPLOYEES_VIEW_OWN,
    PERMISSIONS.EMPLOYEES_VIEW_TEAM,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_TEAM,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.REPORTS_VIEW_TEAM,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.AI_CONFIGURE,
    PERMISSIONS.DOCUMENTS_VIEW_OWN,
    PERMISSIONS.AUDIT_VIEW,
  ],
  HR_DIRECTOR: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.USERS_VIEW_ALL,
    PERMISSIONS.EMPLOYEES_VIEW_ALL,
    PERMISSIONS.EMPLOYEES_CREATE,
    PERMISSIONS.EMPLOYEES_UPDATE,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.AI_CONFIGURE,
    PERMISSIONS.DOCUMENTS_VIEW_ALL,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.AUDIT_VIEW,
  ],
  HR_MANAGER: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW_ALL,
    PERMISSIONS.EMPLOYEES_CREATE,
    PERMISSIONS.EMPLOYEES_UPDATE,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.DOCUMENTS_VIEW_ALL,
    PERMISSIONS.DOCUMENTS_UPLOAD,
  ],
  DEPT_HEAD: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW_OWN,
    PERMISSIONS.EMPLOYEES_VIEW_TEAM,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_TEAM,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW_TEAM,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.DOCUMENTS_VIEW_OWN,
  ],
  LINE_MANAGER: [
    PERMISSIONS.EMPLOYEES_VIEW_OWN,
    PERMISSIONS.EMPLOYEES_VIEW_TEAM,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_TEAM,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW_TEAM,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.DOCUMENTS_VIEW_OWN,
  ],
  EMPLOYEE: [
    PERMISSIONS.EMPLOYEES_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.DOCUMENTS_VIEW_OWN,
  ],
};

// =============================================================================
// API CONSTANTS
// =============================================================================

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// =============================================================================
// RATE LIMITING
// =============================================================================

export const RATE_LIMITS = {
  LOGIN: { windowMs: 60000, max: 5 }, // 5 attempts per minute
  API: { windowMs: 60000, max: 100 }, // 100 requests per minute
  AI: { windowMs: 60000, max: 20 }, // 20 AI queries per minute
  EXPORT: { windowMs: 3600000, max: 10 }, // 10 exports per hour
} as const;

// =============================================================================
// JWT CONSTANTS
// =============================================================================

export const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  ALGORITHM: 'RS256',
} as const;

// =============================================================================
// VALIDATION
// =============================================================================

export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 12,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 100,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  CODE_MAX_LENGTH: 50,
} as const;
