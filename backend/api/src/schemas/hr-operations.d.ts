/**
 * Zod Schemas for HR Operations Routes
 * Covers: attendance, employee-documents, employee-skill-profiles
 */
import { z } from 'zod';
export declare const createAttendanceSchema: z.ZodObject<{
    employee_id: z.ZodString;
    attendance_date: z.ZodString;
    clock_in: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    clock_out: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    break_start: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    break_end: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    hours_regular: z.ZodOptional<z.ZodNumber>;
    hours_overtime: z.ZodOptional<z.ZodNumber>;
    hours_night: z.ZodOptional<z.ZodNumber>;
    hours_holiday: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["present", "absent", "late", "half_day", "remote", "leave"]>>;
    source: z.ZodOptional<z.ZodString>;
    source_reference: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    attendance_date: string;
    status?: "leave" | "present" | "absent" | "late" | "half_day" | "remote" | undefined;
    source?: string | undefined;
    notes?: string | null | undefined;
    hours_regular?: number | undefined;
    hours_overtime?: number | undefined;
    clock_in?: string | null | undefined;
    clock_out?: string | null | undefined;
    break_start?: string | null | undefined;
    break_end?: string | null | undefined;
    hours_night?: number | undefined;
    hours_holiday?: number | undefined;
    source_reference?: string | null | undefined;
}, {
    employee_id: string;
    attendance_date: string;
    status?: "leave" | "present" | "absent" | "late" | "half_day" | "remote" | undefined;
    source?: string | undefined;
    notes?: string | null | undefined;
    hours_regular?: number | undefined;
    hours_overtime?: number | undefined;
    clock_in?: string | null | undefined;
    clock_out?: string | null | undefined;
    break_start?: string | null | undefined;
    break_end?: string | null | undefined;
    hours_night?: number | undefined;
    hours_holiday?: number | undefined;
    source_reference?: string | null | undefined;
}>;
export declare const clockInSchema: z.ZodObject<{
    employee_id: z.ZodString;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    notes?: string | null | undefined;
}, {
    employee_id: string;
    notes?: string | null | undefined;
}>;
export declare const clockOutSchema: z.ZodObject<{
    employee_id: z.ZodString;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    notes?: string | null | undefined;
}, {
    employee_id: string;
    notes?: string | null | undefined;
}>;
export declare const updateAttendanceSchema: z.ZodObject<{
    clock_in: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    clock_out: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    break_start: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    break_end: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    hours_regular: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    hours_overtime: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    hours_night: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    hours_holiday: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["present", "absent", "late", "half_day", "remote", "leave"]>>>;
    is_validated: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    validated_by: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    status?: "leave" | "present" | "absent" | "late" | "half_day" | "remote" | undefined;
    notes?: string | null | undefined;
    hours_regular?: number | undefined;
    hours_overtime?: number | undefined;
    validated_by?: string | null | undefined;
    clock_in?: string | null | undefined;
    clock_out?: string | null | undefined;
    break_start?: string | null | undefined;
    break_end?: string | null | undefined;
    hours_night?: number | undefined;
    hours_holiday?: number | undefined;
    is_validated?: boolean | undefined;
}, {
    status?: "leave" | "present" | "absent" | "late" | "half_day" | "remote" | undefined;
    notes?: string | null | undefined;
    hours_regular?: number | undefined;
    hours_overtime?: number | undefined;
    validated_by?: string | null | undefined;
    clock_in?: string | null | undefined;
    clock_out?: string | null | undefined;
    break_start?: string | null | undefined;
    break_end?: string | null | undefined;
    hours_night?: number | undefined;
    hours_holiday?: number | undefined;
    is_validated?: boolean | undefined;
}>;
export declare const validateAttendanceSchema: z.ZodObject<{
    validated_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    validated_by?: string | null | undefined;
}, {
    notes?: string | null | undefined;
    validated_by?: string | null | undefined;
}>;
export declare const createDocumentSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    document_type: z.ZodString;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    filename: z.ZodString;
    original_name: z.ZodString;
    mime_type: z.ZodString;
    file_size: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    file_path: z.ZodString;
    document_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expiry_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reference_number: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    filename: string;
    original_name: string;
    mime_type: string;
    file_path: string;
    document_type: string;
    description?: string | null | undefined;
    category?: string | null | undefined;
    expiry_date?: string | null | undefined;
    file_size?: number | null | undefined;
    document_date?: string | null | undefined;
    reference_number?: string | null | undefined;
}, {
    title: string;
    filename: string;
    original_name: string;
    mime_type: string;
    file_path: string;
    document_type: string;
    description?: string | null | undefined;
    category?: string | null | undefined;
    expiry_date?: string | null | undefined;
    file_size?: number | null | undefined;
    document_date?: string | null | undefined;
    reference_number?: string | null | undefined;
}>;
export declare const createDocumentRequestSchema: z.ZodObject<{
    document_type: z.ZodString;
    purpose: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    additional_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
}, "strip", z.ZodTypeAny, {
    document_type: string;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    purpose?: string | null | undefined;
    additional_notes?: string | null | undefined;
}, {
    document_type: string;
    priority?: "low" | "high" | "normal" | "urgent" | undefined;
    purpose?: string | null | undefined;
    additional_notes?: string | null | undefined;
}>;
export declare const updateSkillProfileSchema: z.ZodObject<{
    skills: z.ZodArray<z.ZodObject<{
        skillId: z.ZodString;
        knowledge: z.ZodOptional<z.ZodNumber>;
        skill: z.ZodOptional<z.ZodNumber>;
        ability: z.ZodOptional<z.ZodNumber>;
        behavior: z.ZodOptional<z.ZodNumber>;
        attitude: z.ZodOptional<z.ZodNumber>;
        isPrimary: z.ZodOptional<z.ZodBoolean>;
        isTarget: z.ZodOptional<z.ZodBoolean>;
        targetLevel: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        isTarget?: boolean | undefined;
        targetLevel?: number | null | undefined;
    }, {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        isTarget?: boolean | undefined;
        targetLevel?: number | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    skills: {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        isTarget?: boolean | undefined;
        targetLevel?: number | null | undefined;
    }[];
}, {
    skills: {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        isTarget?: boolean | undefined;
        targetLevel?: number | null | undefined;
    }[];
}>;
export declare const declareSkillSchema: z.ZodObject<{
    skillId: z.ZodString;
    knowledge: z.ZodOptional<z.ZodNumber>;
    skill: z.ZodOptional<z.ZodNumber>;
    ability: z.ZodOptional<z.ZodNumber>;
    behavior: z.ZodOptional<z.ZodNumber>;
    attitude: z.ZodOptional<z.ZodNumber>;
    sourceDescription: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    acquiredDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidenceType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidenceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidenceUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidenceNotes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isPrimary: z.ZodOptional<z.ZodBoolean>;
    isTarget: z.ZodOptional<z.ZodBoolean>;
    targetLevel: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    skillId: string;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    sourceDescription?: string | null | undefined;
    evidenceId?: string | null | undefined;
    isTarget?: boolean | undefined;
    targetLevel?: number | null | undefined;
    acquiredDate?: string | null | undefined;
    evidenceType?: string | null | undefined;
    evidenceUrl?: string | null | undefined;
    evidenceNotes?: string | null | undefined;
}, {
    skillId: string;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    sourceDescription?: string | null | undefined;
    evidenceId?: string | null | undefined;
    isTarget?: boolean | undefined;
    targetLevel?: number | null | undefined;
    acquiredDate?: string | null | undefined;
    evidenceType?: string | null | undefined;
    evidenceUrl?: string | null | undefined;
    evidenceNotes?: string | null | undefined;
}>;
//# sourceMappingURL=hr-operations.d.ts.map