/**
 * Zod Validation Middleware
 * Validates request body, query params, or route params against a Zod schema.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = formatZodError(result.error);
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }
    // Replace with parsed (coerced/transformed) data.
    // In Express 5, req.query and req.params are getter-only properties,
    // so direct assignment throws. Use Object.defineProperty to override.
    if (target === 'query' || target === 'params') {
      Object.defineProperty(req, target, {
        value: result.data,
        writable: true,
        configurable: true,
      });
    } else {
      req[target] = result.data;
    }
    next();
  };
}

function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
