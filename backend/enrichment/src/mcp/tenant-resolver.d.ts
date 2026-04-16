/**
 * Resolve a tenant by either its code (e.g. "rtl-bank") or UUID.
 * Throws if no match.
 */
export declare function resolveTenant(codeOrId: string): Promise<{
    id: string;
    code: string;
    name: string;
}>;
//# sourceMappingURL=tenant-resolver.d.ts.map