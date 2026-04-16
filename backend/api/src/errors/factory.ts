/**
 * Heuresys Error Factory
 *
 * Factory per creare errori strutturati e consistenti.
 * Garantisce che ogni errore abbia tutte le informazioni necessarie
 * per debugging e troubleshooting.
 */

import { Request } from 'express';
import {
  HeuresysError,
  ErrorCategory,
  ErrorSeverity,
  ErrorCodes,
  RequestContext,
  DebugContext,
  DatabaseContext,
  ErrorMessageRegistry,
  ErrorToHttpStatus,
} from './types.js';

/**
 * Genera un ID univoco per la correlazione degli errori
 */
export function generateErrorId(): string {
  return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

/**
 * Estrae il contesto della richiesta per il debugging
 */
export function extractRequestContext(req: Request): RequestContext {
  return {
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    params: req.params as Record<string, string>,
    query: req.query as Record<string, string>,
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-request-id': req.headers['x-request-id'] as string,
      'x-tenant-code': req.headers['x-tenant-code'] as string,
      'content-type': req.headers['content-type'],
    },
    ip: req.ip || req.socket?.remoteAddress,
    userId: (req as any).user?.id,
    tenantId: (req as any).tenantId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Determina la categoria dell'errore dal codice
 */
export function getCategoryFromCode(code: string): ErrorCategory {
  const codeNum = parseInt(code);
  if (codeNum >= 1000 && codeNum < 2000) return 'API';
  if (codeNum >= 2000 && codeNum < 3000) return 'AUTH';
  if (codeNum >= 3000 && codeNum < 4000) return 'DB';
  if (codeNum >= 4000 && codeNum < 5000) return 'VALIDATION';
  if (codeNum >= 5000 && codeNum < 6000) return 'BUSINESS';
  if (codeNum >= 6000 && codeNum < 7000) return 'INTEGRATION';
  if (codeNum >= 7000 && codeNum < 8000) return 'SYSTEM';
  if (codeNum >= 8000 && codeNum < 9000) return 'PERMISSION';
  if (codeNum >= 9000 && codeNum < 10000) return 'TENANT';
  if (codeNum >= 10000) return 'AI';
  return 'API';
}

/**
 * Determina la severità predefinita per categoria
 */
export function getDefaultSeverity(category: ErrorCategory): ErrorSeverity {
  const severityMap: Record<ErrorCategory, ErrorSeverity> = {
    API: 'ERROR',
    AUTH: 'ERROR',
    DB: 'CRITICAL',
    VALIDATION: 'WARNING',
    BUSINESS: 'ERROR',
    INTEGRATION: 'ERROR',
    NETWORK: 'ERROR',
    RESOURCE: 'ERROR',
    RATE_LIMIT: 'WARNING',
    CONFIG: 'CRITICAL',
    SYSTEM: 'CRITICAL',
    PERMISSION: 'WARNING',
    TENANT: 'ERROR',
    AI: 'WARNING',
    INTERNAL: 'CRITICAL',
  };
  return severityMap[category];
}

/**
 * Ottiene il messaggio localizzato per un codice errore
 */
export function getErrorMessage(
  code: string,
  lang: 'it' | 'en' = 'it'
): { message: string; suggestion?: string } {
  const registry = ErrorMessageRegistry[code];
  if (registry) {
    return {
      message: lang === 'it' ? registry.messageIT : registry.message,
      suggestion: lang === 'it' ? registry.suggestionIT : registry.suggestion,
    };
  }
  return {
    message: lang === 'it' ? 'Si è verificato un errore' : 'An error occurred',
  };
}

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
export function createHeuresysError(options: CreateErrorOptions, req?: Request): HeuresysError {
  const {
    code,
    message,
    category,
    severity,
    httpStatus,
    details,
    debugContext,
    databaseContext,
    originalError,
    retryable,
    suggestion,
    documentationUrl,
  } = options;

  const errorCategory = category || getCategoryFromCode(code);
  const errorSeverity = severity || getDefaultSeverity(errorCategory);
  const registryMessage = getErrorMessage(code);

  const error: HeuresysError = {
    errorId: generateErrorId(),
    code,
    category: errorCategory,
    severity: errorSeverity,
    message: message || registryMessage.message,
    httpStatus: httpStatus || ErrorToHttpStatus[code] || 500,
    timestamp: new Date().toISOString(),
    requestContext: req ? extractRequestContext(req) : undefined,
    debugContext:
      debugContext ||
      (originalError
        ? {
            stackTrace: originalError.stack,
            functionName: originalError.name,
            errorType: originalError.constructor.name,
            additionalData: { originalMessage: originalError.message },
          }
        : undefined),
    databaseContext,
    details,
    retryable: retryable ?? (errorCategory === 'DB' || errorCategory === 'INTEGRATION'),
    suggestion: suggestion || registryMessage.suggestion,
    documentationUrl,
  };

  return error;
}

/**
 * Builder pattern per costruire errori in modo fluido
 */
export class HeuresysErrorBuilder {
  private options: Partial<CreateErrorOptions> = {};
  private request?: Request;

  static create(code: string): HeuresysErrorBuilder {
    const builder = new HeuresysErrorBuilder();
    builder.options.code = code;
    return builder;
  }

  withMessage(message: string): this {
    this.options.message = message;
    return this;
  }

  withCategory(category: ErrorCategory): this {
    this.options.category = category;
    return this;
  }

  withSeverity(severity: ErrorSeverity): this {
    this.options.severity = severity;
    return this;
  }

  withHttpStatus(status: number): this {
    this.options.httpStatus = status;
    return this;
  }

  withDetails(details: Record<string, unknown>): this {
    this.options.details = details;
    return this;
  }

  withDebugContext(context: DebugContext): this {
    this.options.debugContext = context;
    return this;
  }

  withDatabaseContext(context: DatabaseContext): this {
    this.options.databaseContext = context;
    return this;
  }

  withOriginalError(error: Error): this {
    this.options.originalError = error;
    return this;
  }

  withRequest(req: Request): this {
    this.request = req;
    return this;
  }

  retryable(value: boolean = true): this {
    this.options.retryable = value;
    return this;
  }

  withSuggestion(suggestion: string): this {
    this.options.suggestion = suggestion;
    return this;
  }

  withDocumentation(url: string): this {
    this.options.documentationUrl = url;
    return this;
  }

  build(): HeuresysError {
    if (!this.options.code) {
      throw new Error('Error code is required');
    }
    return createHeuresysError(this.options as CreateErrorOptions, this.request);
  }
}

/**
 * Shortcut functions per errori comuni
 */
export const Errors = {
  // API Errors (1xxx)
  badRequest: (message?: string, details?: Record<string, unknown>) =>
    HeuresysErrorBuilder.create(ErrorCodes.API.BAD_REQUEST)
      .withMessage(message || 'Richiesta non valida')
      .withDetails(details || {})
      .withHttpStatus(400)
      .build(),

  notFound: (resource: string, id?: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.API.NOT_FOUND)
      .withMessage(`${resource} non trovato${id ? `: ${id}` : ''}`)
      .withDetails({ resource, id })
      .withHttpStatus(404)
      .build(),

  methodNotAllowed: (method: string, path: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.API.METHOD_NOT_ALLOWED)
      .withMessage(`Metodo ${method} non permesso per ${path}`)
      .withDetails({ method, path })
      .withHttpStatus(405)
      .build(),

  conflict: (message: string, details?: Record<string, unknown>) =>
    HeuresysErrorBuilder.create(ErrorCodes.API.CONFLICT)
      .withMessage(message)
      .withDetails(details || {})
      .withHttpStatus(409)
      .build(),

  tooManyRequests: (retryAfter: number) =>
    HeuresysErrorBuilder.create(ErrorCodes.API.RATE_LIMITED)
      .withMessage('Troppe richieste. Riprova più tardi.')
      .withDetails({ retryAfter })
      .withHttpStatus(429)
      .build(),

  // Auth Errors (2xxx)
  unauthorized: (message?: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.AUTH.UNAUTHORIZED)
      .withMessage(message || 'Autenticazione richiesta')
      .withHttpStatus(401)
      .build(),

  tokenExpired: () =>
    HeuresysErrorBuilder.create(ErrorCodes.AUTH.TOKEN_EXPIRED)
      .withMessage('Sessione scaduta. Effettua nuovamente il login.')
      .withHttpStatus(401)
      .retryable(false)
      .build(),

  tokenInvalid: () =>
    HeuresysErrorBuilder.create(ErrorCodes.AUTH.TOKEN_INVALID)
      .withMessage('Token non valido')
      .withHttpStatus(401)
      .build(),

  accountDisabled: () =>
    HeuresysErrorBuilder.create(ErrorCodes.AUTH.ACCOUNT_DISABLED)
      .withMessage("Account disabilitato. Contatta l'amministratore.")
      .withHttpStatus(403)
      .retryable(false)
      .build(),

  invalidCredentials: () =>
    HeuresysErrorBuilder.create(ErrorCodes.AUTH.INVALID_CREDENTIALS)
      .withMessage('Credenziali non valide')
      .withHttpStatus(401)
      .build(),

  // Validation Errors (4xxx)
  validationFailed: (errors: Array<{ field: string; message: string; code?: string }>) =>
    HeuresysErrorBuilder.create(ErrorCodes.VALIDATION.VALIDATION_FAILED)
      .withMessage('Validazione fallita')
      .withDetails({ errors })
      .withHttpStatus(422)
      .withSeverity('WARNING')
      .build(),

  requiredField: (field: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.VALIDATION.REQUIRED_FIELD)
      .withMessage(`Il campo '${field}' è obbligatorio`)
      .withDetails({ field })
      .withHttpStatus(400)
      .build(),

  invalidFormat: (field: string, expected: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.VALIDATION.INVALID_FORMAT)
      .withMessage(`Formato non valido per '${field}'. Atteso: ${expected}`)
      .withDetails({ field, expected })
      .withHttpStatus(400)
      .build(),

  // Business Errors (5xxx)
  businessRule: (rule: string, details?: Record<string, unknown>) =>
    HeuresysErrorBuilder.create(ErrorCodes.BUSINESS.RULE_VIOLATION)
      .withMessage(`Regola di business violata: ${rule}`)
      .withDetails(details || {})
      .withHttpStatus(422)
      .build(),

  operationNotPermitted: (operation: string, reason: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.BUSINESS.OPERATION_NOT_PERMITTED)
      .withMessage(`Operazione '${operation}' non permessa: ${reason}`)
      .withDetails({ operation, reason })
      .withHttpStatus(403)
      .build(),

  // Permission Errors (8xxx)
  forbidden: (resource: string, action: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.PERMISSION.ACCESS_DENIED)
      .withMessage(`Accesso negato: non hai i permessi per ${action} su ${resource}`)
      .withDetails({ resource, action })
      .withHttpStatus(403)
      .build(),

  insufficientRole: (requiredRole: string, currentRole: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.PERMISSION.INSUFFICIENT_ROLE)
      .withMessage(`Ruolo insufficiente. Richiesto: ${requiredRole}, attuale: ${currentRole}`)
      .withDetails({ requiredRole, currentRole })
      .withHttpStatus(403)
      .build(),

  // Tenant Errors (9xxx)
  tenantRequired: () =>
    HeuresysErrorBuilder.create(ErrorCodes.TENANT.TENANT_REQUIRED)
      .withMessage("Codice tenant richiesto nell'header X-Tenant-Code")
      .withHttpStatus(400)
      .build(),

  tenantNotFound: (code: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.TENANT.TENANT_NOT_FOUND)
      .withMessage(`Tenant non trovato: ${code}`)
      .withDetails({ tenantCode: code })
      .withHttpStatus(404)
      .build(),

  tenantInactive: (code: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.TENANT.TENANT_INACTIVE)
      .withMessage(`Tenant non attivo: ${code}`)
      .withDetails({ tenantCode: code })
      .withHttpStatus(403)
      .build(),

  // System Errors (7xxx)
  internal: (message?: string, originalError?: Error) =>
    HeuresysErrorBuilder.create(ErrorCodes.SYSTEM.INTERNAL_ERROR)
      .withMessage(message || 'Errore interno del server')
      .withOriginalError(originalError || new Error())
      .withHttpStatus(500)
      .withSeverity('CRITICAL')
      .build(),

  serviceUnavailable: (service: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.SYSTEM.SERVICE_UNAVAILABLE)
      .withMessage(`Servizio non disponibile: ${service}`)
      .withDetails({ service })
      .withHttpStatus(503)
      .retryable(true)
      .build(),

  configurationError: (component: string, issue: string) =>
    HeuresysErrorBuilder.create(ErrorCodes.SYSTEM.CONFIGURATION_ERROR)
      .withMessage(`Errore di configurazione in ${component}: ${issue}`)
      .withDetails({ component, issue })
      .withHttpStatus(500)
      .withSeverity('CRITICAL')
      .build(),
};

/**
 * Verifica se un errore è un HeuresysError
 */
export function isHeuresysError(error: unknown): error is HeuresysError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errorId' in error &&
    'code' in error &&
    'category' in error
  );
}

