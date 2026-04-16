import { describe, it, expect } from 'vitest';
import { localizedField } from '../lib/i18n-utils';

describe('localizedField', () => {
  const record = {
    name_it: 'Gestione Dipendenti',
    name_en: 'Employee Management',
    description_it: 'Descrizione italiana',
    description_en: 'English description',
  };

  it('returns the requested locale value', () => {
    expect(localizedField(record, 'name', 'en')).toBe('Employee Management');
    expect(localizedField(record, 'name', 'it')).toBe('Gestione Dipendenti');
  });

  it('falls back to _it when requested locale is missing', () => {
    const partial = { name_it: 'Solo italiano' };
    expect(localizedField(partial, 'name', 'en')).toBe('Solo italiano');
  });

  it('returns empty string when no value exists', () => {
    expect(localizedField({}, 'name', 'en')).toBe('');
  });

  it('handles description field', () => {
    expect(localizedField(record, 'description', 'en')).toBe('English description');
  });
});
