/**
 * Jest Test Setup
 * Configures mocks and environment for API Gateway tests
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.PLATFORM_DB_HOST = 'localhost';
process.env.PLATFORM_DB_PORT = '5433';
process.env.PLATFORM_DB_USER = 'heuresys';
process.env.PLATFORM_DB_PASSWORD = 'heuresys';
process.env.PLATFORM_DB_NAME = 'heuresys_platform';
// Disable RBP framework in unit tests — falls back to legacy requireRole().
// RBP requires 5 DB queries per permission check; unit test mocks don't cover these.
process.env.USE_RBP_FRAMEWORK = 'false';

// Mock console.log in tests to reduce noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console.log in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
  }
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test utilities
declare global {
  var testUtils: {
    createMockRequest: (overrides?: Record<string, unknown>) => unknown;
    createMockResponse: () => unknown;
    createMockNext: () => jest.Mock;
  };
}

globalThis.testUtils = {
  createMockRequest: (overrides = {}) => ({
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  }),
  createMockResponse: () => {
    const res: Record<string, unknown> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  },
  createMockNext: () => jest.fn(),
};

export {};
