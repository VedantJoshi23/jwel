/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // `**.amazonaws.com` — the S3StorageProvider's default resolveUrl() shape
    // (ports/storage-provider.port.ts); add your CloudFront domain here too
    // if CDN_BASE_URL is configured. `localhost:4000` — the
    // FilesystemStorageProvider's dev/test adapter, which serves uploads
    // back from the API itself; never reachable in a real deployment
    // (STORAGE_PROVIDER=s3 there), safe to leave listed regardless.
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
    ],
  },
};

export default nextConfig;
