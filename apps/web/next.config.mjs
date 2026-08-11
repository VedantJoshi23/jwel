import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Turns NEXT_PUBLIC_API_ORIGIN (e.g. https://api.example.com) into a
// next/image remotePattern for the /uploads/** path the API serves media from.
// Returns [] when unset or unparseable so local development — where the
// localhost:4000 entry below already covers it — is unaffected.
function apiOriginPattern() {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (!origin) return [];

  try {
    const { protocol, hostname, port } = new URL(origin);
    return [
      {
        protocol: protocol.replace(':', ''),
        hostname,
        ...(port ? { port } : {}),
        pathname: '/uploads/**',
      },
    ];
  } catch {
    throw new Error(`NEXT_PUBLIC_API_ORIGIN is not a valid URL: ${origin}`);
  }
}

/**
 * Dev-against-a-remote-VM support. `lib/api/client.ts` falls back to a
 * relative `/api/v1` in the browser whenever `NEXT_PUBLIC_API_URL` is unset —
 * this rewrite is what makes that relative path resolve to anything. Without
 * it, a browser on a machine other than the VM (reached via a forwarded dev
 * port, e.g. VS Code's Ports panel forwarding 3123) has no way to reach the
 * API at all: `http://localhost:4000` in that browser means the visitor's own
 * laptop, not the VM, and the API container only binds `127.0.0.1:4000` on
 * the VM itself — reachable from the Next.js *server* process (same host),
 * never directly from a remote browser.
 *
 * Routing the browser's calls through this same-origin rewrite instead means:
 * only the one already-forwarded port needs forwarding, and the request
 * becomes same-origin from the browser's perspective — no separate port-4000
 * tunnel, and no CORS entanglement with the deployed API container's
 * `CORS_ALLOWED_ORIGINS`, which is (correctly) locked to the production
 * domain and has no reason to know about a developer's forwarded localhost.
 *
 * Only added when `NEXT_PUBLIC_API_URL` is unset — an explicit value means a
 * real deployment already has its own working path to the API and this
 * rewrite would just be dead weight.
 */
function devApiRewrites() {
  if (process.env.NEXT_PUBLIC_API_URL) return [];
  return [{ source: '/api/v1/:path*', destination: 'http://127.0.0.1:4000/api/v1/:path*' }];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return devApiRewrites();
  },
  // Produces .next/standalone: a self-contained server bundle with only the
  // node_modules it actually traces, instead of the full monorepo install.
  // The Docker runtime stage copies just that folder — no npm install needed
  // at runtime. Explicit outputFileTracingRoot pins tracing to the monorepo
  // root (npm workspaces hoist deps up to there) so the trace doesn't miss
  // hoisted packages or, in a fresh clone with no sibling projects, guess wrong.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    // `**.amazonaws.com` — the S3StorageProvider's default resolveUrl() shape
    // (ports/storage-provider.port.ts); add your CloudFront domain here too
    // if CDN_BASE_URL is configured. `localhost:4000` — the
    // FilesystemStorageProvider serving uploads back from the API itself.
    //
    // The self-hosted deployment runs STORAGE_PROVIDER=filesystem behind a real
    // domain, so the API's public origin must be allowlisted too — next/image
    // throws at render on any host not listed here, which would break every
    // product photo. Derived from NEXT_PUBLIC_API_ORIGIN so it tracks the API's
    // PUBLIC_BASE_URL instead of being hardcoded per environment.
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
      ...apiOriginPattern(),
    ],
  },
};

// `withSentryConfig` uploads source maps at build time, which needs
// SENTRY_AUTH_TOKEN (an org-scoped API token, not the DSN — see
// instrumentation-client.ts for the DSN). No Sentry project exists for this
// client yet, so there is no token to set.
//
// Only wrapping when the token is present means an unconfigured build is
// byte-for-byte the config that existed before Sentry was added — no plugin
// runs, no network call is attempted, no build-time behavior changes. Same
// "inert without secrets" principle as apps/api/src/instrument.ts. Error
// *reporting* (instrumentation-client.ts, instrumentation.ts) works
// regardless of this — only the source-map upload depends on the token, and
// without it stack traces in Sentry are just less readable, not absent.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      // Uploaded maps are for Sentry's stack-trace resolution only; deleting
      // them after upload keeps them out of the served bundle and out of the
      // image layer.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      disableLogger: true,
    })
  : nextConfig;
