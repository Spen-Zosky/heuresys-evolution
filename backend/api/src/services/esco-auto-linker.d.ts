/**
 * ESCO Auto-Linker Service
 * Generates embeddings for imported skill texts and matches them to ESCO skills
 * via pgvector cosine similarity.
 * Horizon O2.2
 */
import { PoolClient } from 'pg';
export interface MatchResult {
    escoSkillId: string;
    preferredLabel: string;
    similarity: number;
    skillType: string;
}
export interface AutoLinkResult {
    inputText: string;
    matches: MatchResult[];
    bestMatch: MatchResult | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
}
export interface LinkingSummary {
    total: number;
    linked: number;
    unlinked: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
}
export declare class EscoAutoLinkerService {
    private dbClient;
    constructor(dbClient: PoolClient);
    findSimilarSkills(text: string, topN?: number, threshold?: number): Promise<MatchResult[]>;
    autoLinkBatch(skillTexts: string[], _tenantId: string): Promise<AutoLinkResult[]>;
    linkImportedSkills(importJobId: string, tenantId: string): Promise<LinkingSummary>;
    private extractSkillTexts;
}
//# sourceMappingURL=esco-auto-linker.d.ts.map