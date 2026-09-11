import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { safeGetProducts } from '@/lib/api/safe-get-products';
import { safeGetActiveBanners } from '@/lib/api/cms';
import { getProductStockImage } from '@/lib/jewellery-images';
import { ProductCard } from '@/components/product/product-card';
import { PromoBanners } from '@/components/home/promo-banners';
import { BestsellersCarousel } from '@/components/home/bestsellers-carousel';
import { brand } from '@/lib/brand';
import { RecommendedRail } from '@/components/recommendations/personalized-rail';
import { RecentlyViewedRail } from '@/components/recommendations/recently-viewed-rail';
import { RevealSection } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: brand.seo.defaultTitle,
  description: brand.seo.defaultDescription,
};

// Hard cap, independent of whatever the API is asked for — the Bestsellers
// section is a curated highlight strip, not a full listing, so this bounds
// it even if the fetch below is ever changed to ask for more.
const MAX_BESTSELLERS = 10;

export default async function HomePage() {
  const [newIn, bestsellers, banners] = await Promise.all([
    safeGetProducts({ sort: 'newest', pageSize: 3 }),
    safeGetProducts({ sort: 'popularity', pageSize: MAX_BESTSELLERS }),
    safeGetActiveBanners(),
  ]);

  const hero = brand.hero;
  // Real catalogue photography, not stock/invented imagery — the first
  // bestseller (falling back to the deterministic per-product stock image
  // ProductCard itself uses when a product has no media) rather than a
  // hardcoded image reference, so this stays correct as the catalogue changes.
  const heroProduct = bestsellers[0] ?? newIn[0] ?? null;
  const heroImageUrl = heroProduct
    ? (heroProduct.media[0]?.url ?? getProductStockImage(heroProduct.id))
    : null;

  return (
    <>
      {/* ── Hero — Lavender Rose: gradient type panel + real product photo ── */}
      <section className="grid bg-surface-alt lg:grid-cols-2">
        <div className="relative min-h-[280px] bg-surface-band lg:min-h-[380px]" aria-hidden="true">
          {heroImageUrl ? (
            <Image src={heroImageUrl} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-display text-3xl tracking-[0.2em] text-brand-ink lg:text-4xl">{brand.name}</span>
            </div>
          )}
        </div>
        <div className="band-gradient flex flex-col justify-center gap-5 px-6 py-14 text-white lg:px-12">
          <h1 className="whitespace-pre-line font-display text-4xl font-bold leading-[1.05] tracking-tight lg:text-5xl">
            {hero.headline || brand.tagline}
          </h1>
          {hero.subtext && <p className="max-w-md text-sm leading-relaxed">{hero.subtext}</p>}
          <div className="flex flex-wrap gap-3.5 pt-1">
            <Button asChild size="l" className="bg-brand-accent text-ink-primary hover:bg-brand-accent/90">
              <Link href={hero.primaryCtaHref}>{hero.primaryCta}</Link>
            </Button>
            <Button asChild size="l" variant="secondary" className="border-white text-white hover:bg-white/10">
              <Link href={hero.secondaryCtaHref}>{hero.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Scheduled promo banners (CMS) — renders nothing when none are
             active, so the page is unchanged on a store with no campaign ── */}
      <PromoBanners banners={banners} />

      {/*
        Sections below the fold materialise as they scroll in. Deliberately
        not applied to the hero: the first thing on the page should already
        be there, not arrive.
      */}
      {/* Delivery check (FEAT-DELIVERY-ESTIMATE) moved into the header
          (components/layout/header.tsx) so it's available on every page —
          removed from here rather than duplicated. */}

      {/* ── Category trio ─────────────────────────────────────────────────── */}
      <RevealSection className="grid gap-7 px-6 py-11 sm:grid-cols-3 lg:px-8">
        {brand.homeCategories.map((category) => (
          <Link key={category.slug} href={`/collections/${category.slug}`} className="group">
            {/* Stock lifestyle photography removed — a plain tile until real
                category photography exists. `rounded-m` stays: this is still
                navigational imagery, not the product-card imagery DESIGN.md
                §2.4 keeps sharp-framed. */}
            <div
              className="h-[200px] rounded-m border border-border bg-surface-band transition-colors group-hover:bg-price-bg"
              aria-hidden="true"
            />
            <p className="mt-3.5 text-center font-medium">{category.name}</p>
          </Link>
        ))}
      </RevealSection>

      {/* ── New Arrivals ───────────────────────────────────────────────────── */}
      <RevealSection className="bg-surface-warm px-6 py-12 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            {brand.newArrivals.headline}
          </h2>
          <div className="mt-2 flex items-center justify-center gap-2.5">
            <span className="bg-brand-primary px-3 py-1 text-xs font-bold tracking-wide text-white">
              {brand.newArrivals.saleBadge}
            </span>
            <span className="text-sm text-ink-secondary">{brand.newArrivals.saleSubtext}</span>
          </div>
          <p className="mt-2 text-sm text-ink-secondary">{brand.newArrivals.subtext}</p>
        </div>

        {newIn.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newIn.map((product) => (
              <ProductCard key={product.id} product={product} isNew />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-ink-muted">
            New arrivals coming soon — check back shortly.
          </p>
        )}
      </RevealSection>

      {/* ── Bestsellers ───────────────────────────────────────────────────── */}
      {bestsellers.length > 0 && (
        <RevealSection className="grid gap-10 bg-surface-alt px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight">
              {brand.bestsellers.headline}
            </h2>
            <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-ink-secondary">
              {brand.bestsellers.subtext}
            </p>
          </div>
          {/*
            The carousel column had no upper bound: on a wide viewport, the
            1fr/1.2fr grid gives it most of the row's width, and since each
            tile is aspect-square, the photos grew both wider AND taller in
            lockstep — at ~1400px+ viewports the two tiles dwarfed the text
            column and unbalanced the section (reported against the live
            site 2026-08-15). Capping the column's own width, not the tiles'
            percentage split BestsellersCarousel's slide math depends on,
            stops that growth without touching the carousel component itself.

            `min-w-0` (and `minmax(0, …)` on the lg track above) is the other
            half of that, and it is what was missing: a grid item defaults to
            `min-width: auto`, so this column refused to shrink below the
            carousel track's intrinsic width — ~1570px of slides laid side by
            side. That sized the whole single-column mobile grid to 1570px,
            blew the document out to a ~1600px scrollWidth at a 320-390px
            viewport, and let mobile browsers widen the layout viewport and
            zoom out into dead space (client-reported 2026-09-08). The
            carousel's own `overflow-hidden` clips the track visually but
            does not stop it contributing that intrinsic width upward.
          */}
          <div className="w-full min-w-0 lg:ml-auto lg:max-w-[640px]">
            <BestsellersCarousel products={bestsellers.slice(0, MAX_BESTSELLERS)} />
          </div>
        </RevealSection>
      )}

      {/*
        "Recommended for you" when signed in, "Trending now" otherwise — the
        heading follows the source, because calling a trending list personalised
        would claim something that did not happen. Renders nothing at all when
        there is no signal yet, which on this catalogue is the common case.
      */}
      <RevealSection className="px-6 lg:px-8">
        <RecommendedRail />
        <RecentlyViewedRail />
      </RevealSection>
    </>
  );
}
