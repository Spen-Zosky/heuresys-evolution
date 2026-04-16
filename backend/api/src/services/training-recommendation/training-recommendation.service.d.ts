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
export declare class TrainingRecommendationService {
    private pool;
    constructor(pool: Pool);
    getRecommendationsForEmployee(tenantId: string, employeeId: string, options?: RecommendationOptions): Promise<TrainingRecommendation>;
    private getEmployeeInfo;
    private getEmployeeSkillGaps;
    private calculateSkillGaps;
    private getCoursesForSkillGaps;
    private getLearningPathRecommendations;
    searchCoursesBySkillEmbedding(tenantId: string, skillQuery: string, limit?: number): Promise<Course[]>;
    getCourseCompletionRates(tenantId: string, courseIds: string[]): Promise<Map<string, number>>;
    getEmployeePreferences(_tenantId: string, employeeId: string): Promise<{
        preferred_delivery_methods: string[];
        preferred_language: string;
        preferred_duration_range: {
            min: number;
            max: number;
        };
    }>;
    private calculatePriority;
    private generateReason;
    private calculateSummary;
}
export default TrainingRecommendationService;
//# sourceMappingURL=training-recommendation.service.d.ts.map