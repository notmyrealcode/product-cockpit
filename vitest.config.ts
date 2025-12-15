import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['src/webview/**'],  // Exclude React components (need jsdom)
        testTimeout: 60000,  // Claude CLI tests need longer timeout
    },
});
