import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

export default nextConfig;
