import type { MetadataRoute } from 'next';

// Same build-time flag as DemoModeBanner. A demo deployment must not be
// indexed: it is a real-looking shop whose checkout takes no money, and search
// results outlive the staging site — they would still be sending people to a
// dead or repurposed hostname long after the client's real domain goes live.
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function robots(): MetadataRoute.Robots {
  if (isDemoMode) {
    // No sitemap key either: advertising a sitemap while disallowing the whole
    // site invites crawlers to fetch and remember URLs anyway.
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/cart', '/checkout', '/profile', '/search'] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/sitemap.xml`,
  };
}
