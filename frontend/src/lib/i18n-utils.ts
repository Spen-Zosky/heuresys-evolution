/**
 * Selects the localized value from a DB record with parallel columns (_it/_en).
 * Fallback chain: requested locale -> 'it' -> empty string.
 *
 * Usage: localizedField(area, 'name', locale) reads area.name_en or area.name_it
 */
export function localizedField(
  data: Record<string, unknown>,
  field: string,
  locale: string
): string {
  return (data[`${field}_${locale}`] as string) ?? (data[`${field}_it`] as string) ?? '';
}
