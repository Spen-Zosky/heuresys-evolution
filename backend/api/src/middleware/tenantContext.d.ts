/**
 * Tenant Context Middleware
 * Extracts and validates tenant information from requests
 * Sets the tenant context for Row-Level Security
 * Validates tenant access against authenticated user's JWT claims
 */
import { Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
            tenantCode?: string;
            tenant?: {
                id: string;
                code: string;
                name: string;
                status: string;
            };
            /**
             * When true, SUPERUSER has selected "All Tenants" — no tenant filter applied.
             * Routes should aggregate across all tenants instead of filtering by tenant_id.
             */
            allTenants?: boolean;
            /**
             * Per-request database client from appPool with transaction-scoped
             * tenant context (app.current_tenant_id set via set_config(..., true)).
             *
             * Available after tenantContextMiddleware runs successfully.
             * Automatically released when the response finishes.
             * Routes can use this for RLS-enforced queries instead of pool.query().
             */
            dbClient?: PoolClient;
        }
    }
}
/**
 * Middleware to extract tenant from request
 * Supports multiple methods:
 * - Header: X-Tenant-ID or X-Tenant-Code
 * - Path parameter: /tenants/:tenantId/* or /tenants/:code/*
 * - Query parameter: ?tenant_id= or ?tenant_code=
 * - JWT token (when implemented)
 */
export interface TenantRequest extends Request {
    tenantId: string;
    tenantCode: string;
    tenant: {
        id: string;
        code: string;
        name: string;
        status: string;
    };
}
export declare function tenantContextMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware that requires tenant context
 * Use this for routes that must have a valid tenant
 */
export declare function requireTenant(req: Request, _res: Response, next: NextFunction): void;
/**
 * Clear tenant cache (call when tenant is updated)
 */
export declare function clearTenantCache(tenantId?: string, tenantCode?: string): void;
/**
 * Get tenant ID from request or throw error
 */
export declare function getTenantIdOrThrow(req: Request): string;
/**
 * Get tenant ID or null when SUPERUSER has "All Tenants" selected.
 * Returns null ONLY if the user is a SUPERUSER with allTenants flag.
 * For any other role, always returns the tenant ID or throws.
 */
export declare function getTenantIdOrAll(req: Request): string | null;
//# sourceMappingURL=tenantContext.d.ts.map