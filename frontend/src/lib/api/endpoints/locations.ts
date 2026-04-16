/**
 * Locations API Endpoints
 */

import { apiClient, buildQueryString } from '../client'
import type {
  Location,
  LocationFilters,
  CreateLocationRequest,
  UpdateLocationRequest,
  RequestOptions,
} from '../types'

interface LocationsResponse {
  success: boolean
  data: Location[]
  meta: {
    total: number
    limit: number
    offset: number
  }
}

interface LocationResponse {
  success: boolean
  data: Location
}

/**
 * Get all locations with optional filters
 */
export async function getLocations(
  filters?: LocationFilters,
  options?: RequestOptions
): Promise<Location[]> {
  const query = filters ? buildQueryString(filters) : ''
  const response = await apiClient.get<LocationsResponse>(
    `/api/v1/locations${query}`,
    options
  )
  return response.data
}

/**
 * Get single location by ID
 */
export async function getLocationById(
  id: string,
  options?: RequestOptions
): Promise<Location> {
  const response = await apiClient.get<LocationResponse>(
    `/api/v1/locations/${id}`,
    options
  )
  return response.data
}

/**
 * Create new location
 */
export async function createLocation(
  data: CreateLocationRequest,
  options?: RequestOptions
): Promise<Location> {
  const response = await apiClient.post<LocationResponse>(
    '/api/v1/locations',
    data,
    options
  )
  return response.data
}

/**
 * Update location
 */
export async function updateLocation(
  id: string,
  data: UpdateLocationRequest,
  options?: RequestOptions
): Promise<Location> {
  const response = await apiClient.patch<LocationResponse>(
    `/api/v1/locations/${id}`,
    data,
    options
  )
  return response.data
}

/**
 * Delete location
 */
export async function deleteLocation(
  id: string,
  options?: RequestOptions
): Promise<void> {
  await apiClient.delete(`/api/v1/locations/${id}`, options)
}

/**
 * Get location types in use
 */
export async function getLocationTypes(
  options?: RequestOptions
): Promise<string[]> {
  const response = await apiClient.get<{ success: boolean; data: string[] }>(
    '/api/v1/locations/types',
    options
  )
  return response.data
}

/**
 * Get cities with locations
 */
export async function getLocationCities(
  options?: RequestOptions
): Promise<string[]> {
  const response = await apiClient.get<{ success: boolean; data: string[] }>(
    '/api/v1/locations/cities',
    options
  )
  return response.data
}

/**
 * Get location statistics
 */
export async function getLocationStats(
  options?: RequestOptions
): Promise<{
  total: number
  active: number
  totalCapacity: number
  byType: Record<string, number>
  byCity: Record<string, number>
}> {
  const response = await apiClient.get<{
    success: boolean
    data: {
      total: number
      active: number
      totalCapacity: number
      byType: Record<string, number>
      byCity: Record<string, number>
    }
  }>('/api/v1/locations/stats', options)
  return response.data
}
