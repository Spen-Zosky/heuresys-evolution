/**
 * User Management Routes
 * CRUD operations for platform users with role-based access control
 * NOTE: Database users table columns:
 *   id, username, password_hash, role, permissions, is_active,
 *   last_login, created_at, updated_at, employee_id
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { escapeILIKE } from '../utils/sql-safety.js';
import { authMiddleware, AuthenticatedRequest, Role, ROLES } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes, isValidUUID } from '@heuresys/shared';
import { validatePassword } from '../utils/password-policy.js';
import crypto from 'crypto';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  bulkCreateUsersSchema,
} from '../schemas/users.js';
import { asyncHandler } from '../errors/middleware.js';
import { pool } from '../config/database.js';
import { buildMeta } from '../utils/pagination.js';
import { logger } from '../config/logger.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

/**
 * Generate a secure random password that meets enterprise password policy.
 * Guarantees at least one uppercase, one lowercase, one digit, and one special character.
 */
function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const specials = '!@#$%^&*';
  const allChars = lowercase + uppercase + digits + specials;

  // Guarantee at least one character from each required class
  const guaranteed: string[] = [];
  const guaranteedBytes = crypto.randomBytes(4);
  guaranteed.push(uppercase[guaranteedBytes[0]! % uppercase.length]!);
  guaranteed.push(lowercase[guaranteedBytes[1]! % lowercase.length]!);
  guaranteed.push(digits[guaranteedBytes[2]! % digits.length]!);
  guaranteed.push(specials[guaranteedBytes[3]! % specials.length]!);

  // Fill remaining length with random characters from the full set
  const remaining = length - guaranteed.length;
  const randomBytes = crypto.randomBytes(remaining);
  for (let i = 0; i < remaining; i++) {
    const byte = randomBytes[i];
    if (byte !== undefined) {
      guaranteed.push(allChars[byte % allChars.length]!);
    }
  }

  // Shuffle to avoid predictable positions for guaranteed characters
  const shuffleBytes = crypto.randomBytes(guaranteed.length);
  const shuffled = guaranteed
    .map((char, i) => ({ char, sort: shuffleBytes[i]! }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.char);

  return shuffled.join('');
}

/**
 * Send welcome email (stub - logs for now)
 */
async function sendWelcomeEmail(
  email: string,
  username: string,
  _temporaryPassword: string, // Prefixed: used only by email service, not logged for security
  tenantName: string
): Promise<void> {
  // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  // SECURITY: Never log passwords - use secure email delivery only
  logger.info(`[EMAIL SERVICE] Welcome email queued for: ${email} (Tenant: ${tenantName})`);
  logger.info(`  Username: ${username}`);
  logger.info(`  Action Required: User must change password on first login`);
  // In production, this should send via SendGrid/AWS SES with the temporaryPassword
  // For now, we're suppressing password logging for security
}

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/users/meta/roles
 * Get available roles (for dropdowns) - must be before /:id route
 */
router.get('/meta/roles', async (_req: Request, res: Response) => {
  const roles = Object.entries(ROLES).map(([name, level]) => ({
    name,
    level,
    description: getRoleDescription(name as Role),
  }));

  res.json({
    success: true,
    data: roles,
  });
});

function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    // Current role system
    SUPERUSER: 'Platform god-role - Cross-tenant full access',
    TENANT_OWNER: 'Per-tenant full admin - Setup and configuration',
    IT_ADMIN: 'IT Director - Team + IT configuration access',
    HR_DIRECTOR: 'HR Strategic - All employees, full HR access',
    HR_MANAGER: 'HR Operational - All employees, limited strategic',
    DEPT_HEAD: 'OrgUnit Head - OrgUnit scope access',
    LINE_MANAGER: 'Team Manager - Direct reports access',
    EMPLOYEE: 'Standard Employee - Self-only access',
    // Legacy role mappings
    ADMIN: 'Tenant administrator (legacy) - Maps to TENANT_OWNER',
    TENANT_ADMIN: 'Tenant administrator (legacy) - Maps to TENANT_OWNER',
    SYSADMIN: 'System Administrator (legacy) - Maps to TENANT_OWNER',
    DEMO: 'Demo/read-only access - View-only access for demonstrations',
    HR: 'Human Resources Manager - Access to HR functions',
    USER: 'Standard user - Basic access',
  };
  return descriptions[role];
}

