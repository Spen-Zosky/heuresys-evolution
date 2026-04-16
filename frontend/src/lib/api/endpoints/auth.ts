/**
 * Auth API Endpoints - Heuresys Platform
 */

import { apiClient } from '../client';
import { setAuthToken, clearAuthToken, setRefreshToken } from '../../api-config';
import type { ApiResponse, LoginRequest, LoginResponse, User, RequestOptions } from '../types';

/**
 * Login user
 */
export async function login(
  credentials: LoginRequest,
  options?: RequestOptions
): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/api/v1/auth/login',
    credentials,
    { ...options, skipAuth: true }
  );

  const { accessToken, refreshToken: rt } = response.data;

  // Store tokens (tenant is set by the login page based on role)
  if (accessToken) {
    setAuthToken(accessToken);
  }
  if (rt) {
    setRefreshToken(rt);
  }

  return response.data;
}

/**
 * Logout user
 */
export async function logout(options?: RequestOptions): Promise<void> {
  try {
    await apiClient.post('/api/v1/auth/logout', undefined, options);
  } catch {
    // Ignore errors on logout - just clear local state
  } finally {
    clearAuthToken();
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(options?: RequestOptions): Promise<User> {
  const response = await apiClient.get<ApiResponse<User>>('/api/v1/auth/me', options);
  return response.data;
}

/**
 * Refresh access token.
 * The refresh token is sent via httpOnly cookie automatically.
 * The refreshTokenValue parameter is kept for backward compatibility but can be empty.
 */
export async function refreshAccessToken(
  refreshTokenValue: string,
  options?: RequestOptions
): Promise<{ accessToken: string; refreshToken?: string }> {
  const body = refreshTokenValue ? { refreshToken: refreshTokenValue } : {};
  const response = await apiClient.post<
    ApiResponse<{ accessToken: string; refreshToken?: string }>
  >('/api/v1/auth/refresh', body, { ...options, skipAuth: true });

  const { accessToken, refreshToken: newRefresh } = response.data;
  // Update session expiry from the new token
  if (accessToken) {
    setAuthToken(accessToken);
  }
  if (newRefresh) {
    setRefreshToken(newRefresh);
  }

  return response.data;
}

/**
 * Validate current token
 */
export async function validateToken(options?: RequestOptions): Promise<boolean> {
  try {
    await apiClient.get('/api/v1/auth/validate', options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Change password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  options?: RequestOptions
): Promise<void> {
  await apiClient.post('/api/v1/auth/change-password', { currentPassword, newPassword }, options);
}
