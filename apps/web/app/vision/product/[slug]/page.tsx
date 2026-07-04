import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { getProductBySlug } from '@/lib/api/products';
import { safeGetProducts } from '@/lib/api/safe-get-products';
import { getProductStockImage } from '@/lib/jewellery-images';
import { formatMinorUnits } from '@/lib/money';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { VisionRating } from '@/components/vision/product/vision-rating';
import { VisionAddToBag } from '@/components/vision/product/vision-add-to-bag';
import { VisionProductCard } from '@/components/vision/product/vision-product-card';

interface VisionProductPageProps {
  params: Promise<{ slug: string }>;
}

async function loadProduct(slug: string) {
  try {
    return await getProductBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: VisionProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return {
    title: `${product.name} — Vision Concept`,
    description: product.description.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function VisionProductPage({ params }: VisionProductPageProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const related = (await safeGetProducts({ sort: 'popularity', pageSize: 5 })).filter((p) => p.id !== product.id).slice(0, 4);

  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
  const image = product.media[0]?.storageRef.startsWith('http')
    ? product.media[0].storageRef
    : getProductStockImage(product.id);

  return (
    <>
      {/* Full-bleed hero — same dramatic scale as the homepage's cinematic sections. */}
      <section className="relative flex h-[85vh] min-h-[560px] items-end overflow-hidden bg-[#0A0A0C]">
        <Image src={image} alt={product.name} fill priority sizes="100vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/20 to-transparent" />

        <div className="relative z-[2] w-full px-[8vw] pb-16">
          <Link
            href="/vision"
            data-vision-magnet
            className="mb-6 inline-block text-[10px] uppercase text-[#F5F1EA]/60"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
          >
            ← Vision
          </Link>
          <p
            className="mb-4 text-[10px] uppercase text-[#C8A24A]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — {product.category.name} —
          </p>
          <h1
            className="max-w-[800px] text-[clamp(36px,7vw,96px)] leading-[1] tracking-tight text-[#F5F1EA]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            {product.name}
          </h1>
        </div>
      </section>

      {/* Details — plain background, flips with the theme toggle. */}
      <section className="bg-[rgb(var(--v-bg))] px-[8vw] py-[10vh]">
        <div className="mx-auto grid max-w-[1200px] gap-[6vw] md:grid-cols-2">
          <ScrollReveal>
            {Number(product.avgRating) > 0 && (
              <VisionRating value={Number(product.avgRating)} count={product.ratingCount} className="mb-6" />
            )}
            <p className="max-w-md text-sm leading-relaxed text-[rgb(var(--v-ink)/0.7)]">{product.description}</p>
            {product.variants[0]?.metal && (
              <p
                className="mt-6 text-[11px] uppercase text-[rgb(var(--v-ink)/0.5)]"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.2em' }}
              >
                {String(product.variants[0].metal).replace(/_/g, ' ')}
              </p>
            )}
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <VisionAddToBag product={product} />
            <p className="mt-6 text-xs text-[rgb(var(--v-ink)/0.5)]">Free standard delivery on all orders</p>
          </ScrollReveal>
        </div>

        {related.length > 0 && (
          <div className="mx-auto mt-[10vh] max-w-[1200px]">
            <ScrollReveal>
              <p
                className="mb-10 text-[10px] uppercase text-[rgb(var(--v-gold))]"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
              >
                — You May Also Love —
              </p>
            </ScrollReveal>
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {related.map((p, i) => (
                <ScrollReveal key={p.id} delay={i * 0.06}>
                  <VisionProductCard product={p} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
