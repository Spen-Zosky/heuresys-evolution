/**
 * Skill Extraction Service
 * LLM-powered skill extraction from unstructured text with ontology mapping
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-07 (Skill Extraction Service)
 * Created: 2025-12-22
 */
export interface ExtractedSkillRaw {
    name: string;
    type: 'skill' | 'knowledge' | 'competence';
    context: string;
    startOffset?: number;
    endOffset?: number;
    isRequired?: boolean;
    proficiencyLevel?: 'basic' | 'intermediate' | 'advanced' | 'expert';
}
export interface MappedSkill {
    rawSkill: ExtractedSkillRaw;
    escoSkillId: string | null;
    escoSkillUri: string | null;
    escoSkillLabel: string | null;
    escoSkillType: string | null;
    matchConfidence: number;
    matchMethod: 'exact' | 'semantic' | 'partial' | 'none';
    alternativeMatches?: Array<{
        escoSkillId: string;
        escoSkillLabel: string;
        confidence: number;
    }> | undefined;
}
export interface SkillExtractionResult {
    jobId: string;
    status: 'completed' | 'partial' | 'failed';
    sourceType: string;
    language: 'en' | 'it';
    extractedSkills: ExtractedSkillRaw[];
    mappedSkills: MappedSkill[];
    unmappedSkills: ExtractedSkillRaw[];
    statistics: {
        totalExtracted: number;
        totalMapped: number;
        totalUnmapped: number;
        avgConfidence: number;
        processingTimeMs: number;
    };
    highlightedText?: string | undefined;
}
export interface ExtractionOptions {
    language?: 'en' | 'it' | 'auto';
    includeHighlights?: boolean;
    minConfidence?: number;
    maxSkills?: number;
    sourceType?: 'job_description' | 'cv' | 'course' | 'general';
    tenantId?: string;
}
export declare class SkillExtractionService {
    extractSkills(text: string, options?: ExtractionOptions): Promise<SkillExtractionResult>;
    private llmExtractSkills;
    private parseExtractionResponse;
    private normalizeSkillType;
    private normalizeProficiency;
    private mapToOntology;
    private findBestMatch;
    private findExactMatch;
    private findSemanticMatch;
    private findPartialMatch;
    private generateHighlightedText;
    private detectLanguage;
    private createExtractionJob;
    private updateExtractionJob;
    private logAIUsage;
}
export declare function getSkillExtractionService(): SkillExtractionService;
export default SkillExtractionService;
//# sourceMappingURL=skill-extraction.service.d.ts.map