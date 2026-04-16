/**
 * Tenant Isolation Integration Tests
 * Verifies multi-tenant data isolation across API endpoints.
 *
 * These tests authenticate via the live API login endpoint to obtain real
 * JWTs for two distinct tenants (RTL Bank and SmartFood), then verify that:
 *   1. Each tenant only sees its own employees and departments
 *   2. Cross-tenant data access is blocked (returns error, not data)
 *   3. Cross-tenant mutations (PATCH/DELETE) are rejected
 *   4. Tenant header mismatch with JWT tenant is blocked
 *
 * NOTE on HTTP status codes:
 *   The error middleware may transform specific status codes (e.g. 404, 403)
 *   into 500 for certain routes. The critical assertion is that `success` is
 *   `false` and no cross-tenant data is returned. Where the expected status
 *   code is ambiguous, we accept a range of error codes.
 *
 * Prerequisites:
 *   - API gateway running on localhost:8012
 *   - Database populated with RTL Bank and SmartFood tenants
 */
export {};
//# sourceMappingURL=tenant-isolation.test.d.ts.map