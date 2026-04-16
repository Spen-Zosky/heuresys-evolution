/**
 * Training Recommendation Service
 * Sprint 2025-04 - S-ONTO-03-08
 *
 * Provides intelligent training recommendations based on:
 * - Skill gaps from gap analysis
 * - Course-skill mappings via embeddings
 * - Historical completion rates
 * - Delivery method preferences
 */

import { Pool } from 'pg';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface SkillGap {
  skill_id: string;
  skill_name: string;
  current_level: number;
  required_level: number;
  gap: number;
  importance: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  course_type: string;
  category: string | null;
  duration_hours: number | null;
  skill_level: string;
  provider: string | null;
  provider_url: string | null;
  is_mandatory: boolean;
  is_certification: boolean;
  language: string;
  status: string;
}

interface CourseRecommendation {
  course: Course;
  relevance_score: number;
  skill_coverage: SkillCoverage[];
  estimated_impact: number;
  priority: string;
  reason: string;
}

interface SkillCoverage {
  skill_id: string;
  skill_name: string;
  proficiency_gained: number;
  gap_coverage_pct: number;
}

interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  target_role: string | null;
  estimated_duration_hours: number | null;
  courses: LearningPathCourse[];
}

interface LearningPathCourse {
  course_id: string;
  course_title: string;
  sequence_order: number;
  is_mandatory: boolean;
}

interface LearningPathRecommendation {
  learning_path: LearningPath;
  relevance_score: number;
  skill_coverage_pct: number;
  estimated_completion_weeks: number;
}

interface TrainingRecommendation {
  employee_id: string;
  employee_name: string;
  current_role: string | null;
  skill_gaps: SkillGap[];
  course_recommendations: CourseRecommendation[];
  learning_path_recommendations: LearningPathRecommendation[];
  summary: RecommendationSummary;
}

interface RecommendationSummary {
  total_skill_gaps: number;
  high_priority_gaps: number;
  recommended_courses: number;
  recommended_learning_paths: number;
  estimated_training_hours: number;
  estimated_weeks_to_close_gaps: number;
}

interface RecommendationOptions {
  max_courses?: number;
  max_learning_paths?: number;
  preferred_delivery_methods?: string[];
  preferred_language?: string;
  max_duration_hours?: number;
  include_completed?: boolean;
  target_skills?: string[];
}

// --------------------------------------------------------------------------
// Service Class
// --------------------------------------------------------------------------

export class TrainingRecommendationService {
  constructor(private pool: Pool) {}

  // --------------------------------------------------------------------------
  // Get Training Recommendations for Employee
  // --------------------------------------------------------------------------

  async getRecommendationsForEmployee(
    tenantId: string,
    employeeId: string,
    options: RecommendationOptions = {}
  ): Promise<TrainingRecommendation> {
    const {
      max_courses = 10,
      max_learning_paths = 3,
      preferred_delivery_methods = [],
      preferred_language,
      max_duration_hours,
      include_completed = false,
      target_skills = []
    } = options;

    // Get employee info
    const employee = await this.getEmployeeInfo(tenantId, employeeId);

    // Get skill gaps from gap analysis
    const skillGaps = await this.getEmployeeSkillGaps(tenantId, employeeId, target_skills);

    // Get course recommendations based on skill gaps
    const courseRecommendations = await this.getCoursesForSkillGaps(
      tenantId,
      employeeId,
      skillGaps,
      {
        max_courses,
        preferred_delivery_methods,
        ...(preferred_language ? { preferred_language } : {}),
        ...(max_duration_hours !== undefined ? { max_duration_hours } : {}),
        include_completed
      }
    );

    // Get learning path recommendations
    const learningPathRecommendations = await this.getLearningPathRecommendations(
      tenantId,
      employeeId,
      skillGaps,
      max_learning_paths
    );

    // Calculate summary
    const summary = this.calculateSummary(
      skillGaps,
      courseRecommendations,
      learningPathRecommendations
    );

    return {
      employee_id: employeeId,
      employee_name: employee.name,
      current_role: employee.job_title,
      skill_gaps: skillGaps,
      course_recommendations: courseRecommendations,
      learning_path_recommendations: learningPathRecommendations,
      summary
    };
  }

  // --------------------------------------------------------------------------
  // Get Employee Info
  // --------------------------------------------------------------------------

