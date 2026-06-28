import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ holds Playwright specs (a different test runner, different
    // `test`/`expect` globals) — without this, Vitest's default glob picks
    // up *.spec.ts files there too and fails to even parse them.
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['lib/**', 'components/**'],
      exclude: ['lib/api/types.ts', '**/*.d.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