/**
 * GET /api/v1/users
 * List all users (ADMIN+ only)
 */
router.get(
  '/',
  requirePermission('SECURITY', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;

    // Pagination
    const page = Math.max(1, safeParseInt(req.query['page'] as string, { fallback: 1 }));
    const limit = Math.min(
      500,
      Math.max(1, safeParseInt(req.query['limit'] as string, { fallback: 20 }))
    );
    const offset = (page - 1) * limit;

    // Filtering
    const role = req.query['role'] as string;
    const isActive = req.query['is_active'] as string;
    const search = req.query['search'] as string;

    // Build query
    let whereClause = 'WHERE 1=1';
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    // Non-SUPERUSER can only see users from their tenant
    if (authReq.user.role !== 'SUPERUSER') {
      whereClause += ` AND (u.employee_id IS NULL OR e.tenant_id = $${paramIndex})`;
      params.push(authReq.user.tenantId || '');
      paramIndex++;
    }

    if (role) {
      whereClause += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereClause += ` AND u.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (u.username ILIKE $${paramIndex} OR e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex})`;
      params.push(`%${escapeILIKE(search as string)}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await dbClient.query(
      `SELECT COUNT(*) as total
     FROM users u
     LEFT JOIN employees e ON u.employee_id = e.id
     ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total);

    // Sorting
    const sortByParam = req.query['sort_by'] as string;
    const sortOrderParam = req.query['sort_order'] as string;
    const allowedSortColumns: Record<string, string> = {
      username: 'u.username',
      role: 'u.role',
      last_login: 'u.last_login',
      first_name: 'e.first_name',
    };
    const sortColumn = allowedSortColumns[sortByParam] || 'u.username';
    const sortOrder = sortOrderParam === 'desc' ? 'DESC' : 'ASC';

    // Get users
    const usersResult = await dbClient.query(
      `SELECT
      u.id, u.username, u.role, u.permissions, u.is_active,
      u.last_login, u.created_at, u.updated_at, u.employee_id,
      e.first_name, e.last_name, e.email, e.tenant_id,
      t.name as tenant_name
    FROM users u
    LEFT JOIN employees e ON u.employee_id = e.id
    LEFT JOIN tenants t ON e.tenant_id = t.id
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        users: usersResult.rows.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
          permissions: u.permissions,
          isActive: u.is_active,
          lastLogin: u.last_login,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          employeeId: u.employee_id,
          firstName: u.first_name,
          lastName: u.last_name,
          email: u.email,
          tenantId: u.tenant_id,
          tenantName: u.tenant_name,
        })),
        meta: buildMeta(total, limit, offset),
      },
    });
  })
);

/**
 * GET /api/v1/users/:id
 * Get single user by ID
 */
router.get(
  '/:id',
  requirePermission('SECURITY', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid user ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    const result = await dbClient.query(
      `SELECT
      u.id, u.username, u.role, u.permissions, u.is_active,
      u.last_login, u.created_at, u.updated_at, u.employee_id,
      u.totp_enabled,
      e.first_name, e.last_name, e.email, e.job_title,
      e.department, e.tenant_id, t.name as tenant_name
    FROM users u
    LEFT JOIN employees e ON u.employee_id = e.id
    LEFT JOIN tenants t ON e.tenant_id = t.id
    WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw createAppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const user = result.rows[0];

    // Non-SUPERUSER can only see users from their tenant
    if (
      authReq.user.role !== 'SUPERUSER' &&
      user.tenant_id &&
      user.tenant_id !== authReq.user.tenantId
    ) {
      throw createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        employeeId: user.employee_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        jobTitle: user.job_title,
        department: user.department,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
        totpEnabled: user.totp_enabled || false,
      },
    });
  })
);

