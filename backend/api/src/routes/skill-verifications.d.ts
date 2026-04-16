/**
 * Manager Skill Verification API Routes
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-03 (Manager Skill Verification)
 *
 * Endpoints:
 * - GET /skill-verifications/team/:managerId - List pending verifications for team
 * - GET /skill-verifications/pending - List all pending verifications (tenant-wide)
 * - POST /skill-verifications/:profileId/approve - Approve skill declaration
 * - POST /skill-verifications/:profileId/reject - Reject skill declaration
 * - POST /skill-verifications/:profileId/override - Override skill levels
 * - GET /skill-verifications/audit/:profileId - Get verification audit trail
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=skill-verifications.d.ts.map