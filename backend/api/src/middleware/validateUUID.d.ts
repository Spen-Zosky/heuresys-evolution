/**
 * UUID Parameter Validation Middleware
 * Validates that a route parameter is a valid UUID v4 format.
 * Rejects requests early with 400 if the param is not a valid UUID,
 * preventing unnecessary database queries with malformed IDs.
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function validateUUID(paramName?: string): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validateUUID.d.ts.map