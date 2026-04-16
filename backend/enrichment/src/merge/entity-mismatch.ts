/**
 * SEE Fase 7.5 — entity anchor sanity check.
 *
 * Second line of defence after the source verification gate. Before
 * applying any candidate to the target row, cross-check the extracted
 * match-key values against the target row's existing values. If the
 * existing legal name is "RTL Bank" and the extracted legal name is
 * "RTL 102.5", the content we extracted is almost certainly NOT about
 * this tenant even if the submitter claimed it was.
 *
 * Uses a simple normalised-token-overlap score: we split each value
 * into lowercase alphanumeric tokens and compute
 *   overlap = |intersection| / |smaller set|
 * If the smaller set has length 0 we return 1.0 (no signal, caller
 * decides). Below MIN_OVERLAP the pair is declared a mismatch.
 *
 * This heuristic is intentionally cheap and deterministic. More
 * sophisticated entity resolution (embeddings, fuzzy string distance)
 * can plug in later — the caller shape stays the same.
 */

// Require strict majority overlap on the smaller token set. 0.5 is
// "half the tokens match" which is too lax for short names where one
// accidental shared token (e.g. "RTL" in "RTL Bank" vs "RTL 102.5")
// looks like 50% overlap but clearly identifies different entities.
const MIN_OVERLAP = 0.6;

function tokenise(value: unknown): Set<string> {
  if (value === null || value === undefined) return new Set();
  const s = typeof value === 'string' ? value : String(value);
  const normalised = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return new Set(normalised);
}

export function tokenOverlap(a: unknown, b: unknown): number {
  const ta = tokenise(a);
  const tb = tokenise(b);
  const smaller = ta.size <= tb.size ? ta : tb;
  const bigger = ta.size <= tb.size ? tb : ta;
  if (smaller.size === 0) return 1;
  let hits = 0;
  for (const t of smaller) if (bigger.has(t)) hits++;
  return hits / smaller.size;
}

export interface EntityMismatchInput {
  fieldName: string;
  candidateValue: unknown;
  currentValue: unknown;
  /** set of match-key field names declared on the descriptor */
  matchKeyFields: string[];
}

export interface EntityMismatchResult {
  mismatch: boolean;
  overlap: number;
  reason: string;
}

/**
 * Decides whether a single candidate should be blocked by entity
 * mismatch. Only applies to fields that appear in match_keys — those
 * are the ones that define the entity's identity. Non-identity fields
 * (e.g. description) are not gated because they can legitimately change.
 *
 * If `currentValue` is empty the check passes through (overlap=1) —
 * nothing to mismatch against.
 */
export function checkEntityMismatch(
  input: EntityMismatchInput,
): EntityMismatchResult {
  const { fieldName, candidateValue, currentValue, matchKeyFields } = input;
  if (!matchKeyFields.includes(fieldName)) {
    return { mismatch: false, overlap: 1, reason: 'field is not a match key' };
  }
  if (
    currentValue === null ||
    currentValue === undefined ||
    (typeof currentValue === 'string' && currentValue.trim().length === 0)
  ) {
    return { mismatch: false, overlap: 1, reason: 'current value empty — nothing to compare' };
  }
  const overlap = tokenOverlap(candidateValue, currentValue);
  if (overlap < MIN_OVERLAP) {
    return {
      mismatch: true,
      overlap,
      reason: `entity_mismatch: token overlap ${overlap.toFixed(2)} below ${MIN_OVERLAP} (candidate="${String(
        candidateValue,
      ).slice(0, 40)}", current="${String(currentValue).slice(0, 40)}")`,
    };
  }
  return { mismatch: false, overlap, reason: `token overlap ${overlap.toFixed(2)} OK` };
}

export const __test = { tokenise, MIN_OVERLAP };
