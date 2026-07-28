import * as Sentry from '@sentry/nextjs';

// Covers middleware and any edge routes — a separate runtime from
// sentry.server.config.ts's Node process, so it needs its own Sentry.init.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
});
