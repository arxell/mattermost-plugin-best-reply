import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['lcov', 'text-summary', 'json-summary'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/manifest.ts', 'src/types/**', 'src/**/*.test.{ts,tsx}'],
        },
    },
});
