import type { Metadata } from 'next';
import { safeGetProducts, safeGetProductsResult } from '@/lib/api/safe-get-products';
import { formatMinorUnits } from '@/lib/money';
import { brand } from '@/lib/brand';
import { getCategoryBannerImage } from '@/lib/jewellery-images';
import { VisionHero } from '@/components/vision/hero';
import { VisionStatement } from '@/components/vision/statement';
import { VisionCraft } from '@/components/vision/craft';
import { GemChapter } from '@/components/vision/gem-chapter';
import { VisionCollections, type CollectionTile } from '@/components/vision/collections';
import { ProductGrid } from '@/components/vision/product-grid';
import { VisionVoices } from '@/components/vision/voices';
import { VisionAtelier } from '@/components/vision/atelier';

export const metadata: Metadata = {
  title: 'GLINT — Crafted to become timeless. (Vision Concept)',
  description:
    'An unlisted concept pitch: a cinematic, editorial direction for GLINT — not the live storefront.',
  robots: { index: false, follow: false },
};

async function getCategorySummary(slug: string) {
  const result = await safeGetProductsResult({ category: slug, sort: 'price_asc', pageSize: 1 });
  const cheapest = result.items[0];
  const minPrice = cheapest ? Math.min(...cheapest.variants.map((v) => v.basePriceMinorUnits)) : 0;
  return { total: result.total, minPrice };
}

export default async function VisionPage() {
  const [jhumkas, necklaceSets, bangles, allTotal, featured] = await Promise.all([
    getCategorySummary('jhumkas'),
    getCategorySummary('necklace-sets'),
    getCategorySummary('bangles'),
    safeGetProductsResult({ pageSize: 1 }),
    safeGetProducts({ sort: 'popularity', pageSize: 6 }),
  ]);

  const tiles: CollectionTile[] = [
    ...brand.homeCategories.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      href: `/vision/collections/${c.slug}`,
      meta: `${[jhumkas, necklaceSets, bangles][i].total} pieces`,
      image: getCategoryBannerImage(c.slug),
    })),
    {
      slug: 'all',
      name: 'Everything',
      href: '/vision/collections/all',
      meta: `${allTotal.total} pieces, every category`,
    },
  ];

  return (
    <>
      <VisionHero />
      <VisionStatement />
      <VisionCraft />

      <GemChapter
        align="left"
        background="linear-gradient(180deg, #08080A 0%, #0A1E14 30%, #0F3D2E 60%, #0A1E14 100%)"
        wash="radial-gradient(ellipse at center, transparent 30%, rgba(10,30,20,.6) 100%)"
        accent="#8FBFA0"
        eyebrow="— Jhumkas —"
        headline={
          <>
            Movement,
            <br />
            <em className="italic text-[#8FBFA0]">made to catch</em>
            <br />
            the light.
          </>
        }
        body="Traditional bell-shaped jhumkas with an antique gold finish, light enough for all-day wear."
        stats={[
          { value: String(jhumkas.total), label: 'Pieces' },
          { value: formatMinorUnits(jhumkas.minPrice), label: 'From' },
        ]}
        gem={{
          position: 'right-[8vw] top-1/2 -translate-y-1/2',
          size: 'h-[min(55vh,460px)] w-[min(55vh,460px)]',
          glow: 'radial-gradient(circle, #6FE0A0 0%, #1A6B45 35%, transparent 70%)',
          shapeGradient: 'linear-gradient(135deg, #C8F5D8 0%, #4FBF80 45%, #0A3020 100%)',
          clipPath: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
        }}
        href="/vision/collections/jhumkas"
        ctaLabel="Shop Jhumkas →"
      />

      <GemChapter
        align="right"
        background="linear-gradient(180deg, #0A1E14 0%, #1A0508 20%, #4A0A15 55%, #1A0508 100%)"
        wash="radial-gradient(ellipse at 70% 40%, rgba(200,50,60,.35) 0%, transparent 45%)"
        accent="#E88090"
        eyebrow="— Necklace Sets —"
        headline={
          <>
            Layers,
            <br />
            <em className="italic text-[#E88090]">for every</em>
            <br />
            occasion.
          </>
        }
        body="Kundan-studded chokers, layered pearl sets and pendant necklaces — statement pieces for festive wear and everyday layering."
        stats={[
          { value: String(necklaceSets.total), label: 'Pieces' },
          { value: formatMinorUnits(necklaceSets.minPrice), label: 'From' },
        ]}
        gem={{
          position: 'left-[8vw] top-1/2 -translate-y-1/2',
          size: 'h-[min(50vh,420px)] w-[min(50vh,420px)]',
          glow: 'radial-gradient(circle, #FF6B7A 0%, #C8202E 25%, transparent 70%)',
          shapeGradient: 'linear-gradient(135deg, #FFB0BC 0%, #E82030 35%, #8B0A18 70%, #3A0508 100%)',
          clipPath: 'polygon(50% 5%, 80% 30%, 90% 65%, 50% 95%, 10% 65%, 20% 30%)',
        }}
        href="/vision/collections/necklace-sets"
        ctaLabel="Shop Necklace Sets →"
      />

      <GemChapter
        align="right"
        background="linear-gradient(180deg, #1A0508 0%, #050820 25%, #0E1F4A 60%, #050820 100%)"
        wash="radial-gradient(ellipse at 30% 60%, rgba(60,120,220,.35) 0%, transparent 50%)"
        accent="#8FA8E8"
        eyebrow="— Bangles —"
        headline={
          <>
            Stacked,
            <br />
            <em className="italic text-[#8FA8E8]">simply.</em>
          </>
        }
        body="Antique gold-finish bangles with fine filigree detailing, sold in sets built for stacking."
        stats={[
          { value: String(bangles.total), label: 'Pieces' },
          { value: formatMinorUnits(bangles.minPrice), label: 'From' },
        ]}
        gem={{
          position: 'left-[12vw] top-1/2 -translate-y-1/2',
          size: 'h-[min(48vh,400px)] w-[min(48vh,400px)]',
          glow: 'radial-gradient(circle, #8FB0FF 0%, #2050C8 25%, transparent 70%)',
          shapeGradient: 'linear-gradient(135deg, #B0C8FF 0%, #3060E8 40%, #0A2080 75%, #050530 100%)',
          clipPath: 'polygon(30% 0, 70% 0, 100% 40%, 80% 100%, 20% 100%, 0 40%)',
          rotate: 'rotate(15deg)',
        }}
        href="/vision/collections/bangles"
        ctaLabel="Shop Bangles →"
      />

      <VisionCollections tiles={tiles} />
      <ProductGrid products={featured} />
      <VisionVoices />
      <VisionAtelier />
    </>
  );
}
