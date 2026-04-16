/**
 * Global error handler middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from '@heuresys/shared';
import { logger } from '../config/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || ErrorCodes.INTERNAL_ERROR;
  const message = err.message || 'Internal Server Error';

  // Log error
  logger.error(
    {
      err,
      code,
      path: req.path,
      method: req.method,
    },
    `[${req.requestId}] Error: ${message}`
  );

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
export function notFoundHandler(req: Request, res: Response): void {
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
export function createAppError(
  message: string,
  statusCode: number = 500,
  code: string = ErrorCodes.INTERNAL_ERROR,
  details?: Record<string, unknown>
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}
