/**
 * Enrichment Consent Routes — P3-17 GDPR Consent
 *
 * Employee-facing endpoints for managing enrichment consent.
 * All endpoints operate on the authenticated user's own employee record.
 *
 * - GET  /api/v1/enrichment-consent/me          → current consent status
 * - POST /api/v1/enrichment-consent/me/grant     → grant consent (body: { scopes: string[] })
 * - POST /api/v1/enrichment-consent/me/revoke    → revoke consent + GDPR data erasure
 */
import { Router } from 'express';
declare const router: Router;
export default router;
//# sourceMappingURL=enrichment-consent.d.ts.map