import { type Queryable } from './pool.js';
export interface CandidateInput {
    tenantId: string;
    jobId: string;
    snapshotId: string;
    entityType: string;
    entityAnchor: string | null;
    fieldName: string;
    candidateValue: unknown;
    confidence: number;
    extractionMethod: string;
    llmProviderCode: string;
    sourceUrl: string;
}
export declare function computeFactHash(input: {
    entityType: string;
    entityAnchor: string | null;
    fieldName: string;
    candidateValue: unknown;
    sourceUrl: string;
}): string;
export declare function insertCandidate(input: CandidateInput, db?: Queryable): Promise<{
    id: string;
    factHash: string;
    isNew: boolean;
}>;
//# sourceMappingURL=candidates.d.ts.map