/**
 * Converte un errore generico in HeuresysError
 */
export function toHeuresysError(error: unknown, req?: Request): HeuresysError {
  if (isHeuresysError(error)) {
    return error;
  }

  // Check for Error instance with explicit type assertion
  const errorObj = error as
    | (Error & { statusCode?: number; code?: string; details?: Record<string, unknown> })
    | null
    | undefined;
  if (
    errorObj &&
    typeof errorObj === 'object' &&
    'message' in errorObj &&
    typeof errorObj.message === 'string'
  ) {
    // Preserve statusCode from legacy AppError (createAppError) if present
    const httpStatus = errorObj.statusCode;
    // Map HTTP status to appropriate error code and category
    let errorCode: string = ErrorCodes.SYSTEM.INTERNAL_ERROR;
    let category: ErrorCategory = 'SYSTEM';
    let severity: ErrorSeverity = 'ERROR';

    if (httpStatus === 400) {
      errorCode = ErrorCodes.API.BAD_REQUEST;
      category = 'API';
    } else if (httpStatus === 401) {
      errorCode = ErrorCodes.AUTH.UNAUTHORIZED;
      category = 'AUTH';
    } else if (httpStatus === 403) {
      errorCode = ErrorCodes.PERMISSION.ACCESS_DENIED;
      category = 'PERMISSION';
      severity = 'WARNING';
    } else if (httpStatus === 404) {
      errorCode = ErrorCodes.API.NOT_FOUND;
      category = 'API';
    } else if (httpStatus === 409) {
      errorCode = ErrorCodes.API.CONFLICT;
      category = 'API';
    } else if (httpStatus === 422) {
      errorCode = ErrorCodes.VALIDATION.VALIDATION_FAILED;
      category = 'VALIDATION';
      severity = 'WARNING';
    } else if (httpStatus === 429) {
      errorCode = ErrorCodes.API.RATE_LIMITED;
      category = 'RATE_LIMIT';
      severity = 'WARNING';
    }

    return createHeuresysError(
      {
        code: errorObj.code || errorCode,
        message: errorObj.message,
        category,
        severity,
        httpStatus: httpStatus || 500,
        ...(errorObj.details && { details: errorObj.details }),
        originalError: errorObj as Error,
      },
      req
    );
  }

  return createHeuresysError(
    {
      code: ErrorCodes.SYSTEM.INTERNAL_ERROR,
      message: String(error),
      severity: 'ERROR',
    },
    req
  );
}

/**
 * Sanitizza un errore per la risposta client (rimuove info sensibili)
 */
export function sanitizeForClient(
  error: HeuresysError,
  isProduction: boolean = true
): Partial<HeuresysError> {
  const clientError: Partial<HeuresysError> = {
    errorId: error.errorId,
    code: error.code,
    category: error.category,
    severity: error.severity,
    message: error.message,
    httpStatus: error.httpStatus,
    timestamp: error.timestamp,
    retryable: error.retryable,
    suggestion: error.suggestion,
    documentationUrl: error.documentationUrl,
  };

  // In produzione, non esporre dettagli tecnici
  if (!isProduction) {
    clientError.details = error.details;
    clientError.debugContext = error.debugContext;
    clientError.databaseContext = error.databaseContext;
    clientError.requestContext = error.requestContext;
  } else {
    // Solo dettagli safe per il client
    if (error.details && !error.details.internal) {
      clientError.details = error.details;
    }
  }

  return clientError;
}
