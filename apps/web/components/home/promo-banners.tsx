import Image from 'next/image';
import Link from 'next/link';
import type { ActiveBanner } from '@/lib/api/types';

interface PromoBannersProps {
  banners: ActiveBanner[];
}

/**
 * Renders the CMS banner feed on the homepage.
 *
 * Sits *below* the hero rather than replacing it. The `Banner` model is a list
 * (sortOrder, independent scheduling windows per row) of title + image + link,
 * which is a promo strip — it has no field for the hero's subtext or its two
 * differentiated CTAs, so driving the hero from it would mean rendering a
 * degraded hero whenever a banner happened to be scheduled. The hero stays on
 * `brand.hero`.
 *
 * Renders nothing at all when the feed is empty, the same discipline as
 * DemoModeBanner: a homepage with no banners scheduled should look exactly as
 * it did before this section existed, not show an empty container.
 */
export function PromoBanners({ banners }: PromoBannersProps) {
  if (banners.length === 0) return null;

  return (
    <section aria-label="Promotions" className="grid gap-6 px-6 py-11 sm:grid-cols-2 lg:px-8">
      {banners.map((banner) => (
        <BannerCard key={banner.id} banner={banner} />
      ))}
    </section>
  );
}

function BannerCard({ banner }: { banner: ActiveBanner }) {
  const href = safeBannerHref(banner.linkUrl);

  const image = (
    <div className="relative h-[220px] overflow-hidden">
      <Image
        src={banner.imageUrl}
        alt={banner.title}
        fill
        // Banners sit below the fold on every viewport this design supports,
        // so none of them competes with the hero's `priority` image on load.
        sizes="(min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
    </div>
  );

  return (
    <div>
      {href === null ? (
        image
      ) : href.external ? (
        // rel="noopener" even without target="_blank": these links are
        // operator-entered and can point anywhere, and the cost of the
        // attribute is nil.
        <a href={href.url} rel="noopener noreferrer" className="group block">
          {image}
        </a>
      ) : (
        <Link href={href.url} className="group block">
          {image}
        </Link>
      )}
      <p className="mt-3.5 text-center font-medium">{banner.title}</p>
    </div>
  );
}

/**
 * `linkUrl` is free text typed into the admin CMS form, so it reaches here as
 * whatever an operator entered. Only two shapes are rendered as links: an
 * absolute http(s) URL, or a root-relative path. Anything else — most
 * pointedly a `javascript:` or `data:` URL — renders as a plain image with no
 * anchor at all.
 *
 * The API validates this too (UpsertBannerDto). This is the second layer on
 * purpose: rows predating that validation already exist in the database, and
 * a stored value that only the writer ever checked is one migration away from
 * being unchecked.
 */
function safeBannerHref(linkUrl: string | null): { url: string; external: boolean } | null {
  if (!linkUrl) return null;

  // Protocol-relative ("//evil.example") is an absolute URL wearing a relative
  // costume — it must not pass the root-relative branch below.
  if (linkUrl.startsWith('//')) return null;
  if (linkUrl.startsWith('/')) return { url: linkUrl, external: false };
  if (/^https?:\/\//i.test(linkUrl)) return { url: linkUrl, external: true };

  return null;
}
