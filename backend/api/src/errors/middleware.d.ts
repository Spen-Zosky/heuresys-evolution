/**
 * Heuresys Error Middleware
 *
 * Middleware Express per gestire tutti gli errori in modo strutturato e consistente.
 * Trasforma qualsiasi errore in HeuresysError e genera risposte API standardizzate.
 */
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { HeuresysError } from './types.js';
/**
 * Configurazione del middleware
 */
export interface ErrorMiddlewareConfig {
    /**
     * Ambiente di esecuzione
     */
    environment: 'development' | 'production' | 'test';
    /**
     * Abilita logging su console
     */
    enableConsoleLogging: boolean;
    /**
     * Funzione custom per logging esterno (Sentry, LogDNA, etc.)
     */
    externalLogger?: (error: HeuresysError) => void;
    /**
     * Abilita stack trace nelle risposte (solo dev)
     */
    includeStackTrace: boolean;
    /**
     * Headers custom da includere nella risposta
     */
    customHeaders?: Record<string, string>;
    /**
     * Callback per notifiche critiche (email, Slack, etc.)
     */
    onCriticalError?: (error: HeuresysError) => void;
}
/**
 * Crea il middleware di gestione errori
 */
export declare function createErrorMiddleware(customConfig?: Partial<ErrorMiddlewareConfig>): ErrorRequestHandler;
/**
 * Middleware per catturare errori async in route handlers
 * Wrap per route async che non catturano i propri errori
 */
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware per 404 Not Found
 */
export declare function notFoundHandler(req: Request, _res: Response, next: NextFunction): void;
/**
 * Export del middleware con configurazione di default
 */
export declare const errorMiddleware: ErrorRequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Utility per creare errori e passarli a next()
 */
export declare function throwError(error: HeuresysError, next: NextFunction): void;
/**
 * Utility per rispondere con successo in modo standardizzato
 */
export declare function sendSuccess<T>(res: Response, data: T, meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
}): void;
/**
 * Utility per rispondere con successo e paginazione
 */
export declare function sendPaginatedSuccess<T>(res: Response, data: T[], pagination: {
    page: number;
    pageSize: number;
    total: number;
}): void;
/**
 * Utility per rispondere con creazione riuscita (201)
 */
export declare function sendCreated<T>(res: Response, data: T, location?: string): void;
/**
 * Utility per rispondere con nessun contenuto (204)
 */
export declare function sendNoContent(res: Response): void;
//# sourceMappingURL=middleware.d.ts.map