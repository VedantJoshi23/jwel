import * as Sentry from '@sentry/nextjs';

// `NEXT_PUBLIC_*` because this file ships in the browser bundle. A Sentry DSN
// is meant to be public — it can only submit events, never read project
// data — same trust level as the other NEXT_PUBLIC_* config already baked in
// at build time (see next.config.mjs's build-arg list).
//
// Absent DSN: `Sentry.init` still runs but every SDK call becomes a no-op
// (this is the SDK's own behavior, not something built here) — so an
// unconfigured deployment reports nothing, silently, with no placeholder
// value required.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  // Error tracking only, matching ADR-0002's scope — no session replay, no
  // performance tracing. Both are one-line additions here later if wanted.
  tracesSampleRate: 0,
});

// Required by @sentry/nextjs to instrument App Router navigations; omitting
// it only produces a build-time warning, but the hook is free to wire up.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
