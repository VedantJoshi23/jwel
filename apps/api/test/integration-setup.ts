import * as path from 'path';
import * as dotenv from 'dotenv';

// Loaded once per test file via jest's `setupFilesAfterEnv` — points every
// integration test at the real `jwel_test` Postgres database (see
// `.env.test`), never the dev `jwel` database. Integration tests in this
// suite always run against a real Postgres instance through a real NestJS
// app (no mocked Prisma), consistent with this project's established
// "validate against the real thing" discipline (BACKEND.md throughout).
// Override is load-bearing locally, not tidiness: dotenv's default leaves an
// already-set variable alone, so a shell exporting DATABASE_URL for the dev
// database silently wins over `.env.test` — and this suite calls `deleteMany`
// between specs, so it would wipe dev data while the comment above promised
// `jwel_test`.
//
// Not in CI, though. The workflow supplies its own DATABASE_URL for its
// Postgres service (postgres@5432) which differs from this file's local
// developer values (jwel@5436); overriding there would point CI at a port
// nothing listens on. In CI the hazard does not exist — the env is built fresh
// per job — so deferring to it is correct rather than merely convenient.
dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
  override: !process.env.CI,
});

// Whichever source won above, the invariant is the same and is checked here:
// this suite only ever runs against the test database.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is unset after loading .env.test — refusing to run integration tests.');
}
const databaseName = new URL(url).pathname.replace(/^\//, '');
if (databaseName !== 'jwel_test') {
  throw new Error(
    `Integration tests clear tables between specs and must only run against "jwel_test", but DATABASE_URL ` +
      `points at "${databaseName}". Check for an exported DATABASE_URL in your shell, or a modified .env.test.`,
  );
}
