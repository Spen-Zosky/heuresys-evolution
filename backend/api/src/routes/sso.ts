/**
 * SSO Authentication Routes
 * Azure AD and Google Workspace SSO integration
 * Epic: 2 - User Management & Tenant Configuration
 * Story: 2.4 - SSO Integration - Azure AD
 * Story: 2.5 - SSO Integration - Google Workspace
 */

import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import { config } from '../config/index.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { generateToken, generateRefreshToken, Role } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  testAzureConfigSchema,
  testGoogleConfigSchema,
  updateAzureConfigSchema,
  updateGoogleConfigSchema,
} from '../schemas/admin.js';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

// SSO provider configuration stored in tenant settings

interface OIDCTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface AzureADUserInfo {
  sub: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  hd?: string; // Hosted domain (Google Workspace)
}

// =============================================================================
// GET /api/v1/auth/sso/providers
// List available SSO providers for a tenant
// =============================================================================
router.get(
  '/providers',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const tenantCode = req.query['tenant'] as string;

    if (!tenantCode) {
      throw Errors.badRequest('Tenant code is required');
    }

    const result = await dbClient.query(
      `SELECT settings->'sso' as sso_config FROM tenants WHERE code = $1`,
      [tenantCode]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Tenant', tenantCode);
    }

    const ssoConfig = result.rows[0]?.sso_config || {};

    const providers = [];

    if (ssoConfig.azureAd?.enabled) {
      providers.push({
        provider: 'azure_ad',
        name: 'Microsoft',
        icon: 'microsoft',
        loginUrl: `/api/v1/auth/sso/azure/login?tenant=${tenantCode}`,
      });
    }

    if (ssoConfig.google?.enabled) {
      providers.push({
        provider: 'google',
        name: 'Google',
        icon: 'google',
        loginUrl: `/api/v1/auth/sso/google/login?tenant=${tenantCode}`,
      });
    }

    res.json({
      success: true,
      data: {
        localAuthEnabled: ssoConfig.provider !== 'sso_only',
        providers,
      },
    });
  })
);

// =============================================================================
// AZURE AD SSO ROUTES
// =============================================================================

/**
 * GET /api/v1/auth/sso/azure/login
 * Initiate Azure AD OAuth flow
 */
router.get(
  '/azure/login',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const tenantCode = req.query['tenant'] as string;
    const redirectAfterLogin = (req.query['redirect'] as string) || '/dashboard';

    if (!tenantCode) {
      throw Errors.badRequest('Tenant code is required');
    }

    // Get Azure AD config for tenant
    const result = await dbClient.query(
      `SELECT id, settings->'sso'->'azureAd' as azure_config FROM tenants WHERE code = $1`,
      [tenantCode]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Tenant', tenantCode);
    }

    const azureConfig = result.rows[0]?.azure_config;

    if (!azureConfig?.enabled) {
      throw Errors.badRequest('Azure AD SSO not enabled for this tenant');
    }

    // Build Azure AD authorization URL
    const azureTenantId = azureConfig.tenantId || 'common';
    const clientId = azureConfig.clientId;
    const redirectUri =
      azureConfig.redirectUri || `${config.baseUrl}/api/v1/auth/sso/azure/callback`;
    const scope = 'openid profile email';
    const state = Buffer.from(
      JSON.stringify({
        tenantCode,
        tenantId: result.rows[0]?.id,
        redirect: redirectAfterLogin,
      })
    ).toString('base64');

    const authUrl = new URL(
      `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/authorize`
    );
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_mode', 'query');

    res.redirect(authUrl.toString());
  })
);

/**
 * GET /api/v1/auth/sso/azure/callback
 * Azure AD OAuth callback
 */
