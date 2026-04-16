/**
 * Skill Relationship Service
 * Manages skill relationships: prerequisites, complementary, substitution,
 * builds_on, enables. Also handles skill adjacencies for career paths.
 */
export type RelationshipType = 'prerequisite' | 'complementary' | 'substitution' | 'builds_on' | 'enables';
export type AdjacencyType = 'domain' | 'competency' | 'tool' | 'method' | 'career_path';
export type RelationshipSource = 'esco_hierarchy' | 'ai_inferred' | 'manual' | 'job_analysis';
export interface SkillRelationship {
    id: string;
    source_skill_id: string;
    source_skill_label?: string;
    target_skill_id: string;
    target_skill_label?: string;
    relationship_type: RelationshipType;
    relationship_strength: number;
    is_bidirectional: boolean;
    substitution_context?: string;
    prerequisite_level?: number;
    relationship_source: RelationshipSource;
    validated_by?: string;
    validated_at?: string;
    created_at?: string;
}
export interface SkillAdjacency {
    id: string;
    skill_id: string;
    skill_label?: string;
    adjacent_skill_id: string;
    adjacent_skill_label?: string;
    adjacency_score: number;
    adjacency_type: AdjacencyType;
    job_posting_cooccurrence: number;
    employee_cooccurrence: number;
    calculated_at?: string;
}
export interface SkillPathNode {
    skill_id: string;
    preferred_label: string;
    primary_category?: string;
    cognitive_level?: number;
    distance: number;
    path_type: 'prerequisite' | 'builds_on' | 'enables';
}
export interface SkillPath {
    from_skill: {
        id: string;
        label: string;
    };
    to_skill: {
        id: string;
        label: string;
    };
    path: SkillPathNode[];
    total_distance: number;
    feasibility_score: number;
}
export interface SkillGraphNode {
    id: string;
    label: string;
    primary_category?: string;
    cognitive_level?: number;
    cluster_code?: string;
    depth: number;
}
export interface SkillGraphEdge {
    source: string;
    target: string;
    relationship_type: RelationshipType;
    strength: number;
}
export interface SkillGraph {
    nodes: SkillGraphNode[];
    edges: SkillGraphEdge[];
    center_skill_id: string;
}
export interface RelationshipStats {
    total_relationships: number;
    prerequisites: number;
    complementary: number;
    substitution: number;
    builds_on: number;
    enables: number;
    total_adjacencies: number;
    domain_adjacencies: number;
    career_path_adjacencies: number;
}
export declare class SkillRelationshipService {
    private _tenantId;
    constructor(_tenantId: string);
    get tenantId(): string;
    /**
     * Create a new skill relationship
     */
    createRelationship(sourceSkillId: string, targetSkillId: string, type: RelationshipType, options?: {
        strength?: number;
        is_bidirectional?: boolean;
        substitution_context?: string;
        prerequisite_level?: number;
        source?: RelationshipSource;
    }): Promise<SkillRelationship>;
    /**
     * Get all relationships for a skill
     */
    getRelationships(escoSkillId: string, options?: {
        type?: RelationshipType;
        direction?: 'outgoing' | 'incoming' | 'both';
    }): Promise<SkillRelationship[]>;
    /**
     * Get prerequisite skills for a skill
     */
    getPrerequisites(escoSkillId: string): Promise<SkillRelationship[]>;
    /**
     * Get complementary skills (skills that work well together)
     */
    getComplementarySkills(escoSkillId: string): Promise<SkillRelationship[]>;
    /**
     * Get substitution skills (skills that can replace each other in certain contexts)
     */
    getSubstitutionSkills(escoSkillId: string): Promise<SkillRelationship[]>;
    /**
     * Get skills that build upon this skill
     */
    getBuildsOnSkills(escoSkillId: string): Promise<SkillRelationship[]>;
    /**
     * Get skills that this skill enables (unlocks)
     */
    getEnabledSkills(escoSkillId: string): Promise<SkillRelationship[]>;
    /**
     * Validate a relationship (mark as human-verified)
     */
    validateRelationship(relationshipId: string, validatedBy: string, updates?: Partial<SkillRelationship>): Promise<SkillRelationship>;
    /**
     * Delete a relationship
     */
    deleteRelationship(relationshipId: string): Promise<void>;
    /**
     * Get adjacent skills for a skill
     */
    getAdjacencies(escoSkillId: string, options?: {
        type?: AdjacencyType;
        min_score?: number;
        limit?: number;
    }): Promise<SkillAdjacency[]>;
    /**
     * Calculate/update adjacencies based on co-occurrence in job postings
     */
    calculateJobPostingAdjacencies(escoSkillId: string): Promise<number>;
    /**
     * Calculate/update adjacencies based on co-occurrence in employee skills
     */
    calculateEmployeeAdjacencies(escoSkillId: string): Promise<number>;
    /**
     * Create manual adjacency
     */
    createAdjacency(skillId: string, adjacentSkillId: string, score: number, type: AdjacencyType): Promise<SkillAdjacency>;
    /**
     * Get skill graph (network visualization data)
     */
    getSkillGraph(escoSkillId: string, depth?: number): Promise<SkillGraph>;
    /**
     * Get career path skills using adjacencies
     */
    getCareerPathSkills(fromSkillId: string, toSkillId: string): Promise<SkillPath>;
    /**
     * Find shortest path between two skills through relationships
     */
    findSkillPath(fromSkillId: string, toSkillId: string, maxDepth?: number): Promise<SkillPathNode[]>;
    /**
     * Get relationship and adjacency statistics
     */
    getStats(): Promise<RelationshipStats>;
    /**
     * Get relationship summary for a skill
     */
    getSkillRelationshipSummary(escoSkillId: string): Promise<{
        skill_id: string;
        skill_label: string;
        prerequisite_count: number;
        complementary_count: number;
        substitution_count: number;
        builds_on_count: number;
        enables_count: number;
        adjacency_count: number;
    }>;
}
export default SkillRelationshipService;
//# sourceMappingURL=skill-relationships.d.ts.map