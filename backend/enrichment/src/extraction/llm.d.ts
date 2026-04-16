export interface ExtractionInput {
    schema: Record<string, unknown>;
    entityName: string;
    markdown: string;
    maxOutputTokens?: number;
}
export interface ExtractionResult {
    raw: Record<string, unknown>;
    providerCode: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    confidenceOverall: number;
    /**
     * Per-field confidence scores in [0,1]. Fields present and non-null get
     * 0.8 by default; fields matching a strong heuristic (URL, ISO code,
     * VAT) get 0.9; missing fields get 0.
     */
    confidenceByField: Record<string, number>;
}
export declare function extract(input: ExtractionInput): Promise<ExtractionResult>;
//# sourceMappingURL=llm.d.ts.map