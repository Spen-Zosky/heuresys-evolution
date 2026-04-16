"use strict";
/**
 * @heuresys/shared - Type definitions
 * Core types used across all Heuresys platform services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditActionSchema = exports.EmployeeSchema = exports.EmployeeStatusSchema = exports.ContractTypeSchema = exports.GenderSchema = exports.UserSchema = exports.UserRoleSchema = exports.TenantSchema = void 0;
const zod_1 = require("zod");
// =============================================================================
// TENANT TYPES
// =============================================================================
exports.TenantSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    code: zod_1.z.string().min(2).max(50),
    name: zod_1.z.string().min(1).max(255),
    settings: zod_1.z.record(zod_1.z.unknown()).optional(),
    isActive: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
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
exports.UserRoleSchema = zod_1.z.enum([
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
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    employeeId: zod_1.z.string().uuid().nullable(),
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(100),
    role: exports.UserRoleSchema,
    authProvider: zod_1.z.enum(['local', 'azure_ad', 'google']).default('local'),
    isActive: zod_1.z.boolean().default(true),
    lastLoginAt: zod_1.z.date().nullable(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
// =============================================================================
// EMPLOYEE TYPES
// =============================================================================
exports.GenderSchema = zod_1.z.enum(['M', 'F', 'OTHER', 'PREFER_NOT_TO_SAY']);
exports.ContractTypeSchema = zod_1.z.enum([
    'TEMPO_INDETERMINATO',
    'TEMPO_DETERMINATO',
    'APPRENDISTATO',
    'COLLABORAZIONE',
    'STAGE',
    'PARTITA_IVA',
]);
exports.EmployeeStatusSchema = zod_1.z.enum([
    'ACTIVE',
    'ON_LEAVE',
    'TERMINATED',
    'ARCHIVED',
]);
exports.EmployeeSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    employeeNumber: zod_1.z.string(),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email(),
    fiscalCode: zod_1.z.string().length(16).optional(),
    birthDate: zod_1.z.date().optional(),
    gender: exports.GenderSchema.optional(),
    hireDate: zod_1.z.date(),
    terminationDate: zod_1.z.date().nullable(),
    departmentId: zod_1.z.string().uuid().nullable(),
    managerId: zod_1.z.string().uuid().nullable(),
    status: exports.EmployeeStatusSchema.default('ACTIVE'),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
// =============================================================================
// AUDIT TYPES
// =============================================================================
exports.AuditActionSchema = zod_1.z.enum([
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
//# sourceMappingURL=index.js.map