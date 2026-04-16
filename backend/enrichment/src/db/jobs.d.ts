import { type Queryable } from './pool.js';
export interface CreateJobInput {
    tenantId: string;
    descriptorId: string;
    targetTable: string;
    targetPkField: string;
    targetRecordId: string;
    semanticScope: Record<string, unknown>;
    policyId: string;
    mode: 'suggest' | 'merge' | 'observe';
    requestedByUserId?: string | null;
    freshnessDays?: number;
}
export declare function computeIdempotencyKey(input: CreateJobInput, extractionSchemaVersion?: number): string;
export declare function createJob(input: CreateJobInput, db?: Queryable): Promise<{
    id: string;
    idempotencyKey: string;
    cached: boolean;
}>;
export declare function updateJobStatus(jobId: string, status: string, errorDetails?: unknown, db?: Queryable): Promise<void>;
export declare function recordJobEvent(jobId: string, tenantId: string, eventType: string, payload?: Record<string, unknown>, db?: Queryable): Promise<void>;
//# sourceMappingURL=jobs.d.ts.map