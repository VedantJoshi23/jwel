import * as Sentry from '@sentry/node';

/**
 * Imported as the very first line of main.ts, before any other module —
 * Sentry's own requirement, so its instrumentation can hook into modules
 * (http, pg, etc.) before they are required elsewhere.
 *
 * Absent SENTRY_DSN this is a complete no-op: `Sentry.init` is never called,
 * so every `Sentry.captureException` call elsewhere in the app (see
 * AllExceptionsFilter) is inert. That is deliberate — local dev, CI, and any
 * deployment that hasn't set up a Sentry project yet must behave exactly as
 * they did before this file existed, with no placeholder DSN required.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    // Absent when unset — Sentry simply omits the release tag rather than
    // tagging every event with "undefined". Set this to the deployed git SHA
    // (see deploy/README.md) to get per-release error tracking.
    release: process.env.SENTRY_RELEASE,
    // Tracing/profiling are off by default — this is error tracking only,
    // matching ADR-0002's scope. Enabling performance tracing later is a
    // one-line change here, not a re-architecture.
    tracesSampleRate: 0,
  });
}
