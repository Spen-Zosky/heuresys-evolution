"use strict";
/**
 * @heuresys/shared - Utility functions
 * Common utility functions used across all Heuresys platform services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = void 0;
exports.generateUUID = generateUUID;
exports.isValidUUID = isValidUUID;
exports.isValidFiscalCode = isValidFiscalCode;
exports.validateFiscalCodeChecksum = validateFiscalCodeChecksum;
exports.formatDateISO = formatDateISO;
exports.formatDateIT = formatDateIT;
exports.parseDateIT = parseDateIT;
exports.getBusinessDays = getBusinessDays;
exports.slugify = slugify;
exports.titleCase = titleCase;
exports.truncate = truncate;
exports.deepClone = deepClone;
exports.pick = pick;
exports.omit = omit;
exports.createError = createError;
const uuid_1 = require("uuid");
// =============================================================================
// UUID UTILITIES
// =============================================================================
/**
 * Generate a new UUID v4
 */
function generateUUID() {
    return (0, uuid_1.v4)();
}
/**
 * Validate UUID format
 */
function isValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}
// =============================================================================
// ITALIAN FISCAL CODE UTILITIES
// =============================================================================
/**
 * Validate Italian Codice Fiscale format
 * Note: This validates format only, not checksum
 */
function isValidFiscalCode(code) {
    if (!code || code.length !== 16)
        return false;
    const fiscalCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i;
    return fiscalCodeRegex.test(code);
}
/**
 * Validate Italian Codice Fiscale with checksum
 */
function validateFiscalCodeChecksum(code) {
    if (!isValidFiscalCode(code))
        return false;
    const upperCode = code.toUpperCase();
    const oddMap = {
        '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
        'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
        'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
        'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
    };
    const evenMap = {
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
        'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
        'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
    };
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        const char = upperCode.charAt(i);
        sum += (i % 2 === 0) ? (oddMap[char] ?? 0) : (evenMap[char] ?? 0);
    }
    const expectedCheckChar = String.fromCharCode(65 + (sum % 26));
    return upperCode[15] === expectedCheckChar;
}
// =============================================================================
// DATE UTILITIES
// =============================================================================
/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}
/**
 * Format date to Italian format (DD/MM/YYYY)
 */
function formatDateIT(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}
/**
 * Parse Italian date format (DD/MM/YYYY) to Date
 */
function parseDateIT(dateString) {
    const parts = dateString.split('/');
    if (parts.length !== 3)
        return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (isNaN(date.getTime()))
        return null;
    return date;
}
/**
 * Calculate business days between two dates (excluding weekends)
 */
function getBusinessDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}
// =============================================================================
// STRING UTILITIES
// =============================================================================
/**
 * Slugify a string (for URL-safe identifiers)
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
/**
 * Capitalize first letter of each word
 */
function titleCase(text) {
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
/**
 * Truncate string with ellipsis
 */
function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - 3) + '...';
}
// =============================================================================
// OBJECT UTILITIES
// =============================================================================
/**
 * Deep clone an object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
/**
 * Pick specific keys from an object
 */
function pick(obj, keys) {
    const result = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}
/**
 * Omit specific keys from an object
 */
function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}
// =============================================================================
// ERROR UTILITIES
// =============================================================================
/**
 * Standard error codes for API responses
 */
exports.ErrorCodes = {
    // Authentication & Authorization
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    // Resources
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    // Tenant
    TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
    TENANT_INACTIVE: 'TENANT_INACTIVE',
    // System
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    DATABASE_ERROR: 'DATABASE_ERROR',
};
/**
 * Create a standardized error object
 */
function createError(code, message, details) {
    return {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=index.js.map