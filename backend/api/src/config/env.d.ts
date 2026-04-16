/**
 * Environment variable helpers.
 *
 * requiredEnv() throws at startup if a mandatory variable is missing,
 * preventing the app from running with insecure defaults.
 */
/**
 * Return the value of an env var, or throw in production if missing.
 * In development, falls back to devDefault (if provided) so local
 * setups keep working without a full .env.
 */
export declare function requiredEnv(name: string, devDefault?: string): string;
/**
 * Return the value of an optional env var, or undefined.
 */
export declare function optionalEnv(name: string): string | undefined;
//# sourceMappingURL=env.d.ts.map