/**
 * Auth Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for authentication endpoints.
 * All external dependencies (database, redis) are mocked.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------

// Helper: resolve module path relative to this file (absolute .ts path for ESM mocks)
const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

// Mock the database pool
const mockQuery = jest.fn();
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
  pool: { query: mockQuery },
  appPool: { connect: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true as never),
  testAppConnection: jest.fn().mockResolvedValue(true as never),
  closePool: jest.fn().mockResolvedValue(undefined as never),
  getAppClient: jest.fn(),
  withTenantClient: jest.fn(),
}));

// Mock redis (token blacklisting)
jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
  getRedis: jest.fn(),
  isRedisReady: jest.fn().mockReturnValue(false),
  blacklistToken: jest.fn().mockResolvedValue(true as never),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false as never),
  closeRedis: jest.fn().mockResolvedValue(undefined as never),
}));

// Mock bcryptjs
const mockCompare = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({
  default: { compare: mockCompare },
  compare: mockCompare,
}));

// Mock Sentry
jest.unstable_mockModule(resolve('../../errors/sentry.js'), () => ({
  initSentry: jest.fn(),
  sentryErrorLogger: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  flush: jest.fn(),
  close: jest.fn(),
  isActive: jest.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: authRoutes } = await import('../../routes/auth.js');
const { generateToken } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  // Add requestId middleware stub
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/auth', (req, _res, next) => {
    req.dbClient = { query: mockQuery, release: jest.fn() } as never;
    next();
  });
  app.use('/api/v1/auth', authRoutes);
  // Simple error handler for tests
  app.use(
    (
      err: {
        statusCode?: number;
        httpStatus?: number;
        message?: string;
        details?: Record<string, unknown>;
      },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(err.details && Object.keys(err.details).length > 0 ? { details: err.details } : {}),
      });
    }
  );
  return app;
}

// ---------------------------------------------------------------------------
// Helper: generate a valid auth token for protected routes
// ---------------------------------------------------------------------------

function createValidToken(): string {
  return generateToken({
    userId: 'user-uuid-1',
    username: 'testuser',
    role: 'SYSADMIN',
    permissions: ['platform:admin'],
    employeeId: 'emp-uuid-1',
    tenantId: 'tenant-uuid-1',
  });
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Auth Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  // =========================================================================
  // POST /api/v1/auth/login
  // =========================================================================
  describe('POST /api/v1/auth/login', () => {
    it('should return 400 when username is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ password: 'MyP@ssword1234' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when password is missing', async () => {
      const res = await supertest(app).post('/api/v1/auth/login').send({ username: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when body is empty', async () => {
      const res = await supertest(app).post('/api/v1/auth/login').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when user does not exist', async () => {
      // No account lock
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // checkAccountLock
      // User lookup returns empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // SELECT user
      // recordFailedAttempt - INSERT on conflict
      mockQuery.mockResolvedValueOnce({ rows: [{ attempt_count: 1 }], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent', password: 'SomeP@ss1234' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when password is incorrect', async () => {
      // No account lock
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // checkAccountLock
      // User found
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-uuid-1',
            username: 'admin',
            password_hash: '$2b$12$hashedpassword',
            role: 'ADMIN',
            permissions: [],
            is_active: true,
            employee_id: 'emp-1',
            tenant_id: 'tenant-1',
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@test.com',
          },
        ],
        rowCount: 1,
      } as never);
      // bcrypt compare returns false
      mockCompare.mockResolvedValueOnce(false as never);
      // recordFailedAttempt
      mockQuery.mockResolvedValueOnce({ rows: [{ attempt_count: 1 }], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'WrongP@ssword1' });

      expect(res.status).toBe(401);
    });

    it('should return 401 when user account is disabled', async () => {
      // No account lock
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // User found but inactive
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-uuid-1',
            username: 'admin',
            password_hash: '$2b$12$hash',
            role: 'ADMIN',
            permissions: [],
            is_active: false,
            employee_id: 'emp-1',
            tenant_id: 'tenant-1',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'SomeP@ss1234' });

      expect(res.status).toBe(401);
    });

    it('should return 429 when account is locked', async () => {
      // Account is locked
      const futureDate = new Date(Date.now() + 60000).toISOString();
      mockQuery.mockResolvedValueOnce({
        rows: [{ attempt_count: 5, locked_until: futureDate }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'SomeP@ss1234' });

      expect(res.status).toBe(429);
      expect(res.body.retryAfter).toBeDefined();
      expect(res.body.retryAfter).toBeGreaterThan(0);
    });

    it('should return 200 with tokens on successful login', async () => {
      // No account lock
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // checkAccountLock
      // User found
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-uuid-1',
            username: 'admin',
            password_hash: '$2b$12$validhash',
            role: 'ADMIN',
            permissions: ['platform:admin'],
            is_active: true,
            employee_id: 'emp-1',
            tenant_id: 'tenant-1',
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@test.com',
          },
        ],
        rowCount: 1,
      } as never);
      // bcrypt compare returns true
      mockCompare.mockResolvedValueOnce(true as never);
      // resetLoginAttempts
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // UPDATE last_login
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'ValidP@ss1234' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user).toHaveProperty('id', 'user-uuid-1');
      expect(res.body.data.user).toHaveProperty('username', 'admin');
      expect(res.body.data.user).toHaveProperty('role', 'ADMIN');
    });
  });

  // =========================================================================
  // POST /api/v1/auth/refresh
  // =========================================================================
  describe('POST /api/v1/auth/refresh', () => {
    it('should return 400 when refreshToken is missing', async () => {
      const res = await supertest(app).post('/api/v1/auth/refresh').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when refreshToken is invalid', async () => {
      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/verify
  // =========================================================================
  describe('POST /api/v1/auth/verify', () => {
    it('should return 400 when token is missing', async () => {
      const res = await supertest(app).post('/api/v1/auth/verify').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return valid=true for a valid token', async () => {
      const token = createValidToken();

      const res = await supertest(app).post('/api/v1/auth/verify').send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.userId).toBe('user-uuid-1');
      expect(res.body.data.username).toBe('testuser');
      expect(res.body.data.role).toBe('SYSADMIN');
    });

    it('should return valid=false for an invalid token', async () => {
      const res = await supertest(app)
        .post('/api/v1/auth/verify')
        .send({ token: 'totally.invalid.token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/logout (protected)
  // =========================================================================
  describe('POST /api/v1/auth/logout', () => {
    it('should return 401 when no auth token is provided', async () => {
      const res = await supertest(app).post('/api/v1/auth/logout').send({});

      expect(res.status).toBe(401);
    });

    it('should return 200 on successful logout with valid token', async () => {
      const token = createValidToken();

      const res = await supertest(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });

  // =========================================================================
  // GET /api/v1/auth/me (protected)
  // =========================================================================
  describe('GET /api/v1/auth/me', () => {
    it('should return 401 when no auth token is provided', async () => {
      const res = await supertest(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return user profile with valid token', async () => {
      const token = createValidToken();

      // Mock user query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-uuid-1',
            username: 'testuser',
            role: 'SYSADMIN',
            permissions: ['platform:admin'],
            is_active: true,
            last_login: '2025-01-01T00:00:00.000Z',
            employee_id: 'emp-uuid-1',
            tenant_id: 'tenant-uuid-1',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@heuresys.com',
            job_title: 'Engineer',
            department: 'IT',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', 'user-uuid-1');
      expect(res.body.data).toHaveProperty('username', 'testuser');
      expect(res.body.data).toHaveProperty('role', 'SYSADMIN');
      expect(res.body.data).toHaveProperty('firstName', 'Test');
      expect(res.body.data).toHaveProperty('lastName', 'User');
    });

    it('should return 404 when user is not found in database', async () => {
      const token = createValidToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/change-password (protected)
  // =========================================================================
  describe('POST /api/v1/auth/change-password', () => {
    it('should return 401 when no auth token is provided', async () => {
      const res = await supertest(app)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'new' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when currentPassword is missing', async () => {
      const token = createValidToken();

      const res = await supertest(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword: 'NewP@ss12345!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when newPassword is missing', async () => {
      const token = createValidToken();

      const res = await supertest(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldP@ss12345!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when newPassword fails policy validation', async () => {
      const token = createValidToken();

      // Password passes Zod (>= 8 chars) but fails policy (< 12 chars, missing special chars)
      const res = await supertest(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldP@ss12345!', newPassword: 'Abcdefg1' });

      expect(res.status).toBe(400);
      expect(res.body.details).toBeDefined();
    });
  });

  // =========================================================================
  // POST /api/v1/auth/unlock-account (SYSADMIN only)
  // =========================================================================
  describe('POST /api/v1/auth/unlock-account', () => {
    it('should return 401 when no auth token is provided', async () => {
      const res = await supertest(app)
        .post('/api/v1/auth/unlock-account')
        .send({ username: 'locked-user' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when username is missing', async () => {
      const token = createValidToken();

      const res = await supertest(app)
        .post('/api/v1/auth/unlock-account')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 200 and unlock account successfully', async () => {
      const token = createValidToken(); // SYSADMIN role

      mockQuery.mockResolvedValueOnce({
        rows: [{ username: 'locked-user' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/auth/unlock-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'locked-user' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('unlocked');
    });

    it('should return 403 when non-SYSADMIN user attempts unlock', async () => {
      const token = generateToken({
        userId: 'user-uuid-2',
        username: 'normaluser',
        role: 'EMPLOYEE',
        permissions: [],
      });

      const res = await supertest(app)
        .post('/api/v1/auth/unlock-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'locked-user' });

      expect(res.status).toBe(403);
    });
  });
});
