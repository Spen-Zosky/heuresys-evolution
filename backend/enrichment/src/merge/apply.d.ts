export interface ApplyCandidateSummary {
    candidateId: string;
    fieldName: string;
    mappedColumn: string | null;
    applied: boolean;
    reason: string;
    previousValue: unknown;
    newValue: unknown;
    writeId: string | null;
    alreadyCommitted: boolean;
}
export interface CommitJobResult {
    jobId: string;
    policyId: string;
    mode: string;
    totalCandidates: number;
    applied: number;
    skipped: number;
    unmapped: number;
    alreadyCommitted: number;
    /** set when the pre-flight identity check blocked the entire commit */
    identityBlocked?: boolean;
    /** human-readable summary when identityBlocked=true */
    identityReason?: string;
    results: ApplyCandidateSummary[];
}
declare function computeFactHash(fact: {
    entityType: string;
    entityAnchor: string;
    fieldName: string;
    candidateValue: unknown;
}): string;
export interface CommitJobInput {
    tenantId: string;
    jobId: string;
    /** list of candidate ids the operator explicitly approved; empty = apply
     *  every candidate whose strategy would auto-apply */
    approvedCandidateIds?: string[];
    /** per-call override of policy mode. Use 'merge' to force write. */
    forceMode?: 'merge' | 'suggest' | 'observe';
}
export declare function commitJob(input: CommitJobInput): Promise<CommitJobResult>;
export declare const __test: {
    computeFactHash: typeof computeFactHash;
    ENTITY_FIELD_MAP: Record<string, Record<string, string>>;
};
export {};
//# sourceMappingURL=apply.d.ts.map