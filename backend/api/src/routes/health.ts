/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
// ADMIN-POOL: Health checks run without authentication or tenant context
import { pool } from '../config/database.js';
import { getRedis, isRedisReady } from '../config/redis.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET /health
 * Comprehensive health check — public (used by load balancers)
 * Checks: DB, Redis, Disk
 */
router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  let allOk = true;

  // DB check
  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    checks.db = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch {
    checks.db = { status: 'error', latencyMs: Date.now() - dbStart };
    allOk = false;
  }

  // Redis check
  const redisStart = Date.now();
  try {
    if (isRedisReady()) {
      const redis = getRedis();
      await redis.ping();
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    } else {
      checks.redis = { status: 'not_connected' };
      allOk = false;
    }
  } catch {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart };
    allOk = false;
  }

  // Disk check
  try {
    const stats = await fs.statfs('/');
    const freeGB = (Number(stats.bfree) * Number(stats.bsize)) / (1024 * 1024 * 1024);
    checks.disk = { status: freeGB > 1 ? 'ok' : 'low', latencyMs: 0 };
  } catch {
    checks.disk = { status: 'unknown' };
  }

  res.status(allOk ? 200 : 503).json({
    success: allOk,
    data: {
      status: allOk ? 'ok' : 'degraded',
      service: 'api-gateway',
      version: '1.0.0',
      checks,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /db-health
 * Database health check — requires TENANT_OWNER+ (exposes DB details)
 */
router.get(
  '/db-health',
  authMiddleware,
  requirePermission('PLATFORM', 'VIEW'),
  async (req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT 1 AS ok');
      res.json({
        success: true,
        data: {
          status: 'ok',
          db: 'connected',
          result: result.rows[0],
          timestamp: new Date().toISOString(),
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      const error = err as Error;
      logger.error({ err: error }, 'DB health check error:');
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database connection failed',
          details: { error: error.message },
          requestId: req.requestId,
        },
      });
    }
  }
);

export default router;