router.get(
  '/azure/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const code = req.query['code'] as string;
    const state = req.query['state'] as string;
    const error = req.query['error'] as string;
    const errorDescription = req.query['error_description'] as string;

    if (error) {
      throw Errors.badRequest(`Azure AD error: ${errorDescription || error}`);
    }

    if (!code || !state) {
      throw Errors.badRequest('Missing authorization code or state');
    }

    // Decode state
    let stateData: { tenantCode: string; tenantId: string; redirect: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      throw Errors.badRequest('Invalid state parameter');
    }

    // Get Azure AD config
    const tenantResult = await dbClient.query(
      `SELECT id, code, settings->'sso'->'azureAd' as azure_config FROM tenants WHERE id = $1`,
      [stateData.tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw Errors.notFound('Tenant', stateData.tenantId);
    }

    const azureConfig = tenantResult.rows[0]?.azure_config;
    const azureTenantId = azureConfig.tenantId || 'common';

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams({
      client_id: azureConfig.clientId,
      client_secret: azureConfig.clientSecret,
      code,
      redirect_uri: azureConfig.redirectUri || `${config.baseUrl}/api/v1/auth/sso/azure/callback`,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch(tokenUrl, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = (await tokenResponse.json()) as { error_description?: string };
      throw Errors.badRequest(
        `Token exchange failed: ${errorData.error_description || 'Unknown error'}`
      );
    }

    const tokens = (await tokenResponse.json()) as OIDCTokenResponse;

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw Errors.badRequest('Failed to fetch user info from Microsoft');
    }

    const userInfo = (await userInfoResponse.json()) as AzureADUserInfo;

    // Provision or update user via JIT provisioning
    const user = await provisionSSOUser(
      dbClient,
      stateData.tenantId,
      userInfo.email,
      userInfo.given_name || userInfo.name.split(' ')[0] || 'User',
      userInfo.family_name || userInfo.name.split(' ').slice(1).join(' ') || '',
      'azure_ad',
      userInfo.sub
    );

    // Generate JWT tokens
    const tokenPayload: Parameters<typeof generateToken>[0] = {
      userId: user.id,
      username: user.username,
      role: user.role as Role,
      permissions: user.permissions || [],
      tenantId: stateData.tenantId,
    };
    if (user.employee_id) {
      tokenPayload.employeeId = user.employee_id;
    }
    const accessToken = generateToken(tokenPayload);

    const refreshToken = generateRefreshToken(user.id);

    // Redirect to frontend with tokens
    const redirectUrl = new URL(
      stateData.redirect || '/dashboard',
      config.frontendUrl || config.baseUrl
    );
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);

    res.redirect(redirectUrl.toString());
  })
);

/**
 * POST /api/v1/auth/sso/azure/test
 * Test Azure AD connection
 */
router.post(
  '/azure/test',
  validate(testAzureConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, clientSecret, azureTenantId } = req.body;

    if (!clientId || !clientSecret || !azureTenantId) {
      throw Errors.badRequest('Missing required Azure AD configuration');
    }

    // Try to get an app-only token to test credentials
    const tokenUrl = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await fetch(tokenUrl, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error_description?: string };
      throw Errors.badRequest(
        `Connection failed: ${errorData.error_description || 'Invalid credentials'}`
      );
    }

    res.json({
      success: true,
      data: {
        message: 'Azure AD connection successful',
        connected: true,
      },
    });
  })
);

// =============================================================================
// GOOGLE WORKSPACE SSO ROUTES
// =============================================================================

/**
 * GET /api/v1/auth/sso/google/login
 * Initiate Google OAuth flow
 */
router.get(
  '/google/login',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const tenantCode = req.query['tenant'] as string;
    const redirectAfterLogin = (req.query['redirect'] as string) || '/dashboard';

    if (!tenantCode) {
      throw Errors.badRequest('Tenant code is required');
    }

    // Get Google config for tenant
    const result = await dbClient.query(
      `SELECT id, settings->'sso'->'google' as google_config FROM tenants WHERE code = $1`,
      [tenantCode]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Tenant', tenantCode);
    }

    const googleConfig = result.rows[0]?.google_config;

    if (!googleConfig?.enabled) {
      throw Errors.badRequest('Google SSO not enabled for this tenant');
    }

    // Build Google authorization URL
    const clientId = googleConfig.clientId;
    const redirectUri =
      googleConfig.redirectUri || `${config.baseUrl}/api/v1/auth/sso/google/callback`;
    const scope = 'openid profile email';
    const state = Buffer.from(
      JSON.stringify({
        tenantCode,
        tenantId: result.rows[0]?.id,
        redirect: redirectAfterLogin,
        allowedDomains: googleConfig.allowedDomains || [],
      })
    ).toString('base64');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'select_account');

    // If specific domain required, add hd parameter
    if (googleConfig.allowedDomains?.length === 1) {
      authUrl.searchParams.set('hd', googleConfig.allowedDomains[0]);
    }

    res.redirect(authUrl.toString());
  })
);

