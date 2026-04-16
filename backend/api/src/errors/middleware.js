/**
 * Heuresys Error Middleware
 *
 * Middleware Express per gestire tutti gli errori in modo strutturato e consistente.
 * Trasforma qualsiasi errore in HeuresysError e genera risposte API standardizzate.
 */
import { ErrorCodes } from './types.js';
import { isHeuresysError, toHeuresysError, sanitizeForClient, extractRequestContext, Errors, } from './factory.js';
import { isPostgresError, handleDatabaseError } from './database.js';
import { logger } from '../config/logger.js';
/**
 * Configurazione di default
 */
const defaultConfig = {
    environment: process.env.NODE_ENV || 'development',
    enableConsoleLogging: true,
    includeStackTrace: process.env.NODE_ENV !== 'production',
};
/**
 * Logger strutturato per errori
 */
function logError(error, config) {
    const logEntry = {
        timestamp: error.timestamp,
        errorId: error.errorId,
        level: error.severity,
        code: error.code,
        category: error.category,
        message: error.message,
        httpStatus: error.httpStatus,
        request: error.requestContext
            ? {
                method: error.requestContext.method,
                path: error.requestContext.path,
                userId: error.requestContext.userId,
                tenantId: error.requestContext.tenantId,
                ip: error.requestContext.ip,
                requestId: error.requestContext.headers?.['x-request-id'],
            }
            : undefined,
        database: error.databaseContext
            ? {
                table: error.databaseContext.table,
                column: error.databaseContext.column,
                constraint: error.databaseContext.constraint,
                sqlState: error.databaseContext.errorCode,
            }
            : undefined,
        stack: config.includeStackTrace ? error.debugContext?.stackTrace : undefined,
    };
    if (config.enableConsoleLogging) {
        const logFn = error.severity === 'CRITICAL' || error.severity === 'ERROR'
            ? console.error
            : error.severity === 'WARNING'
                ? console.warn
                : console.log;
        // Formato JSON per parsing da log aggregators
        logFn(JSON.stringify(logEntry, null, config.environment === 'development' ? 2 : 0));
    }
    // Logger esterno (Sentry, etc.)
    if (config.externalLogger) {
        try {
            config.externalLogger(error);
        }
        catch (logError) {
            logger.error({ err: logError }, '[ErrorMiddleware] External logger failed:');
        }
    }
}
/**
 * Notifica errori critici
 */
function handleCriticalError(error, config) {
    if (error.severity === 'CRITICAL' && config.onCriticalError) {
        try {
            config.onCriticalError(error);
        }
        catch (notifyError) {
            logger.error({ err: notifyError }, '[ErrorMiddleware] Critical error notification failed:');
        }
    }
}
/**
 * Genera la risposta API standardizzata
 */
function buildErrorResponse(error, config) {
    const isProduction = config.environment === 'production';
    const sanitizedError = sanitizeForClient(error, isProduction);
    const response = {
        success: false,
        error: {
            errorId: sanitizedError.errorId,
            code: sanitizedError.code,
            category: sanitizedError.category,
            severity: sanitizedError.severity,
            message: sanitizedError.message,
            httpStatus: sanitizedError.httpStatus,
            timestamp: sanitizedError.timestamp,
            retryable: sanitizedError.retryable ?? false,
            suggestion: sanitizedError.suggestion,
            documentationUrl: sanitizedError.documentationUrl,
        },
        meta: {
            requestId: error.requestContext?.headers?.['x-request-id'] || error.errorId,
            timestamp: sanitizedError.timestamp,
        },
    };
    // Includi dettagli aggiuntivi in dev
    if (!isProduction && sanitizedError.details) {
        response.error.details = sanitizedError.details;
    }
    // Includi contesto database in dev
    if (!isProduction && error.databaseContext) {
        response.error.databaseContext = {
            table: error.databaseContext.table,
            column: error.databaseContext.column,
            constraint: error.databaseContext.constraint,
            sqlState: error.databaseContext.errorCode,
            hint: error.databaseContext.hint,
        };
    }
    // Includi stack trace in dev
    if (config.includeStackTrace && error.debugContext?.stackTrace) {
        response.error.debugContext = {
            stackTrace: error.debugContext.stackTrace,
            functionName: error.debugContext.functionName,
            errorType: error.debugContext.errorType,
        };
    }
    return response;
}
/**
 * Crea il middleware di gestione errori
 */
