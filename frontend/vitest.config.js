"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
const plugin_react_1 = __importDefault(require("@vitejs/plugin-react"));
const path_1 = __importDefault(require("path"));
exports.default = (0, config_1.defineConfig)({
    plugins: [(0, plugin_react_1.default)()],
    resolve: {
        alias: {
            "@": path_1.default.resolve(__dirname, "./src"),
        },
        // Ensure proper React 19 module resolution
        conditions: ["import", "module", "browser", "default"],
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test-setup.ts"],
        globals: true,
        css: false,
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["e2e/**", "node_modules/**"],
    },
});
//# sourceMappingURL=vitest.config.js.map