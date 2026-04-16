/**
 * Heuresys Database Error Handler
 *
 * Gestisce e trasforma gli errori PostgreSQL in HeuresysError strutturati.
 * Mappa i codici di errore PostgreSQL a messaggi user-friendly e HTTP status appropriati.
 */
import { HeuresysError, DatabaseContext } from './types.js';
/**
 * Struttura di un errore PostgreSQL
 */
export interface PostgresError extends Error {
    code?: string;
    severity?: string;
    detail?: string;
    hint?: string;
    position?: string;
    internalPosition?: string;
    internalQuery?: string;
    where?: string;
    schema?: string;
    table?: string;
    column?: string;
    dataType?: string;
    constraint?: string;
    file?: string;
    line?: string;
    routine?: string;
}
/**
 * Mapping completo dei codici SQLSTATE PostgreSQL
 * Ref: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export declare const PostgresErrorMapping: Record<string, {
    heuresysCode: string;
    httpStatus: number;
    messagePrefix: string;
    category: 'constraint' | 'connection' | 'data' | 'syntax' | 'access' | 'system' | 'transaction';
}>;
/**
 * Estrae informazioni contestuali da un errore PostgreSQL
 */
export declare function extractDatabaseContext(error: PostgresError): DatabaseContext;
/**
 * Converte un errore PostgreSQL in HeuresysError
 */
export declare function handleDatabaseError(error: PostgresError, query?: string): HeuresysError;
/**
 * Verifica se un errore è un errore PostgreSQL
 */
export declare function isPostgresError(error: unknown): error is PostgresError;
/**
 * Wrapper per query con error handling automatico
 */
export declare function safeQuery<T>(queryFn: () => Promise<T>, queryString?: string): Promise<T>;
//# sourceMappingURL=database.d.ts.map