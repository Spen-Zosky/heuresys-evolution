/**
 * Zod Schemas for Talent & Career Routes
 * Covers: career-coach, career-paths, gap-analysis, internal-mobility
 */
import { z } from 'zod';
export declare const updateCareerProfileSchema: z.ZodObject<{
    career_aspiration: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    mobility_preference: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    career_aspiration?: string | null | undefined;
    mobility_preference?: string | null | undefined;
}, {
    career_aspiration?: string | null | undefined;
    mobility_preference?: string | null | undefined;
}>;
export declare const createCareerSkillSchema: z.ZodObject<{
    skill_name: z.ZodString;
    proficiency: z.ZodNumber;
    evidence_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    skill_name: string;
    proficiency: number;
    evidence_notes?: string | null | undefined;
}, {
    skill_name: string;
    proficiency: number;
    evidence_notes?: string | null | undefined;
}>;
export declare const createCareerGoalSchema: z.ZodObject<{
    target_role: z.ZodString;
    target_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    motivation: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    milestones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        due_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        type?: string | undefined;
        due_date?: string | null | undefined;
    }, {
        title: string;
        type?: string | undefined;
        due_date?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    target_role: string;
    target_date?: string | null | undefined;
    motivation?: string | null | undefined;
    milestones?: {
        title: string;
        type?: string | undefined;
        due_date?: string | null | undefined;
    }[] | undefined;
}, {
    target_role: string;
    target_date?: string | null | undefined;
    motivation?: string | null | undefined;
    milestones?: {
        title: string;
        type?: string | undefined;
        due_date?: string | null | undefined;
    }[] | undefined;
}>;
export declare const updateCareerGoalSchema: z.ZodObject<{
    target_role: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    target_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    motivation: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["active", "completed", "paused", "abandoned"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "completed" | "paused" | "abandoned" | undefined;
    target_date?: string | null | undefined;
    target_role?: string | undefined;
    motivation?: string | null | undefined;
}, {
    status?: "active" | "completed" | "paused" | "abandoned" | undefined;
    target_date?: string | null | undefined;
    target_role?: string | undefined;
    motivation?: string | null | undefined;
}>;
export declare const createGoalMilestoneSchema: z.ZodObject<{
    title: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    due_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    type?: string | undefined;
    due_date?: string | null | undefined;
}, {
    title: string;
    type?: string | undefined;
    due_date?: string | null | undefined;
}>;
export declare const createCareerPathSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    department: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    path_type: z.ZodOptional<z.ZodEnum<["linear", "branching", "matrix"]>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    created_by_employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    department?: string | null | undefined;
    is_active?: boolean | undefined;
    path_type?: "linear" | "branching" | "matrix" | undefined;
    created_by_employee_id?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    department?: string | null | undefined;
    is_active?: boolean | undefined;
    path_type?: "linear" | "branching" | "matrix" | undefined;
    created_by_employee_id?: string | null | undefined;
}>;
export declare const updateCareerPathSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    department: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    path_type: z.ZodOptional<z.ZodOptional<z.ZodEnum<["linear", "branching", "matrix"]>>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    department?: string | null | undefined;
    is_active?: boolean | undefined;
    path_type?: "linear" | "branching" | "matrix" | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    department?: string | null | undefined;
    is_active?: boolean | undefined;
    path_type?: "linear" | "branching" | "matrix" | undefined;
}>;
export declare const addLevelSkillSchema: z.ZodObject<{
    skill_id: z.ZodString;
    importance: z.ZodOptional<z.ZodEnum<["essential", "important", "nice_to_have"]>>;
    is_mandatory: z.ZodOptional<z.ZodBoolean>;
    weight: z.ZodOptional<z.ZodNumber>;
    required_knowledge_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    required_skill_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    required_ability_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    required_behavior_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    required_attitude_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    min_composite_score: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    skill_id: string;
    notes?: string | null | undefined;
    weight?: number | undefined;
    is_mandatory?: boolean | undefined;
    importance?: "important" | "nice_to_have" | "essential" | undefined;
    required_knowledge_level?: number | null | undefined;
    required_skill_level?: number | null | undefined;
    required_ability_level?: number | null | undefined;
    required_behavior_level?: number | null | undefined;
    required_attitude_level?: number | null | undefined;
    min_composite_score?: number | null | undefined;
}, {
    skill_id: string;
    notes?: string | null | undefined;
    weight?: number | undefined;
    is_mandatory?: boolean | undefined;
    importance?: "important" | "nice_to_have" | "essential" | undefined;
    required_knowledge_level?: number | null | undefined;
    required_skill_level?: number | null | undefined;
    required_ability_level?: number | null | undefined;
    required_behavior_level?: number | null | undefined;
    required_attitude_level?: number | null | undefined;
    min_composite_score?: number | null | undefined;
}>;
export declare const simulateCareerPathSchema: z.ZodObject<{
    employee_id: z.ZodString;
    target_path_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    target_level_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    target_job_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    simulation_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    target_level_id?: string | null | undefined;
    target_job_id?: string | null | undefined;
    target_path_id?: string | null | undefined;
    simulation_name?: string | null | undefined;
}, {
    employee_id: string;
    target_level_id?: string | null | undefined;
    target_job_id?: string | null | undefined;
    target_path_id?: string | null | undefined;
    simulation_name?: string | null | undefined;
}>;
export declare const enrollCareerPathSchema: z.ZodObject<{
    starting_level_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    starting_level_id?: string | null | undefined;
}, {
    starting_level_id?: string | null | undefined;
}>;
export declare const updateCareerProgressSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["not_started", "in_progress", "completed"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "completed" | "in_progress" | "not_started" | undefined;
}, {
    status?: "completed" | "in_progress" | "not_started" | undefined;
}>;
export declare const gapAnalysisSchema: z.ZodObject<{
    analysisType: z.ZodEnum<["employee_role", "team_role", "team_project"]>;
    employeeId: z.ZodOptional<z.ZodString>;
    employeeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    roleId: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodOptional<z.ZodString>;
    aggregation: z.ZodOptional<z.ZodEnum<["average", "best", "coverage"]>>;
}, "strip", z.ZodTypeAny, {
    analysisType: "employee_role" | "team_role" | "team_project";
    employeeId?: string | undefined;
    tenantId?: string | undefined;
    employeeIds?: string[] | undefined;
    roleId?: string | undefined;
    aggregation?: "average" | "best" | "coverage" | undefined;
}, {
    analysisType: "employee_role" | "team_role" | "team_project";
    employeeId?: string | undefined;
    tenantId?: string | undefined;
    employeeIds?: string[] | undefined;
    roleId?: string | undefined;
    aggregation?: "average" | "best" | "coverage" | undefined;
}>;
export declare const employeeRoleGapSchema: z.ZodObject<{
    employeeId: z.ZodString;
    roleId: z.ZodString;
    tenantId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    roleId: string;
    tenantId?: string | undefined;
}, {
    employeeId: string;
    roleId: string;
    tenantId?: string | undefined;
}>;
export declare const teamRoleGapSchema: z.ZodObject<{
    employeeIds: z.ZodArray<z.ZodString, "many">;
    roleId: z.ZodString;
    aggregation: z.ZodOptional<z.ZodEnum<["average", "best", "coverage"]>>;
    tenantId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeIds: string[];
    roleId: string;
    tenantId?: string | undefined;
    aggregation?: "average" | "best" | "coverage" | undefined;
}, {
    employeeIds: string[];
    roleId: string;
    tenantId?: string | undefined;
    aggregation?: "average" | "best" | "coverage" | undefined;
}>;
export declare const compareGapSchema: z.ZodObject<{
    employeeIds: z.ZodArray<z.ZodString, "many">;
    roleId: z.ZodString;
    tenantId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeIds: string[];
    roleId: string;
    tenantId?: string | undefined;
}, {
    employeeIds: string[];
    roleId: string;
    tenantId?: string | undefined;
}>;
export declare const gapRecommendationsSchema: z.ZodObject<{
    employeeId: z.ZodString;
    roleId: z.ZodString;
    tenantId: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        maxPerSkill: z.ZodOptional<z.ZodNumber>;
        includeTypes: z.ZodOptional<z.ZodArray<z.ZodEnum<["training", "mentoring", "self_study", "certification"]>, "many">>;
        minSeverity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    }, "strip", z.ZodTypeAny, {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    }, {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    roleId: string;
    options?: {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    } | undefined;
    tenantId?: string | undefined;
}, {
    employeeId: string;
    roleId: string;
    options?: {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    } | undefined;
    tenantId?: string | undefined;
}>;
export declare const cachedRecommendationsSchema: z.ZodObject<{
    employeeId: z.ZodString;
    roleId: z.ZodString;
    tenantId: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        maxPerSkill: z.ZodOptional<z.ZodNumber>;
        includeTypes: z.ZodOptional<z.ZodArray<z.ZodEnum<["training", "mentoring", "self_study", "certification"]>, "many">>;
        minSeverity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    }, "strip", z.ZodTypeAny, {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    }, {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    roleId: string;
    options?: {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    } | undefined;
    tenantId?: string | undefined;
}, {
    employeeId: string;
    roleId: string;
    options?: {
        maxPerSkill?: number | undefined;
        includeTypes?: ("certification" | "training" | "mentoring" | "self_study")[] | undefined;
        minSeverity?: "low" | "medium" | "high" | "critical" | undefined;
    } | undefined;
    tenantId?: string | undefined;
}>;
export declare const createDevelopmentActionSchema: z.ZodObject<{
    recommendationId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodString;
    type: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    skillCoverage: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    deadline: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodString>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    estimatedImpact: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    duration: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    title: string;
    status?: string | undefined;
    notes?: string | null | undefined;
    priority?: "low" | "medium" | "high" | "critical" | undefined;
    duration?: string | null | undefined;
    skillCoverage?: string[] | undefined;
    recommendationId?: string | null | undefined;
    deadline?: string | null | undefined;
    estimatedImpact?: number | null | undefined;
}, {
    type: string;
    title: string;
    status?: string | undefined;
    notes?: string | null | undefined;
    priority?: "low" | "medium" | "high" | "critical" | undefined;
    duration?: string | null | undefined;
    skillCoverage?: string[] | undefined;
    recommendationId?: string | null | undefined;
    deadline?: string | null | undefined;
    estimatedImpact?: number | null | undefined;
}>;
export declare const createJobPostingSchema: z.ZodObject<{
    title: z.ZodString;
    department: z.ZodString;
    team: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    work_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    summary: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    responsibilities: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    requirements: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    nice_to_have: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    job_level: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    job_family: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    salary_min: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    salary_max: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodString>;
    show_salary: z.ZodOptional<z.ZodBoolean>;
    visibility: z.ZodOptional<z.ZodEnum<["all_employees", "department", "custom"]>>;
    min_tenure_months: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    min_rating: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    required_skills: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    expires_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    target_start_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    hiring_manager_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    hr_contact_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    created_by_employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    department: string;
    title: string;
    team?: string | null | undefined;
    location?: string | null | undefined;
    currency?: string | undefined;
    requirements?: string | null | undefined;
    salary_min?: number | null | undefined;
    salary_max?: number | null | undefined;
    hiring_manager_id?: string | null | undefined;
    required_skills?: string[] | undefined;
    summary?: string | null | undefined;
    visibility?: "department" | "custom" | "all_employees" | undefined;
    expires_at?: string | null | undefined;
    job_level?: string | null | undefined;
    job_family?: string | null | undefined;
    work_type?: string | null | undefined;
    responsibilities?: string | null | undefined;
    nice_to_have?: string | null | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | null | undefined;
    min_rating?: number | null | undefined;
    target_start_date?: string | null | undefined;
    hr_contact_id?: string | null | undefined;
    created_by_employee_id?: string | null | undefined;
}, {
    department: string;
    title: string;
    team?: string | null | undefined;
    location?: string | null | undefined;
    currency?: string | undefined;
    requirements?: string | null | undefined;
    salary_min?: number | null | undefined;
    salary_max?: number | null | undefined;
    hiring_manager_id?: string | null | undefined;
    required_skills?: string[] | undefined;
    summary?: string | null | undefined;
    visibility?: "department" | "custom" | "all_employees" | undefined;
    expires_at?: string | null | undefined;
    job_level?: string | null | undefined;
    job_family?: string | null | undefined;
    work_type?: string | null | undefined;
    responsibilities?: string | null | undefined;
    nice_to_have?: string | null | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | null | undefined;
    min_rating?: number | null | undefined;
    target_start_date?: string | null | undefined;
    hr_contact_id?: string | null | undefined;
    created_by_employee_id?: string | null | undefined;
}>;
export declare const updateJobPostingSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    department: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    team: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    work_type: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    summary: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    responsibilities: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    requirements: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    nice_to_have: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    job_level: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    salary_min: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    salary_max: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    show_salary: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["draft", "open", "closed", "on_hold", "cancelled"]>>>;
    visibility: z.ZodOptional<z.ZodOptional<z.ZodEnum<["all_employees", "department", "custom"]>>>;
    min_tenure_months: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    min_rating: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    required_skills: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    expires_at: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    status?: "draft" | "cancelled" | "on_hold" | "open" | "closed" | undefined;
    team?: string | null | undefined;
    department?: string | undefined;
    location?: string | null | undefined;
    title?: string | undefined;
    requirements?: string | null | undefined;
    salary_min?: number | null | undefined;
    salary_max?: number | null | undefined;
    required_skills?: string[] | undefined;
    summary?: string | null | undefined;
    visibility?: "department" | "custom" | "all_employees" | undefined;
    expires_at?: string | null | undefined;
    job_level?: string | null | undefined;
    work_type?: string | null | undefined;
    responsibilities?: string | null | undefined;
    nice_to_have?: string | null | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | null | undefined;
    min_rating?: number | null | undefined;
}, {
    status?: "draft" | "cancelled" | "on_hold" | "open" | "closed" | undefined;
    team?: string | null | undefined;
    department?: string | undefined;
    location?: string | null | undefined;
    title?: string | undefined;
    requirements?: string | null | undefined;
    salary_min?: number | null | undefined;
    salary_max?: number | null | undefined;
    required_skills?: string[] | undefined;
    summary?: string | null | undefined;
    visibility?: "department" | "custom" | "all_employees" | undefined;
    expires_at?: string | null | undefined;
    job_level?: string | null | undefined;
    work_type?: string | null | undefined;
    responsibilities?: string | null | undefined;
    nice_to_have?: string | null | undefined;
    show_salary?: boolean | undefined;
    min_tenure_months?: number | null | undefined;
    min_rating?: number | null | undefined;
}>;
export declare const createApplicationSchema: z.ZodObject<{
    job_posting_id: z.ZodString;
    employee_id: z.ZodString;
    cover_letter: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    motivation: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    relevant_experience: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    current_manager_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    job_posting_id: string;
    motivation?: string | null | undefined;
    cover_letter?: string | null | undefined;
    relevant_experience?: string | null | undefined;
    current_manager_id?: string | null | undefined;
}, {
    employee_id: string;
    job_posting_id: string;
    motivation?: string | null | undefined;
    cover_letter?: string | null | undefined;
    relevant_experience?: string | null | undefined;
    current_manager_id?: string | null | undefined;
}>;
export declare const updateApplicationStatusSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["submitted", "reviewing", "interview", "accepted", "rejected", "withdrawn"]>>>;
    manager_approval_status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["pending", "approved", "rejected"]>>>;
    manager_notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    hr_notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    hr_score: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    interview_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    interview_feedback: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    outcome_notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    rejected_reason: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    status?: "rejected" | "interview" | "submitted" | "accepted" | "reviewing" | "withdrawn" | undefined;
    manager_notes?: string | null | undefined;
    manager_approval_status?: "pending" | "approved" | "rejected" | undefined;
    hr_notes?: string | null | undefined;
    hr_score?: number | null | undefined;
    interview_date?: string | null | undefined;
    interview_feedback?: string | null | undefined;
    outcome_notes?: string | null | undefined;
    rejected_reason?: string | null | undefined;
}, {
    status?: "rejected" | "interview" | "submitted" | "accepted" | "reviewing" | "withdrawn" | undefined;
    manager_notes?: string | null | undefined;
    manager_approval_status?: "pending" | "approved" | "rejected" | undefined;
    hr_notes?: string | null | undefined;
    hr_score?: number | null | undefined;
    interview_date?: string | null | undefined;
    interview_feedback?: string | null | undefined;
    outcome_notes?: string | null | undefined;
    rejected_reason?: string | null | undefined;
}>;
//# sourceMappingURL=talent.d.ts.map