import { z } from 'zod';
/**
 * Zod schemas for the MVP extraction descriptors.
 * These mirror the JSON schemas stored in enrichment_extraction_schemas but
 * add richer runtime validation (patterns, transforms, coerce). Used by
 * extract() to validate LLM output before persisting candidates.
 *
 * All fields are .nullable().optional() so the model can explicitly emit
 * null for unknown values — this matches the json_schema response_format
 * config that allows null on every property.
 */
export declare const TenantProfileV1Schema: z.ZodObject<{
    legal_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    website: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vat_id: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    country_code: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    headquarters_city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    industry_hint: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export type TenantProfileV1 = z.infer<typeof TenantProfileV1Schema>;
export declare const IndustryClassificationEnrichmentV1Schema: z.ZodObject<{
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name_en: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name_it: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description_en: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description_it: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sample_activities: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
}, z.core.$strict>;
export type IndustryClassificationEnrichmentV1 = z.infer<typeof IndustryClassificationEnrichmentV1Schema>;
/**
 * Maps the `entity_name` stored on enrichment_entity_descriptors to the
 * corresponding Zod schema. extract() looks up the schema here before
 * validating the LLM output. Unknown entity names fall back to passthrough
 * (no validation beyond the JSON schema the provider already honours).
 */
export declare const zodSchemaByEntity: Record<string, z.ZodTypeAny>;
/**
 * Validates a raw parsed record against the registered Zod schema for the
 * given entity. Returns the parsed record (with transforms applied) on
 * success. Throws a ZodError with structured .issues on failure so the
 * retry layer can feed issues back into the corrective prompt.
 */
export declare function validateExtractedByEntity(entityName: string, raw: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=schemas.d.ts.map