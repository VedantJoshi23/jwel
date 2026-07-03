import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { safeGetProducts } from '@/lib/api/safe-get-products';
import { ProductCard } from '@/components/product/product-card';
import { ParallaxHero } from '@/components/cinematic/parallax-hero';
import { MacroScene } from '@/components/cinematic/macro-scene';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { brand } from '@/lib/brand';
import { categoryImages, heroImage, macroSparkleImage } from '@/lib/jewellery-images';

export const metadata: Metadata = {
  title: brand.seo.defaultTitle,
  description: brand.seo.defaultDescription,
};

export default async function CinematicHomePage() {
  const [newIn, bestsellers] = await Promise.all([
    safeGetProducts({ sort: 'newest', pageSize: 3 }),
    safeGetProducts({ sort: 'popularity', pageSize: 2 }),
  ]);

  const hero = brand.hero;

  return (
    <>
      <ParallaxHero
        headline={hero.headline}
        subtext={hero.subtext}
        primaryCta={hero.primaryCta}
        primaryCtaHref={hero.primaryCtaHref}
      />

      {/* ── Category trio — staggered reveal ────────────────────────────────── */}
      <section className="grid gap-7 px-6 py-20 sm:grid-cols-3 lg:px-8">
        {brand.homeCategories.map((category, i) => (
          <ScrollReveal key={category.slug} delay={i * 0.12}>
            <Link href={`/collections/${category.slug}`} className="group block">
              <div className="relative h-[260px] overflow-hidden">
                <Image
                  src={categoryImages[category.slug] ?? heroImage}
                  alt={category.name}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
              </div>
              <p className="mt-4 text-center font-display text-lg font-semibold">{category.name}</p>
            </Link>
          </ScrollReveal>
        ))}
      </section>

      <MacroScene
        image={macroSparkleImage}
        eyebrow="The craft behind the piece"
        headline={'Every setting,\nconsidered.'}
      />

      {/* ── New Arrivals ───────────────────────────────────────────────────── */}
      <section className="bg-surface-warm px-6 py-20 lg:px-8">
        <ScrollReveal className="text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight">{brand.newArrivals.headline}</h2>
          <div className="mt-3 flex items-center justify-center gap-2.5">
            <span className="bg-brand-primary px-3 py-1 text-xs font-bold tracking-wide text-white">
              {brand.newArrivals.saleBadge}
            </span>
            <span className="text-sm text-ink-secondary">{brand.newArrivals.saleSubtext}</span>
          </div>
          <p className="mt-2 text-sm text-ink-secondary">{brand.newArrivals.subtext}</p>
        </ScrollReveal>

        {newIn.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newIn.map((product, i) => (
              <ScrollReveal key={product.id} delay={i * 0.1}>
                <ProductCard product={product} isNew />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-ink-muted">
            New arrivals coming soon — check back shortly.
          </p>
        )}
      </section>

      {/* ── Brand story / Subscription — editorial full-bleed moment ───────── */}
      <section className="relative overflow-hidden bg-footer-bg px-6 py-24 text-center text-white lg:px-8">
        <ScrollReveal>
          <h2 className="font-display text-4xl font-bold tracking-tight">{brand.subscription.headline}</h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-footer-ink/90">
            {brand.subscription.subtext}
          </p>
          <div className="mx-auto mt-10 flex max-w-lg flex-wrap justify-center gap-14">
            {brand.subscription.steps.map((step) => (
              <div key={step} className="text-center">
                <div className="mx-auto h-px w-10 bg-footer-accent" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
          <Link
            href="#subscribe"
            className="mt-10 inline-block bg-brand-accent px-8 py-3.5 text-sm font-semibold text-footer-bg transition-transform duration-300 hover:scale-[1.03]"
          >
            {brand.subscription.cta}
          </Link>
        </ScrollReveal>
      </section>

      {/* ── Bestsellers ───────────────────────────────────────────────────── */}
      {bestsellers.length > 0 && (
        <section className="grid gap-10 bg-surface-alt px-6 py-20 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:px-8">
          <ScrollReveal>
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
              {brand.bestsellers.headline}
            </h2>
            <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-ink-secondary">
              {brand.bestsellers.subtext}
            </p>
          </ScrollReveal>
          <div className="flex items-center gap-5">
            <div className="grid flex-1 grid-cols-2 gap-5">
              {bestsellers.map((product, i) => (
                <ScrollReveal key={product.id} delay={i * 0.12}>
                  <ProductCard product={product} />
                </ScrollReveal>
              ))}
            </div>
            <span className="shrink-0 text-3xl font-light text-ink-muted" aria-hidden="true">›</span>
          </div>
        </section>
      )}

      {/* ── Internal: concept comparison link (remove once a version is chosen) ── */}
      <p className="border-t border-border bg-surface-alt py-4 text-center text-xs text-ink-muted">
        Comparing concepts?{' '}
        <Link href="/" className="font-semibold text-brand-primary underline">
          ← Back to the classic layout
        </Link>
      </p>
    </>
  );
}
