import { z } from 'zod';
/**
 * POST /developer/plugins
 */
export declare const createDeveloperPluginSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    short_description: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    pricing_model: z.ZodDefault<z.ZodOptional<z.ZodEnum<["free", "freemium", "paid", "subscription", "contact"]>>>;
    price_cents: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    icon_url: z.ZodOptional<z.ZodString>;
    homepage_url: z.ZodOptional<z.ZodString>;
    repository_url: z.ZodOptional<z.ZodString>;
    license: z.ZodOptional<z.ZodString>;
    screenshot_urls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    banner_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    currency: string;
    pricing_model: "free" | "paid" | "freemium" | "subscription" | "contact";
    description?: string | undefined;
    slug?: string | undefined;
    tags?: string[] | undefined;
    category_id?: string | null | undefined;
    short_description?: string | undefined;
    price_cents?: number | undefined;
    icon_url?: string | undefined;
    homepage_url?: string | undefined;
    repository_url?: string | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
}, {
    name: string;
    description?: string | undefined;
    currency?: string | undefined;
    slug?: string | undefined;
    tags?: string[] | undefined;
    category_id?: string | null | undefined;
    short_description?: string | undefined;
    pricing_model?: "free" | "paid" | "freemium" | "subscription" | "contact" | undefined;
    price_cents?: number | undefined;
    icon_url?: string | undefined;
    homepage_url?: string | undefined;
    repository_url?: string | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
}>;
/**
 * PUT /developer/plugins/:id
 */
export declare const updateDeveloperPluginSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    short_description: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    pricing_model: z.ZodOptional<z.ZodEnum<["free", "freemium", "paid", "subscription", "contact"]>>;
    price_cents: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    icon_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    homepage_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    repository_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    license: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private", "unlisted"]>>;
    screenshot_urls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    banner_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    currency?: string | undefined;
    tags?: string[] | undefined;
    visibility?: "private" | "public" | "unlisted" | undefined;
    category_id?: string | null | undefined;
    short_description?: string | undefined;
    pricing_model?: "free" | "paid" | "freemium" | "subscription" | "contact" | undefined;
    price_cents?: number | undefined;
    icon_url?: string | null | undefined;
    homepage_url?: string | null | undefined;
    repository_url?: string | null | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    currency?: string | undefined;
    tags?: string[] | undefined;
    visibility?: "private" | "public" | "unlisted" | undefined;
    category_id?: string | null | undefined;
    short_description?: string | undefined;
    pricing_model?: "free" | "paid" | "freemium" | "subscription" | "contact" | undefined;
    price_cents?: number | undefined;
    icon_url?: string | null | undefined;
    homepage_url?: string | null | undefined;
    repository_url?: string | null | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
}>;
/**
 * POST /developer/plugins/:id/versions
 */
export declare const createPluginVersionSchema: z.ZodObject<{
    version: z.ZodString;
    release_notes: z.ZodOptional<z.ZodString>;
    changelog: z.ZodOptional<z.ZodString>;
    config_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    permissions_required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    entry_point: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    release_notes?: string | undefined;
    changelog?: string | undefined;
    config_schema?: Record<string, unknown> | undefined;
    permissions_required?: string[] | undefined;
    entry_point?: string | undefined;
}, {
    version: string;
    release_notes?: string | undefined;
    changelog?: string | undefined;
    config_schema?: Record<string, unknown> | undefined;
    permissions_required?: string[] | undefined;
    entry_point?: string | undefined;
}>;
/**
 * POST /developer/api-keys
 */
export declare const createApiKeySchema: z.ZodObject<{
    name: z.ZodString;
    plugin_installation_id: z.ZodOptional<z.ZodString>;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    expires_in_days: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    scopes?: string[] | undefined;
    plugin_installation_id?: string | undefined;
    expires_in_days?: number | undefined;
}, {
    name: string;
    scopes?: string[] | undefined;
    plugin_installation_id?: string | undefined;
    expires_in_days?: number | undefined;
}>;
/**
 * POST /marketplace/plugins
 */
export declare const createPluginSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    short_description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    publisher_tenant_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    publisher_name: z.ZodString;
    icon_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    homepage_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    repository_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    license: z.ZodOptional<z.ZodString>;
    pricing_model: z.ZodDefault<z.ZodOptional<z.ZodEnum<["free", "freemium", "paid", "subscription", "contact"]>>>;
    price_cents: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    screenshot_urls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    banner_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    currency: string;
    pricing_model: "free" | "paid" | "freemium" | "subscription" | "contact";
    publisher_name: string;
    description?: string | undefined;
    slug?: string | undefined;
    tags?: string[] | undefined;
    category_id?: string | null | undefined;
    short_description?: string | undefined;
    price_cents?: number | undefined;
    icon_url?: string | null | undefined;
    homepage_url?: string | null | undefined;
    repository_url?: string | null | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
    publisher_tenant_id?: string | null | undefined;
}, {
    name: string;
    publisher_name: string;
    description?: string | undefined;
    currency?: string | undefined;
    slug?: string | undefined;
    tags?: string[] | undefined;
    category_id?: string | null | undefined;
    short_description?: string | undefined;
    pricing_model?: "free" | "paid" | "freemium" | "subscription" | "contact" | undefined;
    price_cents?: number | undefined;
    icon_url?: string | null | undefined;
    homepage_url?: string | null | undefined;
    repository_url?: string | null | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
    publisher_tenant_id?: string | null | undefined;
}>;
/**
 * PUT /marketplace/plugins/:id
 */
