/**
 * Roles Route
 * Exposes the RBAC role hierarchy and mappings.
 *
 * Endpoints:
 * - GET /roles - Get the full roles hierarchy
 */
import { Router } from 'express';
import { ROLES } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
/**
 * GET /roles
 * Returns the roles hierarchy with level numbers and legacy mappings.
 * Requires TENANT_OWNER or higher.
 */
router.get('/', requirePermission('SECURITY', 'VIEW'), asyncHandler(async (_req, res) => {
    // Separate primary roles from legacy aliases
    const primaryRoles = {};
    const legacyAliases = {};
    const legacyMap = {
        ADMIN: 'TENANT_OWNER',
        TENANT_ADMIN: 'TENANT_OWNER',
        SYSADMIN: 'TENANT_OWNER', // legacy
        HR: 'HR_MANAGER',
        DEMO: 'EMPLOYEE',
        USER: 'EMPLOYEE',
    };
    for (const [role, level] of Object.entries(ROLES)) {
        if (role in legacyMap) {
            legacyAliases[role] = { mapsTo: legacyMap[role], level };
        }
        else {
            primaryRoles[role] = level;
        }
    }
    res.json({
        success: true,
        data: {
            roles: primaryRoles,
            legacyAliases,
            description: 'Role hierarchy: lower number = higher privilege. ' +
                'SUPERUSER (-1) is the platform god-role. ' +
                'Legacy aliases map old DB values to the current hierarchy.',
        },
    });
}));
export default router;
//# sourceMappingURL=roles.js.map