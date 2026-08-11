import Image from 'next/image';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { safeGetProducts } from '@/lib/api/safe-get-products';
import { safeGetActiveBanners } from '@/lib/api/cms';
import { ProductCard } from '@/components/product/product-card';
import { PromoBanners } from '@/components/home/promo-banners';
import { brand } from '@/lib/brand';
import { categoryImages, heroImage } from '@/lib/jewellery-images';
import { SUBSCRIPTION_STEP_ICONS } from '@/lib/subscription-icons';
import { RecommendedRail } from '@/components/recommendations/personalized-rail';
import { RecentlyViewedRail } from '@/components/recommendations/recently-viewed-rail';
import { RevealSection } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: brand.seo.defaultTitle,
  description: brand.seo.defaultDescription,
};

export default async function HomePage() {
  const [newIn, bestsellers, banners] = await Promise.all([
    safeGetProducts({ sort: 'newest', pageSize: 3 }),
    safeGetProducts({ sort: 'popularity', pageSize: 2 }),
    safeGetActiveBanners(),
  ]);

  const hero = brand.hero;

  return (
    <>
      {/* ── Hero — wireframe 01 split layout ──────────────────────────────── */}
      <section className="grid bg-surface-alt lg:grid-cols-2">
        <div className="relative min-h-[280px] lg:min-h-[380px]" aria-hidden="true">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center gap-5 bg-surface-alt px-6 py-14 lg:px-12">
          <h1 className="whitespace-pre-line font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-primary lg:text-5xl">
            {hero.headline}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-ink-secondary">
            {hero.subtext}
          </p>
          <div className="flex flex-wrap gap-3.5 pt-1">
            <Button asChild size="l">
              <Link href={hero.primaryCtaHref}>{hero.primaryCta}</Link>
            </Button>
            <Button asChild size="l" variant="secondary">
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
      {/* ── Category trio ─────────────────────────────────────────────────── */}
      <RevealSection className="grid gap-7 px-6 py-11 sm:grid-cols-3 lg:px-8">
        {brand.homeCategories.map((category) => (
          <Link key={category.slug} href={`/collections/${category.slug}`} className="group">
            {/* `rounded-m`, not `none` — this is navigational lifestyle
                photography, not the product-card imagery DESIGN.md §2.4 keeps
                sharp-framed; nothing about that rationale extends here. */}
            <div className="relative h-[200px] overflow-hidden rounded-m">
              <Image
                src={categoryImages[category.slug] ?? heroImage}
                alt={category.name}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>
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

      {/* ── Subscription / Jewel Box ──────────────────────────────────────── */}
      <RevealSection className="px-6 py-14 text-center lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          {brand.subscription.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-secondary">
          {brand.subscription.subtext}
        </p>

        <div className="mx-auto mt-9 flex max-w-lg flex-wrap justify-center gap-14">
          {brand.subscription.steps.map((step) => {
            const Icon = SUBSCRIPTION_STEP_ICONS[step] ?? Sparkles;
            return (
              <div key={step} className="text-center">
                <div className="mx-auto flex h-[78px] w-[78px] items-center justify-center rounded-[14px] bg-price-bg text-brand-ink">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-medium">{step}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/subscriptions"
            className="inline-block bg-brand-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {brand.subscription.cta}
          </Link>
          <Link href="/subscriptions" className="inline-block text-xs text-ink-muted underline">
            {brand.subscription.manageLink}
          </Link>
        </div>
      </RevealSection>

      {/* ── Bestsellers ───────────────────────────────────────────────────── */}
      {bestsellers.length > 0 && (
        <RevealSection className="grid gap-10 bg-surface-alt px-6 py-12 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight">
              {brand.bestsellers.headline}
            </h2>
            <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-ink-secondary">
              {brand.bestsellers.subtext}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="grid flex-1 grid-cols-2 gap-6">
              {bestsellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <span className="shrink-0 text-3xl font-light text-ink-muted" aria-hidden="true">›</span>
          </div>
        </RevealSection>
      )}

      {/*
        "Recommended for you" when signed in, "Trending now" otherwise — the
        heading follows the source, because calling a trending list personalised
        would claim something that did not happen. Renders nothing at all when
        there is no signal yet, which on this catalogue is the common case.
      */}
      <div className="px-6 lg:px-8">
        <RecommendedRail />
        <RecentlyViewedRail />
      </div>
    </>
  );
}
