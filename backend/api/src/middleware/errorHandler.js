/**
 * Global error handler middleware
 */
import { ErrorCodes } from '@heuresys/shared';
import { logger } from '../config/logger.js';
export function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || 500;
    const code = err.code || ErrorCodes.INTERNAL_ERROR;
    const message = err.message || 'Internal Server Error';
    // Log error
    logger.error({
        err,
        code,
        path: req.path,
        method: req.method,
    }, `[${req.requestId}] Error: ${message}`);
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            details: err.details,
            requestId: req.requestId,
        },
    });
}
/**
 * Not found handler
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: ErrorCodes.NOT_FOUND,
            message: `Route ${req.method} ${req.path} not found`,
            requestId: req.requestId,
        },
    });
}
/**
 * Create typed error
 */
export function createAppError(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, details) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    if (details !== undefined) {
        error.details = details;
    }
    return error;
}
//# sourceMappingURL=errorHandler.js.map