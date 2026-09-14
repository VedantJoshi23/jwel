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
import { HeroProductRotator } from '@/components/home/hero-product-rotator';

export const metadata: Metadata = {
  title: brand.seo.defaultTitle,
  description: brand.seo.defaultDescription,
};

// Hard cap, independent of whatever the API is asked for — the Bestsellers
// section is a curated highlight strip, not a full listing, so this bounds
// it even if the fetch below is ever changed to ask for more.
const MAX_BESTSELLERS = 10;

// Upper bound on the hero window's crossfade set, independent of how many
// products the fetches above happen to return.
const HERO_ROTATION_MAX = 6;

// Client-approved reference photography per ADR-0026 — the empty arched
// room. Shared with the About page hero, which is the same shot; it carries
// no jewellery, so it makes no claim about the catalogue.
const HERO_BACKDROP = '/images/banners/arched-room.webp';

// The same room, cropped tall for phones rather than letting `object-cover`
// slice a third out of the wide one. See the `<picture>` below.
const HERO_BACKDROP_PORTRAIT = '/images/banners/arched-room-portrait.webp';

export default async function HomePage() {
  const [newIn, bestsellers, banners] = await Promise.all([
    safeGetProducts({ sort: 'newest', pageSize: 3 }),
    safeGetProducts({ sort: 'popularity', pageSize: MAX_BESTSELLERS }),
    safeGetActiveBanners(),
  ]);

  const hero = brand.hero;
  // Real catalogue photography only, de-duplicated and bounded: the window
  // crossfades through these, and the rotation must not become a reason to
  // load the whole catalogue into the hero. Products with no media of their
  // own are excluded rather than filled in with `getProductStockImage` —
  // the stock images are lifestyle shots that cannot blend into the glass
  // the way a studio shot can, and a rotation that visibly switched
  // treatment mid-cycle would look broken rather than varied.
  const heroRotation = [...bestsellers, ...newIn]
    .map((product) => product.media[0]?.url)
    .filter((url): url is string => Boolean(url))
    .filter((url, i, all) => all.indexOf(url) === i)
    .slice(0, HERO_ROTATION_MAX);

  // Nothing in the catalogue has its own photography yet: fall back to the
  // deterministic per-product stock image ProductCard already uses, as a
  // single still frame. `blend` goes off with it, for the reason above.
  const heroFallback = bestsellers[0] ?? newIn[0] ?? null;
  const heroImages = heroRotation.length > 0
    ? heroRotation
    : heroFallback
      ? [getProductStockImage(heroFallback.id)]
      : [];

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

        Measured on the source image, the painted arch's pale frame begins
        at 78.8% of the width and its dark opening at 82.2%. `lg:pr-[8%]`
        puts the glass pane over both, which only works because the pane
        now carries its own ground — see the fill comment in
        `HeroProductRotator`. At the earlier low fill the product multiplied
        straight into the room and crossing that 82.2% boundary drew a seam
        through the piece.

        A fraction rather than a max-width because the constraint is a
        fraction of the *image*: `object-cover` on a container wider than
        the source's own 16:9 preserves horizontal fractions exactly (it
        crops top and bottom, never the sides), so this holds at any width.

        No `BannerArt` here any more. That component exists to put a motif
        on a panel that would otherwise be flat colour; this photograph
        brings its own gold linework in the arch, and a second, rotating
        mandala on top of it read as clutter. The animated one stays on the
        collection banners, which are still flat panels.
      */}
      <section className="relative isolate overflow-hidden bg-surface-alt">
        {/*
          Art direction, not a responsive resize: the phone gets a different
          *crop* of the room, not a smaller copy of the wide one. Cropping a
          16:9 photograph into a tall viewport with `object-cover` keeps a
          vertical sliver — about a third of the frame — so the arch and the
          lotus, the two things that make the shot, were both mostly off
          screen on a phone.

          A `<picture>` rather than `next/image`, which renders a single
          `<img>` and resizes one source instead of choosing between two.
          Both files are already hand-cropped WEBP at the sizes they render
          at, so the optimizer had nothing left to do; this also means one
          request rather than a `/_next/image` round trip. `display:contents`
          keeps the wrapper from creating a box of its own, so the `<img>`
          positions against the section exactly as `fill` did.
        */}
        <picture className="contents">
          <source media="(min-width: 768px)" srcSet={HERO_BACKDROP} />
          <img
            src={HERO_BACKDROP_PORTRAIT}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
          />
        </picture>
        {/* `lg:pl-[13%]` keeps the heading clear of the hanging gold
            ornaments painted down the left of the room, which ran straight
            through "Elegance" when the text started at a fixed 48px. Those
            ornaments end at 10.8% of the image width across the whole
            vertical band the text occupies — measured, and a fraction for
            the same reason `pr` is one: it holds at every width. */}
        <div className="grid items-center gap-9 px-6 py-14 lg:grid-cols-[1fr_minmax(0,0.9fr)] lg:gap-12 lg:py-16 lg:pl-[13%] lg:pr-[8%]">
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

          {/*
            A tinted glass window onto the piece, rather than the product
            floating loose on the wall. Rectangular deliberately: the
            arch-shaped frame tried earlier competed with the painted arch
            a few percent to its right and read as a stray rounded shape,
            where a plain upright window reads as a vitrine set into the
            room. Same glass language as the rest of the chrome (ADR-0019),
            but at a much lower fill than `--glass-panel-bg`'s 0.78 — this
            one has a photograph behind it that is worth still seeing.
          */}
          {heroImages.length > 0 ? (
            <HeroProductRotator images={heroImages} blend={heroRotation.length > 0} />
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
        {/* The product-grouping photograph that sat behind this headline is
            removed, not just faded further: even at 0.14 with a radial mask
            it read as a smudge behind the type rather than as atmosphere,
            and a heading on plain `surface-warm` is cleaner than one on a
            texture nobody can identify. The image stays in the repo and in
            ADR-0026's approved set; it is simply not used here. */}
        <div className="mx-auto max-w-2xl text-center">
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
