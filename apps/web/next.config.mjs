/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Placeholder remote pattern for the S3-backed StorageProvider (ARCHITECTURE.md
    // §3) once product media is served from real URLs instead of [ placeholder ]
    // blocks. Update once the storage adapter exposes a public asset domain.
    remotePatterns: [{ protocol: 'https', hostname: '**.amazonaws.com' }],
  },
};

export default nextConfig;
