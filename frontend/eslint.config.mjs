import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore vendored/third-party assets
    "public/excalidraw-assets/**",
    // Playwright config declaration files (auto-generated)
    "playwright*.config.d.ts",
  ]),
  // Rule overrides
  {
    rules: {
      // --- OFF: accepted patterns, not actionable warnings ---
      // 69 instances across the codebase — gradual migration, not a CI gate
      "@typescript-eslint/no-explicit-any": "off",
      // App runs in Docker, not on Vercel CDN — next/image optimization not applicable
      "@next/next/no-img-element": "off",
      // False positive for App Router — fonts loaded in root layout.tsx, not pages/_document
      "@next/next/no-page-custom-font": "off",
      // Required in tailwind.config.ts — no ESM alternative for plugins
      "@typescript-eslint/no-require-imports": "off",

      // --- WARN: track but don't block CI ---
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "prefer-const": "warn",
      "no-useless-escape": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@next/next/no-assign-module-variable": "warn",
      // React hooks — warn for patterns that work but aren't ideal
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // Auth check/redirect patterns in layouts use setState in effects — accepted pattern
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    }
  },
  // Storybook files - disable hooks rules (render functions use hooks legitimately)
  {
    files: ["**/*.stories.tsx", "**/*.stories.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    }
  },
  // Test files - relax strict rules that add noise without value
  {
    files: ["**/__tests__/**", "**/*.test.tsx", "**/*.test.ts", "**/*.spec.tsx", "**/*.spec.ts", "e2e/**"],
    rules: {
      "react/display-name": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    }
  }
]);

export default eslintConfig;
