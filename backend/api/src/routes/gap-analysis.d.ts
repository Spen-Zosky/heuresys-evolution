/**
 * Gap Analysis API Routes
 * Epic: E-ONTO-03 (Business Applications)
 * Stories: S-ONTO-03-05 (Gap Analysis Engine), S-ONTO-03-06 (Gap Analysis Recommendations)
 *
 * Endpoints:
 * - POST /gap-analysis - Run gap analysis
 * - POST /gap-analysis/employee-role - Analyze employee vs role
 * - POST /gap-analysis/team-role - Analyze team vs role
 * - POST /gap-analysis/recommendations - Generate recommendations for a gap analysis
 * - GET /gap-analysis/cached/:analysisId - Get cached analysis (future)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=gap-analysis.d.ts.map