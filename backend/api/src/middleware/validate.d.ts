/**
 * Zod Validation Middleware
 * Validates request body, query params, or route params against a Zod schema.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
type ValidationTarget = 'body' | 'query' | 'params';
export declare function validate(schema: ZodSchema, target?: ValidationTarget): (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validate.d.ts.map