import { defineConfig, devices } from '@playwright/test';

// Assumes apps/api and Postgres are already running locally (the same
// requirement every other milestone's validation has had — see BACKEND.md
// §11/FRONTEND.md §6). Does not start them itself, since the API needs a
// migrated database and seed data this config has no business owning.
//
// The web app itself: locally, reuse whatever `next dev` a developer
// already has running (fast iteration); in CI, always start fresh via a
// production build (`next start`), never `next dev` — the CI workflow
// builds the app in its own step first (mirroring how it already does
// `nest build` for the API). A dynamic route's first-ever on-demand
// compile in dev mode is fast on a local machine but was measured to
// exceed the 30s per-test timeout on a loaded/shared CI runner, causing
// intermittent `page.goto` timeouts on `/product/[slug]` — production
// mode has no such compile-on-first-request behavior at all.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared seeded accounts across spec files; parallel workers would race on them
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
