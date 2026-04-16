/**
 * UUID Parameter Validation Middleware
 * Validates that a route parameter is a valid UUID v4 format.
 * Rejects requests early with 400 if the param is not a valid UUID,
 * preventing unnecessary database queries with malformed IDs.
 */
import { z } from 'zod';
const uuidSchema = z.string().uuid();
/**
 * Creates middleware that validates a named route parameter as UUID.
 *
 * @param paramName - The route parameter name to validate (default: 'id')
 * @returns Express middleware that returns 400 if the param is not a valid UUID
 *
 * @example
 * // Single param
 * router.get('/:id', validateUUID(), asyncHandler(async (req, res) => { ... }));
 *
 * // Named param
 * router.get('/:employeeId', validateUUID('employeeId'), asyncHandler(async (req, res) => { ... }));
 */
export function validateUUID(paramName = 'id') {
    return (req, res, next) => {
        const value = req.params[paramName];
        if (!value || !uuidSchema.safeParse(value).success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: `Invalid ${paramName} format — must be a valid UUID`,
                },
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=validateUUID.js.map