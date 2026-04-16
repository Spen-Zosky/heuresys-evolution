import type { FieldStrategy } from './policies.js';

/**
 * SEE Fase 7 — per-field merge strategies.
 *
 * Each strategy is a pure decision function: given the candidate value,
 * the current value on the target row, the candidate confidence, and the
 * source trust score, it returns a MergeDecision:
 *   - apply: boolean → should we UPDATE the target column?
 *   - newValue: the value to write (may differ from candidate.value, e.g.
 *     for append strategies)
 *   - reason: short string explaining the decision (logged + audit)
 *
 * The strategies never mutate their inputs. The apply engine runs this
 * in a tight loop and batches UPDATEs per target_record_id.
 */

export interface MergeDecisionInput {
  strategy: FieldStrategy;
  fieldName: string;
  candidateValue: unknown;
  currentValue: unknown;
  confidence: number;
  trustScore: number;
  /** policy top-level mode — 'merge' auto-applies, 'suggest' previews only */
  policyMode: 'suggest' | 'merge' | 'observe';
  /** operator explicitly approved this candidate via the commit endpoint */
  operatorApproved: boolean;
}

export interface MergeDecision {
  apply: boolean;
  newValue: unknown;
  reason: string;
}

const HIGH_CONFIDENCE = 0.85;
const AUTHORITATIVE_TRUST = 0.9;

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return false;
}

/**
 * Decides what to do with a single candidate for a single field.
 */
export function decideMerge(input: MergeDecisionInput): MergeDecision {
  const {
    strategy,
    candidateValue,
    currentValue,
    confidence,
    trustScore,
    policyMode,
    operatorApproved,
  } = input;

  // Observe mode never writes — it only records candidates for analysis.
  if (policyMode === 'observe') {
    return { apply: false, newValue: candidateValue, reason: 'policy mode=observe' };
  }
  // Suggest mode writes ONLY when the operator has explicitly approved
  // this candidate via the commit endpoint.
  if (policyMode === 'suggest' && !operatorApproved) {
    return { apply: false, newValue: candidateValue, reason: 'policy mode=suggest, awaiting approval' };
  }

  if (isEmpty(candidateValue)) {
    return { apply: false, newValue: candidateValue, reason: 'candidate empty' };
  }

  switch (strategy) {
    case 'suggest_only':
      return { apply: false, newValue: candidateValue, reason: 'strategy=suggest_only' };

    case 'update_if_empty':
      return isEmpty(currentValue)
        ? { apply: true, newValue: candidateValue, reason: 'target empty' }
        : { apply: false, newValue: candidateValue, reason: 'target already set' };

    case 'update_if_empty_or_verified':
      if (isEmpty(currentValue)) {
        return { apply: true, newValue: candidateValue, reason: 'target empty' };
      }
      if (valuesEqual(currentValue, candidateValue) && trustScore >= AUTHORITATIVE_TRUST) {
        return {
          apply: false,
          newValue: candidateValue,
          reason: 'target matches candidate (verified, no write needed)',
        };
      }
      return { apply: false, newValue: candidateValue, reason: 'target set and differs, skip' };

    case 'authoritative_only':
    case 'prefer_authoritative':
      if (trustScore < AUTHORITATIVE_TRUST) {
        return { apply: false, newValue: candidateValue, reason: 'source not authoritative' };
      }
      if (isEmpty(currentValue)) {
        return { apply: true, newValue: candidateValue, reason: 'authoritative + target empty' };
      }
      if (valuesEqual(currentValue, candidateValue)) {
        return { apply: false, newValue: candidateValue, reason: 'authoritative, value matches' };
      }
      return {
        apply: true,
        newValue: candidateValue,
        reason: 'authoritative overrides existing',
      };

    case 'prefer_latest_high_confidence':
      if (confidence < HIGH_CONFIDENCE) {
        return { apply: false, newValue: candidateValue, reason: 'confidence below threshold' };
      }
      if (isEmpty(currentValue) || !valuesEqual(currentValue, candidateValue)) {
        return { apply: true, newValue: candidateValue, reason: 'high confidence, overwrite' };
      }
      return { apply: false, newValue: candidateValue, reason: 'value unchanged' };

    case 'append_observation_not_overwrite':
      // For array fields, append unique new items; never replace existing.
      if (Array.isArray(candidateValue)) {
        const current = Array.isArray(currentValue) ? currentValue : [];
        const merged = Array.from(new Set([...current, ...candidateValue]));
        if (merged.length === current.length) {
          return { apply: false, newValue: merged, reason: 'no new items to append' };
        }
        return { apply: true, newValue: merged, reason: `appended ${merged.length - current.length} new item(s)` };
      }
      return {
        apply: false,
        newValue: candidateValue,
        reason: 'append strategy requires array value',
      };

    case 'unknown':
    default:
      return { apply: false, newValue: candidateValue, reason: `unknown strategy: ${strategy}` };
  }
}
