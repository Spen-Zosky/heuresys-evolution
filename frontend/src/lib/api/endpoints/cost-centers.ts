/**
 * Cost Centers API Endpoints
 */

import { apiClient, buildQueryString } from '../client'
import type {
  CostCenter,
  CostCenterFilters,
  CreateCostCenterRequest,
  UpdateCostCenterRequest,
  RequestOptions,
} from '../types'

interface CostCentersResponse {
  success: boolean
  data: CostCenter[]
  meta: {
    total: number
    limit: number
    offset: number
  }
}

interface CostCenterResponse {
  success: boolean
  data: CostCenter
}

/**
 * Get all cost centers with optional filters
 */
export async function getCostCenters(
  filters?: CostCenterFilters,
  options?: RequestOptions
): Promise<CostCenter[]> {
  const query = filters ? buildQueryString(filters) : ''
  const response = await apiClient.get<CostCentersResponse>(
    `/api/v1/cost-centers${query}`,
    options
  )
  return response.data
}

/**
 * Get single cost center by ID
 */
export async function getCostCenterById(
  id: string,
  options?: RequestOptions
): Promise<CostCenter> {
  const response = await apiClient.get<CostCenterResponse>(
    `/api/v1/cost-centers/${id}`,
    options
  )
  return response.data
}

/**
 * Create new cost center
 */
export async function createCostCenter(
  data: CreateCostCenterRequest,
  options?: RequestOptions
): Promise<CostCenter> {
  const response = await apiClient.post<CostCenterResponse>(
    '/api/v1/cost-centers',
    data,
    options
  )
  return response.data
}

/**
 * Update cost center
 */
export async function updateCostCenter(
  id: string,
  data: UpdateCostCenterRequest,
  options?: RequestOptions
): Promise<CostCenter> {
  const response = await apiClient.patch<CostCenterResponse>(
    `/api/v1/cost-centers/${id}`,
    data,
    options
  )
  return response.data
}

/**
 * Delete cost center
 */
export async function deleteCostCenter(
  id: string,
  options?: RequestOptions
): Promise<void> {
  await apiClient.delete(`/api/v1/cost-centers/${id}`, options)
}

/**
 * Get cost center types in use
 */
export async function getCostCenterTypes(
  options?: RequestOptions
): Promise<string[]> {
  const response = await apiClient.get<{ success: boolean; data: string[] }>(
    '/api/v1/cost-centers/types',
    options
  )
  return response.data
}

/**
 * Get cost center hierarchy (tree structure)
 */
export async function getCostCenterTree(
  options?: RequestOptions
): Promise<CostCenter[]> {
  const response = await apiClient.get<CostCentersResponse>(
    '/api/v1/cost-centers/tree',
    options
  )
  return response.data
}

/**
 * Get cost center statistics
 */
export async function getCostCenterStats(
  options?: RequestOptions
): Promise<{
  total: number
  active: number
  totalBudget: number
  byType: Record<string, number>
}> {
  const response = await apiClient.get<{
    success: boolean
    data: {
      total: number
      active: number
      totalBudget: number
      byType: Record<string, number>
    }
  }>('/api/v1/cost-centers/stats', options)
  return response.data
}