export function createErrorMiddleware(customConfig) {
    const config = { ...defaultConfig, ...customConfig };
    return (err, req, res, next) => {
        // Se headers già inviati, delega a Express
        if (res.headersSent) {
            return next(err);
        }
        let heuresysError;
        // 1. Trasforma in HeuresysError se necessario
        if (isHeuresysError(err)) {
            heuresysError = err;
            // Aggiungi contesto richiesta se mancante
            if (!heuresysError.requestContext) {
                heuresysError.requestContext = extractRequestContext(req);
            }
        }
        else if ('statusCode' in err && typeof err.statusCode === 'number') {
            // Legacy AppError (from createAppError in errorHandler.ts)
            // Check this BEFORE isPostgresError since legacy errors may have .code property
            heuresysError = toHeuresysError(err, req);
        }
        else if (isPostgresError(err)) {
            // Errori PostgreSQL
            heuresysError = handleDatabaseError(err);
            heuresysError.requestContext = extractRequestContext(req);
        }
        else if (err instanceof SyntaxError && 'body' in err) {
            // Errori di parsing JSON
            heuresysError = Errors.badRequest('JSON non valido nel corpo della richiesta', {
                parseError: err.message,
            });
            heuresysError.requestContext = extractRequestContext(req);
        }
        else {
            // Tutti gli altri errori
            heuresysError = toHeuresysError(err, req);
        }
        // 2. Log dell'errore
        logError(heuresysError, config);
        // 3. Gestione errori critici
        handleCriticalError(heuresysError, config);
        // 4. Costruisci risposta
        const errorResponse = buildErrorResponse(heuresysError, config);
        // 5. Imposta headers
        res.setHeader('X-Error-Id', heuresysError.errorId);
        res.setHeader('X-Request-Id', heuresysError.requestContext?.headers?.['x-request-id'] || heuresysError.errorId);
        if (heuresysError.retryable) {
            res.setHeader('X-Retryable', 'true');
            // Per rate limiting, aggiungi Retry-After
            if (heuresysError.code === ErrorCodes.API.RATE_LIMITED && heuresysError.details?.retryAfter) {
                res.setHeader('Retry-After', String(heuresysError.details.retryAfter));
            }
        }
        // Headers custom
        if (config.customHeaders) {
            Object.entries(config.customHeaders).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }
        // 6. Invia risposta
        res.status(heuresysError.httpStatus).json(errorResponse);
    };
}
/**
 * Middleware per catturare errori async in route handlers
 * Wrap per route async che non catturano i propri errori
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
/**
 * Middleware per 404 Not Found
 */
export function notFoundHandler(req, _res, next) {
    const error = Errors.notFound('Endpoint', `${req.method} ${req.originalUrl}`);
    error.requestContext = extractRequestContext(req);
    next(error);
}
/**
 * Export del middleware con configurazione di default
 */
export const errorMiddleware = createErrorMiddleware();
/**
 * Utility per creare errori e passarli a next()
 */
export function throwError(error, next) {
    next(error);
}
/**
 * Utility per rispondere con successo in modo standardizzato
 */
export function sendSuccess(res, data, meta) {
    const response = {
        success: true,
        data,
        meta: meta
            ? {
                ...meta,
                timestamp: new Date().toISOString(),
            }
            : {
                timestamp: new Date().toISOString(),
            },
    };
    res.json(response);
}
/**
 * Utility per rispondere con successo e paginazione
 */
export function sendPaginatedSuccess(res, data, pagination) {
    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
    sendSuccess(res, data, {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        hasMore: pagination.page < totalPages,
    });
}
/**
 * Utility per rispondere con creazione riuscita (201)
 */
export function sendCreated(res, data, location) {
    if (location) {
        res.setHeader('Location', location);
    }
    res.status(201).json({
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
        },
    });
}
/**
 * Utility per rispondere con nessun contenuto (204)
 */
export function sendNoContent(res) {
    res.status(204).send();
}
//# sourceMappingURL=middleware.js.map