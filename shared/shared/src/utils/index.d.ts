/**
 * @heuresys/shared - Utility functions
 * Common utility functions used across all Heuresys platform services
 */
/**
 * Generate a new UUID v4
 */
export declare function generateUUID(): string;
/**
 * Validate UUID format
 */
export declare function isValidUUID(value: string): boolean;
/**
 * Validate Italian Codice Fiscale format
 * Note: This validates format only, not checksum
 */
export declare function isValidFiscalCode(code: string): boolean;
/**
 * Validate Italian Codice Fiscale with checksum
 */
export declare function validateFiscalCodeChecksum(code: string): boolean;
/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export declare function formatDateISO(date: Date): string;
/**
 * Format date to Italian format (DD/MM/YYYY)
 */
export declare function formatDateIT(date: Date): string;
/**
 * Parse Italian date format (DD/MM/YYYY) to Date
 */
export declare function parseDateIT(dateString: string): Date | null;
/**
 * Calculate business days between two dates (excluding weekends)
 */
export declare function getBusinessDays(startDate: Date, endDate: Date): number;
/**
 * Slugify a string (for URL-safe identifiers)
 */
export declare function slugify(text: string): string;
/**
 * Capitalize first letter of each word
 */
export declare function titleCase(text: string): string;
/**
 * Truncate string with ellipsis
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Pick specific keys from an object
 */
export declare function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Omit specific keys from an object
 */
export declare function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Standard error codes for API responses
 */
export declare const ErrorCodes: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly ALREADY_EXISTS: "ALREADY_EXISTS";
    readonly CONFLICT: "CONFLICT";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly TENANT_NOT_FOUND: "TENANT_NOT_FOUND";
    readonly TENANT_INACTIVE: "TENANT_INACTIVE";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
};
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
/**
 * Create a standardized error object
 */
export declare function createError(code: ErrorCode, message: string, details?: Record<string, unknown>): {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown> | undefined;
    timestamp: string;
};
//# sourceMappingURL=index.d.ts.map