// Demo catalog seed — for local/dev use only (never run in production).
// Separate from `seed.ts` (the minimal E2E fixture `npm run prisma:seed`/CI
// runs) — that one is deliberately small per its own header comment; this is
// the full client-demo catalog, run explicitly via `npm run prisma:seed:demo`
// and never wired into CI.
//
// Resets the catalog (categories/products/variants/inventory/reviews/wishlist
// items/cart items/order items that reference them) and reseeds exactly the
// client's real 4-category taxonomy from apps/web/lib/brand.ts
// (`productTypes`/`subcategories`), each with ~40 published products so
// /collections/[slug] has enough rows to demonstrate pagination. Product
// photography is intentionally left empty — the frontend's stock-photo
// fallback (apps/web/lib/jewellery-images.ts) already covers products with no
// media, so this script doesn't need a real Storage provider.
//
// Also re-upserts `seed.ts`'s "Diamond Halo Ring" fixture (same slug/SKU) so
// that e2e/storefront.spec.ts still passes if this script runs instead of/
// after the minimal seed — this script's own category reset would otherwise
// delete it.
import { PrismaClient, MetalType, ModerationStatus, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Mirrors brand.ts's productTypes/subcategories exactly — the slugs here
// must match the slugification `/collections/[slug]/page.tsx` derives from
// `brand.productTypes` (`.toLowerCase().replace(/\s+/g,'-').replace(/&/g,'and')`).
const CATEGORIES: { name: string; slug: string; subcategories: string[] }[] = [
  { name: 'Rings', slug: 'rings', subcategories: ['Solitaire', 'Couple', 'Adjustable', 'Toe rings'] },
  { name: 'Earrings', slug: 'earrings', subcategories: ['Jhumkas', 'Hoops', 'Studs', 'Oxidised Silver'] },
  {
    name: 'Necklaces & Pendants',
    slug: 'necklaces-and-pendants',
    subcategories: ['Heart pendants', 'Zodiac pendants', 'Spiritual pendants'],
  },
  {
    name: 'Bracelets & Anklets',
    slug: 'bracelets-and-anklets',
    subcategories: ['Charm bracelets', 'Nazariya', "Kids' silver"],
  },
];

const PRODUCTS_PER_CATEGORY = 40;
const METALS: MetalType[] = [
  MetalType.GOLD,
  MetalType.GOLD_PLATED,
  MetalType.SILVER,
  MetalType.PLATINUM,
  MetalType.STAINLESS_STEEL,
];

const REVIEW_BODIES = [
  { rating: 5, title: 'Absolutely stunning', body: 'The craftsmanship is beautiful and it looks even better in person. Wore it to a wedding and got so many compliments.' },
  { rating: 5, title: 'Worth every rupee', body: 'Was hesitant about ordering jewellery online but this exceeded expectations. Packaging was premium too.' },
  { rating: 4, title: 'Lovely piece, runs slightly small', body: 'Beautiful design and good weight. Would size up if you’re between sizes.' },
  { rating: 4, title: 'Great for everyday wear', body: 'Comfortable and doesn’t tarnish even after a couple of weeks of daily use.' },
  { rating: 3, title: 'Good but delivery took long', body: 'The piece itself is nice, matches the photos, but shipping took longer than expected.' },
  { rating: 5, title: 'Perfect gift', body: 'Bought this for my sister’s birthday and she loved it. Elegant box and presentation.' },
  { rating: 4, title: 'Exactly as described', body: 'True to the product photos, feels premium, happy with the purchase.' },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

async function resetCatalog(): Promise<void> {
  console.log('Resetting existing catalog data...');

  // `OrderItem.variant` has no onDelete: Cascade (a live variant row must
  // keep existing even after edits — Order relies on its own immutable
  // productNameSnapshot/variantSnapshot JSON, per the schema's Order
  // comment, not a live join). Hard-deleting a variant still referenced by
  // a real order would violate that FK, so anything reachable from an
  // existing order_item is left untouched rather than wiped.
  const protectedVariants = await prisma.orderItem.findMany({ select: { variantId: true } });
  const protectedVariantIds = [...new Set(protectedVariants.map((v) => v.variantId))];
  const protectedProducts = await prisma.productVariant.findMany({
    where: { id: { in: protectedVariantIds } },
    select: { productId: true },
  });
  const protectedProductIds = [...new Set(protectedProducts.map((p) => p.productId))];
  const protectedCategories = await prisma.product.findMany({
    where: { id: { in: protectedProductIds } },
    select: { categoryId: true },
  });
  const protectedCategoryIds = [...new Set(protectedCategories.map((c) => c.categoryId))];

  const notInProducts = { notIn: protectedProductIds };

  await prisma.review.deleteMany({ where: { productId: notInProducts } });
  await prisma.wishlistItem.deleteMany({ where: { variant: { productId: notInProducts } } });
  await prisma.cartItem.deleteMany({ where: { variant: { productId: notInProducts } } });
  await prisma.collectionProduct.deleteMany({ where: { productId: notInProducts } });
  await prisma.productCoOccurrence.deleteMany({
    where: { OR: [{ productAId: notInProducts }, { productBId: notInProducts }] },
  });
  await prisma.productView.deleteMany({ where: { productId: notInProducts } });
  await prisma.productMedia.deleteMany({ where: { productId: notInProducts } });
  await prisma.inventory.deleteMany({ where: { variant: { productId: notInProducts } } });
  await prisma.productVariant.deleteMany({ where: { productId: notInProducts } });
  await prisma.product.deleteMany({ where: { id: notInProducts } });
  await prisma.category.deleteMany({ where: { id: { notIn: protectedCategoryIds } } });
}

async function seedCategories() {
  const categoryByName = new Map<string, { id: string; slug: string }>();
  for (const cat of CATEGORIES) {
    const parent = await prisma.category.create({ data: { name: cat.name, slug: cat.slug } });
    categoryByName.set(cat.name, parent);
    for (const [i, sub] of cat.subcategories.entries()) {
      await prisma.category.create({
        data: { name: sub, slug: `${cat.slug}-${slugify(sub)}`, parentId: parent.id, sortOrder: i },
      });
    }
  }
  return categoryByName;
}

// Guarantees `seed.ts`'s E2E fixture survives this script's own catalog
// reset — same slug/SKU, upserted so re-running either seed is idempotent.
async function seedE2eFixture(ringsCategoryId: string): Promise<void> {
  const product = await prisma.product.upsert({
    where: { slug: 'diamond-halo-ring' },
    update: { status: ProductStatus.PUBLISHED, categoryId: ringsCategoryId },
    create: {
      name: 'Diamond Halo Ring',
      slug: 'diamond-halo-ring',
      categoryId: ringsCategoryId,
      description: 'A halo of pavé diamonds around a central solitaire, in 18K gold.',
      status: ProductStatus.PUBLISHED,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { sku: 'DHR-GOLD-001' },
    update: {},
    create: {
      productId: product.id,
      sku: 'DHR-GOLD-001',
      metal: MetalType.GOLD,
      purity: '18K',
      weightGrams: 3.2,
      basePriceMinorUnits: 8500000, // ₹85,000
    },
  });

  await prisma.inventory.upsert({
    where: { variantId: variant.id },
    update: { quantityOnHand: 10 },
    create: { variantId: variant.id, quantityOnHand: 10, quantityReserved: 0 },
  });
}

async function seedProducts(categoryByName: Map<string, { id: string; slug: string }>) {
  const productIds: string[] = [];
  let skuCounter = 1;

  for (const cat of CATEGORIES) {
    const category = categoryByName.get(cat.name)!;
    for (let i = 0; i < PRODUCTS_PER_CATEGORY; i++) {
      const subcategory = pick(cat.subcategories);
      const name = `${subcategory} ${cat.name.replace(' & ', ' ').replace('Necklaces Pendants', 'Necklace')} #${i + 1}`;
      const slug = `${slugify(name)}-${skuCounter}`;
      const metal = pick(METALS);
      const basePrice = randomInt(1_500, 85_000) * 100; // paise

      const product = await prisma.product.create({
        data: {
          name,
          slug,
          categoryId: category.id,
          description: `A handcrafted ${subcategory.toLowerCase()} piece from our ${cat.name} collection, finished in ${metal.toLowerCase().replace('_', ' ')}. Demo catalog entry.`,
          status: ProductStatus.PUBLISHED,
          variants: {
            create: {
              sku: `DEMO-${skuCounter.toString().padStart(5, '0')}`,
              metal,
              purity: metal === MetalType.GOLD ? '18K' : metal === MetalType.SILVER ? '925' : null,
              size: null,
              weightGrams: (randomInt(20, 250) / 10).toFixed(1),
              basePriceMinorUnits: basePrice,
              inventory: { create: { quantityOnHand: randomInt(5, 100), quantityReserved: 0 } },
            },
          },
        },
      });
      productIds.push(product.id);
      skuCounter += 1;
    }
  }
  return productIds;
}

async function seedDummyReviewers(): Promise<string[]> {
  const passwordHash = await bcrypt.hash('DemoReviewer!123', 12);
  const names = [
    'Ananya Sharma', 'Priya Nair', 'Rahul Verma', 'Sneha Iyer', 'Kavya Reddy',
    'Aditya Rao', 'Meera Pillai', 'Vikram Singh', 'Ishita Gupta', 'Rohan Desai',
  ];
  const userIds: string[] = [];
  for (const name of names) {
    const email = `${slugify(name)}@demo-reviewer.jwel.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash, emailVerifiedAt: new Date() },
    });
    userIds.push(user.id);
  }
  return userIds;
}

async function seedReviews(productIds: string[], reviewerIds: string[]) {
  console.log('Seeding dummy reviews...');
  // ~40% of products get 1-3 approved reviews, capped by how many distinct
  // reviewers exist (Review has a @@unique([productId, userId])).
  const reviewedProducts = productIds.filter(() => Math.random() < 0.4);
  let created = 0;

  for (const productId of reviewedProducts) {
    const reviewCount = randomInt(1, Math.min(3, reviewerIds.length));
    const shuffledReviewers = [...reviewerIds].sort(() => Math.random() - 0.5).slice(0, reviewCount);

    for (const userId of shuffledReviewers) {
      const template = pick(REVIEW_BODIES);
      await prisma.review.create({
        data: {
          productId,
          userId,
          rating: template.rating,
          title: template.title,
          body: template.body,
          verifiedPurchase: Math.random() < 0.7,
          moderationStatus: ModerationStatus.APPROVED,
        },
      });
      created += 1;
    }

    const aggregate = await prisma.review.aggregate({
      where: { productId, moderationStatus: ModerationStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { avgRating: aggregate._avg.rating ?? 0, ratingCount: aggregate._count.rating },
    });
  }

  console.log(`Created ${created} approved dummy reviews across ${reviewedProducts.length} products.`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo catalog seed against a production environment.');
  }

  await resetCatalog();

  console.log('Seeding categories...');
  const categoryByName = await seedCategories();

  console.log('Re-upserting the "Diamond Halo Ring" E2E fixture...');
  await seedE2eFixture(categoryByName.get('Rings')!.id);

  console.log(`Seeding ${PRODUCTS_PER_CATEGORY * CATEGORIES.length} products...`);
  const productIds = await seedProducts(categoryByName);

  console.log('Seeding dummy reviewer accounts...');
  const reviewerIds = await seedDummyReviewers();

  await seedReviews(productIds, reviewerIds);

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
