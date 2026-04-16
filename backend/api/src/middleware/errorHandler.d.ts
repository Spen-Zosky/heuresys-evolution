/**
 * Global error handler middleware
 */
import { Request, Response, NextFunction } from 'express';
export interface AppError extends Error {
    statusCode?: number;
    code?: string;
    details?: Record<string, unknown>;
}
export declare function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void;
/**
 * Not found handler
 */
export declare function notFoundHandler(req: Request, res: Response): void;
/**
 * Create typed error
 */
export declare function createAppError(message: string, statusCode?: number, code?: string, details?: Record<string, unknown>): AppError;
//# sourceMappingURL=errorHandler.d.ts.map