export declare const updatePluginSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    short_description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    publisher_name: z.ZodOptional<z.ZodString>;
    icon_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    homepage_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    repository_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    license: z.ZodOptional<z.ZodString>;
    pricing_model: z.ZodOptional<z.ZodEnum<["free", "freemium", "paid", "subscription", "contact"]>>;
    price_cents: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending_review", "published", "suspended", "deprecated"]>>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private", "unlisted"]>>;
    featured: z.ZodOptional<z.ZodBoolean>;
    screenshot_urls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    banner_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    status?: "suspended" | "draft" | "published" | "pending_review" | "deprecated" | undefined;
    currency?: string | undefined;
    tags?: string[] | undefined;
    visibility?: "private" | "public" | "unlisted" | undefined;
    category_id?: string | null | undefined;
    featured?: boolean | undefined;
    short_description?: string | undefined;
    pricing_model?: "free" | "paid" | "freemium" | "subscription" | "contact" | undefined;
    price_cents?: number | undefined;
    icon_url?: string | null | undefined;
    homepage_url?: string | null | undefined;
    repository_url?: string | null | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
    publisher_name?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    status?: "suspended" | "draft" | "published" | "pending_review" | "deprecated" | undefined;
    currency?: string | undefined;
    tags?: string[] | undefined;
    visibility?: "private" | "public" | "unlisted" | undefined;
    category_id?: string | null | undefined;
    featured?: boolean | undefined;
    short_description?: string | undefined;
    pricing_model?: "free" | "paid" | "freemium" | "subscription" | "contact" | undefined;
    price_cents?: number | undefined;
    icon_url?: string | null | undefined;
    homepage_url?: string | null | undefined;
    repository_url?: string | null | undefined;
    license?: string | undefined;
    screenshot_urls?: string[] | undefined;
    banner_url?: string | null | undefined;
    publisher_name?: string | undefined;
}>;
/**
 * POST /marketplace/plugins/:id/dependencies
 */
export declare const createPluginDependencySchema: z.ZodObject<{
    depends_on_plugin_id: z.ZodString;
    min_version: z.ZodOptional<z.ZodString>;
    max_version: z.ZodOptional<z.ZodString>;
    is_optional: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    depends_on_plugin_id: string;
    is_optional: boolean;
    min_version?: string | undefined;
    max_version?: string | undefined;
}, {
    depends_on_plugin_id: string;
    min_version?: string | undefined;
    max_version?: string | undefined;
    is_optional?: boolean | undefined;
}>;
/**
 * POST /marketplace/reviews
 */
export declare const createReviewSchema: z.ZodObject<{
    plugin_id: z.ZodString;
    user_id: z.ZodString;
    rating: z.ZodNumber;
    title: z.ZodOptional<z.ZodString>;
    review_text: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    rating: number;
    plugin_id: string;
    title?: string | undefined;
    review_text?: string | undefined;
}, {
    user_id: string;
    rating: number;
    plugin_id: string;
    title?: string | undefined;
    review_text?: string | undefined;
}>;
/**
 * PUT /marketplace/reviews/:id
 */
export declare const updateReviewSchema: z.ZodObject<{
    rating: z.ZodOptional<z.ZodNumber>;
    title: z.ZodOptional<z.ZodString>;
    review_text: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    rating?: number | undefined;
    review_text?: string | undefined;
}, {
    title?: string | undefined;
    rating?: number | undefined;
    review_text?: string | undefined;
}>;
/**
 * POST /marketplace/webhooks
 */
export declare const createWebhookSchema: z.ZodObject<{
    plugin_installation_id: z.ZodString;
    url: z.ZodString;
    secret: z.ZodOptional<z.ZodString>;
    events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodString>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    plugin_installation_id: string;
    description?: string | undefined;
    created_by?: string | undefined;
    events?: string[] | undefined;
    secret?: string | undefined;
}, {
    url: string;
    plugin_installation_id: string;
    description?: string | undefined;
    created_by?: string | undefined;
    events?: string[] | undefined;
    secret?: string | undefined;
}>;
/**
 * PUT /marketplace/webhooks/:id
 */
export declare const updateWebhookSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    url?: string | undefined;
    is_active?: boolean | undefined;
    events?: string[] | undefined;
}, {
    description?: string | undefined;
    url?: string | undefined;
    is_active?: boolean | undefined;
    events?: string[] | undefined;
}>;
/**
 * POST /marketplace/installations
 */
export declare const createInstallationSchema: z.ZodObject<{
    plugin_id: z.ZodString;
    installed_by: z.ZodOptional<z.ZodString>;
    auto_update: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    plugin_id: string;
    auto_update: boolean;
    installed_by?: string | undefined;
}, {
    plugin_id: string;
    installed_by?: string | undefined;
    auto_update?: boolean | undefined;
}>;
/**
 * PUT /marketplace/installations/:id/configuration
 */
export declare const updateInstallationConfigSchema: z.ZodObject<{
    config_data: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodUnknown>, Record<string, unknown>, Record<string, unknown>>;
    updated_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    config_data: Record<string, unknown>;
    updated_by?: string | undefined;
}, {
    config_data: Record<string, unknown>;
    updated_by?: string | undefined;
}>;
/**
 * PATCH /marketplace/installations/:id/disable
 */
export declare const disableInstallationSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
//# sourceMappingURL=marketplace.d.ts.map