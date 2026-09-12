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
import { cn } from '@/lib/utils';

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
  const heroMedia = heroProduct?.media[0]?.url ?? null;
  const heroImageUrl = heroProduct ? (heroMedia ?? getProductStockImage(heroProduct.id)) : null;
  // Only real catalogue shots are on white, which is the whole premise of
  // blending the hero product into the room below. The stock fallback is
  // lifestyle photography with its own background; multiplying that would
  // smear a dark rectangle across the wall.
  const heroBlendsIntoRoom = heroMedia !== null;

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
        at 78.8% of the width and its dark opening at 82.2%. `lg:pr-[18%]`
        below lands the glass pane's right edge on that pale frame — close
        enough that the arch's gold line reads *through* the glass, which is
        the point — while the product inside, inset by the pane's padding,
        stays over pale wall. That last part is a hard constraint, not
        taste: the product is multiplied, and multiplying over the dark
        opening would crush a silver ring to near-black.

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
        <Image
          src={HERO_BACKDROP}
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden="true"
          className="-z-10 object-cover object-[72%_center] lg:object-center"
        />
        {/* `lg:pl-[13%]` keeps the heading clear of the hanging gold
            ornaments painted down the left of the room, which ran straight
            through "Elegance" when the text started at a fixed 48px. Those
            ornaments end at 10.8% of the image width across the whole
            vertical band the text occupies — measured, and a fraction for
            the same reason `pr` is one: it holds at every width. */}
        <div className="grid items-center gap-9 px-6 py-14 lg:grid-cols-[1fr_minmax(0,0.9fr)] lg:gap-12 lg:py-16 lg:pl-[13%] lg:pr-[18%]">
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
          {heroImageUrl ? (
            <div className="relative mx-auto w-full max-w-[280px] lg:max-w-[320px]" aria-hidden="true">
              {/*
                The pane is a sibling *behind* the product, not a wrapper
                around it. `backdrop-filter` creates an isolated blend group,
                so a multiplying child inside this element would have had
                nothing to blend against and the studio white stayed a solid
                white block. Painted underneath instead, it is part of the
                product's backdrop and the blend works.
              */}
              <div className="absolute inset-0 rounded-m border border-white/50 bg-white/25 shadow-card backdrop-blur-md" />
              {/* The lighter top edge is the one cue that says the surface
                  has a thickness catching the light, rather than being a
                  flat wash of translucent colour. */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-m bg-white/70" />
              <div className="relative aspect-[4/5] p-4">
                <div className="relative h-full w-full">
                  <Image
                    src={heroImageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 320px, 280px"
                    // Multiplying drops the studio white into the glass, so
                    // the piece sits behind the pane rather than on a white
                    // card laid over it. A lifestyle fallback carries its own
                    // background and cannot blend away, so it fills instead.
                    className={cn(
                      heroBlendsIntoRoom
                        ? 'object-contain mix-blend-multiply'
                        : 'rounded-s object-cover',
                    )}
                  />
                </div>
              </div>
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
