/**
 * Zod Schemas for Users Routes
 * Covers: user CRUD, password reset, bulk creation
 */
import { z } from 'zod';
export declare const createUserSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    employee_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    generate_password: z.ZodOptional<z.ZodBoolean>;
    send_welcome_email: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    username: string;
    role?: string | undefined;
    employee_id?: string | null | undefined;
    is_active?: boolean | undefined;
    permissions?: string[] | undefined;
    password?: string | undefined;
    generate_password?: boolean | undefined;
    send_welcome_email?: boolean | undefined;
}, {
    username: string;
    role?: string | undefined;
    employee_id?: string | null | undefined;
    is_active?: boolean | undefined;
    permissions?: string[] | undefined;
    password?: string | undefined;
    generate_password?: boolean | undefined;
    send_welcome_email?: boolean | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    role: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    permissions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    employee_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    is_active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    password: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    role?: string | undefined;
    employee_id?: string | null | undefined;
    is_active?: boolean | undefined;
    permissions?: string[] | undefined;
    username?: string | undefined;
    password?: string | undefined;
}, {
    role?: string | undefined;
    employee_id?: string | null | undefined;
    is_active?: boolean | undefined;
    permissions?: string[] | undefined;
    username?: string | undefined;
    password?: string | undefined;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    new_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    new_password: string;
}, {
    new_password: string;
}>;
export declare const bulkCreateUsersSchema: z.ZodObject<{
    employee_ids: z.ZodArray<z.ZodString, "many">;
    role: z.ZodOptional<z.ZodString>;
    send_welcome_emails: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    employee_ids: string[];
    role?: string | undefined;
    send_welcome_emails?: boolean | undefined;
}, {
    employee_ids: string[];
    role?: string | undefined;
    send_welcome_emails?: boolean | undefined;
}>;
//# sourceMappingURL=users.d.ts.map