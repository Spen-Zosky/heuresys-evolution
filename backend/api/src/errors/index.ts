/**
 * Heuresys Error Handling Module
 *
 * Sistema centralizzato di gestione errori per l'API Gateway.
 *
 * @example
 * // In route handler
 * import { Errors, asyncHandler, sendSuccess } from '../errors'
 *
 * router.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await findUser(req.params.id)
 *   if (!user) {
 *     throw Errors.notFound('User', req.params.id)
 *   }
 *   sendSuccess(res, user)
 * }))
 *
 * @example
 * // In app.ts
 * import { createErrorMiddleware, notFoundHandler } from './errors'
 *
 * app.use(notFoundHandler)
 * app.use(createErrorMiddleware({
 *   environment: 'production',
 *   onCriticalError: (error) => sendAlertToSlack(error)
 * }))
 */

// Types
export {
  HeuresysError,
  ApiErrorResponse,
  ApiSuccessResponse,
  ErrorCategory,
  ErrorSeverity,
  ErrorCodes,
  RequestContext,
  DebugContext,
  DatabaseContext,
  ErrorMessageRegistry,
  ErrorToHttpStatus,
  SeverityConfig
} from './types.js'

// Factory
export {
  createHeuresysError,
  HeuresysErrorBuilder,
  Errors,
  isHeuresysError,
  toHeuresysError,
  sanitizeForClient,
  extractRequestContext,
  generateErrorId,
  getCategoryFromCode,
  getDefaultSeverity,
  getErrorMessage,
  CreateErrorOptions
} from './factory.js'

// Database
export {
  PostgresError,
  PostgresErrorMapping,
  handleDatabaseError,
  isPostgresError,
  extractDatabaseContext,
  safeQuery
} from './database.js'

// Middleware
export {
  createErrorMiddleware,
  errorMiddleware,
  asyncHandler,
  notFoundHandler,
  throwError,
  sendSuccess,
  sendPaginatedSuccess,
  sendCreated,
  sendNoContent,
  ErrorMiddlewareConfig
} from './middleware.js'

// Sentry Integration
export {
  initSentry,
  sentryErrorLogger,
  captureException,
  setUser,
  clearUser,
  addBreadcrumb,
  captureMessage,
  flush as flushSentry,
  close as closeSentry,
  isActive as isSentryActive,
  SentryConfig
} from './sentry.js'
