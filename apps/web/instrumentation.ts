import * as Sentry from '@sentry/nextjs';

// Next's instrumentation hook — auto-detected, no config flag needed since
// Next 13.4. Runs once per runtime at process start, which is why the actual
// Sentry.init calls live in separate per-runtime files: importing
// sentry.server.config.ts eagerly here would pull Node-only code into the
// edge bundle and fail that build.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors thrown during Server Component rendering — the one class
// of server-side error that doesn't pass through Sentry.init's automatic
// instrumentation, per @sentry/nextjs's own App Router requirements.
export const onRequestError = Sentry.captureRequestError;
