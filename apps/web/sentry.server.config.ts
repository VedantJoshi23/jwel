import * as Sentry from '@sentry/nextjs';

// Server-side DSN is deliberately NOT the NEXT_PUBLIC_ one, even though the
// value is the same in practice — this file runs in the Node runtime, never
// the browser, and reading it from a plain env var (rather than a
// build-time-inlined NEXT_PUBLIC_ one) means rotating it doesn't require a
// rebuild, only a restart.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
});
