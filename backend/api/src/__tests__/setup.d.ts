/**
 * Jest Test Setup
 * Configures mocks and environment for API Gateway tests
 */
import { jest } from '@jest/globals';
declare global {
    var testUtils: {
        createMockRequest: (overrides?: Record<string, unknown>) => unknown;
        createMockResponse: () => unknown;
        createMockNext: () => jest.Mock;
    };
}
export {};
//# sourceMappingURL=setup.d.ts.map