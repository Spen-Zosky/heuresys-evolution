/**
 * Zod Schemas for Wellbeing Routes
 * Covers: wellbeing check-in CRUD
 */
import { z } from 'zod';
export declare const createWellbeingCheckinBasicSchema: z.ZodObject<{
    employee_id: z.ZodString;
    mood_score: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    energy_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    stress_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    work_life_balance: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    sleep_quality: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_anonymous: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    notes?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    mood_score?: number | null | undefined;
    energy_level?: number | null | undefined;
    stress_level?: number | null | undefined;
    work_life_balance?: number | null | undefined;
    sleep_quality?: number | null | undefined;
}, {
    employee_id: string;
    notes?: string | null | undefined;
    is_anonymous?: boolean | undefined;
    mood_score?: number | null | undefined;
    energy_level?: number | null | undefined;
    stress_level?: number | null | undefined;
    work_life_balance?: number | null | undefined;
    sleep_quality?: number | null | undefined;
}>;
export declare const updateWellbeingCheckinSchema: z.ZodObject<{
    mood_score: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    energy_level: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    stress_level: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    work_life_balance: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    sleep_quality: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    mood_score?: number | undefined;
    energy_level?: number | undefined;
    stress_level?: number | undefined;
    work_life_balance?: number | undefined;
    sleep_quality?: number | undefined;
}, {
    notes?: string | null | undefined;
    mood_score?: number | undefined;
    energy_level?: number | undefined;
    stress_level?: number | undefined;
    work_life_balance?: number | undefined;
    sleep_quality?: number | undefined;
}>;
//# sourceMappingURL=wellbeing.d.ts.map