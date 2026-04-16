/**
 * Ontology Relations Service
 * Advanced ontological analysis: skill clustering, career pathways, process-skill impact.
 * Uses ESCO knowledge graph (esco_skills, esco_occupations, esco_occupation_skills, process_skill_requirements).
 *
 * Horizon O3.7
 */
import { Pool, PoolClient } from 'pg';
export interface SkillCluster {
    clusterId: string;
    label: string;
    broaderUri: string;
    memberCount: number;
    topSkills: Array<{
        id: string;
        label: string;
        skillType: string;
    }>;
    relatedOccupationCount: number;
}
export interface SkillClustersResult {
    clusters: SkillCluster[];
    total: number;
}
export interface CareerStepSkill {
    id: string;
    label: string;
    skillType: string;
}
export interface CareerStep {
    occupationId: string;
    occupationLabel: string;
    iscoCode: string | null;
    skillOverlap: number;
    skillsGained: CareerStepSkill[];
    skillsLost: CareerStepSkill[];
}
export interface CareerPathwayResult {
    source: {
        id: string;
        label: string;
        iscoCode: string | null;
    };
    steps: CareerStep[];
}
export interface SkillImpactEntry {
    skillId: string;
    skillLabel: string;
    skillType: string;
    processCount: number;
    processNames: string[];
    isCritical: boolean;
    isUnique: boolean;
}
export interface ProcessSkillImpactResult {
    totalSkills: number;
    criticalSkills: SkillImpactEntry[];
    uniqueSkills: SkillImpactEntry[];
}
export declare class OntologyRelationsService {
    private readonly db;
    constructor(db: Pool | PoolClient);
    /**
     * Cluster ESCO skills by broader_uri hierarchy.
     * Each cluster groups skills sharing the same parent concept.
     * Supports optional filtering by skill_type (skill/knowledge/competence).
     */
    getSkillClusters(options: {
        limit: number;
        offset: number;
        skillType?: string;
    }): Promise<SkillClustersResult>;
    /**
     * Infer career pathways from a source occupation.
     * Finds neighboring occupations sharing >= 60% of skills, then extends one hop further.
     * Returns up to 5 direct neighbors with skill delta (gained/lost).
     */
    getCareerPathways(occupationId: string): Promise<CareerPathwayResult>;
    /**
     * Compute process-skill impact matrix.
     * Returns which ESCO skills appear across business processes,
     * marking critical (>2 processes) and unique (exactly 1 process) skills.
     */
    getProcessSkillImpact(): Promise<ProcessSkillImpactResult>;
}
//# sourceMappingURL=ontology-relations.d.ts.map