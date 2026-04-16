/**
 * Playwright Configuration for Heuresys Platform
 *
 * Projects:
 * - setup: Authenticates as sysadmin, saves session state
 * - chromium: Main tests that depend on authentication
 * - chromium-public: Tests for public pages (no auth required)
 */
declare const _default: import("@playwright/test").PlaywrightTestConfig<{}, {}>;
export default _default;
//# sourceMappingURL=playwright.config.d.ts.map