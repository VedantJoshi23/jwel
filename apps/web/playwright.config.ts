import { defineConfig, devices } from '@playwright/test';

// Assumes apps/api and Postgres are already running locally (the same
// requirement every other milestone's validation has had — see BACKEND.md
// §11/FRONTEND.md §6). Does not start them itself, since the API needs a
// migrated database and seed data this config has no business owning.
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
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
