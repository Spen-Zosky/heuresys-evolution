/**
 * @heuresys/shared - Type definitions
 * Core types used across all Heuresys platform services
 */
import { z } from 'zod';
export declare const TenantSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    settings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    settings?: Record<string, unknown> | undefined;
}, {
    code: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive?: boolean | undefined;
    settings?: Record<string, unknown> | undefined;
}>;
export type Tenant = z.infer<typeof TenantSchema>;
export interface TenantContext {
    tenantId: string;
    tenantCode: string;
    tenantName: string;
}
/**
 * User roles as stored in the database.
 * Current DB values: SUPERUSER, SYSADMIN, HR, USER, DEMO
 *
 * The 8-role hierarchy in constants/index.ts (IT_ADMIN, HR_DIRECTOR, HR_MANAGER,
 * DEPT_HEAD, LINE_MANAGER, EMPLOYEE) is the target RBAC model.
 * Legacy aliases (ADMIN→SYSADMIN, TENANT_ADMIN→SYSADMIN, HR→HR_MANAGER,
 * USER→EMPLOYEE, DEMO→EMPLOYEE) are kept for backward compatibility.
 */
export declare const UserRoleSchema: z.ZodEnum<["SUPERUSER", "SYSADMIN", "IT_ADMIN", "HR_DIRECTOR", "HR_MANAGER", "DEPT_HEAD", "LINE_MANAGER", "EMPLOYEE", "ADMIN", "TENANT_ADMIN", "HR", "USER", "DEMO"]>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    employeeId: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    username: z.ZodString;
    role: z.ZodEnum<["SUPERUSER", "SYSADMIN", "IT_ADMIN", "HR_DIRECTOR", "HR_MANAGER", "DEPT_HEAD", "LINE_MANAGER", "EMPLOYEE", "ADMIN", "TENANT_ADMIN", "HR", "USER", "DEMO"]>;
    authProvider: z.ZodDefault<z.ZodEnum<["local", "azure_ad", "google"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    lastLoginAt: z.ZodNullable<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    role: "SUPERUSER" | "IT_ADMIN" | "HR_DIRECTOR" | "HR_MANAGER" | "DEPT_HEAD" | "LINE_MANAGER" | "EMPLOYEE" | "ADMIN" | "TENANT_ADMIN" | "SYSADMIN" | "HR" | "DEMO" | "USER";
    employeeId: string | null;
    email: string;
    tenantId: string;
    isActive: boolean;
    username: string;
    createdAt: Date;
    updatedAt: Date;
    authProvider: "local" | "azure_ad" | "google";
    lastLoginAt: Date | null;
}, {
    id: string;
    role: "SUPERUSER" | "IT_ADMIN" | "HR_DIRECTOR" | "HR_MANAGER" | "DEPT_HEAD" | "LINE_MANAGER" | "EMPLOYEE" | "ADMIN" | "TENANT_ADMIN" | "SYSADMIN" | "HR" | "DEMO" | "USER";
    employeeId: string | null;
    email: string;
    tenantId: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    isActive?: boolean | undefined;
    authProvider?: "local" | "azure_ad" | "google" | undefined;
}>;
export type User = z.infer<typeof UserSchema>;
export interface JWTPayload {
    sub: string;
    tenantId: string;
    email: string;
    role: UserRole;
    permissions: string[];
    iat: number;
    exp: number;
}
export declare const GenderSchema: z.ZodEnum<["M", "F", "OTHER", "PREFER_NOT_TO_SAY"]>;
export type Gender = z.infer<typeof GenderSchema>;
export declare const ContractTypeSchema: z.ZodEnum<["TEMPO_INDETERMINATO", "TEMPO_DETERMINATO", "APPRENDISTATO", "COLLABORAZIONE", "STAGE", "PARTITA_IVA"]>;
export type ContractType = z.infer<typeof ContractTypeSchema>;
export declare const EmployeeStatusSchema: z.ZodEnum<["ACTIVE", "ON_LEAVE", "TERMINATED", "ARCHIVED"]>;
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;
export declare const EmployeeSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    employeeNumber: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    fiscalCode: z.ZodOptional<z.ZodString>;
    birthDate: z.ZodOptional<z.ZodDate>;
    gender: z.ZodOptional<z.ZodEnum<["M", "F", "OTHER", "PREFER_NOT_TO_SAY"]>>;
    hireDate: z.ZodDate;
    terminationDate: z.ZodNullable<z.ZodDate>;
    departmentId: z.ZodNullable<z.ZodString>;
    managerId: z.ZodNullable<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["ACTIVE", "ON_LEAVE", "TERMINATED", "ARCHIVED"]>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    status: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "ARCHIVED";
    id: string;
    terminationDate: Date | null;
    email: string;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    hireDate: Date;
    departmentId: string | null;
    managerId: string | null;
    fiscalCode?: string | undefined;
    gender?: "OTHER" | "M" | "F" | "PREFER_NOT_TO_SAY" | undefined;
    birthDate?: Date | undefined;
}, {
    id: string;
    terminationDate: Date | null;
    email: string;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    hireDate: Date;
    departmentId: string | null;
    managerId: string | null;
    status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "ARCHIVED" | undefined;
    fiscalCode?: string | undefined;
    gender?: "OTHER" | "M" | "F" | "PREFER_NOT_TO_SAY" | undefined;
    birthDate?: Date | undefined;
}>;
export type Employee = z.infer<typeof EmployeeSchema>;
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
export declare const AuditActionSchema: z.ZodEnum<["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT", "APPROVE", "REJECT"]>;
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
//# sourceMappingURL=index.d.ts.map