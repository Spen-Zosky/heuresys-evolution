/**
 * @heuresys/shared - Type definitions
 * Core types used across all Heuresys platform services
 */

import { z } from 'zod';

// =============================================================================
// TENANT TYPES
// =============================================================================

export const TenantSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(1).max(255),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Tenant = z.infer<typeof TenantSchema>;

export interface TenantContext {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
}

// =============================================================================
// USER & AUTH TYPES
// =============================================================================

/**
 * User roles as stored in the database.
 * Current DB values: SUPERUSER, SYSADMIN, HR, USER, DEMO
 *
 * The 8-role hierarchy in constants/index.ts (IT_ADMIN, HR_DIRECTOR, HR_MANAGER,
 * DEPT_HEAD, LINE_MANAGER, EMPLOYEE) is the target RBAC model.
 * Legacy aliases (ADMIN→SYSADMIN, TENANT_ADMIN→SYSADMIN, HR→HR_MANAGER,
 * USER→EMPLOYEE, DEMO→EMPLOYEE) are kept for backward compatibility.
 */
export const UserRoleSchema = z.enum([
  'SUPERUSER',
  'SYSADMIN',
  'IT_ADMIN',
  'HR_DIRECTOR',
  'HR_MANAGER',
  'DEPT_HEAD',
  'LINE_MANAGER',
  'EMPLOYEE',
  // Legacy DB aliases (backward compat)
  'ADMIN',
  'TENANT_ADMIN',
  'HR',
  'USER',
  'DEMO',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid().nullable(),
  email: z.string().email(),
  username: z.string().min(3).max(100),
  role: UserRoleSchema,
  authProvider: z.enum(['local', 'azure_ad', 'google']).default('local'),
  isActive: z.boolean().default(true),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export interface JWTPayload {
  sub: string; // user_id
  tenantId: string;
  email: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
}

// =============================================================================
// EMPLOYEE TYPES
// =============================================================================

export const GenderSchema = z.enum(['M', 'F', 'OTHER', 'PREFER_NOT_TO_SAY']);
export type Gender = z.infer<typeof GenderSchema>;

export const ContractTypeSchema = z.enum([
  'TEMPO_INDETERMINATO',
  'TEMPO_DETERMINATO',
  'APPRENDISTATO',
  'COLLABORAZIONE',
  'STAGE',
  'PARTITA_IVA',
]);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const EmployeeStatusSchema = z.enum([
  'ACTIVE',
  'ON_LEAVE',
  'TERMINATED',
  'ARCHIVED',
]);
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeNumber: z.string(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  fiscalCode: z.string().length(16).optional(),
  birthDate: z.date().optional(),
  gender: GenderSchema.optional(),
  hireDate: z.date(),
  terminationDate: z.date().nullable(),
  departmentId: z.string().uuid().nullable(),
  managerId: z.string().uuid().nullable(),
  status: EmployeeStatusSchema.default('ACTIVE'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Employee = z.infer<typeof EmployeeSchema>;

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// =============================================================================
// PAGINATION
// =============================================================================

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// =============================================================================
// AUDIT TYPES
// =============================================================================

export const AuditActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'IMPORT',
  'APPROVE',
  'REJECT',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
