/**
 * API Key Authentication Middleware
 * Checks X-API-Key header for plugin API key authentication.
 * If present, validates the key and sets user context.
 * If absent, passes through to JWT auth.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import type { AuthenticatedRequest } from './auth.js';
import { Errors } from '../errors/factory.js';
import type { Role } from './auth.js';
import { logger } from '../config/logger.js';

/**
 * Hash an API key using SHA-256
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key with prefix 'heu_'
 * Returns { raw, hash, prefix }
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const raw = `heu_${randomPart}`;
  const hash = hashApiKey(raw);
  const prefix = raw.substring(0, 8);
  return { raw, hash, prefix };
}

/**
 * API Key authentication middleware.
 * If X-API-Key header is present, validates and sets user context.
 * If not present, calls next() to allow JWT auth to handle it.
 */
export async function apiKeyAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      return next();
    }

    const keyHash = hashApiKey(apiKey);

    const result = await pool.query(
      `
      SELECT
        ak.id as key_id, ak.tenant_id, ak.scopes, ak.expires_at,
        ak.plugin_installation_id,
        u.id as user_id, u.username, u.role,
        COALESCE(u.permissions, '{}') as permissions
      FROM plugin_api_keys ak
      LEFT JOIN plugin_installations pi ON pi.id = ak.plugin_installation_id
      JOIN users u ON ak.created_by = u.id
      WHERE ak.key_hash = $1
        AND ak.is_active = true
        AND ak.revoked_at IS NULL
    `,
      [keyHash]
    );

    if (result.rows.length === 0) {
      // API key header present but key invalid/unknown → reject (not pass-through)
      return next(Errors.unauthorized('Invalid API key'));
    }

    const row = result.rows[0];

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return next(Errors.unauthorized('API key has expired'));
    }

    // Set user context compatible with AuthenticatedRequest
    (req as AuthenticatedRequest).user = {
      userId: row.user_id,
      username: row.username,
      role: row.role as Role,
      permissions: row.permissions,
      tenantId: row.tenant_id,
    };

    // Set tenant context
    req.tenantId = row.tenant_id;

    // Update last_used_at (fire-and-forget)
    pool
      .query('UPDATE plugin_api_keys SET last_used_at = NOW() WHERE id = $1', [row.key_id])
      .catch(() => {
        /* ignore */
      });

    next();
  } catch (error) {
    // API key was present but we couldn't validate it → fail-closed
    logger.error(`[ApiKeyAuth] Validation error: ${String((error as Error).message)}`);
    next(Errors.internal('API key validation failed'));
  }
}