/**
 * POST /api/v1/users
 * Create new user (TENANT_OWNER+ only)
 * Supports auto-generation of password and welcome email
 */
router.post(
  '/',
  requirePermission('SECURITY', 'CREATE'),
  validate(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;
    const {
      username,
      password,
      role,
      permissions,
      employee_id,
      is_active = true,
      generate_password = false,
      send_welcome_email = false,
    } = req.body;

    // Validation
    if (!username) {
      throw createAppError('Username is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Password: either provided or auto-generated
    let userPassword = password;
    let isTemporaryPassword = false;

    if (generate_password) {
      userPassword = generateSecurePassword(16);
      isTemporaryPassword = true;
    } else if (!password) {
      throw createAppError(
        'Password is required (or use generate_password: true)',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    } else {
      const validation = validatePassword(password);
      if (!validation.valid) {
        throw createAppError(
          `Password does not meet policy requirements: ${validation.errors.join('; ')}`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // Validate role
    const validRoles = Object.keys(ROLES);
    const userRole: Role = role || 'USER';
    if (!validRoles.includes(userRole)) {
      throw createAppError(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Only SUPERUSER can create SUPERUSER users
    if (userRole === 'SUPERUSER' && authReq.user.role !== 'SUPERUSER') {
      throw createAppError('Only SUPERUSER can create SUPERUSER users', 403, ErrorCodes.FORBIDDEN);
    }

    // Non-TENANT_OWNER cannot create users with higher privileges
    if (ROLES[userRole] < ROLES[authReq.user.role]) {
      throw createAppError('Cannot create user with higher privileges', 403, ErrorCodes.FORBIDDEN);
    }

    // Check username uniqueness
    const existingUser = await dbClient.query('SELECT id FROM users WHERE username = $1', [
      username,
    ]);

    if (existingUser.rows.length > 0) {
      throw createAppError('Username already exists', 409, ErrorCodes.ALREADY_EXISTS);
    }

    // If employee_id is provided, verify it exists and belongs to user's tenant (non-TENANT_OWNER)
    if (employee_id) {
      if (!isValidUUID(employee_id)) {
        throw createAppError('Invalid employee ID format', 400, ErrorCodes.INVALID_INPUT);
      }

      const employeeCheck = await dbClient.query(
        'SELECT id, tenant_id FROM employees WHERE id = $1',
        [employee_id]
      );

      if (employeeCheck.rows.length === 0) {
        throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
      }

      // Non-SUPERUSER can only link users to employees in their tenant
      if (
        authReq.user.role !== 'SUPERUSER' &&
        employeeCheck.rows[0]?.tenant_id !== authReq.user.tenantId
      ) {
        throw createAppError(
          'Cannot link user to employee from another tenant',
          403,
          ErrorCodes.FORBIDDEN
        );
      }

      // Check if employee already has a user
      const existingUserForEmployee = await dbClient.query(
        'SELECT id FROM users WHERE employee_id = $1',
        [employee_id]
      );

      if (existingUserForEmployee.rows.length > 0) {
        throw createAppError('Employee already has a user account', 409, ErrorCodes.ALREADY_EXISTS);
      }
    }

    // Business rule: Non-SUPERUSER/TENANT_OWNER/DEMO users must have an employee_id
    if (!['SUPERUSER', 'TENANT_OWNER', 'DEMO'].includes(userRole) && !employee_id) {
      throw createAppError(
        'Non-system users must be linked to an employee',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userPassword, 12);

    // Create user
    const result = await dbClient.query(
      `INSERT INTO users (username, password_hash, role, permissions, employee_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, role, permissions, is_active, employee_id, created_at`,
      [username, passwordHash, userRole, permissions || [], employee_id || null, is_active]
    );

    const newUser = result.rows[0];

    // Send welcome email if requested and employee has email
    let welcomeEmailSent = false;
    if (send_welcome_email && employee_id) {
      const employeeInfo = await dbClient.query(
        `SELECT e.email, e.first_name, t.name as tenant_name
       FROM employees e
       JOIN tenants t ON e.tenant_id = t.id
       WHERE e.id = $1`,
        [employee_id]
      );
      if (employeeInfo.rows[0]?.email) {
        await sendWelcomeEmail(
          employeeInfo.rows[0]?.email,
          username,
          userPassword,
          employeeInfo.rows[0]?.tenant_name || 'Heuresys Platform'
        );
        welcomeEmailSent = true;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        permissions: newUser.permissions,
        isActive: newUser.is_active,
        employeeId: newUser.employee_id,
        createdAt: newUser.created_at,
        temporaryPassword: isTemporaryPassword ? userPassword : undefined,
        welcomeEmailSent,
      },
      message: 'User created successfully',
    });
  })
);

/**
 * PATCH /api/v1/users/:id
 * Update user (TENANT_OWNER+ only)
 */
router.patch(
  '/:id',
  requirePermission('SECURITY', 'EDIT'),
  validate(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid user ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    // Check user exists and get current data
    const existingResult = await dbClient.query(
      `SELECT u.*, e.tenant_id FROM users u
     LEFT JOIN employees e ON u.employee_id = e.id
     WHERE u.id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw createAppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const existingUser = existingResult.rows[0];

    // Non-SUPERUSER can only update users from their tenant
    if (
      authReq.user.role !== 'SUPERUSER' &&
      existingUser.tenant_id &&
      existingUser.tenant_id !== authReq.user.tenantId
    ) {
      throw createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);
    }

    // Cannot modify SUPERUSER users unless you are SUPERUSER
    if (existingUser.role === 'SUPERUSER' && authReq.user.role !== 'SUPERUSER') {
      throw createAppError('Cannot modify SUPERUSER users', 403, ErrorCodes.FORBIDDEN);
    }

    // Cannot modify users with higher privileges
    if (ROLES[existingUser.role as Role] < ROLES[authReq.user.role]) {
      throw createAppError('Cannot modify user with higher privileges', 403, ErrorCodes.FORBIDDEN);
    }

    // Build update query dynamically
    const allowedFields = ['username', 'role', 'permissions', 'employee_id', 'is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Role change validation
        if (field === 'role') {
          const newRole = req.body[field] as Role;
          if (!Object.keys(ROLES).includes(newRole)) {
            throw createAppError('Invalid role', 400, ErrorCodes.VALIDATION_ERROR);
          }
          if (newRole === 'SUPERUSER' && authReq.user.role !== 'SUPERUSER') {
            throw createAppError(
              'Only SUPERUSER can promote to SUPERUSER',
              403,
              ErrorCodes.FORBIDDEN
            );
          }
          if (ROLES[newRole] < ROLES[authReq.user.role]) {
            throw createAppError(
              'Cannot set role with higher privileges',
              403,
              ErrorCodes.FORBIDDEN
            );
          }
        }

        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    // Handle password update separately
    if (req.body.password) {
      const validation = validatePassword(req.body.password);
      if (!validation.valid) {
        throw createAppError(
          `Password does not meet policy requirements: ${validation.errors.join('; ')}`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      updates.push(`password_hash = $${paramIndex}`);
      values.push(passwordHash);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw createAppError('No fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await dbClient.query(
      `UPDATE users
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING id, username, role, permissions, is_active, employee_id, updated_at`,
      [...values, id]
    );

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        permissions: updatedUser.permissions,
        isActive: updatedUser.is_active,
        employeeId: updatedUser.employee_id,
        updatedAt: updatedUser.updated_at,
      },
      message: 'User updated successfully',
    });
  })
);

/**
 * DELETE /api/v1/users/:id
 * Delete user (TENANT_OWNER+ only, soft delete by default)
 */
router.delete(
  '/:id',
  requirePermission('SECURITY', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;
    const hardDelete = req.query['hard'] === 'true';

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid user ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    // Cannot delete yourself
    if (id === authReq.user.userId) {
      throw createAppError('Cannot delete your own account', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check user exists and get data
    const existingResult = await dbClient.query(
      `SELECT u.*, e.tenant_id FROM users u
     LEFT JOIN employees e ON u.employee_id = e.id
     WHERE u.id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw createAppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const existingUser = existingResult.rows[0];

    // Non-SUPERUSER can only delete users from their tenant
    if (
      authReq.user.role !== 'SUPERUSER' &&
      existingUser.tenant_id &&
      existingUser.tenant_id !== authReq.user.tenantId
    ) {
      throw createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);
    }

    // Cannot delete SUPERUSER users unless you are SUPERUSER
    if (existingUser.role === 'SUPERUSER' && authReq.user.role !== 'SUPERUSER') {
      throw createAppError('Cannot delete SUPERUSER users', 403, ErrorCodes.FORBIDDEN);
    }

    // Cannot delete users with higher privileges
    if (ROLES[existingUser.role as Role] < ROLES[authReq.user.role]) {
      throw createAppError('Cannot delete user with higher privileges', 403, ErrorCodes.FORBIDDEN);
    }

    if (hardDelete && authReq.user.role === 'SUPERUSER') {
      // Hard delete - only TENANT_OWNER
      await dbClient.query('DELETE FROM users WHERE id = $1', [id]);
      res.json({
        success: true,
        message: 'User permanently deleted',
      });
    } else {
      // Soft delete - deactivate
      await dbClient.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [
        id,
      ]);
      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    }
  })
);

/**
 * POST /api/v1/users/:id/reset-password
 * Reset user's password (TENANT_OWNER+ only)
 */
router.post(
  '/:id/reset-password',
  requirePermission('SECURITY', 'EDIT'),
  validate(resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;
    const id = req.params['id'] as string;
    const { new_password } = req.body;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid user ID format', 400, ErrorCodes.INVALID_INPUT);
    }

    if (!new_password) {
      throw createAppError('New password is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validation = validatePassword(new_password);
    if (!validation.valid) {
      throw createAppError(
        `Password does not meet policy requirements: ${validation.errors.join('; ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check user exists
    const existingResult = await dbClient.query(
      `SELECT u.*, e.tenant_id FROM users u
     LEFT JOIN employees e ON u.employee_id = e.id
     WHERE u.id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw createAppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const existingUser = existingResult.rows[0];

    // Non-SUPERUSER can only reset passwords for users in their tenant
    if (
      authReq.user.role !== 'SUPERUSER' &&
      existingUser.tenant_id &&
      existingUser.tenant_id !== authReq.user.tenantId
    ) {
      throw createAppError('Access denied', 403, ErrorCodes.FORBIDDEN);
    }

    // Cannot reset SUPERUSER passwords unless you are SUPERUSER
    if (existingUser.role === 'SUPERUSER' && authReq.user.role !== 'SUPERUSER') {
      throw createAppError('Cannot reset SUPERUSER passwords', 403, ErrorCodes.FORBIDDEN);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(new_password, 12);

    await dbClient.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      id,
    ]);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  })
);

/**
 * POST /api/v1/users/bulk
 * Bulk create users from employee list (TENANT_OWNER+ only)
 */
router.post(
  '/bulk',
  requirePermission('SECURITY', 'CREATE'),
  validate(bulkCreateUsersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dbClient = req.dbClient || pool;
    const { employee_ids, role = 'USER', send_welcome_emails = false } = req.body;

    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      throw createAppError('employee_ids array is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (employee_ids.length > 100) {
      throw createAppError(
        'Maximum 100 users per bulk operation',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate role
    const validRoles = Object.keys(ROLES);
    const userRole: Role = role as Role;
    if (!validRoles.includes(userRole)) {
      throw createAppError(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Only SUPERUSER can create SUPERUSER users
    if (userRole === 'SUPERUSER' && authReq.user.role !== 'SUPERUSER') {
      throw createAppError('Only SUPERUSER can create SUPERUSER users', 403, ErrorCodes.FORBIDDEN);
    }

    // Get tenant info for username generation
    const tenantResult = await dbClient.query('SELECT code, name FROM tenants WHERE id = $1', [
      authReq.user.tenantId,
    ]);
    const tenantCode = tenantResult.rows[0]?.code || 'sys';
    const tenantName = tenantResult.rows[0]?.name || 'Heuresys Platform';

    // Get employee data
    const employeesResult = await dbClient.query(
      `SELECT id, first_name, last_name, email, tenant_id
     FROM employees
     WHERE id = ANY($1)`,
      [employee_ids]
    );

    const results: {
      created: { employeeId: string; username: string; temporaryPassword: string }[];
      skipped: { employeeId: string; reason: string }[];
      failed: { employeeId: string; error: string }[];
    } = { created: [], skipped: [], failed: [] };

    for (const employeeId of employee_ids) {
      try {
        const employee = employeesResult.rows.find((e: { id: string }) => e.id === employeeId);

        if (!employee) {
          results.skipped.push({ employeeId, reason: 'Employee not found' });
          continue;
        }

        // Non-SUPERUSER can only create users for their tenant
        if (authReq.user.role !== 'SUPERUSER' && employee.tenant_id !== authReq.user.tenantId) {
          results.skipped.push({ employeeId, reason: 'Employee from different tenant' });
          continue;
        }

        // Check if user already exists
        const existingCheck = await dbClient.query('SELECT id FROM users WHERE employee_id = $1', [
          employeeId,
        ]);

        if (existingCheck.rows.length > 0) {
          results.skipped.push({ employeeId, reason: 'User already exists' });
          continue;
        }

        // Generate username
        const baseUsername =
          `${tenantCode}.${employee.first_name.toLowerCase()}.${employee.last_name.toLowerCase()}`.replace(
            /[^a-z0-9.]/g,
            ''
          );

        // Check for uniqueness and add suffix if needed
        let username = baseUsername;
        let suffix = 1;
        let usernameExists = true;
        while (usernameExists) {
          const check = await dbClient.query('SELECT id FROM users WHERE username = $1', [
            username,
          ]);
          if (check.rows.length === 0) {
            usernameExists = false;
          } else {
            username = `${baseUsername}${suffix}`;
            suffix++;
          }
        }

        // Generate password
        const temporaryPassword = generateSecurePassword(16);
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        // Create user
        await dbClient.query(
          `INSERT INTO users (username, password_hash, role, permissions, employee_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
          [username, passwordHash, userRole, [], employeeId]
        );

        // Send welcome email if requested
        if (send_welcome_emails && employee.email) {
          await sendWelcomeEmail(employee.email, username, temporaryPassword, tenantName);
        }

        results.created.push({ employeeId, username, temporaryPassword });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.failed.push({ employeeId, error: errorMessage });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        summary: {
          total: employee_ids.length,
          created: results.created.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
        },
        results,
      },
      message: `Bulk user creation completed: ${results.created.length} created, ${results.skipped.length} skipped, ${results.failed.length} failed`,
    });
  })
);

/**
 * GET /api/v1/users/permissions/available
 * Get list of all available permissions
 */
router.get(
  '/permissions/available',
  requirePermission('SECURITY', 'VIEW'),
  async (_req: Request, res: Response) => {
    // Permission categories based on RBAC system
    const permissions = {
      employees: [
        'employees:view:own',
        'employees:view:team',
        'employees:view:all',
        'employees:create',
        'employees:update',
        'employees:delete',
      ],
      leave: [
        'leave:view:own',
        'leave:view:team',
        'leave:view:all',
        'leave:request',
        'leave:approve',
        'leave:configure',
      ],
      reports: ['reports:view:own', 'reports:view:team', 'reports:view:all', 'reports:export'],
      tenant: ['tenant:configure', 'tenant:manage_users'],
      audit: ['audit:view', 'audit:export'],
      ai: ['ai:query', 'ai:configure'],
    };

    res.json({
      success: true,
      data: permissions,
    });
  }
);

export default router;
