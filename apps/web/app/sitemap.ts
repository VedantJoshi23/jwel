import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/api/products';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/collections/all`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/customer-service`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/shipping`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/subscriptions`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const { items } = await getProducts({ pageSize: 100 }, 3600);
    const productEntries: MetadataRoute.Sitemap = items.map((product) => ({
      url: `${SITE_URL}/product/${product.slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
    return [...staticEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}
