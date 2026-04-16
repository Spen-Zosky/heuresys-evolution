/**
 * Workspace API Endpoints - Heuresys Platform
 *
 * Calls the personal workspace backend: user layout + widget data.
 */

import { apiClient } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

// ============================================
// Types
// ============================================

export interface WorkspaceWidget {
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
  cache_ttl_seconds?: number;
  swr_seconds?: number;
}

export interface WorkspaceResponse {
  source: 'user' | 'template' | 'empty';
  id?: string | number;
  name?: string;
  layout: { columns: number; gap: number };
  widgets: WorkspaceWidget[];
}

// ============================================
// Endpoints
// ============================================

const BASE_PATH = '/api/v1/workspace';

/**
 * Get workspace for current authenticated user.
 * Returns user-saved layout, role-based template, or empty workspace.
 */
export async function getMyWorkspace(options?: RequestOptions): Promise<WorkspaceResponse> {
  const response = await apiClient.get<ApiResponse<WorkspaceResponse>>(`${BASE_PATH}/me`, options);
  return response.data;
}

/**
 * Get runtime data for a specific widget by code.
 * The backend resolves the widget type and returns the appropriate payload.
 */
export async function getWidgetData<T = unknown>(
  code: string,
  options?: RequestOptions
): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(
    `${BASE_PATH}/widget/${encodeURIComponent(code)}/data`,
    options
  );
  return response.data;
}
