/**
 * Enrichment Consent API Endpoints — Heuresys Platform
 *
 * P3-17: Employee GDPR consent management for enrichment.
 */

import { apiClient } from '../client';
import type { ApiResponse, RequestOptions } from '../types';

// ============================================
// Types
// ============================================

export interface ConsentStatus {
  consented: boolean;
  consentedAt: string | null;
  scopes: string[];
}

export interface RevokeResult {
  consented: boolean;
  dataRemoved: boolean;
  recordsPurged: number;
}

// ============================================
// Endpoints
// ============================================

const BASE_PATH = '/api/v1/enrichment-consent';

/**
 * Get current enrichment consent status for the authenticated employee.
 */
export async function getMyConsent(options?: RequestOptions): Promise<ConsentStatus> {
  const response = await apiClient.get<ApiResponse<ConsentStatus>>(`${BASE_PATH}/me`, options);
  return response.data;
}

/**
 * Grant enrichment consent with specified scopes.
 */
export async function grantConsent(
  scopes: string[],
  options?: RequestOptions
): Promise<ConsentStatus> {
  const response = await apiClient.post<ApiResponse<ConsentStatus>>(
    `${BASE_PATH}/me/grant`,
    { scopes },
    options
  );
  return response.data;
}

/**
 * Revoke enrichment consent and trigger GDPR data erasure.
 */
export async function revokeConsent(options?: RequestOptions): Promise<RevokeResult> {
  const response = await apiClient.post<ApiResponse<RevokeResult>>(
    `${BASE_PATH}/me/revoke`,
    {},
    options
  );
  return response.data;
}
