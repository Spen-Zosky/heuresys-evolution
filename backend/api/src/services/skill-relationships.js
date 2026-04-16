/**
 * Skill Relationship Service
 * Manages skill relationships: prerequisites, complementary, substitution,
 * builds_on, enables. Also handles skill adjacencies for career paths.
 */
import { pool } from '../config/database.js';
// =============================================================================
// SKILL RELATIONSHIP SERVICE
// =============================================================================
export class SkillRelationshipService {
    _tenantId;
    constructor(_tenantId) {
        this._tenantId = _tenantId;
    }
    // Getter in case needed in future
    get tenantId() { return this._tenantId; }
    // ===========================================================================
    // RELATIONSHIP MANAGEMENT
    // ===========================================================================
    /**
     * Create a new skill relationship
     */
    async createRelationship(sourceSkillId, targetSkillId, type, options) {
        const result = await pool.query(`
      INSERT INTO skill_relationships (
        source_skill_id, target_skill_id, relationship_type,
        relationship_strength, is_bidirectional, substitution_context,
        prerequisite_level, relationship_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (source_skill_id, target_skill_id, relationship_type) DO UPDATE SET
        relationship_strength = COALESCE($4, skill_relationships.relationship_strength),
        is_bidirectional = COALESCE($5, skill_relationships.is_bidirectional),
        substitution_context = COALESCE($6, skill_relationships.substitution_context),
        prerequisite_level = COALESCE($7, skill_relationships.prerequisite_level)
      RETURNING *
    `, [
            sourceSkillId,
            targetSkillId,
            type,
            options?.strength ?? 0.50,
            options?.is_bidirectional ?? false,
            options?.substitution_context,
            options?.prerequisite_level,
            options?.source ?? 'manual'
        ]);
        return result.rows[0];
    }
    /**
     * Get all relationships for a skill
     */
    async getRelationships(escoSkillId, options) {
        const direction = options?.direction ?? 'both';
        const typeCondition = options?.type ? `AND sr.relationship_type = $2` : '';
        let query;
        const params = [escoSkillId];
        if (options?.type)
            params.push(options.type);
        if (direction === 'outgoing') {
            query = `
        SELECT
          sr.*,
          source.preferred_label as source_skill_label,
          target.preferred_label as target_skill_label
        FROM skill_relationships sr
        INNER JOIN esco_skills source ON sr.source_skill_id = source.id
        INNER JOIN esco_skills target ON sr.target_skill_id = target.id
        WHERE sr.source_skill_id = $1 ${typeCondition}
        ORDER BY sr.relationship_strength DESC
      `;
        }
        else if (direction === 'incoming') {
            query = `
        SELECT
          sr.*,
          source.preferred_label as source_skill_label,
          target.preferred_label as target_skill_label
        FROM skill_relationships sr
        INNER JOIN esco_skills source ON sr.source_skill_id = source.id
        INNER JOIN esco_skills target ON sr.target_skill_id = target.id
        WHERE sr.target_skill_id = $1 ${typeCondition}
        ORDER BY sr.relationship_strength DESC
      `;
        }
        else {
            query = `
        SELECT
          sr.*,
          source.preferred_label as source_skill_label,
          target.preferred_label as target_skill_label
        FROM skill_relationships sr
        INNER JOIN esco_skills source ON sr.source_skill_id = source.id
        INNER JOIN esco_skills target ON sr.target_skill_id = target.id
        WHERE (sr.source_skill_id = $1 OR sr.target_skill_id = $1)
        ${options?.type ? `AND sr.relationship_type = $2` : ''}
        ORDER BY sr.relationship_strength DESC
      `;
        }
        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            ...row,
            relationship_strength: parseFloat(row.relationship_strength)
        }));
    }
    /**
     * Get prerequisite skills for a skill
     */
    async getPrerequisites(escoSkillId) {
        const result = await pool.query(`
      SELECT
        sr.*,
        es.preferred_label as source_skill_label,
        et.preferred_label as target_skill_label,
        sc.primary_category,
        sc.cognitive_level
      FROM skill_relationships sr
      INNER JOIN esco_skills es ON sr.source_skill_id = es.id
      INNER JOIN esco_skills et ON sr.target_skill_id = et.id
      LEFT JOIN skill_classifications sc ON sr.target_skill_id = sc.esco_skill_id
      WHERE sr.source_skill_id = $1
        AND sr.relationship_type = 'prerequisite'
      ORDER BY sr.prerequisite_level ASC, sr.relationship_strength DESC
    `, [escoSkillId]);
        return result.rows.map(row => ({
            ...row,
            relationship_strength: parseFloat(row.relationship_strength)
        }));
    }
    /**
     * Get complementary skills (skills that work well together)
     */
    async getComplementarySkills(escoSkillId) {
        const result = await pool.query(`
      SELECT
        sr.*,
        es.preferred_label as source_skill_label,
        et.preferred_label as target_skill_label,
        sc.primary_category,
        sc.cognitive_level,
        sc.skill_cluster_id
      FROM skill_relationships sr
      INNER JOIN esco_skills es ON sr.source_skill_id = es.id
      INNER JOIN esco_skills et ON sr.target_skill_id = et.id
      LEFT JOIN skill_classifications sc ON sr.target_skill_id = sc.esco_skill_id
      WHERE (sr.source_skill_id = $1 OR (sr.target_skill_id = $1 AND sr.is_bidirectional = true))
        AND sr.relationship_type = 'complementary'
      ORDER BY sr.relationship_strength DESC
    `, [escoSkillId]);
        return result.rows.map(row => ({
            ...row,
            relationship_strength: parseFloat(row.relationship_strength)
        }));
    }
    /**
     * Get substitution skills (skills that can replace each other in certain contexts)
     */
    async getSubstitutionSkills(escoSkillId) {
        const result = await pool.query(`
      SELECT
        sr.*,
        es.preferred_label as source_skill_label,
        et.preferred_label as target_skill_label,
        sc.primary_category,
        sc.cognitive_level,
        sc.transferability
      FROM skill_relationships sr
      INNER JOIN esco_skills es ON sr.source_skill_id = es.id
      INNER JOIN esco_skills et ON sr.target_skill_id = et.id
      LEFT JOIN skill_classifications sc ON sr.target_skill_id = sc.esco_skill_id
      WHERE (sr.source_skill_id = $1 OR sr.target_skill_id = $1)
        AND sr.relationship_type = 'substitution'
      ORDER BY sr.relationship_strength DESC
    `, [escoSkillId]);
        return result.rows.map(row => ({
            ...row,
            relationship_strength: parseFloat(row.relationship_strength)
        }));
    }
    /**
     * Get skills that build upon this skill
     */
    async getBuildsOnSkills(escoSkillId) {
        const result = await pool.query(`
      SELECT
        sr.*,
        es.preferred_label as source_skill_label,
        et.preferred_label as target_skill_label,
        sc.primary_category,
        sc.cognitive_level
      FROM skill_relationships sr
      INNER JOIN esco_skills es ON sr.source_skill_id = es.id
      INNER JOIN esco_skills et ON sr.target_skill_id = et.id
      LEFT JOIN skill_classifications sc ON sr.source_skill_id = sc.esco_skill_id
      WHERE sr.target_skill_id = $1
        AND sr.relationship_type = 'builds_on'
      ORDER BY sr.relationship_strength DESC
    `, [escoSkillId]);
        return result.rows.map(row => ({
            ...row,
            relationship_strength: parseFloat(row.relationship_strength)
        }));
    }
    /**
     * Get skills that this skill enables (unlocks)
     */
    async getEnabledSkills(escoSkillId) {
        const result = await pool.query(`
      SELECT
        sr.*,
        es.preferred_label as source_skill_label,
        et.preferred_label as target_skill_label,
        sc.primary_category,
        sc.cognitive_level
      FROM skill_relationships sr
      INNER JOIN esco_skills es ON sr.source_skill_id = es.id
      INNER JOIN esco_skills et ON sr.target_skill_id = et.id
      LEFT JOIN skill_classifications sc ON sr.target_skill_id = sc.esco_skill_id
      WHERE sr.source_skill_id = $1
        AND sr.relationship_type = 'enables'
      ORDER BY sr.relationship_strength DESC
    `, [escoSkillId]);
        return result.rows.map(row => ({
            ...row,
            relationship_strength: parseFloat(row.relationship_strength)
        }));
    }
    /**
     * Validate a relationship (mark as human-verified)
     */
    async validateRelationship(relationshipId, validatedBy, updates) {
        const result = await pool.query(`
      UPDATE skill_relationships SET
        relationship_strength = COALESCE($3, relationship_strength),
        is_bidirectional = COALESCE($4, is_bidirectional),
        substitution_context = COALESCE($5, substitution_context),
        validated_by = $2,
        validated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
            relationshipId,
            validatedBy,
            updates?.relationship_strength,
            updates?.is_bidirectional,
            updates?.substitution_context
        ]);
        return result.rows[0];
    }
    /**
     * Delete a relationship
     */
    async deleteRelationship(relationshipId) {
        await pool.query(`DELETE FROM skill_relationships WHERE id = $1`, [relationshipId]);
    }
    // ===========================================================================
    // ADJACENCY ANALYSIS
    // ===========================================================================
    /**
     * Get adjacent skills for a skill
     */
    async getAdjacencies(escoSkillId, options) {
        const conditions = ['(sa.skill_id = $1 OR sa.adjacent_skill_id = $1)'];
        const params = [escoSkillId];
        let paramIndex = 2;
        if (options?.type) {
            conditions.push(`sa.adjacency_type = $${paramIndex++}`);
            params.push(options.type);
        }
        if (options?.min_score !== undefined) {
            conditions.push(`sa.adjacency_score >= $${paramIndex++}`);
            params.push(options.min_score);
        }
        const limit = options?.limit ?? 50;
        const result = await pool.query(`
      SELECT
        sa.*,
        es1.preferred_label as skill_label,
        es2.preferred_label as adjacent_skill_label
      FROM skill_adjacencies sa
      INNER JOIN esco_skills es1 ON sa.skill_id = es1.id
      INNER JOIN esco_skills es2 ON sa.adjacent_skill_id = es2.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sa.adjacency_score DESC
      LIMIT $${paramIndex}
    `, [...params, limit]);
        return result.rows.map(row => ({
            ...row,
            adjacency_score: parseFloat(row.adjacency_score)
        }));
    }
    /**
     * Calculate/update adjacencies based on co-occurrence in job postings
     */
    async calculateJobPostingAdjacencies(escoSkillId) {
        // Count co-occurrence of skills in job postings
        const result = await pool.query(`
      INSERT INTO skill_adjacencies (
        skill_id, adjacent_skill_id, adjacency_score, adjacency_type,
        job_posting_cooccurrence, calculated_at
      )
      SELECT
        $1 as skill_id,
        js2.esco_skill_id as adjacent_skill_id,
        LEAST(1.0, COUNT(DISTINCT j.id)::DECIMAL / 10) as adjacency_score,
        'domain' as adjacency_type,
        COUNT(DISTINCT j.id) as job_posting_cooccurrence,
        NOW() as calculated_at
      FROM job_skills js1
      INNER JOIN jobs j ON js1.job_id = j.id
      INNER JOIN job_skills js2 ON js2.job_id = j.id
      WHERE js1.esco_skill_id = $1
        AND js2.esco_skill_id != $1
      GROUP BY js2.esco_skill_id
      HAVING COUNT(DISTINCT j.id) >= 2
      ON CONFLICT (skill_id, adjacent_skill_id) DO UPDATE SET
        adjacency_score = GREATEST(skill_adjacencies.adjacency_score, EXCLUDED.adjacency_score),
        job_posting_cooccurrence = EXCLUDED.job_posting_cooccurrence,
        calculated_at = NOW()
      RETURNING *
    `, [escoSkillId]);
        return result.rowCount || 0;
    }
    /**
     * Calculate/update adjacencies based on co-occurrence in employee skills
     */
    async calculateEmployeeAdjacencies(escoSkillId) {
        const result = await pool.query(`
      INSERT INTO skill_adjacencies (
        skill_id, adjacent_skill_id, adjacency_score, adjacency_type,
        employee_cooccurrence, calculated_at
      )
      SELECT
        $1 as skill_id,
        es2.esco_skill_id as adjacent_skill_id,
        LEAST(1.0, COUNT(DISTINCT e.id)::DECIMAL / 10) as adjacency_score,
        'competency' as adjacency_type,
        COUNT(DISTINCT e.id) as employee_cooccurrence,
        NOW() as calculated_at
      FROM employee_skills es1
      INNER JOIN employees e ON es1.employee_id = e.id
      INNER JOIN employee_skills es2 ON es2.employee_id = e.id
      WHERE es1.esco_skill_id = $1
        AND es2.esco_skill_id != $1
      GROUP BY es2.esco_skill_id
      HAVING COUNT(DISTINCT e.id) >= 2
      ON CONFLICT (skill_id, adjacent_skill_id) DO UPDATE SET
        adjacency_score = GREATEST(skill_adjacencies.adjacency_score, EXCLUDED.adjacency_score),
        employee_cooccurrence = EXCLUDED.employee_cooccurrence,
        calculated_at = NOW()
      RETURNING *
    `, [escoSkillId]);
        return result.rowCount || 0;
    }
    /**
     * Create manual adjacency
     */
    async createAdjacency(skillId, adjacentSkillId, score, type) {
        const result = await pool.query(`
      INSERT INTO skill_adjacencies (
        skill_id, adjacent_skill_id, adjacency_score, adjacency_type, calculated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (skill_id, adjacent_skill_id) DO UPDATE SET
        adjacency_score = $3,
        adjacency_type = $4,
        calculated_at = NOW()
      RETURNING *
    `, [skillId, adjacentSkillId, score, type]);
        return result.rows[0];
    }
    // ===========================================================================
    // SKILL GRAPH & PATH FINDING
    // ===========================================================================
    /**
     * Get skill graph (network visualization data)
     */
    async getSkillGraph(escoSkillId, depth = 2) {
        // Use the database function for recursive graph traversal
        const result = await pool.query(`
      SELECT * FROM get_skill_relationships_graph($1, $2)
    `, [escoSkillId, depth]);
        const nodes = [];
        const edges = [];
        const nodeSet = new Set();
        for (const row of result.rows) {
            // Add source node
            if (!nodeSet.has(row.source_skill_id)) {
                nodeSet.add(row.source_skill_id);
                nodes.push({
                    id: row.source_skill_id,
                    label: row.source_label,
                    primary_category: row.source_category,
                    depth: row.depth
                });
            }
            // Add target node
            if (!nodeSet.has(row.target_skill_id)) {
                nodeSet.add(row.target_skill_id);
                nodes.push({
                    id: row.target_skill_id,
                    label: row.target_label,
                    primary_category: row.target_category,
                    depth: row.depth + 1
                });
            }
            // Add edge
            edges.push({
                source: row.source_skill_id,
                target: row.target_skill_id,
                relationship_type: row.relationship_type,
                strength: parseFloat(row.relationship_strength)
            });
        }
        // Add center skill if not in graph
        if (!nodeSet.has(escoSkillId)) {
            const centerSkill = await pool.query(`
        SELECT es.*, sc.primary_category
        FROM esco_skills es
        LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id
        WHERE es.id = $1
      `, [escoSkillId]);
            if (centerSkill.rows.length > 0) {
                nodes.push({
                    id: escoSkillId,
                    label: centerSkill.rows[0].preferred_label,
                    primary_category: centerSkill.rows[0].primary_category,
                    depth: 0
                });
            }
        }
        return { nodes, edges, center_skill_id: escoSkillId };
    }
    /**
     * Get career path skills using adjacencies
     */
    async getCareerPathSkills(fromSkillId, toSkillId) {
        // Use the database function for career path calculation
        const result = await pool.query(`
      SELECT * FROM get_career_path_adjacent_skills($1, $2)
    `, [fromSkillId, toSkillId]);
        // Get skill labels
        const skillLabels = await pool.query(`
      SELECT id, preferred_label FROM esco_skills WHERE id IN ($1, $2)
    `, [fromSkillId, toSkillId]);
        const labelMap = new Map(skillLabels.rows.map(r => [r.id, r.preferred_label]));
        const path = result.rows.map((row, idx) => ({
            skill_id: row.skill_id,
            preferred_label: row.preferred_label,
            primary_category: row.primary_category,
            cognitive_level: row.cognitive_level,
            distance: idx,
            path_type: 'builds_on'
        }));
        // Calculate feasibility based on adjacency scores
        let totalScore = 0;
        for (const row of result.rows) {
            totalScore += row.adjacency_score ? parseFloat(row.adjacency_score) : 0.5;
        }
        const feasibility = path.length > 0 ? totalScore / path.length : 0;
        return {
            from_skill: {
                id: fromSkillId,
                label: labelMap.get(fromSkillId) || 'Unknown'
            },
            to_skill: {
                id: toSkillId,
                label: labelMap.get(toSkillId) || 'Unknown'
            },
            path,
            total_distance: path.length,
            feasibility_score: feasibility
        };
    }
    /**
     * Find shortest path between two skills through relationships
     */
    async findSkillPath(fromSkillId, toSkillId, maxDepth = 5) {
        // BFS through relationships to find path
        const result = await pool.query(`
      WITH RECURSIVE skill_path AS (
        -- Start from source skill
        SELECT
          sr.source_skill_id,
          sr.target_skill_id,
          es.preferred_label,
          sc.primary_category,
          sc.cognitive_level,
          sr.relationship_type,
          ARRAY[sr.source_skill_id] as path,
          1 as depth
        FROM skill_relationships sr
        INNER JOIN esco_skills es ON sr.target_skill_id = es.id
        LEFT JOIN skill_classifications sc ON sr.target_skill_id = sc.esco_skill_id
        WHERE sr.source_skill_id = $1

        UNION ALL

        -- Traverse relationships
        SELECT
          sr.source_skill_id,
          sr.target_skill_id,
          es.preferred_label,
          sc.primary_category,
          sc.cognitive_level,
          sr.relationship_type,
          sp.path || sr.source_skill_id,
          sp.depth + 1
        FROM skill_relationships sr
        INNER JOIN skill_path sp ON sr.source_skill_id = sp.target_skill_id
        INNER JOIN esco_skills es ON sr.target_skill_id = es.id
        LEFT JOIN skill_classifications sc ON sr.target_skill_id = sc.esco_skill_id
        WHERE sp.depth < $3
          AND NOT sr.target_skill_id = ANY(sp.path)
      )
      SELECT * FROM skill_path
      WHERE target_skill_id = $2
      ORDER BY depth
      LIMIT 1
    `, [fromSkillId, toSkillId, maxDepth]);
        if (result.rows.length === 0) {
            return [];
        }
        const row = result.rows[0];
        const path = [];
        // Reconstruct path
        for (let i = 0; i < row.path.length; i++) {
            const skillId = row.path[i];
            const skillResult = await pool.query(`
        SELECT es.*, sc.primary_category, sc.cognitive_level
        FROM esco_skills es
        LEFT JOIN skill_classifications sc ON es.id = sc.esco_skill_id
        WHERE es.id = $1
      `, [skillId]);
            if (skillResult.rows.length > 0) {
                const s = skillResult.rows[0];
                path.push({
                    skill_id: s.id,
                    preferred_label: s.preferred_label,
                    primary_category: s.primary_category,
                    cognitive_level: s.cognitive_level,
                    distance: i,
                    path_type: 'builds_on'
                });
            }
        }
        // Add final skill
        path.push({
            skill_id: row.target_skill_id,
            preferred_label: row.preferred_label,
            primary_category: row.primary_category,
            cognitive_level: row.cognitive_level,
            distance: path.length,
            path_type: 'builds_on'
        });
        return path;
    }
    // ===========================================================================
    // STATISTICS
    // ===========================================================================
    /**
     * Get relationship and adjacency statistics
     */
    async getStats() {
        const relResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE relationship_type = 'prerequisite') as prerequisites,
        COUNT(*) FILTER (WHERE relationship_type = 'complementary') as complementary,
        COUNT(*) FILTER (WHERE relationship_type = 'substitution') as substitution,
        COUNT(*) FILTER (WHERE relationship_type = 'builds_on') as builds_on,
        COUNT(*) FILTER (WHERE relationship_type = 'enables') as enables
      FROM skill_relationships
    `);
        const adjResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE adjacency_type = 'domain') as domain,
        COUNT(*) FILTER (WHERE adjacency_type = 'career_path') as career_path
      FROM skill_adjacencies
    `);
        const rel = relResult.rows[0];
        const adj = adjResult.rows[0];
        return {
            total_relationships: parseInt(rel.total),
            prerequisites: parseInt(rel.prerequisites),
            complementary: parseInt(rel.complementary),
            substitution: parseInt(rel.substitution),
            builds_on: parseInt(rel.builds_on),
            enables: parseInt(rel.enables),
            total_adjacencies: parseInt(adj.total),
            domain_adjacencies: parseInt(adj.domain),
            career_path_adjacencies: parseInt(adj.career_path)
        };
    }
    /**
     * Get relationship summary for a skill
     */
    async getSkillRelationshipSummary(escoSkillId) {
        const result = await pool.query(`
      SELECT
        es.id as skill_id,
        es.preferred_label as skill_label,
        (SELECT COUNT(*) FROM skill_relationships WHERE source_skill_id = $1 AND relationship_type = 'prerequisite') as prerequisite_count,
        (SELECT COUNT(*) FROM skill_relationships WHERE (source_skill_id = $1 OR target_skill_id = $1) AND relationship_type = 'complementary') as complementary_count,
        (SELECT COUNT(*) FROM skill_relationships WHERE (source_skill_id = $1 OR target_skill_id = $1) AND relationship_type = 'substitution') as substitution_count,
        (SELECT COUNT(*) FROM skill_relationships WHERE target_skill_id = $1 AND relationship_type = 'builds_on') as builds_on_count,
        (SELECT COUNT(*) FROM skill_relationships WHERE source_skill_id = $1 AND relationship_type = 'enables') as enables_count,
        (SELECT COUNT(*) FROM skill_adjacencies WHERE skill_id = $1 OR adjacent_skill_id = $1) as adjacency_count
      FROM esco_skills es
      WHERE es.id = $1
    `, [escoSkillId]);
        if (result.rows.length === 0) {
            throw new Error(`Skill not found: ${escoSkillId}`);
        }
        return {
            skill_id: result.rows[0].skill_id,
            skill_label: result.rows[0].skill_label,
            prerequisite_count: parseInt(result.rows[0].prerequisite_count),
            complementary_count: parseInt(result.rows[0].complementary_count),
            substitution_count: parseInt(result.rows[0].substitution_count),
            builds_on_count: parseInt(result.rows[0].builds_on_count),
            enables_count: parseInt(result.rows[0].enables_count),
            adjacency_count: parseInt(result.rows[0].adjacency_count)
        };
    }
}
export default SkillRelationshipService;
//# sourceMappingURL=skill-relationships.js.map