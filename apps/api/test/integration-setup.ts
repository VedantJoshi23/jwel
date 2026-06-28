import * as path from 'path';
import * as dotenv from 'dotenv';

// Loaded once per test file via jest's `setupFilesAfterEnv` — points every
// integration test at the real `jwel_test` Postgres database (see
// `.env.test`), never the dev `jwel` database. Integration tests in this
// suite always run against a real Postgres instance through a real NestJS
// app (no mocked Prisma), consistent with this project's established
// "validate against the real thing" discipline (BACKEND.md throughout).
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
