import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts } from '@/lib/api/products';
import { ProductCard } from '@/components/product/product-card';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/api/types';

export const metadata: Metadata = {
  title: 'Jwel — Everyday shine, zero rules.',
  description:
    'Hoops, chains, stacking rings and statement studs — trend-led jewellery designed to layer, mix and wear on repeat.',
};

const CATEGORIES = [
  { slug: 'earrings', name: 'Earrings' },
  { slug: 'necklaces', name: 'Necklaces' },
  { slug: 'rings', name: 'Rings' },
];

async function safeGetProducts(query: Parameters<typeof getProducts>[0]): Promise<Product[]> {
  try {
    const result = await getProducts(query);
    return result.items;
  } catch {
    // Backend unreachable (e.g. no live DB/migration yet — see BACKEND.md §5).
    // Degrade to an empty section instead of crashing the whole SSR render.
    return [];
  }
}

export default async function HomePage() {
  const [newIn, bestsellers] = await Promise.all([
    safeGetProducts({ sort: 'newest', pageSize: 3 }),
    safeGetProducts({ sort: 'popularity', pageSize: 2 }),
  ]);

  return (
    <>
      {/* Hero — DESIGN.md §5.1 */}
      <section className="grid bg-surface-alt lg:grid-cols-2">
        <div
          className="flex min-h-[280px] items-center justify-center font-mono text-xs tracking-wide text-ink-muted lg:min-h-[380px]"
          aria-hidden="true"
        >
          [ hero campaign image ]
        </div>
        <div className="flex flex-col justify-center gap-5 px-6 py-12 lg:px-12">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
            Everyday shine, <br /> zero rules.
          </h1>
          <p className="max-w-md text-ink-secondary">
            Hoops, chains, stacking rings and statement studs — trend-led pieces designed to layer, mix and
            wear on repeat.
          </p>
          <Button asChild size="l" className="w-fit">
            <Link href="/collections/all">Shop now</Link>
          </Button>
        </div>
      </section>

      {/* Category trio */}
      <section className="grid gap-7 px-6 py-11 sm:grid-cols-3 lg:px-8">
        {CATEGORIES.map((category) => (
          <Link key={category.slug} href={`/collections/${category.slug}`} className="group">
            <div
              className="flex h-[180px] items-center justify-center bg-surface-alt font-mono text-xs text-ink-muted"
              aria-hidden="true"
            >
              [ category ]
            </div>
            <p className="mt-3.5 text-center font-medium">{category.name}</p>
          </Link>
        ))}
      </section>

      {/* Just in */}
      {newIn.length > 0 && (
        <section className="bg-surface-alt px-6 py-12 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold">Just in!</h2>
          <p className="mt-2 text-center text-ink-secondary">Browse our newest drops</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newIn.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Subscription band */}
      <section className="px-6 py-13 text-center lg:px-8">
        <h2 className="font-display text-3xl font-bold">Love our pieces?</h2>
        <p className="mx-auto mt-3.5 max-w-md text-ink-secondary">
          Join the monthly drop box and save 30%. A fresh trend-led piece every month — skip or cancel
          anytime, one click.
        </p>
        <Button size="l" className="mt-7">
          Subscribe now
        </Button>
      </section>

      {/* Bestsellers */}
      {bestsellers.length > 0 && (
        <section className="grid gap-10 bg-surface-alt px-6 py-12 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight">Try our bestsellers</h2>
            <p className="mt-3.5 max-w-xs text-ink-secondary">
              The pieces customers keep coming back for — tried, tested and tarnish-proof.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