  private async getEmployeeInfo(tenantId: string, employeeId: string): Promise<{ name: string; job_title: string | null }> {
    const result = await this.pool.query(`
      SELECT
        first_name || ' ' || last_name as name,
        job_title
      FROM employees
      WHERE id = $1 AND tenant_id = $2
    `, [employeeId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Employee not found');
    }

    return result.rows[0];
  }

  // --------------------------------------------------------------------------
  // Get Employee Skill Gaps
  // --------------------------------------------------------------------------

  private async getEmployeeSkillGaps(
    tenantId: string,
    employeeId: string,
    targetSkills: string[] = []
  ): Promise<SkillGap[]> {
    // First try to get from stored gap analysis (skill_gaps is JSONB array)
    const gapsQuery = `
      SELECT
        skill_gaps,
        created_at
      FROM skill_gap_analyses
      WHERE target_entity_type = 'employee'
        AND target_entity_id = $1
        AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(gapsQuery, [employeeId, tenantId]);

    if (result.rows.length > 0 && result.rows[0].skill_gaps) {
      const gaps = result.rows[0].skill_gaps as Array<{
        skill_id: string;
        skill_name: string;
        current_level: number;
        required_level: number;
        gap: number;
        importance?: string;
      }>;

      // Filter by target skills if provided
      let filteredGaps = gaps;
      if (targetSkills.length > 0) {
        filteredGaps = gaps.filter(g => targetSkills.includes(g.skill_id));
      }

      return filteredGaps.slice(0, 20).map(g => ({
        skill_id: g.skill_id,
        skill_name: g.skill_name,
        current_level: g.current_level || 0,
        required_level: g.required_level || 0,
        gap: g.gap || (g.required_level - g.current_level),
        importance: g.importance || 'important'
      }));
    }

    // If no stored gaps, calculate from role requirements vs employee skills
    return this.calculateSkillGaps(tenantId, employeeId);
  }

  // --------------------------------------------------------------------------
  // Calculate Skill Gaps (fallback)
  // --------------------------------------------------------------------------

  private async calculateSkillGaps(tenantId: string, employeeId: string): Promise<SkillGap[]> {
    // Try to get skill gaps by comparing employee skills with their position requirements
    const result = await this.pool.query(`
      WITH employee_position AS (
        SELECT position_id, job_title FROM employees WHERE id = $1 AND tenant_id = $2
      ),
      -- Get skills associated with the employee's position/job title via tenant_jobs
      position_skills AS (
        SELECT
          COALESCE(tjs.source_skill_id, es.id) as skill_id,
          COALESCE(es.preferred_label_en, tjs.skill_name_en, tjs.skill_name_it) as skill_name,
          COALESCE(tjs.required_level, 3) as required_level,
          COALESCE(tjs.importance, 'important')::text as importance
        FROM tenant_job_skills tjs
        LEFT JOIN esco_skills es ON es.uri = tjs.esco_skill_uri OR es.id = tjs.source_skill_id
        JOIN tenant_jobs tj ON tjs.tenant_job_id = tj.id
        JOIN employee_position ep ON tj.id::text = ep.position_id OR tj.title_it = ep.job_title OR tj.title_en = ep.job_title
        WHERE tj.tenant_id = $2
      ),
      employee_skills AS (
        SELECT
          skill_id,
          COALESCE(composite_score, 0) as current_level
        FROM employee_skill_profiles
        WHERE employee_id = $1 AND tenant_id = $2
      )
      SELECT
        ps.skill_id,
        ps.skill_name,
        COALESCE(es.current_level, 0)::numeric as current_level,
        ps.required_level,
        (ps.required_level - COALESCE(es.current_level, 0))::numeric as gap,
        ps.importance
      FROM position_skills ps
      LEFT JOIN employee_skills es ON es.skill_id = ps.skill_id
      WHERE ps.required_level > COALESCE(es.current_level, 0)
      ORDER BY (ps.required_level - COALESCE(es.current_level, 0)) DESC
      LIMIT 20
    `, [employeeId, tenantId]);

    // If no gaps found through position matching, return empty (no recommendations)
    return result.rows;
  }

  // --------------------------------------------------------------------------
  // Get Courses for Skill Gaps
  // --------------------------------------------------------------------------

  private async getCoursesForSkillGaps(
    tenantId: string,
    employeeId: string,
    skillGaps: SkillGap[],
    options: {
      max_courses: number;
      preferred_delivery_methods: string[];
      preferred_language?: string;
      max_duration_hours?: number;
      include_completed: boolean;
    }
  ): Promise<CourseRecommendation[]> {
    if (skillGaps.length === 0) {
      return [];
    }

    const skillIds = skillGaps.map(g => g.skill_id);

    // Get courses that cover these skills
    let query = `
      WITH skill_gaps AS (
        SELECT * FROM unnest($1::uuid[], $2::text[], $3::numeric[], $4::text[])
        AS t(skill_id, skill_name, gap, importance)
      ),
      course_skills AS (
        SELECT
          c.id as course_id,
          c.code,
          c.title,
          c.description,
          c.course_type,
          c.category,
          c.duration_hours,
          c.skill_level,
          c.provider,
          c.provider_url,
          c.is_mandatory,
          c.is_certification,
          c.language,
          c.status,
          ces.esco_skill_uri,
          ces.skill_name as course_skill_name,
          ces.proficiency_level_gained,
          ces.is_primary
        FROM courses c
        JOIN course_esco_skills ces ON ces.course_id = c.id
        WHERE c.tenant_id = $5
        AND c.status = 'published'
    `;

    const params: (string | string[] | number[] | number)[] = [
      skillIds,
      skillGaps.map(g => g.skill_name),
      skillGaps.map(g => g.gap),
      skillGaps.map(g => g.importance),
      tenantId
    ];

    let paramIndex = 6;

    if (options.preferred_delivery_methods.length > 0) {
      query += ` AND c.course_type = ANY($${paramIndex}::text[])`;
      params.push(options.preferred_delivery_methods);
      paramIndex++;
    }

    if (options.preferred_language) {
      query += ` AND c.language = $${paramIndex}`;
      params.push(options.preferred_language);
      paramIndex++;
    }

    if (options.max_duration_hours) {
      query += ` AND c.duration_hours <= $${paramIndex}`;
      params.push(options.max_duration_hours);
      paramIndex++;
    }

    query += `
      ),
      -- Find courses that match gap skills via ESCO URI or skill name
      matching_courses AS (
        -- Match by skill_id when available
        SELECT
          cs.*,
          sg.skill_id as gap_skill_id,
          sg.skill_name as gap_skill_name,
          sg.gap,
          sg.importance
        FROM course_skills cs
        JOIN esco_skills es ON es.uri = cs.esco_skill_uri
        JOIN skill_gaps sg ON sg.skill_id IS NOT NULL AND sg.skill_id = es.id

        UNION ALL

        -- Match by skill name when skill_id is null (using fuzzy matching)
        SELECT
          cs.*,
          sg.skill_id as gap_skill_id,
          sg.skill_name as gap_skill_name,
          sg.gap,
          sg.importance
        FROM course_skills cs
        JOIN skill_gaps sg ON sg.skill_id IS NULL
          AND (
            LOWER(cs.course_skill_name) ILIKE '%' || LOWER(sg.skill_name) || '%'
            OR LOWER(sg.skill_name) ILIKE '%' || LOWER(cs.course_skill_name) || '%'
          )
      ),
      -- Score and aggregate courses
      scored_courses AS (
        SELECT
          course_id,
          code,
          title,
          description,
          course_type,
          category,
          duration_hours,
          skill_level,
          provider,
          provider_url,
          is_mandatory,
          is_certification,
          language,
          status,
          COUNT(DISTINCT COALESCE(gap_skill_id::text, gap_skill_name)) as skills_covered,
          SUM(gap) as total_gap_covered,
          SUM(CASE WHEN importance = 'critical' THEN 2 ELSE 1 END) as weighted_score,
          json_agg(json_build_object(
            'skill_id', gap_skill_id,
            'skill_name', gap_skill_name,
            'proficiency_gained', proficiency_level_gained,
            'gap_coverage_pct', LEAST(100, (proficiency_level_gained::numeric / NULLIF(gap, 0)) * 100)
          )) as skill_coverage
        FROM matching_courses
        GROUP BY course_id, code, title, description, course_type, category,
                 duration_hours, skill_level, provider, provider_url,
                 is_mandatory, is_certification, language, status
      )
      SELECT
        sc.*,
        (sc.skills_covered * 0.4 + sc.weighted_score * 0.6) as relevance_score
      FROM scored_courses sc
    `;

    // Exclude completed courses if requested
    if (!options.include_completed) {
      query += `
        WHERE NOT EXISTS (
          SELECT 1 FROM course_enrollments ce
          WHERE ce.course_id = sc.course_id
          AND ce.employee_id = $${paramIndex}
          AND ce.status = 'completed'
        )
      `;
      params.push(employeeId);
      paramIndex++;
    }

    query += `
      ORDER BY relevance_score DESC
      LIMIT $${paramIndex}
    `;
    params.push(options.max_courses);

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      course: {
        id: row.course_id,
        code: row.code,
        title: row.title,
        description: row.description,
        course_type: row.course_type,
        category: row.category,
        duration_hours: row.duration_hours,
        skill_level: row.skill_level,
        provider: row.provider,
        provider_url: row.provider_url,
        is_mandatory: row.is_mandatory,
        is_certification: row.is_certification,
        language: row.language,
        status: row.status
      },
      relevance_score: parseFloat(row.relevance_score) || 0,
      skill_coverage: row.skill_coverage || [],
      estimated_impact: row.skills_covered / skillGaps.length,
      priority: this.calculatePriority(row.weighted_score, row.skills_covered),
      reason: this.generateReason(row.skills_covered, row.skill_coverage)
    }));
  }

  // --------------------------------------------------------------------------
  // Get Learning Path Recommendations
  // --------------------------------------------------------------------------

  private async getLearningPathRecommendations(
    tenantId: string,
    _employeeId: string, // Reserved for future: exclude enrolled paths
    skillGaps: SkillGap[],
    maxPaths: number
  ): Promise<LearningPathRecommendation[]> {
    if (skillGaps.length === 0) {
      return [];
    }

    // Get learning paths with skill coverage
    const result = await this.pool.query(`
      WITH path_skills AS (
        SELECT
          lp.id as path_id,
          lp.title,
          lp.description,
          lp.target_role,
          lp.estimated_duration_hours,
          COUNT(DISTINCT ces.esco_skill_uri) as total_skills,
          COUNT(DISTINCT CASE WHEN es.id = ANY($1::uuid[]) THEN ces.esco_skill_uri END) as matching_skills
        FROM learning_paths lp
        JOIN learning_path_courses lpc ON lpc.learning_path_id = lp.id
        JOIN course_esco_skills ces ON ces.course_id = lpc.course_id
        LEFT JOIN esco_skills es ON es.uri = ces.esco_skill_uri
        WHERE lp.tenant_id = $2 AND lp.is_active = true
        GROUP BY lp.id, lp.title, lp.description, lp.target_role, lp.estimated_duration_hours
        HAVING COUNT(DISTINCT CASE WHEN es.id = ANY($1::uuid[]) THEN ces.esco_skill_uri END) > 0
      ),
      path_courses AS (
        SELECT
          lpc.learning_path_id,
          json_agg(json_build_object(
            'course_id', c.id,
            'course_title', c.title,
            'sequence_order', lpc.sequence_order,
            'is_mandatory', lpc.is_mandatory
          ) ORDER BY lpc.sequence_order) as courses
        FROM learning_path_courses lpc
        JOIN courses c ON c.id = lpc.course_id
        GROUP BY lpc.learning_path_id
      )
      SELECT
        ps.*,
        pc.courses,
        (ps.matching_skills::numeric / NULLIF(ps.total_skills, 0)) as skill_coverage_pct,
        CEIL(ps.estimated_duration_hours / 8) as estimated_completion_weeks
      FROM path_skills ps
      LEFT JOIN path_courses pc ON pc.learning_path_id = ps.path_id
      ORDER BY ps.matching_skills DESC, skill_coverage_pct DESC
      LIMIT $3
    `, [skillGaps.map(g => g.skill_id), tenantId, maxPaths]);

    return result.rows.map(row => ({
      learning_path: {
        id: row.path_id,
        title: row.title,
        description: row.description,
        target_role: row.target_role,
        estimated_duration_hours: row.estimated_duration_hours,
        courses: row.courses || []
      },
      relevance_score: row.matching_skills / skillGaps.length,
      skill_coverage_pct: parseFloat(row.skill_coverage_pct) * 100 || 0,
      estimated_completion_weeks: row.estimated_completion_weeks || 0
    }));
  }

  // --------------------------------------------------------------------------
  // Semantic Course Search (Embedding-based)
  // --------------------------------------------------------------------------

  async searchCoursesBySkillEmbedding(
    tenantId: string,
    skillQuery: string,
    limit: number = 10
  ): Promise<Course[]> {
    // Use semantic search if embeddings are available
    const result = await this.pool.query(`
      WITH query_embedding AS (
        SELECT embedding_en as embedding
        FROM esco_skills
        WHERE preferred_label_en ILIKE $1 || '%'
        AND embedding_en IS NOT NULL
        LIMIT 1
      )
      SELECT
        c.id, c.code, c.title, c.description, c.course_type, c.category,
        c.duration_hours, c.skill_level, c.provider, c.provider_url,
        c.is_mandatory, c.is_certification, c.language, c.status,
        1 - (es.embedding_en <=> (SELECT embedding FROM query_embedding)) as similarity
      FROM courses c
      JOIN course_esco_skills ces ON ces.course_id = c.id
      JOIN esco_skills es ON es.uri = ces.esco_skill_uri
      WHERE c.tenant_id = $2 AND c.status = 'published'
      AND es.embedding_en IS NOT NULL
      AND EXISTS (SELECT 1 FROM query_embedding)
      ORDER BY similarity DESC
      LIMIT $3
    `, [skillQuery, tenantId, limit]);

    return result.rows;
  }

  // --------------------------------------------------------------------------
  // Get Course Completion Rates
  // --------------------------------------------------------------------------

  async getCourseCompletionRates(tenantId: string, courseIds: string[]): Promise<Map<string, number>> {
    const result = await this.pool.query(`
      SELECT
        c.id as course_id,
        COUNT(ce.id) FILTER (WHERE ce.status = 'completed') as completed,
        COUNT(ce.id) as total
      FROM courses c
      LEFT JOIN course_enrollments ce ON ce.course_id = c.id
      WHERE c.id = ANY($1) AND c.tenant_id = $2
      GROUP BY c.id
    `, [courseIds, tenantId]);

    const rates = new Map<string, number>();
    for (const row of result.rows) {
      const rate = row.total > 0 ? row.completed / row.total : 0;
      rates.set(row.course_id, rate);
    }
    return rates;
  }

  // --------------------------------------------------------------------------
  // Get Employee Preferences
  // --------------------------------------------------------------------------

  async getEmployeePreferences(_tenantId: string, employeeId: string): Promise<{
    preferred_delivery_methods: string[];
    preferred_language: string;
    preferred_duration_range: { min: number; max: number };
  }> {
    // Get from completed courses (tenantId reserved for future tenant-specific preferences)
    const result = await this.pool.query(`
      SELECT
        MODE() WITHIN GROUP (ORDER BY c.course_type) as preferred_type,
        MODE() WITHIN GROUP (ORDER BY c.language) as preferred_language,
        AVG(c.duration_hours) as avg_duration
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE ce.employee_id = $1 AND ce.status = 'completed'
    `, [employeeId]);

    const row = result.rows[0];
    return {
      preferred_delivery_methods: row?.preferred_type ? [row.preferred_type] : [],
      preferred_language: row?.preferred_language || 'it',
      preferred_duration_range: {
        min: 0,
        max: row?.avg_duration ? Math.ceil(row.avg_duration * 1.5) : 40
      }
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private calculatePriority(weightedScore: number, skillsCovered: number): string {
    const score = weightedScore + skillsCovered;
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private generateReason(skillsCovered: number, skillCoverage: SkillCoverage[]): string {
    if (skillsCovered === 0) return 'General skill development';
    if (skillsCovered === 1) return `Addresses ${skillCoverage[0]?.skill_name || 'skill'} gap`;
    return `Covers ${skillsCovered} skill gaps`;
  }

  private calculateSummary(
    skillGaps: SkillGap[],
    courseRecommendations: CourseRecommendation[],
    learningPathRecommendations: LearningPathRecommendation[]
  ): RecommendationSummary {
    const totalHours = courseRecommendations.reduce(
      (sum, r) => sum + (parseFloat(String(r.course.duration_hours)) || 0),
      0
    );

    const highPriorityGaps = skillGaps.filter(g => g.importance === 'critical').length;

    return {
      total_skill_gaps: skillGaps.length,
      high_priority_gaps: highPriorityGaps,
      recommended_courses: courseRecommendations.length,
      recommended_learning_paths: learningPathRecommendations.length,
      estimated_training_hours: totalHours,
      estimated_weeks_to_close_gaps: Math.ceil(totalHours / 8) // 8 hours per week
    };
  }
}

export default TrainingRecommendationService;
