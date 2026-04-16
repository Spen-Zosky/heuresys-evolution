/**
 * Password Policy Utility
 * Enterprise-grade password validation for the Heuresys AI-Platform
 *
 * Policy requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character
 */
export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validatePassword(password: string): PasswordValidationResult;
//# sourceMappingURL=password-policy.d.ts.map