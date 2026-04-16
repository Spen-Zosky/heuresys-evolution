/**
 * API Client - Heuresys Platform
 *
 * Client HTTP centralizzato con:
 * - Interceptors per autenticazione
 * - Retry logic per errori di rete
 * - Error handling standardizzato
 * - Request cancellation support
 * - TypeScript types
 */

import { getApiBaseUrl, clearAuthToken, getCurrentTenant } from '../api-config';
import type { ApiError, RequestOptions } from './types';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 30000;

// ============================================
// ERROR CLASSES
// ============================================

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code: string = 'API_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ApiClientError {
  constructor(message: string = 'Sessione scaduta. Effettua nuovamente il login.') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Delay helper per retry logic
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
const isRetryableError = (status: number): boolean => {
  // Retry on server errors and specific client errors
  return status >= 500 || status === 408 || status === 429;
};

/**
 * Build query string from params object
 */
export function buildQueryString<T extends object>(params: T): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================
// API CLIENT CLASS
// ============================================

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Refresh base URL (useful when hostname changes)
   */
  public refreshBaseUrl(): void {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Get current base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Build headers for request.
   * Auth is handled via httpOnly cookies (sent automatically with credentials: 'include').
   */
  private buildHeaders(options?: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Set tenant header (omit for SUPERUSER "Tutti i Tenant" mode)
    const tenantCode = options?.tenantCode || getCurrentTenant();
    if (tenantCode) {
      headers['X-Tenant-Code'] = tenantCode;
    }

    // No Authorization header — httpOnly cookie sent automatically via credentials: 'include'
    return headers;
  }

  /**
   * Handle response errors
   */
  private async handleResponseError(response: Response): Promise<never> {
    let errorData: ApiError | null = null;

    try {
      errorData = await response.json();
    } catch {
      // Response is not JSON
    }

    const rawError = errorData?.error;
    const errorMessage =
      typeof rawError === 'string'
        ? rawError
        : typeof rawError === 'object' && rawError !== null && 'message' in rawError
          ? String((rawError as Record<string, unknown>).message)
          : `API Error: ${response.status} ${response.statusText}`;
    const errorCode =
      errorData?.code ||
      (typeof rawError === 'object' && rawError !== null
        ? String((rawError as Record<string, unknown>).code || '')
        : '') ||
      `HTTP_${response.status}`;

    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new AuthenticationError(errorMessage);
    }

    if (response.status === 403) {
      throw new ApiClientError(
        'You do not have permission to perform this action.',
        403,
        'FORBIDDEN'
      );
    }

    if (response.status === 404) {
      throw new ApiClientError('Resource not found.', 404, 'NOT_FOUND');
    }

    throw new ApiClientError(errorMessage, response.status, errorCode, errorData?.details);
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    url: string,
    init: RequestInit,
    options?: RequestOptions
  ): Promise<T> {
    const retries = options?.retries ?? DEFAULT_RETRIES;
    const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        // Merge signals if provided
        const signal = options?.signal ? options.signal : controller.signal;

        const response = await fetch(url, {
          ...init,
          signal,
          credentials: 'include',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Check if error is retryable
          if (isRetryableError(response.status) && attempt < retries) {
            lastError = new ApiClientError(
              `Request failed with status ${response.status}`,
              response.status,
              `HTTP_${response.status}`
            );
            await delay(retryDelay * (attempt + 1)); // Exponential backoff
            continue;
          }
          await this.handleResponseError(response);
        }

        // Parse response
        const data = await response.json();
        // Auto-map backend meta → pagination for backward compat
        adaptMetaToPagination(data);
        return data as T;
      } catch (error) {
        if (error instanceof ApiClientError || error instanceof AuthenticationError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new NetworkError('Request was cancelled or timed out.');
        }

        // Network error - retry if attempts remaining
        if (attempt < retries) {
          lastError = error as Error;
          await delay(retryDelay * (attempt + 1));
          continue;
        }

        throw new NetworkError((error as Error).message || 'Network error occurred.');
      }
    }

    throw lastError || new NetworkError('Request failed after retries.');
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    return this.executeWithRetry<T>(
      url,
      {
        method: 'GET',
        headers: this.buildHeaders(options),
      },
      options
    );
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    return this.executeWithRetry<T>(
      url,
      {
        method: 'POST',
        headers: this.buildHeaders(options),
        body: body ? JSON.stringify(body) : undefined,
      },
      options
    );
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    return this.executeWithRetry<T>(
      url,
      {
        method: 'PUT',
        headers: this.buildHeaders(options),
        body: body ? JSON.stringify(body) : undefined,
      },
      options
    );
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    return this.executeWithRetry<T>(
      url,
      {
        method: 'PATCH',
        headers: this.buildHeaders(options),
        body: body ? JSON.stringify(body) : undefined,
      },
      options
    );
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    return this.executeWithRetry<T>(
      url,
      {
        method: 'DELETE',
        headers: this.buildHeaders(options),
      },
      options
    );
  }
}

// ============================================
// META → PAGINATION ADAPTER
// ============================================

/**
 * Auto-map backend `meta: {total, limit, offset, hasMore}` to
 * `pagination: {page, limit, total, totalPages}` for backward compat.
 * Mutates the response object in place — checks both top-level and `data` level.
 */
function adaptMetaToPagination(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  // Check data sub-object (common: { success, data: { employees, meta } })
  const targets = [obj, obj?.data];
  for (const t of targets) {
    if (t && typeof t === 'object' && t.meta && !t.pagination) {
      const m = t.meta;
      if (
        typeof m.total === 'number' &&
        typeof m.limit === 'number' &&
        typeof m.offset === 'number'
      ) {
        t.pagination = {
          page: Math.floor(m.offset / m.limit) + 1,
          limit: m.limit,
          total: m.total,
          totalPages: Math.ceil(m.total / m.limit) || 1,
        };
      }
    }
  }
}
// ============================================
// RESPONSE NORMALIZATION
// ============================================

import type { Pagination, PaginatedResponse } from './types';

/**
 * Normalizza le risposte API lista in formato PaginatedResponse<T>.
 * Gestisce i 4 pattern di risposta del backend:
 *  - Pattern 1: {data: T[]}
 *  - Pattern 2: {data: T[], meta: {total, limit, offset}}
 *  - Pattern 3: {data: {items: T[], pagination: Pagination}} (gia' normalizzato)
 *  - Pattern 4: array diretto
 */
export function normalizeListResponse<T>(
  response: {
    data: T[] | { items: T[]; pagination: Pagination };
    meta?: { total?: number; limit?: number; offset?: number };
  },
  params?: { page?: number; limit?: number }
): PaginatedResponse<T> {
  const payload = response.data;

  // Gia' in formato PaginatedResponse
  if (payload && !Array.isArray(payload) && 'items' in payload && 'pagination' in payload) {
    return payload;
  }

  // Array diretto con o senza meta
  const items = Array.isArray(payload) ? payload : [];
  const meta = response.meta;
  const limit = params?.limit ?? meta?.limit ?? 20;
  const page = params?.page ?? (meta?.offset != null ? Math.floor(meta.offset / limit) + 1 : 1);
  const total = meta?.total ?? items.length;

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };
