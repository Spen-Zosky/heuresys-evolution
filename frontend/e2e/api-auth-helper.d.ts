/**
 * Shared authentication helper for API-only E2E tests
 * Provides a valid JWT token for authenticated API calls
 */
export declare function getAuthToken(): Promise<string>;
export declare function getAuthHeaders(tenantCode?: string): Record<string, string>;
/**
 * Returns headers including Authorization Bearer token
 */
export declare function getAuthenticatedHeaders(tenantCode?: string): Promise<Record<string, string>>;
//# sourceMappingURL=api-auth-helper.d.ts.map