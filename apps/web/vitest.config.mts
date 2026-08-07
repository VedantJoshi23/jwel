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
      // The `components/vision/**` and `components/cinematic/**` exclusions
      // that used to sit here are gone (2026-08-07, DISC-009). They covered a
      // concept-pitch redesign whose pages were retired in 276133a; the
      // components were left behind and, per KC-199, the exclusion was the
      // reason nobody noticed they had become dead code. The owner confirmed
      // the pitch had served its purpose, so `components/cinematic/` is
      // deleted and both exclusions removed rather than carried forward.
      // Everything under `lib/**` and `components/**` now counts toward the
      // gate — if something is excluded again, delete it or test it instead.
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
