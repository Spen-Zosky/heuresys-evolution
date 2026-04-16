/**
 * Heuresys Frontend Error Types
 *
 * Tipi e interfacce per la gestione errori strutturata nel frontend.
 * Specularmente al backend, garantisce consistenza end-to-end.
 */

/**
 * Severità dell'errore
 */
export type ErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO'

/**
 * Categoria dell'errore
 */
export type ErrorCategory =
  | 'API'
  | 'AUTH'
  | 'VALIDATION'
  | 'NETWORK'
  | 'RENDER'
  | 'STATE'
  | 'PERMISSION'
  | 'UI'

/**
 * Errore strutturato ricevuto dall'API
 */
export interface ApiError {
  errorId: string
  code: string
  category: string
  severity: ErrorSeverity
  message: string
  httpStatus: number
  timestamp: string
  retryable?: boolean
  suggestion?: string
  documentationUrl?: string
  details?: Record<string, unknown>
  databaseContext?: {
    table?: string
    column?: string
    constraint?: string
    sqlState?: string
    hint?: string
  }
  debugContext?: {
    stackTrace?: string
    functionName?: string
    errorType?: string
  }
}

/**
 * Risposta API di errore
 */
export interface ApiErrorResponse {
  success: false
  error: ApiError
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
  }
}

/**
 * Risposta API di successo
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    hasMore?: boolean
    timestamp?: string
  }
}

/**
 * Tipo unione per risposte API
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Errore applicativo frontend
 */
export interface AppError {
  id: string
  code: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  userMessage: string
  timestamp: Date
  retryable: boolean
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
  dismissed: boolean
}

/**
 * Stato degli errori nell'applicazione
 */
export interface ErrorState {
  errors: AppError[]
  lastError: AppError | null
  hasErrors: boolean
  hasCriticalError: boolean
}

/**
 * Azioni per la gestione degli errori
 */
export type ErrorAction =
  | { type: 'ADD_ERROR'; payload: AppError }
  | { type: 'DISMISS_ERROR'; payload: string }
  | { type: 'DISMISS_ALL' }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RETRY_ERROR'; payload: string }

/**
 * Codici errore frontend
 */
export const FrontendErrorCodes = {
  // Network errors (N1xx)
  NETWORK_OFFLINE: 'N100',
  NETWORK_TIMEOUT: 'N101',
  NETWORK_ERROR: 'N102',
  NETWORK_ABORTED: 'N103',

  // API errors (A1xx)
  API_ERROR: 'A100',
  API_PARSE_ERROR: 'A101',
  API_UNAVAILABLE: 'A102',
  API_RATE_LIMITED: 'A103',

  // Auth errors (AU1xx)
  AUTH_REQUIRED: 'AU100',
  AUTH_EXPIRED: 'AU101',
  AUTH_INVALID: 'AU102',
  AUTH_FORBIDDEN: 'AU103',

  // Validation errors (V1xx)
  VALIDATION_FAILED: 'V100',
  VALIDATION_REQUIRED: 'V101',
  VALIDATION_FORMAT: 'V102',
  VALIDATION_RANGE: 'V103',

  // Render errors (R1xx)
  RENDER_ERROR: 'R100',
  RENDER_HYDRATION: 'R101',
  RENDER_CHUNK_LOAD: 'R102',

  // State errors (S1xx)
  STATE_INVALID: 'S100',
  STATE_CONFLICT: 'S101',

  // UI errors (U1xx)
  UI_COMPONENT_ERROR: 'U100',
  UI_NAVIGATION_ERROR: 'U101',
  UI_FORM_ERROR: 'U102',

  // Permission errors (P1xx)
  PERMISSION_DENIED: 'P100',
  PERMISSION_ROLE: 'P101',
  PERMISSION_TENANT: 'P102',
} as const

/**
 * Messaggi utente in italiano
 */
