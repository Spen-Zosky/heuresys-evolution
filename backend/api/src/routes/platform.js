/**
 * Platform Routes
 * System-wide platform metrics, health checks, and alerts
 * These endpoints are for TENANT_OWNER users only
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { platformAlertsQuerySchema } from '../schemas/time-policy.js';
import { asyncHandler } from '../errors/middleware.js';
// ADMIN-POOL: Platform metrics are SUPERUSER-only cross-tenant aggregations
import { pool } from '../config/database.js';
import { cached, CACHE_TTL } from '../services/cache.js';
import { safeParseInt, firstRowOrNull } from '../utils/query-helpers.js';
import { logger } from '../config/logger.js';
const router = Router();
// All platform endpoints require SUPERUSER role
router.use(requirePermission('PLATFORM', 'VIEW'));
/**
 * GET /platform/metrics
 * Get platform-wide metrics (tenant counts, user counts, etc.)
 */
router.get('/metrics', asyncHandler(async (_req, res) => {
    // SUPERUSER cross-tenant endpoint — always use pool, never tenant-scoped dbClient
    const dbClient = pool;
    const data = await cached('platform:metrics', async () => {
        const [tenantStats, userStats, employeeStats, tenantBreakdown, dbSize, connections, apiActivity,] = await Promise.all([
            dbClient.query(`SELECT COUNT(*) as total_tenants, COUNT(*) FILTER (WHERE status = 'active') as active_tenants FROM tenants`),
            dbClient.query(`SELECT COUNT(*) as total_users FROM users`),
            dbClient.query(`SELECT COUNT(*) as total_employees FROM employees`),
            dbClient.query(`SELECT t.id, t.name, t.code, t.status, (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = t.id) as employee_count, (SELECT COUNT(*) FROM users u JOIN employees e2 ON u.employee_id = e2.id WHERE e2.tenant_id = t.id) as user_count FROM tenants t ORDER BY t.name`),
            dbClient.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as database_size`),
            dbClient.query(`SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE datname = current_database()`),
            dbClient.query(`SELECT COUNT(*) as requests_24h FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours'`),
        ]);
        return {
            totalTenants: safeParseInt(tenantStats.rows[0]?.total_tenants, { fallback: 0 }),
            activeTenants: safeParseInt(tenantStats.rows[0]?.active_tenants, { fallback: 0 }),
            totalUsers: safeParseInt(userStats.rows[0]?.total_users, { fallback: 0 }),
            totalEmployees: safeParseInt(employeeStats.rows[0]?.total_employees, { fallback: 0 }),
            apiRequests24h: safeParseInt(apiActivity.rows[0]?.requests_24h, { fallback: 0 }),
            storageUsed: dbSize.rows[0]?.database_size || 'N/A',
            activeConnections: safeParseInt(connections.rows[0]?.active_connections, { fallback: 0 }),
            tenants: tenantBreakdown.rows.map((t) => ({
                id: t.id,
                name: t.name,
                code: t.code,
                status: t.status,
                employeeCount: parseInt(t.employee_count || '0'),
                userCount: parseInt(t.user_count || '0'),
            })),
        };
    }, CACHE_TTL.SHORT);
    res.json({ success: true, data });
}));
/**
 * GET /platform/health
 * Get system health status
 */
router.get('/health', asyncHandler(async (_req, res) => {
    const health = {
        database: { status: 'unknown' },
        api: { status: 'healthy' },
        cache: { status: 'healthy' }, // No dedicated cache yet
        storage: { status: 'healthy' }, // Using DB storage
    };
    // SUPERUSER cross-tenant endpoint — always use pool
    const dbClient = pool;
    // Test database connectivity with timing
    try {
        const dbStart = Date.now();
        await dbClient.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;
        health.database = {
            status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'down',
            latency: dbLatency,
            message: `Latency: ${dbLatency}ms`,
        };
        // Get PostgreSQL stats
        const pgStats = await dbClient.query(`
        SELECT
          (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) as connections,
          (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
      `);
        const connections = safeParseInt(pgStats.rows[0]?.connections, { fallback: 0 });
        const maxConnections = safeParseInt(pgStats.rows[0]?.max_connections, { fallback: 100 });
        const connectionRatio = connections / maxConnections;
        if (connectionRatio > 0.9) {
            health.database.status = 'degraded';
            health.database.message = `High connection usage: ${connections}/${maxConnections}`;
        }
    }
    catch {
        health.database = {
            status: 'down',
            message: 'Database unreachable',
        };
    }
    // Calculate overall status
    const allHealthy = Object.values(health).every((h) => h.status === 'healthy');
    const anyDown = Object.values(health).some((h) => h.status === 'down');
    res.json({
        success: true,
        data: {
            overall: anyDown ? 'down' : allHealthy ? 'healthy' : 'degraded',
            services: health,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            memoryUsage: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                external: Math.round(process.memoryUsage().external / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            },
        },
    });
}));
/**
 * GET /platform/alerts
 * Get recent system alerts (from audit logs with failures or security events)
 */
