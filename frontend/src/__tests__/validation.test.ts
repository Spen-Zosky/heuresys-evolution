import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateCodiceFiscale,
  validateItalianPhone,
  validateIBAN,
  validatePartitaIVA,
  validateForm,
  validators,
  validationMessages,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe('validateEmail', () => {
  it('accepts a standard email address', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmail('admin@mail.heuresys.com')).toBe(true);
  });

  it('accepts email with plus addressing', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('rejects string without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects string without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects string without TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });

  it('rejects string with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateCodiceFiscale
// ---------------------------------------------------------------------------
describe('validateCodiceFiscale', () => {
  it('accepts a valid codice fiscale (uppercase)', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H501Z')).toBe(true);
  });

  it('accepts a valid codice fiscale (lowercase)', () => {
    expect(validateCodiceFiscale('rssmra85m01h501z')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateCodiceFiscale('')).toBe(false);
  });

  it('rejects string shorter than 16 characters', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H50')).toBe(false);
  });

  it('rejects string longer than 16 characters', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H501ZZ')).toBe(false);
  });

  it('rejects string with invalid structure (digits where letters expected)', () => {
    expect(validateCodiceFiscale('1234567890123456')).toBe(false);
  });

  it('rejects null-like falsy input', () => {
    // The function checks `if (!cf ...)` so passing an empty-ish value should fail
    expect(validateCodiceFiscale(undefined as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateItalianPhone
// ---------------------------------------------------------------------------
describe('validateItalianPhone', () => {
  it('accepts mobile number with +39 prefix', () => {
    expect(validateItalianPhone('+39 320 1234567')).toBe(true);
  });

  it('accepts mobile number without prefix', () => {
    expect(validateItalianPhone('3201234567')).toBe(true);
  });

  it('accepts landline number with area code', () => {
    expect(validateItalianPhone('06 12345678')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateItalianPhone('')).toBe(false);
  });

  it('rejects random letters', () => {
    expect(validateItalianPhone('abcdefghij')).toBe(false);
  });

  it('rejects too-short number', () => {
    expect(validateItalianPhone('320123')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateIBAN
// ---------------------------------------------------------------------------
describe('validateIBAN', () => {
  it('accepts a well-formed Italian IBAN', () => {
    // Standard 27-char Italian IBAN: IT + 2 digits + 1 letter + 10 digits + 12 alnum
    expect(validateIBAN('IT60X0542811101000000123456')).toBe(true);
  });

  it('accepts IBAN with spaces (gets cleaned)', () => {
    expect(validateIBAN('IT60 X054 2811 1010 0000 0123 456')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateIBAN('')).toBe(false);
  });

  it('rejects non-Italian IBAN (wrong country code)', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(false);
  });

  it('rejects IBAN with wrong length', () => {
    expect(validateIBAN('IT12345')).toBe(false);
  });

  it('rejects null-like falsy input', () => {
    expect(validateIBAN(undefined as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePartitaIVA
// ---------------------------------------------------------------------------
describe('validatePartitaIVA', () => {
  it('accepts a valid Partita IVA with correct checksum', () => {
    // 12345670785 is a well-known valid P.IVA
    expect(validatePartitaIVA('12345670785')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validatePartitaIVA('')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validatePartitaIVA('abcdefghijk')).toBe(false);
  });

  it('rejects string shorter than 11 digits', () => {
    expect(validatePartitaIVA('123456')).toBe(false);
  });

  it('rejects string longer than 11 digits', () => {
    expect(validatePartitaIVA('123456789012')).toBe(false);
  });

  it('rejects P.IVA with wrong checksum', () => {
    // 12345670781 - last digit changed, checksum invalid
    expect(validatePartitaIVA('12345670781')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateForm
// ---------------------------------------------------------------------------
describe('validateForm', () => {
  it('returns isValid true when all rules pass', () => {
    const result = validateForm(
      { name: 'Mario', email: 'mario@example.com' },
      {
        name: [validators.required()],
        email: [validators.required(), validators.email()],
      }
    );
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('returns errors for missing required fields', () => {
    const result = validateForm(
      { name: '', email: '' },
      {
        name: [validators.required()],
        email: [validators.required()],
      }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe(validationMessages.required);
    expect(result.errors.email).toBe(validationMessages.required);
  });

  it('stops at first error per field', () => {
    const result = validateForm(
      { email: '' },
      {
        email: [validators.required(), validators.email()],
      }
    );
    // Should return the "required" message, not the "email" message
    expect(result.errors.email).toBe(validationMessages.required);
  });
});

// ---------------------------------------------------------------------------
// validators (higher-order)
// ---------------------------------------------------------------------------
describe('validators', () => {
  it('minLength rejects strings shorter than minimum', () => {
    const validate = validators.minLength(5);
    expect(validate('abc')).toBe(validationMessages.minLength(5));
  });

  it('minLength accepts strings at or above minimum', () => {
    const validate = validators.minLength(3);
    expect(validate('abc')).toBeNull();
  });

  it('maxLength rejects strings longer than maximum', () => {
    const validate = validators.maxLength(3);
    expect(validate('abcdef')).toBe(validationMessages.maxLength(3));
  });

  it('maxLength accepts strings at or below maximum', () => {
    const validate = validators.maxLength(10);
    expect(validate('hello')).toBeNull();
  });

  it('codiceFiscale validator returns error for invalid CF', () => {
    const validate = validators.codiceFiscale();
    expect(validate('INVALID')).toBe(validationMessages.codiceFiscale);
  });

  it('codiceFiscale validator returns null for valid CF', () => {
    const validate = validators.codiceFiscale();
    expect(validate('RSSMRA85M01H501Z')).toBeNull();
  });

  it('phone validator returns null for empty string (optional field)', () => {
    const validate = validators.phone();
    expect(validate('')).toBeNull();
  });

  it('phone validator returns error for invalid phone', () => {
    const validate = validators.phone();
    expect(validate('notaphone')).toBe(validationMessages.phone);
  });
});
