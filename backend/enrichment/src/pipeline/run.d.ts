import { type EntityDescriptor } from '../db/descriptors.js';
export interface PipelineInput {
    tenantId: string;
    entityName: string;
    targetRecordId: string;
    url: string;
    mode?: 'suggest' | 'merge' | 'observe';
}
export interface PipelineCandidate {
    id: string;
    field: string;
    value: unknown;
    isNew: boolean;
}
export interface PipelineResult {
    jobId: string;
    cached: boolean;
    snapshot?: {
        id: string;
        httpStatus: number;
        contentHash: string;
        bytes: number;
    };
    extraction?: {
        provider: string;
        model: string;
        confidenceOverall: number;
        inputTokens: number;
        outputTokens: number;
    };
    candidates?: PipelineCandidate[];
}
/**
 * Idempotent job creation: returns the job row and a `cached` flag.
 * Used by both the inline POST path (when resolving to a cached result) and
 * the async enqueue path (to reserve the job id before pushing to BullMQ).
 */
export declare function createJobRow(input: PipelineInput): Promise<{
    jobId: string;
    cached: boolean;
    descriptor: EntityDescriptor;
}>;
/**
 * Runs the crawl→extract→persist pipeline for an existing non-cached job row.
 * Assumes `createJobRow` has already reserved the job id.
 */
export declare function runPipeline(jobId: string, input: PipelineInput, descriptor: EntityDescriptor): Promise<PipelineResult>;
/**
 * Mark a job as failed with error details recorded in both status row and events.
 * Used by the worker on pipeline exceptions.
 */
export declare function markJobFailed(tenantId: string, jobId: string, error: Error): Promise<void>;
//# sourceMappingURL=run.d.ts.map