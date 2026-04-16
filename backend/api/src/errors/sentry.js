/**
 * Heuresys Sentry Integration
 *
 * External error reporting integration with Sentry.
 * Provides structured error capture with tenant context and sensitive data filtering.
 */
import * as Sentry from '@sentry/node';
import { isHeuresysError } from './factory.js';
import { logger } from '../config/logger.js';
let isInitialized = false;
let isEnabled = false;
/**
 * Sensitive keys to filter from error context
 */
const SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'apikey',
    'api_key',
    'authorization',
    'auth',
    'credential',
    'private',
    'ssn',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
];
/**
 * Filter sensitive data from objects
 */
function filterSensitiveData(obj) {
    if (!obj || typeof obj !== 'object')
        return obj;
    const filtered = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));
        if (isSensitive) {
            filtered[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            filtered[key] = Array.isArray(value)
                ? value.map((v) => (typeof v === 'object' ? filterSensitiveData(v) : v))
                : filterSensitiveData(value);
        }
        else {
            filtered[key] = value;
        }
    }
    return filtered;
}
/**
 * Initialize Sentry with configuration
 */
export function initSentry(config) {
    const dsn = config?.dsn || process.env.SENTRY_DSN;
    if (!dsn) {
        logger.info('[Sentry] No DSN configured, error reporting disabled');
        isEnabled = false;
        return;
    }
    try {
        const release = config?.release || process.env.npm_package_version;
        Sentry.init({
            dsn,
            environment: config?.environment || process.env.NODE_ENV || 'development',
            ...(release && { release }),
            sampleRate: config?.sampleRate ?? 1.0,
            tracesSampleRate: config?.tracesSampleRate ?? 0.1,
            debug: config?.debug ?? false,
            integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
            beforeSend(event, _hint) {
                // Filter sensitive data from the event
                if (event.extra) {
                    event.extra = filterSensitiveData(event.extra);
                }
                if (event.contexts) {
                    event.contexts = filterSensitiveData(event.contexts);
                }
                // Filter request data
                if (event.request?.data) {
                    event.request.data = filterSensitiveData(typeof event.request.data === 'string'
                        ? JSON.parse(event.request.data)
                        : event.request.data);
                }
                // Filter headers
                if (event.request?.headers) {
                    const headers = { ...event.request.headers };
                    delete headers['authorization'];
                    delete headers['cookie'];
                    delete headers['x-api-key'];
                    event.request.headers = headers;
                }
                return event;
            },
        });
        // Apply custom tags
        if (config?.tags) {
            for (const [key, value] of Object.entries(config.tags)) {
                Sentry.setTag(key, value);
            }
        }
        isInitialized = true;
        isEnabled = config?.enabled !== false;
        logger.info('[Sentry] Initialized successfully');
    }
    catch (error) {
        logger.error({ err: error }, '[Sentry] Failed to initialize:');
        isEnabled = false;
    }
}
/**
 * Error logger for the error middleware
 */
export function sentryErrorLogger(error) {
    if (!isEnabled || !isInitialized) {
        return;
    }
    Sentry.withScope((scope) => {
        // Set error ID as fingerprint for grouping
        scope.setFingerprint([error.code, error.category]);
        // Set severity
        const severityMap = {
            CRITICAL: 'fatal',
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info',
        };
        scope.setLevel(severityMap[error.severity] || 'error');
        // Set tags
        scope.setTag('error.code', error.code);
        scope.setTag('error.category', error.category);
        scope.setTag('error.severity', error.severity);
        scope.setTag('error.retryable', String(error.retryable));
        scope.setTag('http.status', String(error.httpStatus));
        // Set tenant context
        if (error.requestContext?.tenantId) {
            scope.setTag('tenant.id', error.requestContext.tenantId);
        }
        // Set user context
        if (error.requestContext?.userId) {
            scope.setUser({
                id: error.requestContext.userId,
                ...(error.requestContext.tenantId && { tenant: error.requestContext.tenantId }),
            });
        }
        // Set request context
        if (error.requestContext) {
            scope.setContext('request', filterSensitiveData({
                method: error.requestContext.method,
                path: error.requestContext.path,
                ip: error.requestContext.ip,
                userAgent: error.requestContext.userAgent,
                requestId: error.requestContext.headers?.['x-request-id'],
            }));
        }
        // Set database context if present
        if (error.databaseContext) {
            scope.setContext('database', filterSensitiveData({
                table: error.databaseContext.table,
                column: error.databaseContext.column,
                constraint: error.databaseContext.constraint,
                errorCode: error.databaseContext.errorCode,
                hint: error.databaseContext.hint,
            }));
        }
        // Set additional details
        if (error.details) {
            scope.setContext('details', filterSensitiveData(error.details));
        }
        // Capture the exception
        const captureError = new Error(error.message);
        captureError.name = error.code;
        if (error.debugContext?.stackTrace) {
            captureError.stack = error.debugContext.stackTrace;
        }
        Sentry.captureException(captureError, {
            extra: {
                errorId: error.errorId,
                suggestion: error.suggestion,
                documentationUrl: error.documentationUrl,
            },
        });
    });
}
/**
 * Capture any exception with optional context
 */
export function captureException(error, context) {
    if (!isEnabled || !isInitialized) {
        logger.error(`[Sentry] Not initialized, logging locally: ${String(error.message)}`);
        return;
    }
    if (isHeuresysError(error)) {
        sentryErrorLogger(error);
        return;
    }
    Sentry.withScope((scope) => {
        if (context) {
            scope.setContext('additional', filterSensitiveData(context));
        }
        Sentry.captureException(error);
    });
}
/**
 * Set user context for error tracking
 */
export function setUser(userId, tenantId, additionalData) {
    if (!isEnabled || !isInitialized)
        return;
    Sentry.setUser({
        id: userId,
        ...(tenantId && { tenant: tenantId }),
        ...(additionalData && filterSensitiveData(additionalData)),
    });
}
/**
 * Clear user context
 */
export function clearUser() {
    if (!isEnabled || !isInitialized)
        return;
    Sentry.setUser(null);
}
/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message, category, data) {
    if (!isEnabled || !isInitialized)
        return;
    const breadcrumb = {
        message,
        category: category || 'info',
        timestamp: Date.now() / 1000,
    };
    if (data) {
        breadcrumb.data = filterSensitiveData(data);
    }
    Sentry.addBreadcrumb(breadcrumb);
}
/**
 * Capture a message
 */
export function captureMessage(message, level = 'info', context) {
    if (!isEnabled || !isInitialized) {
        logger.info(`[Sentry] ${level.toUpperCase()}: ${message}`);
        return;
    }
    Sentry.withScope((scope) => {
        scope.setLevel(level);
        if (context) {
            scope.setContext('additional', filterSensitiveData(context));
        }
        Sentry.captureMessage(message);
    });
}
/**
 * Flush pending events
 */
export async function flush(timeout = 2000) {
    if (!isEnabled || !isInitialized)
        return true;
    return Sentry.flush(timeout);
}
/**
 * Close Sentry client
 */
export async function close(timeout = 2000) {
    if (!isEnabled || !isInitialized)
        return true;
    return Sentry.close(timeout);
}
/**
 * Check if Sentry is active
 */
export function isActive() {
    return isEnabled && isInitialized;
}
//# sourceMappingURL=sentry.js.map