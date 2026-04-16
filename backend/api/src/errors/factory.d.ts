/**
 * Heuresys Error Factory
 *
 * Factory per creare errori strutturati e consistenti.
 * Garantisce che ogni errore abbia tutte le informazioni necessarie
 * per debugging e troubleshooting.
 */
import { Request } from 'express';
import { HeuresysError, ErrorCategory, ErrorSeverity, RequestContext, DebugContext, DatabaseContext } from './types.js';
/**
 * Genera un ID univoco per la correlazione degli errori
 */
export declare function generateErrorId(): string;
/**
 * Estrae il contesto della richiesta per il debugging
 */
export declare function extractRequestContext(req: Request): RequestContext;
/**
 * Determina la categoria dell'errore dal codice
 */
export declare function getCategoryFromCode(code: string): ErrorCategory;
/**
 * Determina la severità predefinita per categoria
 */
export declare function getDefaultSeverity(category: ErrorCategory): ErrorSeverity;
/**
 * Ottiene il messaggio localizzato per un codice errore
 */
export declare function getErrorMessage(code: string, lang?: 'it' | 'en'): {
    message: string;
    suggestion?: string;
};
/**
 * Opzioni per creare un HeuresysError
 */
export interface CreateErrorOptions {
    code: string;
    message?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    httpStatus?: number;
    details?: Record<string, unknown>;
    debugContext?: DebugContext;
    databaseContext?: DatabaseContext;
    originalError?: Error;
    retryable?: boolean;
    suggestion?: string;
    documentationUrl?: string;
}
/**
 * Crea un HeuresysError strutturato
 */
export declare function createHeuresysError(options: CreateErrorOptions, req?: Request): HeuresysError;
/**
 * Builder pattern per costruire errori in modo fluido
 */
export declare class HeuresysErrorBuilder {
    private options;
    private request?;
    static create(code: string): HeuresysErrorBuilder;
    withMessage(message: string): this;
    withCategory(category: ErrorCategory): this;
    withSeverity(severity: ErrorSeverity): this;
    withHttpStatus(status: number): this;
    withDetails(details: Record<string, unknown>): this;
    withDebugContext(context: DebugContext): this;
    withDatabaseContext(context: DatabaseContext): this;
    withOriginalError(error: Error): this;
    withRequest(req: Request): this;
    retryable(value?: boolean): this;
    withSuggestion(suggestion: string): this;
    withDocumentation(url: string): this;
    build(): HeuresysError;
}
/**
 * Shortcut functions per errori comuni
 */
export declare const Errors: {
    badRequest: (message?: string, details?: Record<string, unknown>) => HeuresysError;
    notFound: (resource: string, id?: string) => HeuresysError;
    methodNotAllowed: (method: string, path: string) => HeuresysError;
    conflict: (message: string, details?: Record<string, unknown>) => HeuresysError;
    tooManyRequests: (retryAfter: number) => HeuresysError;
    unauthorized: (message?: string) => HeuresysError;
    tokenExpired: () => HeuresysError;
    tokenInvalid: () => HeuresysError;
    accountDisabled: () => HeuresysError;
    invalidCredentials: () => HeuresysError;
    validationFailed: (errors: Array<{
        field: string;
        message: string;
        code?: string;
    }>) => HeuresysError;
    requiredField: (field: string) => HeuresysError;
    invalidFormat: (field: string, expected: string) => HeuresysError;
    businessRule: (rule: string, details?: Record<string, unknown>) => HeuresysError;
    operationNotPermitted: (operation: string, reason: string) => HeuresysError;
    forbidden: (resource: string, action: string) => HeuresysError;
    insufficientRole: (requiredRole: string, currentRole: string) => HeuresysError;
    tenantRequired: () => HeuresysError;
    tenantNotFound: (code: string) => HeuresysError;
    tenantInactive: (code: string) => HeuresysError;
    internal: (message?: string, originalError?: Error) => HeuresysError;
    serviceUnavailable: (service: string) => HeuresysError;
    configurationError: (component: string, issue: string) => HeuresysError;
};
/**
 * Verifica se un errore è un HeuresysError
 */
export declare function isHeuresysError(error: unknown): error is HeuresysError;
/**
 * Converte un errore generico in HeuresysError
 */
export declare function toHeuresysError(error: unknown, req?: Request): HeuresysError;
/**
 * Sanitizza un errore per la risposta client (rimuove info sensibili)
 */
export declare function sanitizeForClient(error: HeuresysError, isProduction?: boolean): Partial<HeuresysError>;
//# sourceMappingURL=factory.d.ts.map