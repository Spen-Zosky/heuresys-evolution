/**
 * Error Handler Middleware Unit Tests
 * Tests for global error handling, AppError creation, and notFoundHandler
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, createAppError } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';
import type { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '@heuresys/shared';

// Helper to build mock request
function mockRequest(overrides: Record<string, unknown> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/test',
    requestId: 'req-test-id-1234',
    headers: {},
    ...overrides,
  };
}

// Helper to build mock response with chaining
function mockResponse() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe('errorHandler middleware', () => {
  let req: Partial<Request>;
  let res: Response;
  let next: NextFunction;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn() as unknown as NextFunction;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should return 500 for a standard Error with a generic message', () => {
    const err = new Error('Something went wrong') as AppError;

    errorHandler(err, req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Something went wrong',
        }),
      })
    );
  });

  it('should use the error message from the Error object', () => {
    const err = new Error('Database connection failed') as AppError;

    errorHandler(err, req as Request, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { message: string } };
    expect(body.error.message).toBe('Database connection failed');
  });

  it('should return custom status code from AppError', () => {
    const err = createAppError('Resource not found', 404, ErrorCodes.NOT_FOUND);

    errorHandler(err, req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return custom error code from AppError', () => {
    const err = createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);

    errorHandler(err, req as Request, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('should include details from AppError when provided', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const err = createAppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR, details);

    errorHandler(err, req as Request, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { details: Record<string, unknown> } };
    expect(body.error.details).toEqual(details);
  });

  it('should include requestId from req in error response', () => {
    const reqWithId = mockRequest({ requestId: 'abc-req-123' });
    const err = new Error('test error') as AppError;

    errorHandler(err, reqWithId as Request, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { requestId: string } };
    expect(body.error.requestId).toBe('abc-req-123');
  });

  it('should handle undefined requestId gracefully', () => {
    const reqNoId = mockRequest({ requestId: undefined });
    const err = new Error('test') as AppError;

    errorHandler(err, reqNoId as Request, res, next);

    // Should not throw, requestId will be undefined in response
    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { requestId: unknown } };
    expect(body.error.requestId).toBeUndefined();
  });

  it('should default to INTERNAL_ERROR code when error has no code', () => {
    const err = new Error('generic') as AppError;

    errorHandler(err, req as Request, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  it('should set success to false in the response body', () => {
    const err = new Error('fail') as AppError;

    errorHandler(err, req as Request, res, next);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('should log the error with request context', () => {
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const err = new Error('logged error') as AppError;
    const reqForLog = mockRequest({ requestId: 'log-req-id', path: '/api/test', method: 'POST' });

    errorHandler(err, reqForLog as Request, res, next);

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        path: '/api/test',
        method: 'POST',
      }),
      expect.stringContaining('logged error')
    );
    loggerSpy.mockRestore();
  });

  it('should log the error stack trace via structured logger', () => {
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const err = new Error('stack-error') as AppError;

    errorHandler(err, req as Request, res, next);

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: 'stack-error',
        }),
      }),
      expect.stringContaining('stack-error')
    );
    loggerSpy.mockRestore();
  });

  it('should handle error with no message by defaulting to Internal Server Error', () => {
    const err = { statusCode: 502 } as AppError;
    // Error without message property
    Object.defineProperty(err, 'message', { value: '', writable: true });

    errorHandler(err, req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});

describe('notFoundHandler', () => {
  let res: Response;

  beforeEach(() => {
    res = mockResponse();
  });

  it('should return 404 status code', () => {
    const req = mockRequest({ method: 'GET', path: '/unknown' });

    notFoundHandler(req as Request, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return NOT_FOUND error code', () => {
    const req = mockRequest({ method: 'GET', path: '/missing' });

    notFoundHandler(req as Request, res);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCodes.NOT_FOUND);
  });

  it('should include method and path in the error message', () => {
    const req = mockRequest({ method: 'POST', path: '/api/nonexistent' });

    notFoundHandler(req as Request, res);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { message: string } };
    expect(body.error.message).toContain('POST');
    expect(body.error.message).toContain('/api/nonexistent');
  });

  it('should include requestId in the 404 response', () => {
    const req = mockRequest({ requestId: 'not-found-req-456' });

    notFoundHandler(req as Request, res);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { requestId: string } };
    expect(body.error.requestId).toBe('not-found-req-456');
  });

  it('should set success to false', () => {
    const req = mockRequest();

    notFoundHandler(req as Request, res);

    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { success: boolean };
    expect(body.success).toBe(false);
  });
});

describe('createAppError', () => {
  it('should create an Error instance', () => {
    const err = createAppError('test error');
    expect(err).toBeInstanceOf(Error);
  });

  it('should set the message', () => {
    const err = createAppError('Something broke');
    expect(err.message).toBe('Something broke');
  });

  it('should default statusCode to 500', () => {
    const err = createAppError('default status');
    expect(err.statusCode).toBe(500);
  });

  it('should default code to INTERNAL_ERROR', () => {
    const err = createAppError('default code');
    expect(err.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  it('should accept custom statusCode', () => {
    const err = createAppError('not found', 404);
    expect(err.statusCode).toBe(404);
  });

  it('should accept custom error code', () => {
    const err = createAppError('bad input', 400, ErrorCodes.VALIDATION_ERROR);
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('should include details when provided', () => {
    const details = { fields: ['name', 'email'], reason: 'missing' };
    const err = createAppError('validation', 400, ErrorCodes.VALIDATION_ERROR, details);
    expect(err.details).toEqual(details);
  });

  it('should not include details property when not provided', () => {
    const err = createAppError('no details', 500, ErrorCodes.INTERNAL_ERROR);
    expect(err.details).toBeUndefined();
  });

  it('should have a stack trace', () => {
    const err = createAppError('with stack');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('with stack');
  });
});

describe('errorHandler integration scenarios', () => {
  let res: Response;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    res = mockResponse();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle validation errors (400) end-to-end', () => {
    const req = mockRequest({ requestId: 'val-req-001' });
    const err = createAppError('Invalid email format', 400, ErrorCodes.VALIDATION_ERROR, {
      field: 'email',
      value: 'not-an-email',
    });

    errorHandler(err, req as Request, res, jest.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as {
      success: boolean;
      error: { code: string; message: string; details: Record<string, unknown>; requestId: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(body.error.message).toBe('Invalid email format');
    expect(body.error.details).toEqual({ field: 'email', value: 'not-an-email' });
    expect(body.error.requestId).toBe('val-req-001');
  });

  it('should handle unauthorized errors (401) end-to-end', () => {
    const req = mockRequest({ requestId: 'auth-req-002' });
    const err = createAppError('Token expired', 401, ErrorCodes.TOKEN_EXPIRED);

    errorHandler(err, req as Request, res, jest.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe(ErrorCodes.TOKEN_EXPIRED);
    expect(body.error.message).toBe('Token expired');
  });

  it('should handle SyntaxError (JSON parse) as 500 by default', () => {
    const req = mockRequest();
    const err = new SyntaxError('Unexpected token < in JSON at position 0') as AppError;

    errorHandler(err, req as Request, res, jest.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { message: string } };
    expect(body.error.message).toContain('Unexpected token');
  });

  it('should handle service unavailable errors (503)', () => {
    const req = mockRequest();
    const err = createAppError('Database unreachable', 503, ErrorCodes.SERVICE_UNAVAILABLE);

    errorHandler(err, req as Request, res, jest.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(503);
    const jsonCall = (res.json as jest.Mock).mock.calls[0] as [Record<string, unknown>];
    const body = jsonCall[0] as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
  });
});
