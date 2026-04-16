/**
 * Environment variable helpers.
 *
 * requiredEnv() throws at startup if a mandatory variable is missing,
 * preventing the app from running with insecure defaults.
 */
const nodeEnv = process.env.NODE_ENV || 'development';
/**
 * Return the value of an env var, or throw in production if missing.
 * In development, falls back to devDefault (if provided) so local
 * setups keep working without a full .env.
 */
export function requiredEnv(name, devDefault) {
    const value = process.env[name];
    if (value)
        return value;
    if (nodeEnv !== 'production' && devDefault !== undefined) {
        return devDefault;
    }
    throw new Error(`Missing required environment variable: ${name}. ` +
        `Set it in your .env or environment before starting in ${nodeEnv} mode.`);
}
/**
 * Return the value of an optional env var, or undefined.
 */
export function optionalEnv(name) {
    return process.env[name] || undefined;
}
//# sourceMappingURL=env.js.map