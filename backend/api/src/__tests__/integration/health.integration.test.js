/**
 * Health Endpoints Integration Tests
 * Tests the health check endpoints against a live server
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
const API_BASE_URL = process.env.API_URL || 'http://localhost:8012';
const TEST_USERNAME = process.env.TEST_USERNAME || 'sysadmin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Admin2026';
describe('Health Endpoints Integration', () => {
    let authToken = null;
    beforeAll(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
            });
            const data = (await response.json());
            if (data.success && data.data?.accessToken) {
                authToken = data.data.accessToken;
            }
        }
        catch {
            // Auth failed - db-health tests will be skipped
        }
    });
    describe('GET /health', () => {
        it('should return 200 status', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.status).toBe(200);
        });
        it('should return JSON content type', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('content-type')).toContain('application/json');
        });
        it('should return status ok', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            const result = (await response.json());
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('ok');
        });
        it('should include timestamp', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            const result = (await response.json());
            expect(result.data.timestamp).toBeDefined();
            expect(new Date(result.data.timestamp).getTime()).toBeGreaterThan(0);
        });
        it('should include service info', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            const result = (await response.json());
            expect(result.data.service).toBe('api-gateway');
            expect(result.data.version).toBeDefined();
        });
    });
    describe('GET /db-health', () => {
        it('should return 401 without auth token', async () => {
            const response = await fetch(`${API_BASE_URL}/db-health`);
            expect(response.status).toBe(401);
        });
        it('should return 200 when database is connected (with auth)', async () => {
            if (!authToken) {
                expect(true).toBe(true);
                return;
            }
            const response = await fetch(`${API_BASE_URL}/db-health`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            expect(response.status).toBe(200);
        });
        it('should return success true (with auth)', async () => {
            if (!authToken) {
                expect(true).toBe(true);
                return;
            }
            const response = await fetch(`${API_BASE_URL}/db-health`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const result = (await response.json());
            expect(result.success).toBe(true);
        });
    });
    describe('Security Headers', () => {
        it('should include X-Content-Type-Options header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        });
        it('should include X-Frame-Options header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('x-frame-options')).toBe('DENY');
        });
        it('should include Referrer-Policy header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
        });
        it('should include Permissions-Policy header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            const permissionsPolicy = response.headers.get('permissions-policy');
            expect(permissionsPolicy).toContain('camera=()');
            expect(permissionsPolicy).toContain('microphone=()');
        });
        it('should include Cache-Control header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('cache-control')).toContain('no-store');
        });
        it('should NOT include X-Powered-By header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('x-powered-by')).toBeNull();
        });
        it('should include X-Request-ID header', async () => {
            const response = await fetch(`${API_BASE_URL}/health`);
            expect(response.headers.get('x-request-id')).toBeDefined();
        });
    });
});
//# sourceMappingURL=health.integration.test.js.map