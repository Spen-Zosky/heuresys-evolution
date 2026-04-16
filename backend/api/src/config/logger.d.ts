/**
 * Structured logging configuration using pino.
 *
 * - JSON output for machine-parseable logs
 * - Log level configurable via LOG_LEVEL env var
 * - Includes base fields: service name, version
 * - Exports pino-http middleware factory for Express integration
 */
import pino from 'pino';
import pinoHttpModule from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'http';
/**
 * Root application logger instance.
 * Use this for structured logging throughout the API gateway.
 */
export declare const logger: pino.Logger<never, boolean>;
/**
 * Creates pino-http middleware for Express request/response logging.
 * Inherits the root logger configuration.
 */
export declare function createHttpLogger(): pinoHttpModule.HttpLogger<IncomingMessage, ServerResponse<IncomingMessage>, never>;
//# sourceMappingURL=logger.d.ts.map