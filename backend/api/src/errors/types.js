/**
 * Heuresys Error Handling System - Type Definitions
 *
 * Sistema di gestione errori strutturato per debugging avanzato
 * Copre: API, Database, Validation, Auth, Business Logic, Integration
 */
export const SeverityConfig = {
    CRITICAL: { level: 0, shouldAlert: true, shouldLog: true, shouldNotifyUser: true },
    ERROR: { level: 1, shouldAlert: false, shouldLog: true, shouldNotifyUser: true },
    WARNING: { level: 2, shouldAlert: false, shouldLog: true, shouldNotifyUser: true },
    INFO: { level: 3, shouldAlert: false, shouldLog: false, shouldNotifyUser: false },
};
// ============================================================================
// ERROR CODES - Structured by Category
// ============================================================================
export const ErrorCodes = {
    // API Errors (1xxx)
    API: {
        UNKNOWN: 'ERR-API-1000',
        BAD_REQUEST: 'ERR-API-1001',
        INVALID_REQUEST: 'ERR-API-1001',
        INVALID_CONTENT_TYPE: 'ERR-API-1002',
        MISSING_REQUIRED_FIELD: 'ERR-API-1003',
        INVALID_JSON: 'ERR-API-1004',
        NOT_FOUND: 'ERR-API-1005',
        ROUTE_NOT_FOUND: 'ERR-API-1005',
        METHOD_NOT_ALLOWED: 'ERR-API-1006',
        PAYLOAD_TOO_LARGE: 'ERR-API-1007',
        TIMEOUT: 'ERR-API-1008',
        CONFLICT: 'ERR-API-1009',
        SERVICE_UNAVAILABLE: 'ERR-API-1010',
        RATE_LIMITED: 'ERR-API-1011',
    },
    // Authentication Errors (2xxx)
    AUTH: {
        UNKNOWN: 'ERR-AUTH-2000',
        UNAUTHORIZED: 'ERR-AUTH-2001',
        INVALID_CREDENTIALS: 'ERR-AUTH-2001',
        TOKEN_EXPIRED: 'ERR-AUTH-2002',
        TOKEN_INVALID: 'ERR-AUTH-2003',
        TOKEN_MISSING: 'ERR-AUTH-2004',
        REFRESH_TOKEN_EXPIRED: 'ERR-AUTH-2005',
        REFRESH_TOKEN_INVALID: 'ERR-AUTH-2006',
        INSUFFICIENT_PERMISSIONS: 'ERR-AUTH-2007',
        ACCOUNT_LOCKED: 'ERR-AUTH-2008',
        ACCOUNT_DISABLED: 'ERR-AUTH-2009',
        SESSION_EXPIRED: 'ERR-AUTH-2010',
        MFA_REQUIRED: 'ERR-AUTH-2011',
        MFA_INVALID: 'ERR-AUTH-2012',
        PASSWORD_EXPIRED: 'ERR-AUTH-2013',
    },
    // Database Errors (3xxx)
    DB: {
        UNKNOWN: 'ERR-DB-3000',
        CONNECTION_FAILED: 'ERR-DB-3001',
        CONNECTION_ERROR: 'ERR-DB-3001', // Alias
        CONNECTION_TIMEOUT: 'ERR-DB-3002',
        QUERY_FAILED: 'ERR-DB-3003',
        QUERY_ERROR: 'ERR-DB-3003', // Alias
        CONSTRAINT_VIOLATION: 'ERR-DB-3004',
        UNIQUE_VIOLATION: 'ERR-DB-3005',
        FOREIGN_KEY_VIOLATION: 'ERR-DB-3006',
        NOT_NULL_VIOLATION: 'ERR-DB-3007',
        NULL_VIOLATION: 'ERR-DB-3007', // Alias
        CHECK_VIOLATION: 'ERR-DB-3008',
        DEADLOCK: 'ERR-DB-3009',
        TRANSACTION_FAILED: 'ERR-DB-3010',
        TRANSACTION_ERROR: 'ERR-DB-3010', // Alias
        POOL_EXHAUSTED: 'ERR-DB-3011',
        INVALID_QUERY: 'ERR-DB-3012',
        SCHEMA_MISMATCH: 'ERR-DB-3013',
        MIGRATION_FAILED: 'ERR-DB-3014',
        RECORD_NOT_FOUND: 'ERR-DB-3015',
        DUPLICATE_RECORD: 'ERR-DB-3016',
        QUERY_SUCCESS: 'ERR-DB-3017',
        TRIGGER_ERROR: 'ERR-DB-3018',
        EXCLUSION_VIOLATION: 'ERR-DB-3019',
        SYNTAX_ERROR: 'ERR-DB-3020',
        UNDEFINED_COLUMN: 'ERR-DB-3021',
        UNDEFINED_TABLE: 'ERR-DB-3022',
        AMBIGUOUS_COLUMN: 'ERR-DB-3023',
        SERIALIZATION_FAILURE: 'ERR-DB-3024',
        SYSTEM_ERROR: 'ERR-DB-3025',
        INSUFFICIENT_RESOURCES: 'ERR-DB-3026',
        DISK_FULL: 'ERR-DB-3027',
        MEMORY_ERROR: 'ERR-DB-3028',
        CONNECTION_LIMIT: 'ERR-DB-3029',
        QUERY_TOO_COMPLEX: 'ERR-DB-3030',
        LOCK_NOT_AVAILABLE: 'ERR-DB-3031',
        QUERY_TIMEOUT: 'ERR-DB-3032',
        IO_ERROR: 'ERR-DB-3033',
    },
    // Validation Errors (4xxx)
    VALIDATION: {
        UNKNOWN: 'ERR-VAL-4000',
        VALIDATION_FAILED: 'ERR-VAL-4001',
        REQUIRED_FIELD: 'ERR-VAL-4002',
        INVALID_FORMAT: 'ERR-VAL-4003',
        INVALID_TYPE: 'ERR-VAL-4004',
        OUT_OF_RANGE: 'ERR-VAL-4005',
        INVALID_LENGTH: 'ERR-VAL-4006',
        INVALID_EMAIL: 'ERR-VAL-4007',
        INVALID_PHONE: 'ERR-VAL-4008',
        INVALID_DATE: 'ERR-VAL-4009',
        INVALID_UUID: 'ERR-VAL-4010',
        INVALID_ENUM: 'ERR-VAL-4011',
        INVALID_PATTERN: 'ERR-VAL-4012',
        ARRAY_TOO_SHORT: 'ERR-VAL-4013',
        ARRAY_TOO_LONG: 'ERR-VAL-4014',
        SCHEMA_VALIDATION_FAILED: 'ERR-VAL-4015',
        VALUE_TOO_LONG: 'ERR-VAL-4016',
        NULL_VIOLATION: 'ERR-VAL-4017',
        VALUE_OUT_OF_RANGE: 'ERR-VAL-4018',
        TYPE_MISMATCH: 'ERR-VAL-4019',
        INVALID_ENCODING: 'ERR-VAL-4020',
    },
    // Business Logic Errors (5xxx)
    BUSINESS: {
        UNKNOWN: 'ERR-BIZ-5000',
        RULE_VIOLATION: 'ERR-BIZ-5001',
        INVALID_STATE: 'ERR-BIZ-5002',
        OPERATION_NOT_PERMITTED: 'ERR-BIZ-5003',
        OPERATION_NOT_ALLOWED: 'ERR-BIZ-5003',
        RESOURCE_LOCKED: 'ERR-BIZ-5004',
        WORKFLOW_VIOLATION: 'ERR-BIZ-5005',
        DEPENDENCY_CONFLICT: 'ERR-BIZ-5006',
        QUOTA_EXCEEDED: 'ERR-BIZ-5007',
        DUPLICATE_OPERATION: 'ERR-BIZ-5008',
        STALE_DATA: 'ERR-BIZ-5009',
        APPROVAL_REQUIRED: 'ERR-BIZ-5010',
        POLICY_VIOLATION: 'ERR-BIZ-5011',
        AUDIT_REQUIRED: 'ERR-BIZ-5012',
    },
    // Integration Errors (6xxx)
    INTEGRATION: {
        UNKNOWN: 'ERR-INT-6000',
        SERVICE_UNAVAILABLE: 'ERR-INT-6001',
        TIMEOUT: 'ERR-INT-6002',
        INVALID_RESPONSE: 'ERR-INT-6003',
        AUTHENTICATION_FAILED: 'ERR-INT-6004',
        RATE_LIMITED: 'ERR-INT-6005',
        API_VERSION_MISMATCH: 'ERR-INT-6006',
        SAP_CONNECTION_FAILED: 'ERR-INT-6007',
        SAP_QUERY_FAILED: 'ERR-INT-6008',
        ESCO_API_FAILED: 'ERR-INT-6009',
        AI_PROVIDER_FAILED: 'ERR-INT-6010',
        EMBEDDING_FAILED: 'ERR-INT-6011',
        EXTERNAL_SERVICE_ERROR: 'ERR-INT-6012',
    },
    // Resource Errors (7xxx)
    RESOURCE: {
        UNKNOWN: 'ERR-RES-7000',
        NOT_FOUND: 'ERR-RES-7001',
        ALREADY_EXISTS: 'ERR-RES-7002',
        ACCESS_DENIED: 'ERR-RES-7003',
        DELETED: 'ERR-RES-7004',
        ARCHIVED: 'ERR-RES-7005',
        VERSION_CONFLICT: 'ERR-RES-7006',
    },
    // Permission Errors (7.5xxx)
    PERMISSION: {
        UNKNOWN: 'ERR-PERM-7500',
        ACCESS_DENIED: 'ERR-PERM-7501',
        INSUFFICIENT_ROLE: 'ERR-PERM-7502',
        RESOURCE_FORBIDDEN: 'ERR-PERM-7503',
        ACTION_NOT_ALLOWED: 'ERR-PERM-7504',
    },
    // Tenant Errors (8xxx)
    TENANT: {
        UNKNOWN: 'ERR-TEN-8000',
        TENANT_REQUIRED: 'ERR-TEN-8001',
        TENANT_NOT_FOUND: 'ERR-TEN-8002',
        NOT_FOUND: 'ERR-TEN-8002',
        TENANT_INACTIVE: 'ERR-TEN-8003',
        INACTIVE: 'ERR-TEN-8003',
        SUSPENDED: 'ERR-TEN-8004',
        HEADER_MISSING: 'ERR-TEN-8005',
        CROSS_TENANT_ACCESS: 'ERR-TEN-8006',
        LICENSE_EXPIRED: 'ERR-TEN-8007',
        FEATURE_NOT_ENABLED: 'ERR-TEN-8008',
    },
    // Rate Limit Errors (9xxx)
    RATE_LIMIT: {
        UNKNOWN: 'ERR-RATE-9000',
        API_LIMIT_EXCEEDED: 'ERR-RATE-9001',
        AUTH_LIMIT_EXCEEDED: 'ERR-RATE-9002',
        AI_LIMIT_EXCEEDED: 'ERR-RATE-9003',
        EXPORT_LIMIT_EXCEEDED: 'ERR-RATE-9004',
        UPLOAD_LIMIT_EXCEEDED: 'ERR-RATE-9005',
    },
    // Config Errors (10xx)
    CONFIG: {
        UNKNOWN: 'ERR-CFG-1000',
        MISSING_ENV_VAR: 'ERR-CFG-1001',
        INVALID_CONFIG: 'ERR-CFG-1002',
        FEATURE_FLAG_ERROR: 'ERR-CFG-1003',
    },
    // System Errors (11xxx)
    SYSTEM: {
        UNKNOWN: 'ERR-SYS-1100',
        INTERNAL_ERROR: 'ERR-SYS-1101',
        SERVICE_UNAVAILABLE: 'ERR-SYS-1102',
        CONFIGURATION_ERROR: 'ERR-SYS-1103',
        MEMORY_ERROR: 'ERR-SYS-1104',
        DISK_ERROR: 'ERR-SYS-1105',
    },
    // Internal Errors (0xxx)
    INTERNAL: {
        UNKNOWN: 'ERR-INT-0000',
        UNEXPECTED: 'ERR-INT-0001',
        NOT_IMPLEMENTED: 'ERR-INT-0002',
        ASSERTION_FAILED: 'ERR-INT-0003',
    },
};
export const ErrorMessageRegistry = {
    // Database Errors
    'ERR-DB-3001': {
        message: 'Database connection failed',
        messageIT: 'Connessione al database fallita',
        suggestion: 'Check database server status and network connectivity',
        suggestionIT: 'Verificare lo stato del server database e la connettività di rete',
    },
    'ERR-DB-3005': {
        message: 'Duplicate record: this value already exists',
        messageIT: 'Record duplicato: questo valore esiste già',
        suggestion: 'Use a different value or update the existing record',
        suggestionIT: 'Utilizzare un valore diverso o aggiornare il record esistente',
    },
    'ERR-DB-3006': {
        message: 'Referenced record not found',
        messageIT: 'Record referenziato non trovato',
        suggestion: 'Ensure the referenced record exists before this operation',
        suggestionIT: 'Assicurarsi che il record referenziato esista prima di questa operazione',
    },
    'ERR-DB-3015': {
        message: 'Record not found',
        messageIT: 'Record non trovato',
        suggestion: 'Verify the ID or search criteria',
        suggestionIT: 'Verificare l\'ID o i criteri di ricerca',
    },
    // Auth Errors
    'ERR-AUTH-2001': {
        message: 'Invalid username or password',
        messageIT: 'Username o password non validi',
        suggestion: 'Check your credentials and try again',
        suggestionIT: 'Controllare le credenziali e riprovare',
    },
    'ERR-AUTH-2002': {
        message: 'Your session has expired',
        messageIT: 'La sessione è scaduta',
        suggestion: 'Please log in again to continue',
        suggestionIT: 'Effettuare nuovamente il login per continuare',
    },
    'ERR-AUTH-2007': {
        message: 'You do not have permission to perform this action',
        messageIT: 'Non hai i permessi per eseguire questa azione',
        suggestion: 'Contact your administrator to request access',
        suggestionIT: 'Contattare l\'amministratore per richiedere l\'accesso',
    },
    // Tenant Errors
    'ERR-TEN-8001': {
        message: 'Tenant not found',
        messageIT: 'Tenant non trovato',
        suggestion: 'Verify the tenant code is correct',
        suggestionIT: 'Verificare che il codice tenant sia corretto',
    },
    'ERR-TEN-8004': {
        message: 'Tenant identification missing',
        messageIT: 'Identificazione tenant mancante',
        suggestion: 'Include X-Tenant-Code header in your request',
        suggestionIT: 'Includere l\'header X-Tenant-Code nella richiesta',
    },
    // Validation Errors
    'ERR-VAL-4001': {
        message: 'Required field is missing',
        messageIT: 'Campo obbligatorio mancante',
        suggestion: 'Provide all required fields',
        suggestionIT: 'Fornire tutti i campi obbligatori',
    },
    'ERR-VAL-4002': {
        message: 'Invalid field format',
        messageIT: 'Formato campo non valido',
        suggestion: 'Check the field format requirements',
        suggestionIT: 'Verificare i requisiti di formato del campo',
    },
    // Rate Limit Errors
    'ERR-RATE-9001': {
        message: 'Too many requests',
        messageIT: 'Troppe richieste',
        suggestion: 'Please wait before making more requests',
        suggestionIT: 'Attendere prima di effettuare altre richieste',
    },
    // Default
    'ERR-INT-0000': {
        message: 'An unexpected error occurred',
        messageIT: 'Si è verificato un errore imprevisto',
        suggestion: 'Please try again later or contact support',
        suggestionIT: 'Riprovare più tardi o contattare il supporto',
    },
};
// ============================================================================
// POSTGRES ERROR CODE MAPPING
// ============================================================================
export const PostgresErrorMapping = {
    // Class 23 — Integrity Constraint Violation
    '23000': { code: ErrorCodes.DB.CONSTRAINT_VIOLATION, category: 'DB', severity: 'ERROR' },
    '23001': { code: ErrorCodes.DB.FOREIGN_KEY_VIOLATION, category: 'DB', severity: 'ERROR' },
    '23502': { code: ErrorCodes.DB.NOT_NULL_VIOLATION, category: 'DB', severity: 'ERROR' },
    '23503': { code: ErrorCodes.DB.FOREIGN_KEY_VIOLATION, category: 'DB', severity: 'ERROR' },
    '23505': { code: ErrorCodes.DB.UNIQUE_VIOLATION, category: 'DB', severity: 'ERROR' },
    '23514': { code: ErrorCodes.DB.CHECK_VIOLATION, category: 'DB', severity: 'ERROR' },
    // Class 40 — Transaction Rollback
    '40001': { code: ErrorCodes.DB.DEADLOCK, category: 'DB', severity: 'ERROR' },
    '40P01': { code: ErrorCodes.DB.DEADLOCK, category: 'DB', severity: 'ERROR' },
    // Class 42 — Syntax Error or Access Rule Violation
    '42601': { code: ErrorCodes.DB.INVALID_QUERY, category: 'DB', severity: 'ERROR' },
    '42703': { code: ErrorCodes.DB.SCHEMA_MISMATCH, category: 'DB', severity: 'ERROR' },
    '42P01': { code: ErrorCodes.DB.SCHEMA_MISMATCH, category: 'DB', severity: 'ERROR' },
    // Class 08 — Connection Exception
    '08000': { code: ErrorCodes.DB.CONNECTION_FAILED, category: 'DB', severity: 'CRITICAL' },
    '08003': { code: ErrorCodes.DB.CONNECTION_FAILED, category: 'DB', severity: 'CRITICAL' },
    '08006': { code: ErrorCodes.DB.CONNECTION_FAILED, category: 'DB', severity: 'CRITICAL' },
    // Class 57 — Operator Intervention
    '57014': { code: ErrorCodes.DB.CONNECTION_TIMEOUT, category: 'DB', severity: 'ERROR' },
    '57P01': { code: ErrorCodes.DB.CONNECTION_FAILED, category: 'DB', severity: 'CRITICAL' },
};
// ============================================================================
// HTTP STATUS CODE MAPPING
// ============================================================================
export const ErrorToHttpStatus = {
    // Auth errors -> 401/403
    [ErrorCodes.AUTH.INVALID_CREDENTIALS]: 401,
    [ErrorCodes.AUTH.TOKEN_EXPIRED]: 401,
    [ErrorCodes.AUTH.TOKEN_INVALID]: 401,
    [ErrorCodes.AUTH.TOKEN_MISSING]: 401,
    [ErrorCodes.AUTH.INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCodes.AUTH.ACCOUNT_LOCKED]: 403,
    [ErrorCodes.AUTH.ACCOUNT_DISABLED]: 403,
    // Resource errors -> 404/409
    [ErrorCodes.RESOURCE.NOT_FOUND]: 404,
    [ErrorCodes.RESOURCE.ALREADY_EXISTS]: 409,
    [ErrorCodes.RESOURCE.ACCESS_DENIED]: 403,
    [ErrorCodes.RESOURCE.VERSION_CONFLICT]: 409,
    [ErrorCodes.DB.RECORD_NOT_FOUND]: 404,
    [ErrorCodes.DB.DUPLICATE_RECORD]: 409,
    [ErrorCodes.DB.UNIQUE_VIOLATION]: 409,
    // Validation errors -> 400
    [ErrorCodes.VALIDATION.REQUIRED_FIELD]: 400,
    [ErrorCodes.VALIDATION.INVALID_FORMAT]: 400,
    [ErrorCodes.VALIDATION.SCHEMA_VALIDATION_FAILED]: 400,
    [ErrorCodes.API.INVALID_REQUEST]: 400,
    [ErrorCodes.API.INVALID_JSON]: 400,
    // Rate limit -> 429
    [ErrorCodes.RATE_LIMIT.API_LIMIT_EXCEEDED]: 429,
    [ErrorCodes.RATE_LIMIT.AUTH_LIMIT_EXCEEDED]: 429,
    [ErrorCodes.RATE_LIMIT.AI_LIMIT_EXCEEDED]: 429,
    // Tenant errors -> 400/403
    [ErrorCodes.TENANT.HEADER_MISSING]: 400,
    [ErrorCodes.TENANT.NOT_FOUND]: 400,
    [ErrorCodes.TENANT.CROSS_TENANT_ACCESS]: 403,
    // Server errors -> 500/502/503
    [ErrorCodes.DB.CONNECTION_FAILED]: 503,
    [ErrorCodes.INTEGRATION.SERVICE_UNAVAILABLE]: 502,
    [ErrorCodes.INTERNAL.UNEXPECTED]: 500,
};
//# sourceMappingURL=types.js.map