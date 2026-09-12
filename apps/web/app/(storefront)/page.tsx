import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { safeGetProducts } from '@/lib/api/safe-get-products';
import { safeGetActiveBanners } from '@/lib/api/cms';
import { getHomeCategoryTileImage, getProductStockImage } from '@/lib/jewellery-images';
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

// Client-approved reference photography per ADR-0026 — the empty arched
// room. Shared with the About page hero, which is the same shot; it carries
// no jewellery, so it makes no claim about the catalogue.
const HERO_BACKDROP = '/images/banners/arched-room.webp';

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
      {/*
        ── Hero ──────────────────────────────────────────────────────────
        The client's arched-room set photograph (ADR-0026), spanning the
        whole section with the type and the product both stacked on top of
        it, replacing the split white-panel / gradient-panel pair.

        Spanning rather than filling one half is the point: the reference is
        a single continuous room with its light falling across the whole
        frame, so cutting it at the column boundary was the one thing it
        could not survive. The two columns swap sides as well — the painted
        niche sits on the right of the photograph, so the product goes there
        and the type takes the empty, evenly-lit wall on the left.

        No `BannerArt` here any more. That component exists to put a motif
        on a panel that would otherwise be flat colour; this photograph
        brings its own gold linework in the arch, and a second, rotating
        mandala on top of it read as clutter. The animated one stays on the
        collection banners, which are still flat panels.
      */}
      <section className="relative isolate overflow-hidden bg-surface-alt">
        <Image
          src={HERO_BACKDROP}
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden="true"
          className="-z-10 object-cover object-[72%_center] lg:object-center"
        />
        <div className="grid items-center gap-9 px-6 py-14 lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:gap-12 lg:px-12 lg:py-20">
          {/* Dark type on the room's pale wall, where it used to be white on
              a saturated gradient. The wall is the emptiest, most evenly lit
              part of the photograph, which is what lets this stay legible
              without laying a scrim over the image. */}
          <div className="flex flex-col gap-5">
            <h1 className="whitespace-pre-line font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-primary lg:text-5xl">
              {hero.headline || brand.tagline}
            </h1>
            {hero.subtext && (
              <p className="max-w-md text-sm leading-relaxed text-ink-secondary">{hero.subtext}</p>
            )}
            <div className="flex flex-wrap gap-3.5 pt-1">
              <Button asChild size="l">
                <Link href={hero.primaryCtaHref}>{hero.primaryCta}</Link>
              </Button>
              <Button asChild size="l" variant="secondary" className="bg-surface/70 backdrop-blur">
                <Link href={hero.secondaryCtaHref}>{hero.secondaryCta}</Link>
              </Button>
            </div>
          </div>

          {/* Arch-topped so the product reads as standing in the niche
              painted behind it rather than as a rectangle pasted over it. */}
          {heroImageUrl ? (
            <div
              className="relative mx-auto aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-t-full border border-white/70 lg:max-w-[340px]"
              aria-hidden="true"
            >
              <Image
                src={heroImageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 340px, 300px"
                // Catalogue photography is shot on white. Multiplying drops
                // that white into the room behind it so the piece stands in
                // the niche instead of on a white card pasted over it; the
                // border is what keeps the arch legible once the fill goes.
                className="object-cover mix-blend-multiply"
              />
            </div>
          ) : (
            <span
              className="text-center font-display text-3xl tracking-[0.2em] text-brand-ink lg:text-4xl"
              aria-hidden="true"
            >
              {brand.name}
            </span>
          )}
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
      {/* Two-up on a phone, four-up from `sm` — every category the catalogue
          has, not a curated three. Showing three of four made the omitted
          one read as discontinued rather than merely unfeatured, and the
          row divides evenly either way. */}
      <RevealSection className="grid grid-cols-2 gap-5 px-6 py-11 sm:grid-cols-4 sm:gap-6 lg:px-8">
        {brand.homeCategories.map((category) => {
          const tileImage = getHomeCategoryTileImage(category.slug);
          return (
            <Link key={category.slug} href={`/collections/${category.slug}`} className="group">
              {/* Client-approved reference photography per ADR-0026, cropped
                  to exclude its own baked-in title text — the real category
                  name below is what a screen reader and search engine see,
                  same navigational role (not product-card imagery, DESIGN.md
                  §2.4) the removed placeholder tile had. Square, because the
                  crop is squarest at the point where the piece itself is
                  largest; a letterboxed tile spent its height on backdrop.
                  Falls back to the plain tile for any category the approved
                  set doesn't cover, rather than reusing an unrelated photo. */}
              <div
                className="relative aspect-square overflow-hidden rounded-m border border-border bg-surface-band transition-colors group-hover:bg-price-bg"
                aria-hidden="true"
              >
                {tileImage && (
                  <Image
                    src={tileImage}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                )}
              </div>
              <p className="mt-3.5 text-center font-medium">{category.name}</p>
            </Link>
          );
        })}
      </RevealSection>

      {/* ── New Arrivals ───────────────────────────────────────────────────── */}
      <RevealSection className="bg-surface-warm px-6 py-12 lg:px-8">
        {/* Client-approved reference photography per ADR-0026, kept strictly
            behind the headline only — never extending down to the product
            grid, so it never sits adjacent to a real price or "Add to bag".
            Low opacity and edge-faded (the mask) rather than a hard-edged
            photo panel, so it reads as atmosphere, not a product shot. */}
        <div className="relative isolate mx-auto max-w-2xl overflow-hidden">
          <Image
            src="/images/banners/jewellery-grouping.webp"
            alt=""
            fill
            aria-hidden="true"
            sizes="(min-width: 1024px) 42rem, 100vw"
            className="-z-10 object-cover opacity-[0.14]"
            style={{ maskImage: 'radial-gradient(closest-side, black 40%, transparent 100%)' }}
          />
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
