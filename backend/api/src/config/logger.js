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
// NodeNext CJS interop: pino-http is CJS, so the default import
// yields the module namespace. The callable factory is at .default.
const pinoHttp = pinoHttpModule.default;
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
/**
 * Root application logger instance.
 * Use this for structured logging throughout the API gateway.
 */
export const logger = pino({
    level: logLevel,
    base: {
        service: 'api-gateway',
        version: '1.0.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(process.env.NODE_ENV !== 'production'
        ? {
            transport: {
                target: 'pino/file',
                options: { destination: 1 }, // stdout
            },
        }
        : {}),
});
/**
 * Creates pino-http middleware for Express request/response logging.
 * Inherits the root logger configuration.
 */
export function createHttpLogger() {
    return pinoHttp({
        logger,
        // Use existing request ID if present (set by requestIdMiddleware)
        genReqId: (req) => req.headers['x-request-id'] || '',
        // Customize serializers to avoid logging sensitive headers
        serializers: {
            req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
            }),
            res: (res) => ({
                statusCode: res.statusCode,
            }),
        },
        // Customize log level based on response status code
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) {
                return 'error';
            }
            if (res.statusCode >= 400) {
                return 'warn';
            }
            return 'info';
        },
        // Customize the success message
        customSuccessMessage: (req, res) => {
            return `${req.method} ${req.url} ${res.statusCode}`;
        },
        // Customize the error message
        customErrorMessage: (_req, res) => {
            return `request failed with status ${res.statusCode}`;
        },
    });
}
//# sourceMappingURL=logger.js.map