export const ErrorMessages: Record<string, { message: string; suggestion?: string }> = {
  // Network
  [FrontendErrorCodes.NETWORK_OFFLINE]: {
    message: 'Connessione di rete non disponibile',
    suggestion: 'Verifica la tua connessione internet e riprova'
  },
  [FrontendErrorCodes.NETWORK_TIMEOUT]: {
    message: 'La richiesta ha impiegato troppo tempo',
    suggestion: 'Il server potrebbe essere sovraccarico. Riprova tra qualche istante'
  },
  [FrontendErrorCodes.NETWORK_ERROR]: {
    message: 'Errore di rete',
    suggestion: 'Verifica la tua connessione e riprova'
  },
  [FrontendErrorCodes.NETWORK_ABORTED]: {
    message: 'Richiesta annullata',
    suggestion: 'L\'operazione è stata interrotta'
  },

  // API
  [FrontendErrorCodes.API_ERROR]: {
    message: 'API/Dati Non Disponibili',
    suggestion: 'Il servizio potrebbe essere temporaneamente non disponibile. Riprova più tardi'
  },
  [FrontendErrorCodes.API_PARSE_ERROR]: {
    message: 'Errore nella lettura dei dati',
    suggestion: 'Si è verificato un problema tecnico. Contatta il supporto se persiste'
  },
  [FrontendErrorCodes.API_UNAVAILABLE]: {
    message: 'API/Dati Non Disponibili',
    suggestion: 'Il servizio è temporaneamente non disponibile'
  },
  [FrontendErrorCodes.API_RATE_LIMITED]: {
    message: 'Troppe richieste',
    suggestion: 'Attendi qualche secondo prima di riprovare'
  },

  // Auth
  [FrontendErrorCodes.AUTH_REQUIRED]: {
    message: 'Autenticazione richiesta',
    suggestion: 'Effettua il login per continuare'
  },
  [FrontendErrorCodes.AUTH_EXPIRED]: {
    message: 'Sessione scaduta',
    suggestion: 'Effettua nuovamente il login'
  },
  [FrontendErrorCodes.AUTH_INVALID]: {
    message: 'Credenziali non valide',
    suggestion: 'Verifica username e password'
  },
  [FrontendErrorCodes.AUTH_FORBIDDEN]: {
    message: 'Accesso non autorizzato',
    suggestion: 'Non hai i permessi per accedere a questa risorsa'
  },

  // Validation
  [FrontendErrorCodes.VALIDATION_FAILED]: {
    message: 'Dati non validi',
    suggestion: 'Verifica i campi evidenziati e correggi gli errori'
  },
  [FrontendErrorCodes.VALIDATION_REQUIRED]: {
    message: 'Campo obbligatorio mancante',
    suggestion: 'Compila tutti i campi obbligatori'
  },
  [FrontendErrorCodes.VALIDATION_FORMAT]: {
    message: 'Formato non valido',
    suggestion: 'Verifica il formato del dato inserito'
  },
  [FrontendErrorCodes.VALIDATION_RANGE]: {
    message: 'Valore fuori range',
    suggestion: 'Il valore deve essere compreso nei limiti indicati'
  },

  // Render
  [FrontendErrorCodes.RENDER_ERROR]: {
    message: 'Errore di visualizzazione',
    suggestion: 'Prova a ricaricare la pagina'
  },
  [FrontendErrorCodes.RENDER_HYDRATION]: {
    message: 'Errore nel caricamento della pagina',
    suggestion: 'Ricarica la pagina per risolvere il problema'
  },
  [FrontendErrorCodes.RENDER_CHUNK_LOAD]: {
    message: 'Errore nel caricamento del componente',
    suggestion: 'Ricarica la pagina. Se il problema persiste, svuota la cache del browser'
  },

  // State
  [FrontendErrorCodes.STATE_INVALID]: {
    message: 'Stato applicazione non valido',
    suggestion: 'Ricarica la pagina per ripristinare lo stato'
  },
  [FrontendErrorCodes.STATE_CONFLICT]: {
    message: 'Conflitto di stato',
    suggestion: 'I dati potrebbero essere stati modificati. Ricarica per vedere le modifiche recenti'
  },

  // UI
  [FrontendErrorCodes.UI_COMPONENT_ERROR]: {
    message: 'Errore nel componente',
    suggestion: 'Prova a ricaricare la pagina'
  },
  [FrontendErrorCodes.UI_NAVIGATION_ERROR]: {
    message: 'Errore di navigazione',
    suggestion: 'Torna alla pagina precedente e riprova'
  },
  [FrontendErrorCodes.UI_FORM_ERROR]: {
    message: 'Errore nel form',
    suggestion: 'Verifica i dati inseriti e riprova'
  },

  // Permission
  [FrontendErrorCodes.PERMISSION_DENIED]: {
    message: 'Accesso negato',
    suggestion: 'Non hai i permessi necessari per questa operazione'
  },
  [FrontendErrorCodes.PERMISSION_ROLE]: {
    message: 'Ruolo insufficiente',
    suggestion: 'Contatta l\'amministratore per richiedere i permessi necessari'
  },
  [FrontendErrorCodes.PERMISSION_TENANT]: {
    message: 'Accesso tenant non autorizzato',
    suggestion: 'Verifica di aver selezionato il tenant corretto'
  },
}

/**
 * Mappa HTTP status a codici errore frontend
 */
export const HttpStatusToErrorCode: Record<number, string> = {
  400: FrontendErrorCodes.VALIDATION_FAILED,
  401: FrontendErrorCodes.AUTH_REQUIRED,
  403: FrontendErrorCodes.PERMISSION_DENIED,
  404: FrontendErrorCodes.API_ERROR,
  408: FrontendErrorCodes.NETWORK_TIMEOUT,
  409: FrontendErrorCodes.STATE_CONFLICT,
  422: FrontendErrorCodes.VALIDATION_FAILED,
  429: FrontendErrorCodes.API_RATE_LIMITED,
  500: FrontendErrorCodes.API_ERROR,
  502: FrontendErrorCodes.API_UNAVAILABLE,
  503: FrontendErrorCodes.API_UNAVAILABLE,
  504: FrontendErrorCodes.NETWORK_TIMEOUT,
}

/**
 * Severità per categoria
 */
export const CategorySeverity: Record<ErrorCategory, ErrorSeverity> = {
  API: 'ERROR',
  AUTH: 'ERROR',
  VALIDATION: 'WARNING',
  NETWORK: 'ERROR',
  RENDER: 'CRITICAL',
  STATE: 'WARNING',
  PERMISSION: 'WARNING',
  UI: 'WARNING',
}
