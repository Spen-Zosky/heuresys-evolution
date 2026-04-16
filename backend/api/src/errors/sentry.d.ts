/**
 * Heuresys Sentry Integration
 *
 * External error reporting integration with Sentry.
 * Provides structured error capture with tenant context and sensitive data filtering.
 */
import { HeuresysError } from './types.js';
/**
 * Sentry configuration options
 */
export interface SentryConfig {
    dsn?: string;
    environment?: string;
    release?: string;
    sampleRate?: number;
    tracesSampleRate?: number;
    tags?: Record<string, string>;
    debug?: boolean;
    enabled?: boolean;
}
/**
 * Initialize Sentry with configuration
 */
export declare function initSentry(config?: SentryConfig): void;
/**
 * Error logger for the error middleware
 */
export declare function sentryErrorLogger(error: HeuresysError): void;
/**
 * Capture any exception with optional context
 */
export declare function captureException(error: Error | HeuresysError, context?: Record<string, unknown>): void;
/**
 * Set user context for error tracking
 */
export declare function setUser(userId: string, tenantId?: string, additionalData?: Record<string, unknown>): void;
/**
 * Clear user context
 */
export declare function clearUser(): void;
/**
 * Add breadcrumb for debugging
 */
export declare function addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void;
/**
 * Capture a message
 */
export declare function captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, unknown>): void;
/**
 * Flush pending events
 */
export declare function flush(timeout?: number): Promise<boolean>;
/**
 * Close Sentry client
 */
export declare function close(timeout?: number): Promise<boolean>;
/**
 * Check if Sentry is active
 */
export declare function isActive(): boolean;
//# sourceMappingURL=sentry.d.ts.map