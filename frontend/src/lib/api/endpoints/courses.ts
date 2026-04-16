/**
 * Courses API Endpoints - Heuresys Platform
 */

import { apiClient, buildQueryString, normalizeListResponse } from '../client';
import type {
  ApiResponse,
  Course,
  CourseEnrollment,
  CourseFilters,
  CreateCourseRequest,
  UpdateCourseRequest,
  PaginatedResponse,
  RequestOptions,
} from '../types';

const BASE_PATH = '/api/v1/courses';

export async function getCourses(
  params?: CourseFilters,
  options?: RequestOptions
): Promise<PaginatedResponse<Course>> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<{
    data: PaginatedResponse<Course> | Course[];
    meta?: { total?: number; limit?: number; offset?: number };
  }>(`${BASE_PATH}${queryString}`, options);
  const normalized = normalizeListResponse<Course>(response, params);
  // Map API fields to Course interface: status → is_active, handle missing enrollment_count
  normalized.items = normalized.items.map((c) => ({
    ...c,
    status: c.status ?? (c.is_active ? 'published' : 'draft'),
    is_active: c.status !== undefined ? c.status === 'published' : Boolean(c.is_active),
    enrollment_count: c.enrollment_count ?? undefined,
  }));
  return normalized;
}

export async function getCourseById(id: string, options?: RequestOptions): Promise<Course> {
  const response = await apiClient.get<ApiResponse<Course>>(`${BASE_PATH}/${id}`, options);
  return response.data;
}

export async function getMyEnrollments(
  params?: { status?: string },
  options?: RequestOptions
): Promise<CourseEnrollment[]> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiClient.get<ApiResponse<CourseEnrollment[]>>(
    `${BASE_PATH}/me${queryString}`,
    options
  );
  return response.data;
}

export async function getCourseEnrollments(
  courseId: string,
  options?: RequestOptions
): Promise<CourseEnrollment[]> {
  const response = await apiClient.get<ApiResponse<CourseEnrollment[]>>(
    `${BASE_PATH}/${courseId}/enrollments`,
    options
  );
  return response.data;
}

export async function createCourse(
  data: CreateCourseRequest,
  options?: RequestOptions
): Promise<Course> {
  const response = await apiClient.post<ApiResponse<Course>>(BASE_PATH, data, options);
  return response.data;
}

export async function updateCourse(
  id: string,
  data: UpdateCourseRequest,
  options?: RequestOptions
): Promise<Course> {
  const response = await apiClient.put<ApiResponse<Course>>(`${BASE_PATH}/${id}`, data, options);
  return response.data;
}

export async function enrollEmployee(
  courseId: string,
  employeeId: string,
  options?: RequestOptions
): Promise<CourseEnrollment> {
  const response = await apiClient.post<ApiResponse<CourseEnrollment>>(
    `${BASE_PATH}/${courseId}/enroll`,
    { employee_id: employeeId },
    options
  );
  return response.data;
}

export async function deleteCourse(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`${BASE_PATH}/${id}`, options);
}