/**
 * GET /api/v1/auth/sso/google/callback
 * Google OAuth callback
 */
router.get(
  '/google/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const code = req.query['code'] as string;
    const state = req.query['state'] as string;
    const error = req.query['error'] as string;

    if (error) {
      throw Errors.badRequest(`Google error: ${error}`);
    }

    if (!code || !state) {
      throw Errors.badRequest('Missing authorization code or state');
    }

    // Decode state
    let stateData: {
      tenantCode: string;
      tenantId: string;
      redirect: string;
      allowedDomains: string[];
    };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      throw Errors.badRequest('Invalid state parameter');
    }

    // Get Google config
    const tenantResult = await dbClient.query(
      `SELECT id, code, settings->'sso'->'google' as google_config FROM tenants WHERE id = $1`,
      [stateData.tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw Errors.notFound('Tenant', stateData.tenantId);
    }

    const googleConfig = tenantResult.rows[0]?.google_config;

    // Exchange code for tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenParams = new URLSearchParams({
      client_id: googleConfig.clientId,
      client_secret: googleConfig.clientSecret,
      code,
      redirect_uri: googleConfig.redirectUri || `${config.baseUrl}/api/v1/auth/sso/google/callback`,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch(tokenUrl, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = (await tokenResponse.json()) as { error_description?: string };
      throw Errors.badRequest(
        `Token exchange failed: ${errorData.error_description || 'Unknown error'}`
      );
    }

    const tokens = (await tokenResponse.json()) as OIDCTokenResponse;

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw Errors.badRequest('Failed to fetch user info from Google');
    }

    const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

    // Validate domain restriction
    if (stateData.allowedDomains?.length > 0) {
      const userDomain = userInfo.hd || userInfo.email.split('@')[1];
      if (!stateData.allowedDomains.includes(userDomain!)) {
        throw Errors.forbidden('Google account', 'login to this organization');
      }
    }

    // Provision or update user via JIT provisioning
    const user = await provisionSSOUser(
      dbClient,
      stateData.tenantId,
      userInfo.email,
      userInfo.given_name || userInfo.name.split(' ')[0] || 'User',
      userInfo.family_name || userInfo.name.split(' ').slice(1).join(' ') || '',
      'google',
      userInfo.sub
    );

    // Generate JWT tokens
    const googleTokenPayload: Parameters<typeof generateToken>[0] = {
      userId: user.id,
      username: user.username,
      role: user.role as Role,
      permissions: user.permissions || [],
      tenantId: stateData.tenantId,
    };
    if (user.employee_id) {
      googleTokenPayload.employeeId = user.employee_id;
    }
    const accessToken = generateToken(googleTokenPayload);

    const refreshToken = generateRefreshToken(user.id);

    // Redirect to frontend with tokens
    const redirectUrl = new URL(
      stateData.redirect || '/dashboard',
      config.frontendUrl || config.baseUrl
    );
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);

    res.redirect(redirectUrl.toString());
  })
);

/**
 * POST /api/v1/auth/sso/google/test
 * Test Google connection
 */
router.post(
  '/google/test',
  validate(testGoogleConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, clientSecret } = req.body;

    if (!clientId || !clientSecret) {
      throw Errors.badRequest('Missing required Google configuration');
    }

    // For Google, we can't really test without user interaction
    // Just validate the format
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      throw Errors.badRequest('Invalid Google Client ID format');
    }

    res.json({
      success: true,
      data: {
        message: 'Google configuration format is valid',
        connected: true,
        note: 'Full connection test requires user authentication',
      },
    });
  })
);

// =============================================================================
// SSO CONFIGURATION ROUTES
// =============================================================================

/**
 * PUT /api/v1/auth/sso/azure/config
 * Configure Azure AD SSO for tenant
 */