router.get('/alerts', validate(platformAlertsQuerySchema, 'query'), asyncHandler(async (req, res) => {
    // SUPERUSER cross-tenant endpoint — always use pool
    const dbClient = pool;
    const limit = req.query.limit;
    // Get recent failed operations and security events
    const alerts = await dbClient.query(`
      SELECT
        id,
        timestamp,
        action,
        category,
        resource_type,
        description,
        success,
        error_message,
        tenant_id,
        (SELECT code FROM tenants WHERE id = audit_logs.tenant_id) as tenant_code,
        CASE
          WHEN success = false THEN 'error'
          WHEN category = 'security' THEN 'warning'
          WHEN category = 'auth' AND action = 'login_failed' THEN 'warning'
          ELSE 'info'
        END as alert_type
      FROM audit_logs
      WHERE
        (success = false)
        OR (category = 'security')
        OR (action IN ('login_failed', 'password_reset', 'role_change'))
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);
    res.json({
        success: true,
        data: alerts.rows.map((a) => ({
            id: a.id,
            type: a.alert_type,
            message: a.error_message || a.description,
            category: a.category,
            action: a.action,
            resourceType: a.resource_type,
            tenantCode: a.tenant_code,
            timestamp: a.timestamp,
            success: a.success,
        })),
    });
}));
/**
 * GET /platform/operational-alerts
 * Get active operational alerts based on real system conditions
 * Unlike /alerts (audit-log events), this returns proactive health warnings
 */
router.get('/operational-alerts', asyncHandler(async (_req, res) => {
    const dbClient = pool;
    const alerts = [];
    // 1. SMTP not configured — check environment variable
    const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || '';
    if (!smtpHost) {
        alerts.push({
            type: 'warning',
            code: 'SMTP_NOT_CONFIGURED',
            message: 'SMTP non configurato — notifiche email, reset password e onboarding disabilitati',
        });
    }
    // 2. DB connections > 80% of max_connections
    try {
        const connResult = await dbClient.query(`
        SELECT
          (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database())::int as active,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn
      `);
        const active = connResult.rows[0]?.active || 0;
        const maxConn = connResult.rows[0]?.max_conn || 100;
        if (active / maxConn > 0.8) {
            alerts.push({
                type: 'critical',
                code: 'HIGH_DB_CONNECTIONS',
                message: `Connessioni DB al ${Math.round((active / maxConn) * 100)}% (${active}/${maxConn}) — rischio esaurimento`,
            });
        }
    }
    catch {
        alerts.push({
            type: 'critical',
            code: 'DB_HEALTH_CHECK_FAILED',
            message: 'Impossibile verificare lo stato delle connessioni database',
        });
    }
    // 3. Error rate > 5% in the last hour
    try {
        const errorResult = await dbClient.query(`
        SELECT
          COUNT(*) FILTER (WHERE success = false)::int as errors,
          COUNT(*)::int as total
        FROM audit_logs
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
      `);
        const errors = errorResult.rows[0]?.errors || 0;
        const total = errorResult.rows[0]?.total || 0;
        if (total > 0 && errors / total > 0.05) {
            const errorPct = Math.round((errors / total) * 100);
            alerts.push({
                type: 'critical',
                code: 'HIGH_ERROR_RATE',
                message: `Error rate ${errorPct}% nell'ultima ora (${errors} errori su ${total} richieste)`,
            });
        }
    }
    catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in routes.platform');
    }
    res.json({
        success: true,
        data: { alerts },
    });
}));
/**
 * GET /platform/stats/summary
 * Get a quick summary for dashboard cards
 */
