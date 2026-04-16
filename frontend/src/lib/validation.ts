// Italian validation messages
export const validationMessages = {
  required: 'Campo obbligatorio',
  email: "Inserisci un'email valida",
  minLength: (min: number) => `Minimo ${min} caratteri`,
  maxLength: (max: number) => `Massimo ${max} caratteri`,
  codiceFiscale: 'Codice fiscale non valido',
  phone: 'Numero di telefono non valido (formato: +39 XXX XXXXXXX)',
  date: 'Data non valida',
  dateRange: 'La data di fine deve essere successiva alla data di inizio',
  iban: 'IBAN non valido',
  piva: 'Partita IVA non valida',
  positiveNumber: 'Inserisci un numero positivo',
  futureDate: 'La data deve essere nel futuro',
  pastDate: 'La data deve essere nel passato',
  weekday: 'Seleziona un giorno lavorativo',
  insufficientBalance: 'Saldo insufficiente',
}

// Codice Fiscale validation
export function validateCodiceFiscale(cf: string): boolean {
  if (!cf || cf.length !== 16) return false
  const cfRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i
  return cfRegex.test(cf)
}

// Italian phone validation
export function validateItalianPhone(phone: string): boolean {
  if (!phone) return false
  const phoneRegex = /^(\+39\s?)?(3[0-9]{2}|0[0-9]{1,3})[\s.-]?[0-9]{6,7}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

// IBAN validation (basic Italian)
export function validateIBAN(iban: string): boolean {
  if (!iban) return false
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()
  if (cleanIban.length !== 27 || !cleanIban.startsWith('IT')) return false
  const ibanRegex = /^IT[0-9]{2}[A-Z][0-9]{10}[A-Z0-9]{12}$/
  return ibanRegex.test(cleanIban)
}

// Partita IVA validation
export function validatePartitaIVA(piva: string): boolean {
  if (!piva) return false
  const cleanPiva = piva.replace(/\s/g, '')
  if (cleanPiva.length !== 11 || !/^\d+$/.test(cleanPiva)) return false

  // Luhn-like checksum for Italian VAT numbers
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const digit = parseInt(cleanPiva[i], 10)
    if (i % 2 === 0) {
      sum += digit
    } else {
      const doubled = digit * 2
      sum += doubled > 9 ? doubled - 9 : doubled
    }
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === parseInt(cleanPiva[10], 10)
}

// Email validation
export function validateEmail(email: string): boolean {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Form validation helper
export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

export function validateForm(
  data: Record<string, unknown>,
  rules: Record<string, Array<(value: unknown) => string | null>>
): ValidationResult {
  const errors: Record<string, string> = {}

  for (const [field, validators] of Object.entries(rules)) {
    const value = data[field]
    for (const validator of validators) {
      const error = validator(value)
      if (error) {
        errors[field] = error
        break
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Common validators
export const validators = {
  required: (message = validationMessages.required) => (value: unknown) =>
    value === undefined || value === null || value === '' ? message : null,

  email: (message = validationMessages.email) => (value: unknown) =>
    typeof value === 'string' && !validateEmail(value) ? message : null,

  minLength: (min: number, message?: string) => (value: unknown) =>
    typeof value === 'string' && value.length < min
      ? message || validationMessages.minLength(min)
      : null,

  maxLength: (max: number, message?: string) => (value: unknown) =>
    typeof value === 'string' && value.length > max
      ? message || validationMessages.maxLength(max)
      : null,

  codiceFiscale: (message = validationMessages.codiceFiscale) => (value: unknown) =>
    typeof value === 'string' && !validateCodiceFiscale(value) ? message : null,

  phone: (message = validationMessages.phone) => (value: unknown) =>
    typeof value === 'string' && value && !validateItalianPhone(value) ? message : null,

  iban: (message = validationMessages.iban) => (value: unknown) =>
    typeof value === 'string' && value && !validateIBAN(value) ? message : null,
}
