import { describe, it, expect } from 'vitest';
import itMessages from '../../messages/it.json';
import enMessages from '../../messages/en.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('i18n key parity', () => {
  const itKeys = new Set(flattenKeys(itMessages as Record<string, unknown>));
  const enKeys = new Set(flattenKeys(enMessages as Record<string, unknown>));

  it('every IT key exists in EN', () => {
    const missing = [...itKeys].filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('every EN key exists in IT', () => {
    const missing = [...enKeys].filter((k) => !itKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('no empty string values in IT', () => {
    const emptyKeys = [...itKeys].filter((k) => {
      const parts = k.split('.');
      let val: unknown = itMessages;
      for (const p of parts) val = (val as Record<string, unknown>)[p];
      return val === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  it('no empty string values in EN', () => {
    const emptyKeys = [...enKeys].filter((k) => {
      const parts = k.split('.');
      let val: unknown = enMessages;
      for (const p of parts) val = (val as Record<string, unknown>)[p];
      return val === '';
    });
    expect(emptyKeys).toEqual([]);
  });
});
