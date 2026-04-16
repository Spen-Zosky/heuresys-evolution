/**
 * Heuresys Platform - API Gateway
 * Main entry point
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { securityMiddleware, additionalSecurityHeaders } from './middleware/security.js';
import { createHttpLogger, logger } from './config/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { pool, testConnection, testAppConnection, closePool } from './config/database.js';
import { swaggerSpec } from './config/swagger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { createErrorMiddleware, notFoundHandler, sentryErrorLogger, initSentry, flushSentry, } from './errors/index.js';
import { tenantContextMiddleware } from './middleware/tenantContext.js';
import { apiRateLimiter, authRateLimiter, loginRateLimiter, aiRateLimiter, exportRateLimiter, heavyComputeRateLimiter, } from './middleware/rateLimit.js';
import { authMiddleware, requireRole } from './middleware/auth.js';
import { metricsMiddleware } from './middleware/metricsCollector.js';
// Routes
import healthRoutes from './routes/health.js';
import metricsRoutes from './routes/metrics.js';
import authRoutes from './routes/auth.js';
import auth2faRoutes from './routes/auth-2fa.js';
import tenantsRoutes from './routes/tenants.js';
import usersRoutes from './routes/users.js';
import employeesRoutes from './routes/employees.js';
import locationsRoutes from './routes/locations.js';
import orgUnitsRoutes from './routes/org-units.js';
import costCentersRoutes from './routes/cost-centers.js';
import goalsRoutes from './routes/goals.js';
import performanceReviewsRoutes from './routes/performance-reviews.js';
import reviewCyclesRoutes from './routes/review-cycles.js';
import checkInsRoutes from './routes/check-ins.js';
import okrsRoutes from './routes/okrs.js';
import feedbackRoutes from './routes/feedback.js';
import coursesRoutes from './routes/courses.js';
import learningPathsRoutes from './routes/learning-paths.js';
import certificationsRoutes from './routes/certifications.js';
import adminComponentsRoutes from './routes/admin-components.js';
import enrichmentRoutes from './routes/enrichment.js';
import enrichmentConsentRoutes from './routes/enrichment-consent.js';
import enrollmentsRoutes from './routes/enrollments.js';
import requisitionsRoutes from './routes/requisitions.js';
import candidatesRoutes from './routes/candidates.js';
import interviewsRoutes from './routes/interviews.js';
import jobPostingsRoutes from './routes/job-postings.js';
import offersRoutes from './routes/offers.js';
import salaryBandsRoutes from './routes/salary-bands.js';
import bonusPlansRoutes from './routes/bonus-plans.js';
import meritCyclesRoutes from './routes/merit-cycles.js';
import benefitsRoutes from './routes/benefits.js';
import notificationsRoutes from './routes/notifications.js';
import auditLogsRoutes from './routes/audit-logs.js';
import policyViolationsRoutes from './routes/policy-violations.js';
import skillsRoutes from './routes/skills.js';
import surveysRoutes from './routes/surveys.js';
import recognitionRoutes from './routes/recognition.js';
import ragDocumentsRoutes from './routes/rag-documents.js';
import ragSessionsRoutes from './routes/rag-sessions.js';
import reportsRoutes from './routes/reports.js';
import wellbeingRoutes from './routes/wellbeing.js';
import careerPathsRoutes from './routes/career-paths.js';
import trainingRecommendationsRoutes from './routes/training-recommendations.js';
import successionRoutes from './routes/succession.js';
import dashboardRoutes from './routes/dashboard.js';
import tenantSetupRoutes from './routes/tenant-setup.js';
import ssoRoutes from './routes/sso.js';
import contractsRoutes from './routes/contracts.js';
import leaveRoutes from './routes/leave.js';
import aiChatRoutes from './routes/ai-chat.js';
import knowledgeBaseRoutes from './routes/knowledge-base.js';
import sapMigrationRoutes from './routes/sap-migration.js';
import payrollRoutes from './routes/payroll.js';
import dashboardsRoutes from './routes/dashboards.js';
import reportSubscriptionsRoutes from './routes/report-subscriptions.js';
import exportsRoutes from './routes/exports.js';
import analyticsRoutes from './routes/analytics.js';
import predictionsRoutes from './routes/predictions.js';
import hrIntelligenceRoutes from './routes/hr-intelligence.js';
import calibrationSessionsRoutes from './routes/calibration-sessions.js';
// Sprint 17 - Compliance & Quick Wins
import whistleblowingRoutes from './routes/whistleblowing.js';
import wellbeingDashboardRoutes from './routes/wellbeing-dashboard.js';
import payStubsRoutes from './routes/pay-stubs.js';
import internalMobilityRoutes from './routes/internal-mobility.js';
import mentorshipRoutes from './routes/mentorship.js';
import socialRoutes from './routes/social.js';
import skillAssessmentsRoutes from './routes/skill-assessments.js';
import orgChartsRoutes from './routes/org-charts.js';
import prototypesRoutes from './routes/prototypes.js';
import skillTaxonomyRoutes from './routes/skill-taxonomy.js';
import naceRoutes from './routes/nace.js';
import escoRoutes from './routes/esco.js';
import ontologyRoutes from './routes/ontology.js';
import ontologyRelationsRoutes from './routes/ontology-relations.js';
import semanticIntelligenceRoutes from './routes/semantic-intelligence.js';
import skillMigrationRoutes from './routes/skill-migration.js';
import onetRoutes from './routes/onet.js';
import aiProvidersRoutes from './routes/ai-providers.js';
import skillExtractionRoutes from './routes/skill-extraction.js';
import advancedSearchRoutes from './routes/advanced-search.js';
import inferenceReviewRoutes from './routes/inference-review.js';
import employeeSkillProfilesRoutes from './routes/employee-skill-profiles.js';
import rolesRoutes from './routes/roles.js';
import roleSkillRequirementsRoutes from './routes/role-skill-requirements.js';
import gapAnalysisRoutes from './routes/gap-analysis.js';
import skillVerificationsRoutes from './routes/skill-verifications.js';
import skillAnalyticsRoutes from './routes/skill-analytics.js';
import talentSkillProfilesRoutes from './routes/talent-skill-profiles.js';
import workforcePlanningRoutes from './routes/workforce-planning.js';
import performanceAnalyticsRoutes from './routes/performance-analytics.js';
import performanceSkillIntegrationRoutes from './routes/performance-skill-integration.js';
import attendanceRoutes from './routes/attendance.js';
import overtimeRoutes from './routes/overtime.js';
import timeOffRoutes from './routes/time-off.js';
import errorAnalyticsRoutes from './routes/error-analytics.js';
import engagementRoutes from './routes/engagement.js';
import careerCoachRoutes from './routes/career-coach.js';
import newsRoutes from './routes/news.js';
import employeeDocumentsRoutes from './routes/employee-documents.js';
import compensationAnalyticsRoutes from './routes/compensation-analytics.js';
import timeAnalyticsRoutes from './routes/time-analytics.js';
import aiAnalyticsRoutes from './routes/analytics-ai.js';
import workforceAnalyticsRoutes from './routes/analytics-workforce.js';
import platformRoutes from './routes/platform.js';
import configRoutes from './routes/config.js';
// Plugin Marketplace
import marketplacePluginsRoutes from './routes/marketplace-plugins.js';
import marketplaceInstallationsRoutes from './routes/marketplace-installations.js';
import marketplaceReviewsRoutes from './routes/marketplace-reviews.js';
import marketplaceDependenciesRoutes from './routes/marketplace-dependencies.js';
import marketplaceApiKeysRoutes from './routes/marketplace-api-keys.js';
import marketplaceWebhooksRoutes from './routes/marketplace-webhooks.js';
import marketplaceHooksRoutes from './routes/marketplace-hooks.js';
import marketplaceDeveloperRoutes from './routes/marketplace-developer.js';
import marketplaceRuntimeRoutes from './routes/marketplace-runtime.js';
import embeddingsRoutes from './routes/embeddings.js';
import continuousFeedbackRoutes from './routes/continuous-feedback.js';
import threeSixtyReviewsRoutes from './routes/360-reviews.js';
import analysisSessionsRoutes from './routes/analysis-sessions.js';
import orgScenariosRoutes from './routes/org-scenarios.js';
import careerIntelligenceRoutes from './routes/career-intelligence.js';
import organizationIntelligenceRoutes from './routes/organization-intelligence.js';
import tenantOnboardingRoutes from './routes/tenant-onboarding.js';
import processLayerRoutes from './routes/process-layer.js';
import benchmarkingRoutes from './routes/benchmarking.js';
import blueprintRoutes from './routes/blueprint.js';
import blueprintStandaloneRoutes from './routes/blueprint-standalone.js';
import graphNavigationRoutes from './routes/graph-navigation.js';
import importRoutes from './routes/import.js';
import exportEngineRoutes from './routes/export-engine.js';
import { apiKeyAuthMiddleware } from './middleware/apiKeyAuth.js';
import { requirePublicApiKey } from './middleware/requirePublicApiKey.js';
import { publicApiRateLimiter } from './middleware/rateLimit.js';
import publicApiRoutes from './routes/public-api.js';
import rbpRoutes from './routes/rbp.js';
import workspaceRoutes from './routes/workspace.js';
import workspaceTemplatesRoutes from './routes/workspace-templates.js';
// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// =============================================================================
// SENTRY INITIALIZATION (must happen before Express app is created)
// =============================================================================
if (process.env.SENTRY_DSN) {
    initSentry({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        enabled: true,
    });
}
else {
    initSentry(); // Logs "No DSN configured" and disables gracefully
}
const app = express();
// =============================================================================
// MIDDLEWARE
// =============================================================================
// Security - Comprehensive security headers including CSP
app.use(securityMiddleware);
app.use(additionalSecurityHeaders);
// CORS
app.use(cors(config.cors));
// Cookie parser (for httpOnly JWT cookie support)
app.use(cookieParser());
// Response compression (gzip/br) — reduces payload sizes by ~70%
app.use(compression({ threshold: 1024 }));
// Request ID (must be early in the chain)
app.use(requestIdMiddleware);
// Structured logging (pino-http)
app.use(createHttpLogger());
// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Prometheus metrics collection (before auth, after CORS/logging)
app.use(metricsMiddleware);
// Rate limiting (global API protection)
app.use('/api', apiRateLimiter);
// Static files (legacy - from old structure)
app.use(express.static(path.join(__dirname, '../public')));
// =============================================================================
// API KEY AUTHENTICATION - Check X-API-Key before JWT auth
// =============================================================================
app.use('/api/v1', apiKeyAuthMiddleware);
// =============================================================================
// GLOBAL AUTHENTICATION - All /api/v1/* routes require auth except whitelisted
// =============================================================================
const PUBLIC_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/verify',
    '/api/v1/auth/2fa/verify',
    '/api/v1/blueprint/standalone', // O3.5 — self-service blueprint (rate-limited, no auth)
];
app.use('/api/v1', (req, res, next) => {
    // SECURITY CHAIN (reviewed 2026-03-19):
    // 1. PUBLIC_PATHS whitelist: only login/refresh/verify — cannot access data endpoints
    // 2. Whistleblowing: anonymous POST to single endpoint (EU Directive 2019/1937)
    // 3. API key pre-auth: apiKeyAuthMiddleware (above) sets req.user if valid key;
    //    this check prevents double-auth, NOT a bypass — user is already authenticated
    // 4. All other routes → full JWT authMiddleware
    // Allow public auth paths without authentication
    const fullPath = req.baseUrl + req.path;
    if (PUBLIC_PATHS.some((p) => fullPath.startsWith(p))) {
        return next();
    }
    // Allow anonymous whistleblowing reports (EU Directive 2019/1937 compliance)
    if (req.method === 'POST' && req.path === '/whistleblowing/reports') {
        return next();
    }
    // Skip JWT auth if already authenticated by API key middleware (not a bypass —
    // apiKeyAuthMiddleware verified the key and set req.user with proper role/tenant)
    if (req.user) {
        return next();
    }
    // Require JWT authentication for all other /api/v1/* routes
    return authMiddleware(req, res, next);
});
// =============================================================================
// GLOBAL RBAC — Minimum role check for all authenticated /api/v1/* routes
// Ensures every request has a valid, DB-verified role (prevents JWT escalation)
// Individual routes can add stricter requireRole() checks as needed
// =============================================================================
const globalRoleCheck = requireRole('EMPLOYEE');
app.use('/api/v1', (req, res, next) => {
    // Skip RBAC for unauthenticated paths (already handled by auth middleware above)
    if (!req.user) {
        return next();
    }
    return globalRoleCheck(req, res, next);
});
// =============================================================================
// ROUTES
// =============================================================================
// Health checks (no auth required)
app.use('/', healthRoutes);
// Prometheus metrics endpoint (protected by token/IP allowlist)
app.use('/', metricsRoutes);
// OpenAPI documentation (no auth required)
app.get('/api/docs/spec.json', (_req, res) => {
    res.json(swaggerSpec);
});
app.get('/api/docs', (_req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Heuresys API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/api/docs/spec.json',dom_id:'#swagger-ui',deepLinking:true})</script>
</body></html>`);
});
// API v1 routes
app.use('/api/v1/auth/login', loginRateLimiter); // 5 req/min per IP — credential stuffing protection
app.use('/api/v1/auth/refresh', authRateLimiter); // Strict rate limiting for token refresh
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/2fa', auth2faRoutes);
app.use('/api/v1/auth/sso', ssoRoutes);
app.use('/api/v1/tenants', tenantsRoutes);
app.use('/api/v1/users', tenantContextMiddleware, usersRoutes);
app.use('/api/v1/tenant-setup', tenantContextMiddleware, tenantSetupRoutes);
app.use('/api/v1/platform', tenantContextMiddleware, platformRoutes);
app.use('/api/v1/config', configRoutes); // Dynamic config: statuses, roles, labels
app.use('/api/v1/roles', rolesRoutes); // RBAC role hierarchy (no tenant context needed)
app.use('/api/rbp', tenantContextMiddleware, rbpRoutes); // RBP Framework - tenantContext for RLS enforcement on teams/break-glass (Cat A) and sections (Cat C)
// Tenant-scoped API v1 routes (require tenant context)
app.use('/api/v1/employees', tenantContextMiddleware, employeesRoutes);
app.use('/api/v1/locations', tenantContextMiddleware, locationsRoutes);
app.use('/api/v1/org-units', tenantContextMiddleware, orgUnitsRoutes);
app.use('/api/v1/cost-centers', tenantContextMiddleware, costCentersRoutes);
app.use('/api/v1/goals', tenantContextMiddleware, goalsRoutes);
app.use('/api/v1/performance-reviews', tenantContextMiddleware, performanceReviewsRoutes);
app.use('/api/v1/review-cycles', tenantContextMiddleware, reviewCyclesRoutes);
app.use('/api/v1/check-ins', tenantContextMiddleware, checkInsRoutes);
app.use('/api/v1/okrs', tenantContextMiddleware, okrsRoutes);
app.use('/api/v1/feedback', tenantContextMiddleware, feedbackRoutes);
app.use('/api/v1/courses', tenantContextMiddleware, coursesRoutes);
app.use('/api/v1/learning-paths', tenantContextMiddleware, learningPathsRoutes);
app.use('/api/v1/certifications', tenantContextMiddleware, certificationsRoutes);
app.use('/api/v1/admin-components', tenantContextMiddleware, adminComponentsRoutes);
app.use('/api/v1/enrichment', tenantContextMiddleware, enrichmentRoutes);
app.use('/api/v1/enrichment-consent', tenantContextMiddleware, enrichmentConsentRoutes);
app.use('/api/v1/enrollments', tenantContextMiddleware, enrollmentsRoutes);
app.use('/api/v1/requisitions', tenantContextMiddleware, requisitionsRoutes);
app.use('/api/v1/candidates', tenantContextMiddleware, candidatesRoutes);
app.use('/api/v1/interviews', tenantContextMiddleware, interviewsRoutes);
app.use('/api/v1/job-postings', tenantContextMiddleware, jobPostingsRoutes);
app.use('/api/v1/offers', tenantContextMiddleware, offersRoutes);
app.use('/api/v1/salary-bands', tenantContextMiddleware, salaryBandsRoutes);
app.use('/api/v1/bonus-plans', tenantContextMiddleware, bonusPlansRoutes);
app.use('/api/v1/merit-cycles', tenantContextMiddleware, meritCyclesRoutes);
app.use('/api/v1/benefits', tenantContextMiddleware, benefitsRoutes);
app.use('/api/v1/notifications', tenantContextMiddleware, notificationsRoutes);
app.use('/api/v1/audit-logs', tenantContextMiddleware, auditLogsRoutes);
app.use('/api/v1/policy-violations', tenantContextMiddleware, policyViolationsRoutes);
app.use('/api/v1/skills', tenantContextMiddleware, skillsRoutes); // Taxonomy with tenant context for RLS
app.use('/api/v1/skills/taxonomy', tenantContextMiddleware, skillTaxonomyRoutes); // Enhanced skill taxonomy
app.use('/api/v1/nace', tenantContextMiddleware, naceRoutes); // NACE classification - global taxonomy
app.use('/api/v1/esco', tenantContextMiddleware, escoRoutes); // ESCO classification - global taxonomy
app.use('/api/v1/ontology', tenantContextMiddleware, ontologyRoutes); // Skill ontology - semantic layer
app.use('/api/v1/ontology', tenantContextMiddleware, ontologyRelationsRoutes); // Advanced ontological relations (O3.7)
app.use('/api/v1/semantic', tenantContextMiddleware, semanticIntelligenceRoutes); // Unified semantic intelligence
app.use('/api/v1/embeddings', tenantContextMiddleware, embeddingsRoutes); // Embedding generation pipeline
app.use('/api/v1/skill-migration', tenantContextMiddleware, skillMigrationRoutes); // Legacy skill migration bridge
app.use('/api/v1/onet', tenantContextMiddleware, onetRoutes); // O*NET occupational data
app.use('/api/v1/ai-providers', tenantContextMiddleware, aiProvidersRoutes); // AI provider management
app.use('/api/v1/skill-extraction', aiRateLimiter, tenantContextMiddleware, skillExtractionRoutes); // LLM skill extraction
app.use('/api/v1/advanced-search', tenantContextMiddleware, advancedSearchRoutes); // Advanced semantic search
app.use('/api/v1/inference', tenantContextMiddleware, inferenceReviewRoutes); // AI inference review workflow
app.use('/api/v1/employee-skill-profiles', tenantContextMiddleware, employeeSkillProfilesRoutes); // Employee skill profiles (KSABA)
app.use('/api/v1/role-skill-requirements', tenantContextMiddleware, roleSkillRequirementsRoutes); // Role skill requirements
app.use('/api/v1/gap-analysis', tenantContextMiddleware, gapAnalysisRoutes); // Skill gap analysis engine
app.use('/api/v1/skill-verifications', tenantContextMiddleware, skillVerificationsRoutes); // Manager skill verification
app.use('/api/v1/skill-analytics', tenantContextMiddleware, skillAnalyticsRoutes); // Skill analytics dashboard
app.use('/api/v1/talent/skill-profiles', tenantContextMiddleware, talentSkillProfilesRoutes); // Talent skill profiles list
app.use('/api/v1/workforce-planning', tenantContextMiddleware, workforcePlanningRoutes); // Workforce planning tools
app.use('/api/v1/performance-analytics', tenantContextMiddleware, performanceAnalyticsRoutes);
app.use('/api/v1/performance-skill', tenantContextMiddleware, performanceSkillIntegrationRoutes); // Performance-skill integration
app.use('/api/v1/surveys', tenantContextMiddleware, surveysRoutes);
app.use('/api/v1/recognition', tenantContextMiddleware, recognitionRoutes);
app.use('/api/v1/rag-documents', tenantContextMiddleware, ragDocumentsRoutes);
app.use('/api/v1/rag-sessions', tenantContextMiddleware, ragSessionsRoutes);
app.use('/api/v1/reports', tenantContextMiddleware, reportsRoutes);
app.use('/api/v1/wellbeing', tenantContextMiddleware, wellbeingRoutes);
app.use('/api/v1/career-paths', tenantContextMiddleware, careerPathsRoutes);
app.use('/api/v1/training-recommendations', tenantContextMiddleware, trainingRecommendationsRoutes);
app.use('/api/v1/succession', tenantContextMiddleware, successionRoutes);
app.use('/api/v1/dashboard', tenantContextMiddleware, dashboardRoutes);
app.use('/api/v1/contracts', tenantContextMiddleware, contractsRoutes);
app.use('/api/v1/leave', tenantContextMiddleware, leaveRoutes);
app.use('/api/v1/ai-chat', aiRateLimiter, tenantContextMiddleware, aiChatRoutes);
app.use('/api/v1/knowledge-base', tenantContextMiddleware, knowledgeBaseRoutes);
app.use('/api/v1/sap-migration', heavyComputeRateLimiter, tenantContextMiddleware, sapMigrationRoutes);
app.use('/api/v1/payroll', heavyComputeRateLimiter, tenantContextMiddleware, payrollRoutes);
app.use('/api/v1/dashboards', tenantContextMiddleware, dashboardsRoutes);
app.use('/api/v1/report-subscriptions', tenantContextMiddleware, reportSubscriptionsRoutes);
app.use('/api/v1/exports', exportRateLimiter, tenantContextMiddleware, exportsRoutes);
app.use('/api/v1/analytics/compensation', tenantContextMiddleware, compensationAnalyticsRoutes);
app.use('/api/v1/analytics/time', tenantContextMiddleware, timeAnalyticsRoutes);
// NOTE: performanceAnalyticsRoutes already mounted at /api/v1/performance-analytics (line above)
// Removed: duplicate mount of attendanceRoutes at /api/v1/analytics/attendance (canonical: /api/v1/attendance)
app.use('/api/v1/analytics/workforce', tenantContextMiddleware, workforceAnalyticsRoutes);
app.use('/api/v1/analytics/ai', tenantContextMiddleware, aiAnalyticsRoutes);
app.use('/api/v1/analytics', tenantContextMiddleware, analyticsRoutes);
app.use('/api/v1/predictions', heavyComputeRateLimiter, tenantContextMiddleware, predictionsRoutes);
app.use('/api/v1/hr-intelligence', tenantContextMiddleware, hrIntelligenceRoutes);
app.use('/api/v1/career', tenantContextMiddleware, careerIntelligenceRoutes);
app.use('/api/v1/organization', tenantContextMiddleware, organizationIntelligenceRoutes);
app.use('/api/v1/tenant-onboarding', tenantContextMiddleware, tenantOnboardingRoutes);
app.use('/api/v1/calibration-sessions', tenantContextMiddleware, calibrationSessionsRoutes);
// Sprint 17 - Compliance & Quick Wins
app.use('/api/v1/whistleblowing', tenantContextMiddleware, whistleblowingRoutes);
app.use('/api/v1/wellbeing-extended', tenantContextMiddleware, wellbeingDashboardRoutes);
app.use('/api/v1/pay-stubs', tenantContextMiddleware, payStubsRoutes);
app.use('/api/v1/internal-mobility', tenantContextMiddleware, internalMobilityRoutes);
app.use('/api/v1/mentorship', tenantContextMiddleware, mentorshipRoutes);
app.use('/api/v1/social', tenantContextMiddleware, socialRoutes);
app.use('/api/v1/skill-assessments', tenantContextMiddleware, skillAssessmentsRoutes);
app.use('/api/v1/org-charts', tenantContextMiddleware, orgChartsRoutes);
app.use('/api/v1/prototypes', tenantContextMiddleware, prototypesRoutes);
app.use('/api/v1/process-layer', tenantContextMiddleware, processLayerRoutes);
// Horizon O3.8 — Cross-Tenant Benchmarking
app.use('/api/v1/benchmarking', tenantContextMiddleware, benchmarkingRoutes);
// Horizon O3.5 — Blueprint Standalone (no auth, no tenant) — MUST be registered BEFORE /blueprint
app.use('/api/v1/blueprint/standalone', blueprintStandaloneRoutes);
app.use('/api/v1/blueprint', tenantContextMiddleware, blueprintRoutes);
app.use('/api/v1/graph', tenantContextMiddleware, graphNavigationRoutes);
// Horizon O2 - Import Engine
app.use('/api/v1/import', tenantContextMiddleware, importRoutes);
// Horizon O2.3 - Export Engine (PDF/Excel reports)
app.use('/api/v1/export', exportRateLimiter, tenantContextMiddleware, exportEngineRoutes);
// Sprint 2025-09 - Time & Attendance
app.use('/api/v1/attendance', tenantContextMiddleware, attendanceRoutes);
app.use('/api/v1/overtime', tenantContextMiddleware, overtimeRoutes);
app.use('/api/v1/time-off', tenantContextMiddleware, timeOffRoutes);
// Error Analytics (platform-level - no tenant context required)
app.use('/api/v1/error-analytics', errorAnalyticsRoutes);
// Employee Engagement Hub (Sprint 2025-12)
app.use('/api/v1/engagement', tenantContextMiddleware, engagementRoutes);
// AI Career Coach (Sprint 2025-12)
app.use('/api/v1/career-coach', tenantContextMiddleware, careerCoachRoutes);
// Company News Portal (Sprint 2025-12)
app.use('/api/v1/news', tenantContextMiddleware, newsRoutes);
// Employee Documents (Sprint 2025-12)
app.use('/api/v1/employee-documents', tenantContextMiddleware, employeeDocumentsRoutes);
// Company PET - Analysis Sessions & Org Scenarios
app.use('/api/v1/analysis-sessions', tenantContextMiddleware, analysisSessionsRoutes);
app.use('/api/v1/org-scenarios', tenantContextMiddleware, orgScenariosRoutes);
// Stub endpoints (planned features)
app.use('/api/v1/continuous-feedback', tenantContextMiddleware, continuousFeedbackRoutes);
app.use('/api/v1/360-reviews', tenantContextMiddleware, threeSixtyReviewsRoutes);
// Plugin Marketplace
app.use('/api/v1/marketplace/plugins', tenantContextMiddleware, marketplacePluginsRoutes); // Plugin catalog with tenant context
app.use('/api/v1/marketplace/installations', tenantContextMiddleware, marketplaceInstallationsRoutes);
app.use('/api/v1/marketplace/reviews', tenantContextMiddleware, marketplaceReviewsRoutes);
app.use('/api/v1/marketplace/dependencies', marketplaceDependenciesRoutes); // Platform-level dependency management
app.use('/api/v1/marketplace/api-keys', tenantContextMiddleware, marketplaceApiKeysRoutes);
app.use('/api/v1/marketplace/webhooks', tenantContextMiddleware, marketplaceWebhooksRoutes);
app.use('/api/v1/marketplace/hooks', tenantContextMiddleware, marketplaceHooksRoutes); // Platform-level hooks & UI slots (tenant context needed for executions)
app.use('/api/v1/marketplace/developer', tenantContextMiddleware, marketplaceDeveloperRoutes);
app.use('/api/v1/marketplace/runtime', tenantContextMiddleware, marketplaceRuntimeRoutes);
// Workspace Template Designer (P3-14) — admin CRUD for role-default templates
// Must be registered BEFORE /workspace to avoid prefix collision
app.use('/api/v1/workspace/templates', tenantContextMiddleware, workspaceTemplatesRoutes);
// Personal workspace (scrivania) — auth handled inside route
app.use('/api/v1/workspace', tenantContextMiddleware, workspaceRoutes);
// Legacy routes (backwards compatibility) — auth required
app.use('/tenants', authMiddleware, tenantsRoutes);
// API tenants listing (for inspector) - requires authentication
app.get('/api/tenants', authMiddleware, async (_req, res) => {
    try {
        const result = await pool.query('SELECT id, code, name FROM tenants ORDER BY name');
        res.json(result.rows);
    }
    catch (err) {
        const error = err;
        res.status(500).json({ error: error.message });
    }
});
// =============================================================================
// HORIZON O2.4 — PUBLIC REST API v1 (read-only, API key auth, outside JWT chain)
// =============================================================================
app.use('/api/public/v1', requirePublicApiKey, publicApiRateLimiter, publicApiRoutes);
// =============================================================================
// ERROR HANDLING
// =============================================================================
// 404 handler
app.use(notFoundHandler);
// Global error handler with Sentry integration (must be last)
app.use(createErrorMiddleware({
    environment: config.nodeEnv,
    enableConsoleLogging: true,
    includeStackTrace: config.nodeEnv !== 'production',
    externalLogger: sentryErrorLogger,
}));
// =============================================================================
// SERVER STARTUP
// =============================================================================
async function startServer() {
    // Test admin database connection (superuser)
    const dbConnected = await testConnection();
    if (!dbConnected) {
        logger.error('Failed to connect to database (admin pool). Exiting...');
        process.exit(1);
    }
    logger.info('[DB:admin] Database connection established');
    // Test application database connection (RLS-enforced)
    const appDbConnected = await testAppConnection();
    if (!appDbConnected) {
        logger.warn('[DB:app] Application pool connection failed - RLS-enforced queries will not work');
        logger.warn('[DB:app] Ensure heuresys_app role exists (run migration 084_configure_app_role.sql)');
        // Do not exit - admin pool still works for backward compatibility
    }
    else {
        logger.info('[DB:app] Application pool connected (RLS enforced)');
    }
    // Start embedding queue processor (background, non-blocking)
    try {
        const { createEmbeddingQueueProcessor } = await import('./services/embedding-queue-processor.js');
        const processor = createEmbeddingQueueProcessor(pool);
        processor.startBackgroundProcessing(60000, 25); // 60s interval, 25 batch
        logger.info('[Embeddings] Queue processor started (60s interval)');
    }
    catch (err) {
        logger.warn({ err: err }, '[Embeddings] Queue processor not started: %s', err.message);
    }
    // Initialize RBP Cache (data-driven permissions)
    try {
        const { rbpCache } = await import('./services/rbp-cache.js');
        await rbpCache.refresh();
        const stats = rbpCache.getStats();
        logger.info(`[RBP] Cache initialized: ${stats.roles} roles, ${stats.areas} areas, ${stats.permissions} permissions`);
    }
    catch (err) {
        logger.error({ err: err }, '[RBP] Cache init failed — will retry on first access');
    }
    // Start server
    app.listen(config.port, () => {
        logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║          HEURESYS PLATFORM - API GATEWAY                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:      RUNNING                                         ║
║  Port:        ${String(config.port).padEnd(47)}║
║  Environment: ${config.nodeEnv.padEnd(47)}║
║  Health:      http://localhost:${config.port}/health${' '.repeat(24)}║
║  DB Health:   http://localhost:${config.port}/db-health${' '.repeat(21)}║
╚═══════════════════════════════════════════════════════════════╝
    `);
    });
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    await flushSentry(2000);
    await closePool();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    await flushSentry(2000);
    await closePool();
    process.exit(0);
});
// Start the server
startServer().catch((err) => {
    logger.error({ err: err }, 'Failed to start server:');
    process.exit(1);
});
export default app;
//# sourceMappingURL=index.js.map