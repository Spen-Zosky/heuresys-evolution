/**
 * API Configuration - Dynamic URL Resolution with JWT Auth
 *
 * Risolve automaticamente l'URL dell'API in base all'origine della richiesta:
 * - Se accedi da localhost -> usa localhost:API_PORT
 * - Se accedi da IP esterno -> usa stesso hostname:API_PORT
 *
 * Gestisce anche l'autenticazione JWT e il tenant context.
 */

// Porta API da .env (default 8012)
const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '8012';

// Storage keys
// Tokens are now stored in httpOnly cookies (set by backend via Set-Cookie).
// Only the auth-status flag and tenant are in localStorage for UI state.
const AUTH_STATUS_KEY = 'heuresys_logged_in';
const TENANT_KEY = 'heuresys_tenant';

// Session expiry tracked separately (token is in httpOnly cookie)
const SESSION_EXPIRY_KEY = 'heuresys_session_exp';

// Legacy keys — cleared on login to remove stale localStorage tokens
const LEGACY_TOKEN_KEY = 'heuresys_token';
const LEGACY_REFRESH_KEY = 'heuresys_refresh_token';

/**
 * Ottiene l'URL base dell'API in modo dinamico.
 * Usa lo stesso hostname da cui il browser sta accedendo al frontend.
 */
export function getApiBaseUrl(): string {
  // Server-side: usa variabile d'ambiente o localhost
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || `http://localhost:${API_PORT}`;
  }

  // Client-side: usa lo stesso hostname del browser
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${API_PORT}`;
}

/**
 * Tenant Code di default per sviluppo (RTL Bank)
 * In produzione questo verrà gestito da autenticazione/sessione
 */
export const DEFAULT_TENANT_CODE = process.env.NEXT_PUBLIC_DEFAULT_TENANT_CODE || 'rtl-bank';

/**
 * Tenant ID di default per sviluppo (RTL Bank)
 * @deprecated Usa DEFAULT_TENANT_CODE invece
 */
export const DEFAULT_TENANT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '0c54b84a-db6e-4da4-bc91-af5d480d524e';

/**
 * Mark user as authenticated (UI state only).
 * The actual JWT is stored in an httpOnly cookie by the backend.
 * Also stores the token expiry for session timeout tracking.
 */
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_STATUS_KEY, '1');
    // Store expiry for session timeout hook
    const exp = decodeTokenExpiry(token);
    if (exp) {
      setSessionExpiry(exp);
    }
    // Clear legacy localStorage tokens if present
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  }
}

/**
 * Check if the user appears to be authenticated (UI state).
 * Returns a truthy string if logged in, null otherwise.
 * The actual token validation happens server-side via httpOnly cookie.
 */
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_STATUS_KEY);
  }
  return null;
}

/**
 * Clear auth state (UI flag + legacy tokens).
 * The httpOnly cookies are cleared by the backend on logout.
 */
export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_STATUS_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  }
}

/**
 * No-op: refresh token is stored in httpOnly cookie by backend.
 * Kept for API compatibility.
 */
export function setRefreshToken(_token: string): void {
  // httpOnly cookie — no client-side storage needed
}

/**
 * No-op: refresh token is in httpOnly cookie, not accessible from JS.
 * Returns null — callers should use the /auth/refresh endpoint directly.
 */
export function getRefreshToken(): string | null {
  return null;
}

/**
 * Store the session expiry timestamp (decoded from JWT at login/refresh time).
 */
export function setSessionExpiry(exp: number): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_EXPIRY_KEY, String(exp));
  }
}

/**
 * Get the session expiry timestamp (Unix seconds).
 */
export function getSessionExpiry(): number | null {
  if (typeof window !== 'undefined') {
    const v = sessionStorage.getItem(SESSION_EXPIRY_KEY);
    return v ? parseInt(v, 10) : null;
  }
  return null;
}

/**
 * Decode JWT expiry from a token string (used at login/refresh to store expiry).
 */
export function decodeTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * Salva il tenant code corrente
 */
export function setCurrentTenant(tenantCode: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TENANT_KEY, tenantCode);
  }
}

/**
 * Ottiene il tenant code corrente.
 * Ritorna null quando nessun tenant è selezionato (SUPERUSER "Tutti i Tenant").
 */
export function getCurrentTenant(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TENANT_KEY) || null;
  }
  return DEFAULT_TENANT_CODE;
}

/**
 * Ritorna il tenant code raw dal localStorage (senza fallback).
 * Usato dall'header per sapere se SUPERUSER ha un filtro attivo.
 */
export function getSelectedTenant(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TENANT_KEY);
  }
  return null;
}

/**
 * Headers di default per le chiamate API.
 * Auth is handled via httpOnly cookies (sent automatically with credentials: 'include').
 */
export function getDefaultHeaders(tenantCode?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const tenant = tenantCode || getCurrentTenant();
  if (tenant) {
    headers['X-Tenant-Code'] = tenant;
  }

  // No Authorization header needed — httpOnly cookie is sent automatically
  return headers;
}

/**
 * Login e ottieni token JWT (stored in httpOnly cookies by the backend).
 */
export async function login(
  username: string,
  password: string
): Promise<{ token: string; user: unknown }> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  const token = data.data?.accessToken || data.token;

  // Mark as authenticated in UI state (token is in httpOnly cookie)
  if (token) {
    setAuthToken(token);
  }

  return { token, user: data.data?.user || data.user };
}

/**
 * Logout - clear UI state (httpOnly cookies cleared by backend)
 */
export function logout(): void {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TENANT_KEY);
  }
}

/**
 * Verifica se l'utente è autenticato
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
