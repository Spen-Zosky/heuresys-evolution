/**
 * Heuresys Error Handling System - Type Definitions
 *
 * Sistema di gestione errori strutturato per debugging avanzato
 * Copre: API, Database, Validation, Auth, Business Logic, Integration
 */
export type ErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
export declare const SeverityConfig: Record<ErrorSeverity, {
    level: number;
    shouldAlert: boolean;
    shouldLog: boolean;
    shouldNotifyUser: boolean;
}>;
export type ErrorCategory = 'API' | 'AUTH' | 'DB' | 'VALIDATION' | 'BUSINESS' | 'INTEGRATION' | 'NETWORK' | 'RESOURCE' | 'RATE_LIMIT' | 'TENANT' | 'CONFIG' | 'PERMISSION' | 'SYSTEM' | 'AI' | 'INTERNAL';
export declare const ErrorCodes: {
    readonly API: {
        readonly UNKNOWN: "ERR-API-1000";
        readonly BAD_REQUEST: "ERR-API-1001";
        readonly INVALID_REQUEST: "ERR-API-1001";
        readonly INVALID_CONTENT_TYPE: "ERR-API-1002";
        readonly MISSING_REQUIRED_FIELD: "ERR-API-1003";
        readonly INVALID_JSON: "ERR-API-1004";
        readonly NOT_FOUND: "ERR-API-1005";
        readonly ROUTE_NOT_FOUND: "ERR-API-1005";
        readonly METHOD_NOT_ALLOWED: "ERR-API-1006";
        readonly PAYLOAD_TOO_LARGE: "ERR-API-1007";
        readonly TIMEOUT: "ERR-API-1008";
        readonly CONFLICT: "ERR-API-1009";
        readonly SERVICE_UNAVAILABLE: "ERR-API-1010";
        readonly RATE_LIMITED: "ERR-API-1011";
    };
    readonly AUTH: {
        readonly UNKNOWN: "ERR-AUTH-2000";
        readonly UNAUTHORIZED: "ERR-AUTH-2001";
        readonly INVALID_CREDENTIALS: "ERR-AUTH-2001";
        readonly TOKEN_EXPIRED: "ERR-AUTH-2002";
        readonly TOKEN_INVALID: "ERR-AUTH-2003";
        readonly TOKEN_MISSING: "ERR-AUTH-2004";
        readonly REFRESH_TOKEN_EXPIRED: "ERR-AUTH-2005";
        readonly REFRESH_TOKEN_INVALID: "ERR-AUTH-2006";
        readonly INSUFFICIENT_PERMISSIONS: "ERR-AUTH-2007";
        readonly ACCOUNT_LOCKED: "ERR-AUTH-2008";
        readonly ACCOUNT_DISABLED: "ERR-AUTH-2009";
        readonly SESSION_EXPIRED: "ERR-AUTH-2010";
        readonly MFA_REQUIRED: "ERR-AUTH-2011";
        readonly MFA_INVALID: "ERR-AUTH-2012";
        readonly PASSWORD_EXPIRED: "ERR-AUTH-2013";
    };
    readonly DB: {
        readonly UNKNOWN: "ERR-DB-3000";
        readonly CONNECTION_FAILED: "ERR-DB-3001";
        readonly CONNECTION_ERROR: "ERR-DB-3001";
        readonly CONNECTION_TIMEOUT: "ERR-DB-3002";
        readonly QUERY_FAILED: "ERR-DB-3003";
        readonly QUERY_ERROR: "ERR-DB-3003";
        readonly CONSTRAINT_VIOLATION: "ERR-DB-3004";
        readonly UNIQUE_VIOLATION: "ERR-DB-3005";
        readonly FOREIGN_KEY_VIOLATION: "ERR-DB-3006";
        readonly NOT_NULL_VIOLATION: "ERR-DB-3007";
        readonly NULL_VIOLATION: "ERR-DB-3007";
        readonly CHECK_VIOLATION: "ERR-DB-3008";
        readonly DEADLOCK: "ERR-DB-3009";
        readonly TRANSACTION_FAILED: "ERR-DB-3010";
        readonly TRANSACTION_ERROR: "ERR-DB-3010";
        readonly POOL_EXHAUSTED: "ERR-DB-3011";
        readonly INVALID_QUERY: "ERR-DB-3012";
        readonly SCHEMA_MISMATCH: "ERR-DB-3013";
        readonly MIGRATION_FAILED: "ERR-DB-3014";
        readonly RECORD_NOT_FOUND: "ERR-DB-3015";
        readonly DUPLICATE_RECORD: "ERR-DB-3016";
        readonly QUERY_SUCCESS: "ERR-DB-3017";
        readonly TRIGGER_ERROR: "ERR-DB-3018";
        readonly EXCLUSION_VIOLATION: "ERR-DB-3019";
        readonly SYNTAX_ERROR: "ERR-DB-3020";
        readonly UNDEFINED_COLUMN: "ERR-DB-3021";
        readonly UNDEFINED_TABLE: "ERR-DB-3022";
        readonly AMBIGUOUS_COLUMN: "ERR-DB-3023";
        readonly SERIALIZATION_FAILURE: "ERR-DB-3024";
        readonly SYSTEM_ERROR: "ERR-DB-3025";
        readonly INSUFFICIENT_RESOURCES: "ERR-DB-3026";
        readonly DISK_FULL: "ERR-DB-3027";
        readonly MEMORY_ERROR: "ERR-DB-3028";
        readonly CONNECTION_LIMIT: "ERR-DB-3029";
        readonly QUERY_TOO_COMPLEX: "ERR-DB-3030";
        readonly LOCK_NOT_AVAILABLE: "ERR-DB-3031";
        readonly QUERY_TIMEOUT: "ERR-DB-3032";
        readonly IO_ERROR: "ERR-DB-3033";
    };
    readonly VALIDATION: {
        readonly UNKNOWN: "ERR-VAL-4000";
        readonly VALIDATION_FAILED: "ERR-VAL-4001";
        readonly REQUIRED_FIELD: "ERR-VAL-4002";
        readonly INVALID_FORMAT: "ERR-VAL-4003";
        readonly INVALID_TYPE: "ERR-VAL-4004";
        readonly OUT_OF_RANGE: "ERR-VAL-4005";
        readonly INVALID_LENGTH: "ERR-VAL-4006";
        readonly INVALID_EMAIL: "ERR-VAL-4007";
        readonly INVALID_PHONE: "ERR-VAL-4008";
        readonly INVALID_DATE: "ERR-VAL-4009";
        readonly INVALID_UUID: "ERR-VAL-4010";
        readonly INVALID_ENUM: "ERR-VAL-4011";
        readonly INVALID_PATTERN: "ERR-VAL-4012";
        readonly ARRAY_TOO_SHORT: "ERR-VAL-4013";
        readonly ARRAY_TOO_LONG: "ERR-VAL-4014";
        readonly SCHEMA_VALIDATION_FAILED: "ERR-VAL-4015";
        readonly VALUE_TOO_LONG: "ERR-VAL-4016";
        readonly NULL_VIOLATION: "ERR-VAL-4017";
        readonly VALUE_OUT_OF_RANGE: "ERR-VAL-4018";
        readonly TYPE_MISMATCH: "ERR-VAL-4019";
        readonly INVALID_ENCODING: "ERR-VAL-4020";
    };
    readonly BUSINESS: {
        readonly UNKNOWN: "ERR-BIZ-5000";
        readonly RULE_VIOLATION: "ERR-BIZ-5001";
        readonly INVALID_STATE: "ERR-BIZ-5002";
        readonly OPERATION_NOT_PERMITTED: "ERR-BIZ-5003";
        readonly OPERATION_NOT_ALLOWED: "ERR-BIZ-5003";
        readonly RESOURCE_LOCKED: "ERR-BIZ-5004";
        readonly WORKFLOW_VIOLATION: "ERR-BIZ-5005";
        readonly DEPENDENCY_CONFLICT: "ERR-BIZ-5006";
        readonly QUOTA_EXCEEDED: "ERR-BIZ-5007";
        readonly DUPLICATE_OPERATION: "ERR-BIZ-5008";
        readonly STALE_DATA: "ERR-BIZ-5009";
        readonly APPROVAL_REQUIRED: "ERR-BIZ-5010";
        readonly POLICY_VIOLATION: "ERR-BIZ-5011";
        readonly AUDIT_REQUIRED: "ERR-BIZ-5012";
    };
    readonly INTEGRATION: {
        readonly UNKNOWN: "ERR-INT-6000";
        readonly SERVICE_UNAVAILABLE: "ERR-INT-6001";
        readonly TIMEOUT: "ERR-INT-6002";
        readonly INVALID_RESPONSE: "ERR-INT-6003";
        readonly AUTHENTICATION_FAILED: "ERR-INT-6004";
        readonly RATE_LIMITED: "ERR-INT-6005";
        readonly API_VERSION_MISMATCH: "ERR-INT-6006";
        readonly SAP_CONNECTION_FAILED: "ERR-INT-6007";
        readonly SAP_QUERY_FAILED: "ERR-INT-6008";
        readonly ESCO_API_FAILED: "ERR-INT-6009";
        readonly AI_PROVIDER_FAILED: "ERR-INT-6010";
        readonly EMBEDDING_FAILED: "ERR-INT-6011";
        readonly EXTERNAL_SERVICE_ERROR: "ERR-INT-6012";
    };
    readonly RESOURCE: {
        readonly UNKNOWN: "ERR-RES-7000";
        readonly NOT_FOUND: "ERR-RES-7001";
        readonly ALREADY_EXISTS: "ERR-RES-7002";
        readonly ACCESS_DENIED: "ERR-RES-7003";
        readonly DELETED: "ERR-RES-7004";
        readonly ARCHIVED: "ERR-RES-7005";
        readonly VERSION_CONFLICT: "ERR-RES-7006";
    };
    readonly PERMISSION: {
        readonly UNKNOWN: "ERR-PERM-7500";
        readonly ACCESS_DENIED: "ERR-PERM-7501";
        readonly INSUFFICIENT_ROLE: "ERR-PERM-7502";
        readonly RESOURCE_FORBIDDEN: "ERR-PERM-7503";
        readonly ACTION_NOT_ALLOWED: "ERR-PERM-7504";
    };
    readonly TENANT: {
        readonly UNKNOWN: "ERR-TEN-8000";
        readonly TENANT_REQUIRED: "ERR-TEN-8001";
        readonly TENANT_NOT_FOUND: "ERR-TEN-8002";
        readonly NOT_FOUND: "ERR-TEN-8002";
        readonly TENANT_INACTIVE: "ERR-TEN-8003";
        readonly INACTIVE: "ERR-TEN-8003";
        readonly SUSPENDED: "ERR-TEN-8004";
        readonly HEADER_MISSING: "ERR-TEN-8005";
        readonly CROSS_TENANT_ACCESS: "ERR-TEN-8006";
        readonly LICENSE_EXPIRED: "ERR-TEN-8007";
        readonly FEATURE_NOT_ENABLED: "ERR-TEN-8008";
    };
    readonly RATE_LIMIT: {
        readonly UNKNOWN: "ERR-RATE-9000";
        readonly API_LIMIT_EXCEEDED: "ERR-RATE-9001";
        readonly AUTH_LIMIT_EXCEEDED: "ERR-RATE-9002";
        readonly AI_LIMIT_EXCEEDED: "ERR-RATE-9003";
        readonly EXPORT_LIMIT_EXCEEDED: "ERR-RATE-9004";
        readonly UPLOAD_LIMIT_EXCEEDED: "ERR-RATE-9005";
    };
    readonly CONFIG: {
        readonly UNKNOWN: "ERR-CFG-1000";
        readonly MISSING_ENV_VAR: "ERR-CFG-1001";
        readonly INVALID_CONFIG: "ERR-CFG-1002";
        readonly FEATURE_FLAG_ERROR: "ERR-CFG-1003";
    };
    readonly SYSTEM: {
        readonly UNKNOWN: "ERR-SYS-1100";
        readonly INTERNAL_ERROR: "ERR-SYS-1101";
        readonly SERVICE_UNAVAILABLE: "ERR-SYS-1102";
        readonly CONFIGURATION_ERROR: "ERR-SYS-1103";
        readonly MEMORY_ERROR: "ERR-SYS-1104";
        readonly DISK_ERROR: "ERR-SYS-1105";
    };
    readonly INTERNAL: {
        readonly UNKNOWN: "ERR-INT-0000";
        readonly UNEXPECTED: "ERR-INT-0001";
        readonly NOT_IMPLEMENTED: "ERR-INT-0002";
        readonly ASSERTION_FAILED: "ERR-INT-0003";
    };
};
export interface RequestContext {
    method: string;
    path: string;
    url?: string | undefined;
    params?: Record<string, string> | undefined;
    query?: Record<string, string> | undefined;
    body?: Record<string, unknown> | undefined;
    headers?: Record<string, string | undefined> | undefined;
    ip?: string | undefined;
    userAgent?: string | undefined;
    tenantId?: string | undefined;
    tenantCode?: string | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
    timestamp?: string | undefined;
}
export interface DebugContext {
    file?: string | undefined;
    line?: number | undefined;
    functionName?: string | undefined;
    stackTrace?: string | undefined;
    errorType?: string | undefined;
    timestamp?: string | undefined;
    environment?: 'development' | 'staging' | 'production' | undefined;
    version?: string | undefined;
    nodeVersion?: string | undefined;
    additionalData?: Record<string, unknown> | undefined;
    memoryUsage?: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    } | undefined;
}
export interface DatabaseContext {
    query?: string | undefined;
    queryParams?: unknown[] | undefined;
    table?: string | undefined;
    column?: string | undefined;
    constraint?: string | undefined;
    schema?: string | undefined;
    operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' | undefined;
    affectedRows?: number | undefined;
    executionTime?: number | undefined;
    errorCode?: string | undefined;
    sqlState?: string | undefined;
    detail?: string | undefined;
    hint?: string | undefined;
    position?: number | undefined;
}
export interface HeuresysError {
    errorId: string;
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    httpStatus: number;
    message: string;
    messageEN?: string | undefined;
    technicalMessage?: string | undefined;
    requestContext?: RequestContext | undefined;
    debugContext?: DebugContext | undefined;
    databaseContext?: DatabaseContext | undefined;
    details?: Record<string, unknown> | undefined;
    retryable: boolean;
    retryAfter?: number | undefined;
    suggestion?: string | undefined;
    suggestionEN?: string | undefined;
    documentationUrl?: string | undefined;
    validationErrors?: Array<{
        field: string;
        message: string;
        value?: unknown | undefined;
        constraint?: string | undefined;
    }> | undefined;
    timestamp: string;
    correlationId?: string | undefined;
    parentErrorId?: string | undefined;
}
export interface ApiErrorResponse {
    success: false;
    error: HeuresysError;
    meta?: {
        requestId: string;
        timestamp: string;
        processingTime?: number | undefined;
        path?: string | undefined;
        method?: string | undefined;
    } | undefined;
}
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta?: {
        requestId: string;
        timestamp: string;
        processingTime?: number | undefined;
        pagination?: {
            total: number;
            limit: number;
            offset: number;
            hasMore: boolean;
        } | undefined;
    } | undefined;
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
export interface ErrorMessages {
    message: string;
    messageIT: string;
    suggestion: string;
    suggestionIT: string;
}
export declare const ErrorMessageRegistry: Record<string, ErrorMessages>;
export declare const PostgresErrorMapping: Record<string, {
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
}>;
export declare const ErrorToHttpStatus: Record<string, number>;
//# sourceMappingURL=types.d.ts.map