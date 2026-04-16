/**
 * Heuresys Frontend Error Factory
 *
 * Factory per creare, trasformare e gestire errori nel frontend.
 */

import {
  AppError,
  ApiError,
  ApiErrorResponse,
  ErrorCategory,
  ErrorSeverity,
  FrontendErrorCodes,
  ErrorMessages,
  HttpStatusToErrorCode,
  CategorySeverity
} from './types'

/**
 * Genera un ID univoco per l'errore
 */
export function generateErrorId(): string {
  return `FE-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase()
}

/**
 * Opzioni per creare un AppError
 */
export interface CreateErrorOptions {
  code: string
  category?: ErrorCategory
  severity?: ErrorSeverity
  message?: string
  userMessage?: string
  suggestion?: string
  context?: {
    component?: string
    action?: string
    route?: string
    userId?: string
    tenantId?: string
  }
  originalError?: Error
  apiError?: ApiError
  retryable?: boolean
}

/**
 * Crea un AppError
 */
export function createAppError(options: CreateErrorOptions): AppError {
  const {
    code,
    category = 'API',
    severity,
    message,
    userMessage,
    suggestion,
    context,
    originalError,
    apiError,
    retryable = false
  } = options

  const errorDef = ErrorMessages[code]
  const finalUserMessage = userMessage || errorDef?.message || 'Si è verificato un errore'
  const finalSuggestion = suggestion || errorDef?.suggestion

  return {
    id: generateErrorId(),
    code,
    category,
    severity: severity || CategorySeverity[category],
    message: message || originalError?.message || finalUserMessage,
    userMessage: finalUserMessage,
    timestamp: new Date(),
    retryable,
    suggestion: finalSuggestion,
    context,
    originalError,
    apiError,
    dismissed: false
  }
}

/**
 * Verifica se una risposta è un errore API
 */
export function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as any).success === false &&
    'error' in response
  )
}

/**
 * Trasforma una risposta API di errore in AppError
 */
export function fromApiError(apiErrorResponse: ApiErrorResponse, context?: CreateErrorOptions['context']): AppError {
  const { error } = apiErrorResponse
  const frontendCode = HttpStatusToErrorCode[error.httpStatus] || FrontendErrorCodes.API_ERROR

  return createAppError({
    code: frontendCode,
    category: mapApiCategoryToFrontend(error.category),
    severity: error.severity,
    message: error.message,
    userMessage: error.message,
    suggestion: error.suggestion,
    context: {
      ...context,
      // Aggiungi info dalla risposta API
      ...(apiErrorResponse.meta?.path && { route: apiErrorResponse.meta.path })
    },
    apiError: error,
    retryable: error.retryable || false
  })
}

/**
 * Mappa categoria API a categoria frontend
 */
function mapApiCategoryToFrontend(apiCategory: string): ErrorCategory {
  const mapping: Record<string, ErrorCategory> = {
    'API': 'API',
    'AUTH': 'AUTH',
    'DB': 'API',
    'VALIDATION': 'VALIDATION',
    'BUSINESS': 'API',
    'INTEGRATION': 'API',
    'SYSTEM': 'API',
    'PERMISSION': 'PERMISSION',
    'TENANT': 'PERMISSION',
    'AI': 'API'
  }
  return mapping[apiCategory] || 'API'
}

/**
 * Trasforma un Error JavaScript in AppError
 */
export function fromNativeError(
  error: Error,
  options?: Partial<CreateErrorOptions>
): AppError {
  // Determina il tipo di errore
  let code: string = FrontendErrorCodes.API_ERROR
  let category: ErrorCategory = 'API'

  if (error.name === 'TypeError') {
    code = FrontendErrorCodes.STATE_INVALID
    category = 'STATE'
  } else if (error.name === 'SyntaxError') {
    code = FrontendErrorCodes.API_PARSE_ERROR
    category = 'API'
  } else if (error.name === 'RangeError') {
    code = FrontendErrorCodes.VALIDATION_RANGE
    category = 'VALIDATION'
  } else if (error.name === 'AbortError') {
    code = FrontendErrorCodes.NETWORK_ABORTED
    category = 'NETWORK'
  } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
    code = FrontendErrorCodes.NETWORK_ERROR
    category = 'NETWORK'
  } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    code = FrontendErrorCodes.NETWORK_TIMEOUT
    category = 'NETWORK'
  } else if (error.message?.includes('ChunkLoadError')) {
    code = FrontendErrorCodes.RENDER_CHUNK_LOAD
    category = 'RENDER'
  }

  return createAppError({
    code,
    category,
    message: error.message,
    originalError: error,
    ...options
  })
}

/**
 * Trasforma un errore fetch in AppError
 */
export function fromFetchError(
  error: Error,
  response?: Response,
  context?: CreateErrorOptions['context']
): AppError {
  // Errore di rete (no response)
  if (!response) {
    if (!navigator.onLine) {
      return createAppError({
        code: FrontendErrorCodes.NETWORK_OFFLINE,
        category: 'NETWORK',
        message: error.message,
        originalError: error,
        context,
        retryable: true
      })
    }

    if (error.name === 'AbortError') {
      return createAppError({
        code: FrontendErrorCodes.NETWORK_ABORTED,
        category: 'NETWORK',
        message: 'Richiesta annullata',
        originalError: error,
        context,
        retryable: false
      })
    }

    if (error.message?.includes('timeout')) {
      return createAppError({
        code: FrontendErrorCodes.NETWORK_TIMEOUT,
        category: 'NETWORK',
        message: error.message,
        originalError: error,
        context,
        retryable: true
      })
    }

    return createAppError({
      code: FrontendErrorCodes.NETWORK_ERROR,
      category: 'NETWORK',
      message: error.message,
      originalError: error,
      context,
      retryable: true
    })
  }

  // Errore con response
  const code = HttpStatusToErrorCode[response.status] || FrontendErrorCodes.API_ERROR
  let category: ErrorCategory = 'API'

  if (response.status === 401 || response.status === 403) {
    category = response.status === 401 ? 'AUTH' : 'PERMISSION'
  } else if (response.status === 400 || response.status === 422) {
    category = 'VALIDATION'
  }

  return createAppError({
    code,
    category,
    message: error.message || `HTTP ${response.status}`,
    originalError: error,
    context,
    retryable: response.status >= 500
  })
}

/**
 * Shortcut per errori comuni
 */
export const Errors = {
  // Network
  offline: (context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.NETWORK_OFFLINE,
      category: 'NETWORK',
      context,
      retryable: true
    }),

  timeout: (context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.NETWORK_TIMEOUT,
      category: 'NETWORK',
      context,
      retryable: true
    }),

  networkError: (message?: string, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.NETWORK_ERROR,
      category: 'NETWORK',
      message,
      context,
      retryable: true
    }),

  // API
  apiUnavailable: (context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.API_UNAVAILABLE,
      category: 'API',
      context,
      retryable: true
    }),

  apiError: (message?: string, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.API_ERROR,
      category: 'API',
      message: message || 'API/Dati Non Disponibili',
      userMessage: message || 'API/Dati Non Disponibili',
      context,
      retryable: true
    }),

  rateLimited: (retryAfter?: number, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.API_RATE_LIMITED,
      category: 'API',
      suggestion: retryAfter
        ? `Riprova tra ${retryAfter} secondi`
        : 'Attendi qualche secondo prima di riprovare',
      context,
      retryable: true
    }),

  // Auth
  authRequired: (context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.AUTH_REQUIRED,
      category: 'AUTH',
      context,
      retryable: false
    }),

  sessionExpired: (context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.AUTH_EXPIRED,
      category: 'AUTH',
      context,
      retryable: false
    }),

  invalidCredentials: (context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.AUTH_INVALID,
      category: 'AUTH',
      context,
      retryable: false
    }),

  forbidden: (resource?: string, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.AUTH_FORBIDDEN,
      category: 'PERMISSION',
      message: resource ? `Accesso negato a ${resource}` : 'Accesso non autorizzato',
      context,
      retryable: false
    }),

  // Validation
  validationFailed: (errors: Array<{ field: string; message: string }>, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.VALIDATION_FAILED,
      category: 'VALIDATION',
      message: `Errori di validazione: ${errors.map(e => e.message).join(', ')}`,
      context,
      retryable: false
    }),

  requiredField: (field: string, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.VALIDATION_REQUIRED,
      category: 'VALIDATION',
      message: `Il campo '${field}' è obbligatorio`,
      context,
      retryable: false
    }),

  invalidFormat: (field: string, expected?: string, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.VALIDATION_FORMAT,
      category: 'VALIDATION',
      message: expected
        ? `Formato non valido per '${field}'. Atteso: ${expected}`
        : `Formato non valido per '${field}'`,
      context,
      retryable: false
    }),

  // UI/Render
  componentError: (component: string, error?: Error) =>
    createAppError({
      code: FrontendErrorCodes.UI_COMPONENT_ERROR,
      category: 'RENDER',
      message: `Errore nel componente ${component}`,
      context: { component },
      originalError: error,
      retryable: false
    }),

  renderError: (error: Error, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.RENDER_ERROR,
      category: 'RENDER',
      severity: 'CRITICAL',
      message: error.message,
      originalError: error,
      context,
      retryable: false
    }),

  // Permission
  permissionDenied: (action?: string, context?: CreateErrorOptions['context']) =>
    createAppError({
      code: FrontendErrorCodes.PERMISSION_DENIED,
      category: 'PERMISSION',
      message: action
        ? `Non hai i permessi per: ${action}`
        : 'Accesso negato',
      context,
      retryable: false
    }),
}

/**
 * Verifica se un errore è retryable
 */
export function isRetryable(error: AppError): boolean {
  return error.retryable
}

/**
 * Verifica se un errore richiede il re-login
 */
export function requiresReauth(error: AppError): boolean {
  return (
    error.code === FrontendErrorCodes.AUTH_EXPIRED ||
    error.code === FrontendErrorCodes.AUTH_REQUIRED ||
    error.apiError?.httpStatus === 401
  )
}

/**
 * Verifica se un errore è critico
 */
export function isCritical(error: AppError): boolean {
  return error.severity === 'CRITICAL'
}

/**
 * Verifica se un errore è un errore di rete
 */
export function isNetworkError(error: AppError): boolean {
  return error.category === 'NETWORK'
}

/**
 * Formatta un errore per il logging
 */
export function formatErrorForLog(error: AppError): string {
  return JSON.stringify({
    id: error.id,
    code: error.code,
    category: error.category,
    severity: error.severity,
    message: error.message,
    timestamp: error.timestamp.toISOString(),
    context: error.context,
    apiError: error.apiError ? {
      errorId: error.apiError.errorId,
      code: error.apiError.code,
      httpStatus: error.apiError.httpStatus
    } : undefined
  })
}
