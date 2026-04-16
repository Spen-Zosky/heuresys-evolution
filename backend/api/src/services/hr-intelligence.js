/**
 * HR Intelligence Service
 * Epic 8: HR Intelligence
 * Stories: 8.1-8.5
 */
import { pool } from '../config/database.js';
import { escapeILIKE } from '../utils/sql-safety.js';
// =============================================================================
// HR INTELLIGENCE SERVICE
// =============================================================================
export class HRIntelligenceService {
    tenantId;
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    // ===========================================================================
    // STORY 8.1: ESCO SKILL TAXONOMY INTEGRATION
    // ===========================================================================
    /**
     * Search ESCO skills by text
     */
    async searchSkills(query, options = {}) {
        const { skillType, limit = 20, offset = 0 } = options;
        const conditions = [];
        const values = [];
        let paramIndex = 1;
        if (query) {
            conditions.push(`(
        preferred_label ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        alt_labels::text ILIKE $${paramIndex}
      )`);
            values.push(`%${escapeILIKE(query)}%`);
            paramIndex++;
        }
        if (skillType) {
            conditions.push(`skill_type = $${paramIndex}`);
            values.push(skillType);
            paramIndex++;
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM esco_skills ${whereClause}`, values);
        values.push(limit, offset);
        const result = await pool.query(`SELECT * FROM esco_skills ${whereClause}
       ORDER BY preferred_label
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, values);
        return {
            skills: result.rows.map(this.mapESCOSkill),
            total: parseInt(countResult.rows[0].total),
        };
    }
    /**
     * Get ESCO skill by ID or URI
     */
    async getSkill(idOrUri) {
        const result = await pool.query(`SELECT * FROM esco_skills WHERE id::text = $1 OR esco_uri = $1`, [idOrUri]);
        return result.rows[0] ? this.mapESCOSkill(result.rows[0]) : null;
    }
    /**
     * Get skill hierarchy (broader/narrower)
     */
    async getSkillHierarchy(skillUri) {
        const skill = await this.getSkill(skillUri);
        if (!skill) {
            return { skill: null, broader: [], narrower: [], related: [] };
        }
        const [broaderResult, narrowerResult, relatedResult] = await Promise.all([
            skill.broaderUri
                ? pool.query(`SELECT * FROM esco_skills WHERE esco_uri = $1`, [skill.broaderUri])
                : { rows: [] },
            skill.narrowerUris.length > 0
                ? pool.query(`SELECT * FROM esco_skills WHERE esco_uri = ANY($1)`, [skill.narrowerUris])
                : { rows: [] },
            skill.relatedUris.length > 0
                ? pool.query(`SELECT * FROM esco_skills WHERE esco_uri = ANY($1)`, [skill.relatedUris])
                : { rows: [] },
        ]);
        return {
            skill,
            broader: broaderResult.rows.map(this.mapESCOSkill),
            narrower: narrowerResult.rows.map(this.mapESCOSkill),
            related: relatedResult.rows.map(this.mapESCOSkill),
        };
    }
    /**
     * Search ESCO occupations
     */
    async searchOccupations(query, options = {}) {
        const { limit = 20, offset = 0 } = options;
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM esco_occupations
       WHERE preferred_label ILIKE $1 OR description ILIKE $1`, [`%${escapeILIKE(query)}%`]);
        const result = await pool.query(`SELECT * FROM esco_occupations
       WHERE preferred_label ILIKE $1 OR description ILIKE $1
       ORDER BY preferred_label
       LIMIT $2 OFFSET $3`, [`%${escapeILIKE(query)}%`, limit, offset]);
        return {
            occupations: result.rows.map(this.mapESCOOccupation),
            total: parseInt(countResult.rows[0].total),
        };
    }
    /**
     * Get skills required for an occupation
     */
    async getOccupationSkills(occupationUri) {
        const occResult = await pool.query(`SELECT * FROM esco_occupations WHERE esco_uri = $1`, [
            occupationUri,
        ]);
        if (occResult.rows.length === 0) {
            return { occupation: null, essentialSkills: [], optionalSkills: [] };
        }
        const occupation = this.mapESCOOccupation(occResult.rows[0]);
        const [essentialResult, optionalResult] = await Promise.all([
            occupation.essentialSkills.length > 0
                ? pool.query(`SELECT * FROM esco_skills WHERE esco_uri = ANY($1)`, [
                    occupation.essentialSkills,
                ])
                : { rows: [] },
            occupation.optionalSkills.length > 0
                ? pool.query(`SELECT * FROM esco_skills WHERE esco_uri = ANY($1)`, [
                    occupation.optionalSkills,
                ])
                : { rows: [] },
        ]);
        return {
            occupation,
            essentialSkills: essentialResult.rows.map(this.mapESCOSkill),
            optionalSkills: optionalResult.rows.map(this.mapESCOSkill),
        };
    }
    // ===========================================================================
    // EMPLOYEE SKILLS MANAGEMENT
    // ===========================================================================
    /**
     * Add skill to employee
     */
    async addEmployeeSkill(employeeId, skillData) {
        const proficiencyLabels = ['', 'beginner', 'intermediate', 'advanced', 'expert', 'master'];
        const result = await pool.query(`INSERT INTO employee_skills (
        tenant_id, employee_id, esco_skill_id, custom_skill_name,
        proficiency_level, proficiency_label, years_experience,
        is_primary, source, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`, [
            this.tenantId,
            employeeId,
            skillData.escoSkillId || null,
            skillData.customSkillName || null,
            skillData.proficiencyLevel,
            proficiencyLabels[skillData.proficiencyLevel] || 'intermediate',
            skillData.yearsExperience || null,
            skillData.isPrimary || false,
            skillData.source || 'self_assessment',
            skillData.notes || null,
        ]);
        return result.rows[0].id;
    }
    /**
     * Get employee skills
     */
    async getEmployeeSkills(employeeId, options = {}) {
        const query = options.includeESCODetails
            ? `SELECT es.*, esco.preferred_label as esco_skill_name, esco.skill_type as esco_skill_type
         FROM employee_skills es
         LEFT JOIN esco_skills esco ON es.esco_skill_id = esco.id
         WHERE es.employee_id = $1 AND es.tenant_id = $2
         ORDER BY es.is_primary DESC, es.proficiency_level DESC`
            : `SELECT * FROM employee_skills
         WHERE employee_id = $1 AND tenant_id = $2
         ORDER BY is_primary DESC, proficiency_level DESC`;
        const result = await pool.query(query, [employeeId, this.tenantId]);
        return result.rows.map((row) => ({
            id: row.id,
            employeeId: row.employee_id,
            escoSkillId: row.esco_skill_id,
            escoSkillName: row.esco_skill_name,
            escoSkillType: row.esco_skill_type,
            customSkillName: row.custom_skill_name,
            proficiencyLevel: row.proficiency_level,
            proficiencyLabel: row.proficiency_label,
            yearsExperience: row.years_experience,
            isPrimary: row.is_primary,
            isVerified: row.is_verified,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
            source: row.source,
            confidenceScore: row.confidence_score,
            lastUsedAt: row.last_used_at,
            notes: row.notes,
        }));
    }
    /**
     * Update employee skill
     */
    async updateEmployeeSkill(skillId, updates) {
        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        if (updates.proficiencyLevel !== undefined) {
            setClauses.push(`proficiency_level = $${paramIndex}`);
            values.push(updates.proficiencyLevel);
            paramIndex++;
            const labels = ['', 'beginner', 'intermediate', 'advanced', 'expert', 'master'];
            setClauses.push(`proficiency_label = $${paramIndex}`);
            values.push(labels[updates.proficiencyLevel] || 'intermediate');
            paramIndex++;
        }
        if (updates.yearsExperience !== undefined) {
            setClauses.push(`years_experience = $${paramIndex}`);
            values.push(updates.yearsExperience);
            paramIndex++;
        }
        if (updates.isPrimary !== undefined) {
            setClauses.push(`is_primary = $${paramIndex}`);
            values.push(updates.isPrimary);
            paramIndex++;
        }
        if (updates.lastUsedAt !== undefined) {
            setClauses.push(`last_used_at = $${paramIndex}`);
            values.push(updates.lastUsedAt);
            paramIndex++;
        }
        if (updates.notes !== undefined) {
            setClauses.push(`notes = $${paramIndex}`);
            values.push(updates.notes);
            paramIndex++;
        }
        if (setClauses.length === 0)
            return;
        setClauses.push('updated_at = NOW()');
        values.push(skillId, this.tenantId);
        await pool.query(`UPDATE employee_skills SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`, values);
    }
    /**
     * Verify employee skill
     */
    async verifyEmployeeSkill(skillId, verifiedBy) {
        await pool.query(`UPDATE employee_skills
       SET is_verified = true, verified_by = $1, verified_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`, [verifiedBy, skillId, this.tenantId]);
    }
    /**
     * Delete employee skill
     */
    async deleteEmployeeSkill(skillId) {
        await pool.query(`DELETE FROM employee_skills WHERE id = $1 AND tenant_id = $2`, [
            skillId,
            this.tenantId,
        ]);
    }
    // ===========================================================================
    // STORY 8.2: JOB MARKET DATA
    // ===========================================================================
    /**
     * Get job market sources
     */
    async getJobMarketSources() {
        const result = await pool.query(`SELECT * FROM job_market_sources ORDER BY source_name`);
        return result.rows;
    }
    /**
     * Search job market postings
     */
    async searchJobPostings(options) {
        const conditions = ['is_active = true'];
        const values = [];
        let paramIndex = 1;
        if (options.query) {
            conditions.push(`(job_title ILIKE $${paramIndex} OR job_description ILIKE $${paramIndex})`);
            values.push(`%${escapeILIKE(options.query)}%`);
            paramIndex++;
        }
        if (options.skills && options.skills.length > 0) {
            conditions.push(`mapped_esco_skills ?| $${paramIndex}`);
            values.push(options.skills);
            paramIndex++;
        }
        if (options.countryCode) {
            conditions.push(`country_code = $${paramIndex}`);
            values.push(options.countryCode);
            paramIndex++;
        }
        if (options.location) {
            conditions.push(`(location ILIKE $${paramIndex} OR region ILIKE $${paramIndex})`);
            values.push(`%${escapeILIKE(options.location)}%`);
            paramIndex++;
        }
        if (options.industry) {
            conditions.push(`industry = $${paramIndex}`);
            values.push(options.industry);
            paramIndex++;
        }
        if (options.experienceLevel) {
            conditions.push(`experience_level = $${paramIndex}`);
            values.push(options.experienceLevel);
            paramIndex++;
        }
        if (options.salaryMin) {
            conditions.push(`salary_max >= $${paramIndex}`);
            values.push(options.salaryMin);
            paramIndex++;
        }
        if (options.salaryMax) {
            conditions.push(`salary_min <= $${paramIndex}`);
            values.push(options.salaryMax);
            paramIndex++;
        }
        if (options.employmentType) {
            conditions.push(`employment_type = $${paramIndex}`);
            values.push(options.employmentType);
            paramIndex++;
        }
        if (options.locationType) {
            conditions.push(`location_type = $${paramIndex}`);
            values.push(options.locationType);
            paramIndex++;
        }
        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM job_market_postings ${whereClause}`, values);
        const limit = options.limit || 20;
        const offset = options.offset || 0;
        values.push(limit, offset);
        const result = await pool.query(`SELECT * FROM job_market_postings ${whereClause}
       ORDER BY posting_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, values);
        return {
            postings: result.rows,
            total: parseInt(countResult.rows[0].total),
        };
    }
    /**
     * Get job market statistics
     */
    async getJobMarketStatistics(options) {
        const conditions = [];
        const values = [];
        let paramIndex = 1;
        conditions.push(`stat_date >= CURRENT_DATE - $${paramIndex}`);
        values.push(options.days || 30);
        paramIndex++;
        if (options.period) {
            conditions.push(`stat_period = $${paramIndex}`);
            values.push(options.period);
            paramIndex++;
        }
        if (options.countryCode) {
            conditions.push(`country_code = $${paramIndex}`);
            values.push(options.countryCode);
            paramIndex++;
        }
        if (options.industry) {
            conditions.push(`industry = $${paramIndex}`);
            values.push(options.industry);
            paramIndex++;
        }
        const result = await pool.query(`SELECT * FROM job_market_statistics
       WHERE ${conditions.join(' AND ')}
       ORDER BY stat_date DESC`, values);
        return result.rows;
    }
    /**
     * Get trending skills from job market
     */
    async getTrendingSkills(options) {
        const days = options.days || 30;
        const limit = options.limit || 20;
        // Get current period skills
        const currentResult = await pool.query(`SELECT
        skill_uri,
        COUNT(*) as current_count
       FROM (
         SELECT jsonb_array_elements_text(mapped_esco_skills) as skill_uri
         FROM job_market_postings
         WHERE posting_date >= CURRENT_DATE - $1
           AND is_active = true
           ${options.countryCode ? 'AND country_code = $4' : ''}
           ${options.industry ? `AND industry = $${options.countryCode ? '5' : '4'}` : ''}
       ) skills
       GROUP BY skill_uri
       ORDER BY current_count DESC
       LIMIT $2`, [
            days,
            limit,
            ...(options.countryCode ? [options.countryCode] : []),
            ...(options.industry ? [options.industry] : []),
        ].filter(Boolean));
        // Get previous period for comparison
        const previousResult = await pool.query(`SELECT
        skill_uri,
        COUNT(*) as previous_count
       FROM (
         SELECT jsonb_array_elements_text(mapped_esco_skills) as skill_uri
         FROM job_market_postings
         WHERE posting_date >= CURRENT_DATE - $1
           AND posting_date < CURRENT_DATE - $2
           AND is_active = true
       ) skills
       GROUP BY skill_uri`, [days * 2, days]);
        const previousMap = new Map(previousResult.rows.map((r) => [r.skill_uri, parseInt(r.previous_count)]));
        // Get skill names and salary data
        const skillUris = currentResult.rows.map((r) => r.skill_uri);
        const skillsResult = await pool.query(`SELECT esco_uri, preferred_label FROM esco_skills WHERE esco_uri = ANY($1)`, [skillUris]);
        const skillNameMap = new Map(skillsResult.rows.map((r) => [r.esco_uri, r.preferred_label]));
        return currentResult.rows.map((row) => {
            const currentCount = parseInt(row.current_count);
            const previousCount = previousMap.get(row.skill_uri) || 0;
            const growthRate = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 100;
            return {
                skillUri: row.skill_uri,
                skillName: skillNameMap.get(row.skill_uri) || row.skill_uri,
                demandScore: Math.min(100, Math.round((currentCount / (currentResult.rows[0]?.current_count || 1)) * 100)),
                avgSalaryMin: 0, // Would need salary aggregation
                avgSalaryMax: 0,
                growthRate: Math.round(growthRate * 100) / 100,
                jobPostingsCount: currentCount,
                trendDirection: growthRate > 5 ? 'up' : growthRate < -5 ? 'down' : 'stable',
            };
        });
    }
    // ===========================================================================
    // STORY 8.3: SKILL EXTRACTION & NORMALIZATION
    // ===========================================================================
    /**
     * Extract skills from text
     */
    async extractSkills(text, options = {}) {
        // Create extraction job
        const jobResult = await pool.query(`INSERT INTO skill_extraction_jobs (
        tenant_id, job_type, source_type, source_text, status
      ) VALUES ($1, $2, 'text', $3, 'processing')
      RETURNING id`, [this.tenantId, options.jobType || 'document', text]);
        const jobId = jobResult.rows[0].id;
        try {
            // Simple keyword extraction (in production, use NLP/AI)
            const extractedSkills = this.extractSkillKeywords(text);
            // Map to ESCO
            const mappedSkills = [];
            const unmappedSkills = [];
            for (const skill of extractedSkills) {
                const match = await this.findBestESCOMatch(skill);
                if (match) {
                    mappedSkills.push({
                        originalText: skill,
                        escoUri: match.uri,
                        escoLabel: match.label,
                        confidence: match.confidence,
                    });
                }
                else {
                    unmappedSkills.push(skill);
                }
            }
            // Update job
            await pool.query(`UPDATE skill_extraction_jobs SET
          status = 'completed',
          extracted_skills = $1,
          mapped_skills = $2,
          unmapped_skills = $3,
          completed_at = NOW()
         WHERE id = $4`, [
                JSON.stringify(extractedSkills),
                JSON.stringify(mappedSkills),
                JSON.stringify(unmappedSkills),
                jobId,
            ]);
            return {
                extractedSkills,
                mappedSkills,
                unmappedSkills,
                confidence: mappedSkills.length / Math.max(extractedSkills.length, 1),
            };
        }
        catch (error) {
            await pool.query(`UPDATE skill_extraction_jobs SET status = 'failed', error_message = $1 WHERE id = $2`, [error.message, jobId]);
            throw error;
        }
    }
    /**
     * Simple keyword extraction (placeholder for NLP)
     */
    extractSkillKeywords(text) {
        // Common tech skills patterns
        const skillPatterns = [
            /\b(javascript|typescript|python|java|c\+\+|c#|ruby|go|rust|php|swift|kotlin)\b/gi,
            /\b(react|angular|vue|node\.?js|express|django|flask|spring|rails)\b/gi,
            /\b(sql|postgresql|mysql|mongodb|redis|elasticsearch)\b/gi,
            /\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|git)\b/gi,
            /\b(machine learning|deep learning|nlp|computer vision|data science)\b/gi,
            /\b(project management|agile|scrum|kanban|leadership|communication)\b/gi,
            /\b(excel|powerpoint|word|salesforce|sap|oracle)\b/gi,
        ];
        const skills = new Set();
        for (const pattern of skillPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach((m) => skills.add(m.toLowerCase()));
            }
        }
        return Array.from(skills);
    }
    /**
     * Find best ESCO match for a skill text
     */
    async findBestESCOMatch(skillText) {
        // Check aliases first
        const aliasResult = await pool.query(`SELECT sa.esco_skill_id, es.uri, es.preferred_label, sa.confidence_score
       FROM skill_aliases sa
       JOIN esco_skills es ON sa.esco_skill_id = es.id
       WHERE LOWER(sa.alias_text) = LOWER($1)
       LIMIT 1`, [skillText]);
        if (aliasResult.rows.length > 0) {
            return {
                uri: aliasResult.rows[0].uri,
                label: aliasResult.rows[0].preferred_label,
                confidence: parseFloat(aliasResult.rows[0].confidence_score) || 0.9,
            };
        }
        // Search by label
        const skillResult = await pool.query(`SELECT uri, preferred_label,
        CASE
          WHEN LOWER(preferred_label) = LOWER($1) THEN 1.0
          WHEN LOWER(preferred_label) LIKE LOWER($1) || '%' THEN 0.9
          WHEN LOWER(preferred_label) LIKE '%' || LOWER($1) || '%' THEN 0.7
          ELSE 0.5
        END as confidence
       FROM esco_skills
       WHERE preferred_label ILIKE '%' || $1 || '%'
          OR alt_labels::text ILIKE '%' || $1 || '%'
       ORDER BY confidence DESC
       LIMIT 1`, [skillText]);
        if (skillResult.rows.length > 0) {
            return {
                uri: skillResult.rows[0].uri,
                label: skillResult.rows[0].preferred_label,
                confidence: parseFloat(skillResult.rows[0].confidence) || 0.5,
            };
        }
        return null;
    }
    /**
     * Add skill alias
     */
    async addSkillAlias(escoSkillId, aliasText, aliasType = 'synonym') {
        const result = await pool.query(`INSERT INTO skill_aliases (esco_skill_id, alias_text, alias_type, source)
       VALUES ($1, $2, $3, 'manual')
       RETURNING id`, [escoSkillId, aliasText, aliasType]);
        return result.rows[0].id;
    }
    // ===========================================================================
    // STORY 8.4: SKILL GAP ANALYSIS
    // ===========================================================================
    /**
     * Create skill gap analysis for an employee
     */
    async createSkillGapAnalysis(employeeId, targetPositionId, analysisName) {
        // Get employee skills
        const employeeSkills = await this.getEmployeeSkills(employeeId, { includeESCODetails: true });
        // Get position requirements
        const reqResult = await pool.query(`SELECT psr.*, es.preferred_label as skill_name
       FROM position_skill_requirements psr
       LEFT JOIN esco_skills es ON psr.esco_skill_id = es.id
       WHERE psr.position_id = $1 AND psr.tenant_id = $2`, [targetPositionId, this.tenantId]);
        const requirements = reqResult.rows;
        // Calculate matches and gaps
        const skillMatches = [];
        const skillGaps = [];
        let totalScore = 0;
        let totalWeight = 0;
        let coveredCount = 0;
        let proficiencySum = 0;
        for (const req of requirements) {
            const weight = parseFloat(req.weight) || 1;
            totalWeight += weight;
            const employeeSkill = employeeSkills.find((es) => es.escoSkillId === req.esco_skill_id || es.customSkillName === req.custom_skill_name);
            const skillName = req.skill_name || req.custom_skill_name || 'Unknown';
            const requiredLevel = req.minimum_proficiency || 3;
            if (employeeSkill) {
                const currentLevel = employeeSkill.proficiencyLevel;
                coveredCount++;
                proficiencySum += Math.min(currentLevel / requiredLevel, 1);
                if (currentLevel >= requiredLevel) {
                    totalScore += weight;
                    skillMatches.push({
                        skillId: req.esco_skill_id || req.custom_skill_name,
                        skillName,
                        requiredLevel,
                        currentLevel,
                        status: currentLevel > requiredLevel ? 'exceeds' : 'meets',
                    });
                }
                else {
                    totalScore += (currentLevel / requiredLevel) * weight;
                    skillGaps.push({
                        skillId: req.esco_skill_id || req.custom_skill_name,
                        skillName,
                        requiredLevel,
                        currentLevel,
                        gapSize: requiredLevel - currentLevel,
                        priority: req.requirement_type === 'essential' ? 'high' : 'medium',
                        trainingRecommendations: this.generateTrainingRecommendations(skillName, currentLevel, requiredLevel),
                    });
                }
            }
            else {
                skillGaps.push({
                    skillId: req.esco_skill_id || req.custom_skill_name,
                    skillName,
                    requiredLevel,
                    currentLevel: 0,
                    gapSize: requiredLevel,
                    priority: req.requirement_type === 'essential' ? 'high' : 'low',
                    trainingRecommendations: this.generateTrainingRecommendations(skillName, 0, requiredLevel),
                });
            }
        }
        const overallMatchScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 100;
        const coverageScore = requirements.length > 0 ? (coveredCount / requirements.length) * 100 : 100;
        const proficiencyScore = coveredCount > 0 ? (proficiencySum / coveredCount) * 100 : 0;
        // Get position name
        const posResult = await pool.query(`SELECT position_name FROM position_skill_requirements WHERE position_id = $1 LIMIT 1`, [targetPositionId]);
        const positionName = posResult.rows[0]?.position_name || 'Unknown Position';
        // Save analysis
        const result = await pool.query(`INSERT INTO skill_gap_analyses (
        tenant_id, analysis_name, analysis_type, target_entity_type, target_entity_id,
        target_position_id, target_position_name, comparison_type,
        overall_match_score, coverage_score, proficiency_score,
        skill_matches, skill_gaps, recommendations, priority_skills
      ) VALUES ($1, $2, 'individual', 'employee', $3, $4, $5, 'position_requirements',
        $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`, [
            this.tenantId,
            analysisName,
            employeeId,
            targetPositionId,
            positionName,
            Math.round(overallMatchScore * 100) / 100,
            Math.round(coverageScore * 100) / 100,
            Math.round(proficiencyScore * 100) / 100,
            JSON.stringify(skillMatches),
            JSON.stringify(skillGaps),
            JSON.stringify(this.generateRecommendations(skillGaps)),
            JSON.stringify(skillGaps.filter((g) => g.priority === 'high').slice(0, 5)),
        ]);
        return {
            id: result.rows[0].id,
            analysisName,
            analysisType: 'individual',
            targetEntityId: employeeId,
            targetPositionName: positionName,
            overallMatchScore: Math.round(overallMatchScore * 100) / 100,
            coverageScore: Math.round(coverageScore * 100) / 100,
            proficiencyScore: Math.round(proficiencyScore * 100) / 100,
            skillMatches,
            skillGaps,
            recommendations: this.generateRecommendations(skillGaps),
        };
    }
    /**
     * Generate training recommendations
     */
    generateTrainingRecommendations(skillName, currentLevel, targetLevel) {
        const recommendations = [];
        const gap = targetLevel - currentLevel;
        if (currentLevel === 0) {
            recommendations.push(`Corso introduttivo su ${skillName}`);
            recommendations.push(`Tutorial online e documentazione base`);
        }
        else if (gap === 1) {
            recommendations.push(`Corso avanzato su ${skillName}`);
            recommendations.push(`Progetto pratico per consolidare le competenze`);
        }
        else if (gap >= 2) {
            recommendations.push(`Percorso formativo intensivo su ${skillName}`);
            recommendations.push(`Mentoring con esperto interno`);
            recommendations.push(`Certificazione professionale`);
        }
        return recommendations;
    }
    /**
     * Generate overall recommendations
     */
    generateRecommendations(gaps) {
        const recommendations = [];
        const highPriorityGaps = gaps.filter((g) => g.priority === 'high');
        if (highPriorityGaps.length > 0) {
            recommendations.push(`Focus immediato su ${highPriorityGaps.length} competenze critiche: ${highPriorityGaps.map((g) => g.skillName).join(', ')}`);
        }
        if (gaps.length > 5) {
            recommendations.push('Considerare un piano di sviluppo a lungo termine (6-12 mesi)');
        }
        const avgGap = gaps.reduce((sum, g) => sum + g.gapSize, 0) / Math.max(gaps.length, 1);
        if (avgGap > 2) {
            recommendations.push('Valutare percorsi formativi strutturati o certificazioni');
        }
        return recommendations;
    }
    /**
     * Get skill gap analysis
     */
    async getSkillGapAnalysis(analysisId) {
        const result = await pool.query(`SELECT * FROM skill_gap_analyses WHERE id = $1 AND tenant_id = $2`, [analysisId, this.tenantId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            analysisName: row.analysis_name,
            analysisType: row.analysis_type,
            targetEntityId: row.target_entity_id,
            targetPositionName: row.target_position_name,
            overallMatchScore: parseFloat(row.overall_match_score),
            coverageScore: parseFloat(row.coverage_score),
            proficiencyScore: parseFloat(row.proficiency_score),
            skillMatches: row.skill_matches,
            skillGaps: row.skill_gaps,
            recommendations: row.recommendations,
        };
    }
    /**
     * List skill gap analyses
     */
    async listSkillGapAnalyses(options) {
        const conditions = ['tenant_id = $1'];
        const values = [this.tenantId];
        let paramIndex = 2;
        if (options.entityType) {
            conditions.push(`target_entity_type = $${paramIndex}`);
            values.push(options.entityType);
            paramIndex++;
        }
        if (options.entityId) {
            conditions.push(`target_entity_id = $${paramIndex}`);
            values.push(options.entityId);
            paramIndex++;
        }
        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM skill_gap_analyses ${whereClause}`, values);
        values.push(options.limit || 20, options.offset || 0);
        const result = await pool.query(`SELECT id, analysis_name, analysis_type, target_entity_type, target_entity_id,
        target_position_name, overall_match_score, coverage_score, analysis_date, created_at
       FROM skill_gap_analyses ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, values);
        return {
            analyses: result.rows,
            total: parseInt(countResult.rows[0].total),
        };
    }
    /**
     * Generate team skill matrix
     */
    async generateSkillMatrix(entityType, entityId, matrixName) {
        // Get employees for this entity
        const employeesResult = await pool.query(`SELECT id, first_name, last_name FROM employees
       WHERE tenant_id = $1 AND ${entityType === 'department' ? 'org_unit_id' : 'id'} = $2
       AND status = 'active'`, [this.tenantId, entityId]);
        const employees = employeesResult.rows;
        const skillCoverage = {};
        // Aggregate skills
        for (const emp of employees) {
            const skills = await this.getEmployeeSkills(emp.id, { includeESCODetails: true });
            for (const skill of skills) {
                const skillKey = skill.escoSkillId || skill.customSkillName || 'unknown';
                if (!skillCoverage[skillKey]) {
                    skillCoverage[skillKey] = { count: 0, totalProficiency: 0, maxProficiency: 0 };
                }
                skillCoverage[skillKey].count++;
                skillCoverage[skillKey].totalProficiency += skill.proficiencyLevel;
                skillCoverage[skillKey].maxProficiency = Math.max(skillCoverage[skillKey].maxProficiency, skill.proficiencyLevel);
            }
        }
        // Format coverage data
        const coverageData = {};
        for (const [key, data] of Object.entries(skillCoverage)) {
            coverageData[key] = {
                count: data.count,
                avgProficiency: Math.round((data.totalProficiency / data.count) * 100) / 100,
                maxProficiency: data.maxProficiency,
            };
        }
        // Top skills
        const sortedSkills = Object.entries(coverageData).sort((a, b) => b[1].count - a[1].count);
        const topSkills = sortedSkills.slice(0, 10).map(([skillId, data]) => ({ skillId, ...data }));
        const rareSkills = sortedSkills.filter(([_, data]) => data.count === 1).slice(0, 10);
        const result = await pool.query(`INSERT INTO skill_matrices (
        tenant_id, matrix_name, matrix_type, entity_type, entity_id,
        total_employees, total_skills, skill_coverage, top_skills, rare_skills
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`, [
            this.tenantId,
            matrixName,
            entityType,
            entityType,
            entityId,
            employees.length,
            Object.keys(skillCoverage).length,
            JSON.stringify(coverageData),
            JSON.stringify(topSkills),
            JSON.stringify(rareSkills),
        ]);
        return result.rows[0].id;
    }
    // ===========================================================================
    // STORY 8.5: MARKET BENCHMARK DASHBOARD
    // ===========================================================================
    /**
     * Get benchmark configurations
     */
    async getBenchmarkConfigs() {
        const result = await pool.query(`SELECT * FROM benchmark_configs
       WHERE tenant_id IS NULL OR tenant_id = $1
       ORDER BY is_default DESC, config_name`, [this.tenantId]);
        return result.rows;
    }
    /**
     * Create benchmark report
     */
    async createBenchmarkReport(configId, reportName, reportType) {
        // Get config if provided
        let filters = {};
        if (configId) {
            const configResult = await pool.query(`SELECT * FROM benchmark_configs WHERE id = $1`, [
                configId,
            ]);
            if (configResult.rows.length > 0) {
                filters = {
                    industries: configResult.rows[0].industries,
                    countries: configResult.rows[0].countries,
                    regions: configResult.rows[0].regions,
                    experienceLevels: configResult.rows[0].experience_levels,
                };
            }
        }
        let reportData = {};
        switch (reportType) {
            case 'salary_benchmark':
                reportData = await this.generateSalaryBenchmark(filters);
                break;
            case 'skill_demand':
                reportData = await this.generateSkillDemandReport(filters);
                break;
            case 'talent_availability':
                reportData = await this.generateTalentAvailabilityReport(filters);
                break;
        }
        const result = await pool.query(`INSERT INTO benchmark_reports (
        tenant_id, config_id, report_name, report_type,
        salary_benchmarks, salary_percentiles, trending_skills,
        declining_skills, emerging_skills, skill_demand_scores,
        talent_supply, recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`, [
            this.tenantId,
            configId,
            reportName,
            reportType,
            JSON.stringify(reportData.salaryBenchmarks || {}),
            JSON.stringify(reportData.salaryPercentiles || {}),
            JSON.stringify(reportData.trendingSkills || []),
            JSON.stringify(reportData.decliningSkills || []),
            JSON.stringify(reportData.emergingSkills || []),
            JSON.stringify(reportData.skillDemandScores || {}),
            JSON.stringify(reportData.talentSupply || {}),
            JSON.stringify(reportData.recommendations || []),
        ]);
        return result.rows[0].id;
    }
    /**
     * Generate salary benchmark data
     */
    async generateSalaryBenchmark(filters) {
        const conditions = ['is_active = true', 'salary_min IS NOT NULL'];
        const values = [];
        let paramIndex = 1;
        if (filters.countries && filters.countries.length > 0) {
            conditions.push(`country_code = ANY($${paramIndex})`);
            values.push(filters.countries);
            paramIndex++;
        }
        if (filters.industries && filters.industries.length > 0) {
            conditions.push(`industry = ANY($${paramIndex})`);
            values.push(filters.industries);
            paramIndex++;
        }
        const result = await pool.query(`SELECT
        experience_level,
        COUNT(*) as job_count,
        AVG(salary_min) as avg_min,
        AVG(salary_max) as avg_max,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary_min) as p25,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_min) as p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary_min) as p75,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY salary_min) as p90
       FROM job_market_postings
       WHERE ${conditions.join(' AND ')}
       GROUP BY experience_level`, values);
        const benchmarks = {};
        const percentiles = {};
        for (const row of result.rows) {
            const level = row.experience_level || 'unknown';
            benchmarks[level] = {
                avgMin: Math.round(parseFloat(row.avg_min) || 0),
                avgMax: Math.round(parseFloat(row.avg_max) || 0),
                jobCount: parseInt(row.job_count),
            };
            percentiles[level] = {
                p25: Math.round(parseFloat(row.p25) || 0),
                p50: Math.round(parseFloat(row.p50) || 0),
                p75: Math.round(parseFloat(row.p75) || 0),
                p90: Math.round(parseFloat(row.p90) || 0),
            };
        }
        return {
            salaryBenchmarks: benchmarks,
            salaryPercentiles: percentiles,
            recommendations: [
                'I dati di benchmark sono basati sulle offerte di lavoro attive nel mercato',
                'Considerare fattori locali e dimensione aziendale per calibrare le retribuzioni',
            ],
        };
    }
    /**
     * Generate skill demand report
     */
    async generateSkillDemandReport(_filters) {
        const trendingOptions = {
            days: 30,
            limit: 20,
        };
        const countries = _filters.countries;
        const industries = _filters.industries;
        if (countries?.[0])
            trendingOptions.countryCode = countries[0];
        if (industries?.[0])
            trendingOptions.industry = industries[0];
        const trendingSkills = await this.getTrendingSkills(trendingOptions);
        return {
            trendingSkills: trendingSkills.filter((s) => s.trendDirection === 'up'),
            decliningSkills: trendingSkills.filter((s) => s.trendDirection === 'down'),
            emergingSkills: trendingSkills.filter((s) => s.growthRate > 50),
            skillDemandScores: Object.fromEntries(trendingSkills.map((s) => [s.skillUri, s.demandScore])),
            recommendations: [
                `Le competenze più richieste sono: ${trendingSkills
                    .slice(0, 3)
                    .map((s) => s.skillName)
                    .join(', ')}`,
                'Investire in formazione sulle competenze emergenti per rimanere competitivi',
            ],
        };
    }
    /**
     * Generate talent availability report
     */
    async generateTalentAvailabilityReport(_filters) {
        // Get skill distribution from employees
        const skillResult = await pool.query(`SELECT
        COALESCE(es.esco_skill_id::text, ems.custom_skill_name) as skill_id,
        COUNT(DISTINCT ems.employee_id) as employee_count,
        AVG(ems.proficiency_level) as avg_proficiency
       FROM employee_skills ems
       LEFT JOIN esco_skills es ON ems.esco_skill_id = es.id
       WHERE ems.tenant_id = $1
       GROUP BY COALESCE(es.esco_skill_id::text, ems.custom_skill_name)
       ORDER BY employee_count DESC
       LIMIT 20`, [this.tenantId]);
        const talentSupply = {};
        for (const row of skillResult.rows) {
            talentSupply[row.skill_id] = {
                employeeCount: parseInt(row.employee_count),
                avgProficiency: Math.round(parseFloat(row.avg_proficiency) * 100) / 100,
            };
        }
        return {
            talentSupply,
            recommendations: [
                'Analizzare le competenze interne vs richieste del mercato',
                'Identificare gap critici per pianificare assunzioni o formazione',
            ],
        };
    }
    /**
     * Get benchmark report
     */
    async getBenchmarkReport(reportId) {
        const result = await pool.query(`SELECT * FROM benchmark_reports WHERE id = $1 AND tenant_id = $2`, [reportId, this.tenantId]);
        return result.rows[0] || null;
    }
    /**
     * List benchmark reports
     */
    async listBenchmarkReports(options) {
        const conditions = ['tenant_id = $1'];
        const values = [this.tenantId];
        let paramIndex = 2;
        if (options.reportType) {
            conditions.push(`report_type = $${paramIndex}`);
            values.push(options.reportType);
            paramIndex++;
        }
        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM benchmark_reports ${whereClause}`, values);
        values.push(options.limit || 20, options.offset || 0);
        const result = await pool.query(`SELECT id, config_id, report_name, report_type, report_date, created_at
       FROM benchmark_reports ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, values);
        return {
            reports: result.rows,
            total: parseInt(countResult.rows[0].total),
        };
    }
    // ===========================================================================
    // HELPER METHODS
    // ===========================================================================
    mapESCOSkill(row) {
        return {
            id: row.id,
            uri: row.esco_uri,
            preferredLabel: row.preferred_label,
            altLabels: row.alt_labels || [],
            description: row.description,
            skillType: row.skill_type,
            reuseLevel: row.reuse_level,
            isDigital: false, // Not in current schema
            isGreen: false, // Not in current schema
            broaderUri: (row.broader_skills || [])[0] || null,
            narrowerUris: row.narrower_skills || [],
            relatedUris: [], // Not directly in current schema
            iscoGroups: row.isco_groups || [],
        };
    }
    mapESCOOccupation(row) {
        return {
            id: row.id,
            uri: row.esco_uri,
            preferredLabel: row.preferred_label,
            altLabels: row.alt_labels || [],
            description: row.description,
            iscoGroup: row.isco_group,
            essentialSkills: row.essential_skills || [],
            optionalSkills: row.optional_skills || [],
        };
    }
}
//# sourceMappingURL=hr-intelligence.js.map