/**
 * CI-specific Playwright configuration
 * Runs only smoke tests for faster CI feedback
 * Full test suite should be run locally or in nightly builds
 */
declare const _default: import("@playwright/test").PlaywrightTestConfig<{}, {}>;
export default _default;
//# sourceMappingURL=playwright.ci.config.d.ts.map