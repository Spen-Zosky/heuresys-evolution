/**
 * Tenant Context Middleware Unit Tests
 * Tests for tenant extraction and validation helper functions
 *
 * Note: Integration tests for tenantContextMiddleware (which requires database)
 * are in integration tests. This file tests the synchronous helper functions.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
// Import only the synchronous functions that don't require database
import { requireTenant, clearTenantCache, getTenantIdOrThrow, } from '../../middleware/tenantContext.js';
// Test tenant data
const MOCK_TENANT = {
    id: 'tenant-uuid-123',
    code: 'acme-corp',
    name: 'Acme Corporation',
    status: 'active',
};
describe('Tenant Context Helper Functions', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    beforeEach(() => {
        mockReq = {
            headers: {},
            params: {},
            query: {},
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
    });
    describe('requireTenant', () => {
        it('should pass if tenantId is present', () => {
            mockReq.tenantId = MOCK_TENANT.id;
            requireTenant(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should pass if tenant object is present', () => {
            mockReq.tenantId = MOCK_TENANT.id;
            mockReq.tenant = MOCK_TENANT;
            requireTenant(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
        it('should fail if tenantId is not present', () => {
            mockReq.tenantId = undefined;
            requireTenant(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            const calls = mockNext.mock.calls;
            const error = calls[0]?.[0];
            expect(error?.message).toBe('Tenant context required');
        });
        it('should fail with empty string tenantId', () => {
            mockReq.tenantId = '';
            requireTenant(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });
    describe('getTenantIdOrThrow', () => {
        it('should return tenantId if present', () => {
            mockReq.tenantId = MOCK_TENANT.id;
            const result = getTenantIdOrThrow(mockReq);
            expect(result).toBe(MOCK_TENANT.id);
        });
        it('should throw if tenantId is not present', () => {
            mockReq.tenantId = undefined;
            expect(() => getTenantIdOrThrow(mockReq)).toThrow('Tenant context required');
        });
        it('should throw with empty string tenantId', () => {
            mockReq.tenantId = '';
            expect(() => getTenantIdOrThrow(mockReq)).toThrow('Tenant context required');
        });
    });
    describe('clearTenantCache', () => {
        it('should not throw when clearing cache by tenantId', () => {
            expect(() => clearTenantCache(MOCK_TENANT.id)).not.toThrow();
        });
        it('should not throw when clearing cache by tenantCode', () => {
            expect(() => clearTenantCache(undefined, MOCK_TENANT.code)).not.toThrow();
        });
        it('should not throw when clearing entire cache', () => {
            expect(() => clearTenantCache()).not.toThrow();
        });
        it('should not throw when clearing with both id and code', () => {
            expect(() => clearTenantCache(MOCK_TENANT.id, MOCK_TENANT.code)).not.toThrow();
        });
    });
});
describe('Tenant Request Extension Type', () => {
    it('should allow extending request with tenant properties', () => {
        const req = {
            tenantId: 'test-id',
            tenantCode: 'test-code',
            tenant: {
                id: 'test-id',
                code: 'test-code',
                name: 'Test Tenant',
                status: 'active',
            },
        };
        expect(req.tenantId).toBe('test-id');
        expect(req.tenantCode).toBe('test-code');
        expect(req.tenant?.name).toBe('Test Tenant');
    });
});
//# sourceMappingURL=tenantContext.test.js.map