router.put(
  '/azure/config',
  validate(updateAzureConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { tenantId, clientId, clientSecret, azureTenantId, enabled } = req.body;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID is required');
    }

    // Get current settings
    const currentResult = await dbClient.query('SELECT settings FROM tenants WHERE id = $1', [
      tenantId,
    ]);

    if (currentResult.rows.length === 0) {
      throw Errors.notFound('Tenant', tenantId);
    }

    const currentSettings = currentResult.rows[0]?.settings || {};

    // Update SSO config
    const newSettings = {
      ...currentSettings,
      sso: {
        ...currentSettings.sso,
        provider: enabled
          ? currentSettings.sso?.provider || 'azure_ad'
          : currentSettings.sso?.provider,
        azureAd: {
          enabled: !!enabled,
          clientId: clientId || '',
          clientSecret: clientSecret || '',
          tenantId: azureTenantId || 'common',
          redirectUri: `${config.baseUrl}/api/v1/auth/sso/azure/callback`,
        },
      },
    };

    await dbClient.query(`UPDATE tenants SET settings = $2, updated_at = NOW() WHERE id = $1`, [
      tenantId,
      JSON.stringify(newSettings),
    ]);

    res.json({
      success: true,
      data: {
        message: 'Azure AD SSO configuration saved',
        enabled: !!enabled,
      },
    });
  })
);

/**
 * PUT /api/v1/auth/sso/google/config
 * Configure Google SSO for tenant
 */
router.put(
  '/google/config',
  validate(updateGoogleConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const { tenantId, clientId, clientSecret, allowedDomains, enabled } = req.body;

    if (!tenantId) {
      throw Errors.badRequest('Tenant ID is required');
    }

    // Get current settings
    const currentResult = await dbClient.query('SELECT settings FROM tenants WHERE id = $1', [
      tenantId,
    ]);

    if (currentResult.rows.length === 0) {
      throw Errors.notFound('Tenant', tenantId);
    }

    const currentSettings = currentResult.rows[0]?.settings || {};

    // Update SSO config
    const newSettings = {
      ...currentSettings,
      sso: {
        ...currentSettings.sso,
        provider: enabled
          ? currentSettings.sso?.provider || 'google'
          : currentSettings.sso?.provider,
        google: {
          enabled: !!enabled,
          clientId: clientId || '',
          clientSecret: clientSecret || '',
          allowedDomains: allowedDomains || [],
          redirectUri: `${config.baseUrl}/api/v1/auth/sso/google/callback`,
        },
      },
    };

    await dbClient.query(`UPDATE tenants SET settings = $2, updated_at = NOW() WHERE id = $1`, [
      tenantId,
      JSON.stringify(newSettings),
    ]);

    res.json({
      success: true,
      data: {
        message: 'Google SSO configuration saved',
        enabled: !!enabled,
      },
    });
  })
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * JIT Provisioning - Create or update user from SSO
 */
async function provisionSSOUser(
  dbClient: PoolClient,
  tenantId: string,
  email: string,
  firstName: string,
  lastName: string,
  _ssoProvider: 'azure_ad' | 'google',
  _ssoId: string
): Promise<{
  id: string;
  username: string;
  role: string;
  permissions: string[];
  employee_id: string | null;
}> {
  // Check if user exists by email in this tenant
  const existingUser = await dbClient.query(
    `SELECT u.id, u.username, u.role, u.permissions, u.employee_id
     FROM users u
     JOIN employees e ON u.employee_id = e.id
     WHERE e.tenant_id = $1 AND e.email = $2`,
    [tenantId, email]
  );

  if (existingUser.rows.length > 0) {
    // Update last login and return existing user
    await dbClient.query(`UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1`, [
      existingUser.rows[0]?.id,
    ]);
    return existingUser.rows[0];
  }

  // JIT Provisioning - Create new employee and user
  const tenantResult = await dbClient.query('SELECT code FROM tenants WHERE id = $1', [tenantId]);
  const tenantCode = tenantResult.rows[0]?.code || 'unknown';

  // Create employee
  const employeeResult = await dbClient.query(
    `INSERT INTO employees (tenant_id, first_name, last_name, email, employment_status, auth_role)
     VALUES ($1, $2, $3, $4, 'active', 'USER')
     RETURNING id`,
    [tenantId, firstName, lastName, email]
  );
  const employeeId = employeeResult.rows[0]?.id;

  // Generate username from tenant code and name
  const username = `${tenantCode}.${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(
    /[^a-z0-9.]/g,
    ''
  );

  // Create user (no password for SSO users)
  const userResult = await dbClient.query(
    `INSERT INTO users (username, role, permissions, is_active, employee_id, last_login)
     VALUES ($1, 'USER', ARRAY['employees:view:own', 'leave:view:own', 'leave:request'], true, $2, NOW())
     RETURNING id, username, role, permissions, employee_id`,
    [username, employeeId]
  );

  return userResult.rows[0];
}

export default router;
