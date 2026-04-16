/**
 * Look up the platform-level trust score for a given source_type.
 * Falls back to the "unknown" rule (0.10) if the source_type is not registered.
 *
 * Note: deliberately scoped to platform rules (tenant_id IS NULL) for now.
 * Tenant-specific overrides can be layered on in a follow-up slice.
 */
export declare function getTrustScoreForSourceType(sourceType: string): Promise<number>;
//# sourceMappingURL=trust-rules.d.ts.map