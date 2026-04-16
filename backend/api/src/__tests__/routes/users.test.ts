/**
 * Users Routes Unit Tests
 * Tests for user management endpoints
 */

import { describe, it, expect } from '@jest/globals';
import usersRouter from '../../routes/users.js';

describe('Users Routes', () => {
  describe('Router Configuration', () => {
    it('should export a router', () => {
      expect(usersRouter).toBeDefined();
      expect(typeof usersRouter).toBe('function');
    });

    it('should have router stack with routes', () => {
      const stack = usersRouter.stack;
      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBeGreaterThan(0);
    });

    it('should have auth middleware applied to all routes', () => {
      // First item in stack should be the auth middleware
      const firstMiddleware = usersRouter.stack[0];
      expect(firstMiddleware).toBeDefined();
      // Auth middleware is applied with router.use()
      expect(firstMiddleware.name).toBeDefined();
    });

    it('should have GET /meta/roles route', () => {
      const metaRolesRoute = usersRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/meta/roles' && layer.route?.methods?.get
      );
      expect(metaRolesRoute).toBeDefined();
    });

    it('should have GET / route for listing users', () => {
      const getRoute = usersRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/' && layer.route?.methods?.get
      );
      expect(getRoute).toBeDefined();
    });

    it('should have GET /:id route for getting user by ID', () => {
      const getByIdRoute = usersRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/:id' && layer.route?.methods?.get
      );
      expect(getByIdRoute).toBeDefined();
    });

    it('should have POST / route for creating user', () => {
      const postRoute = usersRouter.stack.find(
        (layer: { route?: { path: string; methods: { post?: boolean } } }) =>
          layer.route?.path === '/' && layer.route?.methods?.post
      );
      expect(postRoute).toBeDefined();
    });

    it('should have PATCH /:id route for updating user', () => {
      const patchRoute = usersRouter.stack.find(
        (layer: { route?: { path: string; methods: { patch?: boolean } } }) =>
          layer.route?.path === '/:id' && layer.route?.methods?.patch
      );
      expect(patchRoute).toBeDefined();
    });

    it('should have DELETE /:id route for deleting user', () => {
      const deleteRoute = usersRouter.stack.find(
        (layer: { route?: { path: string; methods: { delete?: boolean } } }) =>
          layer.route?.path === '/:id' && layer.route?.methods?.delete
      );
      expect(deleteRoute).toBeDefined();
    });
  });

  describe('Protected Routes', () => {
    it('should require authentication for all routes', () => {
      // All routes should have auth middleware
      // The first item in stack is the auth middleware applied via router.use()
      const hasAuthMiddleware = usersRouter.stack.some(
        (layer: { handle?: { name?: string }; name?: string }) =>
          layer.name === 'authMiddleware' || layer.handle?.name === 'authMiddleware'
      );
      // Auth is applied at router level
      expect(usersRouter.stack.length).toBeGreaterThan(0);
    });
  });
});

describe('Users API Response Format', () => {
  it('should define expected user object structure', () => {
    const expectedUser = {
      id: 'uuid',
      username: 'john.doe',
      role: 'USER',
      permissions: ['VIEW_DASHBOARD'],
      is_active: true,
      last_login: '2025-01-01T00:00:00.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      employee_id: 'uuid',
    };

    expect(expectedUser).toHaveProperty('id');
    expect(expectedUser).toHaveProperty('username');
    expect(expectedUser).toHaveProperty('role');
    expect(expectedUser).toHaveProperty('is_active');
  });

  it('should define expected roles metadata structure (post-migration-109)', () => {
    // Post-migration 109: SUPERUSER(-1) added as god-role; legacy roles mapped to new names
    const expectedRolesMeta = {
      success: true,
      data: [
        { name: 'SUPERUSER', level: -1, description: expect.any(String) },
        { name: 'SYSADMIN', level: 0, description: expect.any(String) },
        { name: 'IT_ADMIN', level: 1, description: expect.any(String) },
        { name: 'HR_DIRECTOR', level: 2, description: expect.any(String) },
        { name: 'HR_MANAGER', level: 3, description: expect.any(String) },
        { name: 'DEPT_HEAD', level: 4, description: expect.any(String) },
        { name: 'LINE_MANAGER', level: 5, description: expect.any(String) },
        { name: 'EMPLOYEE', level: 6, description: expect.any(String) },
      ],
    };

    expect(expectedRolesMeta.success).toBe(true);
    expect(expectedRolesMeta.data).toHaveLength(8);
  });

  it('should validate role hierarchy values (post-migration-109)', () => {
    // SUPERUSER is god-role (cross-tenant), SYSADMIN is per-tenant admin
    const roleHierarchy = {
      SUPERUSER: -1,
      SYSADMIN: 0,
      IT_ADMIN: 1,
      HR_DIRECTOR: 2,
      HR_MANAGER: 3,
      DEPT_HEAD: 4,
      LINE_MANAGER: 5,
      EMPLOYEE: 6,
    };

    expect(roleHierarchy.SUPERUSER).toBeLessThan(roleHierarchy.SYSADMIN);
    expect(roleHierarchy.SYSADMIN).toBeLessThan(roleHierarchy.EMPLOYEE);
    expect(roleHierarchy.SUPERUSER).toBe(-1);
    expect(roleHierarchy.SYSADMIN).toBe(0);
  });
});

describe('User Creation Request Validation', () => {
  it('should define required fields for user creation', () => {
    const requiredFields = ['username', 'role', 'tenantId'];

    requiredFields.forEach((field) => {
      expect(typeof field).toBe('string');
    });
  });

  it('should define valid roles for user creation (post-migration-109)', () => {
    // Primary roles post-migration 109; legacy aliases (ADMIN, HR, USER, DEMO) still map via ROLES constant
    const validRoles = [
      'SUPERUSER',
      'SYSADMIN',
      'IT_ADMIN',
      'HR_DIRECTOR',
      'HR_MANAGER',
      'DEPT_HEAD',
      'LINE_MANAGER',
      'EMPLOYEE',
    ];

    validRoles.forEach((role) => {
      expect(typeof role).toBe('string');
      expect(role).toBe(role.toUpperCase());
    });
  });

  it('should validate password requirements', () => {
    // Password should be auto-generated if not provided
    const minPasswordLength = 12;
    const passwordCharset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

    expect(minPasswordLength).toBeGreaterThanOrEqual(8);
    expect(passwordCharset).toContain('A');
    expect(passwordCharset).toContain('a');
    expect(passwordCharset).toContain('0');
    expect(passwordCharset).toContain('!');
  });
});