router.get('/stats/summary', asyncHandler(async (_req, res) => {
    // SUPERUSER cross-tenant endpoint — always use pool
    const dbClient = pool;
    const summary = await dbClient.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants) as total_tenants,
        (SELECT COUNT(*) FROM tenants WHERE status = 'active') as active_tenants,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM employees) as total_employees,
        (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours') as api_requests_24h,
        (SELECT COUNT(*) FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours' AND success = false) as failed_requests_24h
    `);
    const row = firstRowOrNull(summary) || {};
    res.json({
        success: true,
        data: {
            totalTenants: safeParseInt(row.total_tenants, { fallback: 0 }),
            activeTenants: safeParseInt(row.active_tenants, { fallback: 0 }),
            totalUsers: safeParseInt(row.total_users, { fallback: 0 }),
            totalEmployees: safeParseInt(row.total_employees, { fallback: 0 }),
            apiRequests24h: safeParseInt(row.api_requests_24h, { fallback: 0 }),
            failedRequests24h: safeParseInt(row.failed_requests_24h, { fallback: 0 }),
        },
    });
}));
/**
 * GET /platform/health-status
 * Real-time system health metrics for dashboard monitoring
 */
router.get('/health-status', asyncHandler(async (_req, res) => {
    const dbClient = pool;
    const [connResult, errorResult] = await Promise.all([
        // Active DB connections vs max
        dbClient.query(`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int as active,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
      `),
        // Error rate: count of failed audit logs in last hour vs total
        dbClient.query(`
        SELECT
          COUNT(*) FILTER (WHERE success = false AND timestamp > NOW() - INTERVAL '1 hour')::int as errors_1h,
          COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour')::int as total_1h
        FROM audit_logs
      `),
    ]);
    const conn = firstRowOrNull(connResult) || { active: 0, max: 100 };
    const errStats = firstRowOrNull(errorResult) || { errors_1h: 0, total_1h: 0 };
    const mem = process.memoryUsage();
    res.json({
        success: true,
        data: {
            api_latency_ms: null, // placeholder — implementabile con middleware
            error_rate_1h: errStats.total_1h > 0 ? Math.round((errStats.errors_1h / errStats.total_1h) * 100) : 0,
            errors_1h: errStats.errors_1h,
            total_requests_1h: errStats.total_1h,
            db_connections: conn.active,
            db_connections_max: conn.max,
            memory_used_mb: Math.round(mem.rss / 1024 / 1024),
            node_uptime_seconds: Math.floor(process.uptime()),
        },
    });
}));
/**
 * GET /platform/backup-status
 * Real backup status from the filesystem (pg_dump on cron)
 */
router.get('/backup-status', asyncHandler(async (_req, res) => {
    const backupDir = path.resolve(process.cwd(), '../../backups');
    const dailyDir = path.join(backupDir, 'daily');
    let lastBackupAt = null;
    let lastBackupSizeMb = null;
    let lastBackupStatus = 'UNKNOWN';
    const frequency = 'Ogni giorno alle 02:00';
    const retentionDays = 7;
    let dailyCount = 0;
    let weeklyCount = 0;
    let monthlyCount = 0;
    try {
        // Read daily backup directory
        if (fs.existsSync(dailyDir)) {
            const files = fs
                .readdirSync(dailyDir)
                .filter((f) => f.endsWith('.sql.gz'))
                .sort()
                .reverse();
            dailyCount = files.length;
            if (files.length > 0) {
                const latestFile = path.join(dailyDir, files[0]);
                const stat = fs.statSync(latestFile);
                lastBackupAt = stat.mtime.toISOString();
                lastBackupSizeMb = Math.round((stat.size / (1024 * 1024)) * 10) / 10;
                lastBackupStatus = 'OK';
            }
        }
        // Count weekly/monthly
        const weeklyDir = path.join(backupDir, 'weekly');
        const monthlyDir = path.join(backupDir, 'monthly');
        if (fs.existsSync(weeklyDir)) {
            weeklyCount = fs.readdirSync(weeklyDir).filter((f) => f.endsWith('.sql.gz')).length;
        }
        if (fs.existsSync(monthlyDir)) {
            monthlyCount = fs
                .readdirSync(monthlyDir)
                .filter((f) => f.endsWith('.sql.gz')).length;
        }
        // Check if backup is stale (>25 hours)
        if (lastBackupAt) {
            const hoursSince = (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60);
            if (hoursSince > 25) {
                lastBackupStatus = 'FAILED';
            }
        }
    }
    catch {
        lastBackupStatus = 'UNKNOWN';
    }
    res.json({
        success: true,
        data: {
            last_backup_at: lastBackupAt,
            last_backup_size_mb: lastBackupSizeMb,
            last_backup_status: lastBackupStatus,
            frequency,
            retention_days: retentionDays,
            counts: {
                daily: dailyCount,
                weekly: weeklyCount,
                monthly: monthlyCount,
            },
        },
    });
}));
/**
 * GET /platform/pages
 * List all platform pages grouped by section (from platform_pages table)
 */
router.get('/pages', asyncHandler(async (_req, res) => {
    // Fetch pages with relations from page_table_relations (if populated)
    const result = await pool.query(`
      SELECT pp.id as page_id, pp.section_key,
             pp.section_title, pp.section_title_it, pp.section_title_en,
             pp.section_desc, pp.section_desc_it, pp.section_desc_en,
             pp.section_color,
             pp.section_icon, pp.section_order,
             pp.path, pp.name, pp.description, pp.name_it, pp.name_en, pp.description_it, pp.description_en,
             pp.tags,
             pp.status, pp.redirect_to, pp.page_order, pp.is_visible,
             COALESCE(
               json_agg(
                 json_build_object(
                   'table_name', ptr.table_name,
                   'relation_type', ptr.relation_type,
                   'source', ptr.source,
                   'confidence', ptr.confidence
                 )
               ) FILTER (WHERE ptr.id IS NOT NULL),
               '[]'::json
             ) as relations
      FROM platform_pages pp
      LEFT JOIN page_table_relations ptr ON ptr.page_id = pp.id
      WHERE pp.is_visible = true
      GROUP BY pp.id, pp.section_key,
               pp.section_title, pp.section_title_it, pp.section_title_en,
               pp.section_desc, pp.section_desc_it, pp.section_desc_en,
               pp.section_color,
               pp.section_icon, pp.section_order,
               pp.path, pp.name, pp.description, pp.name_it, pp.name_en, pp.description_it, pp.description_en,
               pp.tags,
               pp.status, pp.redirect_to, pp.page_order, pp.is_visible
      ORDER BY pp.section_order, pp.page_order
    `);
    // Group by section
    const sectionMap = new Map();
    for (const row of result.rows) {
        if (!sectionMap.has(row.section_key)) {
            sectionMap.set(row.section_key, {
                key: row.section_key,
                title: row.section_title,
                titleIt: row.section_title_it ?? null,
                titleEn: row.section_title_en ?? null,
                desc: row.section_desc,
                descIt: row.section_desc_it ?? null,
                descEn: row.section_desc_en ?? null,
                color: row.section_color,
                icon: row.section_icon,
                order: row.section_order,
                pages: [],
            });
        }
        sectionMap.get(row.section_key).pages.push({
            path: row.path,
            name: row.name,
            nameIt: row.name_it ?? null,
            nameEn: row.name_en ?? null,
            desc: row.description || '',
            descIt: row.description_it ?? null,
            descEn: row.description_en ?? null,
            tags: row.tags || [],
            relations: row.relations || [],
            status: row.status,
            redirectTo: row.redirect_to,
        });
    }
    const sections = Array.from(sectionMap.values()).sort((a, b) => a.order - b.order);
    res.json({
        success: true,
        data: sections,
        total: result.rowCount,
    });
}));
/**
 * GET /platform/tables
 * List all business tables (excludes SAP legacy tables)
 */
router.get('/tables', asyncHandler(async (_req, res) => {
    const result = await pool.query(`
      SELECT t.tablename as name,
             COALESCE(
               NULLIF(s.n_live_tup, 0),
               CASE WHEN c.reltuples >= 0 AND c.reltuples < 1e9
                    THEN c.reltuples::bigint
                    ELSE 0
               END
             ) as row_count
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename AND s.schemaname = 'public'
      WHERE t.schemaname = 'public'
        AND t.tablename NOT LIKE 'pa%'
        AND t.tablename NOT LIKE 'pb%'
        AND t.tablename NOT LIKE 'hrp%'
        AND t.tablename NOT LIKE 'pcl%'
        AND t.tablename NOT LIKE 'ext_%'
        AND t.tablename NOT LIKE 't5%'
        AND t.tablename NOT LIKE 'schema_%'
      ORDER BY t.tablename
    `);
    res.json({
        success: true,
        data: result.rows,
        total: result.rowCount,
    });
}));
/**
 * GET /platform/security
 * Security metrics: failed logins, active sessions, RLS tables, last security event
 */
router.get('/security', asyncHandler(async (_req, res) => {
    const [failedLogins, activeSessions, rlsTables, lastSecurityEvent] = await Promise.all([
        pool.query(`SELECT COUNT(*) as failed_logins FROM audit_logs
         WHERE timestamp >= NOW() - INTERVAL '24 hours'
           AND (action = 'login_failed' OR (category = 'auth' AND success = false))`),
        pool.query(`SELECT COUNT(*) as active_sessions FROM pg_stat_activity
         WHERE datname = current_database() AND state = 'active'`),
        pool.query(`SELECT COUNT(DISTINCT tablename) as rls_tables
         FROM pg_policies
         WHERE schemaname = 'public'`),
        pool.query(`SELECT timestamp as last_event FROM audit_logs
         WHERE category = 'security' OR action = 'login_failed'
         ORDER BY timestamp DESC LIMIT 1`),
    ]);
    res.json({
        success: true,
        data: {
            failedLogins24h: safeParseInt(failedLogins.rows[0]?.failed_logins, { fallback: 0 }),
            activeSessions: safeParseInt(activeSessions.rows[0]?.active_sessions, { fallback: 0 }),
            rlsProtectedTables: safeParseInt(rlsTables.rows[0]?.rls_tables, { fallback: 0 }),
            lastSecurityEvent: lastSecurityEvent.rows[0]?.last_event || null,
        },
    });
}));
/**
 * GET /platform/dashboard
 * Comprehensive SUPERUSER dashboard — platform structural overview
 * Supports optional tenant filter via X-Tenant-Code header or ?tenant_code= query param
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const dbClient = pool;
    // Use tenant from middleware (set when SUPERUSER selects a specific tenant)
    // null when "Tutti i Tenant" is selected (req.allTenants = true)
    const tenantFilter = req.tenantId || null;
    const cacheKey = tenantFilter ? `platform:dashboard:${tenantFilter}` : 'platform:dashboard:all';
    const data = await cached(cacheKey, async () => {
        // $1 = tenantFilter (uuid or null for all)
        const tf = tenantFilter; // null = all tenants
        const TF = '($1::uuid IS NULL OR tenant_id = $1)';
        const [tenantComparison, usersByRole, structuralCounts, catalogStats, performanceStats, dbHealth, dataCoverage,] = await Promise.all([
            // Tenant comparison
            dbClient.query(`
            SELECT t.id, t.name, t.code, t.status,
              (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = t.id)::int as employees,
              (SELECT COUNT(*) FROM org_units d WHERE d.tenant_id = t.id)::int as departments,
              (SELECT COUNT(*) FROM org_units o WHERE o.tenant_id = t.id)::int as org_units,
              (SELECT COUNT(*) FROM cost_centers cc WHERE cc.tenant_id = t.id)::int as cost_centers,
              (SELECT COUNT(*) FROM locations l WHERE l.tenant_id = t.id)::int as locations,
              (SELECT COUNT(*) FROM goals g WHERE g.tenant_id = t.id)::int as goals,
              (SELECT COUNT(*) FROM courses c WHERE c.tenant_id = t.id)::int as courses,
              (SELECT COUNT(DISTINCT u.id) FROM users u JOIN employees e2 ON u.employee_id = e2.id WHERE e2.tenant_id = t.id)::int as users
            FROM tenants t
            WHERE ($1::uuid IS NULL OR t.id = $1)
            ORDER BY t.name
          `, [tf]),
            // Users by role (filtered via employee join when tenant selected)
            dbClient.query(tf
                ? `SELECT u.role, COUNT(*)::int as count
               FROM users u JOIN employees e ON u.employee_id = e.id
               WHERE e.tenant_id = $1
               GROUP BY u.role ORDER BY count DESC`
                : `SELECT role, COUNT(*)::int as count FROM users GROUP BY role ORDER BY count DESC`, tf ? [tf] : []),
            // Structural entity totals
            dbClient.query(`
            SELECT
              (SELECT COUNT(*) FROM employees WHERE ${TF})::int as total_employees,
              (SELECT COUNT(*) FROM org_units WHERE ${TF})::int as total_org_units,
              (SELECT COUNT(*) FROM org_units WHERE ${TF})::int as total_org_units,
              (SELECT COUNT(*) FROM cost_centers WHERE ${TF})::int as total_cost_centers,
              (SELECT COUNT(*) FROM locations WHERE ${TF})::int as total_locations,
              (SELECT COUNT(*) FROM tenants WHERE ($1::uuid IS NULL OR id = $1))::int as total_tenants,
              (SELECT COUNT(DISTINCT u.id) FROM users u ${tf ? 'JOIN employees e ON u.employee_id = e.id WHERE e.tenant_id = $1' : ''})::int as total_users
          `, [tf]),
            // Catalog stats
            dbClient.query(`
            SELECT
              (SELECT COUNT(*) FROM courses WHERE ${TF})::int as total_courses,
              (SELECT COUNT(*) FROM course_enrollments ce ${tf ? 'JOIN courses c ON ce.course_id = c.id WHERE c.tenant_id = $1' : ''})::int as total_enrollments,
              (SELECT COUNT(*) FROM course_enrollments ce ${tf ? "JOIN courses c ON ce.course_id = c.id WHERE c.tenant_id = $1 AND ce.status = 'completed'" : "WHERE ce.status = 'completed'"})::int as completed_enrollments,
              (SELECT COUNT(*) FROM learning_paths WHERE ${TF})::int as total_learning_paths,
              (SELECT COUNT(*) FROM certifications WHERE ${TF})::int as total_certifications,
              (SELECT COUNT(*) FROM employee_skills es ${tf ? 'JOIN employees e ON es.employee_id = e.id WHERE e.tenant_id = $1' : ''})::int as total_employee_skills,
              (SELECT COUNT(*) FROM esco_skills)::int as esco_skills,
              (SELECT COUNT(*) FROM onet_skills)::int as onet_skills
          `, [tf]),
            // Performance & goals aggregate
            dbClient.query(`
            SELECT
              (SELECT COUNT(*) FROM goals WHERE ${TF})::int as total_goals,
              (SELECT COUNT(*) FROM goals WHERE ${TF} AND status = 'completed')::int as completed_goals,
              (SELECT COUNT(*) FROM goals WHERE ${TF} AND status = 'in_progress')::int as in_progress_goals,
              (SELECT COUNT(*) FROM performance_reviews WHERE ${TF})::int as total_reviews,
              (SELECT COUNT(*) FROM performance_reviews WHERE ${TF} AND status = 'completed')::int as completed_reviews,
              (SELECT COUNT(*) FROM check_ins WHERE ${TF})::int as total_checkins
          `, [tf]),
            // Database health (always global — not tenant-filtered)
            dbClient.query(`
            SELECT
              pg_size_pretty(pg_database_size(current_database())) as db_size,
              (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')::int as total_tables,
              (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public')::int as total_views,
              (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database())::int as active_connections,
              (SELECT COUNT(*) FROM pg_extension)::int as extensions,
              (SELECT COUNT(*) FROM pg_policies)::int as rls_policies,
              (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public')::int as total_functions,
              (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public')::int as total_triggers,
              version() as pg_version,
              EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int as db_uptime_seconds
          `),
            // Data coverage per tenant
            dbClient.query(`
            SELECT t.code as tenant,
              (SELECT COUNT(*) FROM employee_contracts ec JOIN employees e ON ec.employee_id = e.id WHERE e.tenant_id = t.id)::int as contracts,
              (SELECT COUNT(*) FROM employee_documents ed JOIN employees e ON ed.employee_id = e.id WHERE e.tenant_id = t.id)::int as documents,
              (SELECT COUNT(*) FROM performance_reviews pr WHERE pr.tenant_id = t.id)::int as reviews,
              (SELECT COUNT(*) FROM check_ins ci WHERE ci.tenant_id = t.id)::int as checkins,
              (SELECT COUNT(*) FROM course_enrollments ce JOIN courses c ON ce.course_id = c.id WHERE c.tenant_id = t.id)::int as enrollments,
              (SELECT COUNT(*) FROM employee_skills es JOIN employees e ON es.employee_id = e.id WHERE e.tenant_id = t.id)::int as skills
            FROM tenants t
            WHERE ($1::uuid IS NULL OR t.id = $1)
            ORDER BY t.name
          `, [tf]),
        ]);
        return {
            tenants: tenantComparison.rows,
            usersByRole: usersByRole.rows,
            structure: structuralCounts.rows[0],
            catalogs: catalogStats.rows[0],
            performance: performanceStats.rows[0],
            database: dbHealth.rows[0],
            dataCoverage: dataCoverage.rows,
            filteredTenant: req.tenantCode || null,
        };
    }, CACHE_TTL.SHORT);
    res.json({ success: true, data });
}));
export default router;
//# sourceMappingURL=platform.js.map