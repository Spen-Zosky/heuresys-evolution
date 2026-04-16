/**
 * @heuresys/shared - Constants
 * Shared constants used across all Heuresys platform services
 */
/**
 * Italian CCNL (Contratto Collettivo Nazionale di Lavoro) types
 */
export declare const CCNL_TYPES: {
    readonly METALMECCANICO_INDUSTRIA: "metalmeccanico_industria";
    readonly METALMECCANICO_PMI: "metalmeccanico_pmi";
    readonly COMMERCIO: "commercio";
    readonly TERZIARIO: "terziario";
    readonly TURISMO: "turismo";
    readonly CHIMICO: "chimico";
    readonly ALIMENTARE: "alimentare";
    readonly EDILIZIA: "edilizia";
    readonly TRASPORTI: "trasporti";
    readonly CUSTOM: "custom";
};
export type CCNLType = typeof CCNL_TYPES[keyof typeof CCNL_TYPES];
/**
 * Default leave accrual rates per CCNL (days per year)
 */
export declare const CCNL_LEAVE_DEFAULTS: Record<CCNLType, {
    ferie: number;
    rol: number;
    exFestivita: number;
}>;
/**
 * Italian public holidays (fixed dates)
 */
export declare const ITALIAN_HOLIDAYS: readonly [{
    readonly date: "01-01";
    readonly name: "Capodanno";
}, {
    readonly date: "01-06";
    readonly name: "Epifania";
}, {
    readonly date: "04-25";
    readonly name: "Liberazione";
}, {
    readonly date: "05-01";
    readonly name: "Festa dei lavoratori";
}, {
    readonly date: "06-02";
    readonly name: "Festa della Repubblica";
}, {
    readonly date: "08-15";
    readonly name: "Ferragosto";
}, {
    readonly date: "11-01";
    readonly name: "Ognissanti";
}, {
    readonly date: "12-08";
    readonly name: "Immacolata";
}, {
    readonly date: "12-25";
    readonly name: "Natale";
}, {
    readonly date: "12-26";
    readonly name: "Santo Stefano";
}];
/**
 * Leave types
 */
export declare const LEAVE_TYPES: {
    readonly FERIE: "ferie";
    readonly ROL: "rol";
    readonly EX_FESTIVITA: "ex_festivita";
    readonly MALATTIA: "malattia";
    readonly PERMESSO_LUTTO: "permesso_lutto";
    readonly PERMESSO_MATRIMONIO: "permesso_matrimonio";
    readonly PERMESSO_NASCITA: "permesso_nascita";
    readonly PERMESSO_STUDIO: "permesso_studio";
    readonly MATERNITA: "maternita";
    readonly PATERNITA: "paternita";
    readonly CONGEDO_PARENTALE: "congedo_parentale";
    readonly PERMESSO_104: "permesso_104";
    readonly ASPETTATIVA: "aspettativa";
    readonly ALTRO: "altro";
};
export type LeaveType = typeof LEAVE_TYPES[keyof typeof LEAVE_TYPES];
/**
 * User roles hierarchy (lower number = higher privilege)
 * 8-role RBAC system as per RBAC Authorization Matrix
 *
 * Current DB values: SUPERUSER, TENANT_OWNER, HR, USER, DEMO
 * Legacy aliases: ADMIN/TENANT_ADMIN/SYSADMIN→TENANT_OWNER(0), HR→HR_MANAGER(3),
 *   USER→EMPLOYEE(6), DEMO→EMPLOYEE(6)
 */
/** @deprecated P9: Use RBPCacheService instead. Kept for backward compatibility. */
export declare const USER_ROLE_HIERARCHY: {
    readonly SUPERUSER: -1;
    readonly TENANT_OWNER: 0;
    readonly IT_ADMIN: 1;
    readonly HR_DIRECTOR: 2;
    readonly HR_MANAGER: 3;
    readonly DEPT_HEAD: 4;
    readonly LINE_MANAGER: 5;
    readonly EMPLOYEE: 6;
};
/**
 * Permission strings
 */
export declare const PERMISSIONS: {
    readonly PLATFORM_ADMIN: "platform:admin";
    readonly TENANT_VIEW: "tenant:view";
    readonly TENANT_CONFIGURE: "tenant:configure";
    readonly USERS_VIEW_OWN: "users:view:own";
    readonly USERS_VIEW_ALL: "users:view:all";
    readonly USERS_MANAGE: "users:manage";
    readonly EMPLOYEES_VIEW_OWN: "employees:view:own";
    readonly EMPLOYEES_VIEW_TEAM: "employees:view:team";
    readonly EMPLOYEES_VIEW_ALL: "employees:view:all";
    readonly EMPLOYEES_CREATE: "employees:create";
    readonly EMPLOYEES_UPDATE: "employees:update";
    readonly EMPLOYEES_DELETE: "employees:delete";
    readonly LEAVE_VIEW_OWN: "leave:view:own";
    readonly LEAVE_VIEW_TEAM: "leave:view:team";
    readonly LEAVE_VIEW_ALL: "leave:view:all";
    readonly LEAVE_REQUEST: "leave:request";
    readonly LEAVE_APPROVE: "leave:approve";
    readonly LEAVE_CONFIGURE: "leave:configure";
    readonly REPORTS_VIEW_TEAM: "reports:view:team";
    readonly REPORTS_VIEW_ALL: "reports:view:all";
    readonly REPORTS_EXPORT: "reports:export";
    readonly AI_QUERY: "ai:query";
    readonly AI_CONFIGURE: "ai:configure";
    readonly DOCUMENTS_VIEW_OWN: "documents:view:own";
    readonly DOCUMENTS_VIEW_ALL: "documents:view:all";
    readonly DOCUMENTS_UPLOAD: "documents:upload";
    readonly DOCUMENTS_DELETE: "documents:delete";
    readonly AUDIT_VIEW: "audit:view";
    readonly AUDIT_EXPORT: "audit:export";
};
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
/**
 * Role-Permission mapping
 */
/** @deprecated P9: Use RBPCacheService instead. Kept for backward compatibility. */
export declare const ROLE_PERMISSIONS: Record<keyof typeof USER_ROLE_HIERARCHY, Permission[]>;
export declare const API_VERSION = "v1";
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE_ENTITY: 422;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const RATE_LIMITS: {
    readonly LOGIN: {
        readonly windowMs: 60000;
        readonly max: 5;
    };
    readonly API: {
        readonly windowMs: 60000;
        readonly max: 100;
    };
    readonly AI: {
        readonly windowMs: 60000;
        readonly max: 20;
    };
    readonly EXPORT: {
        readonly windowMs: 3600000;
        readonly max: 10;
    };
};
export declare const JWT_CONFIG: {
    readonly ACCESS_TOKEN_EXPIRY: "15m";
    readonly REFRESH_TOKEN_EXPIRY: "7d";
    readonly ALGORITHM: "RS256";
};
export declare const VALIDATION: {
    readonly PASSWORD_MIN_LENGTH: 12;
    readonly USERNAME_MIN_LENGTH: 3;
    readonly USERNAME_MAX_LENGTH: 100;
    readonly NAME_MAX_LENGTH: 100;
    readonly EMAIL_MAX_LENGTH: 255;
    readonly CODE_MAX_LENGTH: 50;
};
//# sourceMappingURL=index.d.ts.map