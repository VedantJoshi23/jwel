import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { safeGetProducts } from '@/lib/api/safe-get-products';
import { ProductCard } from '@/components/product/product-card';
import { brand } from '@/lib/brand';
import { categoryImages, heroImage } from '@/lib/jewellery-images';

export const metadata: Metadata = {
  title: brand.seo.defaultTitle,
  description: brand.seo.defaultDescription,
};

export default async function HomePage() {
  const [newIn, bestsellers] = await Promise.all([
    safeGetProducts({ sort: 'newest', pageSize: 3 }),
    safeGetProducts({ sort: 'popularity', pageSize: 2 }),
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
            <Link
              href={hero.primaryCtaHref}
              className="bg-brand-primary px-7 py-3.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              {hero.primaryCta}
            </Link>
            <Link
              href={hero.secondaryCtaHref}
              className="border-[1.5px] border-brand-primary px-7 py-3.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5"
            >
              {hero.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Category trio ─────────────────────────────────────────────────── */}
      <section className="grid gap-7 px-6 py-11 sm:grid-cols-3 lg:px-8">
        {brand.homeCategories.map((category) => (
          <Link key={category.slug} href={`/collections/${category.slug}`} className="group">
            <div className="relative h-[200px] overflow-hidden">
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
      </section>

      {/* ── New Arrivals ───────────────────────────────────────────────────── */}
      <section className="bg-surface-warm px-6 py-12 lg:px-8">
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
      </section>

      {/* ── Subscription / Jewel Box ──────────────────────────────────────── */}
      <section className="px-6 py-14 text-center lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          {brand.subscription.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-secondary">
          {brand.subscription.subtext}
        </p>

        <div className="mx-auto mt-9 flex max-w-lg flex-wrap justify-center gap-14">
          {brand.subscription.steps.map((step) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-[78px] w-[78px] items-center justify-center rounded-[14px] bg-price-bg font-mono text-[11px] text-ink-muted">
                [ icon ]
              </div>
              <p className="mt-3 text-sm font-medium">{step}</p>
            </div>
          ))}
        </div>

        <Link
          href="#subscribe"
          className="mt-8 inline-block bg-brand-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          {brand.subscription.cta}
        </Link>
        <p className="mt-4 text-xs text-ink-muted underline">{brand.subscription.manageLink}</p>
      </section>

      {/* ── Bestsellers ───────────────────────────────────────────────────── */}
      {bestsellers.length > 0 && (
        <section className="grid gap-10 bg-surface-alt px-6 py-12 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight">
              {brand.bestsellers.headline}
            </h2>
            <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-ink-secondary">
              {brand.bestsellers.subtext}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="grid flex-1 grid-cols-2 gap-5">
              {bestsellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <span className="shrink-0 text-3xl font-light text-ink-muted" aria-hidden="true">›</span>
          </div>
        </section>
      )}

      {/* ── Internal: concept comparison link (remove once a version is chosen) ── */}
      <p className="border-t border-border bg-surface-alt py-4 text-center text-xs text-ink-muted">
        Reviewing homepage concepts?{' '}
        <Link href="/cinematic" className="font-semibold text-brand-primary underline">
          See the cinematic scroll concept →
        </Link>
      </p>
    </>
  );
}
