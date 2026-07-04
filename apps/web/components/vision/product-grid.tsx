import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { VisionProductCard } from './product/vision-product-card';
import type { Product } from '@/lib/api/types';

/** The click-through from "browsing the vision homepage" to "a real, buyable
 * product in the same cinematic language" — every card here routes to
 * /vision/product/[slug], not the real /product/[slug]. */
export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="bg-[rgb(var(--v-bg))] px-[8vw] py-[12vh]">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <p
            className="mb-8 text-[10px] uppercase text-[rgb(var(--v-gold))]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — Bestsellers —
          </p>
          <div
            className="max-w-[900px] text-[clamp(28px,4.5vw,64px)] leading-[1.05] tracking-tight text-[rgb(var(--v-ink))]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            Pieces people
            <br />
            <em className="italic text-[rgb(var(--v-ink)/0.6)]">actually wear again.</em>
          </div>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product, i) => (
            <ScrollReveal key={product.id} delay={i * 0.06}>
              <VisionProductCard product={product} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
