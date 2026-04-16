/**
 * Zod Schemas for HR Operations Extended Routes
 * Covers: sap-migration, prototypes, tenant-setup, time-off, rag-sessions,
 *         recognition, workforce-planning, performance-skill-integration, wellbeing-dashboard
 */
import { z } from 'zod';
export declare const sapParseTestSchema: z.ZodObject<{
    fileContent: z.ZodString;
    format: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    format: string;
    fileContent: string;
    limit?: number | undefined;
}, {
    format: string;
    fileContent: string;
    limit?: number | undefined;
}>;
export declare const createSapJobSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sourceSystem: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    migrationScope: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    sourceSystem?: string | null | undefined;
    migrationScope?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    sourceSystem?: string | null | undefined;
    migrationScope?: string | null | undefined;
}>;
export declare const sapParseSchema: z.ZodObject<{
    fileContent: z.ZodString;
    format: z.ZodString;
    infotype: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    format: string;
    fileContent: string;
    infotype?: string | null | undefined;
}, {
    format: string;
    fileContent: string;
    infotype?: string | null | undefined;
}>;
export declare const sapParsePreviewSchema: z.ZodObject<{
    fileContent: z.ZodString;
    format: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    format: string;
    fileContent: string;
    limit?: number | undefined;
}, {
    format: string;
    fileContent: string;
    limit?: number | undefined;
}>;
export declare const createSapMappingSchema: z.ZodObject<{
    infotype: z.ZodString;
    infotypeName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sapField: z.ZodString;
    targetTable: z.ZodString;
    targetField: z.ZodString;
    transformType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    transformConfig: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    required: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    infotype: string;
    sapField: string;
    targetTable: string;
    targetField: string;
    required?: boolean | undefined;
    infotypeName?: string | null | undefined;
    transformType?: string | null | undefined;
    transformConfig?: Record<string, unknown> | null | undefined;
}, {
    infotype: string;
    sapField: string;
    targetTable: string;
    targetField: string;
    required?: boolean | undefined;
    infotypeName?: string | null | undefined;
    transformType?: string | null | undefined;
    transformConfig?: Record<string, unknown> | null | undefined;
}>;
export declare const updateSapMappingSchema: z.ZodObject<{
    infotype: z.ZodOptional<z.ZodString>;
    infotypeName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sapField: z.ZodOptional<z.ZodString>;
    targetTable: z.ZodOptional<z.ZodString>;
    targetField: z.ZodOptional<z.ZodString>;
    transformType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    transformConfig: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    required: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    required?: boolean | undefined;
    infotype?: string | undefined;
    infotypeName?: string | null | undefined;
    sapField?: string | undefined;
    targetTable?: string | undefined;
    targetField?: string | undefined;
    transformType?: string | null | undefined;
    transformConfig?: Record<string, unknown> | null | undefined;
}, {
    required?: boolean | undefined;
    infotype?: string | undefined;
    infotypeName?: string | null | undefined;
    sapField?: string | undefined;
    targetTable?: string | undefined;
    targetField?: string | undefined;
    transformType?: string | null | undefined;
    transformConfig?: Record<string, unknown> | null | undefined;
}>;
export declare const sapExecuteJobSchema: z.ZodObject<{
    confirmExecution: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    confirmExecution?: boolean | undefined;
}, {
    confirmExecution?: boolean | undefined;
}>;
export declare const sapRollbackJobSchema: z.ZodObject<{
    confirmRollback: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    confirmRollback?: boolean | undefined;
}, {
    confirmRollback?: boolean | undefined;
}>;
export declare const sapDeltaSyncCheckSchema: z.ZodObject<{
    fileContent: z.ZodString;
    format: z.ZodString;
}, "strip", z.ZodTypeAny, {
    format: string;
    fileContent: string;
}, {
    format: string;
    fileContent: string;
}>;
export declare const sapDeltaSyncExecuteSchema: z.ZodObject<{
    fileContent: z.ZodString;
    format: z.ZodString;
    confirmSync: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    format: string;
    fileContent: string;
    confirmSync?: boolean | undefined;
}, {
    format: string;
    fileContent: string;
    confirmSync?: boolean | undefined;
}>;
export declare const sapEmployeeMappingSchema: z.ZodObject<{
    sapPernr: z.ZodString;
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    sapPernr: string;
}, {
    employeeId: string;
    sapPernr: string;
}>;
export declare const prototypeResearchSchema: z.ZodObject<{
    nace_code: z.ZodString;
    company_size: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nace_code: string;
    company_size?: number | undefined;
}, {
    nace_code: string;
    company_size?: number | undefined;
}>;
export declare const createProcessSchema: z.ZodObject<{
    process_code: z.ZodString;
    process_name: z.ZodString;
    process_category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    value_chain_position: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    typical_inputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    typical_outputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    process_code: string;
    process_name: string;
    description?: string | null | undefined;
    process_category?: string | null | undefined;
    value_chain_position?: string | null | undefined;
    typical_inputs?: string[] | undefined;
    typical_outputs?: string[] | undefined;
}, {
    process_code: string;
    process_name: string;
    description?: string | null | undefined;
    process_category?: string | null | undefined;
    value_chain_position?: string | null | undefined;
    typical_inputs?: string[] | undefined;
    typical_outputs?: string[] | undefined;
}>;
export declare const createStaffingRulesSchema: z.ZodObject<{
    rules: z.ZodArray<z.ZodObject<{
        role_code: z.ZodOptional<z.ZodString>;
        role_name: z.ZodOptional<z.ZodString>;
        process_code: z.ZodOptional<z.ZodString>;
        min_headcount: z.ZodOptional<z.ZodNumber>;
        max_headcount: z.ZodOptional<z.ZodNumber>;
        ratio_base: z.ZodOptional<z.ZodNumber>;
        ratio_per: z.ZodOptional<z.ZodNumber>;
        scaling_type: z.ZodOptional<z.ZodString>;
        conditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        role_name?: string | undefined;
        process_code?: string | undefined;
        role_code?: string | undefined;
        min_headcount?: number | undefined;
        max_headcount?: number | undefined;
        ratio_base?: number | undefined;
        ratio_per?: number | undefined;
        scaling_type?: string | undefined;
        conditions?: Record<string, unknown> | undefined;
    }, {
        role_name?: string | undefined;
        process_code?: string | undefined;
        role_code?: string | undefined;
        min_headcount?: number | undefined;
        max_headcount?: number | undefined;
        ratio_base?: number | undefined;
        ratio_per?: number | undefined;
        scaling_type?: string | undefined;
        conditions?: Record<string, unknown> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rules: {
        role_name?: string | undefined;
        process_code?: string | undefined;
        role_code?: string | undefined;
        min_headcount?: number | undefined;
        max_headcount?: number | undefined;
        ratio_base?: number | undefined;
        ratio_per?: number | undefined;
        scaling_type?: string | undefined;
        conditions?: Record<string, unknown> | undefined;
    }[];
}, {
    rules: {
        role_name?: string | undefined;
        process_code?: string | undefined;
        role_code?: string | undefined;
        min_headcount?: number | undefined;
        max_headcount?: number | undefined;
        ratio_base?: number | undefined;
        ratio_per?: number | undefined;
        scaling_type?: string | undefined;
        conditions?: Record<string, unknown> | undefined;
    }[];
}>;
export declare const calculateStaffingSchema: z.ZodObject<{
    company_size: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    company_size: number;
}, {
    company_size: number;
}>;
export declare const generatePrototypeSchema: z.ZodObject<{
    profile_id: z.ZodOptional<z.ZodString>;
    prototype_id: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    config?: Record<string, unknown> | undefined;
    profile_id?: string | undefined;
    prototype_id?: string | undefined;
}, {
    config?: Record<string, unknown> | undefined;
    profile_id?: string | undefined;
    prototype_id?: string | undefined;
}>;
export declare const previewPrototypeSchema: z.ZodObject<{
    profile_id: z.ZodOptional<z.ZodString>;
    prototype_id: z.ZodOptional<z.ZodString>;
    company_size: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    company_size?: number | undefined;
    profile_id?: string | undefined;
    prototype_id?: string | undefined;
}, {
    company_size?: number | undefined;
    profile_id?: string | undefined;
    prototype_id?: string | undefined;
}>;
export declare const validateStaffingSchema: z.ZodObject<{
    staffing_plan: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    staffing_plan: Record<string, unknown>;
}, {
    staffing_plan: Record<string, unknown>;
}>;
export declare const addJobSkillSchema: z.ZodObject<{
    esco_skill_id: z.ZodString;
    required_level: z.ZodOptional<z.ZodNumber>;
    is_required: z.ZodOptional<z.ZodBoolean>;
    importance: z.ZodOptional<z.ZodEnum<["critical", "important", "nice_to_have"]>>;
}, "strip", z.ZodTypeAny, {
    esco_skill_id: string;
    is_required?: boolean | undefined;
    required_level?: number | undefined;
    importance?: "critical" | "important" | "nice_to_have" | undefined;
}, {
    esco_skill_id: string;
    is_required?: boolean | undefined;
    required_level?: number | undefined;
    importance?: "critical" | "important" | "nice_to_have" | undefined;
}>;
export declare const tenantSetupStep1Schema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    taxId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        state?: string | undefined;
        street?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        zip?: string | undefined;
    }, {
        state?: string | undefined;
        street?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        zip?: string | undefined;
    }>>;
    contact: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }, {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }>>;
    industry: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    employeeCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    employeeCount?: number | undefined;
    industry?: string | null | undefined;
    address?: {
        state?: string | undefined;
        street?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    taxId?: string | null | undefined;
    contact?: {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
}, {
    code: string;
    name: string;
    employeeCount?: number | undefined;
    industry?: string | null | undefined;
    address?: {
        state?: string | undefined;
        street?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    taxId?: string | null | undefined;
    contact?: {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
}>;
export declare const tenantSetupStep2Schema: z.ZodObject<{
    ccnlType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    customRules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    leaveRules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    ccnlType?: string | null | undefined;
    customRules?: Record<string, unknown> | undefined;
    leaveRules?: Record<string, unknown> | undefined;
}, {
    ccnlType?: string | null | undefined;
    customRules?: Record<string, unknown> | undefined;
    leaveRules?: Record<string, unknown> | undefined;
}>;
export declare const tenantSetupStep3Schema: z.ZodObject<{
    startMonth: z.ZodOptional<z.ZodNumber>;
    payPeriod: z.ZodOptional<z.ZodString>;
    holidayCalendar: z.ZodOptional<z.ZodString>;
    customHolidays: z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        date: string;
    }, {
        name: string;
        date: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    startMonth?: number | undefined;
    payPeriod?: string | undefined;
    holidayCalendar?: string | undefined;
    customHolidays?: {
        name: string;
        date: string;
    }[] | undefined;
}, {
    startMonth?: number | undefined;
    payPeriod?: string | undefined;
    holidayCalendar?: string | undefined;
    customHolidays?: {
        name: string;
        date: string;
    }[] | undefined;
}>;
export declare const tenantUpdateSettingsSchema: z.ZodObject<{
    settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    settings: Record<string, unknown>;
}, {
    settings: Record<string, unknown>;
}>;
export declare const createTimeOffRequestSchema: z.ZodObject<{
    leave_type: z.ZodString;
    start_date: z.ZodString;
    end_date: z.ZodString;
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    half_day_start: z.ZodOptional<z.ZodBoolean>;
    half_day_end: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    start_date: string;
    end_date: string;
    leave_type: string;
    reason?: string | null | undefined;
    half_day_start?: boolean | undefined;
    half_day_end?: boolean | undefined;
}, {
    start_date: string;
    end_date: string;
    leave_type: string;
    reason?: string | null | undefined;
    half_day_start?: boolean | undefined;
    half_day_end?: boolean | undefined;
}>;
export declare const cancelTimeOffRequestSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
export declare const rejectTimeOffRequestSchema: z.ZodObject<{
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason?: string | null | undefined;
}, {
    reason?: string | null | undefined;
}>;
export declare const createRagSessionSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    user_id_employee_id: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    system_prompt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sources_enabled: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title?: string | null | undefined;
    user_id?: string | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    user_id_employee_id?: string | undefined;
    system_prompt?: string | null | undefined;
    sources_enabled?: string[] | undefined;
}, {
    title?: string | null | undefined;
    user_id?: string | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    user_id_employee_id?: string | undefined;
    system_prompt?: string | null | undefined;
    sources_enabled?: string[] | undefined;
}>;
export declare const updateRagSessionSchema: z.ZodObject<{
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    system_prompt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sources_enabled: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    is_archived: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title?: string | null | undefined;
    system_prompt?: string | null | undefined;
    sources_enabled?: string[] | undefined;
    is_archived?: boolean | undefined;
}, {
    title?: string | null | undefined;
    system_prompt?: string | null | undefined;
    sources_enabled?: string[] | undefined;
    is_archived?: boolean | undefined;
}>;
export declare const createRecognitionSchema: z.ZodObject<{
    from_employee_id: z.ZodString;
    to_employee_id: z.ZodString;
    message: z.ZodString;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    badge_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    core_value: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_public: z.ZodOptional<z.ZodBoolean>;
    points_awarded: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    message: string;
    from_employee_id: string;
    to_employee_id: string;
    category?: string | null | undefined;
    badge_type?: string | null | undefined;
    core_value?: string | null | undefined;
    is_public?: boolean | undefined;
    points_awarded?: number | undefined;
}, {
    message: string;
    from_employee_id: string;
    to_employee_id: string;
    category?: string | null | undefined;
    badge_type?: string | null | undefined;
    core_value?: string | null | undefined;
    is_public?: boolean | undefined;
    points_awarded?: number | undefined;
}>;
export declare const updateRecognitionSchema: z.ZodObject<{
    message: z.ZodOptional<z.ZodString>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    badge_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    core_value: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_public: z.ZodOptional<z.ZodBoolean>;
    points_awarded: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
    category?: string | null | undefined;
    badge_type?: string | null | undefined;
    core_value?: string | null | undefined;
    is_public?: boolean | undefined;
    points_awarded?: number | undefined;
}, {
    message?: string | undefined;
    category?: string | null | undefined;
    badge_type?: string | null | undefined;
    core_value?: string | null | undefined;
    is_public?: boolean | undefined;
    points_awarded?: number | undefined;
}>;
export declare const gapRiskSchema: z.ZodObject<{
    requirements: z.ZodArray<z.ZodObject<{
        skill_id: z.ZodOptional<z.ZodString>;
        skill_name: z.ZodOptional<z.ZodString>;
        required_level: z.ZodOptional<z.ZodNumber>;
        current_level: z.ZodOptional<z.ZodNumber>;
        headcount_needed: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodString>;
        timeline: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }, {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requirements: {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }[];
}, {
    requirements: {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }[];
}>;
export declare const hiringRecommendationsSchema: z.ZodObject<{
    gap_assessments: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
}, "strip", z.ZodTypeAny, {
    gap_assessments: Record<string, unknown>[];
}, {
    gap_assessments: Record<string, unknown>[];
}>;
export declare const trainingInvestmentsSchema: z.ZodObject<{
    gap_assessments: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
}, "strip", z.ZodTypeAny, {
    gap_assessments: Record<string, unknown>[];
}, {
    gap_assessments: Record<string, unknown>[];
}>;
export declare const createWorkforcePlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    target_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    requirements: z.ZodOptional<z.ZodArray<z.ZodObject<{
        skill_id: z.ZodOptional<z.ZodString>;
        skill_name: z.ZodOptional<z.ZodString>;
        required_level: z.ZodOptional<z.ZodNumber>;
        current_level: z.ZodOptional<z.ZodNumber>;
        headcount_needed: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodString>;
        timeline: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }, {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    target_date?: string | null | undefined;
    requirements?: {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }[] | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    target_date?: string | null | undefined;
    requirements?: {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }[] | undefined;
}>;
export declare const updateWorkforcePlanStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "completed" | "cancelled";
}, {
    status: "active" | "draft" | "completed" | "cancelled";
}>;
export declare const simulateWorkforceSchema: z.ZodObject<{
    requirements: z.ZodArray<z.ZodObject<{
        skill_id: z.ZodOptional<z.ZodString>;
        skill_name: z.ZodOptional<z.ZodString>;
        required_level: z.ZodOptional<z.ZodNumber>;
        current_level: z.ZodOptional<z.ZodNumber>;
        headcount_needed: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodString>;
        timeline: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }, {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requirements: {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }[];
}, {
    requirements: {
        priority?: string | undefined;
        skill_name?: string | undefined;
        required_level?: number | undefined;
        skill_id?: string | undefined;
        current_level?: number | undefined;
        headcount_needed?: number | undefined;
        timeline?: string | undefined;
    }[];
}>;
export declare const createWellbeingCheckinSchema: z.ZodObject<{
    employee_id: z.ZodString;
    mood_score: z.ZodOptional<z.ZodNumber>;
    energy_level: z.ZodOptional<z.ZodNumber>;
    stress_level: z.ZodOptional<z.ZodNumber>;
    work_life_balance: z.ZodOptional<z.ZodNumber>;
    sleep_quality: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_anonymous: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    notes?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    mood_score?: number | undefined;
    energy_level?: number | undefined;
    stress_level?: number | undefined;
    work_life_balance?: number | undefined;
    sleep_quality?: number | undefined;
}, {
    employee_id: string;
    notes?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    mood_score?: number | undefined;
    energy_level?: number | undefined;
    stress_level?: number | undefined;
    work_life_balance?: number | undefined;
    sleep_quality?: number | undefined;
}>;
export declare const createBurnoutAssessmentSchema: z.ZodObject<{
    employee_id: z.ZodString;
    exhaustion_score: z.ZodNumber;
    cynicism_score: z.ZodNumber;
    inefficacy_score: z.ZodNumber;
    workload_factor: z.ZodOptional<z.ZodNumber>;
    autonomy_factor: z.ZodOptional<z.ZodNumber>;
    recognition_factor: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    exhaustion_score: number;
    cynicism_score: number;
    inefficacy_score: number;
    workload_factor?: number | undefined;
    autonomy_factor?: number | undefined;
    recognition_factor?: number | undefined;
}, {
    employee_id: string;
    exhaustion_score: number;
    cynicism_score: number;
    inefficacy_score: number;
    workload_factor?: number | undefined;
    autonomy_factor?: number | undefined;
    recognition_factor?: number | undefined;
}>;
export declare const createWellbeingGoalSchema: z.ZodObject<{
    employee_id: z.ZodString;
    goal_type: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    target_value: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    target_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    employee_id: string;
    description?: string | null | undefined;
    goal_type?: string | undefined;
    target_value?: number | undefined;
    target_date?: string | null | undefined;
    unit?: string | null | undefined;
}, {
    title: string;
    employee_id: string;
    description?: string | null | undefined;
    goal_type?: string | undefined;
    target_value?: number | undefined;
    target_date?: string | null | undefined;
    unit?: string | null | undefined;
}>;
//# sourceMappingURL=hr-operations-extended.d.ts.map