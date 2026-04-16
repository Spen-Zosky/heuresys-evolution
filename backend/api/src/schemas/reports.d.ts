/**
 * Zod Schemas for Reports Routes
 * Covers: report definitions, execution, cloning, preview
 */
import { z } from 'zod';
export declare const createReportSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    data_source: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        source_field: z.ZodOptional<z.ZodString>;
        alias: z.ZodOptional<z.ZodString>;
        aggregate: z.ZodOptional<z.ZodString>;
        format: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }, {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }>, "many">;
    calculated_fields: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    joins: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        table: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }, {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }>, "many">>>;
    filters: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        operator: string;
        field: string;
        value?: unknown;
    }, {
        operator: string;
        field: string;
        value?: unknown;
    }>, "many">>>;
    sort: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        direction: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }, {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }>, "many">>>;
    group_by: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        field: string;
    }, {
        field: string;
    }>, "many">>>;
    parameters: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    drill_down_config: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    access_control: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    is_public: z.ZodOptional<z.ZodBoolean>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    fields: {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }[];
    data_source: string;
    description?: string | null | undefined;
    sort?: {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }[] | null | undefined;
    category?: string | null | undefined;
    created_by?: string | undefined;
    filters?: {
        operator: string;
        field: string;
        value?: unknown;
    }[] | null | undefined;
    parameters?: Record<string, unknown>[] | null | undefined;
    is_public?: boolean | undefined;
    calculated_fields?: Record<string, unknown>[] | null | undefined;
    joins?: {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }[] | null | undefined;
    group_by?: {
        field: string;
    }[] | null | undefined;
    drill_down_config?: Record<string, unknown> | null | undefined;
    access_control?: Record<string, unknown> | null | undefined;
}, {
    name: string;
    fields: {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }[];
    data_source: string;
    description?: string | null | undefined;
    sort?: {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }[] | null | undefined;
    category?: string | null | undefined;
    created_by?: string | undefined;
    filters?: {
        operator: string;
        field: string;
        value?: unknown;
    }[] | null | undefined;
    parameters?: Record<string, unknown>[] | null | undefined;
    is_public?: boolean | undefined;
    calculated_fields?: Record<string, unknown>[] | null | undefined;
    joins?: {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }[] | null | undefined;
    group_by?: {
        field: string;
    }[] | null | undefined;
    drill_down_config?: Record<string, unknown> | null | undefined;
    access_control?: Record<string, unknown> | null | undefined;
}>;
export declare const updateReportSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    data_source: z.ZodOptional<z.ZodString>;
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        source_field: z.ZodOptional<z.ZodString>;
        alias: z.ZodOptional<z.ZodString>;
        aggregate: z.ZodOptional<z.ZodString>;
        format: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }, {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }>, "many">>;
    calculated_fields: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    joins: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        table: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }, {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }>, "many">>>;
    filters: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        operator: string;
        field: string;
        value?: unknown;
    }, {
        operator: string;
        field: string;
        value?: unknown;
    }>, "many">>>;
    sort: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        direction: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }, {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }>, "many">>>;
    group_by: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        field: string;
    }, {
        field: string;
    }>, "many">>>;
    parameters: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    drill_down_config: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    access_control: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    is_public: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    sort?: {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }[] | null | undefined;
    category?: string | null | undefined;
    filters?: {
        operator: string;
        field: string;
        value?: unknown;
    }[] | null | undefined;
    fields?: {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }[] | undefined;
    data_source?: string | undefined;
    parameters?: Record<string, unknown>[] | null | undefined;
    is_public?: boolean | undefined;
    calculated_fields?: Record<string, unknown>[] | null | undefined;
    joins?: {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }[] | null | undefined;
    group_by?: {
        field: string;
    }[] | null | undefined;
    drill_down_config?: Record<string, unknown> | null | undefined;
    access_control?: Record<string, unknown> | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    sort?: {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }[] | null | undefined;
    category?: string | null | undefined;
    filters?: {
        operator: string;
        field: string;
        value?: unknown;
    }[] | null | undefined;
    fields?: {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }[] | undefined;
    data_source?: string | undefined;
    parameters?: Record<string, unknown>[] | null | undefined;
    is_public?: boolean | undefined;
    calculated_fields?: Record<string, unknown>[] | null | undefined;
    joins?: {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }[] | null | undefined;
    group_by?: {
        field: string;
    }[] | null | undefined;
    drill_down_config?: Record<string, unknown> | null | undefined;
    access_control?: Record<string, unknown> | null | undefined;
}>;
export declare const cloneReportSchema: z.ZodObject<{
    name: z.ZodString;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    created_by?: string | undefined;
}, {
    name: string;
    created_by?: string | undefined;
}>;
export declare const executeReportSchema: z.ZodObject<{
    parameters: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    page: z.ZodOptional<z.ZodNumber>;
    page_size: z.ZodOptional<z.ZodNumber>;
    include_totals: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    parameters?: Record<string, unknown> | null | undefined;
    page_size?: number | undefined;
    include_totals?: boolean | undefined;
}, {
    page?: number | undefined;
    parameters?: Record<string, unknown> | null | undefined;
    page_size?: number | undefined;
    include_totals?: boolean | undefined;
}>;
export declare const previewReportSchema: z.ZodObject<{
    data_source: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        source_field: z.ZodOptional<z.ZodString>;
        alias: z.ZodOptional<z.ZodString>;
        aggregate: z.ZodOptional<z.ZodString>;
        format: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }, {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }>, "many">;
    calculated_fields: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
    joins: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        table: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }, {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }>, "many">>>;
    filters: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        operator: string;
        field: string;
        value?: unknown;
    }, {
        operator: string;
        field: string;
        value?: unknown;
    }>, "many">>>;
    sort: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        direction: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }, {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }>, "many">>>;
    group_by: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        field: string;
    }, {
        field: string;
    }>, "many">>>;
    parameters: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>>;
}, "strip", z.ZodTypeAny, {
    fields: {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }[];
    data_source: string;
    sort?: {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }[] | null | undefined;
    filters?: {
        operator: string;
        field: string;
        value?: unknown;
    }[] | null | undefined;
    parameters?: Record<string, unknown>[] | null | undefined;
    calculated_fields?: Record<string, unknown>[] | null | undefined;
    joins?: {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }[] | null | undefined;
    group_by?: {
        field: string;
    }[] | null | undefined;
}, {
    fields: {
        name: string;
        format?: string | undefined;
        source_field?: string | undefined;
        alias?: string | undefined;
        aggregate?: string | undefined;
    }[];
    data_source: string;
    sort?: {
        field: string;
        direction?: "desc" | "asc" | undefined;
    }[] | null | undefined;
    filters?: {
        operator: string;
        field: string;
        value?: unknown;
    }[] | null | undefined;
    parameters?: Record<string, unknown>[] | null | undefined;
    calculated_fields?: Record<string, unknown>[] | null | undefined;
    joins?: {
        table: string;
        type?: string | undefined;
        on?: Record<string, unknown> | undefined;
    }[] | null | undefined;
    group_by?: {
        field: string;
    }[] | null | undefined;
}>;
//# sourceMappingURL=reports.d.ts.map