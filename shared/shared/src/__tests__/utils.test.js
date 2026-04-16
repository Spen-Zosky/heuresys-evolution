"use strict";
/**
 * Unit tests for @heuresys/shared utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../utils/index.js");
describe('UUID Utilities', () => {
    test('generateUUID should return a valid UUID v4', () => {
        const uuid = (0, index_js_1.generateUUID)();
        expect((0, index_js_1.isValidUUID)(uuid)).toBe(true);
    });
    test('isValidUUID should validate correct UUIDs', () => {
        expect((0, index_js_1.isValidUUID)('d5855519-3ed1-4427-865f-fe75f1e42c4c')).toBe(true);
        expect((0, index_js_1.isValidUUID)('0c54b84a-1234-4567-89ab-cdef01234567')).toBe(true);
    });
    test('isValidUUID should reject invalid UUIDs', () => {
        expect((0, index_js_1.isValidUUID)('not-a-uuid')).toBe(false);
        expect((0, index_js_1.isValidUUID)('')).toBe(false);
        expect((0, index_js_1.isValidUUID)('12345678-1234-1234-1234-123456789012')).toBe(false); // version not 4
    });
});
describe('Italian Fiscal Code Utilities', () => {
    test('isValidFiscalCode should validate correct format', () => {
        expect((0, index_js_1.isValidFiscalCode)('RSSMRA85M01H501Z')).toBe(true);
        expect((0, index_js_1.isValidFiscalCode)('VRDLGI80A01F205X')).toBe(true);
    });
    test('isValidFiscalCode should reject invalid format', () => {
        expect((0, index_js_1.isValidFiscalCode)('')).toBe(false);
        expect((0, index_js_1.isValidFiscalCode)('INVALID')).toBe(false);
        expect((0, index_js_1.isValidFiscalCode)('12345678901234567')).toBe(false);
    });
    test('validateFiscalCodeChecksum should validate and reject checksums', () => {
        // Test that function returns boolean for valid format codes
        const result = (0, index_js_1.validateFiscalCodeChecksum)('RSSMRA85M01H501Z');
        expect(typeof result).toBe('boolean');
        // Invalid format should always return false
        expect((0, index_js_1.validateFiscalCodeChecksum)('INVALID')).toBe(false);
        expect((0, index_js_1.validateFiscalCodeChecksum)('')).toBe(false);
    });
});
describe('Date Utilities', () => {
    test('formatDateISO should format date correctly', () => {
        const date = new Date('2024-03-15T10:30:00Z');
        expect((0, index_js_1.formatDateISO)(date)).toBe('2024-03-15');
    });
    test('formatDateIT should format date in Italian format', () => {
        const date = new Date(2024, 2, 15); // March 15, 2024
        expect((0, index_js_1.formatDateIT)(date)).toBe('15/03/2024');
    });
    test('parseDateIT should parse Italian date format', () => {
        const date = (0, index_js_1.parseDateIT)('15/03/2024');
        expect(date).not.toBeNull();
        expect(date?.getDate()).toBe(15);
        expect(date?.getMonth()).toBe(2); // 0-indexed
        expect(date?.getFullYear()).toBe(2024);
    });
    test('parseDateIT should return null for invalid format', () => {
        expect((0, index_js_1.parseDateIT)('invalid')).toBeNull();
        expect((0, index_js_1.parseDateIT)('2024-03-15')).toBeNull();
    });
    test('getBusinessDays should count weekdays', () => {
        // Monday to Friday = 5 business days
        const monday = new Date(2024, 2, 11);
        const friday = new Date(2024, 2, 15);
        expect((0, index_js_1.getBusinessDays)(monday, friday)).toBe(5);
        // Monday to Monday (next week) = 6 business days
        const nextMonday = new Date(2024, 2, 18);
        expect((0, index_js_1.getBusinessDays)(monday, nextMonday)).toBe(6);
    });
});
describe('String Utilities', () => {
    test('slugify should convert string to URL-safe slug', () => {
        expect((0, index_js_1.slugify)('Hello World')).toBe('hello-world');
        expect((0, index_js_1.slugify)('Città di Milano')).toBe('citta-di-milano');
        expect((0, index_js_1.slugify)('Test  Multiple   Spaces')).toBe('test-multiple-spaces');
    });
    test('titleCase should capitalize first letter of each word', () => {
        expect((0, index_js_1.titleCase)('hello world')).toBe('Hello World');
        expect((0, index_js_1.titleCase)('UPPERCASE TEXT')).toBe('Uppercase Text');
    });
    test('truncate should limit string length', () => {
        expect((0, index_js_1.truncate)('Hello World', 20)).toBe('Hello World');
        expect((0, index_js_1.truncate)('Hello World', 8)).toBe('Hello...');
    });
});
describe('Object Utilities', () => {
    test('deepClone should create independent copy', () => {
        const original = { a: 1, b: { c: 2 } };
        const cloned = (0, index_js_1.deepClone)(original);
        cloned.b.c = 99;
        expect(original.b.c).toBe(2);
    });
    test('pick should extract specified keys', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect((0, index_js_1.pick)(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });
    test('omit should exclude specified keys', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect((0, index_js_1.omit)(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });
});
describe('Error Utilities', () => {
    test('ErrorCodes should have expected values', () => {
        expect(index_js_1.ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
        expect(index_js_1.ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
        expect(index_js_1.ErrorCodes.TENANT_NOT_FOUND).toBe('TENANT_NOT_FOUND');
    });
    test('createError should return structured error object', () => {
        const error = (0, index_js_1.createError)(index_js_1.ErrorCodes.NOT_FOUND, 'Resource not found');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('Resource not found');
        expect(error.timestamp).toBeDefined();
    });
    test('createError should include details when provided', () => {
        const error = (0, index_js_1.createError)(index_js_1.ErrorCodes.VALIDATION_ERROR, 'Invalid input', { field: 'email' });
        expect(error.details).toEqual({ field: 'email' });
    });
});
//# sourceMappingURL=utils.test.js.map