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

// ---- TenantProfileV1 -------------------------------------------------------

export const TenantProfileV1Schema = z
  .object({
    legal_name: z
      .string()
      .trim()
      .min(2, 'legal_name must be at least 2 characters')
      .max(200)
      .nullable()
      .optional(),
    website: z
      .string()
      .trim()
      .url('website must be a valid URL')
      .nullable()
      .optional(),
    vat_id: z
      .string()
      .trim()
      // Broad VAT format: country prefix (2 letters) + 2-13 alnum chars.
      // Accepts Italian, European, and international formats.
      .regex(/^[A-Z]{2}[0-9A-Z]{2,13}$/i, 'vat_id must be 2 letters + 2-13 alnum')
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    country_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, 'country_code must be ISO 3166-1 alpha-2')
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    headquarters_city: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .nullable()
      .optional(),
    industry_hint: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .optional(),
    description: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .nullable()
      .optional(),
  })
  .strict();

export type TenantProfileV1 = z.infer<typeof TenantProfileV1Schema>;

// ---- IndustryClassificationEnrichmentV1 ------------------------------------

export const IndustryClassificationEnrichmentV1Schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .nullable()
      .optional(),
    name_en: z.string().trim().min(1).max(255).nullable().optional(),
    name_it: z.string().trim().min(1).max(255).nullable().optional(),
    description_en: z.string().trim().min(1).max(2000).nullable().optional(),
    description_it: z.string().trim().min(1).max(2000).nullable().optional(),
    sample_activities: z
      .array(z.string().trim().min(1).max(200))
      .max(20)
      .nullable()
      .optional(),
  })
  .strict();

export type IndustryClassificationEnrichmentV1 = z.infer<
  typeof IndustryClassificationEnrichmentV1Schema
>;

// ---- Registry --------------------------------------------------------------

/**
 * Maps the `entity_name` stored on enrichment_entity_descriptors to the
 * corresponding Zod schema. extract() looks up the schema here before
 * validating the LLM output. Unknown entity names fall back to passthrough
 * (no validation beyond the JSON schema the provider already honours).
 */
export const zodSchemaByEntity: Record<string, z.ZodTypeAny> = {
  tenant_profile: TenantProfileV1Schema,
  industry_classification_enrichment: IndustryClassificationEnrichmentV1Schema,
};

/**
 * Validates a raw parsed record against the registered Zod schema for the
 * given entity. Returns the parsed record (with transforms applied) on
 * success. Throws a ZodError with structured .issues on failure so the
 * retry layer can feed issues back into the corrective prompt.
 */
export function validateExtractedByEntity(
  entityName: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const schema = zodSchemaByEntity[entityName];
  if (!schema) return raw;
  return schema.parse(raw) as Record<string, unknown>;
}
