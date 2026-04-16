/**
 * Health Route Unit Tests
 * Tests for service and database health check endpoints
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

// Import the router
import healthRouter from '../../routes/health.js';

// Helper to find a GET handler for a given path
function findGetHandler(path: string) {
  return healthRouter.stack.find(
    (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
      layer.route?.path === path && layer.route?.methods?.get
  )?.route?.stack[0]?.handle;
}

// Helper to create a properly chained mock response
function createMockRes() {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockRes = {
    json: mockJson,
    status: mockStatus,
  } as unknown as Response;
  return { mockRes, mockJson, mockStatus };
}

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('should return success status', async () => {
      const { mockRes, mockJson } = createMockRes();
      const healthHandler = findGetHandler('/health');
      expect(healthHandler).toBeDefined();

      if (healthHandler) {
        // Handler is async — await it
        await healthHandler({} as Request, mockRes, jest.fn());

        expect(mockJson).toHaveBeenCalled();
        const response = mockJson.mock.calls[0]?.[0];
        expect(response).toBeDefined();
        expect(response.data.service).toBe('api-gateway');
        expect(response.data.version).toBe('1.0.0');
        expect(response.data.timestamp).toBeDefined();
      }
    });

    it('should include timestamp in ISO format', async () => {
      const { mockRes, mockJson } = createMockRes();
      const healthHandler = findGetHandler('/health');

      if (healthHandler) {
        await healthHandler({} as Request, mockRes, jest.fn());

        const response = mockJson.mock.calls[0]?.[0];
        expect(response).toBeDefined();
        const timestamp = response.data.timestamp;
        expect(() => new Date(timestamp).toISOString()).not.toThrow();
      }
    });
  });

  describe('router configuration', () => {
    it('should have /health route registered', () => {
      const hasHealthRoute = healthRouter.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/health'
      );
      expect(hasHealthRoute).toBe(true);
    });

    it('should have /db-health route registered', () => {
      const hasDbHealthRoute = healthRouter.stack.some(
        (layer: { route?: { path: string } }) => layer.route?.path === '/db-health'
      );
      expect(hasDbHealthRoute).toBe(true);
    });

    it('should export router as default', () => {
      expect(healthRouter).toBeDefined();
      expect(typeof healthRouter.use).toBe('function');
    });
  });
});

describe('Health Response Format', () => {
  it('should follow consistent API response structure', async () => {
    const { mockRes, mockJson } = createMockRes();
    const healthHandler = findGetHandler('/health');

    expect(healthHandler).toBeDefined();

    if (healthHandler) {
      await healthHandler({} as Request, mockRes, jest.fn());

      expect(mockJson).toHaveBeenCalled();
      const response = mockJson.mock.calls[0]?.[0];
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(typeof response.data.status).toBe('string');
      expect(typeof response.data.service).toBe('string');
      expect(typeof response.data.version).toBe('string');
      expect(typeof response.data.timestamp).toBe('string');
    }
  });
});
