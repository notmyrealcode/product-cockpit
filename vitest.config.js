"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['src/webview/**'], // Exclude React components (need jsdom)
        testTimeout: 60000, // Claude CLI tests need longer timeout
    },
});
//# sourceMappingURL=vitest.config.js.map